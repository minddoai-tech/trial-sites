const GS = {
  money: 500,
  wave: 1,
  roster: [],
  intermission: false,
  intermissionLeft: 0
};

const INTERMISSION_TIME = 10;

function initialRoster() {
  const r = [];
  for (let i = 0; i < 6; i++) r.push({ type: 'knight', col: 2, row: 3 + i });
  for (let i = 0; i < 3; i++) r.push({ type: 'archer', col: 1, row: 4 + i });
  return r;
}

function resetGame() {
  GS.money = 500;
  GS.wave = 1;
  GS.roster = initialRoster();
  GS.intermission = false;
  GS.intermissionLeft = 0;
}

function startIntermission() {
  GS.intermission = true;
  GS.intermissionLeft = INTERMISSION_TIME;
  updateIntermissionUI();
}

function fightNextWave() {
  GS.intermission = false;
  GS.intermissionLeft = 0;
  GS.wave += 1;
  updateIntermissionUI();
  Screen.show('battle');
}

function updateIntermissionUI() {
  const banner = document.getElementById('intermission-banner');
  const count = document.getElementById('im-countdown');
  const waveEl = document.getElementById('im-wave');
  const bar = document.getElementById('im-bar');
  const startBtn = document.getElementById('start-battle');
  if (GS.intermission) {
    banner.classList.remove('hidden');
    const secs = Math.max(0, Math.ceil(GS.intermissionLeft));
    count.textContent = secs;
    waveEl.textContent = GS.wave;
    bar.style.width = clamp((GS.intermissionLeft / INTERMISSION_TIME) * 100, 0, 100) + '%';
    if (startBtn) startBtn.textContent = 'Fight Next Wave (' + secs + 's)';
  } else {
    banner.classList.add('hidden');
  }
}

function updateMoneyHud() {
  const m = GS.money;
  document.getElementById('home-money').textContent = m;
  document.getElementById('battle-money').textContent = m;
}

function popEl(el) {
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

const Screen = {
  current: 'home',
  show(name) {
    this.current = name;
    document.getElementById('home').classList.toggle('hidden', name !== 'home');
    document.getElementById('battle').classList.toggle('hidden', name !== 'battle');
    if (name === 'home') FormationScreen.refresh();
    if (name === 'battle') BattleScreen.start(GS.wave);
  }
};

function boot() {
  resetGame();
  FormationScreen.init();
  BattleScreen.init();
  updateMoneyHud();
  document.getElementById('im-fight').addEventListener('click', fightNextWave);
  Screen.show('home');

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (Screen.current === 'home') {
      if (GS.intermission) {
        GS.intermissionLeft -= dt;
        updateIntermissionUI();
        if (GS.intermissionLeft <= 0) fightNextWave();
      }
      if (Screen.current === 'home') {
        FormationScreen.update(dt);
        FormationScreen.render();
      }
    }
    if (Screen.current === 'battle') {
      BattleScreen.update(dt);
      BattleScreen.render();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

document.addEventListener('DOMContentLoaded', boot);
