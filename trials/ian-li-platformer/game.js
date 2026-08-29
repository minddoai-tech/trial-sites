const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const livesEl = document.querySelector("#lives");
const checkpointEl = document.querySelector("#checkpoint");
const statusEl = document.querySelector("#status");

const W = canvas.width;
const H = canvas.height;
const GRAVITY = 0.72;
const FRICTION = 0.82;
const PLAYER_GROUND_ACCEL = 0.98;
const PLAYER_AIR_ACCEL = 0.56;
const PLAYER_MAX_SPEED = 8.4;
const keys = new Set();

const startState = {
  x: 80,
  y: 496,
  lives: 3,
  checkpoint: 1,
  checkpointX: 80,
  checkpointY: 496,
};

const platforms = [
  { x: 0, y: 560, w: 520, h: 80 },
  { x: 635, y: 520, w: 395, h: 120 },
  { x: 1060, y: 475, w: 350, h: 42 },
  { x: 1450, y: 545, w: 600, h: 95 },
  { x: 2145, y: 500, w: 330, h: 42 },
  { x: 2510, y: 455, w: 330, h: 42 },
  { x: 2870, y: 555, w: 540, h: 85 },
  { x: 3515, y: 515, w: 430, h: 42 },
  { x: 4040, y: 560, w: 680, h: 80 },
  { x: 4835, y: 505, w: 340, h: 42 },
  { x: 5240, y: 450, w: 350, h: 42 },
  { x: 5650, y: 560, w: 560, h: 80 },
];

const poisonLakes = [
  { x: 526, y: 584, w: 103, h: 46 },
  { x: 2058, y: 584, w: 82, h: 46 },
  { x: 3418, y: 584, w: 91, h: 46 },
  { x: 4728, y: 584, w: 101, h: 46 },
];

const spikes = [
  { x: 1165, y: 445, count: 3 },
  { x: 1630, y: 515, count: 4 },
  { x: 2995, y: 525, count: 5 },
  { x: 4180, y: 530, count: 4 },
  { x: 5750, y: 530, count: 4 },
];

const checkpoints = [
  { x: 80, y: 560, id: 1 },
  { x: 1555, y: 545, id: 2 },
  { x: 3020, y: 555, id: 3 },
  { x: 4125, y: 560, id: 4 },
];

const portalPairs = [
  {
    a: { x: 2345, y: 408, w: 54, h: 90 },
    b: { x: 3540, y: 423, w: 54, h: 90 },
  },
];

const goalPortal = { x: 6050, y: 468, w: 70, h: 92 };

const obstacleBlocks = [
  { x: 890, y: 464, w: 34, h: 56 },
  { x: 1815, y: 487, w: 46, h: 58 },
  { x: 3118, y: 502, w: 46, h: 53 },
  { x: 4385, y: 498, w: 48, h: 62 },
  { x: 5352, y: 394, w: 44, h: 56 },
];

const energyOrbs = [
  { minX: 1110, maxX: 1360, y: 430, r: 18, speed: 0.025, phase: 0 },
  { minX: 2170, maxX: 2440, y: 456, r: 17, speed: 0.022, phase: 1.8 },
  { minX: 3545, maxX: 3905, y: 472, r: 18, speed: 0.019, phase: 3.1 },
  { minX: 4860, maxX: 5148, y: 462, r: 16, speed: 0.024, phase: 4.4 },
];

const clouds = [
  { x: 10, y: 134, w: 148, h: 32, speed: 0.22, depth: 0.12 },
  { x: 460, y: 164, w: 128, h: 28, speed: 0.16, depth: 0.18 },
  { x: 900, y: 118, w: 152, h: 34, speed: 0.28, depth: 0.1 },
  { x: 1320, y: 92, w: 104, h: 24, speed: 0.2, depth: 0.16 },
  { x: 1770, y: 152, w: 176, h: 34, speed: 0.12, depth: 0.2 },
];

let enemies;
let player;
let cameraX = 0;
let gameState = "playing";
let messageTimer = 0;
let attackPressed = false;
let portalCooldown = 0;
let hurtCooldown = 0;
let t = 0;

function resetEnemies() {
  enemies = [
    makeEnemy(760, 455, 620, 910),
    makeEnemy(1740, 480, 1480, 1930),
    makeEnemy(2680, 390, 2520, 2760),
    makeEnemy(3170, 490, 2880, 3340),
    makeEnemy(4300, 495, 4040, 4600),
    makeEnemy(5845, 495, 5660, 6140),
  ];
}

