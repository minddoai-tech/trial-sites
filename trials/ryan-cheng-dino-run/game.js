const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const bestEl = document.querySelector('#best');
const overlay = document.querySelector('#overlay');
const titleEl = document.querySelector('#overlay-title');
const copyEl = document.querySelector('#overlay-copy');
const startButton = document.querySelector('#start-button');
const playerNameInput = document.querySelector('#player-name');
const leaderboardList = document.querySelector('#leaderboard-list');
const clearScoresButton = document.querySelector('#clear-scores');

const W = canvas.width, H = canvas.height;
const keys = new Set();
let player, cacti, particles, running = false, last = 0, spawnTimer = 0, elapsed = 0;
let laneBag = [], difficulty = 'normal';
let currentPlayerName = 'DINO';
const LEADERBOARD_KEY = 'dinoDashLeaderboardV1';
const difficultySettings = {
  easy:   { speed: 220, acceleration: 3.2, maxBoost: 150, interval: 1.42, minInterval: .72, minWave: 1, extraChance: 0 },
  normal: { speed: 270, acceleration: 5,   maxBoost: 240, interval: 1.16, minInterval: .48, minWave: 1, extraChance: .16 },
  hard:   { speed: 370, acceleration: 8.5, maxBoost: 380, interval: .72, minInterval: .24, minWave: 2, extraChance: .52 }
};
let best = Number(localStorage.getItem('dinoDashBest') || 0);
bestEl.textContent = String(best).padStart(4, '0');

function getLeaderboard() {
  try {
    const saved = JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}

function renderLeaderboard() {
  const scores = getLeaderboard().slice(0,5);
  leaderboardList.replaceChildren();
  if (!scores.length) {
    const empty=document.createElement('li'); empty.className='empty-score'; empty.textContent='No runs yet — set the first score!'; leaderboardList.append(empty); return;
  }
  for (const entry of scores) {
    const row=document.createElement('li');
    const name=document.createElement('span'); name.textContent=entry.name;
    const score=document.createElement('span'); score.className='leader-score'; score.textContent=String(entry.score).padStart(4,'0');
    const mode=document.createElement('span'); mode.className='leader-mode'; mode.textContent=entry.difficulty;
    row.append(name,score,mode); leaderboardList.append(row);
  }
}

function recordScore(score) {
  const scores=getLeaderboard();
  const entry={ name:currentPlayerName, score, seconds:Number(elapsed.toFixed(1)), difficulty, createdAt:Date.now() };
  scores.push(entry);
  scores.sort((a,b)=>b.score-a.score || a.createdAt-b.createdAt);
  const rank=scores.findIndex(item=>item===entry)+1;
  localStorage.setItem(LEADERBOARD_KEY,JSON.stringify(scores.slice(0,20)));
  renderLeaderboard();
  return rank;
}

function resizeCanvasForDisplay() {
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * pixelRatio);
  canvas.height = Math.round(H * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  if (!running) draw();
}

function reset() {
  player = { x: 150, y: H / 2, r: 25, z: 0, vz: 0, speed: 270 };
  cacti = []; particles = []; laneBag = []; spawnTimer = .8; elapsed = 0;
  scoreEl.textContent = '0000';
}

function start() {
  difficulty = document.querySelector('input[name="difficulty"]:checked').value;
  currentPlayerName = (playerNameInput.value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'').slice(0,8) || 'DINO');
  playerNameInput.value = currentPlayerName;
  reset(); running = true; last = performance.now(); overlay.classList.add('hidden');
  requestAnimationFrame(loop);
}

function end() {
  running = false;
  const score = Math.floor(elapsed * 10);
  const rank = recordScore(score);
  if (score > best) { best = score; localStorage.setItem('dinoDashBest', best); bestEl.textContent = String(best).padStart(4, '0'); }
  titleEl.textContent = 'Extinct!';
  copyEl.textContent = `You survived ${elapsed.toFixed(1)} seconds and scored ${score} points. Leaderboard rank: #${rank}.`;
  startButton.textContent = 'Run again'; overlay.classList.remove('hidden');
}

