(() => {
  'use strict';

  // ---------- Canvas ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const WORLD_W = 2400, WORLD_H = 1600;
  let W = 0, H = 0;

  function resize() {
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
  }
  resize();
  addEventListener('resize', resize);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  // ---------- Input ----------
  const keys = {};
  const mouse = { x: 0, y: 0, down: false, prev: false };

  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'KeyR' && player) player.reloadQueued = true;
    if (e.code === 'KeyM') audio.muted = !audio.muted;
    if (e.code === 'Escape') togglePause();
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', e => keys[e.code] = false);
  canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
  canvas.addEventListener('mousedown', e => { if (e.button === 0) mouse.down = true; });
  addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; });

  // ---------- Weapons ----------
  const WEAPONS = {
    pistol:     { name: 'Pistol',         dmg: 12, rate: 0.16, mag: 12, reload: 1.2, auto: false, spread: 0.022, speed: 540, pellets: 1, color: '#ffd166', len: 22 },
    smg:        { name: 'SMG',            dmg: 8,  rate: 0.09, mag: 30, reload: 1.5, auto: true,  spread: 0.055, speed: 620, pellets: 1, color: '#ef476f', len: 20 },
    shotgun:    { name: 'Shotgun',        dmg: 7,  rate: 0.5,  mag: 6,  reload: 1.9, auto: false, spread: 0.16,  speed: 540, pellets: 8, color: '#06d6a0', len: 26 },
    sniper:     { name: 'Sniper',         dmg: 55, rate: 0.95, mag: 4,  reload: 2.1, auto: false, spread: 0.0,   speed: 1300, pellets: 1, color: '#48cae4', len: 30 },
    machinegun: { name: 'Machine Gun',    dmg: 9,  rate: 0.06, mag: 60, reload: 2.2, auto: true,  spread: 0.09,  speed: 620, pellets: 1, color: '#ff9f1c', len: 24 },
    energy:     { name: 'Energy Pistols', dmg: 9,  rate: 0.11, mag: 24, reload: 0.9, auto: false, spread: 0.035, speed: 560, pellets: 2, color: '#5eead4', len: 20 },
    bossgun:    { name: 'Boss Cannon',    dmg: 9,  rate: 0.55, mag: 8,  reload: 1.4, auto: true,  spread: 0.28,  speed: 480, pellets: 6, color: '#d62828', len: 30 },
    bazooka:    { name: 'Bazooka',        dmg: 500, rate: 1.1,  mag: 3,  reload: 2.6, auto: false, spread: 0.02,  speed: 320, pellets: 1, color: '#fb8500', len: 30, aoe: 110, instaKill: true }
  };

  const WEAPON_ORDER = ['pistol', 'smg', 'shotgun', 'sniper', 'machinegun', 'energy', 'bazooka'];

  // ---------- World ----------
  const WALLS = [];
  function addWall(x, y, w, h) { WALLS.push({ x, y, w, h }); }

  // Arena border
  addWall(0, 0, WORLD_W, 24); addWall(0, WORLD_H - 24, WORLD_W, 24);
  addWall(0, 0, 24, WORLD_H); addWall(WORLD_W - 24, 0, 24, WORLD_H);

  // Cover blocks
  addWall(600, 200, 140, 60);
  addWall(980, 180, 60, 160);
  addWall(260, 620, 180, 60);
  addWall(1400, 700, 60, 180);
  addWall(700, 760, 200, 70);
  addWall(1150, 520, 70, 160);
  addWall(300, 1150, 160, 60);
  addWall(760, 1260, 180, 60);
  addWall(1150, 1180, 60, 180);
  addWall(1600, 140, 140, 60);
  addWall(1900, 420, 60, 200);
  addWall(1850, 950, 160, 60);
  addWall(1500, 1180, 140, 60);
  addWall(1900, 1300, 200, 70);
  addWall(500, 900, 60, 140);
  addWall(1650, 720, 120, 60);

  // ---------- Utility ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);

  function resolveX(px, py, r, rc) {
    if (py <= rc.y - r || py >= rc.y + rc.h + r) return px;
    const cx = clamp(px, rc.x, rc.x + rc.w);
    const dx = px - cx;
    if (dx * dx >= r * r) return px;
    if (px < rc.x) return rc.x - r;
    if (px > rc.x + rc.w) return rc.x + rc.w + r;
    const l = rc.x - r, rr = rc.x + rc.w + r;
    return Math.abs(px - l) < Math.abs(px - rr) ? l : rr;
  }

  function resolveY(px, py, r, rc) {
    if (px <= rc.x - r || px >= rc.x + rc.w + r) return py;
    const cy = clamp(py, rc.y, rc.y + rc.h);
    const dy = py - cy;
    if (dy * dy >= r * r) return py;
    if (py < rc.y) return rc.y - r;
    if (py > rc.y + rc.h) return rc.y + rc.h + r;
    const t = rc.y - r, b = rc.y + rc.h + r;
    return Math.abs(py - t) < Math.abs(py - b) ? t : b;
  }

  // Axis-separated circle movement so entities slide along walls instead of sticking.
  function moveEntity(e, dx, dy) {
    const m = 24; // border wall thickness
    let nx = e.x + dx;
    for (const w of WALLS) nx = resolveX(nx, e.y, e.r, w);
    nx = clamp(nx, m + e.r, WORLD_W - m - e.r);
    let ny = e.y + dy;
    for (const w of WALLS) ny = resolveY(nx, ny, e.r, w);
    ny = clamp(ny, m + e.r, WORLD_H - m - e.r);
    return { x: nx, y: ny };
  }

  // Ray vs AABB (normalized direction, length 1). Returns t or -1.
  function rayRect(ox, oy, dx, dy, r) {
    let tmin = 0, tmax = 1;
    for (const [lo, hi, dir] of [[r.x, r.x + r.w, dx], [r.y, r.y + r.h, dy]]) {
      if (Math.abs(dir) < 1e-9) {
        if (ox < lo || ox > hi) return -1;
      } else {
        let t1 = (lo - ox) / dir, t2 = (hi - ox) / dir;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) return -1;
      }
    }
    return tmin >= 0 && tmin <= 1 ? tmin : -1;
  }

  function hasLOS(x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ndx = dx / len, ndy = dy / len;
    for (const w of WALLS) {
      if (rayRect(x1, y1, ndx, ndy, w) >= 0) return false;
    }
    return true;
  }

  function openSpot(minDist) {
    for (let i = 0; i < 80; i++) {
      const x = rand(80, WORLD_W - 80), y = rand(80, WORLD_H - 80);
      let ok = true;
      for (const w of WALLS) {
        if (x > w.x - minDist && x < w.x + w.w + minDist && y > w.y - minDist && y < w.y + w.h + minDist) { ok = false; break; }
      }
      if (ok) return { x, y };
    }
    return { x: rand(100, WORLD_W - 100), y: rand(100, WORLD_H - 100) };
  }

  function pickSpawn() {
    for (let i = 0; i < 30; i++) {
      const s = openSpot(40);
      if (!player.alive) return s;
      if (dist2(s.x, s.y, player.x, player.y) > 420 * 420) return s;
    }
    return { x: rand(100, WORLD_W - 100), y: rand(100, WORLD_H - 100) };
  }

  // ---------- Audio ----------
  const audio = {
    ctx: null, muted: false,
    init() {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    tone(freq, dur, type = 'square', vol = 0.025, slide = 0) {
      if (this.muted || !this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.ctx.destination);
      o.start(t); o.stop(t + dur);
    }
  };
  const sfx = {
    shoot(w) {
      if (w === 'sniper') audio.tone(260, 0.18, 'sawtooth', 0.03, -140);
      else if (w === 'shotgun') audio.tone(180, 0.16, 'sawtooth', 0.035, -80);
      else if (w === 'smg') audio.tone(420, 0.06, 'square', 0.02, -180);
      else if (w === 'bazooka') audio.tone(90, 0.22, 'sawtooth', 0.045, -40);
      else audio.tone(340, 0.08, 'square', 0.022, -160);
    },
    boom() { audio.tone(60, 0.4, 'sawtooth', 0.05, -25); audio.tone(140, 0.18, 'square', 0.035, -70); },
    empty() { audio.tone(90, 0.03, 'square', 0.02); },
    reload() { audio.tone(300, 0.04, 'triangle', 0.025); audio.tone(220, 0.06, 'triangle', 0.025); },
    hit() { audio.tone(150, 0.07, 'triangle', 0.035, -60); },
    kill() { audio.tone(500, 0.08, 'square', 0.03); audio.tone(700, 0.14, 'square', 0.03, 200); },
    hurt() { audio.tone(110, 0.1, 'sawtooth', 0.04, -40); },
    pickup() { audio.tone(600, 0.08, 'sine', 0.04, 250); audio.tone(850, 0.1, 'sine', 0.03, 200); },
    boss() { audio.tone(120, 0.5, 'sawtooth', 0.05, -30); audio.tone(90, 0.7, 'sawtooth', 0.05, -20); }
  };

  // ---------- Progression state ----------
  const upgrades = { speed: 0, health: 0, firepower: 0, fireRate: 0, magSize: 0, pickupRate: 0 };
  const weaponLevels = {};
  let ownedWeapons = [];
  let level = 0;
  let lastEnemyCount = 1;
  let prevWasBoss = false;
  let bossCount = 0;
  let enemyCount = 0;
  let spawned = 0;
  let killsThisLevel = 0;
  let levelState = 'playing'; // 'playing' | 'upgrade' | 'weapon'
  let banner = null;

  const MAX_ACTIVE = 20;
  const isBossLevel = n => n % 20 === 0;
  const playerSpeed = () => 220 + 12 * upgrades.speed;
  const maxHealth = () => 100 + 25 * upgrades.health;
  const weaponCap = () => 5 + Math.floor(level / 10);

  function getWeaponStats(id) {
    const base = WEAPONS[id];
    const lvl = weaponLevels[id] || 0;
    const dmg = base.dmg * (1 + 0.15 * lvl) * (1 + 0.10 * upgrades.firepower);
    const rate = Math.max(0.035, base.rate * (1 - 0.03 * lvl) / (1 + 0.08 * upgrades.fireRate));
    const mag = Math.max(1, Math.round(base.mag * (1 + 0.20 * lvl) * (1 + 0.15 * upgrades.magSize)));
    const reload = Math.max(0.4, base.reload * (1 - 0.03 * lvl));
    return { ...base, dmg, rate, mag, reload };
  }
  const magOf = id => getWeaponStats(id).mag;
  const weaponStats = e => e === player ? getWeaponStats(e.weapon) : WEAPONS[e.weapon];

  const enemyHpMult = () => (1 + 0.06 * level) * (1 + 0.5 * bossCount);
  const pickupChance = () => Math.min(0.95, 0.4 + 0.15 * upgrades.pickupRate);

  // ---------- Game state ----------
  let player = null;
  let bots = [];
  let bullets = [];
  let pickups = [];
  let particles = [];
  let killFeed = [];
  let running = false;
  let paused = false;
  let cam = { x: 0, y: 0 };
  let shake = 0;

  // ---------- Entities ----------
  const BOT_TYPES = {
    grunt:  { hp: 60,  speed: 140, size: 14, weapon: 'pistol',  aggro: 280, range: 340, acc: 0.10, color: '#f4a261' },
    heavy:  { hp: 120, speed: 105, size: 17, weapon: 'smg',     aggro: 240, range: 300, acc: 0.13, color: '#e76f51' },
    sniper: { hp: 50,  speed: 115, size: 13, weapon: 'sniper',  aggro: 460, range: 720, acc: 0.05, color: '#2a9d8f' },
    boss:   { hp: 600, speed: 95,  size: 34, weapon: 'bossgun', aggro: 100000, range: 480, acc: 0.05, color: '#d62828' }
  };

  function makePlayer() {
    return {
      x: 120, y: 120, r: 15,
      hp: maxHealth(), maxHp: maxHealth(), shield: 0, maxShield: 50,
      speed: playerSpeed(), weapon: 'pistol', ammo: magOf('pistol'),
      cooldown: 0, reloading: 0, reloadQueued: false,
      alive: true, respawnTimer: 0, kills: 0, deaths: 0, hitFlash: 0, angle: 0,
      team: 0
    };
  }

  function makeBot(type, x, y, hp) {
    const def = BOT_TYPES[type];
    const mhp = hp || def.hp;
    return {
      type, x, y, r: def.size, hp: mhp, maxHp: mhp, speed: def.speed,
      weapon: def.weapon, ammo: WEAPONS[def.weapon].mag,
      cooldown: rand(0, 0.5), reloading: 0,
      alive: true, hitFlash: 0, angle: 0,
      waypoint: { x: rand(100, WORLD_W - 100), y: rand(100, WORLD_H - 100) },
      wayT: rand(1, 3), strafeDir: Math.random() < 0.5 ? 1 : -1, strafeT: rand(0.5, 1.3), team: 1
    };
  }

  function spawnBot(bot) {
    const deadIdx = bots.findIndex(b => !b.alive);
    if (deadIdx >= 0) bots[deadIdx] = bot; else bots.push(bot);
  }

  function spawnEnemy() {
    const roll = Math.random();
    let type;
    if (roll < 0.5) type = 'grunt';
    else if (roll < 0.8) type = 'heavy';
    else type = 'sniper';
    const s = pickSpawn();
    const hp = Math.round(BOT_TYPES[type].hp * enemyHpMult());
    spawnBot(makeBot(type, s.x, s.y, hp));
  }

  function spawnBoss() {
    const s = pickSpawn();
    const hp = 600 * Math.pow(2, bossCount);
    spawnBot(makeBot('boss', s.x, s.y, hp));
    killFeed.unshift({ text: '⚠ BOSS INCOMING ⚠', color: '#ffd166', t: 4 });
    sfx.boss();
  }

  // ---------- Pickups ----------
  const PICKUP_TYPES = {
    health: { color: '#57cc99', label: '+' },
    shield: { color: '#48cae4', label: 'S' },
    ammo:   { color: '#ffd166', label: 'A' },
    medkit: { color: '#4ade80', label: '+' }
  };

  function addPickup(type, x, y, respawnT = 15) {
    pickups.push({ type, x, y, r: 14, respawnT, dead: false, bob: rand(0, 6.28) });
  }

  function spawnRandomPickup() {
    const roll = Math.random();
    let type;
    if (roll < 0.4) type = 'health';
    else if (roll < 0.65) type = 'shield';
    else if (roll < 0.9) type = 'ammo';
    else type = 'medkit';
    const p = openSpot(60);
    addPickup(type, p.x, p.y);
  }

  // ---------- Particles ----------
  function burst(x, y, color, n, speed, life) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(speed * 0.3, speed);
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(life * 0.5, life), max: life, color, r: rand(1.5, 3.5), ring: false, grow: 0 });
    }
  }

  function shockwave(x, y, color, grow) {
    particles.push({ x, y, vx: 0, vy: 0, life: 0.35, max: 0.35, color, r: 12, ring: true, grow });
  }

  // ---------- Shooting ----------
  function fireBullet(owner, weapon, angle, stats) {
    const w = stats || WEAPONS[weapon];
    for (let i = 0; i < w.pellets; i++) {
      const a = angle + (rand(-1, 1) * w.spread);
      const sx = owner.x + Math.cos(a) * (owner.r + 6);
      const sy = owner.y + Math.sin(a) * (owner.r + 6);
      bullets.push({
        x: sx, y: sy,
        vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        dmg: w.dmg, color: w.color, owner, weapon,
        life: w.speed > 900 ? 1.6 : 1.4, r: w.aoe ? 6 : 2.5,
        explosive: !!w.aoe, aoe: w.aoe || 0, instaKill: !!w.instaKill, exploded: false
      });
    }
    burst(owner.x + Math.cos(angle) * owner.r, owner.y + Math.sin(angle) * owner.r, w.color, 5, 120, 0.12);
    shake = Math.min(10, shake + (weapon === 'sniper' || weapon === 'bazooka' ? 6 : 2.5));
    sfx.shoot(weapon);
  }

  function tryShoot(entity, trigger) {
    const w = weaponStats(entity);
    if (entity.cooldown > 0 || entity.reloading > 0) return;
    if (entity.ammo <= 0) {
      if (trigger) { sfx.empty(); entity.reloadQueued = true; }
      return;
    }
    if (!trigger) return;
    entity.ammo--;
    entity.cooldown = w.rate;
    fireBullet(entity, entity.weapon, entity.angle, w);
  }

  function startReload(entity) {
    const w = weaponStats(entity);
    if (entity.reloading > 0 || entity.ammo >= w.mag) return;
    entity.reloading = w.reload;
    sfx.reload();
  }

  // ---------- Bot AI ----------
  function updateBot(b, dt) {
    if (!b.alive) return;

    const def = BOT_TYPES[b.type];
    const p = player;
    const dp = dist2(b.x, b.y, p.x, p.y);
    const los = hasLOS(b.x, b.y, p.x, p.y);
    const locked = p.alive && los && dp < def.aggro * def.aggro;

    // Reload when empty (so bots always refill, even out of range)
    if (b.ammo <= 0 && b.reloading <= 0) b.reloading = WEAPONS[b.weapon].reload;
    if (b.reloading > 0) {
      b.reloading -= dt;
      if (b.reloading <= 0) { b.reloading = 0; b.ammo = WEAPONS[b.weapon].mag; }
    }

    let ang;
    if (locked) {
      const toP = Math.sqrt(dp);
      const ideal = def.range * 0.55;
      b.strafeT -= dt;
      if (b.strafeT <= 0) { b.strafeDir *= Math.random() < 0.85 ? 1 : -1; b.strafeT = rand(0.5, 1.3); }
      const base = angTo(b.x, b.y, p.x, p.y);
      if (toP < ideal - 50) ang = base + Math.PI * 0.95 * b.strafeDir;
      else if (toP > ideal + 70) ang = base + Math.PI * 0.35 * b.strafeDir;
      else ang = base + Math.PI * 0.5 * b.strafeDir;
    } else {
      b.wayT -= dt;
      if (dist2(b.x, b.y, b.waypoint.x, b.waypoint.y) < 16000 || b.wayT <= 0) {
        const w = openSpot(40);
        b.waypoint = w; b.wayT = rand(2, 5);
      }
      ang = angTo(b.x, b.y, b.waypoint.x, b.waypoint.y);
    }

    const mv = moveEntity(b, Math.cos(ang) * b.speed * dt, Math.sin(ang) * b.speed * dt);
    b.x = mv.x; b.y = mv.y;

    // Separation from other bots
    for (const o of bots) {
      if (o === b || !o.alive) continue;
      const d2 = dist2(b.x, b.y, o.x, o.y);
      const min = b.r + o.r + 6;
      if (d2 < min * min && d2 > 0.001) {
        const d = Math.sqrt(d2);
        const push = (min - d) / d;
        b.x += (b.x - o.x) * push * 0.5;
        b.y += (b.y - o.y) * push * 0.5;
      }
    }

    // Aim + shoot
    b.angle = angTo(b.x, b.y, p.x, p.y);
    if (locked && dp < def.range * def.range && b.reloading <= 0 && b.cooldown <= 0 && b.ammo > 0) {
      const w = WEAPONS[b.weapon];
      b.cooldown = w.rate * rand(1.0, 1.7);
      b.ammo--;
      const err = rand(-1, 1) * def.acc;
      fireBullet(b, b.weapon, b.angle + err);
    }

    if (b.cooldown > 0) b.cooldown -= dt;
    if (b.hitFlash > 0) b.hitFlash -= dt;
  }

  // ---------- Player ----------
  function updatePlayer(dt) {
    const pl = player;
    if (!pl.alive) {
      pl.respawnTimer -= dt;
      if (pl.respawnTimer <= 0) {
        const s = pickSpawn();
        Object.assign(pl, {
          x: s.x, y: s.y, hp: pl.maxHp, shield: 0, ammo: magOf(pl.weapon),
          alive: true, reloading: 0, cooldown: 0
        });
        burst(pl.x, pl.y, '#4cc9f0', 30, 260, 0.4);
      }
      return;
    }

    let mx = 0, my = 0;
    if (keys['KeyW'] || keys['ArrowUp']) my -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) my += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) mx += 1;
    if (mx || my) {
      const len = Math.hypot(mx, my);
      mx /= len; my /= len;
    }
    const mv = moveEntity(pl, mx * pl.speed * dt, my * pl.speed * dt);
    pl.x = mv.x; pl.y = mv.y;

    // Aim at mouse
    const wx = mouse.x + cam.x, wy = mouse.y + cam.y;
    pl.angle = angTo(pl.x, pl.y, wx, wy);

    // Weapon / reload
    if (pl.reloadQueued || pl.reloading === 0 && pl.ammo === 0 && (keys['KeyR'])) startReload(pl);
    pl.reloadQueued = false;

    if (pl.reloading > 0) {
      pl.reloading -= dt;
      if (pl.reloading <= 0) { pl.ammo = magOf(pl.weapon); pl.reloading = 0; }
    }

    if (pl.cooldown > 0) pl.cooldown -= dt;
    const trigger = weaponStats(pl).auto ? mouse.down : (mouse.down && !mouse.prev);
    tryShoot(pl, trigger);
    if (pl.hitFlash > 0) pl.hitFlash -= dt;
  }

  function killPlayer(byName) {
    const pl = player;
    pl.alive = false;
    pl.respawnTimer = 3;
    pl.deaths++;
    killFeed.unshift({ text: `You were killed by ${byName}`, color: '#ef476f', t: 4 });
    burst(pl.x, pl.y, '#4cc9f0', 40, 320, 0.6);
    sfx.hurt();
  }

  function killBot(b) {
    b.alive = false;
    killsThisLevel++;
    player.kills++;
    const isBoss = b.type === 'boss';
    killFeed.unshift({
      text: isBoss ? 'You destroyed the BOSS!' : `You killed ${b.type} bot`,
      color: isBoss ? '#ffd166' : '#57cc99', t: 4
    });
    burst(b.x, b.y, BOT_TYPES[b.type].color, isBoss ? 80 : 40, isBoss ? 420 : 340, 0.7);
    sfx.kill();
    if (!isBoss && Math.random() < pickupChance()) spawnRandomPickup();
  }

  // ---------- Damage ----------
  function damage(t, amount) {
    if (t === player && t.shield > 0) {
      const absorbed = Math.min(t.shield, amount);
      t.shield -= absorbed;
      amount -= absorbed;
    }
    t.hp -= amount;
    t.hitFlash = 0.12;
  }

  function hurt(t, amount, source, insta) {
    if (!t.alive) return;
    if (insta && t !== player && t.type !== 'boss') amount = t.hp;
    damage(t, amount);
    burst(t.x, t.y, '#ffffff', 8, 200, 0.2);
    if (t === player) {
      sfx.hurt();
      if (t.hp <= 0) { t.hp = 0; killPlayer(source.type + ' bot'); }
    } else {
      sfx.hit();
      if (t.hp <= 0) killBot(t);
    }
  }

  function explode(x, y, b, skip) {
    burst(x, y, '#fb8500', 40, 340, 0.5);
    burst(x, y, '#ffffff', 15, 200, 0.25);
    shockwave(x, y, '#fb8500', b.aoe * 1.4);
    shake = Math.min(12, shake + 7);
    sfx.boom();
    const targets = b.owner === player ? bots : [player];
    for (const t of targets) {
      if (!t.alive || t === skip) continue;
      const d = Math.hypot(t.x - x, t.y - y);
      if (d < b.aoe + t.r) {
        const falloff = 1 - d / (b.aoe + t.r);
        hurt(t, Math.max(1, b.dmg * falloff), b.owner, b.instaKill);
      }
    }
  }

  // ---------- Bullets ----------
  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.life -= dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 8));
      const stepDt = dt / steps;
      let dead = false, hitWall = false;
      for (let s = 0; s < steps && !dead; s++) {
        b.x += b.vx * stepDt;
        b.y += b.vy * stepDt;
        for (const w of WALLS) {
          if (b.x > w.x - b.r && b.x < w.x + w.w + b.r && b.y > w.y - b.r && b.y < w.y + w.h + b.r) {
            burst(b.x, b.y, b.color, 6, 140, 0.15);
            hitWall = true; dead = true;
            break;
          }
        }
        if (b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) { hitWall = true; dead = true; }
      }
      let hitTarget = null;
      if (!dead) {
        const targets = b.owner === player ? bots : [player];
        for (const t of targets) {
          if (!t.alive) continue;
          if (dist2(b.x, b.y, t.x, t.y) < (t.r + b.r) * (t.r + b.r)) {
            hitTarget = t;
            hurt(t, b.dmg, b.owner, b.instaKill);
            dead = true;
            break;
          }
        }
      }
      if (dead || b.life <= 0) {
        if (b.explosive && !b.exploded) {
          b.exploded = true;
          explode(b.x, b.y, b, hitTarget);
        }
        bullets.splice(i, 1);
      }
    }
  }

  // ---------- Pickups ----------
  function updatePickups(dt) {
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      p.bob += dt;
      if (p.dead) {
        p.respawnT -= dt;
        if (p.respawnT <= 0) {
          const spot = openSpot(60);
          p.x = spot.x; p.y = spot.y; p.dead = false;
        }
        continue;
      }
      if (player.alive && dist2(p.x, p.y, player.x, player.y) < (player.r + 22) * (player.r + 22)) {
        applyPickup(p);
        p.dead = true;
        p.respawnT = 15;
        sfx.pickup();
      }
    }
  }

  function applyPickup(p) {
    const pl = player;
    switch (p.type) {
      case 'health': pl.hp = Math.min(pl.maxHp, pl.hp + 35); burst(p.x, p.y, '#57cc99', 14, 180, 0.3); break;
      case 'shield': pl.shield = Math.min(pl.maxShield, pl.shield + 40); burst(p.x, p.y, '#48cae4', 14, 180, 0.3); break;
      case 'ammo': pl.ammo = Math.min(magOf(pl.weapon), pl.ammo + 8); burst(p.x, p.y, '#ffd166', 12, 180, 0.3); break;
      case 'medkit': pl.hp = pl.maxHp; pl.shield = pl.maxShield; burst(p.x, p.y, '#4ade80', 24, 240, 0.45); break;
    }
  }

  // ---------- Particles ----------
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.9; p.vy *= 0.9;
      if (p.ring) p.r = 12 + (p.grow - 12) * (1 - p.life / p.max);
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  // ---------- Kill feed ----------
  function updateFeed(dt) {
    for (let i = killFeed.length - 1; i >= 0; i--) {
      killFeed[i].t -= dt;
      if (killFeed[i].t <= 0) killFeed.splice(i, 1);
    }
  }

  // ---------- Camera ----------
  function updateCamera() {
    const targetX = player.x - W / 2;
    const targetY = player.y - H / 2;
    cam.x += (targetX - cam.x) * 0.12;
    cam.y += (targetY - cam.y) * 0.12;
    cam.x = clamp(cam.x, 0, WORLD_W - W);
    cam.y = clamp(cam.y, 0, WORLD_H - H);
  }

  // ---------- Level flow ----------
  function computeEnemyCount() {
    if (level === 1) return 2;
    if (prevWasBoss) return Math.floor(rand(10, 51));
    return Math.min(100, lastEnemyCount + 1);
  }

  function manageSpawns() {
    if (levelState !== 'playing') return;
    let active = 0;
    for (const b of bots) if (b.alive) active++;
    while (active < MAX_ACTIVE && spawned < enemyCount) {
      spawnEnemy();
      spawned++;
      active++;
    }
  }

  function checkLevelComplete() {
    if (killsThisLevel < enemyCount || levelState !== 'playing') return;
    if (isBossLevel(level)) { bossCount++; prevWasBoss = true; }
    levelState = 'upgrade';
    sfx.kill();
    showUpgradeModal();
  }

  function startLevel(n) {
    level = n;
    killsThisLevel = 0;
    spawned = 0;
    bots = [];
    bullets = [];
    // Restore player for the new level
    const pl = player;
    pl.alive = true; pl.respawnTimer = 0;
    pl.hp = pl.maxHp; pl.shield = 0;
    pl.reloading = 0; pl.cooldown = 0;
    pl.ammo = magOf(pl.weapon);

    if (isBossLevel(n)) {
      enemyCount = 1;
      spawnBoss();
      spawned = 1;
      banner = { title: `LEVEL ${n}`, sub: '⚠ BOSS INCOMING ⚠', t: 2.2 };
    } else {
      enemyCount = computeEnemyCount();
      banner = { title: `LEVEL ${n}`, sub: `Enemies: ${enemyCount}`, t: 2.2 };
      while (spawned < Math.min(enemyCount, MAX_ACTIVE)) {
        spawnEnemy();
        spawned++;
      }
    }
    lastEnemyCount = enemyCount;
    levelState = 'playing';
  }

  // ---------- Upgrades ----------
  const UPGRADE_DEFS = {
    speed:      { name: 'Speed',            desc: '+12 movement speed',              apply: () => { player.speed = playerSpeed(); } },
    health:     { name: 'Max Health',       desc: '+25 max HP and heal',             apply: () => { player.maxHp = maxHealth(); player.hp = Math.min(player.maxHp, player.hp + 25); } },
    firepower:  { name: 'Firepower',        desc: '+10% weapon damage',              apply: () => {} },
    fireRate:   { name: 'Fire Rate',        desc: '+8% attack speed',                apply: () => {} },
    magSize:    { name: 'Magazine Size',    desc: '+15% ammo per magazine',          apply: () => { player.ammo = magOf(player.weapon); } },
    pickupRate: { name: 'Power Up Spawns',  desc: '+15% chance for pickups',         apply: () => {} }
  };

  function pickRandom(arr, n) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  // ---------- Modals ----------
  const upgradeEl = document.getElementById('upgrade');
  const weaponEl = document.getElementById('weapon');
  const upgradeOptions = document.getElementById('upgradeOptions');
  const weaponOptions = document.getElementById('weaponOptions');

  function showUpgradeModal() {
    document.getElementById('upLevel').textContent = level;
    upgradeOptions.innerHTML = '';
    for (const key of pickRandom(Object.keys(UPGRADE_DEFS), 3)) {
      const def = UPGRADE_DEFS[key];
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.innerHTML = `<span class="opt-title">${def.name}</span><span class="opt-desc">${def.desc}</span><span class="opt-lvl">Level ${upgrades[key]}</span>`;
      btn.addEventListener('click', () => {
        upgrades[key]++;
        def.apply();
        sfx.kill();
        upgradeEl.classList.add('hidden');
        showWeaponModal();
      });
      upgradeOptions.appendChild(btn);
    }
    upgradeEl.classList.remove('hidden');
  }

  function showWeaponModal() {
    weaponOptions.innerHTML = '';
    const cap = weaponCap();
    const cur = player.weapon;
    const curLvl = weaponLevels[cur] || 0;
    const maxed = curLvl >= cap;

    const curBtn = document.createElement('button');
    curBtn.className = 'option' + (maxed ? ' maxed' : '');
    curBtn.innerHTML =
      `<span class="opt-title">UPGRADE ${WEAPONS[cur].name.toUpperCase()}</span>` +
      `<span class="opt-desc">${maxed ? 'Max level reached' : `Level ${curLvl} → ${curLvl + 1}`}</span>` +
      `<span class="opt-lvl">Cap ${cap} · All weapons +1 cap per 10 levels</span>`;
    if (!maxed) {
      curBtn.addEventListener('click', () => {
        weaponLevels[cur] = curLvl + 1;
        player.ammo = magOf(cur);
        finishWeaponChoice();
      });
    }
    weaponOptions.appendChild(curBtn);

    for (const id of WEAPON_ORDER) {
      if (id === cur || id === 'pistol') continue;
      if (id === 'bazooka' && level < 100) continue;
      const lvl = weaponLevels[id] || 0;
      const owned = ownedWeapons.includes(id);
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.innerHTML =
        `<span class="opt-title">${WEAPONS[id].name.toUpperCase()}</span>` +
        `<span class="opt-desc">${owned ? 'Switch to weapon' : 'Acquire new weapon'}</span>` +
        `<span class="opt-lvl">Level ${lvl}${id === 'bazooka' ? ' · Instakill' : ''}</span>`;
      btn.addEventListener('click', () => {
        if (!owned) ownedWeapons.push(id);
        player.weapon = id;
        player.ammo = magOf(id);
        player.reloading = 0; player.cooldown = 0;
        finishWeaponChoice();
      });
      weaponOptions.appendChild(btn);
    }
    weaponEl.classList.remove('hidden');
  }

  function finishWeaponChoice() {
    weaponEl.classList.add('hidden');
    startLevel(level + 1);
  }

  // ---------- Update ----------
  let last = performance.now();
  function update(now) {
    if (paused) {
      mouse.prev = mouse.down;
      last = now;
      requestAnimationFrame(update);
      return;
    }
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    if (levelState === 'playing') {
      updatePlayer(dt);
      for (const b of bots) updateBot(b, dt);
      updateBullets(dt);
      updatePickups(dt);
      manageSpawns();
      checkLevelComplete();
    }
    updateParticles(dt);
    updateFeed(dt);
    if (banner) {
      banner.t -= dt;
      if (banner.t <= 0) banner = null;
    }
    updateCamera();
    shake *= 0.88;

    mouse.prev = mouse.down;
    requestAnimationFrame(update);
  }

  // ---------- Render ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.fillStyle = '#141827';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= WORLD_W; x += 100) { ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); }
    for (let y = 0; y <= WORLD_H; y += 100) { ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); }
    ctx.stroke();

    // Border glow
    ctx.strokeStyle = '#4cc9f0';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, WORLD_W - 6, WORLD_H - 6);
    ctx.strokeStyle = 'rgba(76,201,240,0.25)';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, WORLD_W - 16, WORLD_H - 16);

    // Walls
    for (const w of WALLS) {
      ctx.fillStyle = '#262b3d';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.strokeStyle = '#3d4458';
      ctx.lineWidth = 3;
      ctx.strokeRect(w.x + 1.5, w.y + 1.5, w.w - 3, w.h - 3);
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(w.x + 4, w.y + 4, w.w - 8, w.h * 0.3);
    }

    // Pickups
    for (const p of pickups) {
      if (p.dead) continue;
      const bob = Math.sin(p.bob * 3) * 3;
      const def = PICKUP_TYPES[p.type];
      ctx.save();
      ctx.translate(p.x, p.y + bob);
      const pulse = 1 + Math.sin(p.bob * 4) * 0.05;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(2, 3, 12, 0, 7); ctx.fill();
      ctx.fillStyle = def.color;
      if (p.type === 'health') {
        roundRect(-9, -9, 18, 18, 4); ctx.fill();
        ctx.fillStyle = '#141827';
        ctx.fillRect(-2, -6, 4, 12); ctx.fillRect(-6, -2, 12, 4);
      } else if (p.type === 'shield') {
        roundRect(-9, -9, 18, 18, 4); ctx.fill();
        ctx.fillStyle = '#141827';
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('S', 0, 1);
      } else if (p.type === 'ammo') {
        roundRect(-9, -9, 18, 18, 4); ctx.fill();
        ctx.fillStyle = '#141827';
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('A', 0, 1);
      } else if (p.type === 'medkit') {
        roundRect(-11, -11, 22, 22, 5); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -7, 4, 14); ctx.fillRect(-7, -2, 14, 4);
      }
      ctx.restore();
    }

    // Bullets
    for (const b of bullets) {
      if (b.explosive) {
        ctx.fillStyle = b.color;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 2, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, 7); ctx.fill();
      } else {
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, 7); ctx.fill();
      }
    }

    // Bots
    for (const b of bots) {
      if (!b.alive) continue;
      const def = BOT_TYPES[b.type];
      const isBoss = b.type === 'boss';
      ctx.save();
      ctx.translate(b.x, b.y);
      if (isBoss) {
        ctx.fillStyle = 'rgba(255,90,40,0.12)';
        ctx.beginPath(); ctx.arc(0, 0, b.r + 8, 0, 7); ctx.fill();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(2, 3, b.r, 0, 7); ctx.fill();
      ctx.fillStyle = def.color;
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      if (b.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 7); ctx.fill();
      }
      ctx.rotate(b.angle);
      ctx.fillStyle = '#1d2029';
      ctx.fillRect(b.r - 4, -3, 12, 6);
      ctx.restore();
      if (isBoss) {
        // boss spikes
        ctx.fillStyle = def.color;
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4;
          const px = b.x + Math.cos(a) * (b.r + 5), py = b.y + Math.sin(a) * (b.r + 5);
          ctx.beginPath();
          ctx.moveTo(b.x + Math.cos(a - 0.25) * (b.r - 4), b.y + Math.sin(a - 0.25) * (b.r - 4));
          ctx.lineTo(px, py);
          ctx.lineTo(b.x + Math.cos(a + 0.25) * (b.r - 4), b.y + Math.sin(a + 0.25) * (b.r - 4));
          ctx.closePath(); ctx.fill();
        }
      }
      // Health bar
      if (b.hp < b.maxHp || isBoss) {
        const bw = isBoss ? b.r * 2.6 : b.r * 2.2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(b.x - bw / 2, b.y - b.r - 10, bw, 5);
        ctx.fillStyle = isBoss ? '#d62828' : '#ef476f';
        ctx.fillRect(b.x - bw / 2, b.y - b.r - 10, bw * clamp(b.hp / b.maxHp, 0, 1), 5);
      }
    }

    // Player
    if (player.alive) {
      const pl = player;
      ctx.save();
      ctx.translate(pl.x, pl.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(3, 4, pl.r, 0, 7); ctx.fill();
      if (pl.hitFlash > 0) ctx.fillStyle = '#ff6b6b';
      else ctx.fillStyle = '#4cc9f0';
      ctx.beginPath(); ctx.arc(0, 0, pl.r, 0, 7); ctx.fill();
      ctx.strokeStyle = '#0b1017'; ctx.lineWidth = 3; ctx.stroke();
      if (pl.shield > 0) {
        ctx.strokeStyle = 'rgba(72,202,228,0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, pl.r + 6, 0, 7); ctx.stroke();
      }
      ctx.rotate(pl.angle);
      ctx.fillStyle = '#1d2029';
      ctx.fillRect(pl.r - 4, -3.5, 13, 7);
      ctx.restore();
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      if (p.ring) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // ----- Screen-space HUD -----
    if (shake > 0.3) {
      ctx.save();
      ctx.translate(rand(-shake, shake), rand(-shake, shake));
    }

    drawCrosshair();
    drawHUD();
    drawBossBar();
    drawMinimap();
    drawFeed();
    drawBanner();

    if (shake > 0.3) ctx.restore();
  }

  function drawCrosshair() {
    const x = mouse.x, y = mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, 1.5, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,60,60,0.8)';
    ctx.lineWidth = 2;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(x + dx * 10, y + dy * 10);
      ctx.lineTo(x + dx * 15, y + dy * 15);
      ctx.stroke();
    }
  }

  function drawBar(x, y, w, h, frac, color, bg) {
    ctx.fillStyle = bg;
    roundRect(x, y, w, h, 3); ctx.fill();
    ctx.fillStyle = color;
    if (frac > 0) { roundRect(x, y, w * clamp(frac, 0, 1), h, 3); ctx.fill(); }
  }

  function drawHUD() {
    const pl = player;
    const stats = weaponStats(pl);
    const lvl = weaponLevels[pl.weapon] || 0;
    const bw = 240;
    const bx = 20, by = H - 58;

    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';

    // Health
    ctx.fillStyle = '#9aa5bd';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('HP', bx, by - 12);
    drawBar(bx + 30, by - 18, bw, 10, pl.hp / pl.maxHp, '#57cc99', 'rgba(0,0,0,0.5)');
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText(`${Math.ceil(pl.hp)}`, bx + bw + 38, by - 13);

    // Shield
    ctx.fillStyle = '#9aa5bd';
    ctx.fillText('SH', bx, by + 4);
    drawBar(bx + 30, by + 0, bw, 8, pl.shield / pl.maxShield, '#48cae4', 'rgba(0,0,0,0.5)');

    // Weapon + ammo
    ctx.fillStyle = stats.color;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`${stats.name.toUpperCase()}${lvl > 0 ? `  LV${lvl}` : ''}`, bx, by + 26);
    ctx.fillStyle = '#e8ecf5';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${pl.ammo} / ${stats.mag}`, bx + bw + 30, by + 26);

    if (pl.reloading > 0) {
      drawBar(bx, by + 36, bw + 30, 6, 1 - pl.reloading / stats.reload, '#ffd166', 'rgba(0,0,0,0.5)');
      ctx.fillStyle = '#ffd166';
      ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('RELOADING...', bx + (bw + 30) / 2, by + 50);
    } else if (pl.ammo === 0) {
      ctx.fillStyle = '#ff6b6b';
      ctx.font = '12px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('PRESS R TO RELOAD', bx + (bw + 30) / 2, by + 50);
    }

    // Level / enemies (top center)
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillStyle = isBossLevel(level) ? '#d62828' : '#e8ecf5';
    ctx.fillText(isBossLevel(level) ? `LEVEL ${level} — BOSS` : `LEVEL ${level}`, W / 2, 42);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#9aa5bd';
    if (isBossLevel(level)) ctx.fillText('Destroy the super boss!', W / 2, 64);
    else ctx.fillText(`ENEMIES ${Math.min(killsThisLevel, enemyCount)} / ${enemyCount}`, W / 2, 64);

    // Score (top right under minimap)
    ctx.textAlign = 'right';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = '#4cc9f0';
    ctx.fillText(`${player.kills}`, W - 20, 142);
    ctx.fillStyle = '#ff6b6b';
    ctx.fillText(`${player.deaths}`, W - 20, 170);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#7b86a0';
    ctx.fillText('KILLS / DEATHS', W - 20, 190);
  }

  function drawBossBar() {
    const boss = bots.find(b => b.type === 'boss' && b.alive);
    if (!boss) return;
    const bw = Math.min(560, W * 0.5);
    const x = W / 2 - bw / 2, y = 84;
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#d62828';
    ctx.fillText('SUPER BOSS', W / 2, y - 8);
    drawBar(x, y, bw, 14, boss.hp / boss.maxHp, '#d62828', 'rgba(0,0,0,0.6)');
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, bw, 14);
  }

  function drawMinimap() {
    const mw = 168, mh = 112;
    const x = W - mw - 16, y = 16;
    ctx.fillStyle = 'rgba(10,12,20,0.75)';
    roundRect(x, y, mw, mh, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const sx = mw / WORLD_W, sy = mh / WORLD_H;
    ctx.fillStyle = '#3d4458';
    for (const w of WALLS) {
      ctx.fillRect(x + w.x * sx, y + w.y * sy, Math.max(2, w.w * sx), Math.max(2, w.h * sy));
    }
    for (const b of bots) {
      if (!b.alive) continue;
      ctx.fillStyle = BOT_TYPES[b.type].color;
      ctx.beginPath(); ctx.arc(x + b.x * sx, y + b.y * sy, b.type === 'boss' ? 3.5 : 2.2, 0, 7); ctx.fill();
    }
    if (player.alive) {
      ctx.fillStyle = '#4cc9f0';
      ctx.beginPath(); ctx.arc(x + player.x * sx, y + player.y * sy, 3, 0, 7); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + cam.x * sx, y + cam.y * sy, W * sx, H * sy);
  }

  function drawFeed() {
    let y = 210;
    ctx.textAlign = 'left';
    for (const f of killFeed) {
      ctx.globalAlpha = clamp(f.t / 1, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(16, y - 11, ctx.measureText(f.text).width + 20, 24, 4); ctx.fill();
      ctx.fillStyle = f.color;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(f.text, 26, y);
      y += 30;
    }
    ctx.globalAlpha = 1;
  }

  function drawBanner() {
    if (!banner) return;
    ctx.globalAlpha = clamp(banner.t, 0, 1);
    ctx.textAlign = 'center';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillStyle = isBossLevel(level) ? '#d62828' : '#ffd166';
    ctx.fillText(banner.title, W / 2, H * 0.32);
    ctx.font = 'bold 20px sans-serif';
    ctx.fillStyle = '#e8ecf5';
    ctx.fillText(banner.sub, W / 2, H * 0.32 + 40);
    ctx.globalAlpha = 1;
  }

  // ---------- Menu / pause ----------
  const menuEl = document.getElementById('menu');
  const pauseEl = document.getElementById('pause');

  function togglePause() {
    if (!running || levelState !== 'playing') return;
    paused = !paused;
    pauseEl.classList.toggle('hidden', !paused);
  }

  document.getElementById('start').addEventListener('click', () => {
    audio.init();
    menuEl.classList.add('hidden');
    initGame();
    running = true;
    last = performance.now();
    requestAnimationFrame(update);
  });

  document.getElementById('resume').addEventListener('click', () => {
    paused = false;
    pauseEl.classList.add('hidden');
    last = performance.now();
  });

  // ---------- Init ----------
  function initGame() {
    player = makePlayer();
    bots = [];
    bullets = [];
    pickups = [];
    particles = [];
    killFeed = [];

    level = 0;
    bossCount = 0;
    prevWasBoss = false;
    lastEnemyCount = 1;
    ownedWeapons = ['pistol'];
    for (const id of WEAPON_ORDER) weaponLevels[id] = 0;
    for (const k of Object.keys(upgrades)) upgrades[k] = 0;

    const initial = ['health', 'shield', 'ammo', 'health', 'ammo', 'medkit'];
    for (const t of initial) {
      const spot = openSpot(60);
      addPickup(t, spot.x, spot.y);
    }

    cam.x = player.x - W / 2;
    cam.y = player.y - H / 2;
    cam.x = clamp(cam.x, 0, WORLD_W - W);
    cam.y = clamp(cam.y, 0, WORLD_H - H);

    startLevel(1);
  }

  function render() {
    if (running) draw();
    requestAnimationFrame(render);
  }

  render();
})();