function makeEnemy(x, y, minX, maxX) {
  return {
    x,
    y,
    w: 38,
    h: 58,
    vx: -1.25,
    vy: 0,
    minX,
    maxX,
    dir: -1,
    alive: true,
    attack: 0,
  };
}

function resetGame() {
  player = {
    x: startState.x,
    y: startState.y,
    w: 36,
    h: 64,
    vx: 0,
    vy: 0,
    dir: 1,
    onGround: false,
    jumpsLeft: 2,
    lives: startState.lives,
    checkpoint: startState.checkpoint,
    checkpointX: startState.checkpointX,
    checkpointY: startState.checkpointY,
    attack: 0,
  };
  resetEnemies();
  cameraX = 0;
  gameState = "playing";
  messageTimer = 180;
  portalCooldown = 0;
  hurtCooldown = 0;
  statusEl.textContent = "Find flags, avoid poison, reach the silver portal";
  syncHud();
}

function syncHud() {
  livesEl.textContent = `Lives: ${player.lives}`;
  checkpointEl.textContent = `Checkpoint: ${player.checkpoint}`;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function respawn(reason) {
  player.lives -= 1;
  syncHud();
  if (player.lives <= 0) {
    gameState = "lost";
    statusEl.textContent = `${reason}. Press R to restart`;
    return;
  }
  player.x = player.checkpointX;
  player.y = player.checkpointY;
  player.vx = 0;
  player.vy = 0;
  player.jumpsLeft = 2;
  hurtCooldown = 90;
  statusEl.textContent = `${reason}. Respawned at flag ${player.checkpoint}`;
}

function takeHit(reason) {
  if (hurtCooldown > 0 || gameState !== "playing") return;
  respawn(reason);
}

function solidCollision(entity) {
  entity.onGround = false;
  entity.x += entity.vx;
  for (const p of solidSurfaces()) {
    if (!rectsOverlap(entity, p)) continue;
    if (entity.vx > 0) entity.x = p.x - entity.w;
    if (entity.vx < 0) entity.x = p.x + p.w;
    entity.vx = 0;
  }

  entity.y += entity.vy;
  for (const p of solidSurfaces()) {
    if (!rectsOverlap(entity, p)) continue;
    if (entity.vy > 0) {
      entity.y = p.y - entity.h;
      entity.vy = 0;
      entity.onGround = true;
      entity.jumpsLeft = 2;
    } else if (entity.vy < 0) {
      entity.y = p.y + p.h;
      entity.vy = 0;
    }
  }
}

function solidSurfaces() {
  return platforms.concat(obstacleBlocks);
}

function updatePlayer() {
  const speed = player.onGround ? PLAYER_GROUND_ACCEL : PLAYER_AIR_ACCEL;
  if (keys.has("ArrowLeft")) {
    player.vx -= speed;
    player.dir = -1;
  }
  if (keys.has("ArrowRight")) {
    player.vx += speed;
    player.dir = 1;
  }
  player.vx = Math.max(-PLAYER_MAX_SPEED, Math.min(PLAYER_MAX_SPEED, player.vx));
  player.vx *= FRICTION;
  player.vy += GRAVITY;
  if (player.vy > 18) player.vy = 18;
  solidCollision(player);

  if (player.y > H + 120) takeHit("Fell into the endless mist");
  for (const lake of poisonLakes) {
    if (rectsOverlap(player, lake)) takeHit("Poison lake got you");
  }
  for (const spike of spikeRects()) {
    if (rectsOverlap(player, spike)) takeHit("Spikes pierced the shadows");
  }
  for (const orb of energyOrbs) {
    if (rectsOverlap(player, energyOrbBox(orb))) takeHit("A red energy obstacle hit you");
  }

  for (const flag of checkpoints) {
    const flagBox = { x: flag.x - 14, y: flag.y - 86, w: 42, h: 90 };
    if (rectsOverlap(player, flagBox) && flag.id > player.checkpoint) {
      player.checkpoint = flag.id;
      player.checkpointX = flag.x;
      player.checkpointY = flag.y - player.h;
      statusEl.textContent = `Checkpoint ${flag.id} claimed`;
      syncHud();
    }
  }

  if (portalCooldown <= 0) {
    for (const pair of portalPairs) {
      if (rectsOverlap(player, pair.a)) {
        player.x = pair.b.x + 18;
        player.y = pair.b.y - 8;
        player.vx = 3;
        portalCooldown = 70;
        statusEl.textContent = "Portal jump";
      } else if (rectsOverlap(player, pair.b)) {
        player.x = pair.a.x - 12;
        player.y = pair.a.y - 8;
        player.vx = -3;
        portalCooldown = 70;
        statusEl.textContent = "Portal jump";
      }
    }
  }

  if (rectsOverlap(player, goalPortal)) {
    gameState = "won";
    statusEl.textContent = "You reached the silver portal. Press R to play again";
  }

  if (player.attack > 0) {
    const sword = swordBox();
    for (const enemy of enemies) {
      if (enemy.alive && rectsOverlap(sword, enemy)) {
        enemy.alive = false;
        statusEl.textContent = "Red ninja vanished";
      }
    }
  }
}

function updateEnemies() {
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const distance = player.x + player.w / 2 - (enemy.x + enemy.w / 2);
    const close = Math.abs(distance) < 240 && Math.abs(player.y - enemy.y) < 95;
    enemy.attack = Math.max(0, enemy.attack - 1);
    if (close) {
      enemy.dir = Math.sign(distance) || enemy.dir;
      enemy.vx += enemy.dir * 0.16;
      if (Math.abs(distance) < 66) enemy.attack = 18;
    } else {
      if (enemy.x < enemy.minX) enemy.dir = 1;
      if (enemy.x + enemy.w > enemy.maxX) enemy.dir = -1;
      enemy.vx += enemy.dir * 0.08;
    }
    enemy.vx = Math.max(-3.1, Math.min(3.1, enemy.vx));
    avoidEnemyHazards(enemy);
    enemy.vy += GRAVITY;
    solidCollision(enemy);
    if (enemy.x < enemy.minX || enemy.x + enemy.w > enemy.maxX) {
      enemy.dir *= -1;
      enemy.vx = enemy.dir * 1.4;
    }
    if (rectsOverlap(player, enemy)) takeHit("A red ninja landed a strike");
    if (enemy.attack > 0 && rectsOverlap(player, enemySwordBox(enemy))) {
      takeHit("A red ninja slash found you");
    }
  }
}

