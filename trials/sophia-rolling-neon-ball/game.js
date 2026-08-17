(() => {
  "use strict";

  const canvas = document.querySelector("#game-canvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.querySelector("#overlay");
  const overlayKicker = document.querySelector("#overlay-kicker");
  const overlayTitle = document.querySelector("#overlay-title");
  const overlayCopy = document.querySelector("#overlay-copy");
  const instructionGrid = document.querySelector("#instruction-grid");
  const primaryButton = document.querySelector("#primary-button");
  const modalFootnote = document.querySelector("#modal-footnote");
  const restartButton = document.querySelector("#restart-button");
  const toast = document.querySelector("#toast");
  const levelNumber = document.querySelector("#level-number");
  const levelDots = document.querySelector("#level-dots");
  const levelKicker = document.querySelector("#level-kicker");
  const levelName = document.querySelector("#level-name");
  const checkpointLabel = document.querySelector("#checkpoint-label");

  const BALL_RADIUS = 17;
  const GRAVITY = 720;
  const keys = Object.create(null);
  const particles = [];
  const ambientDots = [];
  const camera = { x: 0, z: -300, y: 135 };
  const player = {
    x: 0, z: 20, y: BALL_RADIUS,
    vx: 0, vz: 0, vy: 0,
    grounded: true, roll: 0, invulnerable: 0,
  };

  let viewportWidth = 0;
  let viewportHeight = 0;
  let pixelRatio = 1;
  let focalLength = 760;
  let horizon = 210;
  let state = "intro";
  let currentLevelIndex = 0;
  let currentLevel = null;
  let lastCheckpoint = -1;
  let elapsed = 0;
  let lastTime = performance.now();
  let deathTimer = 0;
  let transitionTimer = 0;
  let toastTimer = 0;
  let screenFlash = 0;

  const node = (z, x, width, y) => ({ z, x, width, y });
  const axe = (z, reach, speed, phase = 0) => ({ z, reach, speed, phase });

  const levels = [
    {
      name: "Neon Highline", kicker: "CHASE THE HORIZON",
      accent: "#42f4ff", accent2: "#ff4fd8", deck: "#176fb1", deckDark: "#0a2d67",
      skyTop: "#1b0752", skyBottom: "#031b48", glow: "#973bff", startZ: 20,
      path: [
        node(-260, 0, 245, 0), node(320, 0, 235, 0), node(760, 105, 220, -10),
        node(1240, -90, 205, -125), node(1680, -135, 195, -125),
        node(2140, 75, 185, -220), node(2580, 130, 175, -220),
        node(2950, -45, 170, -315), node(3340, 0, 235, -315),
      ],
      checkpoints: [{ z: 1100, spawnZ: 1040 }, { z: 2300, spawnZ: 2240 }],
      hazards: [axe(690, 92, 1.75, 0.2), axe(1650, 82, 2.05, 2.1), axe(2730, 76, 2.35, 4.3)],
      finish: { z: 3260 },
    },
    {
      name: "Prism Crosswind", kicker: "HOLD THE CURVE",
      accent: "#6dff8b", accent2: "#2de2ff", deck: "#178b76", deckDark: "#074a61",
      skyTop: "#071f4d", skyBottom: "#032932", glow: "#00f0b5", startZ: 20,
      path: [
        node(-260, 0, 225, 0), node(360, -80, 210, 0), node(820, -165, 195, -90),
        node(1320, 95, 180, -165), node(1780, 145, 170, -165),
        node(2260, -100, 158, -285), node(2740, -170, 150, -285),
        node(3220, 120, 145, -410), node(3630, 50, 142, -410), node(4040, 0, 220, -465),
      ],
      checkpoints: [{ z: 1270, spawnZ: 1210 }, { z: 2660, spawnZ: 2600 }],
      hazards: [axe(600, 86, 2, 0.3), axe(1510, 76, 2.35, 2.4), axe(2050, 72, 2.5, 4.6), axe(2940, 67, 2.7, 1.2), axe(3540, 64, 2.85, 3.8)],
      finish: { z: 3960 },
    },
    {
      name: "Ultraviolet Switchback", kicker: "TRUST THE MOMENTUM",
      accent: "#a477ff", accent2: "#ff4bbd", deck: "#633fc4", deckDark: "#281b71",
      skyTop: "#36054f", skyBottom: "#07133f", glow: "#ff3ea5", startZ: 20,
      path: [
        node(-260, 0, 215, 0), node(380, 90, 195, 0), node(820, 185, 178, -105),
        node(1280, -110, 165, -105), node(1760, -190, 150, -235),
        node(2200, 125, 142, -235), node(2680, 205, 135, -365),
        node(3170, -145, 130, -365), node(3600, -210, 125, -505),
        node(4040, 130, 120, -505), node(4480, 0, 205, -590),
      ],
      checkpoints: [{ z: 1410, spawnZ: 1350 }, { z: 3020, spawnZ: 2960 }],
      hazards: [axe(670, 80, 2.2, 0.5), axe(1500, 70, 2.55, 2.6), axe(2110, 65, 2.7, 4.4), axe(2810, 62, 2.9, 1.4), axe(3490, 59, 3.05, 3.5), axe(4140, 56, 3.2, 5.2)],
      finish: { z: 4400 },
    },
    {
      name: "Solar Gauntlet", kicker: "OUTRUN THE SUN",
      accent: "#ffe45d", accent2: "#ff437e", deck: "#e45d2d", deckDark: "#7c1c4d",
      skyTop: "#4d073d", skyBottom: "#161050", glow: "#ff5b45", startZ: 20,
      path: [
        node(-260, 0, 205, 0), node(350, -95, 185, 0), node(780, 115, 168, -100),
        node(1220, 195, 152, -100), node(1660, -150, 142, -245),
        node(2100, -220, 132, -245), node(2540, 145, 125, -390),
        node(2990, 220, 118, -390), node(3420, -180, 112, -540),
        node(3850, -230, 108, -540), node(4280, 165, 105, -700),
        node(4700, 220, 102, -700), node(5200, 0, 205, -825),
      ],
      checkpoints: [{ z: 1320, spawnZ: 1260 }, { z: 2780, spawnZ: 2720 }, { z: 4240, spawnZ: 4180 }],
      hazards: [axe(590, 75, 2.45, 0.4), axe(1450, 66, 2.75, 2.3), axe(1990, 60, 2.95, 4.6), axe(2630, 56, 3.1, 1.1), axe(3230, 52, 3.3, 3.2), axe(3790, 49, 3.45, 5), axe(4380, 47, 3.65, 2), axe(4860, 46, 3.8, 4.1)],
      finish: { z: 5100 },
    },
  ];

  function resize() {
    viewportWidth = window.innerWidth;
    viewportHeight = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(viewportWidth * pixelRatio);
    canvas.height = Math.round(viewportHeight * pixelRatio);
    focalLength = Math.min(790, viewportWidth * 0.92);
    horizon = viewportHeight * 0.29;
  }

  function seedAmbientDots() {
    let seed = 4283;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let index = 0; index < 140; index += 1) {
      ambientDots.push({ x: random(), y: random(), size: 0.5 + random() * 1.7, alpha: 0.15 + random() * 0.55, drift: 0.2 + random() * 0.8 });
    }
  }

  const smoothStep = (value) => value * value * (3 - 2 * value);
  const lerp = (from, to, amount) => from + (to - from) * amount;

  function trackSampleAt(z) {
    const path = currentLevel.path;
    if (z < path[0].z || z > path[path.length - 1].z) return null;
    for (let index = 0; index < path.length - 1; index += 1) {
      const from = path[index];
      const to = path[index + 1];
      if (z > to.z) continue;
      const raw = (z - from.z) / (to.z - from.z);
      const amount = smoothStep(raw);
      const derivative = (6 * raw * (1 - raw)) / (to.z - from.z);
      return {
        center: lerp(from.x, to.x, amount),
        width: lerp(from.width, to.width, amount),
        y: lerp(from.y, to.y, amount),
        gradientZ: (to.y - from.y) * derivative,
      };
    }
    const end = path[path.length - 1];
    return { center: end.x, width: end.width, y: end.y, gradientZ: 0 };
  }

  function getGround(x, z) {
    const track = trackSampleAt(z);
    if (!track || Math.abs(x - track.center) > track.width / 2) return null;
    return track;
  }

  function project(x, z, y) {
    const depth = z - camera.z;
    if (depth <= 42) return null;
    const scale = focalLength / depth;
    return { x: viewportWidth / 2 + (x - camera.x) * scale, y: horizon - (y - camera.y) * scale, scale, depth };
  }

  function rebuildLevelDots() {
    levelDots.innerHTML = "";
    levels.forEach((_, index) => {
      const dot = document.createElement("span");
      dot.className = "level-dot";
      if (index < currentLevelIndex) dot.classList.add("done");
      if (index === currentLevelIndex) dot.classList.add("active");
      levelDots.append(dot);
    });
  }

  function loadLevel(index, options = {}) {
    currentLevelIndex = index;
    currentLevel = levels[index];
    lastCheckpoint = -1;
    particles.length = 0;
    levelNumber.textContent = String(index + 1);
    levelKicker.textContent = currentLevel.kicker;
    levelName.textContent = currentLevel.name;
    checkpointLabel.textContent = "START";
    rebuildLevelDots();
    placePlayer(currentLevel.startZ, true);
    if (options.play !== false) state = "playing";
  }

  function placePlayer(z, snapCamera = false) {
    const track = trackSampleAt(z);
    player.x = track.center;
    player.z = z;
    player.y = track.y + BALL_RADIUS;
    player.vx = 0; player.vz = 0; player.vy = 0;
    player.grounded = true;
    player.invulnerable = 1.1;
    if (snapCamera) {
      camera.x = track.center;
      camera.z = z - 320;
      camera.y = track.y + 135;
    }
  }

  function restartLevel() {
    hideOverlay();
    loadLevel(currentLevelIndex);
    showToast("LEVEL RESTARTED");
  }

  function respawnAtCheckpoint() {
    const z = lastCheckpoint >= 0 ? currentLevel.checkpoints[lastCheckpoint].spawnZ : currentLevel.startZ;
    placePlayer(z, true);
    state = "playing";
    screenFlash = 0;
  }

  function showToast(message, danger = false, duration = 1500) {
    toast.textContent = message;
    toast.classList.toggle("danger", danger);
    toast.classList.add("show");
    toastTimer = duration / 1000;
  }

  function hideOverlay() { overlay.classList.remove("visible"); }

  function resetIntroOverlay() {
    overlayKicker.textContent = "4 LONG RUNS · ONE SKYLINE";
    overlayTitle.innerHTML = "Chase the horizon.<br /><em>Keep rolling.</em>";
    overlayCopy.textContent = "Follow the continuous sky track to the glowing finish. Build momentum, coast down slopes, dodge the swinging axes, and activate distant checkpoints.";
    instructionGrid.hidden = false;
    primaryButton.querySelector("span").textContent = "BEGIN RUN";
    modalFootnote.textContent = "Falling or getting hit returns you to your latest checkpoint.";
  }

  function showWinOverlay() {
    overlayKicker.textContent = "ALL FOUR SKYLINES COMPLETE";
    overlayTitle.innerHTML = "Horizon conquered.<br /><em>You made it.</em>";
    overlayCopy.textContent = "You held the line through every long descent, switchback, and swinging axe. The skyline is yours.";
    instructionGrid.hidden = true;
    primaryButton.querySelector("span").textContent = "ROLL AGAIN";
    modalFootnote.textContent = "Start a fresh run from Level 1.";
    overlay.classList.add("visible");
  }

  function beginRun() {
    resetIntroOverlay();
    hideOverlay();
    loadLevel(0);
    showToast("LEVEL 1 · CHASE THE HORIZON");
  }

  function axePose(item) {
    const track = trackSampleAt(item.z);
    const angle = Math.sin(elapsed * item.speed + item.phase) * 1.08;
    return {
      pivotX: track.center,
      bladeX: track.center + Math.sin(angle) * item.reach,
      bladeY: track.y + 23 + Math.cos(angle) * 7,
      groundY: track.y,
      track,
    };
  }

  function update(dt) {
    elapsed += dt;
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toast.classList.remove("show");
    }
    screenFlash = Math.max(0, screenFlash - dt * 1.9);
    updateParticles(dt);

    if (state === "dead") {
      deathTimer -= dt;
      player.vy -= GRAVITY * dt;
      player.y += player.vy * dt;
      player.x += player.vx * dt;
      player.z += player.vz * dt;
      if (deathTimer <= 0) respawnAtCheckpoint();
      updateCamera(dt);
      return;
    }

    if (state === "levelComplete") {
      transitionTimer -= dt;
      if (transitionTimer <= 0) {
        loadLevel(currentLevelIndex + 1);
        showToast(`LEVEL ${currentLevelIndex + 1} · ${currentLevel.name.toUpperCase()}`);
      }
      updateCamera(dt);
      return;
    }

    if (state !== "playing") return;

    player.invulnerable = Math.max(0, player.invulnerable - dt);
    const groundBeforeMove = getGround(player.x, player.z);
    const steerX = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    const steerZ = (keys.ArrowUp ? 1 : 0) - (keys.ArrowDown ? 1 : 0);
    const inputLength = Math.hypot(steerX, steerZ) || 1;
    const control = player.grounded ? 610 : 150;
    player.vx += (steerX / inputLength) * control * dt;
    player.vz += (steerZ / inputLength) * control * dt;
    if (player.grounded && groundBeforeMove) player.vz += -groundBeforeMove.gradientZ * 1280 * dt;

    const hasInput = steerX !== 0 || steerZ !== 0;
    const onSlope = groundBeforeMove && Math.abs(groundBeforeMove.gradientZ) > 0.015;
    const drag = onSlope ? 0.68 : hasInput ? 1.45 : 3.1;
    const dragFactor = Math.exp(-drag * dt);
    player.vx *= dragFactor;
    player.vz *= dragFactor;

    const maxSpeed = 310 + currentLevelIndex * 12;
    const speed = Math.hypot(player.vx, player.vz);
    if (speed > maxSpeed) {
      player.vx = (player.vx / speed) * maxSpeed;
      player.vz = (player.vz / speed) * maxSpeed;
    }

    player.x += player.vx * dt;
    player.z += player.vz * dt;
    player.roll += speed * dt * 0.052;

    const wasGrounded = player.grounded;
    const ground = getGround(player.x, player.z);
    if (ground && wasGrounded) {
      player.grounded = true;
      player.y = ground.y + BALL_RADIUS;
      player.vy = 0;
    } else {
      player.grounded = false;
      player.vy -= GRAVITY * dt;
      player.y += player.vy * dt;
      if (ground && player.vy <= 0 && player.y <= ground.y + BALL_RADIUS + 5) {
        player.y = ground.y + BALL_RADIUS;
        player.vy = 0;
        player.grounded = true;
        burst(player.x, player.z, currentLevel.accent, 7);
      }
    }

    checkCheckpoints();
    checkHazards();
    checkFinish();
    const underlyingTrack = trackSampleAt(player.z);
    if (!underlyingTrack || player.y < underlyingTrack.y - 300) fail("YOU FELL · RETURNING TO CHECKPOINT");
    updateCamera(dt);
  }

  function updateCamera(dt) {
    const finalPathNode = currentLevel.path[currentLevel.path.length - 1];
    const clampedZ = Math.max(currentLevel.path[0].z, Math.min(player.z, finalPathNode.z));
    const track = trackSampleAt(clampedZ);
    if (!track) return;
    const response = 1 - Math.exp(-4.8 * dt);
    const targetX = player.x * 0.78 + track.center * 0.22;
    camera.x += (targetX - camera.x) * response;
    camera.z += (player.z - 320 - camera.z) * response;
    camera.y += (track.y + 135 - camera.y) * response;
  }

  function checkCheckpoints() {
    currentLevel.checkpoints.forEach((point, index) => {
      if (index <= lastCheckpoint || !player.grounded || Math.abs(player.z - point.z) > 28) return;
      lastCheckpoint = index;
      checkpointLabel.textContent = `GATE ${String(index + 1).padStart(2, "0")}`;
      showToast(`CHECKPOINT ${index + 1} / ${currentLevel.checkpoints.length} ACTIVATED`);
      const track = trackSampleAt(point.z);
      burst(track.center, point.z, currentLevel.accent, 30);
    });
  }

  function checkHazards() {
    if (player.invulnerable > 0 || !player.grounded) return;
    for (const item of currentLevel.hazards) {
      if (Math.abs(player.z - item.z) > 29) continue;
      const pose = axePose(item);
      if (Math.abs(player.x - pose.bladeX) < BALL_RADIUS + 21) {
        fail("AXE HIT · RETURNING TO CHECKPOINT");
        return;
      }
    }
  }

  function checkFinish() {
    if (!player.grounded || Math.abs(player.z - currentLevel.finish.z) > 30) return;
    const track = trackSampleAt(currentLevel.finish.z);
    burst(track.center, currentLevel.finish.z, currentLevel.accent2, 58);
    clearInput();
    if (currentLevelIndex === levels.length - 1) {
      state = "won";
      showToast("ALL SKYLINES COMPLETE", false, 2000);
      window.setTimeout(showWinOverlay, 700);
    } else {
      state = "levelComplete";
      transitionTimer = 1.8;
      showToast(`LEVEL ${currentLevelIndex + 1} CLEAR · NEXT SKYLINE`, false, 1700);
    }
  }

  function fail(message) {
    if (state !== "playing") return;
    state = "dead";
    clearInput();
    deathTimer = 1.05;
    screenFlash = 0.82;
    player.grounded = false;
    player.vy = 105;
    player.vx *= 0.5;
    player.vz *= 0.5;
    showToast(message, true, 1050);
    burst(player.x, player.z, "#ff4f91", 22);
  }

  function burst(x, z, color, count) {
    const track = trackSampleAt(z);
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 120;
      particles.push({
        x, z, y: (track?.y ?? player.y) + 8,
        vx: Math.cos(angle) * speed, vz: Math.sin(angle) * speed,
        vy: 35 + Math.random() * 110, life: 0.55 + Math.random() * 0.6,
        color, size: 1.5 + Math.random() * 3.5,
      });
    }
  }

  function updateParticles(dt) {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];
      particle.life -= dt;
      if (particle.life <= 0) { particles.splice(index, 1); continue; }
      particle.x += particle.vx * dt;
      particle.z += particle.vz * dt;
      particle.y += particle.vy * dt;
      particle.vy -= 190 * dt;
      particle.vx *= Math.exp(-1.6 * dt);
      particle.vz *= Math.exp(-1.6 * dt);
    }
  }

  function buildRoadRings() {
    const rings = [];
    const firstZ = Math.max(currentLevel.path[0].z, camera.z + 48);
    const finalPathNode = currentLevel.path[currentLevel.path.length - 1];
    const lastZ = Math.min(finalPathNode.z, camera.z + 2700);
    for (let z = firstZ; z <= lastZ; z += 42) {
      const track = trackSampleAt(z);
      if (!track) continue;
      const leftX = track.center - track.width / 2;
      const rightX = track.center + track.width / 2;
      rings.push({
        z, track,
        left: project(leftX, z, track.y), right: project(rightX, z, track.y),
        leftDown: project(leftX, z, track.y - 24), rightDown: project(rightX, z, track.y - 24),
      });
    }
    return rings.filter((ring) => ring.left && ring.right);
  }

  function tracePoints(points) {
    if (points.some((point) => !point)) return false;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
    ctx.closePath();
    return true;
  }

  function render() {
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, viewportWidth, viewportHeight);
    renderBackdrop();
    renderRoad(buildRoadRings());
    renderZones();
    renderAxes();
    renderParticles();
    renderBall();
    renderSpeedLines();
    renderForegroundGlow();
    if (screenFlash > 0) {
      ctx.fillStyle = `rgba(255,35,111,${screenFlash * 0.2})`;
      ctx.fillRect(0, 0, viewportWidth, viewportHeight);
    }
  }

  function renderBackdrop() {
    const sky = ctx.createLinearGradient(0, 0, 0, viewportHeight);
    sky.addColorStop(0, currentLevel.skyTop);
    sky.addColorStop(0.55, currentLevel.skyBottom);
    sky.addColorStop(1, shadeColor(currentLevel.skyBottom, -18));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    const aura = ctx.createRadialGradient(viewportWidth * 0.5, horizon, 12, viewportWidth * 0.5, horizon, Math.max(viewportWidth, viewportHeight) * 0.55);
    aura.addColorStop(0, hexToRgba(currentLevel.glow, 0.65));
    aura.addColorStop(0.28, hexToRgba(currentLevel.accent2, 0.2));
    aura.addColorStop(1, hexToRgba(currentLevel.glow, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, viewportWidth, viewportHeight);

    const sunRadius = Math.min(80, viewportWidth * 0.11);
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.shadowColor = currentLevel.accent2;
    ctx.shadowBlur = 45;
    const sun = ctx.createLinearGradient(0, horizon - sunRadius, 0, horizon + sunRadius);
    sun.addColorStop(0, currentLevel.accent);
    sun.addColorStop(1, currentLevel.accent2);
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(viewportWidth * 0.5, horizon - 8, sunRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    for (const dot of ambientDots) {
      const y = (dot.y * horizon * 1.25 + camera.z * dot.drift * 0.025) % (horizon * 1.25);
      ctx.globalAlpha = dot.alpha;
      ctx.fillStyle = dot.x > 0.5 ? currentLevel.accent : currentLevel.accent2;
      ctx.fillRect(dot.x * viewportWidth, y, dot.size, dot.size);
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.strokeStyle = hexToRgba(currentLevel.accent, 0.13);
    ctx.lineWidth = 1;
    const vanishingX = viewportWidth / 2;
    for (let index = -10; index <= 10; index += 1) {
      ctx.beginPath(); ctx.moveTo(vanishingX, horizon);
      ctx.lineTo(vanishingX + index * viewportWidth * 0.16, viewportHeight); ctx.stroke();
    }
    for (let index = 1; index <= 13; index += 1) {
      const amount = index / 13;
      const y = horizon + amount * amount * (viewportHeight - horizon);
      ctx.globalAlpha = 0.25 + amount * 0.5;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(viewportWidth, y); ctx.stroke();
    }
    ctx.restore();
  }

  function renderRoad(rings) {
    for (let index = rings.length - 2; index >= 0; index -= 1) {
      const near = rings[index];
      const far = rings[index + 1];
      if (tracePoints([near.left, far.left, far.leftDown, near.leftDown])) {
        ctx.fillStyle = mixColors(currentLevel.deckDark, currentLevel.accent2, 0.1); ctx.fill();
      }
      if (tracePoints([near.right, far.right, far.rightDown, near.rightDown])) {
        ctx.fillStyle = shadeColor(currentLevel.deckDark, -10); ctx.fill();
      }
      if (tracePoints([near.left, near.right, far.right, far.left])) {
        const pulse = (Math.floor(near.z / 42) % 2) * 0.06;
        ctx.fillStyle = mixColors(currentLevel.deck, currentLevel.deckDark, 0.26 + pulse); ctx.fill();
      }

      if (Math.floor(near.z / 92) % 2 === 0) {
        const nearTrack = near.track;
        const farTrack = far.track;
        const lane = [
          project(nearTrack.center - 2.4, near.z, nearTrack.y + 0.6),
          project(nearTrack.center + 2.4, near.z, nearTrack.y + 0.6),
          project(farTrack.center + 2.4, far.z, farTrack.y + 0.6),
          project(farTrack.center - 2.4, far.z, farTrack.y + 0.6),
        ];
        if (tracePoints(lane)) { ctx.fillStyle = hexToRgba(currentLevel.accent2, 0.72); ctx.fill(); }
      }
      if (Math.floor(near.z / 260) !== Math.floor(far.z / 260)) {
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = Math.max(0.6, near.left.scale * 0.45);
        ctx.beginPath(); ctx.moveTo(far.left.x, far.left.y); ctx.lineTo(far.right.x, far.right.y); ctx.stroke();
      }
    }

    ctx.save();
    ctx.lineCap = "round";
    for (const edge of ["left", "right"]) {
      ctx.beginPath();
      rings.forEach((ring, index) => index === 0 ? ctx.moveTo(ring[edge].x, ring[edge].y) : ctx.lineTo(ring[edge].x, ring[edge].y));
      ctx.strokeStyle = currentLevel.accent;
      ctx.lineWidth = 2.2;
      ctx.shadowColor = currentLevel.accent;
      ctx.shadowBlur = 14;
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderZones() {
    const zones = currentLevel.checkpoints.map((point, index) => ({ type: "checkpoint", point, index, z: point.z }));
    zones.push({ type: "finish", point: currentLevel.finish, z: currentLevel.finish.z });
    zones.sort((a, b) => b.z - a.z);
    for (const zone of zones) {
      if (zone.z - camera.z < 45 || zone.z - camera.z > 1900) continue;
      if (zone.type === "finish") renderFinishGate(zone.point);
      else renderCheckpointGate(zone.point, zone.index);
    }
  }

  function roadBand(z, color, alpha = 0.34) {
    const nearTrack = trackSampleAt(z - 11);
    const farTrack = trackSampleAt(z + 11);
    if (!nearTrack || !farTrack) return;
    const points = [
      project(nearTrack.center - nearTrack.width * 0.47, z - 11, nearTrack.y + 1),
      project(nearTrack.center + nearTrack.width * 0.47, z - 11, nearTrack.y + 1),
      project(farTrack.center + farTrack.width * 0.47, z + 11, farTrack.y + 1),
      project(farTrack.center - farTrack.width * 0.47, z + 11, farTrack.y + 1),
    ];
    if (!tracePoints(points)) return;
    ctx.fillStyle = hexToRgba(color, alpha);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function renderCheckpointGate(point, index) {
    const track = trackSampleAt(point.z);
    const active = index <= lastCheckpoint;
    const color = active ? currentLevel.accent : currentLevel.accent2;
    roadBand(point.z, color, active ? 0.48 : 0.25);
    const halfWidth = track.width * 0.46;
    const leftBase = project(track.center - halfWidth, point.z, track.y + 2);
    const rightBase = project(track.center + halfWidth, point.z, track.y + 2);
    const leftTop = project(track.center - halfWidth, point.z, track.y + 83);
    const rightTop = project(track.center + halfWidth, point.z, track.y + 83);
    if (!leftBase || !rightBase || !leftTop || !rightTop) return;
    ctx.save();
    ctx.strokeStyle = hexToRgba(color, active ? 0.95 : 0.58);
    ctx.lineWidth = Math.max(1, leftBase.scale * 2.2);
    ctx.shadowColor = color; ctx.shadowBlur = active ? 18 : 10;
    ctx.beginPath(); ctx.moveTo(leftBase.x, leftBase.y); ctx.lineTo(leftTop.x, leftTop.y);
    ctx.lineTo(rightTop.x, rightTop.y); ctx.lineTo(rightBase.x, rightBase.y); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${Math.max(7, Math.min(12, leftBase.scale * 4))}px Inter, sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(active ? "CHECKPOINT ACTIVE" : `CHECKPOINT ${index + 1}`, (leftTop.x + rightTop.x) / 2, leftTop.y - 8);
    ctx.restore();
  }

  function renderFinishGate(point) {
    const track = trackSampleAt(point.z);
    roadBand(point.z, currentLevel.accent, 0.62);
    const halfWidth = track.width * 0.48;
    const leftBase = project(track.center - halfWidth, point.z, track.y + 2);
    const rightBase = project(track.center + halfWidth, point.z, track.y + 2);
    const leftTop = project(track.center - halfWidth, point.z, track.y + 105);
    const rightTop = project(track.center + halfWidth, point.z, track.y + 105);
    if (!leftBase || !rightBase || !leftTop || !rightTop) return;
    ctx.save();
    ctx.strokeStyle = currentLevel.accent;
    ctx.lineWidth = Math.max(2, leftBase.scale * 3);
    ctx.shadowColor = currentLevel.accent2; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.moveTo(leftBase.x, leftBase.y); ctx.lineTo(leftTop.x, leftTop.y);
    ctx.lineTo(rightTop.x, rightTop.y); ctx.lineTo(rightBase.x, rightBase.y); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `900 ${Math.max(8, Math.min(14, leftBase.scale * 4.5))}px Inter, sans-serif`;
    ctx.textAlign = "center"; ctx.fillText("FINISH", (leftTop.x + rightTop.x) / 2, leftTop.y - 9);
    ctx.restore();
  }

  function renderAxes() {
    const visible = currentLevel.hazards.filter((item) => item.z - camera.z > 45 && item.z - camera.z < 1900).sort((a, b) => b.z - a.z);
    for (const item of visible) {
      const pose = axePose(item);
      const halfWidth = pose.track.width * 0.48;
      const leftBase = project(pose.track.center - halfWidth, item.z, pose.groundY);
      const rightBase = project(pose.track.center + halfWidth, item.z, pose.groundY);
      const leftTop = project(pose.track.center - halfWidth, item.z, pose.groundY + 126);
      const rightTop = project(pose.track.center + halfWidth, item.z, pose.groundY + 126);
      const pivot = project(pose.pivotX, item.z, pose.groundY + 120);
      const blade = project(pose.bladeX, item.z, pose.bladeY);
      if (!leftBase || !rightBase || !leftTop || !rightTop || !pivot || !blade) continue;
      ctx.save();
      ctx.strokeStyle = hexToRgba(currentLevel.accent2, 0.68);
      ctx.lineWidth = Math.max(1, leftBase.scale * 2.4);
      ctx.shadowColor = currentLevel.accent2; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(leftBase.x, leftBase.y); ctx.lineTo(leftTop.x, leftTop.y);
      ctx.lineTo(rightTop.x, rightTop.y); ctx.lineTo(rightBase.x, rightBase.y); ctx.stroke();
      ctx.strokeStyle = "#6e4058";
      ctx.lineWidth = Math.max(2, blade.scale * 5); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(blade.x, blade.y); ctx.stroke();
      const bladeSize = Math.max(5, Math.min(27, blade.scale * 18));
      ctx.fillStyle = "#ecfaff"; ctx.shadowColor = currentLevel.accent2; ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(blade.x - bladeSize, blade.y - bladeSize * 0.58);
      ctx.quadraticCurveTo(blade.x + bladeSize * 0.45, blade.y - bladeSize, blade.x + bladeSize, blade.y);
      ctx.quadraticCurveTo(blade.x + bladeSize * 0.45, blade.y + bladeSize, blade.x - bladeSize, blade.y + bladeSize * 0.58);
      ctx.quadraticCurveTo(blade.x - bladeSize * 0.5, blade.y, blade.x - bladeSize, blade.y - bladeSize * 0.58);
      ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }

  function renderParticles() {
    for (const particle of particles) {
      const point = project(particle.x, particle.z, particle.y);
      if (!point) continue;
      ctx.globalAlpha = Math.min(1, particle.life * 1.8);
      ctx.fillStyle = particle.color; ctx.shadowColor = particle.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(point.x, point.y, Math.max(1, particle.size * point.scale * 0.45), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
  }

  function renderBall() {
    const point = project(player.x, player.z, player.y);
    if (!point) return;
    const track = trackSampleAt(player.z);
    const groundPoint = project(player.x, player.z, track?.y ?? player.y - BALL_RADIUS);
    const radius = BALL_RADIUS * point.scale;
    const airHeight = Math.max(0, player.y - (track?.y ?? player.y) - BALL_RADIUS);
    if (groundPoint) {
      ctx.save(); ctx.globalAlpha = Math.max(0.08, 0.42 - airHeight / 360);
      ctx.translate(groundPoint.x, groundPoint.y + 4); ctx.scale(1, 0.28);
      const shadow = ctx.createRadialGradient(0, 0, 1, 0, 0, radius * 1.4);
      shadow.addColorStop(0, "rgba(0,0,0,0.85)"); shadow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = shadow; ctx.beginPath(); ctx.arc(0, 0, radius * 1.4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }

    ctx.save(); ctx.translate(point.x, point.y);
    if (player.invulnerable > 0 && Math.floor(elapsed * 12) % 2 === 0) ctx.globalAlpha = 0.68;
    ctx.shadowColor = currentLevel.accent; ctx.shadowBlur = 28;
    const gradient = ctx.createRadialGradient(-radius * 0.34, -radius * 0.38, 1, 0, 0, radius);
    gradient.addColorStop(0, "#fff"); gradient.addColorStop(0.18, currentLevel.accent);
    gradient.addColorStop(0.58, currentLevel.accent2); gradient.addColorStop(1, shadeColor(currentLevel.accent2, -72));
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, radius - 0.5, 0, Math.PI * 2); ctx.clip(); ctx.rotate(player.roll);
    ctx.strokeStyle = "rgba(21,0,69,0.48)"; ctx.lineWidth = Math.max(1.2, radius * 0.06);
    ctx.beginPath(); ctx.ellipse(0, 0, radius * 0.34, radius * 1.15, 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, radius * 0.34, radius * 1.15, -0.55, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.58)"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, radius - 1, Math.PI * 1.05, Math.PI * 1.75); ctx.stroke(); ctx.restore();
  }

  function renderSpeedLines() {
    const speed = Math.hypot(player.vx, player.vz);
    if (state !== "playing" || speed < 150) return;
    const alpha = Math.min(0.22, (speed - 150) / 700);
    ctx.save(); ctx.strokeStyle = hexToRgba(currentLevel.accent, alpha); ctx.lineWidth = 1.5;
    for (let index = 0; index < 12; index += 1) {
      const side = index % 2 ? 1 : -1;
      const x = viewportWidth / 2 + side * (viewportWidth * (0.28 + (index % 6) * 0.055));
      const y = horizon + ((index * 73 + elapsed * speed * 2) % Math.max(1, viewportHeight - horizon));
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * 35, y + 90); ctx.stroke();
    }
    ctx.restore();
  }

  function renderForegroundGlow() {
    const glow = ctx.createLinearGradient(0, viewportHeight * 0.72, 0, viewportHeight);
    glow.addColorStop(0, "rgba(4,3,28,0)"); glow.addColorStop(1, hexToRgba(currentLevel.glow, 0.12));
    ctx.fillStyle = glow; ctx.fillRect(0, viewportHeight * 0.72, viewportWidth, viewportHeight * 0.28);
  }

  function shadeColor(hex, amount) {
    const value = Number.parseInt(hex.replace("#", ""), 16);
    const red = Math.max(0, Math.min(255, (value >> 16) + amount));
    const green = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
    const blue = Math.max(0, Math.min(255, (value & 255) + amount));
    return `rgb(${red},${green},${blue})`;
  }

  function mixColors(first, second, amount) {
    const a = Number.parseInt(first.replace("#", ""), 16);
    const b = Number.parseInt(second.replace("#", ""), 16);
    return `rgb(${Math.round(lerp(a >> 16, b >> 16, amount))},${Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, amount))},${Math.round(lerp(a & 255, b & 255, amount))})`;
  }

  function hexToRgba(hex, alpha) {
    const value = Number.parseInt(hex.replace("#", ""), 16);
    return `rgba(${value >> 16},${(value >> 8) & 255},${value & 255},${alpha})`;
  }

  function clearInput() {
    Object.keys(keys).forEach((key) => { keys[key] = false; });
    document.querySelectorAll(".touch-key.active").forEach((button) => button.classList.remove("active"));
  }

  function frame(now) {
    const dt = Math.min(0.033, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(dt); render(); requestAnimationFrame(frame);
  }

  window.addEventListener("resize", resize);
  window.addEventListener("blur", clearInput);
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearInput(); lastTime = performance.now(); });
  window.addEventListener("keydown", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); keys[event.key] = true; }
    if (event.key === "Enter" && state === "intro") beginRun();
    if ((event.key === "r" || event.key === "R") && state === "playing") restartLevel();
  });
  window.addEventListener("keyup", (event) => {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); keys[event.key] = false; }
  });
  document.querySelectorAll(".touch-key").forEach((button) => {
    const key = button.dataset.key;
    const release = (event) => { event.preventDefault(); keys[key] = false; button.classList.remove("active"); };
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault(); button.setPointerCapture(event.pointerId); keys[key] = true; button.classList.add("active");
    });
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  });

  primaryButton.addEventListener("click", beginRun);
  restartButton.addEventListener("click", restartLevel);
  resize(); seedAmbientDots(); loadLevel(0, { play: false }); state = "intro"; requestAnimationFrame(frame);
})();
