'use strict';

/* =====================================================
 * 保卫王国 - 僵尸防守
 * 自行部署士兵防守基地，僵尸从右侧来袭，共 30 波。
 * 第 10 / 20 / 30 波出现大僵尸 Boss。
 * 击杀僵尸得金币 → 买兵。前排阵亡后基地后备增援。
 * 基地打光输（GAME OVER），扛过 30 波赢。
 * ===================================================== */

const FIELD = document.getElementById('field');
const WORLD = document.getElementById('world');
const BASE_ROW = document.getElementById('base-row');

const goldEl = document.getElementById('gold');
const reserveEl = document.getElementById('reserve');
const waveEl = document.getElementById('wave');
const remainingEl = document.getElementById('remaining');
const killsEl = document.getElementById('kills');
const buyBtn = document.getElementById('buy-btn');
const toDeployEl = document.getElementById('toDeploy');
const startBattleBtn = document.getElementById('start-battle-btn');
const hintEl = document.getElementById('toolbar-hint');

const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const gameoverScreen = document.getElementById('gameover-screen');
const pausedScreen = document.getElementById('paused-screen');

const startBtn = document.getElementById('start-btn');
const playAgainBtn = document.getElementById('play-again-btn');
const gameoverAgainBtn = document.getElementById('gameover-again-btn');
const pauseBtn = document.getElementById('pause-btn');
const speedBtn = document.getElementById('speed-btn');
const resumeBtn = document.getElementById('resume-btn');

/* ---------- 配置 ---------- */
const SOLDIER_COST = 50;
const START_GOLD = 300;
const DEPLOY_COUNT = 5;          // 开局需要自行部署的免费士兵数
const RESERVE_SOLDIERS = 8;       // 基地后备（增援）
const TOTAL_WAVES = 30;           // 总波数
const BOSS_WAVE = 10;             // 每 10 波一个大僵尸

const SOLDIER_HP = 60, SOLDIER_DMG = 8, SOLDIER_RATE = 850, SOLDIER_RANGE = 55;
const ZOMBIE_DMG = 16, ZOMBIE_RATE = 1200, ZOMBIE_TOUCH = 14;
const BULLET_SPEED = 340;

/* 波次配置生成（n 从 1 开始） */
function getWave(n) {
    const boss = (n % BOSS_WAVE === 0);
    const count = 4 + Math.floor(n * 1.2);        // 普通僵尸数量
    const hp = 25 + n * 9;                        // 普通僵尸血量
    const speed = 42 + Math.min(14, n);           // 移动速度
    const reward = 12 + Math.floor(n / 2);        // 每个击杀金币
    return { n, boss, count, hp, speed, reward, bossHp: 400 + n * 80, bossReward: 300 };
}

function totalZombies() {
    let t = 0;
    for (let n = 1; n <= TOTAL_WAVES; n++) t += getWave(n).count + (getWave(n).boss ? 1 : 0);
    return t;
}

/* ---------- 运行时 ---------- */
let state = null;
let playing = false, paused = false, rafId = null;
let units = [], zombies = [], bullets = [], spawnQueue = [];
let placing = false;             // 是否处于"购买放置"模式
let gameSpeed = 1;

const FIELD_W = () => FIELD.clientWidth;
const FIELD_H = () => FIELD.clientHeight;
const BASE_RIGHT = 150;
const CENTER_Y = () => FIELD_H() / 2;

/* =====================================================
 * 主循环
 * ===================================================== */
function loop(now) {
    if (!playing || paused) { return; }
    rafId = requestAnimationFrame(loop);
    update(now);
    render();
    checkEnd();
}