function avoidEnemyHazards(enemy) {
  const nextX = enemy.x + enemy.vx;
  const frontX = enemy.dir > 0 ? nextX + enemy.w + 9 : nextX - 9;
  const footY = enemy.y + enemy.h;
  const bodyAhead = { x: nextX, y: enemy.y, w: enemy.w, h: enemy.h + 18 };
  const poisonAhead = poisonLakes.some((lake) => rectsOverlap(bodyAhead, lake));
  const groundAhead = platforms.some((p) => {
    return frontX >= p.x && frontX <= p.x + p.w && p.y >= footY - 8 && p.y <= footY + 28;
  });

  if (poisonAhead || (enemy.onGround && !groundAhead)) {
    enemy.dir *= -1;
    enemy.vx = enemy.dir * 1.8;
  }
}

function spikeRects() {
  const rects = [];
  for (const group of spikes) {
    for (let i = 0; i < group.count; i += 1) {
      rects.push({ x: group.x + i * 28, y: group.y + 8, w: 24, h: 24 });
    }
  }
  return rects;
}

function energyOrbBox(orb) {
  const x = orb.minX + (Math.sin(t * orb.speed + orb.phase) + 1) * 0.5 * (orb.maxX - orb.minX);
  const y = orb.y + Math.sin(t * orb.speed * 1.7 + orb.phase) * 8;
  return { x: x - orb.r, y: y - orb.r, w: orb.r * 2, h: orb.r * 2 };
}

function swordBox() {
  const reach = 58;
  return {
    x: player.dir > 0 ? player.x + player.w - 4 : player.x - reach + 4,
    y: player.y + 18,
    w: reach,
    h: 26,
  };
}

