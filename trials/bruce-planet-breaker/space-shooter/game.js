const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#gameOverlay');
const overlayKicker = document.querySelector('#overlayKicker');
const overlayTitle = document.querySelector('#overlayTitle');
const overlayText = document.querySelector('#overlayText');
const overlayButton = document.querySelector('#overlayButton');
const restartButton = document.querySelector('#restartButton');
const scoreOutput = document.querySelector('#scoreOutput');
const levelOutput = document.querySelector('#levelOutput');
const shieldOutput = document.querySelector('#shieldOutput');
const comboOutput = document.querySelector('#comboOutput');
const upgradeHint = document.querySelector('#upgradeHint');
const upgradeButtons = [...document.querySelectorAll('[data-upgrade]')];
const upgradeCosts = { engine: [150, 300, 600], cannon: [250, 500, 900], reactor: [350, 700, 1200] };
const INVERSE_UNLOCK_SCORE = 100000;
const INVERSE_PLANET_VALUE = 480;
const BONUS_PLANET_CHANCE = .045;
const BONUS_PLANET_COOLDOWN = 12;
const planetImage = new Image();
planetImage.src = 'assets/planet.png';
const inversePlanetImage = new Image();
inversePlanetImage.src = 'assets/planet-inverse.png';
const bonusPlanetImage = new Image();
bonusPlanetImage.src = 'assets/bonus-planet.png';

const W = 960;
const H = 600;
const TAU = Math.PI * 2;
const input = { left: false, right: false, fire: false, pointerX: null };
let dpr = 1;
let state = createState('ready');
let lastTime = performance.now();
let rafId = 0;

function createState(phase) {
  return {
    phase, elapsed: 0, score: 0, level: 1, misses: 0, combo: 0, multiplier: 1,
    player: { x: W / 2, targetX: W / 2, vx: 0, speed: 440, engineLevel: 0, cannonLevel: 0, reactorLevel: 0 },
    planets: [], bolts: [], particles: [], stars: makeStars(), spawnTimer: .3, inverseSpawnTimer: 2, inverseUnlocked: false, bonusCooldown: 7, fireTimer: 0, shake: 0, flash: 0, penaltyNotice: 0
  };
}

function makeStars() {
  return Array.from({ length: 95 }, (_, i) => ({ x: (i * 127) % W, y: (i * 73) % H, size: i % 7 === 0 ? 2.2 : 1, speed: 10 + (i % 4) * 8, alpha: .25 + (i % 5) * .12 }));
}

function resizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.aspectRatio = `${W} / ${H}`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function startMission() {
  input.left = false;
  input.right = false;
  input.fire = false;
  input.pointerX = null;
  state = createState('playing');
  overlay.style.display = 'none';
  updateUi();
}

function endMission() {
  state.phase = 'over';
  state.shake = .35;
  overlayKicker.textContent = '// SIGNAL LOST';
  overlayTitle.textContent = 'MISSION OVER';
  overlayText.textContent = `You banked ${state.score.toLocaleString()} points. Restart and push your combo further.`;
  overlayButton.innerHTML = 'RESTART MISSION <span>↻</span>';
  overlay.style.display = 'grid';
  updateUi();
}

function update(dt) {
  state.elapsed += dt;
  state.shake = Math.max(0, state.shake - dt * 1.9);
  state.flash = Math.max(0, state.flash - dt * 3);
  state.penaltyNotice = Math.max(0, state.penaltyNotice - dt);
  updateAmbient(dt);
  if (state.phase !== 'playing') { updateParticles(dt); return; }
  state.level = Math.min(9, 1 + Math.floor(state.elapsed / 18));
  updatePlayer(dt);
  updateSpawning(dt);
  updateBolts(dt);
  updatePlanets(dt);
  updateParticles(dt);
  updateUi();
}

function updateAmbient(dt) {
  state.stars.forEach((star) => { star.y += star.speed * dt; if (star.y > H) star.y = -3; });
}

