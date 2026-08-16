const BattleScreen = {
  canvas: null,
  ctx: null,
  W: 0,
  H: 0,
  dpr: 1,
  units: [],
  projectiles: [],
  parts: Particles,
  selected: new Set(),
  mode: 'move',
  dragging: false,
  anchor: null,
  cur: null,
  dragUnit: null,
  cmdPoint: null,
  cmdT: 0,
  outcome: 'running',
  speckles: [],

  init() {
    this.canvas = document.getElementById('battle-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.bindInput();
    window.addEventListener('resize', () => this.resize());

    document.getElementById('btn-attack').addEventListener('click', () => {
      this.mode = 'attack';
      this.selected.clear();
      this.updateModeUI();
    });
    document.getElementById('btn-move').addEventListener('click', () => {
      this.mode = 'move';
      this.selected.clear();
      this.updateModeUI();
    });
    document.getElementById('btn-withdraw').addEventListener('click', () => {
      Screen.show('home');
    });
    document.getElementById('btn-to-base').addEventListener('click', () => {
      Screen.show('home');
    });

    document.addEventListener('keydown', (e) => {
      if (Screen.current !== 'battle') return;
      if (e.key === 'Escape') {
        this.selected.clear();
        this.mode = 'move';
        this.updateModeUI();
      }
    });

    this.resize();
  },

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.W = this.canvas.clientWidth || window.innerWidth;
    this.H = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = this.W * this.dpr;
    this.canvas.height = this.H * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.speckles = [];
    const n = (this.W * this.H) / 9000;
    for (let i = 0; i < n; i++) {
      this.speckles.push({
        x: Math.random() * this.W,
        y: Math.random() * this.H,
        r: rnd(1, 3)
      });
    }
  },

  toLocal(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  },

  bindInput() {
    const c = this.canvas;

    c.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const pos = this.toLocal(e);
      if (this.mode === 'move') {
        this.commandAll(pos);
        return;
      }
      this.anchor = pos;
      this.cur = pos;
      this.dragging = true;
      this.dragUnit = this.hitPlayer(pos);
      if (this.dragUnit) {
        this.selected.clear();
        this.selected.add(this.dragUnit);
      }
      this.hintUpdate();
    });

    c.addEventListener('mousemove', (e) => {
      if (this.dragging) this.cur = this.toLocal(e);
    });

    c.addEventListener('mouseup', (e) => {
      if (e.button !== 0) return;
      if (!this.dragging) return;
      this.dragging = false;
      const pos = this.toLocal(e);
      const moved = this.anchor ? dist(this.anchor.x, this.anchor.y, pos.x, pos.y) : 999;
      if (moved < 6) {
        if (this.dragUnit) {
          // single unit selected, keep
        } else if (this.selected.size > 0) {
          this.commandSelection(pos);
        } else {
          this.selected.clear();
        }
      } else {
        this.selected.clear();
        const x1 = Math.min(this.anchor.x, this.cur.x);
        const y1 = Math.min(this.anchor.y, this.cur.y);
        const x2 = Math.max(this.anchor.x, this.cur.x);
        const y2 = Math.max(this.anchor.y, this.cur.y);
        for (const u of this.units) {
          if (u.dead || u.team !== 'p') continue;
          if (u.x >= x1 && u.x <= x2 && u.y >= y1 && u.y <= y2) {
            this.selected.add(u);
          }
        }
      }
      this.anchor = null;
      this.cur = null;
      this.dragUnit = null;
      this.hintUpdate();
    });

    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.selected.clear();
      this.hintUpdate();
    });
  },

  hitPlayer(pos) {
    let best = null;
    let bd = 20;
    for (const u of this.units) {
      if (u.dead || u.team !== 'p') continue;
      const d = dist(pos.x, pos.y, u.x, u.y);
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  },

  commandAll(pos) {
    for (const u of this.units) {
      if (u.dead || u.team !== 'p') continue;
      u.cmdX = pos.x;
      u.cmdY = pos.y;
    }
    this.cmdPoint = pos;
    this.cmdT = 2.2;
  },

  commandSelection(pos) {
    for (const u of this.selected) {
      if (u.dead || u.team !== 'p') continue;
      u.cmdX = pos.x;
      u.cmdY = pos.y;
    }
    this.cmdPoint = pos;
    this.cmdT = 2.2;
  },

  updateModeUI() {
    const atk = document.getElementById('btn-attack');
    const mov = document.getElementById('btn-move');
    atk.classList.toggle('active', this.mode === 'attack');
    mov.classList.toggle('active', this.mode === 'move');
    this.hintUpdate();
  },

  hintUpdate() {
    const el = document.getElementById('battle-hint');
    if (this.mode === 'move') {
      el.textContent = 'Move mode: click the battlefield to march your whole army there. They engage enemies they meet. Switch to Attack to pick specific troops.';
    } else if (this.selected.size > 0) {
      el.textContent = 'Selection ready (' + this.selected.size + ' troops). Click a point to send them there. Drag to select more. Right-click or Esc to deselect.';
    } else {
      el.textContent = 'Attack mode: click a troop to select it, or drag a rectangle to select many.';
    }
  },

  start(wave) {
    this.resize();
    this.units = [];
    this.projectiles = [];
    this.parts.list = [];
    this.selected.clear();
    this.dragging = false;
    this.anchor = null;
    this.cur = null;
    this.dragUnit = null;
    this.cmdPoint = null;
    this.cmdT = 0;
    this.outcome = 'running';
    this.mode = 'move';

    document.getElementById('defeat-overlay').classList.add('hidden');

    this.buildPlayerUnits();
    this.buildEnemyUnits(wave);

    document.getElementById('battle-wave').textContent = wave;
    this.updateModeUI();
    this.updateHud(-1, -1, true);
  },

  buildPlayerUnits() {
    const pad = 46;
    const zoneW = this.W * 0.42;
    const cw = zoneW - pad * 0.6;
    const ch = this.H - pad * 2;
    const spawns = [];
    let cx = 0, cy = 0;
    for (const entry of GS.roster) {
      let x, y;
      if (entry.type === 'catapult') {
        x = pad + ((entry.col + 1) / 20) * cw;
        y = pad + ((entry.row + 1) / 15) * ch;
      } else {
        x = pad + ((entry.col + 0.5) / 20) * cw;
        y = pad + ((entry.row + 0.5) / 15) * ch;
      }
      spawns.push({ x, y });
      cx += x;
      cy += y;
    }
    const n = spawns.length;
    cx = n ? cx / n : 0;
    cy = n ? cy / n : 0;
    for (let i = 0; i < spawns.length; i++) {
      const entry = GS.roster[i];
      const u = new Unit(entry.type, 'p', spawns[i].x, spawns[i].y);
      u.offX = spawns[i].x - cx;
      u.offY = spawns[i].y - cy;
      u.rosterRef = entry;
      this.units.push(u);
    }
  },

  buildEnemyUnits(wave) {
    const n = Math.min(70, 4 + wave * 5);
    const comp = [];
    let cats = wave >= 3 ? Math.min(5, Math.floor(n / 8)) : 0;
    let arch = wave >= 2 ? Math.round(n * 0.3) : 0;
    arch = Math.min(arch, Math.floor(n * 0.6));
    for (let i = 0; i < cats; i++) comp.push('catapult');
    for (let i = 0; i < arch; i++) comp.push('archer');
    while (comp.length < n) comp.push('knight');
    for (let i = comp.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = comp[i]; comp[i] = comp[j]; comp[j] = tmp;
    }

    const hpMul = 1 + (wave - 1) * 0.07;
    const dmgMul = 1 + (wave - 1) * 0.03;
    const pad = 46;
    const zoneW = this.W * 0.38;
    const cols = 9;
    const rows = Math.max(1, Math.ceil(n / cols));
    for (let i = 0; i < n; i++) {
      const type = comp[i];
      const c = i % cols;
      const r = Math.floor(i / cols);
      const x = this.W - pad - zoneW + (c / (cols - 1)) * zoneW + rnd(-5, 5);
      const y = pad + (rows > 1 ? r / (rows - 1) : 0.5) * (this.H - pad * 2) + rnd(-5, 5);
      const u = new Unit(type, 'e', clamp(x, 30, this.W - 30), clamp(y, 30, this.H - 30));
      u.maxHp *= hpMul;
      u.hp = u.maxHp;
      u.dmgMul = dmgMul;
      this.units.push(u);
    }
  },

  update(dt) {
    if (this.outcome === 'running') {
      const players = [];
      const enemies = [];
      for (const u of this.units) {
        if (u.dead) continue;
        (u.team === 'p' ? players : enemies).push(u);
      }

      for (const u of this.units) {
        if (!u.dead) this.think(u, players, enemies, dt);
      }

      for (const u of this.units) {
        if (u.dead) continue;
        if (u.vx || u.vy) {
          u.x = clamp(u.x + u.vx * dt, 18, this.W - 18);
          u.y = clamp(u.y + u.vy * dt, 18, this.H - 18);
        }
        u.vx = 0;
        u.vy = 0;
      }

      this.separate(players);
      this.separate(enemies);

      this.updateProjectiles(dt, players, enemies);

      if (players.length === 0) {
        this.defeat();
      } else if (enemies.length === 0) {
        this.victory();
      }

      this.updateHud(players.length, enemies.length);
    }

    this.parts.update(dt);
    this.finalizeCoins();
    this.cmdT = Math.max(0, this.cmdT - dt);
  },

  separate(list) {
    const k = 26;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.dead) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < k && d > 0.001) {
          const push = (k - d) / k * 0.5;
          a.x -= dx / d * push;
          b.x += dx / d * push;
          a.y -= dy / d * push;
          b.y += dy / d * push;
        }
      }
    }
  },

  think(u, players, enemies, dt) {
    const stats = u.stats;
    u.cd = Math.max(0, u.cd - dt);
    u.flash = Math.max(0, u.flash - dt);

    if (u.state === 'attack') {
      u.stateT += dt;
      this.advanceAttack(u, stats);
      return;
    }

    const foes = u.team === 'p' ? enemies : players;
    let tgt = null;
    let best = Infinity;
    for (const f of foes) {
      if (f.dead) continue;
      const d2 = (f.x - u.x) * (f.x - u.x) + (f.y - u.y) * (f.y - u.y);
      if (d2 < best) { best = d2; tgt = f; }
    }
    u.target = tgt;

    if (!tgt) {
      this.marchToCommand(u, dt);
      return;
    }

    const d = Math.sqrt(best);
    const engageR = stats.range + 55;

    if (d <= stats.range) {
      this.startAttack(u, tgt);
      return;
    }
    if (u.team === 'p' && u.cmdX != null && d > engageR) {
      this.marchToCommand(u, dt);
      return;
    }
    this.moveToward(u, tgt.x, tgt.y);
  },

  marchToCommand(u, dt) {
    if (u.cmdX == null) return;
    const tx = u.cmdX + u.offX;
    const ty = u.cmdY + u.offY;
    if (dist(u.x, u.y, tx, ty) < 14) {
      u.cmdX = null;
      u.cmdY = null;
      return;
    }
    this.moveToward(u, tx, ty);
  },

  moveToward(u, tx, ty) {
    const dx = tx - u.x;
    const dy = ty - u.y;
    const d = Math.hypot(dx, dy) || 1;
    const sp = UNIT_TYPES[u.type].speed;
    u.vx = dx / d * sp;
    u.vy = dy / d * sp;
    if (Math.abs(dx) > 2) u.face = dx > 0 ? 1 : -1;
  },

  startAttack(u, tgt) {
    u.state = 'attack';
    u.stateT = 0;
    u.face = tgt.x > u.x ? 1 : -1;
    u.aimX = tgt.x + rnd(-8, 8);
    u.aimY = tgt.y + rnd(-8, 8);
    u.cd = 1 / UNIT_TYPES[u.type].rate;
    u.hitDone = false;
    u.shotDone = false;
  },

  advanceAttack(u, stats) {
    if (u.type === 'knight') {
      const dur = 0.26;
      if (!u.hitDone && u.stateT >= dur * 0.45) {
        u.hitDone = true;
        if (u.target && !u.target.dead && dist(u.x, u.y, u.target.x, u.target.y) <= stats.range + 16) {
          this.damage(u.target, stats.dmg, u);
        }
      }
      if (u.stateT >= dur) u.state = 'idle';
    } else if (u.type === 'archer') {
      const fire = 0.28;
      const dur = 0.6;
      if (!u.shotDone && u.stateT >= fire) {
        u.shotDone = true;
        this.fireArrow(u);
      }
      if (u.stateT >= dur) u.state = 'idle';
    } else {
      const fire = 0.65;
      const dur = 1.05;
      if (!u.shotDone && u.stateT >= fire) {
        u.shotDone = true;
        this.fireRock(u);
      }
      if (u.stateT >= dur) u.state = 'idle';
    }
  },

  fireArrow(u) {
    const stats = u.stats;
    const sp = stats.projSpeed;
    const a = Math.atan2(u.aimY - u.y, u.aimX - u.x);
    this.projectiles.push({
      type: 'arrow',
      team: u.team,
      x: u.x + u.face * 10,
      y: u.y - 8,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      dmg: stats.dmg,
      trail: 0
    });
  },

  fireRock(u) {
    const stats = u.stats;
    const sx = u.x + u.face * 8;
    const sy = u.y - 12;
    const ex = u.aimX;
    const ey = u.aimY;
    const dd = dist(sx, sy, ex, ey) || 1;
    this.projectiles.push({
      type: 'rock',
      team: u.team,
      x: sx, y: sy, sx, sy, ex, ey,
      t: 0,
      dur: dd / stats.projSpeed,
      height: clamp(dd * 0.35, 24, 130),
      dmg: stats.dmg,
      splash: stats.splash,
      trail: 0
    });
  },

  updateProjectiles(dt, players, enemies) {
    const keep = [];
    for (const p of this.projectiles) {
      if (p.type === 'arrow') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.trail -= dt;
        if (p.trail <= 0) {
          p.trail = 0.03;
          this.parts.dust(p.x, p.y, 3, 1, 'rgba(255,255,255,0.5)');
        }
        const foes = p.team === 'p' ? enemies : players;
        let hit = false;
        for (const f of foes) {
          if (f.dead) continue;
          if (dist(p.x, p.y, f.x, f.y) < 15) {
            this.damage(f, p.dmg, null);
            this.parts.spark(p.x, p.y, 5, '#ffdf8a');
            hit = true;
            break;
          }
        }
        if (hit || p.x < -40 || p.x > this.W + 40 || p.y < -40 || p.y > this.H + 40) continue;
        keep.push(p);
      } else {
        p.t += dt / p.dur;
        const k = Math.min(1, p.t);
        p.x = lerp(p.sx, p.ex, k);
        p.y = lerp(p.sy, p.ey, k) - p.height * Math.sin(Math.PI * k);
        p.trail -= dt;
        if (p.trail <= 0) {
          p.trail = 0.04;
          this.parts.dust(p.x, p.y, 4, 1, 'rgba(180,160,130,0.6)');
        }
        if (p.t >= 1) {
          const foes = p.team === 'p' ? enemies : players;
          let hitAny = false;
          for (const f of foes) {
            if (f.dead) continue;
            if (dist(p.ex, p.ey, f.x, f.y) <= p.splash) {
              this.damage(f, p.dmg, null);
              hitAny = true;
            }
          }
          this.parts.dust(p.ex, p.ey, 22, 10, 'rgba(190,170,140,0.85)');
          this.parts.chunks(p.ex, p.ey, { color: '#c9c4b8', dark: '#a89e8c', light: '#e5e0d3' }, hitAny ? 10 : 5);
          if (hitAny) this.parts.spark(p.ex, p.ey, 6, '#ffb347');
          continue;
        }
        keep.push(p);
      }
    }
    this.projectiles = keep;
  },

  damage(u, amt, src) {
    if (u.dead) return;
    u.hp -= amt * u.dmgMul;
    u.flash = 0.15;
    if (u.hp <= 0) this.kill(u);
  },

  kill(u) {
    if (u.dead) return;
    u.dead = true;
    const pal = u.pal();
    this.parts.chunks(u.x, u.y, pal, 26);
    this.parts.dust(u.x, u.y, 14, 6, 'rgba(190,180,160,0.6)');
    this.selected.delete(u);
    if (u.team === 'e') {
      this.spawnCoins(u.x, u.y, UNIT_TYPES[u.type].reward);
    } else if (u.rosterRef) {
      const i = GS.roster.indexOf(u.rosterRef);
      if (i >= 0) GS.roster.splice(i, 1);
    }
  },

  spawnCoins(x, y, value) {
    const n = clamp(Math.round(value / 12), 1, 4);
    const tgt = this.coinTarget();
    let rem = value;
    for (let i = 0; i < n; i++) {
      const val = i === n - 1 ? rem : Math.round(value / n);
      rem -= val;
      this.parts.addCoin(x + rnd(-8, 8), y + rnd(-8, 8), tgt.x, tgt.y, val);
    }
  },

  finalizeCoins() {
    for (const p of this.parts.list) {
      if (p.type === 'coin' && p.t >= 1) {
        GS.money += p.value;
        p.dead = true;
        updateMoneyHud();
        popEl(document.getElementById('battle-money'));
      }
    }
    this.parts.list = this.parts.list.filter(p => !p.dead);
  },

  coinTarget() {
    const el = document.getElementById('battle-money');
    const r = el.getBoundingClientRect();
    const cr = this.canvas.getBoundingClientRect();
    return {
      x: clamp(r.left + r.width / 2 - cr.left, 30, this.W - 30),
      y: clamp(r.top + r.height / 2 - cr.top, 8, this.H - 8)
    };
  },

  victory() {
    if (this.outcome !== 'running') return;
    this.outcome = 'victory';
    for (const p of this.parts.list) {
      if (p.type === 'coin') {
        GS.money += p.value;
        p.dead = true;
      }
    }
    this.parts.list = this.parts.list.filter(p => !p.dead);
    updateMoneyHud();
    Screen.show('home');
    startIntermission();
  },

  defeat() {
    if (this.outcome !== 'running') return;
    this.outcome = 'defeat';
    document.getElementById('defeat-text').textContent =
      'Your army was broken on the field. ' + GS.roster.length + ' troops survived to retreat home with your coins.';
    document.getElementById('defeat-overlay').classList.remove('hidden');
  },

  updateHud(my, en, force) {
    const myEl = document.getElementById('battle-mytroops');
    const enEl = document.getElementById('battle-enemies');
    const m = this.units.filter(u => !u.dead && u.team === 'p').length;
    const e = this.units.filter(u => !u.dead && u.team === 'e').length;
    if (force || m !== myEl._v) {
      myEl.textContent = m;
      myEl._v = m;
    }
    if (force || e !== enEl._v) {
      enEl.textContent = e;
      enEl._v = e;
    }
  },

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    const g = ctx.createLinearGradient(0, 0, 0, this.H);
    g.addColorStop(0, '#2e5d3a');
    g.addColorStop(1, '#244a30');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    for (const s of this.speckles) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.W; x += 48) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.H); ctx.stroke();
    }
    for (let y = 0; y <= this.H; y += 48) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.W, y); ctx.stroke();
    }

    ctx.fillStyle = 'rgba(90,150,255,0.06)';
    ctx.fillRect(0, 0, this.W * 0.42, this.H);
    ctx.fillStyle = 'rgba(255,90,90,0.06)';
    ctx.fillRect(this.W * 0.6, 0, this.W * 0.4, this.H);

    const drawList = this.units.filter(u => !u.dead);
    drawList.sort((a, b) => a.y - b.y);
    for (const u of drawList) {
      if (this.selected.has(u)) drawSelectionRing(ctx, u);
      drawUnit(ctx, u, performance.now() / 1000);
      drawHealthBar(ctx, u);
    }

    for (const p of this.projectiles) {
      if (p.type === 'arrow') {
        const a = Math.atan2(p.vy, p.vx);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(a);
        ctx.strokeStyle = '#caa24a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(6, 0);
        ctx.stroke();
        ctx.fillStyle = '#8d929c';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(4, -2.5);
        ctx.lineTo(4, 2.5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(p.x + 2, p.y + 5, 4, 2, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#8d929c';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#aeb4bd';
        ctx.beginPath();
        ctx.arc(p.x - 1, p.y - 1, 2, 0, TAU);
        ctx.fill();
      }
    }

    this.parts.draw(ctx);

    if (this.dragging && this.anchor && this.cur) {
      const x1 = Math.min(this.anchor.x, this.cur.x);
      const y1 = Math.min(this.anchor.y, this.cur.y);
      const x2 = Math.max(this.anchor.x, this.cur.x);
      const y2 = Math.max(this.anchor.y, this.cur.y);
      ctx.fillStyle = 'rgba(95,135,255,0.16)';
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = '#5f87ff';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
    }

    if (this.cmdPoint && this.cmdT > 0) {
      const a = this.cmdT / 2.2;
      ctx.save();
      ctx.translate(this.cmdPoint.x, this.cmdPoint.y);
      ctx.globalAlpha = clamp(a, 0, 1);
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, -16);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(7, -11);
      ctx.lineTo(0, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }
};