function enemySwordBox(enemy) {
  return {
    x: enemy.dir > 0 ? enemy.x + enemy.w - 2 : enemy.x - 34,
    y: enemy.y + 24,
    w: 38,
    h: 18,
  };
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#161b2a");
  sky.addColorStop(0.55, "#202738");
  sky.addColorStop(1, "#11151e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  for (const cloud of clouds) {
    const drift = cloud.x + t * cloud.speed - cameraX * cloud.depth;
    const x = ((drift % (W + 260)) + W + 260) % (W + 260) - 150;
    drawCloud(x, cloud.y + Math.sin(t / 50 + cloud.x) * 4, cloud.w, cloud.h);
  }

  ctx.save();
  ctx.translate(-cameraX * 0.45, 0);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let i = -2; i < 22; i += 1) {
    const x = i * 320;
    ctx.beginPath();
    ctx.moveTo(x, 560);
    ctx.quadraticCurveTo(x + 170, 260 + (i % 3) * 38, x + 355, 560);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawCloud(x, y, w, h) {
  ctx.fillStyle = "rgba(159, 243, 211, 0.14)";
  ctx.beginPath();
  ctx.ellipse(x, y, w * 0.42, h * 0.48, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.28, y - h * 0.16, w * 0.32, h * 0.5, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.54, y, w * 0.38, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
}

function worldX(x) {
  return Math.round(x - cameraX);
}

function drawPlatforms() {
  for (const p of platforms) {
    const x = worldX(p.x);
    const grad = ctx.createLinearGradient(0, p.y, 0, p.y + p.h);
    grad.addColorStop(0, "#6bc5a7");
    grad.addColorStop(0.18, "#3f8e78");
    grad.addColorStop(1, "#2d3942");
    ctx.fillStyle = grad;
    roundRect(x, p.y, p.w, p.h, 8);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundRect(x + 14, p.y + 9, Math.max(0, p.w - 28), 5, 5);
    ctx.fill();
  }
}

function drawObstacles() {
  for (const block of obstacleBlocks) {
    const x = worldX(block.x);
    const grad = ctx.createLinearGradient(0, block.y, 0, block.y + block.h);
    grad.addColorStop(0, "#d7f7ff");
    grad.addColorStop(0.45, "#85d8e6");
    grad.addColorStop(1, "#3d7d92");
    ctx.fillStyle = grad;
    roundRect(x, block.y, block.w, block.h, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.lineWidth = 2;
    roundRect(x + 5, block.y + 5, block.w - 10, block.h - 10, 6);
    ctx.stroke();
  }

  for (const orb of energyOrbs) {
    const box = energyOrbBox(orb);
    const x = worldX(box.x + box.w / 2);
    const y = box.y + box.h / 2;
    const pulse = 1 + Math.sin(t * 0.12 + orb.phase) * 0.12;
    ctx.fillStyle = "rgba(255, 83, 100, 0.22)";
    ctx.beginPath();
    ctx.arc(x, y, orb.r * 1.85 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff5364";
    ctx.beginPath();
    ctx.arc(x, y, orb.r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffd1d6";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, orb.r * 0.62, 0.4 + t * 0.04, Math.PI * 1.55 + t * 0.04);
    ctx.stroke();
  }
}

function drawHazards() {
  for (const lake of poisonLakes) {
    const x = worldX(lake.x);
    const glow = ctx.createLinearGradient(0, lake.y, 0, lake.y + lake.h);
    glow.addColorStop(0, "#b2ff3f");
    glow.addColorStop(0.55, "#42d976");
    glow.addColorStop(1, "#1e8a57");
    ctx.fillStyle = glow;
    roundRect(x, lake.y, lake.w, lake.h, 18);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    for (let i = 0; i < lake.w; i += 36) {
      ctx.beginPath();
      ctx.ellipse(x + i + 16, lake.y + 12 + Math.sin(t / 15 + i) * 4, 13, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = "#f4f7fb";
  ctx.strokeStyle = "#ff5364";
  ctx.lineWidth = 4;
  for (const group of spikes) {
    for (let i = 0; i < group.count; i += 1) {
      const x = worldX(group.x + i * 28);
      ctx.beginPath();
      ctx.moveTo(x, group.y + 28);
      ctx.lineTo(x + 12, group.y);
      ctx.lineTo(x + 24, group.y + 28);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

function drawFlags() {
  for (const flag of checkpoints) {
    const x = worldX(flag.x);
    const active = flag.id <= player.checkpoint;
    ctx.strokeStyle = active ? "#9ff3d3" : "#8792a3";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, flag.y);
    ctx.lineTo(x, flag.y - 82);
    ctx.stroke();
    ctx.fillStyle = active ? "#9ff3d3" : "#c1c8d2";
    ctx.beginPath();
    ctx.moveTo(x + 3, flag.y - 80);
    ctx.quadraticCurveTo(x + 42, flag.y - 72, x + 10, flag.y - 52);
    ctx.lineTo(x + 3, flag.y - 52);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPortals() {
  for (const pair of portalPairs) {
    drawPortal(pair.a, "#7f6cff", "#9ff3d3");
    drawPortal(pair.b, "#7f6cff", "#9ff3d3");
  }
  drawPortal(goalPortal, "#f4f7fb", "#ffd86b");
}

function drawPortal(portal, outer, inner) {
  const x = worldX(portal.x);
  ctx.save();
  ctx.translate(x + portal.w / 2, portal.y + portal.h / 2);
  ctx.rotate(Math.sin(t / 25) * 0.08);
  ctx.strokeStyle = outer;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.ellipse(0, 0, portal.w / 2, portal.h / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = inner;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, portal.w / 3, portal.h / 2.8, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawNinja(entity, color, isPlayer = false) {
  const x = worldX(entity.x);
  const y = entity.y;
  const center = x + entity.w / 2;
  const blink = isPlayer && hurtCooldown > 0 && Math.floor(t / 5) % 2 === 0;
  if (blink) return;

  ctx.save();
  ctx.translate(center, y);
  ctx.scale(entity.dir, 1);

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, entity.h + 4, 28, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  roundRect(-17, 18, 34, 38, 12);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 14, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isPlayer ? "#f4f7fb" : "#141925";
  roundRect(-13, 10, 26, 8, 4);
  ctx.fill();
  ctx.fillStyle = isPlayer ? "#05070a" : "#ff5364";
  ctx.beginPath();
  ctx.arc(7, 14, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-12, 50);
  ctx.lineTo(-20, 66);
  ctx.moveTo(12, 50);
  ctx.lineTo(20, 66);
  ctx.stroke();

  const attacking = isPlayer ? entity.attack > 0 : entity.attack > 0;
  ctx.strokeStyle = isPlayer ? "#e9edf4" : "#ffb5bc";
  ctx.lineWidth = attacking ? 5 : 3;
  ctx.beginPath();
  ctx.moveTo(15, 34);
  ctx.lineTo(attacking ? 64 : 36, attacking ? 28 : 22);
  ctx.stroke();

  if (attacking) {
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(39, 28, 24, -0.7, 0.5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawOverlay() {
  if (gameState === "playing" && messageTimer <= 0) return;
  ctx.save();
  ctx.fillStyle = "rgba(12, 15, 22, 0.68)";
  roundRect(260, 172, 600, 170, 8);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#f4f7fb";
  ctx.font = "800 34px system-ui, sans-serif";
  const title = gameState === "won" ? "Portal Cleared" : gameState === "lost" ? "Mission Failed" : "Reach the Silver Portal";
  ctx.fillText(title, W / 2, 235);
  ctx.fillStyle = "#aab5c4";
  ctx.font = "16px system-ui, sans-serif";
  const line = gameState === "playing"
    ? "Arrow keys move. Up double jumps. Down slashes. Avoid poison, spikes, and red orbs."
    : "Press R to restart from the first flag.";
  ctx.fillText(line, W / 2, 276);
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
}

function draw() {
  drawBackground();
  drawPlatforms();
  drawObstacles();
  drawHazards();
  drawFlags();
  drawPortals();
  for (const enemy of enemies) {
    if (enemy.alive) drawNinja(enemy, "#d9253d");
  }
  drawNinja(player, "#05070a", true);
  drawOverlay();
}

function loop() {
  t += 1;
  if (gameState === "playing") {
    updatePlayer();
    updateEnemies();
    cameraX += (player.x - cameraX - W * 0.38) * 0.08;
    cameraX = Math.max(0, Math.min(5200, cameraX));
    player.attack = Math.max(0, player.attack - 1);
    portalCooldown = Math.max(0, portalCooldown - 1);
    hurtCooldown = Math.max(0, hurtCooldown - 1);
    messageTimer = Math.max(0, messageTimer - 1);
  }
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
  }
  if (event.key === "r" || event.key === "R") {
    resetGame();
    return;
  }
  if (gameState !== "playing") return;
  if (event.key === "ArrowUp" && !keys.has("ArrowUp") && player.jumpsLeft > 0) {
    player.vy = player.jumpsLeft === 2 ? -15.2 : -7.6;
    player.jumpsLeft -= 1;
    player.onGround = false;
  }
  if (event.key === "ArrowDown" && !attackPressed) {
    player.attack = 16;
    attackPressed = true;
  }
  keys.add(event.key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
  if (event.key === "ArrowDown") attackPressed = false;
});

resetGame();
loop();