function updatePlayer(dt) {
  const p = state.player;
  const direction = Number(input.right) - Number(input.left);
  if (input.pointerX !== null) {
    p.targetX += (input.pointerX - p.targetX) * Math.min(1, dt * 14);
    p.vx += (((p.targetX - p.x) * 10) - p.vx) * Math.min(1, dt * 18);
  } else {
    const targetVelocity = direction * p.speed;
    p.vx += (targetVelocity - p.vx) * Math.min(1, dt * 13);
  }
  p.targetX = Math.max(42, Math.min(W - 42, p.targetX));
  p.x += p.vx * dt;
  if (p.x < 42 || p.x > W - 42) { p.x = Math.max(42, Math.min(W - 42, p.x)); p.vx *= .35; }
  state.fireTimer -= dt;
  if (input.fire && state.fireTimer <= 0) fire();
}

function updateSpawning(dt) {
  if (!state.inverseUnlocked && state.score >= INVERSE_UNLOCK_SCORE) {
    state.inverseUnlocked = true;
    state.inverseSpawnTimer = 1.5;
    upgradeHint.textContent = 'INVERSE SIGNAL UNLOCKED';
    burst(state.player.x, H - 43, '#76e0e0', 24, 180);
  }
  if (state.inverseUnlocked) {
    state.inverseSpawnTimer -= dt;
    if (state.inverseSpawnTimer <= 0 && !state.planets.some((planet) => planet.special)) {
      const radius = 34 + Math.random() * 8;
      state.planets.push({ special: true, x: 70 + Math.random() * (W - 140), y: -radius - 20, radius, speed: 70 + state.level * 5, hp: 5, maxHp: 5, rotation: Math.random() * TAU, spin: -.6 + Math.random() * 1.2, hue: 'inverse', pulse: Math.random() * TAU });
      state.inverseSpawnTimer = 6;
    }
  }
  state.spawnTimer -= dt;
  state.bonusCooldown = Math.max(0, state.bonusCooldown - dt);
  if (state.spawnTimer > 0) return;
  const difficulty = Math.min(.22, state.elapsed / 160);
  state.spawnTimer = Math.max(.26, .72 - difficulty) * (.78 + Math.random() * .35);
  const radius = 20 + Math.random() * 18;
  const bonus = state.bonusCooldown <= 0 && Math.random() < BONUS_PLANET_CHANCE;
  const tough = !bonus && state.level >= 3 && Math.random() < .25;
  if (bonus) state.bonusCooldown = BONUS_PLANET_COOLDOWN;
  state.planets.push({ bonus, x: 45 + Math.random() * (W - 90), y: -radius - 15, radius, speed: 62 + Math.random() * 45 + state.level * 5, hp: tough ? 2 : 1, maxHp: tough ? 2 : 1, rotation: Math.random() * TAU, spin: (Math.random() - .5) * 1.6, hue: tough ? 'violet' : bonus ? 'bonus' : 'orange', pulse: Math.random() * TAU });
}

function fire() {
  const p = state.player;
  const cannonLevel = p.cannonLevel;
  const offsets = cannonLevel >= 2 ? [-16, 16] : [0];
  if (cannonLevel >= 3) offsets.push(0);
  offsets.forEach((offset) => state.bolts.push({ x: p.x + offset, y: H - 83, previousY: H - 83, speed: 680, life: 0 }));
  state.fireTimer = Math.max(.12, .25 - cannonLevel * .035);
  burst(p.x, H - 58, '#ff8a64', 4, 65);
}

