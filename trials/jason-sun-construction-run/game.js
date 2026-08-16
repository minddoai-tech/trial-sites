const game = document.querySelector('#game');
const runner = document.querySelector('#runner');
const obstacles = document.querySelector('#obstacles');
const distanceEl = document.querySelector('#distance');
const bestEl = document.querySelector('#best');
const startScreen = document.querySelector('#startScreen');
const endScreen = document.querySelector('#endScreen');
const endEyebrow = document.querySelector('#endEyebrow');
const endTitle = document.querySelector('#endTitle');
const endText = document.querySelector('#endText');
const startButton = document.querySelector('#startButton');
const restartButton = document.querySelector('#restartButton');

let lane = 1, running = false, distance = 0, lastFrame = 0, spawnTimer = 0, speed = 0.17, active = [];
let best = Number(localStorage.getItem('hardHatBest') || 0);
bestEl.textContent = `${best}m`;

function setLane(next) { if (!running) return; lane = Math.max(0, Math.min(2, next)); runner.className = `runner lane-${lane}`; }
function addObstacle() {
  const types = ['cone', 'barrier', 'mixer'];
  const node = document.createElement('div');
  const obstacleLane = Math.floor(Math.random() * 3);
  node.className = `obstacle ${types[Math.floor(Math.random() * types.length)]}`;
  node.style.left = `${28 + obstacleLane * 22}%`;
  obstacles.append(node);
  active.push({ node, lane: obstacleLane, y: -14 });
}
function finish(won) {
  running = false;
  active.forEach(item => item.node.remove()); active = [];
  best = Math.max(best, Math.floor(distance)); localStorage.setItem('hardHatBest', best); bestEl.textContent = `${best}m`;
  endEyebrow.textContent = won ? 'SHIFT COMPLETE' : 'SAFETY FIRST';
  endTitle.textContent = won ? 'Site cleared!' : 'Watch your step!';
  endText.textContent = won ? `You made it through the work zone in ${Math.floor(distance)}m.` : `You made it ${Math.floor(distance)}m down the site.`;
  restartButton.textContent = won ? 'Start new shift' : 'Run again';
  endScreen.classList.remove('hidden');
}
function tick(time) {
  if (!running) return;
  const dt = Math.min(time - lastFrame, 35); lastFrame = time;
  distance += dt * 0.012; speed = Math.min(.31, .17 + distance / 4200);
  distanceEl.textContent = `${Math.floor(distance)}m`;
  spawnTimer += dt;
  // Keep the approach clear: the next obstacle only appears once the last one
  // has travelled far enough down the road to leave a genuine dodge window.
  const nearestObstacle = active.reduce((nearest, item) => Math.min(nearest, item.y), Infinity);
  const spawnDelay = Math.max(1550, 2300 - distance * 1.2);
  if (spawnTimer > spawnDelay && nearestObstacle > 38) { addObstacle(); spawnTimer = 0; }
  for (let i = active.length - 1; i >= 0; i--) {
    const item = active[i]; item.y += speed * dt / 10;
    item.node.style.bottom = `${100 - item.y}%`;
    const scale = .35 + Math.max(0, item.y) / 110;
    item.node.style.transform = `translateX(-50%) scale(${scale})`;
    if (item.y > 88 && item.y < 104 && item.lane === lane) return finish(false);
    if (item.y > 116) { item.node.remove(); active.splice(i, 1); }
  }
  if (distance >= 500) return finish(true);
  requestAnimationFrame(tick);
}
function start() { lane = 1; distance = 0; speed = .17; spawnTimer = 900; runner.className = 'runner lane-1'; distanceEl.textContent = '0m'; startScreen.classList.add('hidden'); endScreen.classList.add('hidden'); running = true; lastFrame = performance.now(); game.focus(); requestAnimationFrame(tick); }
document.addEventListener('keydown', e => { if (['a','ArrowLeft'].includes(e.key)) { e.preventDefault(); setLane(lane - 1); } if (['d','ArrowRight'].includes(e.key)) { e.preventDefault(); setLane(lane + 1); } if (!running && e.key === 'Enter') start(); });
startButton.addEventListener('click', start); restartButton.addEventListener('click', start);
