(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const ui = {
    startScreen: document.getElementById("startScreen"),
    pauseScreen: document.getElementById("pauseScreen"),
    endScreen: document.getElementById("endScreen"),
    startButton: document.getElementById("startButton"),
    resumeButton: document.getElementById("resumeButton"),
    rematchButton: document.getElementById("rematchButton"),
    playerHealth: document.getElementById("playerHealth"),
    enemyHealth: document.getElementById("enemyHealth"),
    playerShield: document.getElementById("playerShield"),
    enemyShield: document.getElementById("enemyShield"),
    roundLabel: document.getElementById("roundLabel"),
    itemName: document.getElementById("itemName"),
    itemIcon: document.getElementById("itemIcon"),
    crosshair: document.getElementById("crosshair"),
    hitMarker: document.getElementById("hitMarker"),
    damageFlash: document.getElementById("damageFlash"),
    toast: document.getElementById("toast"),
    eventFeed: document.getElementById("eventFeed"),
    resultEyebrow: document.getElementById("resultEyebrow"),
    resultTitle: document.getElementById("resultTitle"),
    resultDetail: document.getElementById("resultDetail"),
    playerScore: document.getElementById("playerScore"),
    enemyScore: document.getElementById("enemyScore")
  };

  const MAP = [
    "##################",
    "#................#",
    "#....#......#....#",
    "#....#......#....#",
    "#....#......#....#",
    "#................#",
    "#.##..........##.#",
    "#................#",
    "#......####......#",
    "#......#..#......#",
    "#......#..#......#",
    "#......####......#",
    "#................#",
    "#.##..........##.#",
    "#................#",
    "#....#......#....#",
    "#................#",
    "##################"
  ];

  const MAP_W = MAP[0].length;
  const MAP_H = MAP.length;
  const FOV = Math.PI * 0.405;
  const PLAYER_RADIUS = 0.22;
  const SHOT_COOLDOWN = 390;

  let viewW = innerWidth;
  let viewH = innerHeight;
  let deviceScale = Math.min(devicePixelRatio || 1, 2);
  let state = "menu";
  let round = 1;
  let playerScore = 0;
  let enemyScore = 0;
  let lastFrame = performance.now();
  let elapsed = 0;
  let toastTimer = 0;
  let audio = null;
  let depthBuffer = [];

  const keys = new Set();
  const particles = [];
  const tracers = [];

  const player = {
    x: 2.5,
    y: 2.5,
    angle: 0.75,
    pitch: 0,
    z: 0,
    velocityZ: 0,
    hits: 0,
    shield: 0,
    item: null,
    bob: 0,
    moveBlend: 0,
    recoil: 0,
    muzzle: 0,
    lastShot: -1000
  };

  const enemy = {
    x: 15.5,
    y: 15.5,
    hits: 0,
    shield: 0,
    flash: 0,
    muzzle: 0,
    aim: 0,
    fireDelay: 0.95,
    strafe: 1,
    changeTimer: 1.4,
    pathTimer: 0,
    path: [],
    step: 0
  };

  const pickupSeeds = [
    { x: 3.4, y: 14.7, type: "bandage" },
    { x: 14.6, y: 3.2, type: "shield" },
    { x: 5.5, y: 7.5, type: "shield" },
    { x: 12.5, y: 12.6, type: "bandage" },
    { x: 9.5, y: 6.3, type: "bandage" }
  ];

  const pickups = pickupSeeds.map((item, index) => ({
    ...item,
    active: true,
    respawn: 0,
    phase: index * 1.7
  }));

  function resize() {
    viewW = innerWidth;
    viewH = innerHeight;
    deviceScale = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewW * deviceScale);
    canvas.height = Math.floor(viewH * deviceScale);
    canvas.style.width = `${viewW}px`;
    canvas.style.height = `${viewH}px`;
    ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function wrapAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function isWall(x, y) {
    const gx = Math.floor(x);
    const gy = Math.floor(y);
    return gx < 0 || gy < 0 || gx >= MAP_W || gy >= MAP_H || MAP[gy][gx] === "#";
  }

  function canStand(x, y, radius = PLAYER_RADIUS) {
    return !isWall(x - radius, y - radius) &&
      !isWall(x + radius, y - radius) &&
      !isWall(x - radius, y + radius) &&
      !isWall(x + radius, y + radius);
  }

  function moveEntity(entity, dx, dy, radius = PLAYER_RADIUS) {
    const nx = entity.x + dx;
    const ny = entity.y + dy;
    if (canStand(nx, entity.y, radius)) entity.x = nx;
    if (canStand(entity.x, ny, radius)) entity.y = ny;
  }

  function castRay(ox, oy, angle, maxDistance = 30) {
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    let mapX = Math.floor(ox);
    let mapY = Math.floor(oy);
    const deltaX = Math.abs(1 / (Math.abs(dirX) < 0.00001 ? 0.00001 : dirX));
    const deltaY = Math.abs(1 / (Math.abs(dirY) < 0.00001 ? 0.00001 : dirY));
    const stepX = dirX < 0 ? -1 : 1;
    const stepY = dirY < 0 ? -1 : 1;
    let sideX = dirX < 0 ? (ox - mapX) * deltaX : (mapX + 1 - ox) * deltaX;
    let sideY = dirY < 0 ? (oy - mapY) * deltaY : (mapY + 1 - oy) * deltaY;
    let side = 0;
    let rayDistance = 0;

    for (let i = 0; i < 64; i += 1) {
      if (sideX < sideY) {
        mapX += stepX;
        rayDistance = sideX;
        sideX += deltaX;
        side = 0;
      } else {
        mapY += stepY;
        rayDistance = sideY;
        sideY += deltaY;
        side = 1;
      }

      if (rayDistance > maxDistance || mapX < 0 || mapY < 0 || mapX >= MAP_W || mapY >= MAP_H) break;
      if (MAP[mapY][mapX] === "#") {
        const hitX = ox + dirX * rayDistance;
        const hitY = oy + dirY * rayDistance;
        return { distance: rayDistance, side, hitX, hitY, mapX, mapY };
      }
    }

    return { distance: maxDistance, side, hitX: ox + dirX * maxDistance, hitY: oy + dirY * maxDistance, mapX, mapY };
  }

  function hasLineOfSight(a, b) {
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const targetDistance = distance(a, b);
    return castRay(a.x, a.y, angle, targetDistance + 0.1).distance >= targetDistance - 0.16;
  }

  function projectionFor(x, y, height = 1.32, z = 0) {
    const dx = x - player.x;
    const dy = y - player.y;
    const dist = Math.hypot(dx, dy);
    const relative = wrapAngle(Math.atan2(dy, dx) - player.angle);
    const projectionPlane = viewW / (2 * Math.tan(FOV / 2));
    const corrected = Math.max(0.05, dist * Math.cos(relative));
    const horizon = viewH / 2 - player.pitch * viewH * 1.18 + Math.sin(player.bob * 2) * player.moveBlend * 2;
    const scale = projectionPlane / corrected;
    const screenX = viewW / 2 + Math.tan(relative) * projectionPlane;
    const bottom = horizon + (0.55 + player.z - z) * scale;
    const spriteHeight = height * scale;
    return {
      x: screenX,
      top: bottom - spriteHeight,
      bottom,
      height: spriteHeight,
      width: spriteHeight * 0.37,
      distance: dist,
      corrected,
      relative,
      visible: corrected > 0 && Math.abs(relative) < FOV * 0.68
    };
  }

  function resetRound() {
    const swap = round % 2 === 0;
    player.x = swap ? 15.2 : 2.5;
    player.y = swap ? 2.5 : 2.5;
    enemy.x = swap ? 2.5 : 15.2;
    enemy.y = swap ? 15.2 : 15.2;
    player.angle = Math.atan2(enemy.y - player.y, enemy.x - player.x);
    player.pitch = 0;
    player.z = 0;
    player.velocityZ = 0;
    player.hits = 0;
    player.shield = 0;
    player.item = null;
    player.recoil = 0;
    player.muzzle = 0;
    player.lastShot = -1000;
    enemy.hits = 0;
    enemy.shield = 1;
    enemy.flash = 0;
    enemy.muzzle = 0;
    enemy.aim = 0;
    enemy.fireDelay = 0.95;
    enemy.strafe = Math.random() > 0.5 ? 1 : -1;
    enemy.path = [];
    enemy.pathTimer = 0;
    particles.length = 0;
    tracers.length = 0;
    pickups.forEach((pickup) => {
      pickup.active = true;
      pickup.respawn = 0;
    });
    updateHUD();
  }

  function beginGame(isNewRound = false) {
    initAudio();
    if (!isNewRound && state === "menu") resetRound();
    state = "playing";
    ui.startScreen.classList.remove("active");
    ui.pauseScreen.classList.remove("active");
    ui.endScreen.classList.remove("active");
    requestMouseLock();
    showToast("BOSS SHIELDED — KEEP MOVING.");
  }

  function requestMouseLock() {
    const request = canvas.requestPointerLock?.();
    if (request && typeof request.catch === "function") {
      request.catch(() => {
        if (state === "playing" && document.pointerLockElement !== canvas) {
          pauseGame();
          showToast("CLICK RESUME TO CAPTURE THE MOUSE");
        }
      });
    }
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    keys.clear();
    ui.pauseScreen.classList.add("active");
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    ui.pauseScreen.classList.remove("active");
    requestMouseLock();
  }

  function nextRound() {
    round += 1;
    resetRound();
    beginGame(true);
  }

  function updateHUD() {
    const pips = (hits) => Array.from({ length: 3 }, (_, index) => `<i class="${index >= 3 - hits ? "lost" : ""}"></i>`).join("");
    ui.playerHealth.innerHTML = pips(player.hits);
    ui.enemyHealth.innerHTML = pips(enemy.hits);
    ui.playerHealth.setAttribute("aria-label", `${3 - player.hits} health remaining`);
    ui.enemyHealth.setAttribute("aria-label", `${3 - enemy.hits} health remaining`);
    setShieldLabel(ui.playerShield, player.shield);
    setShieldLabel(ui.enemyShield, enemy.shield);
    ui.roundLabel.textContent = `ROUND ${String(round).padStart(2, "0")}`;

    ui.itemIcon.className = "item-icon";
    if (player.item === "bandage") {
      ui.itemName.textContent = "BANDAGE";
      ui.itemIcon.textContent = "+";
    } else if (player.item === "shield") {
      ui.itemName.textContent = "SHIELD";
      ui.itemIcon.textContent = "◇";
      ui.itemIcon.classList.add("shield-icon");
    } else {
      ui.itemName.textContent = "EMPTY";
      ui.itemIcon.textContent = "—";
      ui.itemIcon.classList.add("empty-icon");
    }
  }

  function setShieldLabel(element, amount) {
    element.textContent = amount > 0 ? `SHIELD ×${amount}` : "NO SHIELD";
    element.classList.toggle("active", amount > 0);
  }

  function showToast(message, duration = 1.65) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    toastTimer = duration;
  }

  function showEvent(message, danger = false) {
    ui.eventFeed.textContent = message;
    ui.eventFeed.style.color = danger ? "#ff654f" : "#e8ff47";
    ui.eventFeed.classList.remove("show");
    void ui.eventFeed.offsetWidth;
    ui.eventFeed.classList.add("show");
  }

  function showHitMarker(headshot = false) {
    ui.hitMarker.classList.toggle("headshot", headshot);
    ui.hitMarker.classList.add("show");
    setTimeout(() => ui.hitMarker.classList.remove("show"), 120);
  }

  function flashDamage() {
    ui.damageFlash.classList.add("show");
    setTimeout(() => ui.damageFlash.classList.remove("show"), 105);
  }

  function useItem() {
    if (state !== "playing") return;
    if (!player.item) {
      showToast("ITEM SLOT EMPTY");
      sound("error");
      return;
    }

    if (player.item === "bandage") {
      if (player.hits === 0) {
        showToast("NO WOUNDS TO BANDAGE");
        return;
      }
      player.hits -= 1;
      player.item = null;
      showEvent("BODY HIT RESTORED");
      sound("heal");
    } else if (player.item === "shield") {
      if (player.shield >= 2) {
        showToast("SHIELD ALREADY AT CAPACITY");
        return;
      }
      player.shield += 1;
      player.item = null;
      showEvent("SHIELD CHARGE ACTIVE");
      sound("shield");
    }
    updateHUD();
  }

  function firePlayerWeapon() {
    if (state !== "playing") return;
    const now = performance.now();
    if (now - player.lastShot < SHOT_COOLDOWN) return;
    player.lastShot = now;
    player.recoil = 1;
    player.muzzle = 1;
    ui.crosshair.classList.add("firing");
    setTimeout(() => ui.crosshair.classList.remove("firing"), 90);
    sound("shot");

    const target = projectionFor(enemy.x, enemy.y);
    const visible = target.visible && hasLineOfSight(player, enemy);
    const centerX = viewW / 2;
    const centerY = viewH / 2;
    let hitType = null;

    if (visible) {
      const headTop = target.top + target.height * 0.03;
      const headBottom = target.top + target.height * 0.27;
      const headHalfWidth = target.height * 0.105;
      const bodyTop = target.top + target.height * 0.23;
      const bodyHalfWidth = target.height * 0.22;

      if (centerY >= headTop && centerY <= headBottom && Math.abs(centerX - target.x) <= headHalfWidth) {
        hitType = "head";
      } else if (centerY >= bodyTop && centerY <= target.bottom && Math.abs(centerX - target.x) <= bodyHalfWidth) {
        hitType = "body";
      }
    }

    if (hitType === "head") {
      enemy.flash = 1;
      spawnHitParticles(enemy, "#ff654f", 16, 1.12);
      showHitMarker(true);
      showEvent("HEADSHOT", true);
      sound("headshot");
      endRound(true, "headshot");
    } else if (hitType === "body") {
      enemy.flash = 1;
      spawnHitParticles(enemy, enemy.shield > 0 ? "#67dfff" : "#e8ff47", 10, 0.72);
      showHitMarker(false);
      if (enemy.shield > 0) {
        enemy.shield -= 1;
        showEvent("BOSS SHIELD BROKEN");
        sound("shieldBreak");
      } else {
        enemy.hits += 1;
        showEvent(`BODY HIT ${enemy.hits}/3`);
        sound("hit");
        if (enemy.hits >= 3) endRound(true, "three body hits");
      }
      updateHUD();
    } else {
      spawnWallSpark();
    }
  }

  function enemyFires() {
    if (state !== "playing") return;
    enemy.muzzle = 1;
    enemy.aim = 0;
    enemy.fireDelay = 0.82 + Math.random() * 0.48;
    sound("enemyShot");

    const dist = distance(player, enemy);
    const movingPenalty = player.moveBlend * 0.1;
    const jumpPenalty = player.z > 0.12 ? 0.18 : 0;
    const hitChance = clamp(0.84 - dist * 0.019 - movingPenalty - jumpPenalty, 0.48, 0.78);
    const hit = Math.random() < hitChance;
    tracers.push({ life: 0.16, hit, side: Math.random() > 0.5 ? 1 : -1 });

    if (!hit) {
      sound("nearMiss");
      return;
    }

    const headChance = dist < 4 ? 0.12 : 0.06;
    if (Math.random() < headChance) {
      spawnHitParticles(player, "#ff654f", 10, 1);
      flashDamage();
      showEvent("YOU WERE HEADSHOT", true);
      sound("damage");
      endRound(false, "headshot");
      return;
    }

    flashDamage();
    if (player.shield > 0) {
      player.shield -= 1;
      showEvent("SHIELD ABSORBED THE HIT");
      sound("shieldBreak");
    } else {
      player.hits += 1;
      showEvent(`YOU TOOK A BODY HIT ${player.hits}/3`, true);
      sound("damage");
      if (player.hits >= 3) endRound(false, "three body hits");
    }
    updateHUD();
  }

  function endRound(playerWon, reason) {
    if (state === "ended") return;
    state = "ended";
    keys.clear();
    if (playerWon) playerScore += 1;
    else enemyScore += 1;
    ui.playerScore.textContent = playerScore;
    ui.enemyScore.textContent = enemyScore;
    ui.resultEyebrow.textContent = playerWon ? "ROUND SECURED" : "ROUND LOST";
    ui.resultTitle.textContent = playerWon ? "VICTORY." : "DEFEAT.";
    ui.resultTitle.style.color = playerWon ? "#f3f0e8" : "#ff654f";
    ui.resultDetail.textContent = playerWon
      ? `Boss eliminated by ${reason}.`
      : `You were eliminated by ${reason}.`;
    ui.rematchButton.firstChild.textContent = "NEXT ROUND ";
    sound(playerWon ? "win" : "lose");
    setTimeout(() => {
      document.exitPointerLock?.();
      ui.endScreen.classList.add("active");
    }, 620);
  }

  function updatePlayer(dt) {
    const forward = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    const strafe = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
    const magnitude = Math.hypot(forward, strafe);
    const moving = magnitude > 0;

    if (moving) {
      const speed = 2.75 * dt / Math.max(1, magnitude);
      const dx = (Math.cos(player.angle) * forward + Math.cos(player.angle + Math.PI / 2) * strafe) * speed;
      const dy = (Math.sin(player.angle) * forward + Math.sin(player.angle + Math.PI / 2) * strafe) * speed;
      const oldX = player.x;
      const oldY = player.y;
      moveEntity(player, dx, dy);
      if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < 0.75) {
        player.x = oldX;
        player.y = oldY;
      }
      player.bob += dt * 8.6;
    }

    player.moveBlend += ((moving ? 1 : 0) - player.moveBlend) * Math.min(1, dt * 8);
    player.recoil = Math.max(0, player.recoil - dt * 5.5);
    player.muzzle = Math.max(0, player.muzzle - dt * 12);

    if (player.z > 0 || player.velocityZ > 0) {
      player.velocityZ -= 11.8 * dt;
      player.z += player.velocityZ * dt;
      if (player.z <= 0) {
        player.z = 0;
        player.velocityZ = 0;
        sound("land");
      }
    }

    for (const pickup of pickups) {
      if (!pickup.active || player.z > 0.32 || Math.hypot(player.x - pickup.x, player.y - pickup.y) > 0.57) continue;
      if (player.item) {
        showToast(`SLOT FULL — USE ${player.item.toUpperCase()} FIRST`, 0.7);
        continue;
      }
      player.item = pickup.type;
      pickup.active = false;
      pickup.respawn = 13;
      showEvent(`${pickup.type.toUpperCase()} ACQUIRED`);
      sound("pickup");
      updateHUD();
    }
  }

  function findPath(startX, startY, targetX, targetY) {
    const start = [Math.floor(startX), Math.floor(startY)];
    const goal = [Math.floor(targetX), Math.floor(targetY)];
    const queue = [start];
    const visited = new Map([[`${start[0]},${start[1]}`, null]]);
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (queue.length) {
      const current = queue.shift();
      if (current[0] === goal[0] && current[1] === goal[1]) break;
      for (const [dx, dy] of directions) {
        const nx = current[0] + dx;
        const ny = current[1] + dy;
        const key = `${nx},${ny}`;
        if (nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H || MAP[ny][nx] === "#" || visited.has(key)) continue;
        visited.set(key, current);
        queue.push([nx, ny]);
      }
    }

    const path = [];
    let cursor = goal;
    let guard = 0;
    while (cursor && guard < 100) {
      path.unshift({ x: cursor[0] + 0.5, y: cursor[1] + 0.5 });
      cursor = visited.get(`${cursor[0]},${cursor[1]}`);
      guard += 1;
    }
    path.shift();
    return path;
  }

  function updateEnemy(dt) {
    const recoveryTarget = enemy.hits >= 2
      ? pickups
        .filter((pickup) => pickup.active && pickup.type === "bandage")
        .sort((a, b) => distance(enemy, a) - distance(enemy, b))[0]
      : null;
    const tacticalTarget = recoveryTarget || player;
    const los = !recoveryTarget && hasLineOfSight(enemy, player);
    const dist = distance(enemy, player);
    let moveX = 0;
    let moveY = 0;
    enemy.changeTimer -= dt;
    enemy.pathTimer -= dt;
    enemy.step += dt * 7.5;
    enemy.flash = Math.max(0, enemy.flash - dt * 5);
    enemy.muzzle = Math.max(0, enemy.muzzle - dt * 11);

    if (enemy.changeTimer <= 0) {
      enemy.strafe *= Math.random() > 0.16 ? -1 : 1;
      enemy.changeTimer = 0.62 + Math.random() * 0.85;
    }

    if (los) {
      const towardX = (player.x - enemy.x) / Math.max(0.1, dist);
      const towardY = (player.y - enemy.y) / Math.max(0.1, dist);
      const approach = dist > 6.2 ? 0.82 : dist < 3.4 ? -0.9 : 0.06;
      moveX = towardX * approach + -towardY * enemy.strafe * 0.94;
      moveY = towardY * approach + towardX * enemy.strafe * 0.94;

      enemy.aim += dt;
      if (enemy.aim >= enemy.fireDelay) enemyFires();
    } else {
      enemy.aim = Math.max(0, enemy.aim - dt * 0.7);
      if (enemy.pathTimer <= 0 || enemy.path.length === 0) {
        enemy.path = findPath(enemy.x, enemy.y, tacticalTarget.x, tacticalTarget.y);
        enemy.pathTimer = recoveryTarget ? 0.35 : 0.55;
      }
      const waypoint = enemy.path[0];
      if (waypoint) {
        const waypointDistance = Math.hypot(waypoint.x - enemy.x, waypoint.y - enemy.y);
        if (waypointDistance < 0.22) enemy.path.shift();
        else {
          moveX = (waypoint.x - enemy.x) / waypointDistance;
          moveY = (waypoint.y - enemy.y) / waypointDistance;
        }
      }
    }

    const moveLength = Math.hypot(moveX, moveY);
    if (moveLength > 0 && dist > 0.78) {
      const speed = (recoveryTarget ? 2.05 : 1.9) * dt / Math.max(1, moveLength);
      moveEntity(enemy, moveX * speed, moveY * speed, 0.2);
    }

    for (const pickup of pickups) {
      if (!pickup.active || Math.hypot(enemy.x - pickup.x, enemy.y - pickup.y) > 0.48) continue;
      if (pickup.type === "bandage" && enemy.hits > 0) {
        enemy.hits -= 1;
        pickup.active = false;
        pickup.respawn = 13;
        showEvent("BOSS USED A BANDAGE", true);
        sound("enemyPickup");
        updateHUD();
      } else if (pickup.type === "shield" && enemy.shield < 1) {
        enemy.shield += 1;
        pickup.active = false;
        pickup.respawn = 13;
        showEvent("BOSS CLAIMED A SHIELD", true);
        sound("enemyPickup");
        updateHUD();
      }
    }
  }

  function updatePickups(dt) {
    for (const pickup of pickups) {
      if (!pickup.active) {
        pickup.respawn -= dt;
        if (pickup.respawn <= 0) pickup.active = true;
      }
    }
  }

  function updateEffects(dt) {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.z += particle.vz * dt;
      particle.vz -= dt * 1.8;
      if (particle.life <= 0) particles.splice(index, 1);
    }
    for (let index = tracers.length - 1; index >= 0; index -= 1) {
      tracers[index].life -= dt;
      if (tracers[index].life <= 0) tracers.splice(index, 1);
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) ui.toast.classList.remove("show");
    }
  }

  function update(dt) {
    elapsed += dt;
    updateEffects(dt);
    if (state !== "playing") return;
    updatePlayer(dt);
    updateEnemy(dt);
    updatePickups(dt);
  }

  function drawArena() {
    const horizon = clamp(viewH / 2 - player.pitch * viewH * 1.18 + Math.sin(player.bob * 2) * player.moveBlend * 2, -viewH * 0.1, viewH * 1.1);
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(1, horizon));
    sky.addColorStop(0, "#253237");
    sky.addColorStop(0.72, "#7d8b86");
    sky.addColorStop(1, "#bac0b2");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewW, Math.max(0, horizon));

    const ground = ctx.createLinearGradient(0, horizon, 0, viewH);
    ground.addColorStop(0, "#525751");
    ground.addColorStop(0.17, "#363b39");
    ground.addColorStop(1, "#171c1e");
    ctx.fillStyle = ground;
    ctx.fillRect(0, Math.max(0, horizon), viewW, viewH - horizon);

    drawSkyDetails(horizon);
    drawFloorLines(horizon);

    const strip = viewW > 1000 ? 2 : 3;
    const columns = Math.ceil(viewW / strip);
    depthBuffer = new Float32Array(columns);
    const projectionPlane = viewW / (2 * Math.tan(FOV / 2));

    for (let column = 0; column < columns; column += 1) {
      const x = column * strip;
      const cameraX = (x + strip * 0.5 - viewW / 2) / projectionPlane;
      const rayOffset = Math.atan(cameraX);
      const ray = castRay(player.x, player.y, player.angle + rayOffset);
      const corrected = Math.max(0.02, ray.distance * Math.cos(rayOffset));
      depthBuffer[column] = corrected;
      const wallHeight = viewH * 0.92 / corrected;
      const top = horizon - wallHeight / 2 + player.z * wallHeight;
      const shade = clamp(1 - corrected / 23, 0.34, 0.96) * (ray.side ? 0.82 : 1);
      const hitAxis = ray.side ? ray.hitX : ray.hitY;
      const panel = Math.floor(hitAxis * 2) % 2;
      const base = panel ? 117 : 127;
      const r = Math.floor(base * shade);
      const g = Math.floor((base + 7) * shade);
      const b = Math.floor((base + 4) * shade);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, top, strip + 1, wallHeight);

      if (Math.abs(hitAxis - Math.round(hitAxis)) < 0.025 / Math.max(0.3, corrected)) {
        ctx.fillStyle = `rgba(20,24,25,${0.18 * shade})`;
        ctx.fillRect(x, top, strip + 1, wallHeight);
      }
      ctx.fillStyle = `rgba(230,236,220,${0.08 * shade})`;
      ctx.fillRect(x, top + wallHeight * 0.49, strip + 1, Math.max(1, wallHeight * 0.008));
    }
  }

  function drawSkyDetails(horizon) {
    const sunAngle = wrapAngle(-0.9 - player.angle);
    if (Math.abs(sunAngle) < FOV * 0.72) {
      const projectionPlane = viewW / (2 * Math.tan(FOV / 2));
      const sunX = viewW / 2 + Math.tan(sunAngle) * projectionPlane;
      const sunY = horizon * 0.42;
      const glow = ctx.createRadialGradient(sunX, sunY, 2, sunX, sunY, 85);
      glow.addColorStop(0, "rgba(244,255,189,0.8)");
      glow.addColorStop(0.18, "rgba(232,255,71,0.25)");
      glow.addColorStop(1, "rgba(232,255,71,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sunX - 90, sunY - 90, 180, 180);
      ctx.fillStyle = "rgba(242,255,184,0.76)";
      ctx.fillRect(sunX - 7, sunY - 7, 14, 14);
    }

    ctx.fillStyle = "rgba(15,22,24,0.12)";
    for (let i = 0; i < 4; i += 1) {
      const y = horizon * (0.2 + i * 0.13);
      const drift = wrapAngle(player.angle * 0.16) * 110;
      ctx.fillRect((i * 311 - drift) % (viewW + 300) - 100, y, 270 + i * 40, 2 + i);
    }
  }

  function drawFloorLines(horizon) {
    if (horizon >= viewH) return;
    ctx.save();
    ctx.strokeStyle = "rgba(220,230,216,0.055)";
    ctx.lineWidth = 1;
    for (let i = 1; i <= 7; i += 1) {
      const t = i / 7;
      const y = horizon + (viewH - horizon) * t * t;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(viewW, y);
      ctx.stroke();
    }
    for (let i = -5; i <= 5; i += 1) {
      ctx.beginPath();
      ctx.moveTo(viewW / 2 + i * 22, horizon);
      ctx.lineTo(viewW / 2 + i * viewW * 0.18, viewH);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy() {
    const projected = projectionFor(enemy.x, enemy.y);
    if (!projected.visible || !hasLineOfSight(player, enemy) || projected.height < 4) return;
    if (projected.x + projected.width < 0 || projected.x - projected.width > viewW) return;

    const h = projected.height;
    const x = projected.x;
    const top = projected.top;
    const bottom = projected.bottom;
    const w = h * 0.36;
    const facing = Math.atan2(player.y - enemy.y, player.x - enemy.x);
    const walk = Math.sin(enemy.step) * h * 0.018;
    const isAiming = enemy.aim > enemy.fireDelay - 0.38;

    ctx.save();
    ctx.globalAlpha = clamp(1.15 - projected.distance / 34, 0.58, 1);
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.ellipse(x, bottom, w * 0.67, h * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();

    const suit = enemy.flash > 0 ? "#f7f4e9" : "#d6503f";
    const suitDark = enemy.flash > 0 ? "#dcdccf" : "#7e302d";
    const trim = "#171c1f";

    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1, h * 0.072);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - w * 0.17, top + h * 0.65);
    ctx.lineTo(x - w * 0.23 + walk, bottom - h * 0.04);
    ctx.moveTo(x + w * 0.17, top + h * 0.65);
    ctx.lineTo(x + w * 0.23 - walk, bottom - h * 0.04);
    ctx.stroke();

    ctx.fillStyle = suit;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.39, top + h * 0.29);
    ctx.lineTo(x + w * 0.38, top + h * 0.29);
    ctx.lineTo(x + w * 0.29, top + h * 0.67);
    ctx.lineTo(x - w * 0.28, top + h * 0.67);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = suitDark;
    ctx.fillRect(x - w * 0.06, top + h * 0.3, w * 0.12, h * 0.36);
    ctx.fillStyle = "rgba(232,255,71,0.82)";
    ctx.fillRect(x - w * 0.25, top + h * 0.37, w * 0.5, Math.max(1, h * 0.018));

    ctx.strokeStyle = suitDark;
    ctx.lineWidth = Math.max(1, h * 0.085);
    ctx.beginPath();
    ctx.moveTo(x - w * 0.3, top + h * 0.36);
    ctx.lineTo(x - w * 0.47, top + h * 0.58);
    ctx.moveTo(x + w * 0.3, top + h * 0.36);
    ctx.lineTo(x + w * 0.57, top + h * 0.5);
    ctx.stroke();

    ctx.fillStyle = enemy.flash > 0 ? "#fffdf1" : "#d7ad8f";
    ctx.beginPath();
    ctx.arc(x, top + h * 0.17, h * 0.105, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = trim;
    ctx.fillRect(x - h * 0.105, top + h * 0.15, h * 0.21, h * 0.045);
    ctx.fillStyle = "#e8ff47";
    ctx.fillRect(x - h * 0.07, top + h * 0.163, h * 0.14, Math.max(1, h * 0.012));

    const gunX = x + w * 0.65;
    const gunY = top + h * 0.48;
    ctx.strokeStyle = "#111719";
    ctx.lineWidth = Math.max(2, h * 0.032);
    ctx.beginPath();
    ctx.moveTo(x + w * 0.35, gunY);
    ctx.lineTo(gunX, gunY - h * 0.04);
    ctx.stroke();

    if (isAiming && enemy.muzzle <= 0) {
      const glow = ctx.createRadialGradient(gunX, gunY, 0, gunX, gunY, h * 0.09);
      glow.addColorStop(0, "rgba(255,101,79,0.95)");
      glow.addColorStop(1, "rgba(255,101,79,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(gunX - h * 0.1, gunY - h * 0.1, h * 0.2, h * 0.2);
    }

    if (enemy.muzzle > 0) {
      ctx.fillStyle = `rgba(255,238,145,${enemy.muzzle})`;
      ctx.beginPath();
      ctx.moveTo(gunX, gunY);
      ctx.lineTo(gunX + h * 0.22, gunY - h * 0.07);
      ctx.lineTo(gunX + h * 0.15, gunY + h * 0.08);
      ctx.closePath();
      ctx.fill();
    }

    if (enemy.shield > 0) {
      ctx.strokeStyle = "rgba(103,223,255,0.66)";
      ctx.lineWidth = Math.max(1, h * 0.012);
      ctx.beginPath();
      ctx.ellipse(x, top + h * 0.48, w * 0.68, h * 0.47, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (projected.distance < 9) {
      const barW = w * 0.85;
      const barY = top - Math.max(8, h * 0.08);
      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = i < 3 - enemy.hits ? "#f3f0e8" : "rgba(255,255,255,0.18)";
        ctx.fillRect(x - barW / 2 + i * (barW / 3), barY, barW / 3 - 2, Math.max(2, h * 0.017));
      }
    }
    ctx.restore();
    void facing;
  }

  function drawPickups() {
    const visible = pickups
      .filter((pickup) => pickup.active)
      .map((pickup) => ({ pickup, projection: projectionFor(pickup.x, pickup.y, 0.38, 0.04 + Math.sin(elapsed * 2.2 + pickup.phase) * 0.025) }))
      .filter(({ pickup, projection }) => projection.visible && projection.height > 3 && hasLineOfSight(player, pickup))
      .sort((a, b) => b.projection.distance - a.projection.distance);

    for (const { pickup, projection } of visible) {
      const x = projection.x;
      const y = projection.top + projection.height * 0.48;
      const size = projection.height * 0.52;
      const color = pickup.type === "shield" ? "#67dfff" : "#e8ff47";
      ctx.save();
      const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 1.4);
      glow.addColorStop(0, `${color}55`);
      glow.addColorStop(1, `${color}00`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - size * 1.5, y - size * 1.5, size * 3, size * 3);
      ctx.strokeStyle = color;
      ctx.fillStyle = "rgba(15,20,22,0.88)";
      ctx.lineWidth = Math.max(1.5, size * 0.05);

      if (pickup.type === "shield") {
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.55);
        ctx.lineTo(x + size * 0.46, y - size * 0.26);
        ctx.lineTo(x + size * 0.35, y + size * 0.35);
        ctx.lineTo(x, y + size * 0.58);
        ctx.lineTo(x - size * 0.35, y + size * 0.35);
        ctx.lineTo(x - size * 0.46, y - size * 0.26);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y - size * 0.37);
        ctx.lineTo(x, y + size * 0.35);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.roundRect(x - size * 0.52, y - size * 0.38, size * 1.04, size * 0.76, size * 0.12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillRect(x - size * 0.08, y - size * 0.27, size * 0.16, size * 0.54);
        ctx.fillRect(x - size * 0.27, y - size * 0.08, size * 0.54, size * 0.16);
      }

      if (projection.distance < 2.2) {
        ctx.fillStyle = color;
        ctx.font = `700 ${clamp(size * 0.2, 9, 13)}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(pickup.type.toUpperCase(), x, y - size * 0.8);
      }
      ctx.restore();
    }
  }

  function spawnHitParticles(target, color, count, z) {
    for (let i = 0; i < count; i += 1) {
      particles.push({
        x: target.x + (Math.random() - 0.5) * 0.25,
        y: target.y + (Math.random() - 0.5) * 0.25,
        z: z + (Math.random() - 0.5) * 0.18,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        vz: Math.random() * 0.8,
        life: 0.35 + Math.random() * 0.3,
        maxLife: 0.65,
        color
      });
    }
  }

  function spawnWallSpark() {
    const ray = castRay(player.x, player.y, player.angle);
    const target = { x: ray.hitX, y: ray.hitY };
    spawnHitParticles(target, "#f5e6a8", 5, 0.55);
  }

  function drawParticles() {
    const sorted = particles.slice().sort((a, b) => distance(player, b) - distance(player, a));
    for (const particle of sorted) {
      const projected = projectionFor(particle.x, particle.y, 0.02, particle.z);
      if (!projected.visible) continue;
      ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
      ctx.fillStyle = particle.color;
      const radius = clamp(60 / Math.max(1, projected.distance), 1.5, 7);
      ctx.fillRect(projected.x - radius / 2, projected.bottom - radius / 2, radius, radius);
    }
    ctx.globalAlpha = 1;
  }

  function drawTracers() {
    for (const tracer of tracers) {
      const alpha = clamp(tracer.life / 0.16, 0, 1);
      const endX = tracer.hit ? viewW / 2 : viewW / 2 + tracer.side * viewW * 0.32;
      const endY = tracer.hit ? viewH / 2 : viewH * (0.35 + Math.random() * 0.25);
      ctx.save();
      ctx.strokeStyle = `rgba(255,115,80,${alpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(endX + tracer.side * 40, endY - 30);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawWeapon() {
    const scale = clamp(Math.min(viewW / 1100, viewH / 760), 0.72, 1.18);
    const bobX = Math.sin(player.bob) * player.moveBlend * 7;
    const bobY = Math.abs(Math.cos(player.bob)) * player.moveBlend * 6;
    const recoilY = player.recoil * 30;
    const recoilAngle = player.recoil * -0.09;
    const x = viewW * 0.58 + bobX;
    const y = viewH + 16 + bobY + recoilY;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(recoilAngle);
    ctx.scale(scale, scale);

    ctx.fillStyle = "rgba(0,0,0,0.24)";
    ctx.beginPath();
    ctx.ellipse(-20, -75, 130, 80, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#b88665";
    ctx.beginPath();
    ctx.moveTo(26, -92);
    ctx.lineTo(105, -66);
    ctx.lineTo(153, 25);
    ctx.lineTo(49, 25);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#20272a";
    ctx.beginPath();
    ctx.moveTo(-43, -151);
    ctx.lineTo(40, -151);
    ctx.lineTo(69, -46);
    ctx.lineTo(13, -31);
    ctx.lineTo(-7, -97);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#0e1315";
    ctx.fillRect(-82, -181, 128, 38);
    ctx.fillStyle = "#3f494b";
    ctx.fillRect(-73, -174, 116, 8);
    ctx.fillStyle = "#889092";
    ctx.fillRect(-64, -183, 71, 4);
    ctx.fillStyle = "#e8ff47";
    ctx.fillRect(-10, -187, 14, 5);

    ctx.fillStyle = "#151b1d";
    ctx.beginPath();
    ctx.arc(5, -140, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#566063";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(5, -140, 20, 0, Math.PI * 2);
    ctx.stroke();

    if (player.muzzle > 0) {
      ctx.globalAlpha = player.muzzle;
      ctx.fillStyle = "#fff1a5";
      ctx.beginPath();
      ctx.moveTo(-86, -162);
      ctx.lineTo(-152, -200);
      ctx.lineTo(-126, -157);
      ctx.lineTo(-165, -126);
      ctx.lineTo(-84, -146);
      ctx.closePath();
      ctx.fill();
      const glow = ctx.createRadialGradient(-90, -158, 0, -90, -158, 75);
      glow.addColorStop(0, "rgba(255,237,139,0.55)");
      glow.addColorStop(1, "rgba(255,237,139,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(-170, -238, 160, 160);
    }
    ctx.restore();
  }

  function drawRadar() {
    if (viewW < 720 || viewH < 540) return;
    const size = 116;
    const x = viewW - size - 24;
    const y = viewH - size - 62;
    const cell = size / MAP_W;
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.fillStyle = "rgba(8,12,14,0.62)";
    ctx.fillRect(x - 6, y - 18, size + 12, size + 24);
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    for (let gy = 0; gy < MAP_H; gy += 1) {
      for (let gx = 0; gx < MAP_W; gx += 1) {
        if (MAP[gy][gx] === "#") ctx.fillRect(x + gx * cell, y + gy * cell, cell + 0.2, cell + 0.2);
      }
    }
    for (const pickup of pickups) {
      if (!pickup.active) continue;
      ctx.fillStyle = pickup.type === "shield" ? "#67dfff" : "#e8ff47";
      ctx.fillRect(x + pickup.x * cell - 1, y + pickup.y * cell - 1, 3, 3);
    }
    ctx.translate(x + player.x * cell, y + player.y * cell);
    ctx.rotate(player.angle);
    ctx.fillStyle = "#f3f0e8";
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.lineTo(-4, -3.5);
    ctx.lineTo(-4, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = "#f3f0e8";
    ctx.font = "700 9px Inter, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("ARENA MAP", x, y - 7);
    ctx.restore();
  }

  function render() {
    ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    drawArena();
    drawPickups();
    drawEnemy();
    drawParticles();
    drawTracers();
    drawWeapon();
    drawRadar();

    const vignette = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.24, viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.72);
    vignette.addColorStop(0, "rgba(0,0,0,0)");
    vignette.addColorStop(1, "rgba(2,5,6,0.52)");
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, viewW, viewH);
  }

  function initAudio() {
    if (audio) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audio = new AudioContext();
  }

  function tone(frequency, duration, volume, type = "sine", slide = 0) {
    if (!audio) return;
    const start = audio.currentTime;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(35, frequency + slide), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function noise(duration, volume, highpass = 100) {
    if (!audio) return;
    const length = Math.floor(audio.sampleRate * duration);
    const buffer = audio.createBuffer(1, length, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = audio.createBufferSource();
    const filter = audio.createBiquadFilter();
    const gain = audio.createGain();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    source.buffer = buffer;
    source.connect(filter).connect(gain).connect(audio.destination);
    source.start();
  }

  function sound(name) {
    if (!audio) return;
    if (audio.state === "suspended") audio.resume();
    switch (name) {
      case "shot":
        noise(0.13, 0.28, 220);
        tone(125, 0.16, 0.25, "sawtooth", -70);
        break;
      case "enemyShot":
        noise(0.11, 0.18, 400);
        tone(170, 0.12, 0.12, "square", -80);
        break;
      case "hit": tone(420, 0.08, 0.1, "square", -160); break;
      case "headshot":
        tone(760, 0.08, 0.14, "square", 280);
        setTimeout(() => tone(1040, 0.12, 0.1, "sine", 180), 55);
        break;
      case "damage": tone(82, 0.24, 0.22, "sawtooth", -36); break;
      case "nearMiss": noise(0.12, 0.08, 1600); break;
      case "pickup":
      case "heal":
        tone(520, 0.1, 0.1, "sine", 180);
        setTimeout(() => tone(720, 0.12, 0.08, "sine", 120), 80);
        break;
      case "shield": tone(300, 0.3, 0.11, "sine", 480); break;
      case "shieldBreak":
        noise(0.18, 0.11, 900);
        tone(470, 0.22, 0.1, "square", -330);
        break;
      case "enemyPickup": tone(220, 0.15, 0.05, "sine", 90); break;
      case "jump": tone(150, 0.12, 0.065, "sine", 90); break;
      case "land": tone(80, 0.08, 0.055, "sine", -25); break;
      case "win":
        tone(330, 0.2, 0.12, "sine", 100);
        setTimeout(() => tone(520, 0.34, 0.12, "sine", 160), 170);
        break;
      case "lose": tone(170, 0.45, 0.14, "sawtooth", -90); break;
      case "error": tone(120, 0.08, 0.05, "square", -20); break;
      default: break;
    }
  }

  function loop(now) {
    const dt = Math.min(0.035, (now - lastFrame) / 1000 || 0);
    lastFrame = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  addEventListener("resize", resize);
  addEventListener("keydown", (event) => {
    if (["KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    }
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat && state === "playing" && player.z === 0) {
        player.velocityZ = 3.2;
        sound("jump");
      }
    }
  });
  addEventListener("keyup", (event) => keys.delete(event.code));
  addEventListener("blur", () => keys.clear());
  addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== canvas || state !== "playing") return;
    player.angle = wrapAngle(player.angle + event.movementX * 0.0022);
    player.pitch = clamp(player.pitch + event.movementY * 0.00145, -0.34, 0.34);
  });
  addEventListener("mousedown", (event) => {
    if (document.pointerLockElement !== canvas || state !== "playing") return;
    if (event.button === 0) firePlayerWeapon();
    if (event.button === 2) useItem();
  });
  addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement !== canvas && state === "playing") pauseGame();
  });

  ui.startButton.addEventListener("click", () => beginGame(false));
  ui.resumeButton.addEventListener("click", resumeGame);
  ui.rematchButton.addEventListener("click", nextRound);
  canvas.addEventListener("click", () => {
    if (state === "playing" && document.pointerLockElement !== canvas) requestMouseLock();
  });

  resize();
  resetRound();
  requestAnimationFrame(loop);
})();
