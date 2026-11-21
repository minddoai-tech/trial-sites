const modal = document.querySelector('#game-modal');
const canvas = document.querySelector('#game-canvas');
const ctx = canvas.getContext('2d');
const overlay = document.querySelector('#game-overlay');
const overlayLabel = document.querySelector('#overlay-label');
const scoreOutput = document.querySelector('#modal-score');
const titleOutput = document.querySelector('#modal-title');
const kickerOutput = document.querySelector('#modal-kicker');
const instructionsOutput = document.querySelector('#modal-instructions');
const controlsOutput = document.querySelector('#modal-controls');
const startButton = document.querySelector('#start-game');

const games = {
  chef: { title: 'Fast Food Chef', kicker: '// ORDER UP', instructions: 'Click the matching food before the order expires.', controls: 'MOUSE / CLICK' },
  flood: { title: 'Floodbound', kicker: '// RIDE THE RISE', instructions: 'Steer the raft, collect supplies, and avoid floating debris.', controls: 'A / D / ARROWS / TAP' },
  meteor: { title: 'Meteor Shooter', kicker: '// CLEAR THE SKY', instructions: 'Move with A / D and press SPACE or click to fire.', controls: 'A / D + SPACE / CLICK' }
};

let activeGame = null;
let running = false;
let animationId = 0;
let lastFrame = 0;
let score = 0;
let keys = {};
let gameState = {};

document.querySelectorAll('[data-game]').forEach((button) => {
  button.addEventListener('click', () => openGame(button.dataset.game));
});
document.querySelectorAll('[data-close-game]').forEach((button) => button.addEventListener('click', closeGame));
document.addEventListener('keydown', (event) => {
  keys[event.key.toLowerCase()] = true;
  if (event.key === 'Escape' && modal.classList.contains('is-open')) closeGame();
  if (event.code === 'Space' && activeGame === 'meteor' && running) { event.preventDefault(); shootMeteor(); }
});
document.addEventListener('keyup', (event) => { keys[event.key.toLowerCase()] = false; });
startButton.addEventListener('click', startGame);
canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  if (activeGame === 'chef' && running) chefClick(point.x, point.y);
  if (activeGame === 'flood' && running) selectFloodLane(point.x);
  if (activeGame === 'meteor' && running) { gameState.ship.x = point.x; shootMeteor(); }
});
window.addEventListener('resize', drawDemos);

function openGame(type) {
  activeGame = type;
  const game = games[type];
  titleOutput.textContent = game.title;
  kickerOutput.textContent = game.kicker;
  instructionsOutput.textContent = game.instructions;
  controlsOutput.textContent = game.controls;
  score = 0;
  scoreOutput.textContent = '0000';
  overlayLabel.textContent = 'READY?';
  startButton.innerHTML = 'START GAME <span>→</span>';
  overlay.style.display = 'flex';
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  drawGame(0);
  startButton.focus();
}

function closeGame() {
  running = false;
  cancelAnimationFrame(animationId);
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  keys = {};
}

