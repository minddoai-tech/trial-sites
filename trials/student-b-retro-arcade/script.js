const taskForm = document.querySelector('#taskForm');
const taskInput = document.querySelector('#taskInput');
const categoryInput = document.querySelector('#categoryInput');
const energyInput = document.querySelector('#energyInput');
const prizePit = document.querySelector('#prizePit');
const taskList = document.querySelector('#taskList');
const rewardShelf = document.querySelector('#rewardShelf');
const playButton = document.querySelector('#playButton');
const shuffleButton = document.querySelector('#shuffleButton');
const completeButton = document.querySelector('#completeButton');
const focusCard = document.querySelector('#focusCard');
const ticketCount = document.querySelector('#ticketCount');
const claw = document.querySelector('#claw');
const toast = document.querySelector('#toast');

const categories = {
  home: { label: 'Home Hamster', icon: '🐹', colors: ['#ffd6e8', '#fff1a8'] },
  work: { label: 'Work Bunny', icon: '🐰', colors: ['#dcd1ff', '#c8edff'] },
  study: { label: 'Study Star', icon: '⭐', colors: ['#fff1a8', '#ffd6e8'] },
  health: { label: 'Health Kitty', icon: '🐱', colors: ['#c9f4df', '#c8edff'] },
  admin: { label: 'Admin Cloud', icon: '☁️', colors: ['#ffffff', '#dcd1ff'] }
};

const rewards = ['🍓', '🧸', '🎀', '🍬', '🌈', '🦄', '💖', '🍮', '🎟️', '✨', '🍡', '🌟'];

let tasks = load('clawquest-tasks', [
  createTask('Clear one tiny email', 'work', 'tiny'),
  createTask('Put five things away', 'home', 'tiny'),
  createTask('Drink water and stretch', 'health', 'tiny'),
  createTask('Study for 20 minutes', 'study', 'medium')
]);
let completedRewards = load('clawquest-rewards', []);
let tickets = Number(localStorage.getItem('clawquest-tickets') || 0);
let currentTask = null;
let isPlaying = false;

renderAll();

function createTask(title, category, energy) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    title: title.trim(),
    category,
    energy,
    x: 10 + Math.random() * 76,
    y: 8 + Math.random() * 64,
    tilt: -7 + Math.random() * 14
  };
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function save() {
  localStorage.setItem('clawquest-tasks', JSON.stringify(tasks));
  localStorage.setItem('clawquest-rewards', JSON.stringify(completedRewards));
  localStorage.setItem('clawquest-tickets', String(tickets));
}

function renderAll() {
  renderPit();
  renderTaskList();
  renderRewards();
  ticketCount.textContent = tickets;
  completeButton.disabled = !currentTask;
}

function renderPit() {
  prizePit.innerHTML = '';

  if (!tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'The prize pit is empty. Add a few cute quests!';
    prizePit.append(empty);
    return;
  }

  tasks.forEach(task => {
    const prize = document.createElement('button');
    const category = categories[task.category];
    prize.className = 'prize';
    prize.type = 'button';
    prize.style.left = `${task.x}%`;
    prize.style.top = `${task.y}%`;
    prize.style.setProperty('--tilt', `${task.tilt}deg`);
    prize.style.setProperty('--prize-a', category.colors[0]);
    prize.style.setProperty('--prize-b', category.colors[1]);
    prize.dataset.id = task.id;
    prize.title = task.title;
    prize.innerHTML = `<span class="icon">${category.icon}</span><span class="task-name">${escapeHtml(task.title)}</span>`;
    prize.addEventListener('click', () => selectTask(task));
    prizePit.append(prize);
  });
}

function renderTaskList() {
  taskList.innerHTML = '';

  tasks.forEach(task => {
    const item = document.createElement('li');
    const category = categories[task.category];
    item.innerHTML = `
      <span>${category.icon} ${escapeHtml(task.title)}<small>${category.label} • ${task.energy}</small></span>
      <button class="delete-button" type="button" aria-label="Delete ${escapeHtml(task.title)}">×</button>
    `;
    item.querySelector('button').addEventListener('click', () => deleteTask(task.id));
    taskList.append(item);
  });
}

