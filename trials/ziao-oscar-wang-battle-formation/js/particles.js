const Particles = {
  list: [],
  max: 800,

  add(p) {
    if (this.list.length < this.max) this.list.push(p);
  },

  chunks(x, y, pal, count) {
    const cols = [pal.color, pal.dark, pal.light];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(25, 150);
      const size = rnd(2.5, 7);
      this.add({
        type: 'chunk', x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 70,
        life: rnd(0.6, 1.3),
        max: 1, size, rot: rnd(0, TAU), vr: rnd(-9, 9),
        color: cols[(Math.random() * cols.length) | 0],
        grav: 420, drag: 0.92
      });
    }
  },

  spark(x, y, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(90, 260);
      this.add({
        type: 'spark', x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rnd(0.12, 0.28),
        max: 1, size: rnd(1.5, 2.5),
        color: color || '#ffdf8a',
        grav: 0, drag: 0.88
      });
    }
  },

  dust(x, y, radius, count, color) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(10, 70);
      this.add({
        type: 'dust', x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 20,
        life: rnd(0.3, 0.6),
        max: 1, size: rnd(radius * 0.4, radius),
        color: color || 'rgba(200,190,170,0.8)',
        grav: -40, drag: 0.9, grow: rnd(20, 45)
      });
    }
  },

  addCoin(sx, sy, tx, ty, value) {
    this.add({
      type: 'coin', x: sx, y: sy, sx, sy, tx, ty, value,
      t: 0, dur: rnd(0.65, 1.05), phase: rnd(0, TAU)
    });
  },

  update(dt) {
    const out = [];
    for (const p of this.list) {
      if (p.type === 'coin') {
        p.t += dt / p.dur;
        if (p.t >= 1) p.t = 1;
        out.push(p);
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += (p.grav || 0) * dt;
      p.vx *= Math.pow(p.drag || 0.92, dt * 60);
      p.vy *= Math.pow(p.drag || 0.92, dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot = (p.rot || 0) + (p.vr || 0) * dt;
      if (p.type === 'dust') p.size += (p.grow || 30) * dt;
      out.push(p);
    }
    this.list = out;
  },

  draw(ctx) {
    for (const p of this.list) {
      if (p.type === 'coin') {
        const k = Math.min(1, p.t);
        const e = 1 - Math.pow(1 - k, 3);
        const x = lerp(p.sx, p.tx, e);
        const y = lerp(p.sy, p.ty, e) - Math.sin(k * Math.PI) * 22;
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(0.7 + 0.3 * Math.sin(k * Math.PI), 1);
        ctx.fillStyle = '#8a6a1e';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#ffdf8a';
        ctx.beginPath();
        ctx.arc(-1.2, -1.2, 1.8, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'chunk') {
        const a = clamp(p.life / (p.max || 1), 0, 1);
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
        ctx.globalAlpha = 1;
      } else if (p.type === 'spark') {
        const a = clamp(p.life / (p.max || 1), 0, 1);
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (p.type === 'dust') {
        const a = clamp(p.life / (p.max || 1), 0, 1);
        ctx.globalAlpha = a * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
};
