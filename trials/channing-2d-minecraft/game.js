/* =========================================================
   BLOCK SURVIVAL - 2D Minecraft Survival Game
   Explore a Minecraft world, survive monster waves,
   defeat the Ender Dragon to win.
   Controls:
     WASD/Arrows   - move
     Left-click    - dig / break blocks (hold)
     Right-click   - place selected block
     Ctrl          - attack with sword
     E             - eat food
     1-9           - select block/tool
     P             - pause
   ========================================================= */

(function () {
  'use strict';

  // ---------- DOM ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startScreen = document.getElementById('startScreen');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const livesCountEl = document.getElementById('livesCount');
  const weaponNameEl = document.getElementById('weaponName');
  const killsCountEl = document.getElementById('killsCount');
  const phaseNameEl = document.getElementById('phaseName');
  const blockBar = document.getElementById('blockBar');
  const xpFill = document.getElementById('xpFill');
  const xpText = document.getElementById('xpText');
  const hungerFill = document.getElementById('hungerFill');
  const hungerText = document.getElementById('hungerText');

  // ---------- World constants ----------
  const W = 960;
  const H = 540;
  const TILE = 32;
  const COLS = 30;
  const ROWS = 19;
  const WORLD_W = COLS * TILE;
  const WORLD_H = ROWS * TILE;
  const SURFACE_ROW = 10;         // top of the ground
  const GROUND_DEPTH = 8;         // rows of terrain below surface

  // ---------- Block types ----------
  const BLOCKS = {
    grass:      { name: 'Grass Block',     color: '#5fae3f', top: '#7ed957', side: '#8a6a44', hardness: 0.5, drops: 'dirt' },
    dirt:       { name: 'Dirt',            color: '#7d5836', top: '#8a6a44', side: '#6b4c2c', hardness: 0.5, drops: 'dirt' },
    stone:      { name: 'Stone',           color: '#7a7d82', top: '#9aa0a6', side: '#6b6e72', hardness: 1.5, drops: 'cobble' },
    cobble:     { name: 'Cobblestone',     color: '#6f7478', top: '#7f8488', side: '#5f6468', hardness: 1.5, drops: 'cobble' },
    wood:       { name: 'Oak Wood',        color: '#92682f', top: '#b5883f', side: '#7c5626', hardness: 1.0, drops: 'wood' },
    leaves:     { name: 'Leaves',          color: '#3d8f3d', top: '#4daf4d', side: '#2f7a2f', hardness: 0.2, drops: null },
    planks:     { name: 'Oak Planks',      color: '#b5883f', top: '#c99a50', side: '#a07836', hardness: 1.0, drops: 'planks' },
    coal_ore:   { name: 'Coal Ore',        color: '#4a4d52', top: '#6b6e72', side: '#3a3d42', hardness: 2.0, drops: 'coal', xp: 2 },
    iron_ore:   { name: 'Iron Ore',        color: '#c4a06a', top: '#d2b889', side: '#a97f52', hardness: 2.5, drops: 'iron', xp: 3 },
    gold_ore:   { name: 'Gold Ore',        color: '#eecb4a', top: '#f7dc6f', side: '#d9a92f', hardness: 2.5, drops: 'gold', xp: 4 },
    diamond_ore:{ name: 'Diamond Ore',     color: '#4fd1e0', top: '#7de6f2', side: '#28a9bd', hardness: 3.0, drops: 'diamond', xp: 6 },
    sand:       { name: 'Sand',            color: '#e7d39a', top: '#f0e0af', side: '#d4bf84', hardness: 0.5, drops: 'sand' },
    brick:      { name: 'Brick',           color: '#b3593f', top: '#c96b4c', side: '#9a4a34', hardness: 1.5, drops: 'brick' },
    glass:      { name: 'Glass',           color: 'rgba(200,235,255,0.45)', top: 'rgba(220,245,255,0.55)', side: 'rgba(180,220,240,0.4)', hardness: 0.3, drops: null },
    tnt:        { name: 'TNT',             color: '#c0392b', top: '#d84a39', side: '#a32c1e', hardness: 0.1, drops: 'tnt', tnt: true },
    barrier:    { name: '',                color: '#000', top: '#000', side: '#000', hardness: 0, drops: null, invisible: true },
  };
  const BLOCK_KEYS = Object.keys(BLOCKS).filter(k => k !== 'barrier');
  const TOOLS = [
    { key: 'dig',   name: 'Pickaxe',   type: 'tool' },
    { key: 'wood',  name: 'Wood',      type: 'block' },
    { key: 'planks',name: 'Planks',    type: 'block' },
    { key: 'cobble',name: 'Cobble',    type: 'block' },
    { key: 'dirt',  name: 'Dirt',      type: 'block' },
    { key: 'sand',  name: 'Sand',      type: 'block' },
    { key: 'brick', name: 'Brick',     type: 'block' },
    { key: 'glass', name: 'Glass',     type: 'block' },
    { key: 'tnt',   name: 'TNT',       type: 'block' },
  ];
  let selectedSlot = 0;

  // Materials collected (for placing): key -> count
  let materials = {};
  BLOCK_KEYS.forEach(k => { materials[k] = 20; });

  // ---------- Game state ----------
  let state = 'menu';
  let lives = 5;            // health hearts (max 5)
  let kills = 0;
  let wave = 0;
  let waveTimer = 0;
  let betweenWaves = true;
  let spawnTimer = 0;
  let spawnQueue = [];
  let dragonDefeated = false;

  // XP / level
  const Xp = {
    level: 1,
    xp: 0,
    next: 20,
  };

  // Hunger
  const Hunger = {
    max: 10,
    value: 10,
    eating: false,
    eatTimer: 0,
  };

  // foods: kind -> hunger restored
  const FOOD = {
    apple:      3,
    rotten_flesh:2,
    bread:      4,
    potato:     2,
    steak:      6,
  };

  // inventory of food (dropped by mobs)
  let foodInventory = {};

  // Player
  const player = {
    x: W / 2 - TILE / 2,
    y: (SURFACE_ROW - 2) * TILE,
    w: 24,
    h: 42,
    vx: 0,
    vy: 0,
    speed: 170,
    facing: 1,
    onGround: true,
    attackTimer: 0,
    attackCd: 350,
    attackRange: 58,
    attackDmg: 1,
    iframes: 0,
    regenTimer: 0,
    hungerTimer: 0,
  };

  let monsters = [];
  let projectiles = [];
  let particles = [];
  let floaters = [];
  let mouseWorld = { x: 0, y: 0, inside: false };
  let keys = {};
  let mouse = { leftDown: false };
  let cam = { x: 0, y: 0, shake: 0 };

  // global gravity
  const GRAVITY = 1400;

  // ---------- World storage ----------
  // terrain generated once; edited via setBlock
  const blockSet = new Set();
  let blockColorMap = {};   // "c,r" -> block key (edits/placed)
  let worldBlocks = new Map(); // "c,r" -> block key (all blocks including generated terrain)

  function blockKeyAt(c, r) {
    const k = placeKey(c, r);
    if (blockColorMap[k]) return blockColorMap[k];
    if (worldBlocks.has(k)) return worldBlocks.get(k);
    return null;
  }
  function setBlock(c, r, bkey) {
    if (bkey === null || bkey === 'air' || bkey === undefined) {
      blockColorMap[placeKey(c, r)] = undefined;
      worldBlocks.delete(placeKey(c, r));
      blockSet.delete(placeKey(c, r));
      return;
    }
    worldBlocks.set(placeKey(c, r), bkey);
    blockColorMap[placeKey(c, r)] = bkey;
    blockSet.add(placeKey(c, r));
  }
  function isSolidAt(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return false; // outside world = empty (player can't leave via borders below)
    return blockSet.has(placeKey(c, r));
  }

  function placeKey(c, r) { return c + ',' + r; }
  function tileCol(x) { return Math.floor(x / TILE); }
  function tileRow(y) { return Math.floor(y / TILE); }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function flash(message, color) {
    floaters.push({ text: message, color: color || '#fff', t: 0, dur: 1200, x: player.x + player.w / 2, y: player.y - 14 });
  }

  // ---------- World generation ----------
  function generateWorld() {
    let seed = 12345;
    function rand() {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    }

    // 1) Terrain: ground from SURFACE_ROW down
    for (let c = 0; c < COLS; c++) {
      // gentle height variation on surface
      let surf = SURFACE_ROW + Math.floor(rand() * 2);
      for (let r = surf; r < ROWS; r++) {
        let bkey;
        if (r === surf) bkey = 'grass';
        else if (r === surf + 1) bkey = 'dirt';
        else if (r === surf + 2) bkey = 'dirt';
        else bkey = 'stone';
        // ore pockets in stone
        if (r > surf + 2) {
          const roll = rand();
          if (roll < 0.12) bkey = 'coal_ore';
          else if (roll < 0.16) bkey = 'iron_ore';
          else if (roll < 0.19) bkey = 'gold_ore';
          else if (roll < 0.205) bkey = 'diamond_ore';
        }
        setBlock(c, r, bkey);
      }
    }

    // 2) Trees on the surface
    const treeCols = [];
    for (let c = 3; c < COLS - 3; c++) {
      if (rand() < 0.18) treeCols.push(c);
    }
    treeCols.forEach(c => {
      if (c < 2 || c >= COLS - 2) return;
      const top = surfaceY(c);
      const trunkTop = top - 3;
      for (let r = trunkTop; r <= top - 1; r++) setBlock(c, r, 'wood');
      // leaves canopy
      for (let dc = -2; dc <= 2; dc++) {
        for (let dr = -2; dr <= 1; dr++) {
          const nc = c + dc, nr = trunkTop - 1 + dr;
          if (nc < 0 || nc >= COLS || nr < 0) continue;
          if (Math.abs(dc) === 2 && Math.abs(dr) === 2) continue;
          if (!blockSet.has(placeKey(nc, nr))) setBlock(nc, nr, 'leaves');
        }
      }
      // clear leaves at trunk top center
      if (!blockSet.has(placeKey(c, trunkTop - 1))) setBlock(c, trunkTop - 1, 'leaves');
    });

    // 3) Village: a few houses on the left-middle
    buildVillage();
  }

  function surfaceY(c) {
    for (let r = 0; r < ROWS; r++) {
      if (blockSet.has(placeKey(c, r))) return r;
    }
    return SURFACE_ROW;
  }

  function buildVillage() {
    // house at columns 4..9
    makeHouse(4, surfaceY(4) - 3, 5, 4);
    // house at columns 14..19
    makeHouse(14, surfaceY(14) - 4, 5, 5, true);
  }

  function makeHouse(c, topRow, w, h, doorR = false) {
    for (let r = topRow; r < topRow + h; r++) {
      for (let x = c; x < c + w; x++) {
        if (x < 0 || x >= COLS) continue;
        // leave door gap at bottom center
        const inDoor = (r === topRow + h - 1) && (x === c + Math.floor(w / 2));
        if (inDoor) continue;
        if (r === topRow) setBlock(x, r, 'planks'); // roof
        else if (r === topRow + h - 2) setBlock(x, r, 'planks'); // upper wall
        else if (r === topRow + h - 1) setBlock(x, r, 'cobble'); // lower wall
        else setBlock(x, r, 'planks');
      }
    }
    // a window block
    const winX = c + 1, winY = topRow + h - 2;
    if (doorR) setBlock(winX, winY, 'glass'); else setBlock(winX, winY, 'glass');
    // roof peak
    if (c - 1 >= 0) setBlock(c - 1, topRow, 'planks');
    if (c + w < COLS) setBlock(c + w, topRow, 'planks');
  }

  // ---------- Reset ----------
  function resetGame() {
    lives = 5;
    kills = 0;
    wave = 0;
    dragonDefeated = false;
    betweenWaves = true;
    waveTimer = 0;
    spawnQueue = [];
    monsters = [];
    projectiles = [];
    particles = [];
    floaters = [];
    blockSet.clear();
    worldBlocks.clear();
    blockColorMap = {};
    Xp.level = 1; Xp.xp = 0; Xp.next = 20;
    Hunger.value = 10;
    foodInventory = {};
    materials = {};
    BLOCK_KEYS.forEach(k => { materials[k] = 20; });
    selectedSlot = 0;
    generateWorld();
    player.x = W / 2 - TILE / 2;
    player.y = (surfaceY(Math.floor(W / 2 / TILE)) - 2) * TILE;
    player.vx = 0; player.vy = 0;
    player.attackTimer = 0; player.iframes = 0;
    player.onGround = true;
    cam.x = 0; cam.y = 0; cam.shake = 0;
    updateHUD();
    updateXpBar();
    updateHungerBar();
    updateBlockBar();
  }

  // ---------- XP ----------
  function addXp(amount) {
    Xp.xp += amount;
    while (Xp.xp >= Xp.next) {
      Xp.xp -= Xp.next;
      Xp.level++;
      Xp.next = Math.round(Xp.next * 1.6 + 10);
      player.attackDmg += 1;
      flash('LEVEL UP! Sword +' + player.attackDmg, '#55efc4');
    }
    updateXpBar();
    weaponNameEl.textContent = 'Sword (DMG ' + player.attackDmg + ')';
  }
  function updateXpBar() {
    xpFill.style.width = Math.min(100, (Xp.xp / Xp.next) * 100) + '%';
    xpText.textContent = 'Level ' + Xp.level;
  }

  // ---------- Hunger ----------
  function updateHungerBar() {
    const pct = (Hunger.value / Hunger.max) * 100;
    hungerFill.style.width = pct + '%';
    hungerText.textContent = Math.round(Hunger.value) + ' / 10 food';
    const track = hungerFill.parentElement;
    track.classList.toggle('low', Hunger.value <= 2);
  }
  function addFood(kind) {
    if (FOOD[kind] === undefined) return;
    foodInventory[kind] = (foodInventory[kind] || 0) + 1;
    flash('Got ' + kind.replace('_', ' '), '#ffd93d');
  }
  function eatFood() {
    const entry = Object.keys(foodInventory).find(k => foodInventory[k] > 0);
    if (!entry) { flash('No food! Kill mobs for drops', '#ff8a80'); return; }
    foodInventory[entry]--;
    Hunger.value = Math.min(Hunger.max, Hunger.value + FOOD[entry]);
    flash('Ate ' + entry.replace('_', ' '), '#55efc4');
    updateHungerBar();
  }

  // ---------- Player physics ----------
  function updatePlayer(dt) {
    if (player.iframes > 0) player.iframes -= dt;
    if (player.attackTimer > 0) player.attackTimer -= dt;

    // hunger timers
    player.hungerTimer -= dt;
    if (player.hungerTimer <= 0) {
      player.hungerTimer = 10;
      Hunger.value = Math.max(0, Hunger.value - 1);
      updateHungerBar();
      if (Hunger.value <= 0) {
        // starving: lose a heart slowly
        player.iframes = Math.max(player.iframes, 0);
        damagePlayer(1, null, true);
      }
    }

    // hunger regen
    if (Hunger.value >= 7 && lives < 5) {
      player.regenTimer -= dt;
      if (player.regenTimer <= 0) {
        player.regenTimer = 2.5;
        lives = Math.min(5, lives + 1);
        updateLives();
        floaters.push({ text: '+', color: '#55efc4', t: 0, dur: 500, x: player.x + player.w / 2, y: player.y - 10 });
      }
    }

    // input
    let mx = 0;
    if (keys.ArrowLeft || keys.KeyA) mx -= 1;
    if (keys.ArrowRight || keys.KeyD) mx += 1;
    if (mx !== 0) player.facing = mx > 0 ? 1 : -1;
    // jump
    if ((keys.ArrowUp || keys.KeyW || keys.Space) && player.onGround) {
      player.vy = -560;
      player.onGround = false;
    }
    player.vx = mx * player.speed;

    // gravity
    player.vy += GRAVITY * dt;

    // horizontal move + collide
    moveX(player, player.vx * dt);
    // vertical move + collide
    player.onGround = false;
    moveY(player, player.vy * dt);

    // clamp to world (stay above the ground level of bottom)
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > WORLD_W) player.x = WORLD_W - player.w;
  }

  // collision helpers (entity: rectangle)
  function rectAt(x, y, w, h) {
    return { x, y, w, h };
  }
  function collidesSolid(x, y, w, h) {
    const c0 = Math.floor(x / TILE), r0 = Math.floor(y / TILE);
    const c1 = Math.floor((x + w - 1) / TILE), r1 = Math.floor((y + h - 1) / TILE);
    for (let c = c0; c <= c1; c++) {
      for (let r = r0; r <= r1; r++) {
        if (isSolidAt(c, r)) return true;
      }
    }
    return false;
  }
  function moveX(ent, dx) {
    ent.x += dx;
    if (dx > 0 && collidesSolid(ent.x + ent.w, ent.y + 1, 0, ent.h - 2)) {
      ent.x = Math.floor((ent.x + ent.w) / TILE) * TILE - ent.w;
    } else if (dx < 0 && collidesSolid(ent.x, ent.y + 1, 0, ent.h - 2)) {
      ent.x = (Math.floor(ent.x / TILE) + 1) * TILE;
    }
  }
  function moveY(ent, dy) {
    ent.y += dy;
    if (dy > 0 && collidesSolid(ent.x, ent.y + ent.h, ent.w, 0)) {
      ent.y = Math.floor((ent.y + ent.h) / TILE) * TILE - ent.h;
      ent.vy = 0;
      if (ent === player) ent.onGround = true;
    } else if (dy < 0 && collidesSolid(ent.x, ent.y, ent.w, 0)) {
      ent.y = (Math.floor(ent.y / TILE) + 1) * TILE;
      ent.vy = 0;
    }
  }

  // ---------- Breaking (digging) blocks ----------
  let dig = { active: false, target: null, progress: 0, time: 0 };

  function startDig(c, r) {
    const bk = blockKeyAt(c, r);
    if (!bk || (BLOCKS[bk] && BLOCKS[bk].invisible)) return;
    dig.active = true;
    dig.target = c + ',' + r;
    dig.progress = 0;
    dig.time = Math.max(0.1, BLOCKS[bk].hardness);
  }

  function stopDig() { dig.active = false; dig.target = null; dig.progress = 0; }

  function updateDig(dt) {
    if (!dig.active) return;
    const tc = tileCol(mouseWorld.x), tr = tileRow(mouseWorld.y);
    if (dig.target !== (tc + ',' + tr)) { startDig(tc, tr); return; }
    if (!isSolidAt(tc, tr)) { stopDig(); return; }
    dig.progress += dt;
    if (dig.progress >= dig.time) {
      breakBlock(tc, tr);
      stopDig();
    }
  }

  function breakBlock(c, r) {
    const bk = blockKeyAt(c, r);
    if (!bk) return;
    // creative-ish: always break, drop materials + XP for ores
    const def = BLOCKS[bk];
    // particles
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
        vx: (Math.random() - 0.5) * 200, vy: (Math.random() - 0.7) * 200 - 60,
        life: 0.4 + Math.random() * 0.3, maxLife: 0.6,
        color: def.color, size: 4,
      });
    }
    if (def.drops) materials[def.drops] = (materials[def.drops] || 0) + 1;
    if (def.xp) { addXp(def.xp); floaters.push({ text: '+' + def.xp + ' XP', color: '#55efc4', t: 0, dur: 600, x: c * TILE + TILE / 2, y: r * TILE }); }
    setBlock(c, r, null);
    updateBlockBar();
  }

  // ---------- Placing blocks ----------
  function placeBlock() {
    const tc = tileCol(mouseWorld.x), tr = tileRow(mouseWorld.y);
    if (tc < 0 || tr < 0 || tc >= COLS || tr >= ROWS) return;
    if (isSolidAt(tc, tr)) return; // occupied

    const tool = TOOLS[selectedSlot];
    if (!tool || tool.type !== 'block') return;
    const bk = tool.key;
    if (!materials[bk] || materials[bk] <= 0) { flash('No ' + BLOCKS[bk].name + ' left!', '#ff8a80'); return; }

    // don't place on top of player/monsters
    const bx = tc * TILE, by = tr * TILE;
    if (rectsOverlap(rectAt(bx, by, TILE, TILE), rectAt(player.x, player.y, player.w, player.h))) return;
    for (const m of monsters) {
      if (rectsOverlap(rectAt(bx, by, TILE, TILE), rectAt(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2))) return;
    }

    materials[bk]--;
    setBlock(tc, tr, bk);
    for (let i = 0; i < 5; i++) {
      particles.push({
        x: bx + TILE / 2, y: by + TILE / 2,
        vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120,
        life: 0.3, maxLife: 0.3, color: BLOCKS[bk].color, size: 4,
      });
    }
    updateBlockBar();
  }

  // ---------- Destroying / TNT ----------
  function explodeBlocks(c, r, radius) {
    const cx = c * TILE + TILE / 2, cy = r * TILE + TILE / 2;
    for (let cc = c - radius; cc <= c + radius; cc++) {
      for (let rr = r - radius; rr <= r + radius; rr++) {
        if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS) continue;
        if (Math.hypot(cc * TILE + TILE / 2 - cx, rr * TILE + TILE / 2 - cy) <= radius * TILE) {
          setBlock(cc, rr, null);
        }
      }
    }
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: cx, y: cy,
        vx: (Math.random() - 0.5) * 450, vy: (Math.random() - 0.5) * 450,
        life: 0.5 + Math.random() * 0.5, maxLife: 0.9,
        color: Math.random() < 0.5 ? '#ff9800' : '#ffca28', size: 4 + Math.random() * 5,
      });
    }
    cam.shake = 16;
  }

  // ---------- Monster definitions ----------
  const MONSTER_DEFS = {
    zombie:      { name: 'Zombie',       hp: 20, dmg: 1, speed: 55,  color: '#4f9a56', eye: '#1e441f', r: 16, score: 1, drop: 'rotten_flesh' },
    skeleton:    { name: 'Skeleton',     hp: 15, dmg: 1, speed: 80,  color: '#d8d4cc', eye: '#333',     r: 16, score: 1, ranged: true, shotCd: 2200, drop: 'bone' },
    creeper:     { name: 'Creeper',      hp: 25, dmg: 3, speed: 45,  color: '#4fae4f', eye: '#111',     r: 16, score: 2, explosive: true, drop: 'rotten_flesh' },
    spider:      { name: 'Spider',       hp: 12, dmg: 1, speed: 130, color: '#3a3a3a', eye: '#e33',     r: 18, score: 1, fly: true, drop: 'rotten_flesh' },
    enderman:    { name: 'Enderman',     hp: 40, dmg: 2, speed: 72,  color: '#1c1e2b', eye: '#e37aff',  r: 18, score: 3, fly: true, teleportCd: 3000 },
    zombiepiglin:{ name: 'Zombie Piglin',hp: 22, dmg: 1, speed: 70,  color: '#6b8f4e', eye: '#2a2a2a',  r: 17, score: 2, drop: 'rotten_flesh' },
    witch:       { name: 'Witch',        hp: 30, dmg: 2, speed: 40,  color: '#5a4a8a', eye: '#c0ff80',  r: 16, score: 2, ranged: true, shotCd: 2600, projectile: 'potion', fly: true, drop: 'apple' },
    creepermist: { name: 'Creeper',      hp: 25, dmg: 3, speed: 45,  color: '#4fae4f', eye: '#111',     r: 16, score: 2, explosive: true, drop: 'rotten_flesh' },
  };

  // ---------- Waves ----------
  const WAVE_POOL = [
    ['zombie'],
    ['zombie', 'zombie', 'spider'],
    ['zombie', 'skeleton', 'spider'],
    ['zombiepiglin', 'zombie', 'skeleton'],
    ['creeper', 'creeper', 'zombie', 'skeleton'],
    ['witch', 'zombiepiglin', 'enderman'],
  ];
  function waveComposition(w) {
    if (w <= WAVE_POOL.length) return WAVE_POOL[w - 1].slice();
    const pool = ['zombie', 'zombie', 'skeleton', 'spider', 'zombiepiglin', 'creeper', 'creeper', 'witch', 'enderman'];
    const count = Math.min(14, 5 + Math.floor(w * 1.4));
    const list = [];
    for (let i = 0; i < count; i++) {
      const wgt = Math.min(0.5, 0.15 + w * 0.03);
      let pick;
      if (Math.random() < wgt) pick = 'enderman';
      else if (Math.random() < 0.3) pick = pool[Math.floor(Math.random() * pool.length)];
      else pick = pool[Math.floor(Math.random() * 5)];
      list.push(pick);
    }
    return list;
  }

  function nextWave() {
    wave++;
    spawnQueue = waveComposition(wave).slice();
    betweenWaves = false;
    phaseNameEl.textContent = 'Wave ' + wave;
    flash('Wave ' + wave + ' incoming!', '#ffd93d');
  }

  // ---------- Spawning ----------
  function spawnMonster(type, x, y) {
    const def = MONSTER_DEFS[type];
    if (!def) return;
    let sx = x, sy = y;
    if (sx === undefined) {
      sx = player.x + (Math.random() < 0.5 ? -1 : 1) * (220 + Math.random() * 160);
      sx = Math.max(20, Math.min(WORLD_W - 20, sx));
      sy = -10;
    }
    const m = {
      def, type, x: sx, y: sy,
      hp: def.hp, maxHp: def.hp,
      timer: 0, shotCd: def.shotCd || 0, attackCd: 0, hitFlash: 0,
      facing: Math.random() < 0.5 ? 1 : -1, r: def.r,
      vx: 0, vy: 0, onGround: false, teleportCd: def.teleportCd || 0,
    };
    monsters.push(m);
  }

  function spawnDragon() {
    const m = {
      def: { name: 'Ender Dragon', hp: 150, dmg: 2, speed: 95, color: '#2b1440', eye: '#9b59ff', r: 44, score: 20, boss: true },
      type: 'dragon', x: WORLD_W / 2, y: 120,
      hp: 150, maxHp: 150,
      timer: 0, shotCd: 2400, attackCd: 0, hitFlash: 0,
      facing: -1, r: 44, boss: true, onGround: false, vx: 0, vy: 0,
    };
    monsters.push(m);
    phaseNameEl.textContent = 'ENDER DRAGON';
    flash('The Dragon has awakened!', '#9b59ff');
  }

  // ---------- Monster AI ----------
  function updateMonsters(dt) {
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      const def = m.def;
      m.timer += dt;
      m.shotCd -= dt;
      m.attackCd -= dt;
      if (m.hitFlash > 0) m.hitFlash -= dt;

      const px = player.x + player.w / 2, py = player.y + player.h / 2;
      const d = Math.hypot(px - m.x, py - m.y);
      let dx = d > 1 ? (px - m.x) / d : 0;
      let dy = d > 1 ? (py - m.y) / d : 0;
      if (d < 26) { dx = 0; dy = 0; }
      m.facing = dx >= 0 ? 1 : -1;

      if (def.fly || def.boss) {
        // flying
        moveEntity(m, dx * def.speed * dt, dy * def.speed * dt);
        if (m.type === 'enderman') {
          m.teleportCd -= dt;
          if (m.teleportCd <= 0 && d > 200) {
            m.teleportCd = 3200;
            m.x = px + (Math.random() - 0.5) * 160;
            m.y = py + (Math.random() - 0.5) * 120;
            m.x = Math.max(20, Math.min(WORLD_W - 20, m.x));
            m.y = Math.max(20, Math.min(WORLD_H - 20, m.y));
            for (let s = 0; s < 12; s++) particles.push({ x: m.x, y: m.y, vx: (Math.random()-0.5)*180, vy:(Math.random()-0.5)*180, life:0.4, maxLife:0.5, color:'#e37aff', size:3 });
          }
        }
      } else {
        // grounded: horizontal chase + gravity + jump over obstacles
        m.vx = dx * def.speed;
        m.vy += GRAVITY * dt;
        moveEntityX(m, m.vx * dt);
        moveEntityY(m, m.vy * dt);
        // jump over 1-tall blocks
        if (m.onGround && collidesSolid(m.x + (m.vx>0?m.r:0), m.y + m.r, 1 * (m.vx?0:m.r/2), 4) && !collidesSolid(m.x + (m.vx>0?m.r:0), m.y, 1, 4)) {
          m.vy = -480;
          m.onGround = false;
        }
      }
      m.x = Math.max(8, Math.min(WORLD_W - 8, m.x));
      m.y = Math.max(-40, m.y);

      // contact damage
      const mBox = rectAt(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      const pBox = rectAt(player.x, player.y, player.w, player.h);
      if (rectsOverlap(mBox, pBox) && m.attackCd <= 0) {
        if (def.explosive) { explodeAt(m); continue; }
        m.attackCd = 1000;
        damagePlayer(def.dmg, m);
      }

      if (def.ranged && m.shotCd <= 0 && d < 600) {
        m.shotCd = def.shotCd;
        fireProjectile(m, def.projectile === 'potion' ? 'potion' : 'arrow');
      }
      if (def.boss) {
        if (m.shotCd <= 0 && d < 800) {
          m.shotCd = 2600;
          for (let s = 0; s < 3; s++) fireProjectile(m, 'dragonball', s * 0.12);
        }
      }
    }
  }

  function moveEntity(ent, dx, dy) {
    moveEntityX(ent, dx);
    moveEntityY(ent, dy);
  }
  function moveEntityX(ent, dx) {
    ent.x += dx;
    if (dx > 0 && collidesSolid(ent.x + ent.r, ent.y + 2, 0, ent.r * 2 - 4)) ent.x = Math.floor((ent.x + ent.r) / TILE) * TILE - ent.r;
    else if (dx < 0 && collidesSolid(ent.x - ent.r, ent.y + 2, 0, ent.r * 2 - 4)) ent.x = (Math.floor((ent.x - ent.r) / TILE) + 1) * TILE + ent.r;
  }
  function moveEntityY(ent, dy) {
    ent.y += dy;
    if (dy > 0 && collidesSolid(ent.x - ent.r, ent.y + ent.r, ent.r * 2, 0)) {
      ent.y = Math.floor((ent.y + ent.r) / TILE) * TILE - ent.r;
      ent.vy = 0; ent.onGround = true;
    } else if (dy < 0 && collidesSolid(ent.x - ent.r, ent.y - ent.r, ent.r * 2, 0)) {
      ent.y = (Math.floor((ent.y - ent.r) / TILE) + 1) * TILE + ent.r;
      ent.vy = 0;
    } else {
      ent.onGround = false;
    }
  }

  function explodeAt(m) {
    const cx = m.x, cy = m.y;
    const pd = Math.hypot(cx - (player.x + player.w / 2), cy - (player.y + player.h / 2));
    if (pd < 90) damagePlayer(m.def.dmg, m);
    explodeBlocks(Math.floor(cx / TILE), Math.floor(cy / TILE), 2);
    const idx = monsters.indexOf(m);
    if (idx >= 0) monsters.splice(idx, 1);
  }

  function fireProjectile(m, kind, delay) {
    const px = m.x + (m.facing * (m.r || 16));
    const py = m.y;
    const tx = player.x + player.w / 2, ty = player.y + player.h / 2;
    const off = (delay || 0) * 60;
    const ox = Math.cos(off) * 30, oy = Math.sin(off) * 30;
    const d = Math.hypot(tx - (px + ox), ty - (py + oy)) || 1;
    const dx = (tx - (px + ox)) / d, dy = (ty - (py + oy)) / d;
    const speed = kind === 'potion' ? 160 : kind === 'dragonball' ? 200 : 220;
    projectiles.push({ x: px, y: py, vx: dx * speed, vy: dy * speed, kind, dmg: kind === 'dragonball' ? 2 : 1, life: 3, r: 5 });
  }

  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (isSolidAt(tileCol(p.x), tileRow(p.y))) { p.life = 0; }
      const pBox = rectAt(player.x, player.y, player.w, player.h);
      if (rectsOverlap(pBox, rectAt(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2))) {
        damagePlayer(p.dmg, null);
        p.life = 0;
      }
      if (p.life <= 0) {
        if (p.kind === 'potion') for (let s = 0; s < 10; s++) particles.push({ x: p.x, y: p.y, vx:(Math.random()-0.5)*200, vy:(Math.random()-0.5)*200, life:0.4, maxLife:0.5, color:'#a55eea', size:3 });
        projectiles.splice(i, 1);
      }
    }
  }

  // ---------- Damage / kill ----------
  function damagePlayer(amount, from, ignoreIframes) {
    if (state !== 'playing') return;
    if (player.iframes > 0 && !ignoreIframes) return;
    player.iframes = 900;
    lives -= amount;
    // hunger drops when hurt
    Hunger.value = Math.max(0, Hunger.value - 1);
    updateHungerBar();
    const d = document.createElement('div');
    d.className = 'damage';
    overlay.appendChild(d);
    setTimeout(() => d.remove(), 500);
    cam.shake = 10;
    floaters.push({ text: '-' + amount + ' HP', color: '#ff4d4d', t: 0, dur: 700, x: player.x + player.w / 2, y: player.y - 10 });
    updateLives();
    if (lives <= 0) { lives = 0; updateLives(); gameOver(); }
  }

  function hurtMonster(i, dmg) {
    const m = monsters[i];
    m.hp -= dmg;
    m.hitFlash = 0.15;
    m.facing = (player.x + player.w / 2) < m.x ? 1 : -1;
    floaters.push({ text: dmg, color: '#ff5252', t: 0, dur: 600, x: m.x, y: m.y - m.r - 6 });
    if (m.hp <= 0) killMonster(i);
  }

  function killMonster(i) {
    const m = monsters[i];
    const col = m.def.boss ? '#9b59ff' : m.def.color;
    for (let p = 0; p < (m.def.boss ? 40 : 12); p++) {
      particles.push({ x: m.x, y: m.y, vx:(Math.random()-0.5)*260, vy:(Math.random()-0.5)*260, life:0.4+Math.random()*0.5, maxLife:0.8, color: col, size:3+Math.random()*4 });
    }
    kills += m.def.boss ? 20 : m.def.score;
    addXp(m.def.boss ? 30 : 5);
    // food drops
    if (m.def.drop && Math.random() < 0.5) addFood(m.def.drop);
    else if (Math.random() < 0.15) addFood('apple');
    monsters.splice(i, 1);
    updateKills();
    if (m.def.boss) { dragonDefeated = true; winGame(); }
  }

  // ---------- Attack ----------
  function doAttack() {
    if (player.attackTimer > 0) return;
    player.attackTimer = player.attackCd;
    const ax = player.x + player.w / 2 + player.facing * (player.attackRange * 0.6);
    const ay = player.y + player.h / 2;
    let hit = false;
    for (let i = monsters.length - 1; i >= 0; i--) {
      const m = monsters[i];
      if (Math.hypot(m.x - ax, m.y - ay) <= player.attackRange + m.r) {
        hurtMonster(i, player.attackDmg);
        hit = true;
      }
    }
    for (let i = 0; i < 6; i++) {
      particles.push({ x: ax, y: ay, vx:(Math.random()-0.5)*200, vy:(Math.random()-0.5)*200, life:0.25, maxLife:0.35, color:'rgba(255,255,255,0.8)', size:3 });
    }
  }

  // ---------- Camera ----------
  function updateCamera(dt) {
    const tx = player.x - W / 2 + player.w / 2;
    const ty = player.y - H / 2 + player.h / 2;
    cam.x = Math.max(0, Math.min(WORLD_W - W, tx));
    cam.y = Math.max(0, Math.min(WORLD_H - H, ty));
    if (cam.shake > 0) { cam.shake -= dt * 30; if (cam.shake < 0) cam.shake = 0; }
  }

  // ---------- Particles ----------
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.t += dt; f.y -= 40 * dt;
      if (f.t >= f.dur) floaters.splice(i, 1);
    }
  }

  // ---------- Drawing ----------
  function draw() {
    ctx.clearRect(0, 0, W, H);
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    if (dragonDefeated || state === 'win') { sky.addColorStop(0, '#ffe9c8'); sky.addColorStop(1, '#ffd28c'); }
    else { sky.addColorStop(0, '#79c8ef'); sky.addColorStop(1, '#cbe9fb'); }
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(-cam.x + (Math.random() - 0.5) * cam.shake, -cam.y + (Math.random() - 0.5) * cam.shake);
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_W, WORLD_H);
    ctx.clip();

    drawBackground();
    drawBlocks();
    drawProjectiles();
    drawMonsters();
    drawPlayer();
    drawParticles();
    drawFloaters();
    drawDigHighlight();

    ctx.restore();

    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.strokeRect(-cam.x, -cam.y, WORLD_W, WORLD_H);
    drawCursor();
  }

  function drawBackground() {
    // sky, sun, clouds
    ctx.fillStyle = 'rgba(255,255,0,0.9)';
    ctx.beginPath(); ctx.arc(760, 60, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(120 - cam.x * 0.2, 90, 90, 16);
    ctx.fillRect(320 - cam.x * 0.2, 60, 70, 14);
    // grass backdrop behind ground
    ctx.fillStyle = '#7ed957';
    ctx.fillRect(0, SURFACE_ROW * TILE, WORLD_W, WORLD_H - SURFACE_ROW * TILE);
    // ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(0, (SURFACE_ROW + 4) * TILE, WORLD_W, 2);
  }

  function drawBlocks() {
    worldBlocks.forEach((bkey, key) => {
      const [c, r] = key.split(',').map(Number);
      if (c * TILE + TILE < cam.x - 40 || c * TILE > cam.x + W + 40) return;
      if (r * TILE + TILE < cam.y - 40 || r * TILE > cam.y + H + 40) return;
      drawTile(c, r, bkey);
    });
  }

  function drawTile(c, r, bkey) {
    const def = BLOCKS[bkey];
    if (!def || def.invisible) return;
    const x = c * TILE, y = r * TILE;
    // body (side color)
    ctx.fillStyle = def.side || def.color;
    ctx.fillRect(x, y, TILE, TILE);
    // top face (blocky 3d-ish top strip)
    ctx.fillStyle = def.top || def.color;
    ctx.fillRect(x, y, TILE, 6);
    // subtle noise for texture
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(x + 6, y + 14, 8, 3);
    ctx.fillRect(x + 18, y + 22, 6, 3);
    // bottom shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, y + TILE - 4, TILE, 4);
    ctx.strokeStyle = 'rgba(0,0,0,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);

    // ore spots
    if (bkey.indexOf('ore') !== -1) {
      ctx.fillStyle = def.color;
      const sz = 5;
      ctx.fillRect(x + 5, y + 9, sz, sz);
      ctx.fillRect(x + 16, y + 16, sz, sz);
      ctx.fillRect(x + 9, y + 23, sz, sz);
    }
    // TNT markings
    if (bkey === 'tnt') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + 4, y + 4, TILE - 8, 6);
      ctx.fillRect(x + 4, y + TILE - 10, TILE - 8, 6);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('TNT', x + 7, y + 19);
    }
  }

  function drawMonsters() {
    for (const m of monsters) {
      const def = m.def;
      const x = m.x, y = m.y, r = m.r;
      ctx.save();
      const flash = m.hitFlash > 0;

      if (m.type === 'dragon') {
        drawDragon(m);
        ctx.restore();
        continue;
      }

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(x, y + r - 2, r * 0.9, 5, 0, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = flash ? '#ffffff' : def.color;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.fillStyle = flash ? '#eee' : shade(def.color, -30);
      ctx.fillRect(x - r + 2, y + r - 4, r - 4, 6);
      ctx.fillRect(x + 2, y + r - 4, r - 4, 6);
      drawMonsterFace(m);
      ctx.restore();

      if (m.hp < m.maxHp) {
        const bw = r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x - bw / 2, y - r - 10, bw, 4);
        ctx.fillStyle = '#4de24d';
        ctx.fillRect(x - bw / 2, y - r - 10, bw * (m.hp / m.maxHp), 4);
      }
    }
  }

  function shade(hex, amt) {
    if (!hex) return '#888';
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
    r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  function drawMonsterFace(m) {
    const x = m.x, y = m.y, r = m.r, def = m.def;
    if (m.type === 'creeper' || m.type === 'creepermist') {
      ctx.fillStyle = def.eye;
      ctx.fillRect(x - 6, y - 4, 4, 4); ctx.fillRect(x + 2, y - 4, 4, 4);
      ctx.fillRect(x - 6, y + 3, 4, 4); ctx.fillRect(x + 2, y + 3, 4, 4); ctx.fillRect(x - 2, y + 3, 4, 4);
    } else if (m.type === 'enderman') {
      ctx.fillStyle = def.eye;
      ctx.fillRect(x - 8, y - 6, 5, 8); ctx.fillRect(x + 3, y - 6, 5, 8);
    } else if (m.type === 'zombie') {
      ctx.fillStyle = def.eye;
      ctx.fillRect(x - 6, y - 4, 4, 4); ctx.fillRect(x + 2, y - 4, 4, 4); ctx.fillRect(x - 5, y + 3, 10, 3);
    } else if (m.type === 'skeleton') {
      ctx.fillStyle = '#111';
      ctx.fillRect(x - 6, y - 4, 4, 4); ctx.fillRect(x + 2, y - 4, 4, 4); ctx.fillRect(x - 6, y + 3, 12, 2);
    } else if (m.type === 'spider') {
      ctx.fillStyle = def.eye;
      ctx.fillRect(x - 7, y - 6, 3, 3); ctx.fillRect(x + 4, y - 6, 3, 3);
      ctx.fillRect(x - 7, y + 3, 3, 3); ctx.fillRect(x + 4, y + 3, 3, 3);
    } else if (m.type === 'witch') {
      ctx.fillStyle = def.eye;
      ctx.fillRect(x - 6, y - 5, 4, 4); ctx.fillRect(x + 2, y - 5, 4, 4);
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 2, y - 10); ctx.lineTo(x, y - 4); ctx.lineTo(x + 2, y - 10); ctx.stroke();
    } else {
      ctx.fillStyle = def.eye;
      ctx.fillRect(x - 6, y - 4, 4, 4); ctx.fillRect(x + 2, y - 4, 4, 4);
    }
  }

  function drawDragon(m) {
    const x = m.x, y = m.y, r = m.r;
    const flash = m.hitFlash > 0;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(x, y + r - 6, r * 1.2, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#2b1440';
    ctx.fillRect(x - r, y - r * 0.6, r * 2, r * 1.2);
    ctx.fillStyle = flash ? '#eee' : '#3a1f5c';
    ctx.fillRect(x + m.facing * r * 0.7, y - r * 0.8, r * 1.4, r * 1.1);
    ctx.fillStyle = '#cfc6ff';
    ctx.fillRect(x + m.facing * r * 0.7 + 2, y - r * 1.1, 4, r * 0.4);
    ctx.fillRect(x + m.facing * r * 0.7 + r * 0.8, y - r * 1.1, 4, r * 0.4);
    ctx.fillStyle = flash ? '#ddd' : '#1c1030';
    ctx.beginPath();
    ctx.moveTo(x - m.facing * r * 0.4, y - r * 0.4);
    ctx.lineTo(x - m.facing * r * 1.6, y - r * 1.4);
    ctx.lineTo(x - m.facing * r * 1.1, y + r * 0.2);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9b59ff';
    ctx.fillRect(x + m.facing * r * 0.7 + 6, y - r * 0.55, 6, 6);
    ctx.fillRect(x + m.facing * r * 0.7 + r * 0.5, y - r * 0.55, 6, 6);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x - r + 4, y, r * 2 - 8, r * 0.3);

    const bw = 300, bx = m.x - bw / 2, by = y - r - 26;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = '#9b59ff';
    ctx.fillRect(bx, by, bw * (m.hp / m.maxHp), 8);
  }

  function drawPlayer() {
    const x = player.x, y = player.y, w = player.w, h = player.h;
    ctx.save();
    if (player.iframes > 0 && Math.floor(player.iframes / 120) % 2 === 0) ctx.globalAlpha = 0.4;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h, w * 0.5, 5, 0, 0, Math.PI * 2); ctx.fill();

    const f = player.facing;
    ctx.fillStyle = '#3a3a55';
    const walk = Math.sin(performance.now() / 120) * (Math.abs(player.vx) > 1 ? 3 : 1);
    ctx.fillRect(x + (f > 0 ? 2 : 10), y + h - 15 + (walk > 0 ? -2 : 0), 10, 15);
    ctx.fillRect(x + (f > 0 ? 2 : 10), y + h - 15 + (walk > 0 ? 0 : -2), 10, 15);

    ctx.fillStyle = '#4aa3df';
    ctx.fillRect(x + 2, y + h - 42, w - 4, 27);
    ctx.fillStyle = '#e0a26b';
    ctx.fillRect(x, y, w, h - 42);
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(x, y, w, 9);
    ctx.fillStyle = '#fff';
    ctx.fillRect(x + (f > 0 ? 14 : 4), y + 15, 7, 6);
    ctx.fillStyle = '#1f4f8a';
    ctx.fillRect(x + (f > 0 ? 17 : 7), y + 16, 4, 4);

    // sword swing
    if (player.attackTimer > player.attackCd * 0.5) {
      const ax = x + w / 2 + f * 26, ay = y + h - 22;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ax, ay, 26, -Math.PI / 2 * 2, Math.PI / 2 * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      if (p.kind === 'arrow') {
        ctx.strokeStyle = '#7a5a2a'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
      } else if (p.kind === 'potion') {
        ctx.fillStyle = '#a55eea'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#c88fff'; ctx.fillRect(p.x - 2, p.y - 8, 4, 4);
      } else if (p.kind === 'dragonball') {
        ctx.fillStyle = '#9b59ff'; ctx.shadowColor = '#9b59ff'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters() {
    for (const f of floaters) {
      ctx.globalAlpha = 1 - f.t / f.dur;
      ctx.fillStyle = f.color;
      ctx.font = 'bold 15px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  }

  function drawDigHighlight() {
    // show progress crack on target block
    if (dig.active) {
      const [c, r] = dig.target ? dig.target.split(',').map(Number) : [-1, -1];
      if (c >= 0 && r >= 0) {
        const pct = Math.min(1, dig.progress / dig.time);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(c * TILE, r * TILE, TILE, TILE * pct);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(c * TILE + 1, r * TILE + 1, TILE - 2, TILE - 2);
      }
    }
  }

  function drawCursor() {
    if (!mouse.inside || state === 'menu') return;
    const c = tileCol(mouseWorld.x), r = tileRow(mouseWorld.y);
    if (c >= 0 && r >= 0 && c < COLS && r < ROWS) {
      const tool = TOOLS[selectedSlot];
      const color = (tool && tool.type === 'block' && !isSolidAt(c, r)) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.5)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(c * TILE - cam.x + 0.5, r * TILE - cam.y + 0.5, TILE - 1, TILE - 1);
    }
  }

  // ---------- HUD ----------
  function updateLives() {
    let hearts = '';
    for (let i = 0; i < 5; i++) hearts += i < lives ? '\u2665' : '\u2661';
    livesCountEl.textContent = hearts;
    livesCountEl.classList.toggle('low', lives <= 2);
  }
  function updateKills() { killsCountEl.textContent = kills; }
  function updateHUD() { updateLives(); updateKills(); weaponNameEl.textContent = 'Sword (DMG ' + player.attackDmg + ')'; }

  function updateBlockBar() {
    blockBar.innerHTML = '';
    TOOLS.forEach((t, i) => {
      const s = document.createElement('div');
      const count = t.type === 'block' ? (materials[t.key] || 0) : '\u26CF';
      s.className = 'block-slot' + (i === selectedSlot ? ' selected' : '');
      const color = t.type === 'block' ? BLOCKS[t.key].color : '#e8c14a';
      s.innerHTML =
        '<div class="block-ic" style="background:' + color + '"></div>' +
        '<span class="slot-key">' + (i + 1) + '</span>' +
        '<span class="slot-count">' + count + '</span>';
      s.addEventListener('click', () => selectSlot(i));
      blockBar.appendChild(s);
    });
  }
  function selectSlot(i) { selectedSlot = i; updateBlockBar(); }

  // ---------- Screens ----------
  function gameOver() { state = 'gameover'; showEndScreen(false); }
  function winGame() { state = 'win'; showEndScreen(true); }

  function showEndScreen(victory) {
    startScreen.classList.remove('hidden');
    const panel = startScreen.querySelector('.panel');
    panel.querySelector('h1').textContent = victory ? '\u2694 VICTORY!' : '\u2620 GAME OVER';
    panel.querySelector('.subtitle').textContent = victory ? 'You defeated the Ender Dragon!' : 'You lost all your health...';
    const howto = startScreen.querySelector('.howto');
    howto.innerHTML =
      '<p>' + (victory ? 'You survived the waves and slew the Dragon!' : 'The monsters overwhelmed you.') +
      ' You reached <b>Wave ' + wave + '</b> with <b>' + kills + '</b> kills and Level <b>' + Xp.level + '</b>.</p>';
    startBtn.textContent = '\u21BB Play Again';
  }

  function startGame() {
    resetGame();
    startScreen.classList.add('hidden');
    state = 'playing';
    nextWave();
  }

  // ---------- Main loop ----------
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    try {
      if (state === 'playing') {
        updatePlayer(dt);
        updateDig(dt);

        // wave logic
        if (betweenWaves) {
          waveTimer -= dt;
          if (waveTimer <= 0) nextWave();
        } else {
          if (spawnQueue.length > 0) {
            spawnTimer -= dt;
            if (spawnTimer <= 0) {
              spawnTimer = 700;
              spawnMonster(spawnQueue.shift());
            }
          } else if (monsters.length === 0) {
            if (wave >= 8 && !dragonDefeated) {
              spawnDragon();
              betweenWaves = false;
              spawnQueue = [];
            } else {
              betweenWaves = true;
              waveTimer = 1600;
              BLOCK_KEYS.forEach(k => { materials[k] = Math.min(64, (materials[k] || 0) + 8); });
              updateBlockBar();
            }
          }
        }

        updateMonsters(dt);
        updateProjectiles(dt);
        updateParticles(dt);
        updateCamera(dt);
      } else {
        updateParticles(dt);
      }

      draw();

      if (state === 'paused') pauseEl.style.display = 'flex';
      else pauseEl.style.display = 'none';
    } catch (err) {
      if (window.console && console.error) console.error(err);
    } finally {
      requestAnimationFrame(loop);
    }
  }

  // ---------- Events ----------
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (state === 'playing' && (e.code === 'KeyP')) state = 'paused';
    else if (state === 'paused' && (e.code === 'KeyP')) state = 'playing';
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') { e.preventDefault(); doAttack(); }
    if (e.code === 'KeyE' && state === 'playing') eatFood();
    const numMap = {};
    TOOLS.forEach((_, i) => numMap['Digit' + (i + 1)] = i);
    if (numMap.hasOwnProperty(e.code)) selectSlot(numMap[e.code]);
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => {
    updateMouse(e);
    if (e.button === 0) { mouse.leftDown = true; stopDig(); if (state === 'playing') startDig(tileCol(mouseWorld.x), tileRow(mouseWorld.y)); }
    if (e.button === 2 && state === 'playing') placeBlock();
  });
  window.addEventListener('mouseup', e => { if (e.button === 0) { mouse.leftDown = false; stopDig(); } });
  canvas.addEventListener('mousemove', e => {
    updateMouse(e);
    if (mouse.leftDown && state === 'playing') {
      const c = tileCol(mouseWorld.x), r = tileRow(mouseWorld.y);
      if (dig.target !== (c + ',' + r)) startDig(c, r);
    }
  });
  canvas.addEventListener('mouseleave', () => { mouse.inside = false; stopDig(); });
  function updateMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) / rect.width;
    const sy = (e.clientY - rect.top) / rect.height;
    mouseWorld.x = cam.x + sx * W;
    mouseWorld.y = cam.y + sy * H;
    mouse.inside = true;
  }

  startBtn.addEventListener('click', startGame);
  pauseBtn.addEventListener('click', () => {
    if (state === 'playing') state = 'paused';
    else if (state === 'paused') state = 'playing';
  });

  // ---------- Init ----------
  const pauseEl = document.createElement('div');
  pauseEl.style.position = 'absolute';
  pauseEl.style.inset = '0';
  pauseEl.style.background = 'rgba(0,0,0,0.55)';
  pauseEl.style.alignItems = 'center';
  pauseEl.style.justifyContent = 'center';
  pauseEl.style.fontSize = '40px';
  pauseEl.style.fontWeight = '800';
  pauseEl.style.display = 'none';
  pauseEl.textContent = 'PAUSED';
  overlay.appendChild(pauseEl);

  function init() {
    ctx.imageSmoothingEnabled = false;
    updateHUD();
    updateXpBar();
    updateHungerBar();
    updateBlockBar();
    draw();
    requestAnimationFrame(loop);
  }

  init();
})();