function update(now) {
    // 士兵攻击
    for (const u of units) {
        if (u.dead) continue;
        u.target = nearestZombie(u, SOLDIER_RANGE);
        if (u.target && (now - u.lastAtk) >= SOLDIER_RATE / gameSpeed) {
            u.lastAtk = now;
            bullets.push(makeBullet(u, u.target));
        }
    }

    // 子弹飞到目标后才造成伤害。
    for (const b of bullets) {
        if (b.dead) continue;
        if (!b.target || b.target.dead) {
            b.dead = true;
            continue;
        }
        const dx = b.target.x - b.x, dy = b.target.y - b.y;
        const dist = Math.hypot(dx, dy);
        const step = BULLET_SPEED * 0.016 * gameSpeed;
        if (dist <= step + 10) {
            b.target.hp -= b.damage;
            if (b.target.hp <= 0) b.target.dead = true;
            b.dead = true;
        } else {
            b.x += dx / dist * step;
            b.y += dy / dist * step;
        }
    }
    for (const b of bullets) if (b.dead) b.elm.remove();
    bullets = bullets.filter(b => !b.dead);

    // 僵尸移动 + 攻击
    for (const z of zombies) {
        if (z.dead) continue;
        const s = nearestSoldier(z);
        if (s) {
            const d = Math.hypot(s.x - z.x, s.y - z.y);
            if (d <= ZOMBIE_TOUCH + (z.boss ? 8 : 0)) {
                if ((now - z.lastAtk) >= ZOMBIE_RATE / gameSpeed) {
                    z.lastAtk = now;
                    s.hp -= ZOMBIE_DMG;
                    if (s.hp <= 0) s.dead = true;
                }
            } else {
                stepTo(z, s, now);
            }
        } else {
            // 冲向基地
            if (z.x > BASE_RIGHT) stepTo(z, { x: BASE_RIGHT, y: z.y }, now);
            else if ((now - z.lastAtk) >= ZOMBIE_RATE / gameSpeed) {
                // 攻击基地后备
                z.lastAtk = now;
                if (state.reserve > 0) {
                    state.reserve--;
                    renderReserve();
                    z.x -= 6;
                }
            }
        }
    }

    // 清理死亡
    for (const z of zombies) {
        if (z.dead && !z.counted) {
            z.counted = true;
            z.elm.remove();
            rewardKill(z);
            if (z.waveNum === state.waveNum) {
                if (z.boss) state.bossAlive = Math.max(0, state.bossAlive - 1);
                else if (z.isWave) state.waveAlive = Math.max(0, state.waveAlive - 1);
            }
        }
    }
    // 先移除死亡实体的画面元素，再从运行数组中清掉，避免尸体留在场上。
    cleanupDOM();
    zombies = zombies.filter(z => !(z.dead && z.counted));
    units = units.filter(u => !u.dead);

    // 波次推进：当前波全灭 → 开启下一波
    maybeNextWave();

    // 增援：场上前线士兵为空且后备>0，从基地补一个
    if (state.phase === 'battle' && state.reserve > 0 && units.length === 0) {
        state.reserve--;
        renderReserve();
        units.push(makeSoldier(BASE_RIGHT + 30, CENTER_Y(), SOLDIER_HP, false));
    }
}

function stepTo(z, t, now) {
    if (now - (z.lastMove || 0) < 20) return;
    z.lastMove = now;
    const dx = t.x - z.x, dy = t.y - z.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    const step = Math.min((z.boss ? z.speed * 0.5 : z.speed) * 0.016 * gameSpeed, dist);
    z.x += dx / dist * step;
    z.y += dy / dist * step;
}

function nearestZombie(u, maxD) {
    let best = null, bd = maxD;
    for (const z of zombies) {
        if (z.dead) continue;
        const d = Math.hypot(z.x - u.x, z.y - u.y);
        if (d <= bd) { bd = d; best = z; }
    }
    return best;
}

function nearestSoldier(z) {
    // 优先攻击最靠前（x 最小）的士兵；同为最前时选最近的
    let best = null, bestX = Infinity, bestD = Infinity;
    for (const u of units) {
        if (u.dead) continue;
        if (u.x < bestX || (u.x === bestX && Math.hypot(u.x - z.x, u.y - z.y) < bestD)) {
            bestX = u.x;
            bestD = Math.hypot(u.x - z.x, u.y - z.y);
            best = u;
        }
    }
    return best;
}

function rewardKill(z) {
    if (z.isWave) state.gold += z.reward;
    state.kills++;
    updateHUD();
}

/* 清理移除的 DOM */
function cleanupDOM() {
    for (const u of units) if (u.dead) u.elm.remove();
    for (const z of zombies) if (z.dead && z.counted) z.elm.remove();
}

