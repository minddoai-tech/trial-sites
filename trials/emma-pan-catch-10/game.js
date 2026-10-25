const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;
const levelTargets = [10, 15, 20];

const ui = {
  level: document.querySelector('#level'),
  goal: document.querySelector('#goal'),
  caught: document.querySelector('#caught'),
  caughtGoal: document.querySelector('#caughtGoal'),
  lives: document.querySelector('#lives'),
  progress: document.querySelector('#progressFill'),
  livesProgress: document.querySelector('#livesFill'),
  overlay: document.querySelector('#gameOverlay'),
  icon: document.querySelector('#resultIcon'),
  title: document.querySelector('#resultTitle'),
  text: document.querySelector('#resultText')
};

const keys = new Set();
let game;

function resetGame() {
  game = {
    basketX: W / 2,
    level: 1,
    caught: 0,
    lives: 3,
    items: [],
    spawnTimer: 0,
    levelMessageTimer: 0,
    running: true,
    dragging: false,
    lastTime: 0
  };

  ui.overlay.classList.add('hidden');
  updateUI();
}

function updateUI() {
  const target = levelTargets[game.level - 1];

  ui.level.textContent = game.level;
  ui.goal.textContent = target;
  ui.caught.textContent = game.caught;
  ui.caughtGoal.textContent = target;
  ui.lives.textContent = game.lives;
  ui.progress.style.width = `${(game.caught / target) * 100}%`;
  ui.livesProgress.style.width = `${(game.lives / 3) * 100}%`;
}

function spawnItem() {
  const bad = Math.random() < 0.27;
  const radius = bad ? 17 : 15;

  game.items.push({
    x: 28 + Math.random() * (W - 56),
    y: -radius - 5,
    radius,
    speed: 135 + Math.random() * 55 + game.caught * 7,
    bad,
    spin: Math.random() * Math.PI * 2
  });
}

function moveBasket(dt) {
  let direction = 0;

  if (keys.has('ArrowLeft') || keys.has('a')) direction--;
  if (keys.has('ArrowRight') || keys.has('d')) direction++;

  game.basketX += direction * 330 * dt;
  game.basketX = Math.max(55, Math.min(W - 55, game.basketX));
}

function setBasketFromPointer(event) {
  const rect = canvas.getBoundingClientRect();
  const pointerX = ((event.clientX - rect.left) * W) / rect.width;

  game.basketX = Math.max(55, Math.min(W - 55, pointerX));
}

function finish(won) {
  game.running = false;
  ui.icon.textContent = won ? '★' : '×';
  ui.title.textContent = won ? 'You win!' : 'Try again';
  ui.text.textContent = won
    ? 'You cleared all 3 levels. Great reflexes!'
    : 'A red item got into the basket. Give it another shot!';
  ui.overlay.classList.remove('hidden');
}

function advanceLevel() {
  if (game.level >= levelTargets.length) {
    finish(true);
    return;
  }

  game.level++;
  game.caught = 0;
  game.lives = 3;
  game.items = [];
  game.spawnTimer = 0.8;
  game.levelMessageTimer = 1.5;
  updateUI();
}

function update(dt) {
  moveBasket(dt);
  game.spawnTimer -= dt;
  game.levelMessageTimer = Math.max(0, game.levelMessageTimer - dt);

  if (game.spawnTimer <= 0) {
    spawnItem();
    game.spawnTimer = Math.max(0.28, 0.72 - game.caught * 0.025);
  }

  const basketTop = H - 66;

  game.items = game.items.filter((item) => {
    item.y += item.speed * dt;
    item.spin += dt * 3;

    const catches =
      item.y + item.radius > basketTop &&
      item.y - item.radius < basketTop + 30 &&
      Math.abs(item.x - game.basketX) < 58;

    if (catches) {
      if (item.bad) game.lives--;
      else game.caught++;

      updateUI();

      if (game.caught >= levelTargets[game.level - 1]) advanceLevel();
      else if (game.lives <= 0) finish(false);

      return false;
    }

    return item.y < H + item.radius;
  });

  if (game.levelMessageTimer > 0) {
    game.items = [];
  }
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);

  gradient.addColorStop(0, '#dbe9ff');
  gradient.addColorStop(1, '#b9d5ff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ffffff55';

  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.arc(70 + i * 135, 72 + (i % 2) * 70, 22, 0, Math.PI * 2);
    ctx.arc(98 + i * 135, 72 + (i % 2) * 70, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#93b9ed';
  ctx.fillRect(0, H - 38, W, 38);
  ctx.fillStyle = '#7da8df';

  for (let x = 0; x < W; x += 32) {
    ctx.fillRect(x, H - 38, 16, 5);
  }
}

function drawItem(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.spin);
  ctx.fillStyle = item.bad ? '#ef5b68' : '#3878ff';
  ctx.shadowColor = '#20365b44';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();

  if (item.bad) {
    ctx.moveTo(0, -item.radius);

    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI / 2 + i * (Math.PI / 4);
      const radius = i % 2 ? item.radius * 0.55 : item.radius;

      ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
  } else {
    ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
  }

  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#fff8';
  ctx.beginPath();
  ctx.arc(-item.radius * 0.35, -item.radius * 0.35, item.radius * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBasket() {
  const y = H - 61;

  ctx.save();
  ctx.translate(game.basketX, y);
  ctx.fillStyle = '#8b5a35';
  ctx.strokeStyle = '#5f3c27';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, -5, 35, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#d8964a';
  ctx.beginPath();
  ctx.roundRect(-53, -2, 106, 30, 8);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#f0bc71';
  ctx.lineWidth = 3;

  for (let x = -35; x <= 35; x += 18) {
    ctx.beginPath();
    ctx.moveTo(x, 1);
    ctx.lineTo(x, 25);
    ctx.stroke();
  }

  ctx.restore();
}

function draw() {
  drawBackground();
  game.items.forEach(drawItem);
  drawBasket();
  ctx.fillStyle = '#17233caa';
  ctx.font = '700 14px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('CATCH THE BLUE BALLS', W / 2, 28);

  if (game.levelMessageTimer > 0) {
    ctx.fillStyle = '#17233ce6';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 150, 52, 300, 58, 14);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 22px system-ui';
    ctx.fillText(`LEVEL ${game.level}`, W / 2, 88);
  }
}

function loop(now) {
  const dt = Math.min(0.04, (now - (game.lastTime || now)) / 1000);
  game.lastTime = now;

  if (game.running) update(dt);

  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(event.key)) {
    event.preventDefault();
  }

  keys.add(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});

window.addEventListener('keyup', (event) => {
  keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
});

canvas.addEventListener('pointerdown', (event) => {
  game.dragging = true;
  setBasketFromPointer(event);
});

canvas.addEventListener('pointermove', (event) => {
  if (game.dragging) setBasketFromPointer(event);
});

window.addEventListener('pointerup', () => {
  game.dragging = false;
});

document.querySelector('#restartButton').addEventListener('click', resetGame);
document.querySelector('#playAgainButton').addEventListener('click', resetGame);

resetGame();
requestAnimationFrame(loop);
