const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const restartButton = document.getElementById("restartButton");
const newRunButton = document.getElementById("newRunButton");
const levelLabel = document.getElementById("levelLabel");
const attemptLabel = document.getElementById("attemptLabel");
const overlay = document.getElementById("messageOverlay");
const messageKicker = document.getElementById("messageKicker");
const messageTitle = document.getElementById("messageTitle");
const messageBody = document.getElementById("messageBody");
const messageButton = document.getElementById("messageButton");

const WORLD = {
  width: 960,
  height: 540,
  groundY: 438,
  gravity: 2050,
  jumpVelocity: -760,
  playerSpeed: 350,
  safeWallTopDepth: 10,
};

const playerStart = { x: 90, y: WORLD.groundY - 46, size: 46 };

const levels = [
  {
    name: "Level 1",
    length: 4300,
    ground: "#252c38",
    sky: ["#10131a", "#18202c"],
    portal: { x: 4070, y: WORLD.groundY - 102, w: 46, h: 102 },
    platforms: [
      { x: 0, y: WORLD.groundY, w: 4300, h: 102 },
      { x: 1160, y: 330, w: 180, h: 32 },
      { x: 2100, y: 286, w: 210, h: 32 },
      { x: 3120, y: 344, w: 180, h: 32 },
    ],
    walls: [
      { x: 820, y: WORLD.groundY - 82, w: 40, h: 82 },
      { x: 1740, y: WORLD.groundY - 118, w: 42, h: 118 },
      { x: 2860, y: WORLD.groundY - 126, w: 48, h: 126 },
      { x: 3620, y: WORLD.groundY - 94, w: 42, h: 94 },
    ],
    spikes: [
      { x: 500, y: WORLD.groundY, size: 54 },
      { x: 1360, y: WORLD.groundY, size: 58 },
      { x: 2280, y: WORLD.groundY, size: 62 },
      { x: 3380, y: WORLD.groundY, size: 60 },
      { x: 3860, y: WORLD.groundY, size: 58 },
    ],
  },
  {
    name: "Level 2",
    length: 5600,
    ground: "#242a34",
    sky: ["#0f141b", "#1b2029"],
    portal: { x: 5350, y: WORLD.groundY - 112, w: 50, h: 112 },
    platforms: [
      { x: 0, y: WORLD.groundY, w: 5600, h: 102 },
      { x: 940, y: 318, w: 170, h: 32 },
      { x: 1660, y: 270, w: 180, h: 32 },
      { x: 2760, y: 318, w: 210, h: 32 },
      { x: 3880, y: 292, w: 210, h: 32 },
      { x: 4700, y: 330, w: 180, h: 32 },
    ],
    walls: [
      { x: 680, y: WORLD.groundY - 116, w: 42, h: 116 },
      { x: 1900, y: WORLD.groundY - 88, w: 42, h: 88 },
      { x: 3140, y: WORLD.groundY - 145, w: 46, h: 145 },
      { x: 4380, y: WORLD.groundY - 116, w: 42, h: 116 },
      { x: 5060, y: WORLD.groundY - 96, w: 42, h: 96 },
    ],
    spikes: [
      { x: 380, y: WORLD.groundY, size: 56 },
      { x: 1180, y: WORLD.groundY, size: 58 },
      { x: 2380, y: WORLD.groundY, size: 62 },
      { x: 3620, y: WORLD.groundY, size: 64 },
      { x: 4800, y: WORLD.groundY, size: 64 },
      { x: 5220, y: WORLD.groundY, size: 66 },
    ],
  },
];

const state = {
  levelIndex: 0,
  attempts: 1,
  mode: "intro",
  lastTime: 0,
  cameraX: 0,
  player: makePlayer(),
};

function makePlayer() {
  return {
    x: playerStart.x,
    y: playerStart.y,
    size: playerStart.size,
    velocityY: 0,
    grounded: true,
  };
}