function render() {
    for (const u of units) {
        if (u.dead) continue;
        u.elm.style.left = u.x + 'px';
        u.elm.style.top = u.y + 'px';
        u.fill.style.width = (u.hp / u.maxHp) * 100 + '%';
    }
    for (const z of zombies) {
        if (z.dead) continue;
        z.elm.style.left = z.x + 'px';
        z.elm.style.top = z.y + 'px';
        z.fill.style.width = (z.hp / z.maxHp) * 100 + '%';
    }
    for (const b of bullets) {
        b.elm.style.left = b.x + 'px';
        b.elm.style.top = b.y + 'px';
    }
}

/* =====================================================
 * 实体创建
 * ===================================================== */
function makeSoldierEl() {
    const elm = document.createElement('div');
    elm.className = 'unit';
    elm.innerHTML =
        '<span class="helmet"></span>' +
        '<span class="head"></span>' +
        '<span class="arm"></span>' +
        '<span class="gun"></span>' +
        '<span class="body"></span>' +
        '<span class="legs"></span>' +
        '<span class="legs"></span>';
    const hpBar = document.createElement('div');
    hpBar.className = 'hp-bar';
    const fill = document.createElement('div');
    fill.className = 'hp-fill';
    hpBar.appendChild(fill);
    elm.appendChild(hpBar);
    return { elm, fill };
}

function makeSoldier(x, y, hp, flag) {
    const b = makeSoldierEl();
    b.elm.style.left = x + 'px';
    b.elm.style.top = y + 'px';
    b.elm.style.zIndex = 2;
    WORLD.appendChild(b.elm);
    return {
        ...b,
        x, y,
        hp: hp, maxHp: hp,
        dmg: SOLDIER_DMG,
        lastAtk: 0,
        target: null,
        dead: false,
        isPlaced: flag,
    };
}

function makeBullet(soldier, target) {
    const elm = document.createElement('span');
    elm.className = 'bullet';
    const bullet = {
        elm,
        x: soldier.x + 28,
        y: soldier.y + 16,
        target,
        damage: soldier.dmg,
        dead: false,
    };
    elm.style.left = bullet.x + 'px';
    elm.style.top = bullet.y + 'px';
    WORLD.appendChild(elm);
    return bullet;
}

function makeZombie(x, y, hp, speed, reward, waveNum, boss) {
    const elm = document.createElement('div');
    elm.className = 'zombie' + (boss ? ' boss' : '');
    elm.textContent = boss ? '👹' : '🧟';
    elm.style.left = x + 'px';
    elm.style.top = y + 'px';
    elm.style.zIndex = 2;

    const hpBar = document.createElement('div');
    hpBar.className = 'hp-bar';
    const fill = document.createElement('div');
    fill.className = 'hp-fill';
    hpBar.appendChild(fill);
    elm.appendChild(hpBar);
    WORLD.appendChild(elm);

    return {
        elm, fill,
        x, y,
        hp, maxHp: hp,
        speed,
        reward,
        isWave: true,
        boss: !!boss,
        waveNum,
        lastAtk: 0, lastMove: 0,
        target: null,
        dead: false, counted: false,
    };
}

/* =====================================================
 * HUD
 * ===================================================== */
function updateHUD() {
    if (!state) return;
    goldEl.textContent = state.gold;
    reserveEl.textContent = state.reserve;
    waveEl.textContent = Math.max(0, state.waveNum);
    remainingEl.textContent = liveRemaining();
    killsEl.textContent = state.kills;
    toDeployEl.textContent = state.toDeploy;
    buyBtn.disabled = state.phase !== 'battle' || state.gold < SOLDIER_COST;
    startBattleBtn.disabled = state.phase !== 'deploy' || state.toDeploy > 0;
    hintEl.textContent = hintText();
}

function hintText() {
    if (!state) return '';
    if (state.phase === 'deploy') {
        return state.toDeploy > 0
            ? `请在场上放置士兵（还需 ${state.toDeploy} 名），然后点击「开始战斗」`
            : '已完成部署！点击「开始战斗」迎接僵尸！';
    }
    return '点击「购买士兵」，再点击场地放置新的防守士兵';
}

function liveRemaining() {
    if (!state) return 0;
    return zombies.filter(z => !z.dead).length + state.unspawned;
}