function startGame() {
  running = true;
  score = 0;
  scoreOutput.textContent = '0000';
  overlay.style.display = 'none';
  gameState = activeGame === 'chef' ? newChefState() : activeGame === 'flood' ? newFloodState() : newMeteorState();
  lastFrame = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

function gameLoop(now) {
  if (!running) return;
  const dt = Math.min((now - lastFrame) / 1000, 0.04);
  lastFrame = now;
  updateGame(dt);
  drawGame(now);
  animationId = requestAnimationFrame(gameLoop);
}

function updateGame(dt) {
  if (activeGame === 'chef') updateChef(dt);
  if (activeGame === 'flood') updateFlood(dt);
  if (activeGame === 'meteor') updateMeteor(dt);
}

function drawGame(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (activeGame === 'chef') drawChef(ctx, canvas.width, canvas.height, gameState, now, true);
  if (activeGame === 'flood') drawFlood(ctx, canvas.width, canvas.height, gameState, now, true);
  if (activeGame === 'meteor') drawMeteor(ctx, canvas.width, canvas.height, gameState, now, true);
}

function newChefState() { return { order: 0, timer: 4, foods: [], spawn: 0, flash: 0 }; }
function updateChef(dt) {
  const s = gameState; s.timer -= dt; s.spawn -= dt; s.flash = Math.max(0, s.flash - dt);
  if (s.spawn <= 0) { s.spawn = .85; s.foods.push({ type: Math.floor(Math.random() * 3), x: 110 + Math.random() * 680, y: 420 + Math.random() * 45, size: 30, drift: Math.random() * 2 }); }
  s.foods.forEach((food) => { food.y -= dt * 38; food.drift += dt; food.x += Math.sin(food.drift) * dt * 10; });
  s.foods = s.foods.filter((food) => food.y > -50);
  if (s.timer <= 0) endGame('KITCHEN CLOSED');
}
function chefClick(x, y) {
  const s = gameState; const hit = s.foods.findIndex((food) => Math.hypot(food.x - x, food.y - y) < 42);
  if (hit > -1) { s.foods.splice(hit, 1); s.order += 1; score += 100; s.timer = Math.min(4.5, s.timer + .7); s.flash = .2; scoreOutput.textContent = String(score).padStart(4, '0'); }
}
function drawChef(c, w, h, s, now, full) {
  c.fillStyle = '#ff9a73'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(17,17,20,.08)';
  for (let x = 0; x < w; x += 32) for (let y = 0; y < h; y += 32) c.fillRect(x + ((y / 32) % 2) * 16, y, 16, 16);
  c.fillStyle = '#c84d38'; c.fillRect(0, h - 105, w, 105); c.fillStyle = '#111114'; c.fillRect(0, h - 105, w, 3);
  c.fillStyle = '#252129'; c.beginPath(); c.ellipse(w / 2, h - 82, 130, 28, -.1, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3f3a42'; c.beginPath(); c.ellipse(w / 2, h - 92, 84, 18, -.1, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#ffd45a'; c.font = '500 15px DM Mono, monospace'; c.fillText('ORDER ' + String(s?.order || 0).padStart(2, '0'), 28, 42); c.fillText('TIME ' + Math.max(0, s?.timer || 4).toFixed(1), w - 170, 42);
  (s?.foods || []).forEach((food) => { drawFood(c, food.x, food.y, food.type, food.size); });
  if (s?.flash) { c.fillStyle = 'rgba(255,212,90,.25)'; c.fillRect(0, 0, w, h); }
  if (!full) { c.fillStyle = '#ff704a'; c.fillRect(w * .56, h * .55, 5, 5); }
}
function drawFood(c, x, y, type, size) { c.save(); c.translate(x, y); c.fillStyle = type === 0 ? '#ffd45a' : type === 1 ? '#7bd8ed' : '#bd91ff'; c.strokeStyle = '#111114'; c.lineWidth = 5; c.beginPath(); if (type === 0) c.arc(0, 0, size, 0, Math.PI * 2); if (type === 1) { c.moveTo(0, -size); c.lineTo(size, size); c.lineTo(-size, size); c.closePath(); } if (type === 2) { for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 / 8) * i; c.lineTo(Math.cos(a) * size, Math.sin(a) * size); } c.closePath(); } c.fill(); c.stroke(); c.restore(); }