function renderRewards() {
  rewardShelf.innerHTML = '';
  const visibleRewards = completedRewards.slice(-12);

  if (!visibleRewards.length) {
    const empty = document.createElement('p');
    empty.textContent = 'Finish a quest to win your first shelf prize.';
    empty.className = 'empty-copy';
    rewardShelf.append(empty);
    return;
  }

  visibleRewards.forEach(reward => {
    const token = document.createElement('div');
    token.className = 'reward';
    token.textContent = reward;
    rewardShelf.append(token);
  });
}

function selectTask(task) {
  currentTask = task;
  completeButton.disabled = false;

  focusCard.innerHTML = `
    <span class="mini-label">Current quest</span>
    <h3>${categories[task.category].icon} ${escapeHtml(task.title)}</h3>
    <p>${categories[task.category].label} picked a ${task.energy} quest. One clear action, then claim your prize.</p>
  `;

  document.querySelectorAll('.prize').forEach(prize => {
    prize.classList.toggle('selected', prize.dataset.id === task.id);
  });
}

function deleteTask(id) {
  tasks = tasks.filter(task => task.id !== id);
  if (currentTask?.id === id) currentTask = null;
  save();
  renderAll();
  showToast('Capsule recycled ✨');
}

taskForm.addEventListener('submit', event => {
  event.preventDefault();
  const task = createTask(taskInput.value, categoryInput.value, energyInput.value);
  tasks.push(task);
  taskInput.value = '';
  save();
  renderAll();
  showToast('Task dropped into the prize pit!');
});

playButton.addEventListener('click', async () => {
  if (isPlaying) return;
  if (!tasks.length) {
    showToast('Add a task first, then play!');
    return;
  }

  isPlaying = true;
  playButton.disabled = true;
  completeButton.disabled = true;

  const chosen = weightedPick(tasks);
  const targetX = Math.min(86, Math.max(12, chosen.x + 7));
  const targetY = 128 + chosen.y * 2.2;

  claw.classList.remove('grabbing');
  claw.style.left = `${targetX}%`;
  await wait(850);
  claw.style.top = `${Math.min(targetY, 285)}px`;
  await wait(760);
  claw.classList.add('grabbing');
  await wait(420);
  selectTask(chosen);
  claw.style.top = '14px';
  await wait(720);
  claw.classList.remove('grabbing');

  showToast(`The claw chose: ${chosen.title}`);
  isPlaying = false;
  playButton.disabled = false;
  completeButton.disabled = false;
});

shuffleButton.addEventListener('click', () => {
  tasks = tasks.map(task => ({
    ...task,
    x: 10 + Math.random() * 76,
    y: 8 + Math.random() * 64,
    tilt: -7 + Math.random() * 14
  }));
  save();
  renderPit();
  showToast('Prize pit shuffled!');
});

completeButton.addEventListener('click', () => {
  if (!currentTask) return;

  const reward = rewards[Math.floor(Math.random() * rewards.length)];
  const energyBonus = currentTask.energy === 'boss' ? 5 : currentTask.energy === 'medium' ? 3 : 1;
  tickets += energyBonus;
  completedRewards.push(reward);
  tasks = tasks.filter(task => task.id !== currentTask.id);

  showToast(`Quest complete! +${energyBonus} tickets ${reward}`);
  currentTask = null;
  focusCard.innerHTML = `
    <span class="mini-label">Current quest</span>
    <h3>No task selected yet</h3>
    <p>Press Play and the claw will pick one capsule for you.</p>
  `;

  save();
  renderAll();
});

function weightedPick(items) {
  const weights = { tiny: 4, medium: 3, boss: 2 };
  const pool = items.flatMap(item => Array(weights[item.energy] || 1).fill(item));
  return pool[Math.floor(Math.random() * pool.length)];
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove('show'), 2600);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#039;',
    '"': '&quot;'
  }[char]));
}