function renderReserve() {
    BASE_ROW.innerHTML = '';
    for (let i = 0; i < state.reserve; i++) {
        const r = makeSoldierEl();
        r.elm.classList.add('reserve-unit');
        r.elm.style.position = 'relative';
        BASE_ROW.appendChild(r.elm);
    }
}

/* =====================================================
 * 放置士兵（部署 & 购买）
 * ===================================================== */
const ghost = document.createElement('div');
ghost.className = 'ghost';
FIELD.appendChild(ghost);

buyBtn.addEventListener('click', () => {
    if (!playing || paused || !state || state.phase !== 'battle' || state.gold < SOLDIER_COST) return;
    placing = true;
    ghost.style.display = 'block';
});

FIELD.addEventListener('mousemove', (e) => {
    if (!placing) return;
    const rect = FIELD.getBoundingClientRect();
    ghost.style.left = (e.clientX - rect.left - 12) + 'px';
    ghost.style.top = (e.clientY - rect.top - 17) + 'px';
});

FIELD.addEventListener('click', (e) => {
    if (!playing || paused || !state) return;
    const rect = FIELD.getBoundingClientRect();
    const x = e.clientX - rect.left - 12;
    const y = e.clientY - rect.top - 17;
    if (x < BASE_RIGHT) { showMsg('不能在基地内放置！'); return; }

    if (state.phase === 'deploy') {
        // 部署免费士兵
        if (state.toDeploy <= 0) { showMsg('部署已完成，点击「开始战斗」'); return; }
        state.toDeploy--;
        units.push(makeSoldier(
            Math.max(BASE_RIGHT, Math.min(FIELD_W() - 24, x)),
            Math.max(0, Math.min(FIELD_H() - 34, y)),
            SOLDIER_HP, true
        ));
    } else if (state.phase === 'battle' && placing) {
        // 购买士兵
        if (state.gold < SOLDIER_COST) return;
        state.gold -= SOLDIER_COST;
        units.push(makeSoldier(
            Math.max(BASE_RIGHT, Math.min(FIELD_W() - 24, x)),
            Math.max(0, Math.min(FIELD_H() - 34, y)),
            SOLDIER_HP, true
        ));
        placing = false;
        ghost.style.display = 'none';
    } else {
        showMsg('点击「购买士兵」后再放置');
        return;
    }

    updateHUD();
});

/* =====================================================
 * 消息
 * ===================================================== */
let msgTimer = null;
function showMsg(text) {
    const elm = document.createElement('div');
    elm.className = 'message';
    elm.textContent = text;
    FIELD.appendChild(elm);
    if (msgTimer) clearTimeout(msgTimer);
    msgTimer = setTimeout(() => elm.remove(), 1800);
}

/* =====================================================
 * 游戏流程
 * ===================================================== */
function startGame() {
    startScreen.classList.add('hidden');
    resultScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    pausedScreen.classList.add('hidden');

    // 清理 DOM
    WORLD.querySelectorAll('.unit, .zombie, .bullet').forEach(el => el.remove());
    units.length = 0;
    zombies.length = 0;
    bullets.length = 0;
    spawnQueue.forEach(clearTimeout);
    spawnQueue.length = 0;

    state = {
        gold: START_GOLD,
        reserve: RESERVE_SOLDIERS,
        kills: 0,
        phase: 'deploy',
        waveNum: 0,
        waveAlive: 0,
        bossAlive: 0,
        unspawned: totalZombies(),
        toDeploy: DEPLOY_COUNT,
    };

    // 部署阶段基地和战场都从空场开始；玩家亲手放完 5 名士兵后才开战。
    BASE_ROW.innerHTML = '';
    placing = false;
    ghost.style.display = 'none';
    playing = true;
    paused = false;
    gameSpeed = 1;
    speedBtn.textContent = '⏩ 1×';
    speedBtn.classList.remove('active');
    if (rafId) cancelAnimationFrame(rafId);
    updateHUD();
    showMsg(`先部署 ${DEPLOY_COUNT} 名士兵`);
    rafId = requestAnimationFrame(loop);
}

