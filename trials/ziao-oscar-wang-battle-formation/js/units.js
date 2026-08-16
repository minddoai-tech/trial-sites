const TAU = Math.PI * 2;

const clamp = (v, a, b) => {
  if (v !== v) v = a;
  return v < a ? a : v > b ? b : v;
};
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const rnd = (a, b) => a + Math.random() * (b - a);

function rr(ctx, x, y, w, h, r) {
  const rr2 = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr2, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr2);
  ctx.arcTo(x + w, y + h, x, y + h, rr2);
  ctx.arcTo(x, y + h, x, y, rr2);
  ctx.arcTo(x, y, x + w, y, rr2);
  ctx.closePath();
}

const UNIT_TYPES = {
  knight: {
    label: 'Knight', hp: 100, dmg: 12, range: 38, speed: 95, rate: 1.0, cost: 50,
    size: 17, reward: 20, proj: null,
    color: '#5f87ff', dark: '#3a5fd0', light: '#b9ccff'
  },
  archer: {
    label: 'Archer', hp: 60, dmg: 9, range: 200, speed: 85, rate: 0.8, cost: 65,
    size: 16, reward: 26, proj: 'arrow', projSpeed: 480,
    color: '#4ac06f', dark: '#2f8f4c', light: '#b0eac4'
  },
  catapult: {
    label: 'Catapult', hp: 130, dmg: 32, range: 320, speed: 30, rate: 0.33, cost: 200,
    size: 26, reward: 70, proj: 'rock', projSpeed: 250, splash: 55,
    color: '#c17a42', dark: '#8c5230', light: '#e8c094'
  }
};

const ENEMY_PAL = {
  knight: { color: '#ff6b6b', dark: '#c24040', light: '#ffc9c9' },
  archer: { color: '#ff8a4d', dark: '#c9562e', light: '#ffd4bd' },
  catapult: { color: '#d06565', dark: '#933a3a', light: '#f0b4b4' }
};

class Unit {
  constructor(type, team, x, y) {
    const t = UNIT_TYPES[type];
    this.type = type;
    this.team = team;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.maxHp = t.hp;
    this.hp = t.hp;
    this.dmgMul = 1;
    this.cd = 0;
    this.state = 'idle';
    this.stateT = 0;
    this.face = team === 'p' ? 1 : -1;
    this.target = null;
    this.aimX = 0;
    this.aimY = 0;
    this.cmdX = null;
    this.cmdY = null;
    this.offX = 0;
    this.offY = 0;
    this.rosterRef = null;
    this.seed = Math.random() * 100;
    this.dead = false;
    this.hitDone = false;
    this.shotDone = false;
    this.flash = 0;
  }
  get stats() { return UNIT_TYPES[this.type]; }
  get radius() { return this.stats.size * 0.6; }
  pal() { return this.team === 'p' ? this.stats : ENEMY_PAL[this.type]; }
}

function drawUnit(ctx, u, time) {
  const pal = u.pal();
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.scale(u.face, 1);
  if (u.type === 'knight') drawKnight(ctx, u, pal, time);
  else if (u.type === 'archer') drawArcher(ctx, u, pal, time);
  else drawCatapult(ctx, u, pal, time);
  ctx.restore();
  if (u.flash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + clamp(u.flash * 4, 0, 0.85).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(u.x, u.y, u.stats.size * 0.7, 0, TAU);
    ctx.fill();
  }
}

