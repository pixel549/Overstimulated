// Tile grid, wall edges and A* pathfinding.
'use strict';
const Nav = (() => {
  const roomAt = [];            // roomAt[y][x] -> room key or null
  const solid = new Uint8Array(MAPW * MAPH);   // furniture-blocked tiles
  const openEdge = new Set();   // "v:x:y" / "h:x:y" openings through walls
  for (let y = 0; y < MAPH; y++) roomAt.push(new Array(MAPW).fill(null));
  for (const k of ROOM_ORDER) {
    const r = ROOMS[k];
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (y < MAPH && x < MAPW) roomAt[y][x] = k;
  }
  for (const d of DOOR_NORMALISED) for (let i = d.s; i <= d.e; i++) openEdge.add(d.o + ':' + (d.o === 'v' ? d.at + ':' + i : i + ':' + d.at));

  const inb = (x, y) => x >= 0 && y >= 0 && x < MAPW && y < MAPH;
  const isSolid = (x, y) => !inb(x, y) || solid[y * MAPW + x] === 1 || roomAt[y][x] === null;

  // can we step from tile a to its orthogonal neighbour b? (walls live on the edges between rooms)
  function edgeOpen(ax, ay, bx, by) {
    const ra = roomAt[ay][ax], rb = roomAt[by][bx];
    if (ra === rb) return true;
    if (ROOMS[ra].out && ROOMS[rb].out) {
      // yards are only joined at the two gates; patios and yards are open to each other
      const yardPair = (ra === 'DOG_YARD' && rb === 'CHICKEN_YARD') || (ra === 'CHICKEN_YARD' && rb === 'DOG_YARD');
      if (!yardPair) return true;
    }
    if (ax !== bx) return openEdge.has('v:' + Math.max(ax, bx) + ':' + ay);
    return openEdge.has('h:' + ax + ':' + Math.max(ay, by));
  }
  function stepOK(ax, ay, bx, by) {
    if (isSolid(bx, by)) return false;
    if (ax !== bx && ay !== by) {   // diagonal: both orthogonal routes must be open
      return stepOK(ax, ay, bx, ay) && stepOK(ax, ay, ax, by) && stepOK(bx, ay, bx, by) && stepOK(ax, by, bx, by);
    }
    return edgeOpen(ax, ay, bx, by);
  }

  function blockRect(px, py, pw, ph) {
    const x0 = Math.floor(px / T), x1 = Math.ceil((px + pw) / T) - 1, y1 = Math.ceil((py + ph) / T) - 1;
    const y0 = Math.max(Math.floor(py / T), y1 - 1);   // only the lower two rows of tall sprites block movement
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) solid[y * MAPW + x] = 1;
    return { x0, x1, y0, y1 };
  }

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function findPath(sx, sy, gx, gy, maxNodes = 6000) {
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
        if (!inb(nx, ny) || !stepOK(x, y, nx, ny)) continue;
        const nk = key(nx, ny), cost = g.get(k) + (dx && dy ? 1.42 : 1);
        if (g.has(nk) && g.get(nk) <= cost) continue;
        g.set(nk, cost); from.set(nk, k);
        open.push([cost + Math.hypot(gx - nx, gy - ny), nx, ny]);
      }
    }
    return null;
  }

  // free tile nearest to (tx,ty) by straight distance, reachable from (sx,sy)
  function nearestReachable(sx, sy, tx, ty) {
    let best = null, bd = 1e9;
    for (let r = 0; r <= 6 && !best; r++) {
      for (let y = ty - r; y <= ty + r; y++) for (let x = tx - r; x <= tx + r; x++) {
        if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r || isSolid(x, y)) continue;
        const d = Math.hypot(x - tx, y - ty); if (d >= bd) continue;
        if (findPath(sx, sy, x, y)) { bd = d; best = { x, y }; }
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
  return { roomAt, solid, inb, isSolid, edgeOpen, stepOK, blockRect, findPath, nearestReachable, randomTileIn, openEdge };
})();