function updateBolts(dt) {
  state.bolts.forEach((bolt) => { bolt.previousY = bolt.y; bolt.y -= bolt.speed * dt; bolt.life += dt; });
  for (let i = state.bolts.length - 1; i >= 0; i--) {
    const bolt = state.bolts[i];
    let hitIndex = -1;
    for (let j = state.planets.length - 1; j >= 0; j--) {
      const planet = state.planets[j];
      if (Math.hypot(bolt.x - planet.x, bolt.y - planet.y) < planet.radius + 7) { hitIndex = j; break; }
    }
    if (hitIndex >= 0) {
      const planet = state.planets[hitIndex];
      state.bolts.splice(i, 1);
      planet.hp -= 1;
      burst(planet.x, planet.y, planet.hue === 'violet' ? '#c98bff' : '#ffd56a', planet.hp ? 5 : 13, planet.hp ? 80 : 155);
      if (planet.hp <= 0) {
        state.planets.splice(hitIndex, 1);
        state.combo += 1;
        state.multiplier = Math.min(5, 1 + Math.floor(state.combo / 4));
        if (planet.special) {
          state.score += INVERSE_PLANET_VALUE;
          state.flash = 1;
          state.shake = .25;
          burst(planet.x, planet.y, '#76e0e0', 28, 190);
        } else {
          const base = 100 + state.level * 20;
          state.score += Math.round(base * (1 + state.player.reactorLevel * .35) * state.multiplier);
        }
        state.flash = .7;
        state.shake = .16;
      }
    } else if (bolt.y < -30) state.bolts.splice(i, 1);
  }
}

function updatePlanets(dt) {
  const p = state.player;
  for (let i = state.planets.length - 1; i >= 0; i--) {
    const planet = state.planets[i];
    planet.y += planet.speed * dt;
    planet.rotation += planet.spin * dt;
    planet.pulse += dt * 3;
    if (planet.y > H - 90 && Math.abs(planet.x - p.x) < planet.radius + 28) { state.planets.splice(i, 1); missPlanet(planet.x, planet.y); continue; }
    if (planet.y > H + planet.radius) { state.planets.splice(i, 1); missPlanet(planet.x, H - 55); }
  }
}

function missPlanet(x, y) {
  state.misses += 1;
  state.combo = 0;
  state.multiplier = 1;
  const penaltyReached = state.misses >= 5;
  if (penaltyReached) {
    state.score = Math.max(0, state.score - 500);
    state.misses = 0;
    state.penaltyNotice = 1.25;
  }
  state.flash = penaltyReached ? 1 : .45;
  state.shake = .42;
  burst(x, y, '#ff8a64', 22, 220);
}

function burst(x, y, color, count, force) {
  for (let i = 0; i < count; i++) { const angle = Math.random() * TAU; const speed = force * (.35 + Math.random() * .75); state.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: .5 + Math.random() * .55, maxLife: 1, size: 1 + Math.random() * 3, color }); }
}

function updateParticles(dt) {
  const drag = Math.pow(.985, dt / .0167);
  for (let i = state.particles.length - 1; i >= 0; i--) { const particle = state.particles[i]; particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vx *= drag; particle.vy = particle.vy * drag + 24 * dt; particle.life -= dt; if (particle.life <= 0) state.particles.splice(i, 1); }
}

function draw() {
  ctx.save();
  const jolt = state.shake * 9;
  ctx.translate(Math.sin(state.elapsed * 78) * jolt * .42, Math.cos(state.elapsed * 91) * jolt * .34);
  drawBackground();
  drawPlanets();
  drawBolts();
  drawParticles();
  drawShip();
  ctx.restore();
  if (state.flash > 0) { ctx.fillStyle = `rgba(255,138,100,${state.flash * .08})`; ctx.fillRect(0, 0, W, H); }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H); gradient.addColorStop(0, '#111943'); gradient.addColorStop(1, '#070b1f'); ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(118,224,224,.08)'; ctx.beginPath(); ctx.arc(W * .72, H * .25, 190 + Math.sin(state.elapsed * .3) * 12, 0, TAU); ctx.fill();
  state.stars.forEach((star) => { ctx.globalAlpha = star.alpha; ctx.fillStyle = '#f4f0e7'; ctx.fillRect(star.x, star.y, star.size, star.size); }); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(118,224,224,.07)'; ctx.lineWidth = 1; for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); } for (let y = (state.elapsed * 18) % 64; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(255,138,100,.22)'; ctx.setLineDash([7, 11]); ctx.beginPath(); ctx.moveTo(0, H - 67); ctx.lineTo(W, H - 67); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#9aa0be'; ctx.font = '10px Courier New'; ctx.fillText('BREAK LINE', 26, H - 78); ctx.textAlign = 'right'; ctx.fillText(`SECTOR ${String(state.level).padStart(2, '0')}`, W - 26, 28); ctx.textAlign = 'left';
  if (state.penaltyNotice > 0) { ctx.textAlign = 'center'; ctx.fillStyle = '#ff8a64'; ctx.font = 'bold 15px Courier New'; ctx.fillText('PENALTY  -500 POINTS', W / 2, 34); ctx.textAlign = 'left'; }
}

