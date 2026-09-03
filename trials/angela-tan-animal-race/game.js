(() => {
  'use strict';

  const canvas = document.querySelector('#game');
  const ctx = canvas.getContext('2d');
  const ui = {
    startPanel: document.querySelector('#startPanel'), resultPanel: document.querySelector('#resultPanel'),
    place: document.querySelector('#place'), speed: document.querySelector('#speed'), distance: document.querySelector('#distance'),
    boost: document.querySelector('#boostFill'), results: document.querySelector('#results'),
    resultIcon: document.querySelector('#resultIcon'), resultLabel: document.querySelector('#resultLabel'),
    resultTitle: document.querySelector('#resultTitle'), resultText: document.querySelector('#resultText')
  };

  const W = canvas.width, H = canvas.height, RACE_LENGTH = 5600, GROUND = 490;
  const names = ['You', 'Bramble', 'Pip', 'Clover', 'Mochi', 'Dash'];
  const animals = ['fox', 'rabbit', 'panda', 'frog', 'koala', 'tiger'];
  let state = 'ready', last = 0, raceTime = 0, camera = 0, soundOn = true, audio;
  let racers = [], objects = [], particles = [], finishOrder = [];
  const player = () => racers[0];

  function reset() {
    racers = names.map((name, i) => ({ name, animal: animals[i], x: i ? -Math.random() * 80 : 0, y: 0,
      vy: 0, speed: i ? 270 + Math.random() * 25 : 292, base: i ? 270 + Math.random() * 25 : 292,
      ducking: false, boost: 0, stunned: 0, finished: false, lane: i }));
    objects = [];
    const patterns = ['pothole', 'branch', 'boost', 'pothole', 'boost', 'branch'];
    for (let x = 620, i = 0; x < RACE_LENGTH - 250; x += 330 + Math.random() * 170, i++) {
      objects.push({ x, type: patterns[i % patterns.length], hit: false });
    }
    particles = []; finishOrder = []; raceTime = 0; camera = 0;
    Object.assign(ui.place, { textContent: '—' });
    ui.speed.textContent = '0'; ui.distance.textContent = '0%'; ui.boost.style.width = '0%';
  }

  function start() {
    reset(); state = 'racing'; ui.startPanel.classList.add('hidden'); ui.resultPanel.classList.add('hidden');
    last = performance.now(); tone(440, .08); requestAnimationFrame(loop);
  }

  function jump() {
    if (state !== 'racing') return;
    const p = player();
    if (p.y === 0 && !p.ducking) { p.vy = 760; tone(520, .055); }
  }
  function setDuck(value) { if (state === 'racing' && player().y === 0) player().ducking = value; }

  function update(dt) {
    raceTime += dt;
    racers.forEach((r, i) => {
      if (r.finished) return;
      if (r.stunned > 0) r.stunned -= dt;
      if (r.boost > 0) r.boost -= dt;
      const variance = i ? Math.sin(raceTime * (1.1 + i * .13) + i) * 13 : 0;
      r.speed += ((r.base + variance + (r.boost > 0 ? 125 : 0) - (r.stunned > 0 ? 150 : 0)) - r.speed) * dt * 5;
      r.x += r.speed * dt;
      if (r.y > 0 || r.vy > 0) { r.y += r.vy * dt; r.vy -= 1900 * dt; if (r.y <= 0) { r.y = 0; r.vy = 0; } }
      if (r.x >= RACE_LENGTH) { r.x = RACE_LENGTH; r.finished = true; finishOrder.push(r); }
    });

    const p = player();
    objects.forEach(o => {
      const dx = o.x - p.x;
      if (!o.hit && dx > -34 && dx < 38) {
        if (o.type === 'boost') { o.hit = true; p.boost = 2.4; burst(o.x, '#2d8cff'); tone(760, .12); }
        else {
          const safe = o.type === 'pothole' ? p.y > 72 : p.ducking;
          if (!safe) { o.hit = true; p.stunned = 1.05; burst(o.x, '#ef754f'); tone(130, .15); }
        }
      }
    });
    particles.forEach(q => { q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 300 * dt; });
    particles = particles.filter(q => q.life > 0);
    camera += ((Math.max(0, p.x - 235)) - camera) * Math.min(1, dt * 4);

    const sorted = [...racers].sort((a, b) => b.x - a.x);
    ui.place.textContent = ordinal(sorted.indexOf(p) + 1);
    ui.speed.textContent = Math.round(p.speed);
    ui.distance.textContent = `${Math.min(100, Math.floor(p.x / RACE_LENGTH * 100))}%`;
    ui.boost.style.width = `${Math.max(0, p.boost / 2.4 * 100)}%`;
    if (p.finished) finishRace();
  }

  function finishRace() {
    state = 'finished';
    const remaining = racers.filter(r => !r.finished).sort((a, b) => b.x - a.x);
    const standings = [...finishOrder, ...remaining];
    const rank = standings.indexOf(player()) + 1, won = rank <= 3;
    ui.resultIcon.textContent = won ? '🏆' : '🌿';
    ui.resultLabel.textContent = won ? 'PODIUM FINISH' : 'RACE COMPLETE';
    ui.resultTitle.textContent = `You placed ${ordinal(rank)}!`;
    ui.resultText.textContent = won ? 'You made the podium. What a run!' : 'Just outside the top three—give it another dash.';
    const animalIcons = { fox: '🦊', rabbit: '🐰', panda: '🐼', frog: '🐸', koala: '🐨', tiger: '🐯' };
    ui.results.innerHTML = standings.slice(0, 6).map((r, i) => `<li class="${r === player() ? 'player' : ''}">${i + 1}. ${animalIcons[r.animal]} ${r.name}</li>`).join('');
    ui.resultPanel.classList.remove('hidden'); tone(won ? 660 : 240, .2);
  }

  function burst(x, color) {
    for (let i = 0; i < 15; i++) particles.push({ x, y: GROUND - 35, vx: (Math.random() - .5) * 280, vy: -Math.random() * 230, life: .7, color });
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#9edaf0'); sky.addColorStop(1, '#e8f3d5');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    drawScenery();
    ctx.fillStyle = '#75a75f'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#628d51'; ctx.fillRect(0, GROUND, W, 9);
    drawTrackMarks();
    objects.forEach(drawObject);
    drawFinish();
    [...racers].reverse().forEach(drawRacer);
    particles.forEach(q => { ctx.globalAlpha = q.life / .7; ctx.fillStyle = q.color; ctx.fillRect(q.x - camera, q.y, 7, 7); ctx.globalAlpha = 1; });
  }

  function drawScenery() {
    const far = -(camera * .12) % 500;
    ctx.fillStyle = '#80b77e';
    for (let x = far - 300; x < W + 400; x += 500) { ctx.beginPath(); ctx.arc(x, 470, 270, 190, Math.PI, 0); ctx.fill(); }
    const near = -(camera * .28) % 330;
    for (let x = near - 150; x < W + 200; x += 330) {
      ctx.fillStyle = '#43745a'; ctx.fillRect(x - 8, 350, 16, 140);
      ctx.fillStyle = '#4f8561'; ctx.beginPath(); ctx.arc(x, 330, 65, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#63996d'; ctx.beginPath(); ctx.arc(x + 35, 350, 44, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#fff9'; ctx.font = '42px sans-serif';
    for (let x = 170 - (camera * .05) % 700; x < W; x += 700) ctx.fillText('☁', x, 105);
  }

  function drawTrackMarks() {
    ctx.strokeStyle = '#8ab475'; ctx.lineWidth = 2;
    for (let x = -(camera % 130); x < W; x += 130) { ctx.beginPath(); ctx.moveTo(x, 540); ctx.lineTo(x + 60, 540); ctx.stroke(); }
  }

  function drawObject(o) {
    const x = o.x - camera; if (x < -100 || x > W + 100 || o.hit) return;
    if (o.type === 'pothole') {
      ctx.fillStyle = '#466044'; ctx.beginPath(); ctx.ellipse(x, GROUND + 1, 48, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#263b32'; ctx.beginPath(); ctx.ellipse(x, GROUND - 2, 39, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#789b65'; ctx.beginPath(); ctx.ellipse(x - 5, GROUND - 5, 22, 3, 0, 0, Math.PI * 2); ctx.fill();
    } else if (o.type === 'branch') {
      ctx.strokeStyle = '#654b2d'; ctx.lineWidth = 13; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x - 48, GROUND - 98); ctx.lineTo(x + 48, GROUND - 98); ctx.stroke();
      ctx.fillStyle = '#386d49'; ctx.font = '28px serif'; ctx.fillText('♣', x - 40, GROUND - 93); ctx.fillText('♣', x + 15, GROUND - 92);
    } else {
      ctx.fillStyle = '#147cf0'; ctx.shadowColor = '#59b9ff'; ctx.shadowBlur = 18;
      roundRect(x - 38, GROUND - 16, 76, 12, 5); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#d9f5ff'; ctx.font = '900 27px sans-serif'; ctx.fillText('»»', x - 30, GROUND - 19);
    }
  }

  function drawFinish() {
    const x = RACE_LENGTH - camera; if (x < -100 || x > W + 100) return;
    ctx.fillStyle = '#233c38'; ctx.fillRect(x - 5, 245, 10, GROUND - 245);
    const size = 22;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 6; col++) {
      ctx.fillStyle = (row + col) % 2 ? '#fff' : '#233c38'; ctx.fillRect(x + col * size, 255 + row * size, size, size);
    }
  }

  function drawRacer(r) {
    let x = r.x - camera, laneOffset = r.lane * 8;
    if (x < -80 || x > W + 80) return;
    const y = GROUND - 30 - r.y - laneOffset;
    ctx.save(); ctx.translate(x, y); if (r.ducking) ctx.scale(1.22, .65);
    if (r.boost > 0) { ctx.fillStyle = '#4ab1ff88'; for (let i = 0; i < 3; i++) ctx.fillRect(-65 - i * 22, -15 + i * 9, 45, 5); }
    ctx.fillStyle = '#29453833'; ctx.beginPath(); ctx.ellipse(0, 27 + r.y, 31, 8, 0, 0, Math.PI * 2); ctx.fill();
    drawAnimal(r.animal, r === player() ? 1.08 : .92);
    if (r === player()) { ctx.fillStyle = '#fff'; roundRect(-25, -54, 50, 18, 8); ctx.fill(); ctx.fillStyle = '#24483c'; ctx.font = '900 10px sans-serif'; ctx.fillText('YOU', 0, -45); }
    ctx.restore();
  }

  function drawAnimal(type, scale) {
    const looks = {
      fox:    { body: '#e8753c', belly: '#fff0d5', ear: '#a8432d', stripe: null },
      rabbit: { body: '#d8d2c6', belly: '#f5eee4', ear: '#e9a6ac', stripe: null },
      panda:  { body: '#f4f1e8', belly: '#ffffff', ear: '#26312f', stripe: '#26312f' },
      frog:   { body: '#63a94f', belly: '#b4d878', ear: '#63a94f', stripe: null },
      koala:  { body: '#89999a', belly: '#cbd1cb', ear: '#657778', stripe: null },
      tiger:  { body: '#e99a32', belly: '#ffe0a2', ear: '#6f3b25', stripe: '#633923' }
    };
    const a = looks[type];
    ctx.save(); ctx.scale(scale, scale); ctx.lineJoin = 'round'; ctx.lineCap = 'round';

    // Tail and four running legs sit behind the solid body.
    ctx.strokeStyle = a.body; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(-27, 6); ctx.quadraticCurveTo(-52, -3, -44, -25); ctx.stroke();
    ctx.strokeStyle = type === 'fox' ? a.belly : a.body; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(-44, -25); ctx.lineTo(-48, -31); ctx.stroke();
    ctx.strokeStyle = type === 'panda' ? '#26312f' : a.body; ctx.lineWidth = 9;
    [[-18, 16, -23, 30], [5, 17, 1, 31], [19, 13, 26, 26]].forEach(l => {
      ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke();
    });

    ctx.fillStyle = a.body; ctx.beginPath(); ctx.ellipse(-3, 5, 32, 22, -.08, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = a.belly; ctx.beginPath(); ctx.ellipse(6, 10, 18, 11, 0, 0, Math.PI * 2); ctx.fill();
    if (a.stripe) {
      ctx.strokeStyle = a.stripe; ctx.lineWidth = 4;
      if (type === 'tiger') [-15, -4, 8].forEach(x => { ctx.beginPath(); ctx.moveTo(x, -13); ctx.lineTo(x + 4, -3); ctx.stroke(); });
      if (type === 'panda') { ctx.fillStyle = a.stripe; ctx.beginPath(); ctx.ellipse(-17, 7, 9, 17, -.35, 0, Math.PI * 2); ctx.fill(); }
    }

    // Head, ears, face and muzzle.
    ctx.fillStyle = a.ear;
    if (type === 'rabbit') {
      roundRect(8, -55, 11, 32, 7); ctx.fill(); roundRect(28, -55, 11, 32, 7); ctx.fill();
    } else if (type === 'frog') {
      ctx.beginPath(); ctx.arc(13, -25, 10, 0, Math.PI * 2); ctx.arc(36, -25, 10, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.arc(12, -25, type === 'koala' ? 13 : 9, 0, Math.PI * 2); ctx.arc(35, -25, type === 'koala' ? 13 : 9, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = a.body; ctx.beginPath(); ctx.arc(24, -10, 25, 0, Math.PI * 2); ctx.fill();
    if (type === 'panda') {
      ctx.fillStyle = '#26312f'; ctx.beginPath(); ctx.ellipse(14, -13, 7, 10, .3, 0, Math.PI * 2); ctx.ellipse(34, -13, 7, 10, -.3, 0, Math.PI * 2); ctx.fill();
    }
    if (type === 'tiger') {
      ctx.strokeStyle = a.stripe; ctx.lineWidth = 3; [-6, 0, 6].forEach(dx => { ctx.beginPath(); ctx.moveTo(24 + dx, -33); ctx.lineTo(24 + dx / 2, -24); ctx.stroke(); });
    }
    ctx.fillStyle = a.belly; ctx.beginPath(); ctx.ellipse(29, 0, 15, 11, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#172c28'; ctx.beginPath(); ctx.arc(16, -13, 3, 0, Math.PI * 2); ctx.arc(35, -13, 3, 0, Math.PI * 2); ctx.arc(30, -2, 4, 0, Math.PI * 2); ctx.fill();
    if (type === 'koala') { ctx.fillStyle = '#354544'; ctx.beginPath(); ctx.ellipse(29, -2, 7, 9, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function ordinal(n) { return n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'); }
  function tone(freq, duration) {
    if (!soundOn) return;
    try { audio ||= new AudioContext(); const osc = audio.createOscillator(), gain = audio.createGain(); osc.frequency.value = freq; gain.gain.setValueAtTime(.045, audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + duration); osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + duration); } catch (_) {}
  }
  function loop(now) { if (state !== 'racing') return; const dt = Math.min(.033, (now - last) / 1000); last = now; update(dt); draw(); if (state === 'racing') requestAnimationFrame(loop); }

  document.querySelector('#startButton').addEventListener('click', start);
  document.querySelector('#restartButton').addEventListener('click', start);
  document.querySelector('#soundButton').addEventListener('click', e => { soundOn = !soundOn; e.currentTarget.textContent = `Sound: ${soundOn ? 'on' : 'off'}`; });
  document.querySelector('#jumpButton').addEventListener('pointerdown', jump);
  const duckButton = document.querySelector('#duckButton');
  duckButton.addEventListener('pointerdown', e => { e.preventDefault(); setDuck(true); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => duckButton.addEventListener(type, () => setDuck(false)));
  window.addEventListener('keydown', e => { if (['Space', 'ArrowDown'].includes(e.code)) e.preventDefault(); if (e.code === 'Space' && !e.repeat) jump(); if (e.code === 'ArrowDown') setDuck(true); });
  window.addEventListener('keyup', e => { if (e.code === 'ArrowDown') setDuck(false); });
  reset(); draw();
})();