function newFloodState() {
  return { raftX: 450, targetX: 450, waterline: 370, debris: [], supplies: [], debrisSpawn: .6, supplySpawn: 1.2, time: 0, collected: 0, wave: 0 };
}
function selectFloodLane(x) {
  if (!gameState || activeGame !== 'flood') return;
  gameState.targetX = Math.max(55, Math.min(canvas.width - 55, x));
}
function updateFlood(dt) {
  const s = gameState;
  s.time += dt;
  s.wave += dt * 3;
  s.waterline = Math.max(150, 370 - s.time * 4.4);
  if (keys.a || keys.arrowleft) s.targetX -= 270 * dt;
  if (keys.d || keys.arrowright) s.targetX += 270 * dt;
  s.targetX = Math.max(55, Math.min(canvas.width - 55, s.targetX));
  s.raftX += (s.targetX - s.raftX) * Math.min(1, dt * 12);
  s.debrisSpawn -= dt;
  s.supplySpawn -= dt;
  if (s.debrisSpawn <= 0) {
    s.debrisSpawn = Math.max(.38, .9 - s.time / 90);
    s.debris.push({ x: 45 + Math.random() * (canvas.width - 90), y: -50, size: 20 + Math.random() * 12, speed: 110 + Math.random() * 70, angle: Math.random() * 2 });
  }
  if (s.supplySpawn <= 0) {
    s.supplySpawn = 1.25 + Math.random() * .8;
    s.supplies.push({ x: 55 + Math.random() * (canvas.width - 110), y: -25, size: 18, speed: 90 + Math.random() * 35, spin: Math.random() * 6 });
  }
  s.debris.forEach((item) => { item.y += item.speed * dt; item.angle += dt * 2; });
  s.supplies.forEach((item) => { item.y += item.speed * dt; item.spin += dt * 3; });
  const raftY = s.waterline - 22;
  for (const item of s.debris) if (Math.hypot(item.x - s.raftX, item.y - raftY) < item.size + 30) { endGame('WASHED OUT'); return; }
  s.supplies = s.supplies.filter((item) => {
    if (Math.hypot(item.x - s.raftX, item.y - raftY) < item.size + 30) { s.collected += 1; return false; }
    return item.y < canvas.height + 40;
  });
  s.debris = s.debris.filter((item) => item.y < canvas.height + 70);
  if (s.waterline <= 150) { endGame('THE FLOOD WON'); return; }
  score = Math.floor(s.time * 65 + s.collected * 250);
  scoreOutput.textContent = String(score).padStart(4, '0');
}
function drawFlood(c, w, h, s, now, full) {
  const waterline = s?.waterline ?? 370;
  const raftX = s?.raftX ?? w / 2;
  const raftY = waterline - 22;
  c.fillStyle = '#8cdded'; c.fillRect(0, 0, w, h);
  c.fillStyle = '#e9f0c8'; c.fillRect(0, 100, w, Math.max(0, waterline - 100));
  c.fillStyle = '#f8c45a'; c.beginPath(); c.arc(w * .78, 118, 48, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#547f75'; c.fillRect(0, waterline - 56, w, 56);
  c.fillStyle = 'rgba(17,17,20,.2)'; for (let x = 0; x < w; x += 76) c.fillRect(x, waterline - 56 - (x % 3) * 7, 44, 5);
  const water = c.createLinearGradient(0, waterline, 0, h); water.addColorStop(0, '#3f9bb2'); water.addColorStop(1, '#173a62'); c.fillStyle = water; c.fillRect(0, waterline, w, h - waterline);
  c.strokeStyle = '#7bd8ed'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, waterline); c.lineTo(w, waterline); c.stroke();
  c.strokeStyle = 'rgba(242,240,233,.55)'; c.lineWidth = 3;
  for (let x = -50; x < w + 60; x += 100) { const wave = Math.sin((x + (s?.wave || 0) * 20) / 26) * 5; c.beginPath(); c.moveTo(x, waterline + 25 + wave); c.lineTo(x + 54, waterline + 25 - wave); c.stroke(); }
  c.fillStyle = '#111114'; c.font = '500 13px Courier New, monospace'; c.fillText('SCORE ' + String(score).padStart(4, '0'), 28, 34); c.fillText('SUPPLIES ' + String(s?.collected || 0).padStart(2, '0'), 28, 56); c.textAlign = 'right'; c.fillText('WATER RISING', w - 28, 34); c.textAlign = 'left';
  (s?.supplies || []).forEach((item) => drawSupply(c, item.x, item.y, item.spin));
  (s?.debris || []).forEach((item) => drawDebris(c, item.x, item.y, item.size, item.angle));
  drawRaft(c, raftX, raftY);
}
function drawSupply(c, x, y, spin) { c.save(); c.translate(x, y); c.rotate(Math.sin(spin) * .12); c.fillStyle = '#ffd45a'; c.strokeStyle = '#111114'; c.lineWidth = 4; c.fillRect(-18, -15, 36, 30); c.strokeRect(-18, -15, 36, 30); c.strokeStyle = '#ff704a'; c.beginPath(); c.moveTo(-18, 0); c.lineTo(18, 0); c.moveTo(0, -15); c.lineTo(0, 15); c.stroke(); c.restore(); }
function drawDebris(c, x, y, size, angle) { c.save(); c.translate(x, y); c.rotate(angle); c.fillStyle = '#7d4936'; c.strokeStyle = '#111114'; c.lineWidth = 4; c.fillRect(-size, -9, size * 2, 18); c.strokeRect(-size, -9, size * 2, 18); c.fillStyle = '#bd91ff'; c.fillRect(-size + 8, -5, 9, 10); c.restore(); }
function drawRaft(c, x, y) { c.save(); c.translate(x, y); c.fillStyle = '#a95d36'; c.strokeStyle = '#111114'; c.lineWidth = 4; c.beginPath(); c.ellipse(0, 0, 50, 14, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.fillStyle = '#f2f0e9'; c.fillRect(-5, -48, 8, 38); c.fillStyle = '#ffd45a'; c.beginPath(); c.moveTo(2, -47); c.lineTo(35, -20); c.lineTo(2, -20); c.closePath(); c.fill(); c.stroke(); c.restore(); }

function newMeteorState() { return { ship: { x: 450 }, rocks: [], shots: [], spawn: 0, time: 0 }; }
function updateMeteor(dt) { const s = gameState; s.time += dt; if (keys.a || keys.arrowleft) s.ship.x -= 330 * dt; if (keys.d || keys.arrowright) s.ship.x += 330 * dt; s.ship.x = Math.max(35, Math.min(865, s.ship.x)); s.spawn -= dt; if (s.spawn <= 0) { s.spawn = Math.max(.32, .75 - s.time / 80); s.rocks.push({ x: 35 + Math.random() * 830, y: -35, size: 18 + Math.random() * 18, speed: 100 + Math.random() * 70, spin: Math.random() * 6 }); } s.rocks.forEach((rock) => { rock.y += rock.speed * dt; rock.spin += dt; }); s.shots.forEach((shot) => shot.y -= 500 * dt); for (let i = s.shots.length - 1; i >= 0; i--) { const shot = s.shots[i]; let hit = -1; for (let j = 0; j < s.rocks.length; j++) if (Math.hypot(shot.x - s.rocks[j].x, shot.y - s.rocks[j].y) < s.rocks[j].size + 8) { hit = j; break; } if (hit > -1) { s.rocks.splice(hit, 1); s.shots.splice(i, 1); score += 125; scoreOutput.textContent = String(score).padStart(4, '0'); } } s.shots = s.shots.filter((shot) => shot.y > -30); for (const rock of s.rocks) if (rock.y > 550) endGame('SKY OVERRUN'); }
function shootMeteor() { if (gameState.shots && gameState.shots.length < 8) gameState.shots.push({ x: gameState.ship.x, y: 445 }); }
function drawMeteor(c, w, h, s) { c.fillStyle = '#24204f'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2f0e9'; for (let i = 0; i < 45; i++) { const x = (i * 197) % w; const y = (i * 83) % h; c.fillRect(x, y, 2, 2); } c.fillStyle = '#ffd45a'; c.font = '500 15px DM Mono, monospace'; c.fillText('TARGETS ' + String(s?.rocks?.length || 0).padStart(2, '0'), 28, 42); (s?.shots || []).forEach((shot) => { c.fillStyle = '#ffd45a'; c.fillRect(shot.x - 3, shot.y - 13, 6, 22); }); (s?.rocks || []).forEach((rock) => { c.save(); c.translate(rock.x, rock.y); c.rotate(rock.spin); c.fillStyle = '#ff704a'; c.strokeStyle = '#ffd45a'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, -rock.size); c.lineTo(rock.size, 0); c.lineTo(0, rock.size); c.lineTo(-rock.size, 0); c.closePath(); c.fill(); c.stroke(); c.restore(); }); c.save(); c.translate(s?.ship?.x || 450, 458); c.fillStyle = '#7bd8ed'; c.strokeStyle = '#111114'; c.lineWidth = 4; c.beginPath(); c.moveTo(0, -30); c.lineTo(26, 24); c.lineTo(0, 15); c.lineTo(-26, 24); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#ff704a'; c.fillRect(-5, 24, 10, 19); c.restore(); }

function endGame(message) { running = false; cancelAnimationFrame(animationId); overlayLabel.textContent = message; startButton.innerHTML = 'PLAY AGAIN <span>↗</span>'; overlay.style.display = 'flex'; }
function canvasPoint(event) { const box = canvas.getBoundingClientRect(); return { x: (event.clientX - box.left) * canvas.width / box.width, y: (event.clientY - box.top) * canvas.height / box.height }; }

const demoContexts = {
  chef: document.querySelector('#demo-chef').getContext('2d'),
  flood: document.querySelector('#demo-flood').getContext('2d'),
  meteor: document.querySelector('#demo-meteor').getContext('2d')
};
function drawDemos() { const now = performance.now(); drawDemoChef(demoContexts.chef, now); drawDemoFlood(demoContexts.flood, now); drawDemoMeteor(demoContexts.meteor, now); }
function loopDemos(now) {
  if (!modal.classList.contains('is-open') && !document.hidden) {
    drawDemoChef(demoContexts.chef, now); drawDemoFlood(demoContexts.flood, now); drawDemoMeteor(demoContexts.meteor, now);
  }
  requestAnimationFrame(loopDemos);
}
function drawDemoChef(c, now) { const w=c.canvas.width,h=c.canvas.height; drawChef(c,w,h,{order:Math.floor(now/1000)%5,timer:3.4,foods:[{type:Math.floor(now/650)%3,x:160+(now/10)%210,y:145,size:25,drift:now/800},{type:2,x:360-(now/16)%160,y:175,size:22,drift:now/900}]},now,false); }
function drawDemoFlood(c, now) { const w=c.canvas.width,h=c.canvas.height; const waterline=145 + Math.sin(now / 850) * 15; const s={waterline,raftX:w / 2 + Math.sin(now / 630) * 105,supplies:[{x:150+(now/4)%260,y:128,spin:now/500}],debris:[{x:330+(now/8)%150,y:84,size:18,angle:now/700},{x:430-(now/10)%180,y:170,size:23,angle:-now/900}],collected:2,wave:now/500}; drawFlood(c,w,h,s,now,false); }
function drawDemoMeteor(c, now) { const w=c.canvas.width,h=c.canvas.height; const rocks=[...Array(5)].map((_,i)=>({x:(i*113+80+(now/18)%(w-80))%w,y:(i*67+(now/5)%(h+100))-50,size:12+(i%3)*5,spin:now/900+i})); drawMeteor(c,w,h,{ship:{x:w/2+Math.sin(now/700)*130},rocks,shots:[{x:w/2,y:(now/2)%h}]},now,false); }
drawDemos(); requestAnimationFrame(loopDemos);