/* 波次生成 */
function launchWave(n) {
    if (!playing || n > TOTAL_WAVES) return;
    const w = getWave(n);
    state.phase = 'battle';
    state.waveNum = n;
    state.waveAlive += w.count;
    if (w.boss) state.bossAlive = 1;
    updateHUD();

    const startX = FIELD_W() - 30;
    // 小僵尸
    for (let i = 0; i < w.count; i++) {
        spawnQueue.push(setTimeout(() => {
            if (!playing || state.waveNum !== n) return;
            const x = startX + 40 + i * 10;
            const y = Math.random() * (FIELD_H() - 60) + 15;
            zombies.push(makeZombie(x, y, w.hp, w.speed, w.reward, n, false));
            state.unspawned = Math.max(0, state.unspawned - 1);
            updateHUD();
        }, i * 300 / gameSpeed));
    }
    // Boss（在最后一波小僵尸后单独入场）
    if (w.boss) {
        const bossT = (w.count * 300 + 600) / gameSpeed;
        spawnQueue.push(setTimeout(() => {
            if (!playing || state.waveNum !== n) return;
            zombies.push(makeZombie(FIELD_W() - 30, CENTER_Y(), w.bossHp, w.speed * 0.7, w.bossReward, n, true));
            state.unspawned = Math.max(0, state.unspawned - 1);
            showMsg('💥 大僵尸 BOSS 出现！');
            updateHUD();
        }, bossT));
    }
}

/* 当前波全灭后开启下一波 */
function maybeNextWave() {
    if (!playing || !state) return;
    if (state.phase !== 'battle') return;
    if (state.waveAlive > 0 || state.bossAlive > 0) return;
    const next = state.waveNum + 1;
    if (next <= TOTAL_WAVES) {
        showMsg(next % BOSS_WAVE === 0 ? `⚠️ 第 ${next} 波：BOSS 来袭！` : `第 ${next} 波僵尸来袭！`);
        launchWave(next);
    }
}

/* =====================================================
 * 胜负
 * ===================================================== */
function checkEnd() {
    if (!state || !playing) return;
    // 胜利：第 30 波及其 Boss 全灭
    if (state.waveNum >= TOTAL_WAVES && state.waveAlive <= 0 && state.bossAlive <= 0 && state.unspawned === 0) {
        winGame();
        return;
    }
    // 失败：后备为0且场上无士兵，且仍有僵尸存活
    if (state.phase === 'battle' && state.reserve <= 0 && units.length === 0 && zombies.some(z => !z.dead)) {
        loseGame();
    }
}

function winGame() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    updateHUD();
    document.getElementById('result-message').textContent =
        `你成功守住了 30 波！击杀 ${state.kills}，剩余金币 ${state.gold}`;
    resultScreen.classList.remove('hidden');
}

function loseGame() {
    playing = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    updateHUD();
    document.getElementById('gameover-message').textContent =
        `你在第 ${Math.max(1, state.waveNum)} 波被攻破... 本局击杀 ${state.kills}`;
    gameoverScreen.classList.remove('hidden');
}

/* =====================================================
 * 控件
 * ===================================================== */
startBtn.addEventListener('click', startGame);
playAgainBtn.addEventListener('click', startGame);
gameoverAgainBtn.addEventListener('click', startGame);

startBattleBtn.addEventListener('click', () => {
    if (!state || state.phase !== 'deploy' || state.toDeploy > 0) return;
    renderReserve();
    showMsg('第 1 波僵尸来袭！');
    launchWave(1);
});

pauseBtn.addEventListener('click', () => {
    if (!playing) return;
    paused = true;
    pausedScreen.classList.remove('hidden');
});

speedBtn.addEventListener('click', () => {
    gameSpeed = gameSpeed === 1 ? 2 : gameSpeed === 2 ? 3 : 1;
    speedBtn.textContent = `⏩ ${gameSpeed}×`;
    speedBtn.classList.toggle('active', gameSpeed > 1);
    showMsg(`游戏速度：${gameSpeed}×`);
});
resumeBtn.addEventListener('click', () => {
    paused = false;
    pausedScreen.classList.add('hidden');
    rafId = requestAnimationFrame(loop);
});

window.addEventListener('DOMContentLoaded', () => {
    startScreen.classList.remove('hidden');
    updateHUD();
});