function drawKnight(ctx, u, pal, time) {
  const s = u.stats.size;
  const bob = u.state === 'attack' ? 0 : Math.sin(time * 4 + u.seed) * 1.2;
  ctx.translate(0, bob);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.95, s * 0.85, s * 0.2, 0, 0, TAU);
  ctx.fill();

  let lunge = 0, lean = 0, swing = 0;
  if (u.state === 'attack') {
    const k = Math.min(1, u.stateT / 0.26);
    lunge = Math.sin(k * Math.PI) * 9;
    lean = Math.sin(k * Math.PI) * 0.18;
    swing = -1.35 + 2.6 * k;
  }

  ctx.save();
  ctx.translate(lunge, 0);
  ctx.rotate(lean);

  ctx.strokeStyle = pal.dark;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, s * 0.2);
  ctx.lineTo(-s * 0.28, s * 0.85);
  ctx.moveTo(s * 0.2, s * 0.2);
  ctx.lineTo(s * 0.32, s * 0.85);
  ctx.stroke();

  ctx.fillStyle = pal.color;
  rr(ctx, -s * 0.45, -s * 0.55, s * 0.9, s * 0.85, s * 0.22);
  ctx.fill();

  ctx.fillStyle = pal.light;
  rr(ctx, -s * 0.45, -s * 0.55, s * 0.9, s * 0.32, s * 0.18);
  ctx.fill();

  ctx.fillStyle = '#f4cf9f';
  ctx.beginPath();
  ctx.arc(0, -s * 0.75, s * 0.29, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#ccd4df';
  ctx.beginPath();
  ctx.arc(0, -s * 0.8, s * 0.3, Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.2, -s * 0.95);
  ctx.lineTo(-s * 0.05, -s * 1.18);
  ctx.lineTo(s * 0.05, -s * 1.18);
  ctx.lineTo(s * 0.2, -s * 0.95);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = pal.dark;
  rr(ctx, s * 0.3, -s * 0.45, s * 0.4, s * 0.6, s * 0.12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, -s * 0.45);
  ctx.lineTo(s * 0.5, s * 0.15);
  ctx.stroke();

  ctx.save();
  ctx.translate(s * 0.34, -s * 0.02);
  ctx.rotate(swing - 0.6);
  ctx.strokeStyle = '#eef1f6';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 1.05, 0);
  ctx.stroke();
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(s * 0.14, -s * 0.11);
  ctx.lineTo(s * 0.14, s * 0.11);
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