function activeLevel() {
  return levels[state.levelIndex];
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(WORLD.width * dpr);
  canvas.height = Math.round(WORLD.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function setOverlay(show, kicker, title, body, buttonText) {
  overlay.classList.toggle("is-hidden", !show);
  if (!show) return;
  messageKicker.textContent = kicker;
  messageTitle.textContent = title;
  messageBody.textContent = body;
  messageButton.textContent = buttonText;
}

function updateLabels() {
  levelLabel.textContent = activeLevel().name;
  attemptLabel.textContent = String(state.attempts);
}

function startLevel(incrementAttempt = false) {
  if (incrementAttempt) state.attempts += 1;
  state.player = makePlayer();
  state.cameraX = 0;
  state.mode = "playing";
  state.lastTime = performance.now();
  setOverlay(false);
  updateLabels();
}

function showIntro() {
  state.mode = "intro";
  updateLabels();
  setOverlay(
    true,
    "Ready",
    activeLevel().name,
    "Press Space to jump. Avoid every wall and spike, then touch the portal.",
    "Start level"
  );
}

function restartLevel() {
  startLevel(true);
}

function newRun() {
  state.levelIndex = 0;
  state.attempts = 1;
  state.player = makePlayer();
  state.cameraX = 0;
  showIntro();
}

function loseLevel() {
  if (state.mode !== "playing") return;
  state.mode = "lost";
  setOverlay(
    true,
    "Crashed",
    "Try that again",
    "You hit a wall or spike. Restart this level and keep your jumps tight.",
    "Restart level"
  );
}

function completeLevel() {
  if (state.levelIndex < levels.length - 1) {
    state.levelIndex += 1;
    state.attempts = 1;
    state.player = makePlayer();
    state.cameraX = 0;
    state.mode = "intro";
    setOverlay(
      true,
      "Portal reached",
      activeLevel().name,
      "Good run. The next level is faster to read and less forgiving.",
      "Start next level"
    );
    updateLabels();
    return;
  }

  state.mode = "complete";
  setOverlay(
    true,
    "Finished",
    "Game complete",
    "You cleared both levels and reached the final portal.",
    "Play again"
  );
}

function jump() {
  if (state.mode === "intro") {
    startLevel(false);
    return;
  }

  if (state.mode === "lost") {
    restartLevel();
    return;
  }

  if (state.mode === "complete") {
    newRun();
    return;
  }

  if (state.player.grounded) {
    state.player.velocityY = WORLD.jumpVelocity;
    state.player.grounded = false;
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function pointInTriangle(px, py, a, b, c) {
  const area = (p1, p2, p3) =>
    Math.abs((p1.x * (p2.y - p3.y) + p2.x * (p3.y - p1.y) + p3.x * (p1.y - p2.y)) / 2);
  const whole = area(a, b, c);
  const sum = area({ x: px, y: py }, b, c) + area(a, { x: px, y: py }, c) + area(a, b, { x: px, y: py });
  return Math.abs(whole - sum) < 0.5;
}

function playerHitsSpike(playerRect, spike) {
  const tip = { x: spike.x + spike.size / 2, y: spike.y - spike.size };
  const left = { x: spike.x, y: spike.y };
  const right = { x: spike.x + spike.size, y: spike.y };
  const points = [
    { x: playerRect.x + 7, y: playerRect.y + 7 },
    { x: playerRect.x + playerRect.w - 7, y: playerRect.y + 7 },
    { x: playerRect.x + 7, y: playerRect.y + playerRect.h - 7 },
    { x: playerRect.x + playerRect.w - 7, y: playerRect.y + playerRect.h - 7 },
    { x: playerRect.x + playerRect.w / 2, y: playerRect.y + playerRect.h / 2 },
  ];
  return points.some((point) => pointInTriangle(point.x, point.y, tip, left, right));
}

function update(dt) {
  if (state.mode !== "playing") return;

  const level = activeLevel();
  const player = state.player;
  const previousBottom = player.y + player.size;

  player.x += WORLD.playerSpeed * dt;
  player.velocityY += WORLD.gravity * dt;
  player.y += player.velocityY * dt;
  player.grounded = false;

  for (const platform of level.platforms) {
    const playerRect = { x: player.x, y: player.y, w: player.size, h: player.size };
    const wasAbove = previousBottom <= platform.y + 6;
    const isFalling = player.velocityY >= 0;
    if (rectsOverlap(playerRect, platform) && wasAbove && isFalling) {
      player.y = platform.y - player.size;
      player.velocityY = 0;
      player.grounded = true;
    }
  }

  if (player.y > WORLD.height + 120) {
    loseLevel();
    return;
  }

  state.cameraX = Math.max(0, Math.min(player.x - 260, level.length - WORLD.width));

  let playerRect = { x: player.x + 4, y: player.y + 4, w: player.size - 8, h: player.size - 8 };

  for (const wall of level.walls) {
    const fullPlayerRect = { x: player.x, y: player.y, w: player.size, h: player.size };
    const landedOnSafeTop =
      rectsOverlap(fullPlayerRect, wall) &&
      previousBottom <= wall.y + WORLD.safeWallTopDepth &&
      player.velocityY >= 0;

    if (landedOnSafeTop) {
      player.y = wall.y - player.size;
      player.velocityY = 0;
      player.grounded = true;
      playerRect = { x: player.x + 4, y: player.y + 4, w: player.size - 8, h: player.size - 8 };
      continue;
    }

    if (rectsOverlap(playerRect, wall)) {
      loseLevel();
      return;
    }
  }

  for (const spike of level.spikes) {
    if (playerHitsSpike(playerRect, spike)) {
      loseLevel();
      return;
    }
  }

  if (rectsOverlap(playerRect, level.portal)) {
    completeLevel();
  }
}

function drawBackground(level) {
  const gradient = ctx.createLinearGradient(0, 0, 0, WORLD.height);
  gradient.addColorStop(0, level.sky[0]);
  gradient.addColorStop(1, level.sky[1]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.save();
  ctx.translate(-state.cameraX * 0.28, 0);
  ctx.fillStyle = "rgba(120, 167, 255, 0.08)";
  for (let x = -200; x < level.length + 300; x += 260) {
    ctx.fillRect(x, 96, 96, 18);
    ctx.fillRect(x + 44, 126, 154, 18);
  }
  ctx.fillStyle = "rgba(84, 214, 180, 0.07)";
  for (let x = 80; x < level.length + 300; x += 420) {
    ctx.beginPath();
    ctx.arc(x, 118, 54, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPlatform(platform, level) {
  ctx.fillStyle = level.ground;
  ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
  ctx.fillStyle = "#394252";
  ctx.fillRect(platform.x, platform.y, platform.w, 9);
}

function drawWall(wall) {
  ctx.fillStyle = "#7d8797";
  ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
  ctx.fillStyle = "#596373";
  ctx.fillRect(wall.x + 6, wall.y, 8, wall.h);
  ctx.fillStyle = "#b6c0cd";
  ctx.fillRect(wall.x, wall.y, wall.w, 8);
}

function drawSpike(spike) {
  ctx.fillStyle = "#ff5b6e";
  ctx.beginPath();
  ctx.moveTo(spike.x, spike.y);
  ctx.lineTo(spike.x + spike.size / 2, spike.y - spike.size);
  ctx.lineTo(spike.x + spike.size, spike.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#ffd1d7";
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawPortal(portal, time) {
  const pulse = Math.sin(time / 160) * 4;
  const centerX = portal.x + portal.w / 2;
  const centerY = portal.y + portal.h / 2;

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.strokeStyle = "#f6c85f";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(0, 0, portal.w / 2 + pulse, portal.h / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "#78a7ff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(0, 0, portal.w / 3, portal.h / 2 - 14 - pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "rgba(120, 167, 255, 0.18)";
  ctx.beginPath();
  ctx.ellipse(0, 0, portal.w / 2, portal.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer(player) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = "#54d6b4";
  ctx.fillRect(0, 0, player.size, player.size);
  ctx.fillStyle = "#1d806d";
  ctx.fillRect(7, 7, player.size - 14, 10);
  ctx.fillStyle = "#eafff8";
  ctx.fillRect(player.size - 14, 13, 9, 9);
  ctx.restore();
}

function drawProgress(level) {
  const progress = Math.min(1, state.player.x / level.portal.x);
  ctx.fillStyle = "rgba(238, 243, 248, 0.12)";
  ctx.fillRect(28, 28, 230, 10);
  ctx.fillStyle = "#54d6b4";
  ctx.fillRect(28, 28, 230 * progress, 10);
  ctx.fillStyle = "#eef3f8";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText(level.name, 28, 64);
}

function draw(time) {
  const level = activeLevel();
  drawBackground(level);

  ctx.save();
  ctx.translate(-state.cameraX, 0);

  for (const platform of level.platforms) drawPlatform(platform, level);
  for (const spike of level.spikes) drawSpike(spike);
  for (const wall of level.walls) drawWall(wall);
  drawPortal(level.portal, time);
  drawPlayer(state.player);

  ctx.restore();
  drawProgress(level);
}

function frame(time) {
  const dt = Math.min((time - state.lastTime) / 1000 || 0, 0.033);
  state.lastTime = time;
  update(dt);
  draw(time);
  requestAnimationFrame(frame);
}

window.addEventListener("resize", resizeCanvas);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    jump();
  }
  if (event.code === "KeyR") {
    event.preventDefault();
    restartLevel();
  }
});

canvas.addEventListener("pointerdown", jump);
messageButton.addEventListener("click", () => {
  if (state.mode === "complete") {
    newRun();
    return;
  }
  if (state.mode === "lost") {
    restartLevel();
    return;
  }
  startLevel(false);
});
restartButton.addEventListener("click", restartLevel);
newRunButton.addEventListener("click", newRun);

resizeCanvas();
showIntro();
requestAnimationFrame(frame);