function drawPlanets() {
  state.planets.forEach((planet) => {
    ctx.save();
    ctx.translate(planet.x, planet.y);
    ctx.rotate(planet.rotation * .18);
    const scale = 1 + Math.sin(planet.pulse) * .025;
    ctx.scale(scale, scale);
    ctx.shadowBlur = 18;
    ctx.shadowColor = planet.special ? '#76e0e0' : planet.bonus ? '#ffd56a' : planet.hue === 'violet' ? '#c98bff' : '#ff8a64';
    const image = planet.special ? inversePlanetImage : planet.bonus ? bonusPlanetImage : planetImage;
    if (image.complete && image.naturalWidth) {
      const imageWidth = planet.radius * 3.5;
      const imageHeight = imageWidth * image.naturalHeight / image.naturalWidth;
      ctx.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
    } else {
      ctx.fillStyle = planet.hue === 'violet' ? '#8058a9' : planet.bonus ? '#27c9e8' : '#bb5c4e';
      ctx.strokeStyle = '#ffd56a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, planet.radius, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    if (planet.bonus) {
      ctx.fillStyle = '#ffd56a';
      ctx.font = 'bold 10px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText('BONUS', 0, planet.radius + 20);
    }
    if (planet.special) {
      ctx.fillStyle = '#76e0e0';
      ctx.font = 'bold 11px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(`${planet.hp}X`, 0, 4);
      ctx.fillText('+480 ◆', 0, planet.radius + 25);
    } else if (planet.maxHp > 1) {
      ctx.fillStyle = '#f4f0e7';
      ctx.font = 'bold 11px Courier New';
      ctx.textAlign = 'center';
      ctx.fillText(`${planet.hp}X`, 0, 4);
    }
    ctx.restore();
  });
}