function drawArcher(ctx, u, pal, time) {
  const s = u.stats.size;
  const bob = u.state === 'attack' ? 0 : Math.sin(time * 4 + u.seed) * 1.2;
  ctx.translate(0, bob);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.92, s * 0.8, s * 0.2, 0, 0, TAU);
  ctx.fill();

  let pull = 0, lean = 0;
  if (u.state === 'attack') {
    const k = Math.min(1, u.stateT / 0.6);
    if (u.stateT < 0.28) pull = u.stateT / 0.28;
    lean = Math.sin(k * Math.PI) * 0.08;
  }

  ctx.save();
  ctx.rotate(lean);

  ctx.strokeStyle = pal.dark;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-s * 0.16, s * 0.22);
  ctx.lineTo(-s * 0.2, s * 0.82);
  ctx.moveTo(s * 0.16, s * 0.22);
  ctx.lineTo(s * 0.24, s * 0.82);
  ctx.stroke();

  ctx.fillStyle = pal.color;
  rr(ctx, -s * 0.4, -s * 0.5, s * 0.8, s * 0.8, s * 0.2);
  ctx.fill();
  ctx.fillStyle = pal.light;
  rr(ctx, -s * 0.4, -s * 0.5, s * 0.8, s * 0.3, s * 0.16);
  ctx.fill();

  ctx.fillStyle = '#f4cf9f';
  ctx.beginPath();
  ctx.arc(0, -s * 0.72, s * 0.28, 0, TAU);
  ctx.fill();
  ctx.fillStyle = pal.dark;
  ctx.beginPath();
  ctx.arc(0, -s * 0.74, s * 0.3, Math.PI, TAU);
  ctx.fill();

  const bx = s * 0.38, by = -s * 0.3, r = s * 0.5;
  ctx.strokeStyle = '#7a4a20';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(bx, by, r, -Math.PI * 0.6, Math.PI * 0.6);
  ctx.stroke();

  const t1x = bx + r * Math.cos(-Math.PI * 0.6), t1y = by + r * Math.sin(-Math.PI * 0.6);
  const t2x = bx + r * Math.cos(Math.PI * 0.6), t2y = by + r * Math.sin(Math.PI * 0.6);
  const nockX = bx - pull * s * 0.55;
  ctx.strokeStyle = '#f4f6fa';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(t1x, t1y);
  ctx.lineTo(nockX, by);
  ctx.lineTo(t2x, t2y);
  ctx.stroke();

  if (pull > 0) {
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(nockX, by);
    ctx.lineTo(bx + r * 0.4, by);
    ctx.stroke();
    ctx.fillStyle = '#8d929c';
    ctx.beginPath();
    ctx.moveTo(bx + r * 0.55, by - 2.5);
    ctx.lineTo(bx + r * 0.75, by);
    ctx.lineTo(bx + r * 0.55, by + 2.5);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawCatapult(ctx, u, pal, time) {
  const s = u.stats.size;

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.9, s * 1.2, s * 0.24, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = pal.dark;
  rr(ctx, -s * 1.05, -s * 0.28, s * 2.1, s * 0.6, s * 0.14);
  ctx.fill();
  ctx.fillStyle = pal.color;
  rr(ctx, -s * 0.55, -s * 0.5, s * 1.1, s * 0.34, s * 0.1);
  ctx.fill();

  ctx.fillStyle = '#3a2b20';
  ctx.beginPath();
  ctx.arc(-s * 0.55, s * 0.12, s * 0.17, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(s * 0.55, s * 0.12, s * 0.17, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#2a2018';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-s * 0.55, s * 0.12, s * 0.07, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(s * 0.55, s * 0.12, s * 0.07, 0, TAU);
  ctx.stroke();

  let a = 0.35, rockVis = false, rockSize = 0;
  if (u.state === 'attack') {
    const k = Math.min(1, u.stateT / 1.05);
    if (u.stateT < 0.65) {
      const p = u.stateT / 0.65;
      a = 0.35 - 1.5 * p;
      rockVis = true;
      rockSize = 0.5 + p * 0.5;
    } else {
      const p = (u.stateT - 0.65) / 0.4;
      a = -1.15 + 2.15 * p;
      rockSize = Math.max(0, 1 - p);
      rockVis = rockSize > 0.15;
    }
  }

  ctx.strokeStyle = pal.dark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-s * 0.45, -s * 0.42);
  ctx.lineTo(0, -s * 0.42);
  ctx.stroke();

  ctx.save();
  ctx.translate(0, -s * 0.42);
  ctx.rotate(a);
  ctx.strokeStyle = pal.color;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(s * 1.2, 0);
  ctx.stroke();
  ctx.fillStyle = pal.dark;
  rr(ctx, s * 1.1, -s * 0.15, s * 0.36, s * 0.32, s * 0.08);
  ctx.fill();
  if (rockVis) {
    ctx.fillStyle = '#8d929c';
    ctx.beginPath();
    ctx.arc(s * 1.28, -s * 0.03, s * 0.2 * rockSize + 2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawHealthBar(ctx, u) {
  if (u.hp >= u.maxHp) return;
  const w = u.stats.size * 1.5;
  const h = 4;
  const y = -u.stats.size - 15;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  rr(ctx, -w / 2, y, w, h, 2);
  ctx.fill();
  const f = clamp(u.hp / u.maxHp, 0, 1);
  ctx.fillStyle = f > 0.5 ? '#59d05f' : f > 0.25 ? '#e8c13a' : '#e0534b';
  if (f > 0) {
    rr(ctx, -w / 2, y, w * f, h, 2);
    ctx.fill();
  }
}

function drawSelectionRing(ctx, u) {
  ctx.strokeStyle = 'rgba(255,224,138,0.95)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(u.x, u.y, u.stats.size * 0.85, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMiniIcon(ctx, entry, cell) {
  const t = UNIT_TYPES[entry.type];
  const cx = entry.type === 'catapult' ? (entry.col + 1) * cell : (entry.col + 0.5) * cell;
  const cy = entry.type === 'catapult' ? (entry.row + 1) * cell : (entry.row + 0.5) * cell;

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + cell * 0.34, cell * 0.5, cell * 0.14, 0, 0, TAU);
  ctx.fill();

  if (entry.type === 'catapult') {
    const x = entry.col * cell, y = entry.row * cell, w = cell * 2;
    ctx.fillStyle = t.dark;
    rr(ctx, x + 3, y + 3, w - 6, w - 6, 10);
    ctx.fill();
    ctx.fillStyle = t.color;
    rr(ctx, x + 8, y + 8, w - 16, w - 16, 8);
    ctx.fill();
    ctx.fillStyle = '#3a2b20';
    ctx.beginPath();
    ctx.arc(x + cell * 0.45, y + w - 8, 5, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + w - cell * 0.45, y + w - 8, 5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = t.dark;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 2);
    ctx.lineTo(cx, cy - cell * 0.6);
    ctx.stroke();
    ctx.fillStyle = '#8d929c';
    ctx.beginPath();
    ctx.arc(cx, cy - cell * 0.6, 6, 0, TAU);
    ctx.fill();
  } else {
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * 0.36, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f4cf9f';
    ctx.beginPath();
    ctx.arc(cx, cy - cell * 0.18, cell * 0.14, 0, TAU);
    ctx.fill();
    if (entry.type === 'knight') {
      ctx.strokeStyle = t.dark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy + cell * 0.2);
      ctx.lineTo(cx + cell * 0.34, cy - cell * 0.26);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#7a4a20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx + cell * 0.18, cy - 2, cell * 0.24, -Math.PI * 0.5, Math.PI * 0.5);
      ctx.stroke();
    }
  }
}