function refillLanes() {
  // Six lanes span the entire playable height. Using every lane before
  // reshuffling prevents the top and bottom edges becoming safe zones.
  laneBag = [0, 1, 2, 3, 4, 5];
  for (let i = laneBag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [laneBag[i], laneBag[j]] = [laneBag[j], laneBag[i]];
  }
}

function spawnCactus(lane = null, xOffset = 0) {
  const size = 38 + Math.random() * 22;
  if (lane === null) {
    if (!laneBag.length) refillLanes();
    lane = laneBag.pop();
  }
  const laneY = 104 + lane * ((H - 208) / 5);
  cacti.push({ x: W + size + xOffset, y: laneY, r: size, wobble: Math.random() * 6.28 });
}

function spawnWave() {
  const settings = difficultySettings[difficulty];
  const waveCount = settings.minWave + (Math.random() < settings.extraChance ? 1 : 0);
  for (let i = 0; i < waveCount; i++) {
    if (!laneBag.length) refillLanes();
    spawnCactus(laneBag.pop(), i * (24 + Math.random() * 20));
  }
}

function update(dt) {
  elapsed += dt;
  const dx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
  const dy = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0);
  const mag = Math.hypot(dx, dy) || 1;
  player.x = Math.max(42, Math.min(W - 42, player.x + dx / mag * player.speed * dt));
  player.y = Math.max(65, Math.min(H - 60, player.y + dy / mag * player.speed * dt));
  player.vz -= 1450 * dt; player.z += player.vz * dt;
  if (player.z < 0) { player.z = 0; player.vz = 0; }

  spawnTimer -= dt;
  const settings = difficultySettings[difficulty];
  if (spawnTimer <= 0) {
    spawnWave();
    const baseInterval = Math.max(settings.minInterval, settings.interval - elapsed * .008);
    spawnTimer = baseInterval * (.78 + Math.random() * .44);
  }
  const worldSpeed = settings.speed + Math.min(settings.maxBoost, elapsed * settings.acceleration);
  for (const c of cacti) c.x -= worldSpeed * dt;
  cacti = cacti.filter(c => c.x > -60);
  particles = particles.filter(p => (p.life -= dt) > 0);
  for (const p of particles) { p.x -= worldSpeed * .25 * dt; p.y += p.vy * dt; }

  for (const c of cacti) {
    // Collisions use the same perspective projection as the artwork, so what
    // appears to touch at any depth is also what the game considers a hit.
    const playerScale = depthScale(player.y);
    const cactusScale = depthScale(c.y);
    const screenDx = Math.abs(player.x - c.x);
    const screenDy = Math.abs(projectY(player.y) - projectY(c.y));
    const hitX = screenDx < player.r * 1.15 * playerScale + c.r * .46 * cactusScale;
    const hitY = screenDy < player.r * .72 * playerScale + c.r * .42 * cactusScale;
    if (hitX && hitY && player.z < 44) { burst(); end(); return; }
  }
  scoreEl.textContent = String(Math.floor(elapsed * 10)).padStart(4, '0');
}

function burst() {
  for (let i=0;i<16;i++) particles.push({ x:player.x, y:player.y-player.z, vy:(Math.random()-.5)*180, life:.8+Math.random()*.5 });
}

function depthRatio(y) {
  return Math.max(0, Math.min(1, (y - 65) / (H - 125)));
}

function projectY(y) {
  const t = depthRatio(y);
  return 126 + Math.pow(t, 1.18) * 350;
}

function depthScale(y) {
  return .64 + depthRatio(y) * .5;
}

function drawGroundShadow(x, y, width, alpha = .2) {
  ctx.save();
  ctx.translate(x + 7, y + 5);
  ctx.scale(1, .28);
  const shadow = ctx.createRadialGradient(0,0,1,0,0,width/2);
  shadow.addColorStop(0,`rgba(26,42,36,${alpha})`);
  shadow.addColorStop(.7,`rgba(26,42,36,${alpha*.55})`);
  shadow.addColorStop(1,'rgba(26,42,36,0)');
  ctx.fillStyle=shadow; ctx.beginPath(); ctx.arc(0,0,width/2,0,7); ctx.fill(); ctx.restore();
}