function drawBolts() { state.bolts.forEach((bolt) => { ctx.save(); ctx.globalAlpha = .24; ctx.strokeStyle = '#ffd56a'; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(bolt.x, bolt.previousY + 6); ctx.lineTo(bolt.x, bolt.y + 5); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 18; ctx.shadowColor = '#ffd56a'; ctx.fillStyle = '#ffd56a'; ctx.fillRect(bolt.x - 3, bolt.y - 15, 6, 24); ctx.fillStyle = '#ff8a64'; ctx.fillRect(bolt.x - 1, bolt.y - 20, 2, 7); ctx.restore(); }); }
function drawParticles() { state.particles.forEach((particle) => { ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife); ctx.fillStyle = particle.color; ctx.fillRect(particle.x, particle.y, particle.size, particle.size); }); ctx.globalAlpha = 1; }
function drawShip() { const p = state.player; const flame = 16 + Math.sin(state.elapsed * 20) * 4 + Math.min(10, Math.abs(p.vx) * .02); ctx.save(); ctx.translate(p.x, H - 43); ctx.shadowBlur = 20; ctx.shadowColor = '#76e0e0'; ctx.fillStyle = '#76e0e0'; ctx.strokeStyle = '#070b1f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -33); ctx.lineTo(31, 24); ctx.lineTo(0, 14); ctx.lineTo(-31, 24); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0; ctx.fillStyle = '#18265a'; ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(10, 9); ctx.lineTo(-10, 9); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#ff8a64'; ctx.beginPath(); ctx.moveTo(-6, 19); ctx.lineTo(6, 19); ctx.lineTo(0, flame + 20); ctx.closePath(); ctx.fill(); if (p.cannonLevel >= 2) { ctx.fillRect(-22, 15, 5, 22); ctx.fillRect(17, 15, 5, 22); } ctx.restore(); }

function buyUpgrade(type) {
  if (state.phase !== 'playing') return;
  const key = `${type}Level`;
  const level = state.player[key];
  const cost = upgradeCosts[type][level];
  if (cost === undefined || state.score < cost) return;
  state.score -= cost;
  state.player[key] += 1;
  if (type === 'engine') state.player.speed += 85;
  if (type === 'reactor') state.flash = .4;
  burst(state.player.x, H - 43, '#76e0e0', 16, 120);
  updateUi();
}

function updateUi() {
  scoreOutput.textContent = String(state.score).padStart(4, '0');
  levelOutput.textContent = String(state.level).padStart(2, '0');
  shieldOutput.textContent = String(state.misses).padStart(2, '0');
  comboOutput.textContent = `x${state.multiplier}`;
  upgradeHint.textContent = state.penaltyNotice > 0 ? 'PENALTY: -500 POINTS' : state.inverseUnlocked ? 'INVERSE PLANET SIGNAL ACTIVE' : state.phase === 'playing' ? 'SPEND POINTS IN FLIGHT' : 'EARN POINTS TO UPGRADE';
  upgradeButtons.forEach((button) => { const type = button.dataset.upgrade; const level = state.player[`${type}Level`]; const cost = upgradeCosts[type][level]; const costOutput = button.querySelector('.upgrade-cost'); costOutput.textContent = cost === undefined ? 'MAX' : `${cost} ◆`; button.disabled = state.phase !== 'playing' || cost === undefined || state.score < cost; button.dataset.level = level; });
}

function loop(now) { const dt = Math.min(.035, Math.max(0, (now - lastTime) / 1000)); lastTime = now; update(dt); draw(); rafId = requestAnimationFrame(loop); }

function canvasPoint(event) { const rect = canvas.getBoundingClientRect(); return (event.clientX - rect.left) * W / rect.width; }
function setKey(event, down) { const key = event.key.toLowerCase(); if (down && ['a', 'arrowleft', 'd', 'arrowright'].includes(key)) input.pointerX = null; if (['a', 'arrowleft'].includes(key)) input.left = down; if (['d', 'arrowright'].includes(key)) input.right = down; if (event.code === 'Space') { input.fire = down; event.preventDefault(); } }

window.addEventListener('resize', resizeCanvas);
window.addEventListener('keydown', (event) => { setKey(event, true); if (event.key === 'Enter' && state.phase !== 'playing') startMission(); });
window.addEventListener('keyup', (event) => setKey(event, false));
canvas.addEventListener('pointermove', (event) => { input.pointerX = canvasPoint(event); });
canvas.addEventListener('pointerleave', () => { input.pointerX = null; });
canvas.addEventListener('pointerdown', (event) => { canvas.setPointerCapture?.(event.pointerId); input.pointerX = canvasPoint(event); input.fire = true; if (state.phase !== 'playing') startMission(); });
window.addEventListener('pointerup', () => { input.fire = false; });
window.addEventListener('pointercancel', () => { input.fire = false; });
overlayButton.addEventListener('click', startMission);
restartButton.addEventListener('click', startMission);
upgradeButtons.forEach((button) => button.addEventListener('click', () => buyUpgrade(button.dataset.upgrade)));

resizeCanvas();
updateUi();
draw();
rafId = requestAnimationFrame(loop);
