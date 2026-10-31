(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const hoop = { x: 861, y: 280, rim: 20 };
  const court = { left: 36, top: 30, right: 924, bottom: 530 };
  const threePointRadius = 245;
  const keys = new Set();

  const roles = {
    PG: { name: 'Point Guard', short: 'PG', description: 'Quick hands and deep range. Create space, then let it fly.', three: 92, mid: 76, dunk: 58, rebound: 50, speed: 94 },
    SG: { name: 'Shooting Guard', short: 'SG', description: 'The purest jumper on the court. Punish every inch of space.', three: 97, mid: 84, dunk: 63, rebound: 47, speed: 88 },
    SF: { name: 'Small Forward', short: 'SF', description: 'A flexible two-way wing with enough size to finish strong.', three: 84, mid: 82, dunk: 75, rebound: 64, speed: 82 },
    PF: { name: 'Power Forward', short: 'PF', description: 'Own the paint, win the glass, and make the midrange hurt.', three: 62, mid: 90, dunk: 88, rebound: 91, speed: 62 },
    C: { name: 'Center', short: 'C', description: 'A rim-running anchor. Big boards, close finishes, no easy lanes.', three: 38, mid: 82, dunk: 96, rebound: 98, speed: 48 }
  };

  const state = {
    playerScore: 0,
    opponentScore: 0,
    role: 'PG',
    possession: 'player',
    gameOver: false,
    paused: false,
    lastTime: performance.now(),
    toastUntil: 0,
    toastText: '',
    feed: [],
    shot: null,
    dunk: null,
    actionCooldown: 0,
    messageTimer: 0,
    flash: null,
    aiShotTimer: 0,
    aiThinkTimer: 0,
    aiStill: false,
    possessionNumber: 1
  };

  const player = { x: 630, y: 340, r: 18, vx: 0, vy: 0, facing: 0, bob: 0 };
  const opponent = { x: 520, y: 260, r: 18, vx: 0, vy: 0, facing: 0, bob: 0 };
  const ball = { x: player.x + 20, y: player.y - 10, z: 0, visible: true, flight: null };
  const camera = { x: 370, y: 340, z: 155, focal: 265, horizon: 145, yaw: 0 };

  const el = {
    playerScore: document.getElementById('playerScore'),
    opponentScore: document.getElementById('opponentScore'),
    gameStatus: document.getElementById('gameStatus'),
    possessionDot: document.getElementById('possessionDot'),
    possessionText: document.getElementById('possessionText'),
    roleTitle: document.getElementById('roleTitle'),
    roleBadge: document.getElementById('roleBadge'),
    roleDescription: document.getElementById('roleDescription'),
    meterTitle: document.getElementById('meterTitle'),
    meterHint: document.getElementById('meterHint'),
    meterArea: document.getElementById('meterArea'),
    eventFeed: document.getElementById('eventFeed'),
    toast: document.getElementById('toast'),
    gameOverlay: document.getElementById('gameOverlay'),
    overlayKicker: document.getElementById('overlayKicker'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayCopy: document.getElementById('overlayCopy')
  };

  const statNames = ['Three', 'Mid', 'Dunk', 'Rebound', 'Speed'];

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function angleTo(from, to) { return Math.atan2(to.y - from.y, to.x - from.x); }
  function angleDifference(a, b) {
    let d = Math.abs(a - b) % (Math.PI * 2);
    if (d > Math.PI) d = Math.PI * 2 - d;
    return d;
  }
  function playerRole() { return roles[state.role]; }
  function isThree() { return distance(player, hoop) > threePointRadius; }
  function isNearRim() { return distance(player, hoop) < 112; }

  function updateCamera(dt) {
    const turn = (keys.has('q') ? -1 : 0) + (keys.has('c') ? 1 : 0);
    camera.yaw = clamp(camera.yaw + turn * dt * 1.85, -1.18, 1.18);
    const forwardX = Math.cos(camera.yaw);
    const forwardY = Math.sin(camera.yaw);
    camera.x = player.x - forwardX * 250;
    camera.y = player.y - forwardY * 250;
  }

  function project(point) {
    const dx = point.x - camera.x;
    const dy = point.y - camera.y;
    const forward = dx * Math.cos(camera.yaw) + dy * Math.sin(camera.yaw);
    const right = -dx * Math.sin(camera.yaw) + dy * Math.cos(camera.yaw);
    const depth = Math.max(55, forward);
    const scale = camera.focal / depth;
    return {
      x: W / 2 + right * scale,
      y: camera.horizon + (camera.z - (point.z || 0)) * scale,
      scale,
      depth
    };
  }

  function drawWorldLine(points, color, width = 1, dash = []) {
    const projected = points.map(point => project(point));
    if (!projected.length) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(projected[0].x, projected[0].y);
    projected.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.stroke();
    ctx.restore();
  }

  function sampleArc(cx, cy, radius, start, end, segments = 42) {
    const points = [];
    for (let index = 0; index <= segments; index += 1) {
      const angle = lerp(start, end, index / segments);
      points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius, z: 1 });
    }
    return points;
  }

  function resetGame() {
    state.playerScore = 0;
    state.opponentScore = 0;
    state.possession = 'player';
    state.gameOver = false;
    state.shot = null;
    state.dunk = null;
    state.actionCooldown = 0;
    state.aiShotTimer = 0;
    state.aiThinkTimer = 0;
    state.aiStill = false;
    state.possessionNumber = 1;
    state.feed = [];
    el.eventFeed.innerHTML = '';
    camera.yaw = 0;
    player.x = 630; player.y = 340; player.vx = 0; player.vy = 0;
    opponent.x = 520; opponent.y = 260; opponent.vx = 0; opponent.vy = 0;
    updateBall();
    el.gameOverlay.classList.add('hidden');
    el.gameStatus.textContent = 'LIVE';
    el.gameStatus.classList.remove('done');
    addFeed('TIP', 'You have the check. Get a clean look.');
    addFeed('RULE', 'First to 21 wins. Green release is automatic cash.');
    showToast('CHECK BALL — TAKE THE FIRST SHOT');
    updateHud();
  }

  function chooseRole(role) {
    if (!roles[role]) return;
    state.role = role;
    document.querySelectorAll('.role-choice').forEach(button => button.classList.toggle('active', button.dataset.role === role));
    updateRolePanel();
    addFeed('BUILD', `${roles[role].name} equipped.`);
    showToast(`${roles[role].name.toUpperCase()} READY`);
  }

  function updateRolePanel() {
    const role = playerRole();
    el.roleTitle.textContent = role.name;
    el.roleBadge.textContent = role.short;
    el.roleDescription.textContent = role.description;
    statNames.forEach(name => {
      const value = role[name.toLowerCase()];
      document.getElementById(`stat${name}`).style.width = `${value}%`;
      document.getElementById(`stat${name}Value`).textContent = value;
    });
  }

  function updateHud() {
    el.playerScore.textContent = state.playerScore;
    el.opponentScore.textContent = state.opponentScore;
    const yours = state.possession === 'player';
    el.possessionText.textContent = yours ? 'Your ball' : 'Rival ball';
    el.possessionDot.parentElement.classList.toggle('opponent', !yours);
    if (state.gameOver) return;
    el.meterTitle.textContent = state.dunk ? 'Dunk timing' : 'Shot meter';
    el.meterHint.textContent = state.dunk ? 'E' : 'SPACE';
  }

  function addFeed(tag, text, kind = '') {
    state.feed.unshift({ tag, text, kind });
    state.feed = state.feed.slice(0, 5);
    el.eventFeed.innerHTML = state.feed.map(item => `<div class="feed-line ${item.kind}"><strong>${item.tag}</strong><span>${item.text}</span></div>`).join('');
  }

  function showToast(text, duration = 1700) {
    state.toastText = text;
    state.toastUntil = performance.now() + duration;
    el.toast.textContent = text;
    el.toast.classList.add('visible');
  }

  function setPossession(next, note = '') {
    state.possession = next;
    state.aiStill = false;
    state.possessionNumber += 1;
    state.actionCooldown = 0.35;
    state.shot = null;
    state.dunk = null;
    state.aiShotTimer = next === 'opponent' ? 1.5 : 0;
    if (next === 'player') {
      player.x = clamp(player.x, 300, 810);
      showToast('YOUR BALL');
    } else {
      showToast('RIVAL BALL');
    }
    if (note) addFeed(next === 'player' ? 'BOARD' : 'TURN', note, next === 'player' ? '' : 'opponent');
    updateHud();
  }

  function hasDefenderInFront(shooter, defender) {
    const shooterHoopAngle = angleTo(shooter, hoop);
    const defenderAngle = angleTo(shooter, defender);
    return distance(shooter, defender) < 86 && angleDifference(shooterHoopAngle, defenderAngle) < 0.52;
  }

  function startShot() {
    if (state.gameOver || state.paused || state.possession !== 'player' || state.actionCooldown > 0 || state.dunk) return;
    state.shot = { t: 0, dir: 1, value: 0 };
    state.actionCooldown = 0.22;
    el.meterArea.innerHTML = `<div class="meter-running"><div class="meter-readout"><b id="meterReadout">Set...</b><span>Release SPACE in the green</span></div><div class="meter-rail"><i class="meter-green"></i><i id="meterFill" class="meter-fill"></i><i id="meterCursor" class="meter-cursor"></i></div><div class="meter-labels"><span>EARLY</span><span>PERFECT</span><span>LATE</span></div></div>`;
    updateHud();
  }

  function releaseShot() {
    if (!state.shot || state.possession !== 'player') return;
    const timing = state.shot.value;
    state.shot = null;
    const green = timing >= 43 && timing <= 62;
    const covered = hasDefenderInFront(player, opponent);
    const role = playerRole();
    const three = isThree();
    const points = three ? 3 : 2;
    const rangeSkill = three ? role.three : role.mid;
    const distancePenalty = clamp((distance(player, hoop) - 88) / 380, 0, .42);
    let make = green && !covered;
    if (!make) {
      const chance = .23 + rangeSkill / 230 - distancePenalty - (covered ? .28 : 0);
      make = Math.random() < chance;
    }
    const label = green && !covered ? 'GREEN' : covered ? 'CONTESTED' : timing < 43 ? 'EARLY' : 'LATE';
    resolveShot(make, points, 'player', label, covered);
  }

  function startDunk() {
    if (state.gameOver || state.paused || state.possession !== 'player' || state.actionCooldown > 0 || !isNearRim() || state.shot) {
      if (state.possession === 'player' && !isNearRim() && !state.shot) showToast('GET CLOSER TO THE RIM');
      return;
    }
    state.dunk = { t: 0, dir: 1, value: 0 };
    state.actionCooldown = 0.24;
    el.meterArea.innerHTML = `<div class="meter-running dunk-meter"><div class="meter-readout"><b id="meterReadout">TAP E AGAIN</b><span>Stop the marker in gold</span></div><div class="meter-rail"><i id="meterFill" class="meter-fill"></i><i class="dunk-target"></i><i id="meterCursor" class="meter-cursor"></i></div><div class="meter-labels"><span>MISS</span><span>SLAM ZONE</span><span>MISS</span></div></div>`;
    updateHud();
  }

  function releaseDunk() {
    if (!state.dunk || state.possession !== 'player') return;
    const timing = state.dunk.value;
    state.dunk = null;
    const role = playerRole();
    const covered = hasDefenderInFront(player, opponent);
    const perfect = timing >= 45 && timing <= 58;
    const make = perfect && !covered ? true : Math.random() < (.35 + role.dunk / 190 - (covered ? .23 : 0));
    resolveShot(make, 2, 'player', perfect && !covered ? 'SLAM' : covered ? 'CONTESTED' : 'RIM OUT', covered, true);
  }

  function resolveShot(make, points, shooter, timingLabel, covered, dunk = false) {
    state.actionCooldown = .55;
    const isPlayer = shooter === 'player';
    const name = isPlayer ? 'You' : 'Rival';
    const missTarget = {
      x: hoop.x - 18 - Math.random() * 45,
      y: hoop.y + (Math.random() < .5 ? -1 : 1) * (38 + Math.random() * 48)
    };
    ball.flight = {
      start: { x: isPlayer ? player.x : opponent.x, y: isPlayer ? player.y : opponent.y },
      end: make ? { x: hoop.x, y: hoop.y } : missTarget,
      endZ: make ? 92 : 28,
      t: 0,
      duration: .72,
      make,
      points,
      shooter,
      dunk
    };
    if (make) {
      addFeed(isPlayer ? (dunk ? 'SLAM' : `${points}PT`) : `${points}PT`, `${name} ${dunk ? 'throws it down' : `hits a ${timingLabel.toLowerCase()} jumper`}.`, isPlayer ? 'gold' : 'opponent');
      showToast(isPlayer ? `${dunk ? 'DUNK' : timingLabel} — +${points}` : `RIVAL SCORES ${points}`);
    } else {
      addFeed('MISS', `${name} ${covered ? 'gets smothered' : 'misses the look'}.`, isPlayer ? '' : 'opponent');
      showToast(isPlayer ? (covered ? 'COVERED — NO GUARANTEE' : 'OFF THE RIM') : 'RIVAL MISSES');
    }
  }

  function finishShot(flight) {
    ball.flight = null;
    if (flight.make) {
      if (flight.shooter === 'player') state.playerScore += flight.points;
      else state.opponentScore += flight.points;
      updateHud();
      if (state.playerScore >= 21 || state.opponentScore >= 21) {
        endGame(state.playerScore >= 21);
        return;
      }
      setPossession(flight.shooter === 'player' ? 'opponent' : 'player');
    } else {
      const offense = flight.shooter === 'player' ? player : opponent;
      const defender = flight.shooter === 'player' ? opponent : player;
      const offenseRebound = flight.shooter === 'player' ? playerRole().rebound : 48;
      const defenseRebound = flight.shooter === 'player' ? 48 : playerRole().rebound;
      const chanceForOffense = clamp(.28 + (offenseRebound - defenseRebound) / 180 + (distance(offense, hoop) < distance(defender, hoop) ? .15 : 0), .12, .72);
      const offenseGetsIt = Math.random() < chanceForOffense;
      if (offenseGetsIt) setPossession(flight.shooter, `${flight.shooter === 'player' ? 'You' : 'Rival'} pull down the offensive board.`);
      else setPossession(flight.shooter === 'player' ? 'opponent' : 'player', `${flight.shooter === 'player' ? 'Rival' : 'You'} win the rebound.`);
      updateBall();
    }
  }

  function endGame(playerWon) {
    state.gameOver = true;
    state.possession = null;
    el.gameStatus.textContent = 'FINAL';
    el.gameStatus.classList.add('done');
    el.overlayKicker.textContent = playerWon ? 'COURT CLAIMED' : 'FINAL BUZZER';
    el.overlayTitle.textContent = playerWon ? 'YOU WIN' : 'RIVAL WINS';
    el.overlayCopy.textContent = playerWon ? 'You found the green and owned the glass. Run it back?' : 'The next run is yours. Switch builds and attack the matchup.';
    el.gameOverlay.classList.remove('hidden');
    addFeed(playerWon ? 'WIN' : 'LOSS', playerWon ? 'First to 21. That is your court.' : 'Rival got there first.');
    showToast(playerWon ? 'GAME — YOU WIN' : 'GAME — RIVAL WINS', 2500);
    updateHud();
  }

  function movePlayer(dt) {
    const role = playerRole();
    let forward = 0; let lateral = 0;
    if (keys.has('w') || keys.has('arrowup')) forward += 1;
    if (keys.has('s') || keys.has('arrowdown')) forward -= 1;
    if (keys.has('a') || keys.has('arrowleft')) lateral -= 1;
    if (keys.has('d') || keys.has('arrowright')) lateral += 1;
    const moving = forward !== 0 || lateral !== 0;
    if (moving) {
      const len = Math.hypot(forward, lateral);
      const boost = keys.has('shift') ? 1.18 : 1;
      const speed = (1.58 + role.speed / 60) * boost;
      const cameraForwardX = Math.cos(camera.yaw);
      const cameraForwardY = Math.sin(camera.yaw);
      const cameraRightX = -Math.sin(camera.yaw);
      const cameraRightY = Math.cos(camera.yaw);
      player.vx = (cameraForwardX * forward + cameraRightX * lateral) / len * speed;
      player.vy = (cameraForwardY * forward + cameraRightY * lateral) / len * speed;
      player.facing = Math.atan2(player.vy, player.vx);
      player.bob += dt * 14;
    } else {
      player.vx *= .72;
      player.vy *= .72;
      player.bob += dt * 4;
    }
    player.x = clamp(player.x + player.vx * dt * 60, court.left + 28, court.right - 28);
    player.y = clamp(player.y + player.vy * dt * 60, court.top + 28, court.bottom - 28);
  }

  function moveOpponent(dt) {
    if (state.possession === 'opponent') {
      if (state.aiShotTimer > 0) state.aiShotTimer -= dt;
      state.aiStill = state.aiShotTimer <= .58;
      if (!state.aiStill) {
        const target = { x: hoop.x - 160, y: hoop.y + Math.sin(performance.now() / 720) * 115 };
        const dx = target.x - opponent.x;
        const dy = target.y - opponent.y;
        const len = Math.hypot(dx, dy) || 1;
        const speed = 1.25;
        opponent.vx = dx / len * speed;
        opponent.vy = dy / len * speed;
        opponent.facing = Math.atan2(dy, dx);
        opponent.x = clamp(opponent.x + opponent.vx * dt * 60, court.left + 28, court.right - 28);
        opponent.y = clamp(opponent.y + opponent.vy * dt * 60, court.top + 28, court.bottom - 28);
      } else {
        opponent.vx = 0;
        opponent.vy = 0;
      }
      if (state.aiShotTimer <= 0 && !ball.flight && state.actionCooldown <= 0) {
        const close = distance(opponent, hoop) < 125;
        const points = close ? 2 : 3;
        const range = close ? .57 : .45;
        const covered = hasDefenderInFront(opponent, player);
        const make = Math.random() < range - (covered ? .22 : 0);
        resolveShot(make, points, 'opponent', covered ? 'CONTESTED' : 'SHOT', covered, close && Math.random() < .4);
        state.aiShotTimer = 999;
      }
    } else {
      const dx = player.x - opponent.x;
      const dy = player.y - opponent.y;
      const len = Math.hypot(dx, dy) || 1;
      const guardDistance = state.possession === 'player' ? 63 : 150;
      const target = { x: player.x - dx / len * guardDistance, y: player.y - dy / len * guardDistance };
      const tx = target.x - opponent.x;
      const ty = target.y - opponent.y;
      const tlen = Math.hypot(tx, ty) || 1;
      opponent.vx = tx / tlen * 1.15;
      opponent.vy = ty / tlen * 1.15;
      opponent.facing = Math.atan2(ty, tx);
      opponent.x = clamp(opponent.x + opponent.vx * dt * 60, court.left + 28, court.right - 28);
      opponent.y = clamp(opponent.y + opponent.vy * dt * 60, court.top + 28, court.bottom - 28);
    }
    opponent.bob += dt * (state.aiStill ? 2 : 8);
  }

  function trySteal() {
    if (state.gameOver || state.paused || state.possession !== 'opponent' || !state.aiStill || ball.flight || state.actionCooldown > 0) return;
    const reach = distance(player, opponent);
    if (reach > 92) {
      showToast('STEP CLOSER TO STEAL');
      return;
    }
    const successChance = .72 + playerRole().speed / 360;
    if (Math.random() < successChance) {
      addFeed('STEAL', 'You strip the rival while they stand still.', 'gold');
      showToast('CLEAN STEAL — YOUR BALL');
      setPossession('player');
    } else {
      state.actionCooldown = .7;
      addFeed('REACH', 'The rival protects the ball.', 'opponent');
      showToast('REACH-IN — MISSED');
    }
  }

  function updateBall() {
    if (ball.flight) return;
    if (state.possession === 'player') {
      const side = Math.sin(performance.now() / 125) * 3;
      ball.x = player.x + Math.cos(player.facing || 0) * 21 + side;
      ball.y = player.y + 11 + Math.abs(Math.sin(performance.now() / 125)) * 7;
      ball.z = 8;
    } else if (state.possession === 'opponent') {
      ball.x = opponent.x - 20;
      ball.y = opponent.y + 11 + Math.abs(Math.sin(performance.now() / 150)) * 7;
      ball.z = 8;
    } else {
      ball.x = hoop.x; ball.y = hoop.y; ball.z = 0;
    }
  }

  function updateMeters(dt) {
    if (state.shot) {
      state.shot.value += state.shot.dir * dt * 105;
      if (state.shot.value >= 100) { state.shot.value = 100; state.shot.dir = -1; }
      if (state.shot.value <= 0) { state.shot.value = 0; state.shot.dir = 1; }
      const fill = document.getElementById('meterFill');
      const cursor = document.getElementById('meterCursor');
      const readout = document.getElementById('meterReadout');
      if (fill) fill.style.width = `${state.shot.value}%`;
      if (cursor) cursor.style.left = `${state.shot.value}%`;
      if (readout) readout.textContent = state.shot.value >= 43 && state.shot.value <= 62 ? 'GREEN' : state.shot.value < 43 ? 'EARLY' : 'LATE';
    }
    if (state.dunk) {
      state.dunk.value += state.dunk.dir * dt * 130;
      if (state.dunk.value >= 100) { state.dunk.value = 100; state.dunk.dir = -1; }
      if (state.dunk.value <= 0) { state.dunk.value = 0; state.dunk.dir = 1; }
      const fill = document.getElementById('meterFill');
      const cursor = document.getElementById('meterCursor');
      if (fill) fill.style.width = `${state.dunk.value}%`;
      if (cursor) cursor.style.left = `${state.dunk.value}%`;
    }
  }

  function update(dt) {
    if (state.gameOver) return;
    state.actionCooldown = Math.max(0, state.actionCooldown - dt);
    movePlayer(dt);
    moveOpponent(dt);
    updateCamera(dt);
    updateMeters(dt);
    if (ball.flight) {
      ball.flight.t += dt;
      const p = clamp(ball.flight.t / ball.flight.duration, 0, 1);
      ball.x = lerp(ball.flight.start.x, ball.flight.end.x, p);
      ball.y = lerp(ball.flight.start.y, ball.flight.end.y, p);
      ball.z = lerp(8, ball.flight.endZ, p) + Math.sin(p * Math.PI) * 125;
      if (p >= 1) finishShot(ball.flight);
    } else updateBall();
    if (state.toastUntil && performance.now() > state.toastUntil) {
      el.toast.classList.remove('visible');
      state.toastUntil = 0;
    }
  }

  function drawCourt() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#07131f'); g.addColorStop(.34, '#102d38'); g.addColorStop(1, '#0c252d');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const nearX = Math.max(court.left, camera.x + 42);
    const floor = [
      project({ x: nearX, y: court.top, z: 0 }),
      project({ x: court.right, y: court.top, z: 0 }),
      project({ x: court.right, y: court.bottom, z: 0 }),
      project({ x: nearX, y: court.bottom, z: 0 })
    ];
    ctx.save();
    ctx.fillStyle = '#164049';
    ctx.beginPath();
    ctx.moveTo(floor[0].x, floor[0].y);
    floor.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    for (let x = nearX; x <= court.right; x += 42) {
      drawWorldLine([{ x, y: court.top, z: 0 }, { x, y: court.bottom, z: 0 }], 'rgba(180,232,215,.08)', 1);
    }
    drawWorldLine([{ x: nearX, y: court.top, z: 1 }, { x: court.right, y: court.top, z: 1 }], 'rgba(220,244,233,.55)', 2);
    drawWorldLine([{ x: nearX, y: court.bottom, z: 1 }, { x: court.right, y: court.bottom, z: 1 }], 'rgba(220,244,233,.55)', 2);
    drawWorldLine([{ x: court.right, y: court.top, z: 1 }, { x: court.right, y: court.bottom, z: 1 }], 'rgba(220,244,233,.55)', 2);
    drawWorldLine([{ x: court.left, y: court.top, z: 1 }, { x: court.left, y: court.bottom, z: 1 }], 'rgba(220,244,233,.38)', 2, [9, 8]);
    drawWorldLine([{ x: hoop.x - 175, y: hoop.y - 90, z: 1 }, { x: hoop.x, y: hoop.y - 90, z: 1 }, { x: hoop.x, y: hoop.y + 90, z: 1 }, { x: hoop.x - 175, y: hoop.y + 90, z: 1 }], 'rgba(220,244,233,.45)', 2);
    drawWorldLine([{ x: hoop.x - 72, y: hoop.y - 44, z: 1 }, { x: hoop.x, y: hoop.y - 44, z: 1 }, { x: hoop.x, y: hoop.y + 44, z: 1 }, { x: hoop.x - 72, y: hoop.y + 44, z: 1 }], 'rgba(220,244,233,.3)', 1);
    drawWorldLine(sampleArc(hoop.x - 72, hoop.y, 44, Math.PI / 2, Math.PI * 1.5, 20), 'rgba(220,244,233,.35)', 1);
    drawWorldLine(sampleArc(hoop.x, hoop.y, 117, Math.PI / 2, Math.PI * 1.5), 'rgba(220,244,233,.4)', 2);
    drawWorldLine(sampleArc(hoop.x, hoop.y, threePointRadius, Math.PI / 2, Math.PI * 1.5), 'rgba(255,200,87,.5)', 2);
    drawHoop(hoop);
    ctx.save();
    ctx.fillStyle = 'rgba(223,246,237,.55)';
    ctx.font = '800 10px Segoe UI';
    ctx.fillText('FOLLOW CAM', 20, 28);
    ctx.fillStyle = 'rgba(255,200,87,.6)';
    ctx.font = '700 10px Segoe UI';
    ctx.fillText('3PT ARC', 20, 44);
    ctx.restore();
  }

  function drawHoop(rimHoop) {
    ctx.save();
    const backboard = [
      project({ x: rimHoop.x + 28, y: rimHoop.y - 58, z: 62 }),
      project({ x: rimHoop.x + 28, y: rimHoop.y + 58, z: 62 }),
      project({ x: rimHoop.x + 28, y: rimHoop.y + 58, z: 160 }),
      project({ x: rimHoop.x + 28, y: rimHoop.y - 58, z: 160 })
    ];
    ctx.fillStyle = 'rgba(215,241,239,.23)';
    ctx.beginPath();
    ctx.moveTo(backboard[0].x, backboard[0].y);
    backboard.slice(1).forEach(point => ctx.lineTo(point.x, point.y));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#dce9e8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(backboard[0].x, backboard[0].y); backboard.slice(1).forEach(point => ctx.lineTo(point.x, point.y)); ctx.closePath(); ctx.stroke();
    drawWorldLine([{ x: rimHoop.x + 27, y: rimHoop.y - 36, z: 95 }, { x: rimHoop.x + 27, y: rimHoop.y + 36, z: 95 }], 'rgba(255,255,255,.45)', 2);
    drawWorldLine([{ x: rimHoop.x + 28, y: rimHoop.y, z: 62 }, { x: rimHoop.x + 28, y: rimHoop.y, z: 160 }], 'rgba(255,255,255,.14)', 2);
    drawWorldLine([{ x: rimHoop.x + 28, y: rimHoop.y, z: 62 }, { x: rimHoop.x, y: rimHoop.y, z: 92 }], 'rgba(215,241,239,.65)', 3);
    const rim = [];
    for (let index = 0; index <= 24; index += 1) {
      const angle = Math.PI * 2 * index / 24;
      rim.push(project({ x: rimHoop.x + Math.cos(angle) * rimHoop.rim, y: rimHoop.y + Math.sin(angle) * rimHoop.rim, z: 92 }));
    }
    ctx.strokeStyle = '#59b8ff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(rim[0].x, rim[0].y); rim.slice(1).forEach(point => ctx.lineTo(point.x, point.y)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.48)'; ctx.lineWidth = 1;
    for (let index = -2; index <= 2; index += 1) drawWorldLine([{ x: rimHoop.x + index * 5, y: rimHoop.y + 12, z: 89 }, { x: rimHoop.x + index * 3, y: rimHoop.y + 12, z: 36 }], 'rgba(255,255,255,.45)', 1);
    const labelPoint = project({ x: rimHoop.x, y: rimHoop.y, z: 176 });
    ctx.fillStyle = '#8bd0ff'; ctx.font = `800 ${Math.max(8, 10 * labelPoint.scale)}px Segoe UI`; ctx.textAlign = 'center'; ctx.fillText('SCORE', labelPoint.x, labelPoint.y - 6);
    ctx.restore();
  }

  function drawPlayer(actor, color, accent, label, isUser) {
    const foot = project({ x: actor.x, y: actor.y, z: 0 });
    const waist = project({ x: actor.x, y: actor.y, z: 35 });
    const head = project({ x: actor.x, y: actor.y, z: 70 });
    const scale = clamp(foot.scale, .42, 1.8);
    ctx.save();
    ctx.globalAlpha = .3; ctx.fillStyle = '#02080c'; ctx.beginPath(); ctx.ellipse(foot.x, foot.y + 2, 23 * scale, 7 * scale, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const bob = Math.sin(actor.bob) * 1.2 * scale;
    ctx.translate(0, bob);
    if (isUser && (keys.has('shift') || hasDefenderInFront(player, opponent))) {
      ctx.strokeStyle = keys.has('shift') ? 'rgba(155,243,106,.7)' : 'rgba(255,200,87,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(foot.x, foot.y, 30 * scale, 11 * scale, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(waist.x - 15 * scale, waist.y); ctx.lineTo(waist.x + 15 * scale, waist.y); ctx.lineTo(head.x + 10 * scale, head.y + 17 * scale); ctx.lineTo(head.x - 10 * scale, head.y + 17 * scale); ctx.closePath(); ctx.fill();
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(head.x, head.y, 10 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 3 * scale; ctx.beginPath(); ctx.moveTo(waist.x - 7 * scale, waist.y + 5 * scale); ctx.lineTo(foot.x - 10 * scale, foot.y); ctx.moveTo(waist.x + 7 * scale, waist.y + 5 * scale); ctx.lineTo(foot.x + 10 * scale, foot.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2 * scale; ctx.beginPath(); ctx.moveTo(waist.x, waist.y + 3 * scale); ctx.lineTo(waist.x, waist.y + 12 * scale); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = isUser ? 'rgba(128,198,255,.95)' : 'rgba(255,146,147,.95)'; ctx.font = `800 ${Math.max(8, 10 * scale)}px Segoe UI`; ctx.textAlign = 'center'; ctx.fillText(isUser ? 'YOU' : 'RIVAL', head.x, head.y - 18 * scale);
    if (!isUser && state.possession === 'opponent' && state.aiStill) {
      ctx.fillStyle = '#ffc857'; ctx.font = `800 ${Math.max(8, 10 * scale)}px Segoe UI`; ctx.fillText('STEAL  X', head.x, head.y - 33 * scale);
    }
  }

  function drawBall() {
    if (!ball.visible) return;
    const shadow = project({ x: ball.x, y: ball.y, z: 0 });
    const point = project({ x: ball.x, y: ball.y, z: ball.z });
    const radius = clamp(7 * point.scale, 3, 9);
    ctx.save();
    ctx.globalAlpha = .2; ctx.fillStyle = '#02080c'; ctx.beginPath(); ctx.ellipse(shadow.x, shadow.y + 2, radius * 1.25, radius * .45, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = '#e97837'; ctx.strokeStyle = '#572817'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(63,24,13,.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(point.x, point.y, radius * .72, -.8, 1.9); ctx.stroke(); ctx.beginPath(); ctx.moveTo(point.x - radius * .7, point.y + radius * .15); ctx.quadraticCurveTo(point.x, point.y - radius * .3, point.x + radius * .7, point.y + radius * .15); ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawCourt();
    if (state.possession === 'player' && !state.shot && !state.dunk && !ball.flight && isNearRim()) {
      const target = project({ x: player.x, y: player.y, z: 1 });
      ctx.save(); ctx.globalAlpha = .8; ctx.strokeStyle = '#ffc857'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.ellipse(target.x, target.y, 31 * target.scale, 12 * target.scale, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    [opponent, player].sort((a, b) => b.x - a.x).forEach(actor => {
      if (actor === player) drawPlayer(actor, '#348ddd', '#8ad1ff', 'U', true);
      else drawPlayer(actor, '#e95d65', '#ff9d8e', 'R', false);
    });
    drawBall();
  }

  function loop(now) {
    const dt = Math.min((now - state.lastTime) / 1000, .033);
    state.lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    keys.add(key);
    if (key === ' ' && !event.repeat) startShot();
    if (key === 'e' && !event.repeat) {
      if (state.dunk) releaseDunk();
      else startDunk();
    }
    if (key === 'x' && !event.repeat) trySteal();
  });
  window.addEventListener('keyup', event => {
    const key = event.key.toLowerCase();
    keys.delete(key);
    if (key === ' ') releaseShot();
  });
  document.querySelectorAll('.role-choice').forEach(button => button.addEventListener('click', () => chooseRole(button.dataset.role)));
  document.getElementById('restartBtn').addEventListener('click', resetGame);
  document.getElementById('overlayRestart').addEventListener('click', resetGame);

  updateRolePanel();
  resetGame();
  requestAnimationFrame(loop);
})();
