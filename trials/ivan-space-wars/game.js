(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const ui = {
    overlay: document.getElementById('gameOverlay'),
    overlayEyebrow: document.getElementById('overlayEyebrow'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayCopy: document.getElementById('overlayCopy'),
    overlayButton: document.getElementById('overlayButton'),
    shipCustomizer: document.getElementById('shipCustomizer'),
    shipColorValue: document.getElementById('shipColorValue'),
    shipColorInput: document.getElementById('shipColorInput'),
    colorSwatches: document.getElementById('colorSwatches'),
    powerupOptions: document.getElementById('powerupOptions'),
    controlStrip: document.querySelector('.control-strip'),
    floatingStatus: document.getElementById('floatingStatus'),
    livesText: document.getElementById('livesText'),
    playerBar: document.getElementById('playerBar'),
    enemyHealthText: document.getElementById('enemyHealthText'),
    enemyBar: document.getElementById('enemyBar'),
    levelText: document.getElementById('levelText'),
    killsText: document.getElementById('killsText'),
    shieldText: document.getElementById('shieldText'),
    shieldStat: document.querySelector('.shield-stat')
  };

  const keys = { left: false, right: false, space: false };
  const levelConfig = [
    { enemySpeed: 78, fireEvery: 1.55, bulletSpeed: 210 },
    { enemySpeed: 108, fireEvery: 1.05, bulletSpeed: 255 },
    { enemySpeed: 145, fireEvery: 0.69, bulletSpeed: 310 }
  ];

  let selectedShipColor = '#4de4ff';
  let game;
  let lastTime = 0;
  let statusTimer = 0;

  function makeStars() {
    return Array.from({ length: 110 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: Math.random() * 1.8 + .25,
      speed: Math.random() * 20 + 8,
      alpha: Math.random() * .75 + .15
    }));
  }

  function createGame() {
    return {
      phase: 'ready',
      level: 1,
      kills: 0,
      lives: 3,
      time: 0,
      introTimer: 0,
      messageTimer: 0,
      stars: makeStars(),
      player: {
        x: W / 2,
        y: H - 59,
        width: 72,
        height: 32,
        speed: 430,
        shield: true,
        invulnerable: 0,
        shotCooldown: 0,
        rapidTime: 0,
        shipColor: selectedShipColor,
        thrust: 0
      },
      enemy: null,
      playerBullets: [],
      enemyBullets: [],
      particles: [],
      powerups: []
    };
  }

  function spawnEnemy() {
    const config = levelConfig[game.level - 1];
    game.enemy = {
      x: W / 2,
      y: 86,
      width: 86,
      height: 42,
      hp: 100,
      maxHp: 100,
      vx: config.enemySpeed,
      fireTimer: .7,
      phase: Math.random() * Math.PI * 2
    };
  }

  function resetGame() {
    game = createGame();
    spawnEnemy();
    updateHud();
    setOverlay('ready');
  }

  function restartGame() {
    keys.left = false;
    keys.right = false;
    keys.space = false;
    game = createGame();
    spawnEnemy();
    updateHud();
    setOverlay('ready');
    game.phase = 'playing';
    game.introTimer = 1.5;
    ui.overlay.classList.add('hidden');
    showStatus('MISSION RESTARTED');
  }

  function startGame() {
    if (game.phase === 'playing') return;
    if (game.phase === 'powerup') return;
    if (game.phase === 'won' || game.phase === 'lost') {
      restartGame();
      return;
    }
    game.phase = 'playing';
    game.introTimer = 1.5;
    ui.overlay.classList.add('hidden');
    showStatus('MISSION LIVE');
  }

  function setOverlay(type) {
    ui.overlay.classList.remove('hidden');
    const isPowerup = type === 'powerup';
    ui.overlay.classList.toggle('powerup-mode', isPowerup);
    ui.shipCustomizer.hidden = type !== 'ready';
    ui.powerupOptions.hidden = !isPowerup;
    ui.overlayButton.hidden = isPowerup;
    ui.controlStrip.hidden = isPowerup;
    if (type === 'ready') {
      ui.overlayEyebrow.textContent = 'DEEP SPACE // SECTOR 9';
      ui.overlayTitle.textContent = 'BREAK THE SIEGE';
      ui.overlayCopy.textContent = 'Destroy the enemy core three times before your three lives burn out.';
      ui.overlayButton.innerHTML = 'Launch mission <span>↗</span>';
    } else if (isPowerup) {
      ui.overlayEyebrow.textContent = `CORE BREAK ${game.kills} // LOADOUT`; 
      ui.overlayTitle.textContent = 'CHOOSE YOUR EDGE';
      ui.overlayCopy.textContent = `Select one upgrade before Level ${String(game.level + 1).padStart(2, '0')}.`;
    } else if (type === 'won') {
      ui.overlayEyebrow.textContent = 'MISSION COMPLETE // SECTOR SECURED';
      ui.overlayTitle.textContent = 'CORE DESTROYED';
      ui.overlayCopy.textContent = `You broke through all three enemy cores with ${game.lives} ${game.lives === 1 ? 'life' : 'lives'} remaining.`;
      ui.overlayButton.innerHTML = 'Fly again <span>↗</span>';
    } else {
      ui.overlayEyebrow.textContent = 'SIGNAL LOST // RETREAT REQUIRED';
      ui.overlayTitle.textContent = 'SHIP DISABLED';
      ui.overlayCopy.textContent = 'The enemy fleet overwhelmed your shields. Re-arm and try the mission again.';
      ui.overlayButton.innerHTML = 'Restart mission <span>↗</span>';
    }
  }

  function showStatus(message, duration = 1.8) {
    ui.floatingStatus.textContent = message;
    ui.floatingStatus.classList.add('show');
    statusTimer = duration;
  }

  function updateHud() {
    const hp = game.phase === 'powerup' ? 0 : Math.max(0, game.enemy ? game.enemy.hp : 100);
    ui.livesText.textContent = `${game.lives} ${game.lives === 1 ? 'LIFE' : 'LIVES'}`;
    ui.playerBar.style.width = `${(game.lives / 3) * 100}%`;
    ui.enemyHealthText.textContent = `${Math.ceil(hp)}%`;
    ui.enemyBar.style.width = `${hp}%`;
    ui.levelText.textContent = `${String(game.level).padStart(2, '0')} / 03`;
    ui.killsText.textContent = `${game.kills} / 3`;
    ui.shieldText.textContent = game.player.shield ? 'READY' : 'DOWN';
    ui.shieldStat.classList.toggle('shield-down', !game.player.shield);
  }

  function update(dt) {
    game.time += dt;
    if (statusTimer > 0) {
      statusTimer -= dt;
      if (statusTimer <= 0) ui.floatingStatus.classList.remove('show');
    }
    updateStars(dt);
    updateParticles(dt);
    if (game.phase !== 'playing') return;

    if (game.introTimer > 0) game.introTimer -= dt;
    if (game.player.invulnerable > 0) game.player.invulnerable -= dt;
    if (game.player.rapidTime > 0) game.player.rapidTime -= dt;
    if (game.messageTimer > 0) game.messageTimer -= dt;

    updatePlayer(dt);
    updateEnemy(dt);
    updatePlayerBullets(dt);
    updateEnemyBullets(dt);
    updatePowerups(dt);
    updateHud();
  }

  function updateStars(dt) {
    game.stars.forEach(star => {
      star.y += star.speed * dt * (game.phase === 'playing' ? 1.2 : .35);
      if (star.y > H + 2) { star.y = -2; star.x = Math.random() * W; }
    });
  }

  function updatePlayer(dt) {
    const direction = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    game.player.x += direction * game.player.speed * dt;
    game.player.x = clamp(game.player.x, 50, W - 50);
    game.player.thrust = direction !== 0 ? Math.min(1, game.player.thrust + dt * 7) : Math.max(0, game.player.thrust - dt * 5);
    game.player.shotCooldown -= dt;

    if (keys.space && game.player.shotCooldown <= 0) {
      firePlayerShot();
      const fireRate = game.player.rapidTime > 0 ? .075 : .19;
      game.player.shotCooldown = fireRate;
    }
  }

  function firePlayerShot() {
    game.playerBullets.push({ x: game.player.x, y: game.player.y - 23, speed: 600, radius: 3.5 });
    for (let i = 0; i < 4; i++) {
      game.particles.push({ x: game.player.x + random(-7, 7), y: game.player.y - 23, vx: random(-35, 35), vy: random(20, 70), life: .22, maxLife: .22, color: '#b5f8ff', size: random(1, 2.5) });
    }
  }

  function updateEnemy(dt) {
    const enemy = game.enemy;
    const config = levelConfig[game.level - 1];
    enemy.x += enemy.vx * dt;
    enemy.phase += dt * 2;
    enemy.y = 88 + Math.sin(enemy.phase) * 9;
    if (enemy.x < 54 || enemy.x > W - 54) {
      enemy.x = clamp(enemy.x, 54, W - 54);
      enemy.vx *= -1;
    }
    enemy.fireTimer -= dt;
    if (enemy.fireTimer <= 0) {
      fireEnemyShot();
      enemy.fireTimer = config.fireEvery * random(.78, 1.14);
    }
  }

  function fireEnemyShot() {
    const config = levelConfig[game.level - 1];
    const dx = game.player.x - game.enemy.x;
    const distance = Math.max(1, Math.hypot(dx, game.player.y - game.enemy.y));
    const speed = config.bulletSpeed;
    const vx = (dx / distance) * speed * .52;
    const vy = (Math.abs(game.player.y - game.enemy.y) / distance) * speed;
    game.enemyBullets.push({ x: game.enemy.x, y: game.enemy.y + 27, vx, vy, radius: 5 });
    if (game.level === 3 && Math.random() < .28) {
      game.enemyBullets.push({ x: game.enemy.x - 19, y: game.enemy.y + 22, vx: -35, vy: speed * .93, radius: 4 });
      game.enemyBullets.push({ x: game.enemy.x + 19, y: game.enemy.y + 22, vx: 35, vy: speed * .93, radius: 4 });
    }
  }

  function updatePlayerBullets(dt) {
    for (let i = game.playerBullets.length - 1; i >= 0; i--) {
      const bullet = game.playerBullets[i];
      bullet.y -= bullet.speed * dt;
      if (bullet.y < -15) { game.playerBullets.splice(i, 1); continue; }
      if (game.enemy && circleHitsShip(bullet, game.enemy)) {
        game.enemy.hp = Math.max(0, game.enemy.hp - 12);
        burst(bullet.x, bullet.y, '#ff9f79', 5);
        game.playerBullets.splice(i, 1);
        if (game.enemy.hp <= 0) {
          enemyDestroyed();
          break;
        }
      }
    }
  }

  function updateEnemyBullets(dt) {
    for (let i = game.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = game.enemyBullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.y > H + 15 || bullet.x < -15 || bullet.x > W + 15) { game.enemyBullets.splice(i, 1); continue; }
      if (game.player.invulnerable <= 0 && circleHitsShip(bullet, game.player)) {
        hitPlayer();
        game.enemyBullets.splice(i, 1);
      }
    }
  }

  function updatePowerups(dt) {
    for (let i = game.powerups.length - 1; i >= 0; i--) {
      const powerup = game.powerups[i];
      powerup.y += powerup.vy * dt;
      powerup.spin += dt * 4;
      if (powerup.y > H + 20) { game.powerups.splice(i, 1); continue; }
      if (circleHitsShip(powerup, game.player)) {
        game.player.rapidTime = 7;
        burst(powerup.x, powerup.y, '#4de4ff', 18);
        showStatus('RAPID FIRE ONLINE // 7 SEC');
        game.powerups.splice(i, 1);
      }
    }
  }

  function choosePowerup(type) {
    if (game.phase !== 'powerup') return;
    if (type === 'shield') {
      game.player.shield = true;
      showStatus('SHIELD RECHARGED // NEXT LEVEL READY');
    } else if (type === 'rapid') {
      game.player.rapidTime = 10;
      showStatus('OVERDRIVE LOADED // 10 SEC');
    } else {
      return;
    }
    game.level = Math.min(3, game.level + 1);
    game.enemyBullets = [];
    game.playerBullets = [];
    game.enemy = null;
    spawnEnemy();
    game.phase = 'playing';
    game.introTimer = 2.2;
    ui.overlay.classList.add('hidden');
    updateHud();
  }

  function hitPlayer() {
    const shieldWasActive = game.player.shield;
    burst(game.player.x, game.player.y, shieldWasActive ? '#4de4ff' : '#ff526c', 18);
    game.player.invulnerable = 1.2;
    if (shieldWasActive) {
      game.player.shield = false;
      showStatus('SHIELD BREAK // NEXT HIT COSTS A LIFE');
    } else {
      game.lives -= 1;
      game.player.shield = true;
      game.player.x = W / 2;
      showStatus(game.lives > 0 ? 'HULL HIT // SHIELDS RESET' : 'ALL SYSTEMS OFFLINE');
      if (game.lives <= 0) endGame(false);
    }
  }

  function enemyDestroyed() {
    const defeatedLevel = game.level;
    game.kills += 1;
    burst(game.enemy.x, game.enemy.y, '#ff9363', 38);
    for (let i = 0; i < 3; i++) burst(game.enemy.x + random(-28, 28), game.enemy.y + random(-14, 14), '#ffd28f', 13);
    if (game.kills >= 3) {
      endGame(true);
      return;
    }
    game.phase = 'powerup';
    game.enemyBullets = [];
    game.playerBullets = [];
    game.powerups = [];
    game.enemy = null;
    setOverlay('powerup');
    updateHud();
    showStatus(`CORE BREAK ${game.kills} // CHOOSE YOUR UPGRADE`);
    if (defeatedLevel === 2) ui.overlayCopy.textContent = 'Select one upgrade before the final Level 03 assault.';
  }

  function endGame(won) {
    game.phase = won ? 'won' : 'lost';
    game.enemyBullets = [];
    game.playerBullets = [];
    game.powerups = [];
    setOverlay(won ? 'won' : 'lost');
  }

  function updateParticles(dt) {
    for (let i = game.particles.length - 1; i >= 0; i--) {
      const particle = game.particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 18 * dt;
      particle.life -= dt;
      if (particle.life <= 0) game.particles.splice(i, 1);
    }
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = random(35, 190);
      const life = random(.25, .75);
      game.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, maxLife: life, color, size: random(1.4, 4.2) });
    }
  }

  function render() {
    drawBackground();
    drawPowerups();
    if (game.enemy) drawEnemy();
    drawPlayerBullets();
    drawEnemyBullets();
    drawParticles();
    drawPlayer();
    if (game.phase === 'playing' && game.introTimer > 0) drawLevelBanner();
  }

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, '#081526');
    gradient.addColorStop(.5, '#050c1b');
    gradient.addColorStop(1, '#070916');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    game.stars.forEach(star => {
      ctx.globalAlpha = star.alpha * (.7 + Math.sin(game.time * 2 + star.x) * .3);
      ctx.fillStyle = star.size > 1.3 ? '#a7d8e5' : '#6689a2';
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(100, 158, 183, .06)';
    ctx.lineWidth = 1;
    for (let y = 34; y < H; y += 52) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
    const glow = ctx.createRadialGradient(W / 2, H * .3, 40, W / 2, H * .3, 420);
    glow.addColorStop(0, 'rgba(39, 165, 190, .1)');
    glow.addColorStop(1, 'rgba(39, 165, 190, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  function drawPlayer() {
    const p = game.player;
    if (p.invulnerable > 0 && Math.floor(game.time * 15) % 2 === 0) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowBlur = p.rapidTime > 0 ? 25 : 14;
    ctx.shadowColor = p.shipColor;
    if (p.shield) {
      ctx.beginPath();
      ctx.arc(0, 0, 39 + Math.sin(game.time * 6) * 1.5, Math.PI, Math.PI * 2);
      ctx.strokeStyle = p.shipColor;
      ctx.globalAlpha = .72;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 35, Math.PI * 1.04, Math.PI * 1.96);
      ctx.strokeStyle = 'rgba(181, 248, 255, .15)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.fillStyle = p.shipColor;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(29, 15);
    ctx.lineTo(10, 12);
    ctx.lineTo(0, 27);
    ctx.lineTo(-10, 12);
    ctx.lineTo(-29, 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4de4ff';
    ctx.beginPath();
    ctx.moveTo(0, -14); ctx.lineTo(8, 8); ctx.lineTo(0, 5); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#183b59';
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(5, 2); ctx.lineTo(-5, 2); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffb56d';
    ctx.globalAlpha = .8 + p.thrust * .2;
    ctx.beginPath(); ctx.moveTo(-10, 16); ctx.lineTo(-4, 16 + 10 + p.thrust * 9); ctx.lineTo(0, 16); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(10, 16); ctx.lineTo(4, 16 + 10 + p.thrust * 9); ctx.lineTo(0, 16); ctx.closePath(); ctx.fill();
    ctx.restore();
    if (p.rapidTime > 0) drawBoostLabel(p.x, p.y + 45);
  }

  function drawEnemy() {
    const e = game.enemy;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.shadowBlur = 17;
    ctx.shadowColor = '#ff526c';
    ctx.fillStyle = '#ff8a70';
    ctx.beginPath();
    ctx.moveTo(0, 22);
    ctx.lineTo(37, -13);
    ctx.lineTo(17, -10);
    ctx.lineTo(6, -23);
    ctx.lineTo(0, -17);
    ctx.lineTo(-6, -23);
    ctx.lineTo(-17, -10);
    ctx.lineTo(-37, -13);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6c2036';
    ctx.beginPath(); ctx.moveTo(-18, -10); ctx.lineTo(0, 14); ctx.lineTo(18, -10); ctx.lineTo(8, -6); ctx.lineTo(0, 5); ctx.lineTo(-8, -6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffcf99';
    ctx.beginPath(); ctx.arc(0, -4, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawPlayerBullets() {
    game.playerBullets.forEach(bullet => {
      ctx.save();
      ctx.shadowBlur = 15; ctx.shadowColor = '#b5f8ff'; ctx.fillStyle = '#d9fbff';
      ctx.fillRect(bullet.x - 2, bullet.y - 9, 4, 14);
      ctx.restore();
    });
  }

  function drawEnemyBullets() {
    game.enemyBullets.forEach(bullet => {
      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(Math.atan2(bullet.vy, bullet.vx) + Math.PI / 2);
      ctx.shadowBlur = 12; ctx.shadowColor = '#ff526c'; ctx.fillStyle = '#ff9363';
      ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(4, -5); ctx.lineTo(0, -8); ctx.lineTo(-4, -5); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
  }

  function drawPowerups() {
    game.powerups.forEach(powerup => {
      ctx.save();
      ctx.translate(powerup.x, powerup.y);
      ctx.rotate(powerup.spin);
      ctx.shadowBlur = 18; ctx.shadowColor = '#4de4ff';
      ctx.strokeStyle = '#4de4ff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(13, 0); ctx.lineTo(0, 13); ctx.lineTo(-13, 0); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(77, 228, 255, .35)'; ctx.fill();
      ctx.fillStyle = '#d8fbff'; ctx.fillRect(-2, -8, 4, 16); ctx.fillRect(-8, -2, 16, 4);
      ctx.restore();
    });
  }

  function drawParticles() {
    game.particles.forEach(particle => {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    });
    ctx.globalAlpha = 1;
  }

  function drawBoostLabel(x, y) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.font = '700 10px "Space Mono", monospace'; ctx.fillStyle = '#4de4ff'; ctx.shadowBlur = 8; ctx.shadowColor = '#4de4ff';
    ctx.fillText(`RAPID ${Math.ceil(game.player.rapidTime)}s`, x, y);
    ctx.restore();
  }

  function drawLevelBanner() {
    const alpha = Math.min(1, game.introTimer < .5 ? game.introTimer * 2 : 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = '700 12px "Space Mono", monospace';
    ctx.fillStyle = '#4de4ff';
    ctx.fillText(`LEVEL ${String(game.level).padStart(2, '0')} // FIRE RATE INCREASED`, W / 2, H / 2 - 8);
    ctx.font = '700 32px "Barlow Condensed", sans-serif';
    ctx.fillStyle = '#eff7ff';
    ctx.fillText('TARGET LOCKED', W / 2, H / 2 + 28);
    ctx.restore();
  }

  function circleHitsShip(circle, ship) {
    const halfW = ship.width / 2;
    const halfH = ship.height / 2;
    const closestX = clamp(circle.x, ship.x - halfW, ship.x + halfW);
    const closestY = clamp(circle.y, ship.y - halfH, ship.y + halfH);
    return Math.hypot(circle.x - closestX, circle.y - closestY) < circle.radius + 2;
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function random(min, max) { return Math.random() * (max - min) + min; }

  function handleKey(event, isDown) {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') { keys.left = isDown; event.preventDefault(); }
    if (event.code === 'ArrowRight' || event.code === 'KeyD') { keys.right = isDown; event.preventDefault(); }
    if (event.code === 'Space') {
      keys.space = isDown;
      event.preventDefault();
      if (isDown && game.phase === 'ready') startGame();
      else if (isDown && (game.phase === 'won' || game.phase === 'lost')) restartGame();
    }
    if (isDown && (event.code === 'KeyR' || event.key?.toLowerCase() === 'r')) { restartGame(); event.preventDefault(); }
    if (isDown && event.code === 'Enter') {
      if (game.phase === 'ready') startGame();
      else if (game.phase === 'won' || game.phase === 'lost') restartGame();
    }
  }

  function setShipColor(color) {
    selectedShipColor = color.toLowerCase();
    if (game && game.player) game.player.shipColor = selectedShipColor;
    ui.shipColorInput.value = selectedShipColor;
    ui.shipColorValue.textContent = selectedShipColor.toUpperCase();
    ui.colorSwatches.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.classList.toggle('is-selected', swatch.dataset.color === selectedShipColor);
    });
  }

  window.addEventListener('keydown', event => handleKey(event, true));
  window.addEventListener('keyup', event => handleKey(event, false));
  window.addEventListener('blur', () => {
    keys.left = false;
    keys.right = false;
    keys.space = false;
  });
  ui.overlayButton.addEventListener('click', () => {
    if (game.phase === 'won' || game.phase === 'lost') restartGame();
    else startGame();
  });
  ui.colorSwatches.addEventListener('click', event => {
    const swatch = event.target.closest('[data-color]');
    if (swatch) setShipColor(swatch.dataset.color);
  });
  ui.shipColorInput.addEventListener('input', event => setShipColor(event.target.value));
  ui.powerupOptions.addEventListener('click', event => {
    const option = event.target.closest('[data-powerup]');
    if (option) choosePowerup(option.dataset.powerup);
  });

  function loop(timestamp) {
    const dt = Math.min(.033, (timestamp - lastTime) / 1000 || 0);
    lastTime = timestamp;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  resetGame();
  requestAnimationFrame(loop);
})();
