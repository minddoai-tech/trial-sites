const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const timerEl = document.getElementById('timer');
const scoreEls = [document.getElementById('scoreOne'), document.getElementById('scoreTwo')];
const overlay = document.getElementById('overlay');
const overlayEyebrow = document.getElementById('overlayEyebrow');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const startButton = document.getElementById('startButton');
const statusText = document.getElementById('statusText');
const p2Hint = document.getElementById('playerTwoHint');

const CELLS = 25;
const CELL = canvas.width / CELLS;
const ROUND_SECONDS = 120;
const COLORS = { board: '#dce7d7', grid: '#cbd9c6', fruit: '#f0b848', p1: '#e75d3e', p1Head: '#bd3e2b', p2: '#1c9a89', p2Head: '#117264' };
const directions = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
let players, fruit, running = false, ended = false, remaining = ROUND_SECONDS, tickTimer, clockTimer;

function makePlayer(id, body, direction) { return { id, body, direction, nextDirection: direction, score: 0, alive: true, joined: id === 1 }; }
function resetGame() {
  clearInterval(tickTimer); clearInterval(clockTimer);
  players = [makePlayer(1, [{ x: 4, y: 12 }, { x: 3, y: 12 }, { x: 2, y: 12 }], directions.right), makePlayer(2, [{ x: 20, y: 12 }, { x: 21, y: 12 }, { x: 22, y: 12 }], directions.left)];
  fruit = { x: 12, y: 7 }; running = false; ended = false; remaining = ROUND_SECONDS;
  scoreEls[0].textContent = '000'; scoreEls[1].textContent = '---'; p2Hint.textContent = 'Press an arrow key to join.';
  updateTimer(); draw(); showStart(); statusText.textContent = 'Press start when you’re ready.';
}
function showStart() { overlayEyebrow.textContent = 'READY?'; overlayTitle.textContent = 'SNAKE SPRINT'; overlayMessage.textContent = 'Collect the fruit. Outlast the clock.'; startButton.innerHTML = 'Start game <span>↗</span>'; overlay.classList.remove('hidden'); }
function begin() { if (ended) resetGame(); running = true; overlay.classList.add('hidden'); statusText.textContent = 'Player 2 can join anytime with arrow keys.'; tickTimer = setInterval(tick, 150); clockTimer = setInterval(countdown, 1000); }
function countdown() { remaining--; updateTimer(); if (remaining <= 0) finish('Time’s up!'); }
function updateTimer() { const min = String(Math.floor(remaining / 60)).padStart(2, '0'); const sec = String(remaining % 60).padStart(2, '0'); timerEl.textContent = `${min}:${sec}`; }
function isOpposite(a, b) { return a.x === -b.x && a.y === -b.y; }
function setDirection(player, direction) { if (!isOpposite(direction, player.direction)) player.nextDirection = direction; }
function joinPlayerTwo() { const p2 = players[1]; if (!p2.joined) { p2.joined = true; scoreEls[1].textContent = '000'; p2Hint.textContent = 'You’re in the sprint.'; statusText.textContent = 'Player 2 joined the round!'; } }
function tick() {
  const active = players.filter(p => p.joined && p.alive);
  if (!active.length) return finish('No snakes left!');
  active.forEach(p => p.direction = p.nextDirection);
  const nextHeads = new Map(active.map(p => [p, { x: p.body[0].x + p.direction.x, y: p.body[0].y + p.direction.y }]));
  const occupied = active.flatMap(p => p.body.map(cell => ({ ...cell, owner: p })));
  active.forEach(p => {
    const head = nextHeads.get(p);
    const hitsWall = head.x < 0 || head.x >= CELLS || head.y < 0 || head.y >= CELLS;
    const tail = p.body[p.body.length - 1];
    const hitsSnake = occupied.some(cell => cell.x === head.x && cell.y === head.y && !(cell.owner === p && cell.x === tail.x && cell.y === tail.y));
    const hitsOtherHead = active.some(other => other !== p && head.x === nextHeads.get(other).x && head.y === nextHeads.get(other).y);
    if (hitsWall || hitsSnake || hitsOtherHead) p.alive = false;
  });
  active.filter(p => p.alive).forEach(p => {
    const head = nextHeads.get(p); p.body.unshift(head);
    if (head.x === fruit.x && head.y === fruit.y) { p.score++; scoreEls[p.id - 1].textContent = String(p.score).padStart(3, '0'); placeFruit(); }
    else p.body.pop();
  });
  draw();
  if (!players.some(p => p.joined && p.alive)) finish('Crash!');
}
function placeFruit() { const used = players.flatMap(p => p.body); do fruit = { x: Math.floor(Math.random() * CELLS), y: Math.floor(Math.random() * CELLS) }; while (used.some(cell => cell.x === fruit.x && cell.y === fruit.y)); }
function draw() {
  ctx.fillStyle = COLORS.board; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
  for (let i = 1; i < CELLS; i++) { ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, canvas.height); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(canvas.width, i * CELL); ctx.stroke(); }
  ctx.fillStyle = COLORS.fruit; ctx.beginPath(); ctx.arc((fruit.x + .5) * CELL, (fruit.y + .5) * CELL, CELL * .28, 0, Math.PI * 2); ctx.fill();
  players.filter(p => p.joined).forEach(p => p.body.forEach((cell, i) => { ctx.fillStyle = p.alive ? (i === 0 ? COLORS[`p${p.id}Head`] : COLORS[`p${p.id}`]) : '#9baaa0'; ctx.fillRect(cell.x * CELL + 2, cell.y * CELL + 2, CELL - 4, CELL - 4); }));
}
function finish(reason) {
  if (ended) return; ended = true; running = false; clearInterval(tickTimer); clearInterval(clockTimer);
  const p1 = players[0].score, p2 = players[1].joined ? players[1].score : 0;
  const winner = p1 === p2 ? 'It’s a tie!' : `${p1 > p2 ? 'Player 1' : 'Player 2'} wins!`;
  overlayEyebrow.textContent = reason.toUpperCase(); overlayTitle.textContent = winner; overlayMessage.textContent = `Final score — P1: ${p1} · P2: ${p2}`; startButton.innerHTML = 'Play again <span>↻</span>'; overlay.classList.remove('hidden'); statusText.textContent = 'Press restart or play again for a fresh 2-minute round.'; draw();
}
document.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'r', ' '].includes(key)) event.preventDefault();
  if (key === 'r') { resetGame(); return; }
  if ((key === ' ' || key === 'enter') && !running) { begin(); return; }
  if (!running) return;
  const p1Keys = { w: directions.up, a: directions.left, s: directions.down, d: directions.right };
  const p2Keys = { arrowup: directions.up, arrowleft: directions.left, arrowdown: directions.down, arrowright: directions.right };
  if (p1Keys[key]) setDirection(players[0], p1Keys[key]);
  if (p2Keys[key]) { joinPlayerTwo(); setDirection(players[1], p2Keys[key]); }
});
startButton.addEventListener('click', begin);
document.getElementById('restartButton').addEventListener('click', resetGame);
resetGame();
