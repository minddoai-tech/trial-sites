const FormationScreen = {
  canvas: null,
  ctx: null,
  COLS: 20,
  ROWS: 15,
  CELL: 34,
  W: 0,
  H: 0,
  hover: { c: -1, r: -1 },
  dragging: null,

  init() {
    this.canvas = document.getElementById('formation-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.W = this.COLS * this.CELL;
    this.H = this.ROWS * this.CELL;
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.bindInput();
    this.bindShop();
    this.refresh();
  },

  update() {},

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, this.W, this.H);

    ctx.strokeStyle = 'rgba(110,130,170,0.25)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= this.COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * this.CELL, 0);
      ctx.lineTo(c * this.CELL, this.H);
      ctx.stroke();
    }
    for (let r = 0; r <= this.ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * this.CELL);
      ctx.lineTo(this.W, r * this.CELL);
      ctx.stroke();
    }

    if (this.hover.c >= 0 && this.hover.r >= 0) {
      ctx.fillStyle = 'rgba(95,135,255,0.18)';
      ctx.fillRect(this.hover.c * this.CELL, this.hover.r * this.CELL, this.CELL, this.CELL);
    }

    for (const entry of GS.roster) {
      drawMiniIcon(ctx, entry, this.CELL);
    }

    ctx.strokeStyle = '#9fb0d0';
    ctx.lineWidth = 2;
    rr(ctx, 0.5, 0.5, this.W - 1, this.H - 1, 8);
    ctx.stroke();
  },

  cellOf(pos) {
    return {
      c: Math.floor(pos.x / this.CELL),
      r: Math.floor(pos.y / this.CELL)
    };
  },

  posOf(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top
    };
  },

  cellsOf(entry, c, r) {
    const cells = [];
    if (entry.type === 'catapult') {
      for (let dc = 0; dc < 2; dc++)
        for (let dr = 0; dr < 2; dr++)
          cells.push([c + dc, r + dr]);
    } else {
      cells.push([c, r]);
    }
    return cells;
  },

  occupy(exclude) {
    const occ = {};
    for (const entry of GS.roster) {
      if (entry === exclude) continue;
      for (const [c, r] of this.cellsOf(entry, entry.col, entry.row)) {
        occ[c + ',' + r] = true;
      }
    }
    return occ;
  },

  canPlace(entry, c, r, exclude) {
    if (c < 0 || r < 0) return false;
    if (entry.type === 'catapult' && (c > this.COLS - 2 || r > this.ROWS - 2)) return false;
    if (entry.type !== 'catapult' && (c >= this.COLS || r >= this.ROWS)) return false;
    const occ = this.occupy(exclude);
    for (const [cc, rr2] of this.cellsOf(entry, c, r)) {
      if (occ[cc + ',' + rr2]) return false;
    }
    return true;
  },

  hitEntry(c, r) {
    for (const entry of GS.roster) {
      for (const [cc, rr2] of this.cellsOf(entry, entry.col, entry.row)) {
        if (cc === c && rr2 === r) return entry;
      }
    }
    return null;
  },

  findFree(type) {
    if (type === 'catapult') {
      for (let r = 0; r <= this.ROWS - 2; r++) {
        for (let c = 0; c <= this.COLS - 2; c++) {
          const probe = { type, col: c, row: r };
          if (this.canPlace(probe, c, r, null)) return { c, r };
        }
      }
      return null;
    }
    for (let i = 0; i < 400; i++) {
      const c = (Math.random() * this.COLS) | 0;
      const r = (Math.random() * this.ROWS) | 0;
      if (this.canPlace({ type, col: c, row: r }, c, r, null)) return { c, r };
    }
    return null;
  },

  bindInput() {
    const c = this.canvas;

    c.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const cell = this.cellOf(this.posOf(e));
      const hit = this.hitEntry(cell.c, cell.r);
      this.dragging = hit;
      if (hit) this.canvas.style.cursor = 'grabbing';
    });

    c.addEventListener('mousemove', (e) => {
      const cell = this.cellOf(this.posOf(e));
      this.hover = cell;
      if (this.dragging) {
        let nc = cell.c;
        let nr = cell.r;
        if (this.dragging.type === 'catapult') { nc -= 1; nr -= 1; }
        if (this.canPlace(this.dragging, nc, nr, this.dragging)) {
          this.dragging.col = nc;
          this.dragging.row = nr;
        }
      }
    });

    c.addEventListener('mouseup', () => {
      this.dragging = null;
      this.canvas.style.cursor = 'pointer';
    });

    c.addEventListener('mouseleave', () => {
      this.dragging = null;
      this.hover = { c: -1, r: -1 };
      this.canvas.style.cursor = 'pointer';
    });

    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const cell = this.cellOf(this.posOf(e));
      const hit = this.hitEntry(cell.c, cell.r);
      if (hit) {
        const i = GS.roster.indexOf(hit);
        if (i >= 0) GS.roster.splice(i, 1);
        this.refresh();
      }
    });
  },

  bindShop() {
    const shopMsg = document.getElementById('shop-msg');

    document.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-buy');
        const t = UNIT_TYPES[type];
        if (GS.money < t.cost) {
          shopMsg.textContent = 'Not enough coins for a ' + t.label + '.';
          return;
        }
        const spot = this.findFree(type);
        if (!spot) {
          shopMsg.textContent = 'No free space on the grid.';
          return;
        }
        GS.money -= t.cost;
        GS.roster.push({ type, col: spot.c, row: spot.r });
        shopMsg.textContent = '';
        updateMoneyHud();
        this.refresh();
      });
    });

    document.getElementById('start-battle').addEventListener('click', () => {
      if (GS.intermission) {
        fightNextWave();
        return;
      }
      if (GS.roster.length === 0) {
        shopMsg.textContent = 'Recruit at least one troop first.';
        return;
      }
      Screen.show('battle');
    });

    document.getElementById('reset-game').addEventListener('click', () => {
      resetGame();
      updateMoneyHud();
      updateIntermissionUI();
      this.refresh();
    });
  },

  refresh() {
    const summary = document.getElementById('army-summary');
    const startBtn = document.getElementById('start-battle');
    let html = '';
    let total = 0;
    for (const type of ['knight', 'archer', 'catapult']) {
      const n = GS.roster.filter(e => e.type === type).length;
      total += n;
      html += '<div>' + UNIT_TYPES[type].label + ': <b>' + n + '</b></div>';
      document.getElementById('count-' + type).textContent = n;
    }
    html = '<div>Total: <b>' + total + '</b></div>' + html;
    summary.innerHTML = html;
    startBtn.disabled = total === 0;
    startBtn.textContent = total === 0 ? 'Start Battle (no troops)' : 'Start Battle';

    document.querySelectorAll('[data-buy]').forEach((btn) => {
      const type = btn.getAttribute('data-buy');
      btn.classList.toggle('disabled', GS.money < UNIT_TYPES[type].cost);
    });

    document.getElementById('home-wave').textContent = GS.wave;
    updateIntermissionUI();
  }
};