function draw() {
  ctx.clearRect(0,0,W,H);
  const sky=ctx.createLinearGradient(0,0,0,H); sky.addColorStop(0,'#b8ddd1'); sky.addColorStop(.38,'#dce8cb'); sky.addColorStop(1,'#e6c77c'); ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
  ctx.fillStyle='rgba(46,107,82,.22)';
  for(let i=0;i<9;i++){const x=i*130-50;ctx.beginPath();ctx.arc(x,119,72,0,Math.PI,true);ctx.fill();}

  // One ground plane with projected depth and evenly spaced world lanes.
  const ground=ctx.createLinearGradient(0,118,0,500); ground.addColorStop(0,'#d3b66f'); ground.addColorStop(1,'#e8c978');
  ctx.fillStyle=ground; ctx.beginPath(); ctx.moveTo(24,118); ctx.lineTo(W-24,118); ctx.lineTo(W,510); ctx.lineTo(0,510); ctx.closePath(); ctx.fill();
  ctx.strokeStyle='#416d52'; ctx.lineWidth=7; ctx.beginPath();ctx.moveTo(24,118);ctx.lineTo(W-24,118);ctx.moveTo(0,510);ctx.lineTo(W,510);ctx.stroke();
  ctx.strokeStyle='rgba(70,79,54,.17)'; ctx.lineWidth=2; ctx.setLineDash([14,20]);
  for(let lane=0;lane<6;lane++){const worldY=104+lane*((H-208)/5);const y=projectY(worldY);ctx.beginPath();ctx.moveTo(10,y);ctx.lineTo(W-10,y);ctx.stroke();}
  ctx.setLineDash([]);
  ctx.strokeStyle='rgba(247,241,223,.2)'; ctx.lineWidth=18;
  const markerShift=(elapsed*270)%150; for(let x=-markerShift;x<W+100;x+=150){ctx.beginPath();ctx.moveTo(x+45,122);ctx.lineTo(x-20,506);ctx.stroke();}

  // Depth sorting makes nearer objects naturally pass in front of farther ones.
  const actors=cacti.map(c=>({y:c.y,draw:()=>drawCactus(c)})); actors.push({y:player.y,draw:drawDino}); actors.sort((a,b)=>a.y-b.y); actors.forEach(a=>a.draw());
  for(const p of particles){ctx.fillStyle=`rgba(233,133,76,${p.life})`;ctx.fillRect(p.x,p.y,7,7);}
  if (!running && elapsed > 0) { ctx.fillStyle='rgba(32,48,44,.12)'; ctx.fillRect(0,0,W,H); }
}

function drawCactus(c) {
  const scale=depthScale(c.y), groundY=projectY(c.y);
  drawGroundShadow(c.x,groundY,c.r*1.25*scale,.22);
  ctx.save(); ctx.translate(c.x,groundY); ctx.scale(scale,scale); ctx.translate(0,-c.r*.6);
  const cactusShape = () => {
    ctx.beginPath();
    ctx.roundRect(-c.r*.28,-c.r*.75,c.r*.56,c.r*1.35,9);
    ctx.roundRect(-c.r*.62,-c.r*.25,c.r*.4,c.r*.25,7);
    ctx.roundRect(c.r*.22,-c.r*.43,c.r*.4,c.r*.25,7);
  };

  // Small extrusion; the soft ground shadow is anchored at the cactus base.
  ctx.save(); ctx.translate(3,3); ctx.fillStyle='#1e4437'; cactusShape(); ctx.fill(); ctx.restore();
  ctx.fillStyle='#2e6b52'; ctx.strokeStyle='#20302c'; ctx.lineWidth=3;
  cactusShape(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle='#78a184'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-c.r*.12,-c.r*.63); ctx.lineTo(-c.r*.12,c.r*.42); ctx.stroke();
  ctx.restore();
}

