const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const ui = {
  honey: document.querySelector('#honey'),
  bestHoney: document.querySelector('#bestHoney'),
  pollen: document.querySelector('#pollen'),
  capacity: document.querySelector('#capacity'),
  meter: document.querySelector('#pollenMeter'),
  timer: document.querySelector('#timer'),
  bees: document.querySelector('#beeList'),
  gameOver: document.querySelector('#gameOver'),
  finalHoney: document.querySelector('#finalHoney'),
  shopMessage: document.querySelector('#shopMessage'),
  tool: document.querySelector('#toolButton'),
  bag: document.querySelector('#bagButton'),
  toolCost: document.querySelector('#toolCost'),
  bagCost: document.querySelector('#bagCost')
};

const keys = new Set();

const patches = [
  { x: 285, y: 150, r: 92, color: '#d8a7ce', name: 'Clover patch', value: 1 },
  { x: 515, y: 185, r: 95, color: '#f6c85d', name: 'Sunflower patch', value: 1.2 },
  { x: 755, y: 155, r: 86, color: '#a7c9ee', name: 'Bluebell patch', value: 1.5 },
  { x: 330, y: 410, r: 105, color: '#ef9a9d', name: 'Rose patch', value: 1.1 },
  { x: 625, y: 410, r: 110, color: '#f6c85d', name: 'Sunflower patch', value: 1.2 },
  { x: 830, y: 400, r: 72, color: '#d8a7ce', name: 'Clover patch', value: 1 }
];

let game;

function resetGame() {
  game = {
    x: 115,
    y: 300,
    pollen: 0,
    honey: 0,
    bestHoney: loadBestScore(),
    capacity: 40,
    gather: 1,
    toolLevel: 1,
    bagLevel: 1,
    seconds: 180,
    running: true,
    bees: [
      { x: 85, y: 260, phase: 0 },
      { x: 84, y: 340, phase: 2 },
      { x: 56, y: 300, phase: 4 }
    ]
  };

  ui.gameOver.classList.add('hidden');
  ui.shopMessage.textContent = '';
  updateUI();
}

function resizeCanvas() {
  const scale = canvas.clientWidth / W;
  canvas.style.height = `${W * scale * H / W}px`;
}

function updateUI() {
  ui.honey.textContent = Math.floor(game.honey);
  ui.bestHoney.textContent = Math.max(
    Math.floor(game.bestHoney),
    Math.floor(game.honey)
  );
  ui.pollen.textContent = Math.floor(game.pollen);
  ui.capacity.textContent = game.capacity;
  ui.meter.style.width = `${Math.min(100, game.pollen / game.capacity * 100)}%`;

  const minutes = Math.floor(game.seconds / 60);
  const seconds = Math.floor(game.seconds % 60);
  ui.timer.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  ui.bees.innerHTML = game.bees
    .map(() => '<span class="bee-chip" title="Busy bee">🐝</span>')
    .join('');

  ui.toolCost.textContent = `${game.toolLevel * 35} 🍯`;
  ui.bagCost.textContent = `${game.bagLevel * 50} 🍯`;
  ui.tool.disabled = game.honey < game.toolLevel * 35;
  ui.bag.disabled = game.honey < game.bagLevel * 50;
}

function nearHive() {
  return game.x < 185 && game.y > 220 && game.y < 380;
}

function activePatch() {
  return patches.find(
    (patch) => Math.hypot(game.x - patch.x, game.y - patch.y) < patch.r
  );
}

function move(dt) {
  let dx = 0;
  let dy = 0;

  if (keys.has('ArrowLeft') || keys.has('a')) dx--;
  if (keys.has('ArrowRight') || keys.has('d')) dx++;
  if (keys.has('ArrowUp') || keys.has('w')) dy--;
  if (keys.has('ArrowDown') || keys.has('s')) dy++;

  const length = Math.hypot(dx, dy) || 1;
  game.x = Math.max(27, Math.min(W - 27, game.x + dx / length * 190 * dt));
  game.y = Math.max(27, Math.min(H - 27, game.y + dy / length * 190 * dt));
}

