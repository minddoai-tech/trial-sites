(function (global) {
  'use strict';

  var T = global.Tiles;

  function key(p) { return p.x + ',' + p.y; }

  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  function neighbors(p, cols, rows) {
    var out = [];
    for (var i = 0; i < T.DIRS.length; i++) {
      var v = T.DIRV[T.DIRS[i]];
      var q = { x: p.x + v[0], y: p.y + v[1] };
      if (q.x >= 0 && q.x < cols && q.y >= 0 && q.y < rows) out.push(q);
    }
    return out;
  }

  function adjacent(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
  }

  function findCycle(cols, rows) {
    var maxCells = Math.min(26, cols * rows);
    var minCells = Math.min(12, Math.max(8, maxCells - 2));

    for (var attempt = 0; attempt < 3000; attempt++) {
      var start = { x: randInt(0, cols - 1), y: randInt(0, rows - 1) };
      var visited = new Set([key(start)]);
      var path = [start];
      var budget = 40000;
      var found = false;

      function dfs(cur, len) {
        if (found) return true;
        if (--budget < 0) return false;
        if (len >= minCells && adjacent(cur, start)) { found = true; return true; }
        if (len >= maxCells) return false;

        var ns = shuffle(neighbors(cur, cols, rows));
        for (var i = 0; i < ns.length; i++) {
          var n = ns[i];
          if (n.x === start.x && n.y === start.y) continue;
          var k = key(n);
          if (visited.has(k)) continue;
          visited.add(k);
          path.push(n);
          if (dfs(n, len + 1)) return true;
          path.pop();
          visited.delete(k);
        }
        return false;
      }

      if (dfs(start, 1)) return path;
    }
    return null;
  }

  function rectLoop(cols, rows) {
    var w = Math.min(6, cols), h = Math.min(5, rows);
    var x0 = randInt(0, cols - w), y0 = randInt(0, rows - h);
    var x1 = x0 + w - 1, y1 = y0 + h - 1;
    var path = [];
    for (var x = x0; x <= x1; x++) path.push({ x: x, y: y0 });
    for (var y = y0 + 1; y <= y1; y++) path.push({ x: x1, y: y });
    for (x = x1 - 1; x >= x0; x--) path.push({ x: x, y: y1 });
    for (y = y1 - 1; y > y0; y--) path.push({ x: x0, y: y });
    return path;
  }

  function pickType(isTurn) {
    var pool = isTurn
      ? ['curve', 'curve', 'curve', 'curve', 'curve', 'spring', 'spring', 'cross']
      : ['straight', 'straight', 'straight', 'straight', 'spring', 'chute'];
    return pool[randInt(0, pool.length - 1)];
  }

  function buildLoopCells(path) {
    var L = path.length;
    var cells = [];
    for (var i = 0; i < L; i++) {
      var cur = path[i];
      var prev = path[(i + L - 1) % L];
      var nxt = path[(i + 1) % L];
      var entry = T.opposite(T.dirFrom(prev, cur));
      var exit = T.dirFrom(cur, nxt);
      var isSpawn = i === 0;
      var type = isSpawn ? 'spawn' : pickType(!T.isStraight(entry, exit));
      cells.push({ x: cur.x, y: cur.y, type: type, entry: entry, exit: exit, active: true, index: i });
    }
    return cells;
  }

  function fixVariety(cells) {
    var hasSpring = cells.some(function (c) { return c.type === 'spring'; });
    var hasChute = cells.some(function (c) { return c.type === 'chute'; });

    var straights = function () {
      return cells.filter(function (c) { return c.type !== 'spawn' && T.isStraight(c.entry, c.exit); });
    };

    if (!hasSpring) {
      var s1 = straights();
      if (s1.length) s1[randInt(0, s1.length - 1)].type = 'spring';
    }
    if (!hasChute) {
      var s2 = straights().filter(function (c) { return c.type !== 'spring'; });
      if (s2.length) s2[randInt(0, s2.length - 1)].type = 'chute';
    }
    return cells;
  }

  global.MarbleGen = {
    generate: function (cols, rows) {
      var path = findCycle(cols, rows);
      if (!path) path = rectLoop(cols, rows);
      var cells = fixVariety(buildLoopCells(path));
      return { cells: cells, spawn: cells[0], length: cells.length };
    }
  };
})(window);