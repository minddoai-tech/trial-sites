(() => {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("gameOverlay");
  const overlayKicker = document.getElementById("overlayKicker");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayMessage = document.getElementById("overlayMessage");
  const overlayPrimary = document.getElementById("overlayPrimary");
  const overlaySecondary = document.getElementById("overlaySecondary");
  const levelGrid = document.getElementById("levelGrid");
  const skinGrid = document.getElementById("skinGrid");
  const saveSummary = document.getElementById("saveSummary");
  const musicToggle = document.getElementById("musicToggle");
  const randomTheme = document.getElementById("randomTheme");

  const W = canvas.width;
  const H = canvas.height;
  const FLOOR = 450;
  const CEILING = 70;
  const SAVE_KEY = "geometryDashUnlockRun-v1";
  const themes = [
    { bg: "#0b111b", surface: "#0e1724", grid: "#18263a" },
    { bg: "#160d1c", surface: "#211329", grid: "#42203e" },
    { bg: "#0b1714", surface: "#10231d", grid: "#1e4035" },
    { bg: "#17130a", surface: "#251d0d", grid: "#4b3919" },
    { bg: "#111225", surface: "#171a35", grid: "#2d3260" },
    { bg: "#1b0f0f", surface: "#2b1517", grid: "#53262a" }
  ];

  const skins = [
    { id: "classic", name: "Classic", health: 1, color: "#54e8ff", accent: "#d8fbff", unlock: "Starter cube" },
    { id: "sunset", name: "Sunset", health: 2, color: "#ff9b54", accent: "#ffe1c2", unlock: "Beat level 1" },
    { id: "mint", name: "Mint", health: 3, color: "#7ae69a", accent: "#e0ffe8", unlock: "Beat level 4" },
    { id: "violet", name: "Violet", health: 4, color: "#bb8cff", accent: "#f0e5ff", unlock: "Beat level 8" },
    { id: "gold", name: "Gold", health: 5, color: "#ffd765", accent: "#fff8d3", unlock: "Beat Last Stand" }
  ];

  function spikes(x, count = 1, ceiling = false, gap = 38) {
    return Array.from({ length: count }, (_, i) => ({ type: "spike", x: x + i * gap, ceiling, w: 34, h: 34 }));
  }
  function saw(x, y, r = 20) { return { type: "saw", x, y, r }; }
  function block(x, y, w = 92, h = 62) { return { type: "block", x, y, w, h }; }
  function pad(x, direction = 1) { return { type: "pad", x, direction, w: 48 }; }
  function portal(x, gravity = -1) { return { type: "portal", x, gravity }; }
  function coin(x, y) { return { type: "coin", x, y, taken: false }; }

  const levels = [
    { id: "level-01", name: "First Steps", speed: 255, length: 3300, color: "#54e8ff", difficulty: "Easy", objects: [
      ...spikes(620), ...spikes(940, 2), block(1230, 388, 100, 62), ...spikes(1500, 2), pad(1760), ...spikes(1960, 3), coin(2140, 330), block(2360, 340, 120, 110), ...spikes(2640, 2), ...spikes(2990, 3)
    ] },
    { id: "level-02", name: "Neon Steps", speed: 270, length: 3600, color: "#ff9b54", difficulty: "Easy", objects: [
      ...spikes(550, 2), block(840, 365, 120, 85), ...spikes(1080, 3), coin(1290, 280), pad(1470), ...spikes(1710, 2), block(1970, 330, 100, 120), ...spikes(2240, 4), saw(2520, 390, 24), ...spikes(2780, 2), ...spikes(3110, 3)
    ] },
    { id: "level-03", name: "Skyline", speed: 280, length: 3850, color: "#7ae69a", difficulty: "Normal", objects: [
      ...spikes(500, 3), block(820, 360), ...spikes(1110, 2), portal(1350, -1), ...spikes(1560, 2, true), block(1810, 95, 120, 60), coin(2050, 170), ...spikes(2240, 3, true), portal(2490, 1), ...spikes(2740, 2), saw(3000, 360, 28), ...spikes(3270, 4)
    ] },
    { id: "level-04", name: "Gravity Switch", speed: 292, length: 4100, color: "#bb8cff", difficulty: "Normal", objects: [
      ...spikes(520, 2), portal(800, -1), ...spikes(1030, 3, true), block(1390, 92, 140, 60), ...spikes(1710, 4, true), pad(2050, -1), ...spikes(2320, 3), portal(2590, 1), ...spikes(2860, 2), saw(3130, 350, 30), block(3410, 340, 120, 110), ...spikes(3690, 4)
    ] },
    { id: "level-05", name: "Pulse Drive", speed: 305, length: 4300, color: "#ff6ea8", difficulty: "Normal", objects: [
      ...spikes(520, 4), block(850, 350, 100, 100), ...spikes(1100, 2), pad(1370), ...spikes(1630, 4), saw(1960, 290, 24), coin(2150, 280), ...spikes(2300, 3), block(2600, 330, 100, 120), ...spikes(2900, 2), portal(3150, -1), ...spikes(3420, 4, true), portal(3800, 1), ...spikes(4040, 4)
    ] },
    { id: "level-06", name: "Crossfade", speed: 315, length: 4500, color: "#ffd765", difficulty: "Hard", objects: [
      ...spikes(500, 3), saw(790, 380, 25), ...spikes(1030, 2), block(1260, 350, 140, 100), ...spikes(1510, 4), portal(1850, -1), ...spikes(2090, 4, true), block(2460, 95, 120, 60), saw(2740, 175, 26), portal(2980, 1), ...spikes(3210, 3), pad(3510), ...spikes(3780, 3), ...spikes(4140, 4)
    ] },
    { id: "level-07", name: "Afterimage", speed: 325, length: 4700, color: "#54e8ff", difficulty: "Hard", objects: [
      ...spikes(480, 2), block(730, 370, 100, 80), ...spikes(990, 4), saw(1370, 380, 28), ...spikes(1620, 3), pad(1920), ...spikes(2190, 5), portal(2570, -1), ...spikes(2780, 3, true), saw(3150, 160, 26), block(3420, 95, 130, 60), portal(3700, 1), ...spikes(3950, 3), ...spikes(4260, 4)
    ] },
    { id: "level-08", name: "Signal Lost", speed: 337, length: 4850, color: "#ff9b54", difficulty: "Hard", objects: [
      ...spikes(500, 4), ...spikes(840, 2), block(1110, 330, 130, 120), saw(1430, 360, 28), ...spikes(1680, 4), portal(2040, -1), ...spikes(2290, 4, true), block(2630, 95, 110, 60), ...spikes(2880, 3, true), portal(3240, 1), pad(3490), ...spikes(3770, 4), saw(4140, 380, 28), ...spikes(4440, 5)
    ] },
    { id: "level-09", name: "Redline", speed: 348, length: 5050, color: "#ff6e78", difficulty: "Hard", objects: [
      ...spikes(470, 3), saw(760, 370, 26), ...spikes(1020, 4), block(1380, 340, 110, 110), ...spikes(1670, 3), pad(1950), ...spikes(2220, 5), portal(2600, -1), ...spikes(2810, 4, true), saw(3230, 165, 27), block(3510, 100, 140, 60), ...spikes(3780, 3, true), portal(4110, 1), ...spikes(4380, 4), ...spikes(4750, 4)
    ] },
    { id: "level-10", name: "Overclock", speed: 360, length: 5250, color: "#bb8cff", difficulty: "Very hard", objects: [
      ...spikes(460, 4), block(800, 345, 120, 105), ...spikes(1110, 5), saw(1510, 360, 30), ...spikes(1770, 3), portal(2120, -1), ...spikes(2340, 5, true), saw(2760, 160, 26), block(3020, 100, 120, 60), ...spikes(3320, 4, true), portal(3670, 1), ...spikes(3940, 5), pad(4300), ...spikes(4620, 5), ...spikes(5010, 4)
    ] },
    { id: "level-11", name: "Blackout", speed: 372, length: 5450, color: "#7ae69a", difficulty: "Very hard", objects: [
      ...spikes(450, 4), ...spikes(750, 3), saw(1080, 380, 30), block(1320, 330, 120, 120), ...spikes(1600, 5), portal(2010, -1), ...spikes(2230, 5, true), block(2630, 95, 140, 60), saw(2960, 160, 28), ...spikes(3220, 4, true), portal(3610, 1), ...spikes(3890, 5), saw(4290, 375, 30), ...spikes(4580, 4), ...spikes(5030, 5)
    ] },
    { id: "level-12", name: "Fault Line", speed: 385, length: 5650, color: "#54e8ff", difficulty: "Very hard", objects: [
      ...spikes(430, 5), block(760, 340, 120, 110), ...spikes(1080, 4), saw(1430, 370, 31), ...spikes(1690, 5), pad(2080), ...spikes(2380, 5), portal(2780, -1), ...spikes(2980, 5, true), saw(3400, 165, 28), block(3670, 95, 150, 60), ...spikes(3950, 4, true), portal(4320, 1), ...spikes(4610, 5), ...spikes(5080, 5), ...spikes(5420, 3)
    ] },
    { id: "level-13", name: "The Gauntlet", speed: 398, length: 5900, color: "#ff9b54", difficulty: "Expert", objects: [
      ...spikes(420, 5), saw(770, 365, 31), ...spikes(1040, 5), block(1410, 330, 130, 120), ...spikes(1730, 6), portal(2180, -1), ...spikes(2410, 6, true), saw(2850, 160, 30), block(3130, 95, 150, 60), ...spikes(3460, 5, true), portal(3890, 1), pad(4130), ...spikes(4410, 6), saw(4850, 380, 31), ...spikes(5150, 5), ...spikes(5580, 5)
    ] },
    { id: "level-14", name: "Zero Margin", speed: 410, length: 6200, color: "#ff6ea8", difficulty: "Expert", objects: [
      ...spikes(400, 6), block(760, 335, 120, 115), ...spikes(1080, 5), saw(1450, 365, 32), ...spikes(1700, 6), pad(2130), ...spikes(2400, 6), portal(2850, -1), ...spikes(3100, 6, true), saw(3540, 165, 31), block(3850, 95, 140, 60), ...spikes(4160, 5, true), portal(4610, 1), ...spikes(4850, 6), saw(5310, 378, 32), ...spikes(5550, 6), ...spikes(5980, 4)
    ] },
    { id: "level-15", name: "Last Stand", speed: 450, length: 7000, color: "#ff536f", difficulty: "Almost impossible", last: true, objects: [
      ...spikes(380, 6), saw(760, 370, 32), ...spikes(1000, 6), block(1360, 330, 110, 120), ...spikes(1600, 7), pad(2040), ...spikes(2320, 7), saw(2720, 375, 33), portal(3000, -1), ...spikes(3190, 7, true), block(3570, 95, 120, 60), saw(3900, 165, 31), ...spikes(4140, 7, true), portal(4540, 1), ...spikes(4750, 7), pad(5200), ...spikes(5450, 8), saw(5890, 370, 34), ...spikes(6150, 8), portal(6500, -1), ...spikes(6700, 7, true)
    ] }
  ];

  const defaultSave = () => ({ unlocked: 1, completed: {}, best: {}, coins: {}, unlockedSkins: ["classic"], selectedSkin: "classic" });
  let save = loadSave();
  let mode = "menu";
  let selectedLevel = null;
  let run = null;
  let jumpHeld = false;
  let themeIndex = Math.floor(Math.random() * themes.length);
  let audioContext = null;
  let musicTimer = null;
  let musicOn = false;
  let musicStep = 0;
  let lastTime = performance.now();

  function theme() { return themes[themeIndex]; }
  function applyTheme() {
    const selected = theme();
    document.body.style.background = selected.bg;
    canvas.style.background = selected.surface;
  }
  function randomizeTheme() {
    let next = themeIndex;
    while (themes.length > 1 && next === themeIndex) next = Math.floor(Math.random() * themes.length);
    themeIndex = next;
    applyTheme();
  }

  function playNote(frequency, duration = 0.12, type = "square", volume = 0.035) {
    if (!audioContext || !musicOn) return;
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
  function musicTick() {
    const melody = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
    const bass = [130.81, 130.81, 146.83, 146.83, 164.81, 164.81, 146.83, 146.83];
    playNote(melody[musicStep % melody.length], 0.16, "square", 0.025);
    if (musicStep % 2 === 0) playNote(bass[musicStep % bass.length], 0.22, "triangle", 0.035);
    musicStep++;
  }
  function toggleMusic() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    musicOn = !musicOn;
    if (musicOn) { musicTick(); musicTimer = setInterval(musicTick, 240); musicToggle.textContent = "♫ MUSIC: ON"; }
    else { clearInterval(musicTimer); musicTimer = null; musicToggle.textContent = "♫ MUSIC: OFF"; }
  }

  function loadSave() {
    try {
      const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
      return { ...defaultSave(), ...(raw || {}) };
    } catch { return defaultSave(); }
  }
  function persist() { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
  function currentSkin() { return skins.find(s => s.id === save.selectedSkin) || skins[0]; }
  function levelIsUnlocked(index) { return index < save.unlocked; }

  function buildMenu() {
    const completeCount = Object.keys(save.completed).length;
    saveSummary.innerHTML = `<strong>${completeCount}/15</strong> levels cleared<br><strong>${currentSkin().name}</strong> cube · ${currentSkin().health} HP`;
    levelGrid.innerHTML = levels.map((level, i) => {
      const complete = Boolean(save.completed[level.id]);
      const best = Math.round(save.best[level.id] || 0);
      const locked = !levelIsUnlocked(i);
      return `<button class="level-card ${level.last ? "last-stand" : ""}" data-level="${i}" ${locked ? "disabled" : ""}>
        <div class="level-number"><span>${String(i + 1).padStart(2, "0")}</span><span>${locked ? "LOCKED" : complete ? "✓ CLEARED" : level.difficulty.toUpperCase()}</span></div>
        <h3>${level.name}</h3>
        <div class="level-meta"><span>BEST ${best}%</span><span class="check" style="color:${level.color}">${locked ? "◆" : "◆"}</span></div>
      </button>`;
    }).join("");
    skinGrid.innerHTML = skins.map(skin => {
      const unlocked = save.unlockedSkins.includes(skin.id);
      const selected = currentSkin().id === skin.id;
      return `<button class="skin-card ${unlocked ? "" : "locked"} ${selected ? "selected" : ""}" data-skin="${skin.id}" ${unlocked ? "" : "disabled"}>
        <div class="skin-preview" style="background:${skin.color};border-color:${skin.accent}"></div><h3>${skin.name}</h3><p>${unlocked ? `${skin.health} HP${selected ? " · EQUIPPED" : ""}` : skin.unlock}</p>
      </button>`;
    }).join("");
  }

  function startLevel(index) {
    selectedLevel = index;
    const level = levels[index];
    mode = "playing";
    run = {
      level, cameraX: 0, player: { x: 150, y: FLOOR - 34, size: 34, vy: 0, gravity: 1, mode: "cube", onSurface: true, rotation: 0 },
      health: currentSkin().health, maxHealth: currentSkin().health, coins: 0, elapsed: 0, triggered: new Set(), invulnerable: 0, deadReason: ""
    };
    overlay.classList.add("hidden");
  }

  function restart() { if (selectedLevel !== null) startLevel(selectedLevel); }
  function backToMenu() { mode = "menu"; run = null; overlay.classList.add("hidden"); buildMenu(); }

  function jump() {
    if (mode !== "playing" || !run) return;
    const p = run.player;
    if (p.mode === "plane") return;
    if (p.onSurface) { p.vy = -610 * p.gravity; p.onSurface = false; }
  }

  function die(reason = "A hazard hit your cube.") {
    if (mode !== "playing") return;
    mode = "dead";
    run.deadReason = reason;
    const progress = Math.min(99, Math.floor((run.cameraX + run.player.x) / run.level.length * 100));
    run.level.objects.filter(o => o.type === "coin").forEach(o => { o.taken = false; });
    save.best[run.level.id] = Math.max(save.best[run.level.id] || 0, progress);
    persist(); buildMenu();
    showOverlay("RUN OVER", "DIED", `${reason} You reached ${progress}%.`, "RESTART");
  }

  function hit(reason) {
    if (mode !== "playing" || run.invulnerable > 0) return;
    run.health -= 1;
    run.invulnerable = 0.9;
    run.player.vy = -500 * run.player.gravity;
    if (run.health <= 0) die("Your health reached zero.");
  }

  function complete() {
    if (mode !== "playing") return;
    mode = "won";
    const levelIndex = levels.indexOf(run.level);
    save.completed[run.level.id] = true;
    save.best[run.level.id] = 100;
    save.unlocked = Math.max(save.unlocked, Math.min(levels.length, levelIndex + 2));
    const skin = skins[levelIndex === 0 ? 1 : levelIndex === 3 ? 2 : levelIndex === 7 ? 3 : levelIndex === 14 ? 4 : -1];
    let reward = "";
    if (skin && !save.unlockedSkins.includes(skin.id)) { save.unlockedSkins.push(skin.id); reward = ` ${skin.name} skin unlocked!`; }
    persist(); buildMenu();
    const next = levels[levelIndex + 1];
    showOverlay("LEVEL COMPLETE", `CONGRATULATIONS!`, `You finished level ${levelIndex + 1}: ${run.level.name}.${reward}`, next ? "NEXT LEVEL" : "PLAY AGAIN");
  }

  function showOverlay(kicker, title, message, primary) {
    overlayKicker.textContent = kicker;
    overlayTitle.textContent = title;
    overlayMessage.textContent = message;
    overlayPrimary.textContent = primary;
    overlay.classList.remove("hidden");
  }

  function update(dt) {
    if (mode !== "playing" || !run) return;
    const p = run.player;
    const level = run.level;
    run.elapsed += dt;
    run.invulnerable = Math.max(0, run.invulnerable - dt);
    run.cameraX += level.speed * dt;
    if (p.mode === "plane") {
      p.vy += 1150 * dt;
      if (jumpHeld) p.vy -= 2200 * dt;
      p.vy = Math.max(-670, Math.min(670, p.vy));
    } else {
      p.vy += 1850 * p.gravity * dt;
    }
    const previousY = p.y;
    p.y += p.vy * dt;
    p.onSurface = false;
    if (p.mode === "plane") {
      if (p.y + p.size >= FLOOR || p.y <= CEILING) return die("The plane hit the boundary.");
    } else {
      if (p.gravity === 1 && p.y + p.size >= FLOOR) { p.y = FLOOR - p.size; p.vy = 0; p.onSurface = true; }
      if (p.gravity === -1 && p.y <= CEILING) { p.y = CEILING; p.vy = 0; p.onSurface = true; }
    }
    if (jumpHeld && p.onSurface) jump();

    const playerWorldX = run.cameraX + p.x;
    const rect = { x: p.x + 5, y: p.y + 5, w: p.size - 10, h: p.size - 10 };
    for (const [index, obj] of level.objects.entries()) {
      const sx = obj.x - run.cameraX;
      if (sx < -100 || sx > W + 100) continue;
      const id = `${index}`;
      if (obj.type === "spike") {
        const oy = obj.ceiling ? CEILING : FLOOR - obj.h;
        if (overlap(rect, { x: sx + 5, y: oy + 6, w: obj.w - 10, h: obj.h - 7 })) return hit("Spikes drained 1 HP.");
      } else if (obj.type === "saw") {
        const dx = rect.x + rect.w / 2 - sx;
        const dy = rect.y + rect.h / 2 - obj.y;
        if (Math.hypot(dx, dy) < obj.r + 13) return hit("The saw drained 1 HP.");
      } else if (obj.type === "block") {
        const br = { x: sx, y: obj.y, w: obj.w, h: obj.h };
        if (overlap(rect, br)) {
          if (p.mode === "plane") return hit("The plane hit a block.");
          const wasAbove = previousY + p.size <= br.y + 7;
          const wasBelow = previousY >= br.y + br.h - 7;
          if (p.gravity === 1 && wasAbove && p.vy >= 0) { p.y = br.y - p.size; p.vy = 0; p.onSurface = true; }
          else if (p.gravity === -1 && wasBelow && p.vy <= 0) { p.y = br.y + br.h; p.vy = 0; p.onSurface = true; }
          else return hit("The block drained 1 HP.");
        }
      } else if (obj.type === "pad" && !run.triggered.has(id) && sx < p.x + p.size && sx + obj.w > p.x && p.onSurface) {
        p.vy = -980 * p.gravity; p.onSurface = false; run.triggered.add(id);
      } else if (obj.type === "portal" && !run.triggered.has(id) && sx < p.x + p.size && sx + 22 > p.x) {
        p.mode = p.mode === "cube" ? "plane" : "cube";
        p.gravity = 1;
        p.vy = 0;
        p.onSurface = false;
        run.triggered.add(id);
      } else if (obj.type === "coin" && !obj.taken && overlap(rect, { x: sx - 12, y: obj.y - 12, w: 24, h: 24 })) {
        obj.taken = true; run.coins++;
      }
    }
    if (p.y > H + 60 || p.y + p.size < -60) return die("You fell out of the course.");
    p.rotation += dt * (p.onSurface ? 0 : 5.5);
    if (playerWorldX >= level.length) complete();
  }

  function overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  function draw() {
    const level = run?.level || levels[0];
    const cam = run?.cameraX || 0;
    const accent = level.color;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = theme().bg; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = theme().surface; ctx.fillRect(0, 0, W, CEILING); ctx.fillRect(0, FLOOR, W, H - FLOOR);
    ctx.strokeStyle = theme().grid; ctx.lineWidth = 1;
    const gridOffset = (-cam * .35) % 48;
    for (let x = gridOffset; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, CEILING); ctx.lineTo(x, FLOOR); ctx.stroke(); }
    for (let y = CEILING; y <= FLOOR; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.fillStyle = accent; ctx.globalAlpha = .75; ctx.fillRect(0, FLOOR, W, 4); ctx.fillRect(0, CEILING - 4, W, 4); ctx.globalAlpha = 1;
    if (run) drawObjects(run, accent); else drawIdleObjects(level, accent);
    if (run) drawPlayer(run.player, currentSkin());
    drawHud(level, accent);
  }

  function drawIdleObjects(level, accent) {
    level.objects.slice(0, 12).forEach(o => drawObject(o, o.x - 80, accent));
    drawPlayer({ x: 150, y: FLOOR - 34, size: 34, rotation: 0, gravity: 1 }, currentSkin());
  }
  function drawObjects(activeRun, accent) {
    activeRun.level.objects.forEach(o => {
      const sx = o.x - activeRun.cameraX;
      if (sx > -100 && sx < W + 100) drawObject(o, sx, accent);
    });
  }
  function drawObject(o, sx, accent) {
    if (o.type === "spike") {
      const base = o.ceiling ? CEILING : FLOOR;
      ctx.fillStyle = o.ceiling ? "#ff7895" : "#ff536f";
      ctx.beginPath();
      if (o.ceiling) { ctx.moveTo(sx, base); ctx.lineTo(sx + o.w / 2, base + o.h); ctx.lineTo(sx + o.w, base); }
      else { ctx.moveTo(sx, base); ctx.lineTo(sx + o.w / 2, base - o.h); ctx.lineTo(sx + o.w, base); }
      ctx.closePath(); ctx.fill();
    } else if (o.type === "saw") {
      ctx.save(); ctx.translate(sx, o.y); ctx.rotate((performance.now() / 500) % Math.PI); ctx.fillStyle = "#ffcf75";
      ctx.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8; const r = i % 2 ? o.r * .66 : o.r; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ctx.fill(); ctx.fillStyle = "#172238"; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    } else if (o.type === "block") {
      ctx.fillStyle = "#1f314a"; ctx.fillRect(sx, o.y, o.w, o.h); ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(sx + 1, o.y + 1, o.w - 2, o.h - 2);
      ctx.strokeStyle = "#ffffff18"; for (let x = sx + 18; x < sx + o.w; x += 24) { ctx.beginPath(); ctx.moveTo(x, o.y); ctx.lineTo(x - 20, o.y + o.h); ctx.stroke(); }
    } else if (o.type === "pad") {
      const y = o.direction === 1 ? FLOOR - 9 : CEILING + 1; ctx.fillStyle = "#ffe277"; ctx.fillRect(sx, y, o.w, 9); ctx.fillStyle = "#433b1a"; ctx.beginPath(); ctx.moveTo(sx + 10, y + 7); ctx.lineTo(sx + 24, y - 7); ctx.lineTo(sx + 38, y + 7); ctx.fill();
    } else if (o.type === "portal") {
      ctx.strokeStyle = o.gravity === -1 ? "#bb8cff" : "#54e8ff"; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(sx + 12, 260, 22, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = o.gravity === -1 ? "#d8c5ff" : "#b8f7ff"; ctx.font = "800 9px system-ui"; ctx.textAlign = "center"; ctx.fillText(o.gravity === -1 ? "PLANE" : "CUBE", sx + 12, 300); ctx.textAlign = "left";
    } else if (o.type === "coin" && !o.taken) {
      ctx.fillStyle = "#ffd765"; ctx.beginPath(); ctx.arc(sx, o.y, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#8f6b13"; ctx.font = "bold 13px system-ui"; ctx.textAlign = "center"; ctx.fillText("◆", sx, o.y + 5); ctx.textAlign = "left";
    }
  }
  function drawPlayer(p, skin) {
    ctx.save(); ctx.translate(p.x + p.size / 2, p.y + p.size / 2); ctx.rotate(p.rotation || 0);
    ctx.shadowBlur = 18; ctx.shadowColor = skin.color; ctx.fillStyle = skin.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); ctx.shadowBlur = 0;
    if (p.mode === "plane") {
      ctx.beginPath(); ctx.moveTo(19, 0); ctx.lineTo(-15, -12); ctx.lineTo(-8, 0); ctx.lineTo(-15, 12); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = skin.accent; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = "#102034"; ctx.beginPath(); ctx.arc(6, -2, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = skin.accent; ctx.lineWidth = 3; ctx.strokeRect(-p.size / 2 + 2, -p.size / 2 + 2, p.size - 4, p.size - 4);
      ctx.fillStyle = "#102034"; ctx.fillRect(-9, -7, 5, 7); ctx.fillRect(4, -7, 5, 7); ctx.fillRect(-7, 7, 14, 3);
    }
    ctx.restore();
  }
  function drawHud(level, accent) {
    const percent = run ? Math.min(100, Math.floor((run.cameraX + run.player.x) / level.length * 100)) : 0;
    ctx.fillStyle = "#070b12cc"; ctx.fillRect(0, 0, W, 54);
    ctx.fillStyle = "#fff"; ctx.font = "800 14px system-ui"; ctx.fillText(level.name.toUpperCase(), 20, 24);
    ctx.fillStyle = "#8d96aa"; ctx.font = "600 11px system-ui"; ctx.fillText(run ? `${run.health}/${run.maxHealth} HP · ${run.player.mode === "plane" ? "PLANE" : "CUBE"}` : "PRESS SPACE TO START", 20, 42);
    const barX = 265, barW = 430; ctx.fillStyle = "#26344b"; ctx.fillRect(barX, 22, barW, 8); ctx.fillStyle = accent; ctx.fillRect(barX, 22, barW * percent / 100, 8); ctx.fillStyle = "#fff"; ctx.font = "800 13px system-ui"; ctx.textAlign = "right"; ctx.fillText(`${percent}%`, barX + barW + 42, 29);
    if (run) { ctx.fillStyle = "#ffd765"; ctx.fillText(`◆ ${run.coins}`, W - 20, 29); } ctx.textAlign = "left";
  }

  function loop(now) { const dt = Math.min(.032, (now - lastTime) / 1000); lastTime = now; update(dt); draw(); requestAnimationFrame(loop); }
  document.addEventListener("keydown", e => {
    if (["Space", "ArrowUp", "KeyW"].includes(e.code)) { e.preventDefault(); jumpHeld = true; if (mode === "menu") startLevel(0); else if (mode === "playing") jump(); }
    if (e.code === "KeyR" && (mode === "playing" || mode === "dead" || mode === "won")) restart();
    if (e.code === "Escape") backToMenu();
  });
  document.addEventListener("keyup", e => { if (["Space", "ArrowUp", "KeyW"].includes(e.code)) jumpHeld = false; });
  canvas.addEventListener("pointerdown", () => { if (mode === "menu") startLevel(0); else if (mode === "playing") jump(); });
  overlayPrimary.addEventListener("click", () => { if (mode === "won" && selectedLevel < levels.length - 1) startLevel(selectedLevel + 1); else restart(); });
  overlaySecondary.addEventListener("click", backToMenu);
  levelGrid.addEventListener("click", e => { const button = e.target.closest("[data-level]"); if (button) startLevel(Number(button.dataset.level)); });
  skinGrid.addEventListener("click", e => { const button = e.target.closest("[data-skin]"); if (!button) return; save.selectedSkin = button.dataset.skin; persist(); buildMenu(); });
  musicToggle.addEventListener("click", toggleMusic);
  randomTheme.addEventListener("click", randomizeTheme);

  buildMenu();
  applyTheme();
  requestAnimationFrame(loop);
})();