function gather(dt) {
  const patch = activePatch();

  if (patch && (keys.has(' ') || keys.has('Space'))) {
    game.pollen = Math.min(
      game.capacity,
      game.pollen + game.gather * patch.value * 11 * dt
    );
  }

  if (nearHive() && game.pollen > 0) {
    game.honey += game.pollen * 0.8 * dt;
    game.pollen = Math.max(0, game.pollen - 30 * dt);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#b9d99e';
  ctx.fillRect(0, 0, W, H);

  drawTerrain();
  patches.forEach(drawPatch);
  drawHive();
  drawShop();
  drawBees();
  drawPlayer();
  drawHints();
}

function drawTerrain() {
  ctx.fillStyle = '#a9ce8e';

  for (let x = 0; x < W; x += 48) {
    for (let y = 0; y < H; y += 48) {
      ctx.beginPath();
      ctx.arc(x + (y / 48) % 2 * 12, y + 8, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = '#cfe7b6';
  ctx.fillRect(0, 0, W, 11);
  ctx.fillRect(0, H - 11, W, 11);
}

function drawPatch(patch) {
  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = '#9dc884';
  ctx.beginPath();
  ctx.arc(patch.x, patch.y, patch.r + 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = patch.color;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.arc(patch.x, patch.y, patch.r, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 13; i++) {
    const angle = i * 2.4;
    const radius = 18 + (i * 23) % (patch.r - 14);
    const flowerX = patch.x + Math.cos(angle) * radius;
    const flowerY = patch.y + Math.sin(angle) * radius;

    ctx.fillStyle = i % 2 ? '#fff8df' : '#fff';
    ctx.beginPath();
    ctx.arc(flowerX - 4, flowerY, 4, 0, Math.PI * 2);
    ctx.arc(flowerX + 4, flowerY, 4, 0, Math.PI * 2);
    ctx.arc(flowerX, flowerY - 4, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#efb42f';
    ctx.beginPath();
    ctx.arc(flowerX, flowerY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawHive() {
  ctx.fillStyle = '#f5c45e';
  ctx.beginPath();
  ctx.roundRect(35, 218, 125, 164, 20);
  ctx.fill();

  ctx.fillStyle = '#e49b36';
  for (let y = 238; y < 365; y += 30) {
    ctx.fillRect(35, y, 125, 9);
  }

  ctx.fillStyle = '#493b2b';
  ctx.beginPath();
  ctx.ellipse(100, 302, 30, 39, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#fff5d5';
  ctx.font = '700 14px DM Sans';
  ctx.textAlign = 'center';
  ctx.fillText('HIVE', 98, 205);
  ctx.font = '12px DM Sans';
  ctx.fillText('convert pollen', 98, 405);
}

function drawShop() {
  ctx.save();
  ctx.fillStyle = '#fff8dc';
  ctx.strokeStyle = '#d59a36';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(42, 454, 112, 82, 9);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#d59a36';
  ctx.beginPath();
  ctx.roundRect(34, 443, 128, 22, 8);
  ctx.fill();

  ctx.fillStyle = '#f8cf63';
  for (let x = 42; x < 158; x += 28) {
    ctx.fillRect(x, 443, 14, 22);
  }

  ctx.fillStyle = '#6a4b2d';
  ctx.fillRect(79, 493, 31, 43);
  ctx.fillStyle = '#fffdf5';
  ctx.font = '700 13px DM Sans';
  ctx.textAlign = 'center';
  ctx.fillText('HIVE SHOP', 98, 480);
  ctx.font = '11px DM Sans';
  ctx.fillText('upgrades', 98, 553);
  ctx.restore();
}

function drawBees() {
  game.bees.forEach((bee) => {
    const time = performance.now();
    const targetX = game.x + Math.cos(time / 500 + bee.phase) * 27;
    const targetY = game.y + Math.sin(time / 500 + bee.phase) * 27;

    bee.x += (targetX - bee.x) * 0.08;
    bee.y += (targetY - bee.y) * 0.08;

    ctx.save();
    ctx.translate(bee.x, bee.y);
    ctx.fillStyle = '#fff9dc';
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(-7, -7, 9, 6, -0.5, 0, Math.PI * 2);
    ctx.ellipse(7, -7, 9, 6, 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#efb42f';
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5b432b';
    ctx.fillRect(-5, -7, 3, 14);
    ctx.fillRect(3, -7, 3, 14);
    ctx.restore();
  });
}

function drawPlayer() {
  ctx.fillStyle = '#2d7555';
  ctx.beginPath();
  ctx.arc(game.x, game.y, 15, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f5d7a5';
  ctx.beginPath();
  ctx.arc(game.x, game.y - 15, 9, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = '#7c5434';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(game.x + 10, game.y + 7);
  ctx.lineTo(game.x + 25, game.y - 14);
  ctx.stroke();
}

function drawHints() {
  const patch = activePatch();
  ctx.textAlign = 'center';
  ctx.font = '600 12px DM Sans';

  if (patch && game.pollen < game.capacity) {
    ctx.fillStyle = '#fffdf5dd';
    ctx.fillText('HOLD SPACE TO GATHER', game.x, game.y - 34);
  }

  if (nearHive() && game.pollen > 0) {
    ctx.fillStyle = '#fffdf5dd';
    ctx.fillText('BEES ARE MAKING HONEY', 98, 435);
  }
}

function buy(type) {
  const cost = type === 'tool' ? game.toolLevel * 35 : game.bagLevel * 50;

  if (game.honey < cost) {
    ui.shopMessage.textContent = 'Gather more honey first.';
    return;
  }

  game.honey -= cost;

  if (type === 'tool') {
    game.toolLevel++;
    game.gather += 0.65;
    ui.shopMessage.textContent = 'Your scooper is stronger!';
  } else {
    game.bagLevel++;
    game.capacity += 25;
    ui.shopMessage.textContent = 'Your backpack is roomier!';
  }

  updateUI();
}

function loadBestScore() {
  return Number(localStorage.getItem('honeyboundBest') || 0);
}

function saveBestScore(score) {
  const bestScore = Math.max(loadBestScore(), Math.floor(score));
  localStorage.setItem('honeyboundBest', bestScore);
  return bestScore;
}

function loop(now) {
  if (!loop.last) loop.last = now;
  const dt = Math.min(0.05, (now - loop.last) / 1000);
  loop.last = now;

  if (game.running) {
    move(dt);
    gather(dt);
    game.seconds -= dt;

    if (game.seconds <= 0) {
      game.seconds = 0;
      game.running = false;
      game.bestHoney = saveBestScore(game.honey);
      ui.finalHoney.textContent = Math.floor(game.honey);
      ui.gameOver.classList.remove('hidden');
    }

    updateUI();
  }

  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
    event.preventDefault();
  }

  keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});

window.addEventListener('resize', resizeCanvas);
ui.tool.addEventListener('click', () => buy('tool'));
ui.bag.addEventListener('click', () => buy('bag'));
document.querySelector('#restartButton').addEventListener('click', resetGame);
document.querySelector('#playAgainButton').addEventListener('click', resetGame);

resetGame();
resizeCanvas();
requestAnimationFrame(loop);