function drawDino() {
  const p = player;
  const s = 5;
  const depth = 4;
  const runningFrame = Math.floor(elapsed * 9) % 2;
  // Pixel mask traced from the supplied classic dinosaur silhouette.
  const dino = [
    '........####....',
    '.......########.',
    '.......#########',
    '.......#########',
    '.......#########',
    '.......######...',
    '......####......',
    '.....#####.####.',
    '....######......',
    '#..#######.##...',
    '##.##########...',
    '############....',
    '.###########....',
    '..#########.....',
    '...#######......',
    '....#####.......',
  ];
  const originX = -dino[0].length * s * .42;
  const modelHeight = 20*s;
  const scale = depthScale(p.y);
  const groundY = projectY(p.y);

  drawGroundShadow(p.x+3,groundY,66*scale,Math.max(.08,.23-p.z*.0018));
  ctx.save();
  const bob = p.z === 0 && running ? runningFrame * 2 : 0;
  ctx.translate(Math.round(p.x),Math.round(groundY-p.z*scale+bob));
  ctx.scale(scale,scale);
  ctx.translate(originX,-modelHeight);

  // Extruded layers create a solid, toy-like 3D body.
  for (let layer = depth; layer > 0; layer--) {
    ctx.fillStyle = layer > 2 ? '#172d27' : '#20483b';
    for (let y = 0; y < dino.length; y++) {
      for (let x = 0; x < dino[y].length; x++) {
        if (dino[y][x] === '#') ctx.fillRect(x*s + layer, y*s + layer, s, s);
      }
    }
  }

  // Front face, subtle bevels, and highlights on exposed top edges.
  for (let y = 0; y < dino.length; y++) {
    for (let x = 0; x < dino[y].length; x++) {
      if (dino[y][x] !== '#') continue;
      ctx.fillStyle = y < 6 ? '#3e705d' : '#356451';
      ctx.fillRect(x*s, y*s, s, s);
      if (y === 0 || dino[y-1][x] !== '#') {
        ctx.fillStyle = '#78a184'; ctx.fillRect(x*s, y*s, s, 1.5);
      }
      if (x === 0 || dino[y][x-1] !== '#') {
        ctx.fillStyle = '#5f8d72'; ctx.fillRect(x*s, y*s, 1.5, s);
      }
    }
  }

  // Two separated block legs, animated while running.
  ctx.fillStyle = '#356451';
  const legY = 16*s;
  const backFoot = runningFrame && p.z === 0 ? 0 : s;
  const frontFoot = runningFrame && p.z === 0 ? s : 0;
  ctx.fillRect(5*s, legY, 2*s, 3*s-backFoot);
  ctx.fillRect(5*s, legY+3*s-backFoot, 3*s, s);
  ctx.fillRect(10*s, legY, 2*s, 3*s-frontFoot);
  ctx.fillRect(10*s, legY+3*s-frontFoot, 3*s, s);
  ctx.fillStyle = '#20483b';
  ctx.fillRect(7*s, legY+depth, depth, 3*s-backFoot);
  ctx.fillRect(12*s, legY+depth, depth, 3*s-frontFoot);

  // Bright inset eye like the reference, with a dark inner pupil.
  ctx.fillStyle = '#f7f1df'; ctx.fillRect(9*s, 2*s, 1.4*s, 1.4*s);
  ctx.fillStyle = '#20302c'; ctx.fillRect(10*s, 2*s, .4*s, .65*s);
  ctx.restore();
}

function loop(now) {
  if (!running) { draw(); return; }
  const dt = Math.min(.033, (now-last)/1000); last=now; update(dt); draw(); if(running) requestAnimationFrame(loop);
}

addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return;
  if (['KeyW','KeyA','KeyS','KeyD','Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'Space' && running && player.z === 0) player.vz = 610;
  if ((e.code === 'Enter' || e.code === 'Space') && !running) start();
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('resize', resizeCanvasForDisplay);
startButton.addEventListener('click', start);
clearScoresButton.addEventListener('click', () => {
  if (confirm('Clear every local leaderboard score?')) {
    localStorage.removeItem(LEADERBOARD_KEY);
    renderLeaderboard();
  }
});
reset(); resizeCanvasForDisplay();
renderLeaderboard();
