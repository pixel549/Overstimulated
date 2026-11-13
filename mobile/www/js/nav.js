// Tile grid, walls, doors and pathfinding.
// Walls live on the edges between rooms. A door sits on one edge: open doors let everyone through, closed doors only let
// "door users" (Dad, Wife, Jake) through, and they open the door as they pass. Dogs, chickens and the baby are stopped.
'use strict';
const Nav = (() => {
  const roomAt = [];            // roomAt[y][x] -> room key or null
  const solid = new Uint8Array(MAPW * MAPH);   // furniture-blocked tiles
  const doors = new Map();      // "v:x:y" / "h:x:y" -> door object (live state in door.open)
  for (let y = 0; y < MAPH; y++) roomAt.push(new Array(MAPW).fill(null));
  for (const k of ROOM_ORDER) {
    const r = ROOMS[k];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (y < MAPH && x < MAPW) roomAt[y][x] = k;
  }
  const edgeKey = (ax, ay, bx, by) => ax !== bx ? 'v:' + Math.max(ax, bx) + ':' + ay : 'h:' + ax + ':' + Math.max(ay, by);
  for (const d of DOORS) {
    d.key = d.o === 'v' ? 'v:' + d.at + ':' + d.i : 'h:' + d.i + ':' + d.at; doors.set(d.key, d); d.t = 0;
    // the two tiles a door joins, a = west/north side, b = east/south side
    if (d.o === 'v') { d.a = { x: d.at - 1, y: d.i }; d.b = { x: d.at, y: d.i }; } else { d.a = { x: d.i, y: d.at - 1 }; d.b = { x: d.i, y: d.at }; }
  }

  const inb = (x, y) => x >= 0 && y >= 0 && x < MAPW && y < MAPH;
  const isSolid = (x, y) => !inb(x, y) || solid[y * MAPW + x] === 1 || roomAt[y][x] === null;
  const doorAt = (ax, ay, bx, by) => doors.get(edgeKey(ax, ay, bx, by)) || null;

  // can we cross the wall edge between orthogonal neighbours a -> b?
  function edgeOpen(ax, ay, bx, by, canDoors) {
    const ra = roomAt[ay][ax], rb = roomAt[by][bx];
    if (ra === rb) return true;
    const d = doors.get(edgeKey(ax, ay, bx, by));
    if (d) return d.open || !!canDoors;
    if (ROOMS[ra].out && ROOMS[rb].out && !fenced(ra, rb)) return true;
    return false;
  }
  // outdoor areas that are fenced off from each other (only the gates join them)
  function fenced(a, b) {
    const dy = 'DOG_YARD', dp = 'DOG_PATIO', cy = 'CHICKEN_YARD';
    return (a === cy && (b === dy || b === dp)) || (b === cy && (a === dy || a === dp));
  }
  function stepOK(ax, ay, bx, by, canDoors = true) {
    if (isSolid(bx, by)) return false;
    if (ax !== bx && ay !== by) {   // diagonal: both orthogonal routes must be open, and never cut a door corner
      const noDoor = (x1, y1, x2, y2) => roomAt[y1][x1] === roomAt[y2][x2] || !doorAt(x1, y1, x2, y2);
      if (!noDoor(ax, ay, bx, ay) || !noDoor(ax, ay, ax, by) || !noDoor(bx, ay, bx, by) || !noDoor(ax, by, bx, by)) return false;
      return stepOK(ax, ay, bx, ay, canDoors) && stepOK(ax, ay, ax, by, canDoors) && stepOK(bx, ay, bx, by, canDoors) && stepOK(ax, by, bx, by, canDoors);
    }
    return edgeOpen(ax, ay, bx, by, canDoors);
  }

  function blockRect(px, py, pw, ph) {
    const x0 = Math.floor(px / T), x1 = Math.floor((px + pw - 1) / T), y1 = Math.floor((py + ph - 1) / T);
    const y0 = Math.max(Math.floor(py / T), y1 - 1);   // only the lower two rows of tall sprites block movement
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) solid[y * MAPW + x] = 1;
    return { x0, x1, y0, y1 };
  }

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function findPath(sx, sy, gx, gy, canDoors = true, maxNodes = 6000) {
    if (!inb(gx, gy) || !inb(sx, sy) || roomAt[sy][sx] === null || isSolid(gx, gy)) return null;
    if (sx === gx && sy === gy) return [];
    const key = (x, y) => y * MAPW + x;
    const g = new Map([[key(sx, sy), 0]]), from = new Map(), open = [[0, sx, sy]], closed = new Set();
    let n = 0;
    while (open.length && n++ < maxNodes) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
      const [, x, y] = open.splice(bi, 1)[0], k = key(x, y);
      if (closed.has(k)) continue; closed.add(k);
      if (x === gx && y === gy) {
        const path = []; let c = k;
        while (c !== key(sx, sy)) { path.push({ x: c % MAPW, y: (c / MAPW) | 0 }); c = from.get(c); }
        return path.reverse();
      }
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny) || !stepOK(x, y, nx, ny, canDoors)) continue;
        const nk = key(nx, ny), cost = g.get(k) + (dx && dy ? 1.42 : 1);
        if (g.has(nk) && g.get(nk) <= cost) continue;
        g.set(nk, cost); from.set(nk, k);
        open.push([cost + Math.hypot(gx - nx, gy - ny), nx, ny]);
      }
    }
    return null;
  }

  // Flood fill from (sx,sy) and return the reachable free tile nearest to (tx,ty). Cheap enough to call a few times a second,
  // and it is what lets Momo wait at a closed door instead of giving up.
  function nearestReachable(sx, sy, tx, ty, canDoors = true) {
    if (!inb(sx, sy) || roomAt[sy][sx] === null) return null;
    const seen = new Uint8Array(MAPW * MAPH), q = [[sx, sy]]; seen[sy * MAPW + sx] = 1;
    let best = null, bd = 1e9;
    for (let h = 0; h < q.length; h++) {
      const [x, y] = q[h];
      if (!isSolid(x, y)) { const d = Math.hypot(x - tx, y - ty); if (d < bd - 1e-6) { bd = d; best = { x, y }; } }
      for (let k = 0; k < 4; k++) {
        const nx = x + DIRS[k][0], ny = y + DIRS[k][1];
        if (!inb(nx, ny) || seen[ny * MAPW + nx] || !stepOK(x, y, nx, ny, canDoors)) continue;
        seen[ny * MAPW + nx] = 1; q.push([nx, ny]);
      }
    }
    return best;
  }
  // Panic: BFS a few steps from (sx,sy) and pick the reachable tile that gets furthest from the threat at (tx,ty).
  function fleeTile(sx, sy, tx, ty, canDoors = false, maxSteps = 8) {
    if (!inb(sx, sy) || roomAt[sy][sx] === null) return null;
    const seen = new Int16Array(MAPW * MAPH).fill(-1), q = [[sx, sy]]; seen[sy * MAPW + sx] = 0;
    let best = null, bs = -1e9;
    for (let h = 0; h < q.length; h++) {
      const [x, y] = q[h], st = seen[y * MAPW + x];
      if (st > 0 && !isSolid(x, y)) { const sc = Math.hypot(x - tx, y - ty) - st * 0.35 + Math.random() * 1.6; if (sc > bs) { bs = sc; best = { x, y }; } }
      if (st >= maxSteps) continue;
      for (let k = 0; k < 4; k++) {
        const nx = x + DIRS[k][0], ny = y + DIRS[k][1];
        if (!inb(nx, ny) || seen[ny * MAPW + nx] >= 0 || !stepOK(x, y, nx, ny, canDoors)) continue;
        seen[ny * MAPW + nx] = st + 1; q.push([nx, ny]);
      }
    }
    return best;
  }
  function randomTileIn(roomKey) {
    const r = ROOMS[roomKey];
    for (let i = 0; i < 40; i++) {
      const x = r.x + 1 + Math.floor(Math.random() * Math.max(1, r.w - 2)), y = r.y + 1 + Math.floor(Math.random() * Math.max(1, r.h - 2));
      if (roomAt[y] && roomAt[y][x] === roomKey && !isSolid(x, y)) return { x, y };
    }
    return { x: r.x + (r.w >> 1), y: r.y + (r.h >> 1) };
  }
  return { roomAt, solid, doors, inb, isSolid, edgeOpen, stepOK, doorAt, blockRect, findPath, nearestReachable, fleeTile, fenced, randomTileIn };
})();
