// Overstimulated (mobile): tap-to-move household chaos. Core loop, rendering, chores, NPCs and HUD.
'use strict';
(() => {
  const canvas = document.getElementById('c'), ctx = canvas.getContext('2d');
  const $ = id => document.getElementById(id);
  const DAY_LEN = 300;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const tileOf = v => Math.floor(v / T);
  const centre = t => t * T + T / 2;
  const qs = new URLSearchParams(location.search);

  // ---------------------------------------------------------------- world build
  const furn = [];     // {k,x,y,w,h,id,floor,hit,stand}
  for (const [k, room, dx, dy, o] of FURN) {
    const r = ROOMS[room], s = Art.size(k);
    const f = { k, x: Math.round((r.x + dx) * T), y: Math.round((r.y + dy) * T), w: s.w, h: s.h, id: o.id, floor: !!o.floor };
    if (!f.floor) Nav.blockRect(f.x, f.y, f.w, f.h);
    furn.push(f);
  }
  const byId = id => furn.find(f => f.id === id);
  for (const d of DOORS) { d.open0 = d.open; d.t = d.open ? 1 : 0; }
  const doorById = id => DOORS.find(d => d.id === id);

  // ---------------------------------------------------------------- state
  const S = {
    day: 1, t: 0, stress: 18, mode: 'play', best: 0, over: false, started: false, doneCount: 0, failCount: 0, hideCD: 0,
    tasks: [], ents: [], timeline: [], tn: 0, toastT: 0,
  };
  const dad = mover('dad', ROOMS.LIVING_ROOM.x + 6, ROOMS.LIVING_ROOM.y + 13, 112); dad.canDoors = true;
  const npcs = [];
  const chickens = [];
  const bubbles = [];
  const NAMES = { dad: 'Dad', wife: 'Wife', jake: 'Jake', baby: 'Baby', momo: 'Momo', piper: 'Piper', chicken: 'Chook' };

  function mover(name, tx, ty, speed) {
    return { name, x: centre(tx), y: centre(ty) + 8, dir: 'down', moving: false, path: [], speed, onArrive: null, wait: rnd(1, 4), anim: Math.random() * 10 };
  }
  function spawnNPCs() {
    npcs.length = 0; chickens.length = 0;
    const add = (name, kind, room, speed, canDoors) => { const t = Nav.randomTileIn(room); const n = mover(name, t.x, t.y, speed); n.kind = kind; n.rooms = WANDER[name]; n.canDoors = !!canDoors; n.fcd = rnd(0, .4); n.cd = 0; npcs.push(n); return n; };
    add('wife', 'person', 'KITCHEN', 62, true); add('jake', 'person', 'SPARE', 50, true); add('baby', 'person', 'BABYS_ROOM', 38);
    add('momo', 'animal', 'LIVING_ROOM', 98); add('piper', 'animal', 'LIVING_ROOM', 110);
    for (let i = 0; i < 6; i++) {
      let t, n = 0; do { t = { x: 44 + Math.floor(rnd(0, 14)), y: 7 + Math.floor(rnd(0, 9)) }; } while (n++ < 60 && (Nav.roomAt[t.y][t.x] !== 'CHICKEN_YARD' || Nav.isSolid(t.x, t.y)));
      const c = mover('chicken', t.x, t.y, 34); c.kind = 'animal'; c.cd = rnd(0, 6); chickens.push(c);
    }
    DOORS.forEach(d => { d.open = d.open0; d.t = d.open ? 1 : 0; d.by = null; });
  }

  // ---------------------------------------------------------------- movement
  const tileNow = m => ({ x: tileOf(m.x), y: tileOf(m.y - 8) });
  function setPath(m, gx, gy) {
    const s = tileNow(m), p = Nav.findPath(s.x, s.y, gx, gy, !!m.canDoors);
    if (p === null) return false;
    m.path = p; m.chk = null; return true;
  }
  // Called as a mover is about to leave its tile for the next one. Closed doors stop anything that can't work a handle;
  // people open them as they go (and Wife/Jake pull them shut again behind themselves, so only Dad leaves doors open).
  function crossDoor(m, from, to) {
    if (from.x !== to.x && from.y !== to.y) return true;
    const d = Nav.doorAt(from.x, from.y, to.x, to.y);
    if (!d || d.open) return true;
    if (!m.canDoors) return false;
    d.open = true; d.by = m === dad ? null : m.name; if (d.by) m.lastDoor = d;
    return true;
  }
  function stepMover(m, dt) {
    m.anim += dt;
    if (!m.path.length) { m.moving = false; if (m.onArrive) { const f = m.onArrive; m.onArrive = null; f(); } return; }
    const n = m.path[0];
    if (m.chk !== n) {
      if (!crossDoor(m, tileNow(m), n)) { m.path = []; m.onArrive = null; m.moving = false; return; }
      m.chk = n;
    }
    const tx = centre(n.x), ty = centre(n.y) + 8, dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy), step = m.speed * dt;
    m.moving = true;
    if (Math.abs(dx) > Math.abs(dy) * 0.6 || Math.abs(dx) > 2) m.dir = dx > 0 ? 'right' : 'left'; else m.dir = dy > 0 ? 'down' : 'up';
    if (Math.abs(dy) > Math.abs(dx) * 1.6) m.dir = dy > 0 ? 'down' : 'up';
    if (d <= step) {
      m.x = tx; m.y = ty; m.path.shift();
      if (m.lastDoor && m.lastDoor.by === m.name) { m.lastDoor.open = false; m.lastDoor.by = null; m.lastDoor = null; }
    } else { m.x += dx / d * step; m.y += dy / d * step; }
  }
  function wanderTo(n) {
    for (let i = 0; i < 4; i++) { const t = Nav.randomTileIn(pick(n.rooms)); if (setPath(n, t.x, t.y)) return true; }
    return false;
  }
  // Momo trails Dad. Closed doors stop him, so he ends up waiting on the near side and scratching at it.
  function updateMomo(n, dt) {
    stepMover(n, dt);
    n.cd -= dt; n.fcd -= dt; if (n.fcd > 0) return; n.fcd = 0.4;
    const me = tileNow(n), d = tileNow(dad), dist = Math.hypot(me.x - d.x, me.y - d.y);
    if (dist <= 2.3) { if (n.path.length) n.path = []; return; }
    const t = Nav.nearestReachable(me.x, me.y, d.x, d.y, false);
    if (!t) return;
    if (t.x === me.x && t.y === me.y) {
      n.path = [];
      if (n.cd <= 0 && dist > 2.6) { say(n, pick(['*scratches at the door*', '*whines*', '*sits and stares at the door*']), 2.6); n.cd = 11; }
      return;
    }
    if (setPath(n, t.x, t.y)) { while (n.path.length && Math.hypot(n.path[n.path.length - 1].x - d.x, n.path[n.path.length - 1].y - d.y) < 2) n.path.pop(); }
  }
  function updateNPC(n, dt) {
    if (n.name === 'momo') return updateMomo(n, dt);
    stepMover(n, dt);
    n.cd -= dt;
    if (n.moving || S.mode === 'hide') return;
    n.wait -= dt;
    if (n.wait > 0) return;
    n.wait = n.name === 'baby' ? rnd(6, 14) : rnd(4, 11);
    if (n.name === 'piper' && Math.random() < 0.35) { const dt2 = tileNow(dad); const t = Nav.nearestReachable(tileNow(n).x, tileNow(n).y, dt2.x + (Math.random() < .5 ? 2 : -2), dt2.y + 1, false); if (t && setPath(n, t.x, t.y)) return; }
    wanderTo(n);
  }
  const isIndoor = c => { const r = Nav.roomAt[tileNow(c).y] && Nav.roomAt[tileNow(c).y][tileNow(c).x]; return !!r && !ROOMS[r].out && !['CHICKEN_RUN', 'CHICKEN_COOP', 'SHED'].includes(r); };
  // Chooks scatter when Dad gets close. They can't open doors or gates, so a shut gate keeps them where they are.
  function updateChicken(c, dt) {
    stepMover(c, dt); c.cd -= dt;
    const s = tileNow(c), d = tileNow(dad), dist = Math.hypot(s.x - d.x, s.y - d.y);
    if (dist < 4.2 && (!c.scared || !c.path.length || c.rt <= 0)) {
      const t = Nav.fleeTile(s.x, s.y, d.x, d.y, false, 7);
      if (t && setPath(c, t.x, t.y)) { c.scared = true; c.speed = 74; c.rt = 0.5; c.wait = 0.8; if (c.cd <= 0 && Math.random() < 0.5) { say(c, pick(['BAWK!', 'BAWK BAWK!', '*flap flap*']), 1.4); c.cd = 5 + rnd(0, 4); } }
    }
    if (c.rt > 0) c.rt -= dt;
    if (dist >= 6) { c.scared = false; c.speed = 34; }
    if (c.moving) return;
    c.wait -= dt; if (c.wait > 0) return; c.wait = rnd(1.2, 4);
    const nx = s.x + Math.floor(rnd(-3, 4)), ny = s.y + Math.floor(rnd(-3, 4));
    if (Nav.inb(nx, ny) && Nav.roomAt[ny][nx] === Nav.roomAt[s.y][s.x] && !Nav.isSolid(nx, ny)) setPath(c, nx, ny);
  }

  // ---------------------------------------------------------------- tasks
  const TASKS = {
    dishes: { icon: '🍽️', label: 'Dishes', spot: 'sink', who: 'wife', line: 'Those dishes are not going to wash themselves.' },
    dogs:   { icon: '🐕', label: 'Feed the dogs', spot: 'bowls', who: 'piper', line: '*stares meaningfully at the empty bowls*' },
    toys:   { icon: '🧸', label: 'Tidy toys', spot: 'toys', who: 'baby', line: 'Ba ba ba! *flings a toy*' },
    poop:   { icon: '💩', label: 'Patio mess', spot: 'poop', who: 'jake', line: 'Chickens. On the patio. Again.' },
    baby:   { icon: '👶', label: 'Settle baby', spot: 'cot', who: 'baby', line: 'WAHHHH!' },
  };
  function addTask(type, quiet) {
    if (S.tasks.some(t => t.type === type)) { S.stress = Math.min(100, S.stress + 2); return; }
    const task = { type, born: S.t, ...TASKS[type] };
    if (type === 'toys') {
      const a = SPOTS.toyLiving, ra = ROOMS[a.room], b = SPOTS.toyBaby, rb = ROOMS[b.room];
      ['toy_a', 'toy_b', 'toy_c'].forEach((k, i) => S.ents.push({ k, task: 'toys', tx: ra.x + a.dx + (i % 2) * 2, ty: ra.y + a.dy + (i >> 1) * 2 + (i % 2) }));
      S.ents.push({ k: 'toy_c', task: 'toys', tx: rb.x + b.dx, ty: rb.y + b.dy });
    } else if (type === 'poop') {
      SPOTS.patioPoop.forEach(p => S.ents.push({ k: 'poop', task: 'poop', tx: ROOMS[p.room].x + p.dx, ty: ROOMS[p.room].y + p.dy }));
    }
    S.tasks.push(task);
    if (!quiet) say(task.who, task.line, 3.4);
    renderHUD();
  }
  function removeTask(type) {
    S.tasks = S.tasks.filter(t => t.type !== type);
    S.ents = S.ents.filter(e => e.task !== type);
    renderHUD();
  }
  function taskTarget(type) {
    if (type === 'toys' || type === 'poop') {
      const list = S.ents.filter(e => e.task === type); if (!list.length) return null;
      const d = tileNow(dad); list.sort((a, b) => Math.hypot(a.tx - d.x, a.ty - d.y) - Math.hypot(b.tx - d.x, b.ty - d.y));
      return { tx: list[0].tx, ty: list[0].ty, exact: true };
    }
    const f = byId(TASKS[type].spot); if (!f) return null;
    return { f };
  }
  function standTileFor(f) {
    const d = tileNow(dad), bottom = Math.ceil((f.y + f.h) / T);
    return Nav.nearestReachable(d.x, d.y, tileOf(f.x + f.w / 2), bottom);
  }
  function goTask(type) {
    if (S.mode !== 'play') return;
    const tg = taskTarget(type); if (!tg) return;
    if (tg.exact) { if (setPath(dad, tg.tx, tg.ty)) dad.onArrive = () => startTask(type); return; }
    const st = standTileFor(tg.f); if (st && setPath(dad, st.x, st.y)) dad.onArrive = () => startTask(type);
  }
  function startTask(type) {
    if (!S.tasks.some(t => t.type === type)) return;
    S.mode = 'mini'; dad.path = []; dad.moving = false; document.body.classList.add('mini');
    Mini.start(type, (ok, q) => {
      S.mode = 'play'; document.body.classList.remove('mini');
      if (ok) {
        const info = TASKS[type]; S.doneCount++; S.stress = Math.max(0, S.stress - (10 + 5 * (q || 0)));
        removeTask(type); say(dad, pick(['Sorted.', 'One down.', 'Right. Done.', 'There. Happy?']), 2); if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
      } else { S.failCount++; S.stress = Math.min(100, S.stress + 8); say(dad, 'Well. That went badly.', 2.4); }
    });
  }

  // ---------------------------------------------------------------- relax / hide / interactions
  function interact(f) {
    const st = standTileFor(f); if (!st) return;
    const go = fn => { if (setPath(dad, st.x, st.y)) dad.onArrive = fn; };
    const id = f.id;
    if (['sofa', 'armchair', 'armchair2', 'armchair3', 'bed'].includes(id)) go(() => { S.mode = 'relax'; dad.dir = 'up'; say(dad, 'Ahh. (tap to get up)', 3, 'think'); });
    else if (id === 'toilet') { if (S.hideCD > 0) { say(dad, 'Not again so soon… give it a minute.', 2.4, 'think'); return; } go(() => { S.mode = 'hide'; doorById('ensuite').open = false; say(dad, 'Door locked. Breathe. (tap to come out)', 3.5, 'think'); }); }
    else {
      const t = S.tasks.find(t => t.spot === id);
      if (t) goTask(t.type);
      else go(() => say(dad, id === 'fridge' ? 'Nothing good in here.' : id === 'toybox' ? 'The toy box is surprisingly tidy.' : id === 'cot' ? 'The baby is not in the cot.' : 'Nothing to do here right now.', 2.4, 'think'));
    }
  }
  function tap(wx, wy) {
    if (S.over) return;
    if (S.mode === 'relax' || S.mode === 'hide') { if (S.mode === 'hide') S.hideCD = 25; S.mode = 'play'; return; }
    if (S.mode !== 'play') return;
    // entities (toys/poop) first, then interactive furniture, then npcs, otherwise walk
    for (const e of S.ents) if (Math.abs(wx - centre(e.tx)) < 26 && Math.abs(wy - centre(e.ty)) < 26) { goTask(e.task); return; }
    for (const d of DOORS) { const r = doorRect(d); if (wx >= r.x0 && wx <= r.x1 && wy >= r.y0 && wy <= r.y1) { useDoor(d); return; } }
    for (const f of furn.slice().reverse()) if (f.id && wx >= f.x - 6 && wx <= f.x + f.w + 6 && wy >= f.y - 6 && wy <= f.y + f.h + 6) { interact(f); return; }
    for (const n of npcs) if (Math.abs(wx - n.x) < 26 && wy > n.y - 56 && wy < n.y + 10) { talkTo(n); return; }
    const tx = tileOf(wx), ty = tileOf(wy);
    let g = { x: tx, y: ty };
    const d = tileNow(dad);
    if (Nav.isSolid(tx, ty) || !Nav.findPath(d.x, d.y, tx, ty)) g = Nav.nearestReachable(d.x, d.y, tx, ty);
    if (g && setPath(dad, g.x, g.y)) { dad.onArrive = null; S.marker = { x: centre(g.x), y: centre(g.y), t: 0.8 }; }
  }
  // ---------------------------------------------------------------- doors
  function doorRect(d) {
    return d.o === 'v' ? { x0: d.at * T - 11, x1: d.at * T + 11, y0: d.i * T, y1: d.i * T + T } : { x0: d.i * T, x1: d.i * T + T, y0: d.at * T - 12, y1: d.at * T + 14 };
  }
  // Dad walks to whichever side of the door he can reach without opening anything, then flips it.
  function useDoor(d) {
    const me = tileNow(dad); let best = null, bl = 1e9;
    for (const strict of [false, true]) {
      for (const c of [d.a, d.b]) {
        if (Nav.isSolid(c.x, c.y)) continue;
        const p = Nav.findPath(me.x, me.y, c.x, c.y, strict); if (!p) continue;
        if (p.length < bl) { bl = p.length; best = c; }
      }
      if (best) break;
    }
    if (!best) return;
    const other = best === d.a ? d.b : d.a;
    if (setPath(dad, best.x, best.y)) dad.onArrive = () => {
      d.open = !d.open; d.by = null;
      const dx = other.x - best.x, dy = other.y - best.y; dad.dir = dx ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      say(dad, d.open ? (d.gate ? '*creak*' : '*click*') : (d.gate ? '*latch*' : '*clunk*'), 1.2, 'think');
    };
  }

  function talkTo(n) {
    const near = () => {
      const lines = {
        wife: ['Did you sort out the dishes?', 'Don’t forget the dogs.', 'You’re doing great. Also: the patio.', 'Shut the doors, would you? The chooks…'],
        jake: ['Nah, I’m good.', 'Is that… a chicken in the house?', 'I can hear the baby.'],
        baby: ['Ba! Ba ba!', 'Mmmmm… NO.', 'Dada!'],
        momo: ['*enthusiastic panting*', '*leans against your leg*'], piper: ['*stares at you*', '*sits on your foot*'],
      };
      say(n, pick(lines[n.name]), 2.8); n.facing = dad;
      if (n.name === 'momo' || n.name === 'piper') S.stress = Math.max(0, S.stress - 3);
    };
    const s = tileNow(n), d = tileNow(dad);
    const t = Nav.nearestReachable(d.x, d.y, s.x, s.y + 1, true);
    if (t && setPath(dad, t.x, t.y)) dad.onArrive = near;
  }

  // ---------------------------------------------------------------- timeline & stress
  const TIMELINES = {
    1: [[0, 'dishes'], [3, 'toys'], [28, 'poop'], [55, 'dogs'], [85, 'baby'], [120, 'dishes'], [140, 'poop'], [165, 'toys'], [195, 'dogs'], [225, 'baby'], [250, 'poop']],
    2: [[0, 'dishes'], [2, 'toys'], [3, 'dogs'], [20, 'poop'], [40, 'baby'], [70, 'dishes'], [90, 'poop'], [110, 'toys'], [130, 'baby'], [150, 'dogs'], [175, 'dishes'], [195, 'poop'], [215, 'baby'], [240, 'toys'], [262, 'dogs']],
  };
  function updateStress(dt) {
    const mult = S.day === 1 ? 1 : 1.25;
    let rate = 0.32 + 0.16 * S.tasks.length;
    for (const t of S.tasks) if (S.t - t.born > 45) rate += 0.1;
    if (dad.moving) rate += 0.06;
    let near = 0; const d = tileNow(dad);
    for (const n of npcs) { const s = tileNow(n); if (Math.hypot(s.x - d.x, s.y - d.y) < 2.6) near++; }
    rate += Math.min(3, near) * 0.22;
    rate += Math.min(3, chickens.filter(isIndoor).length) * 0.28;   // chooks in the house
    if (S.mode === 'relax') rate = -3.2; else if (S.mode === 'hide') rate = -6.5; else if (!dad.moving && S.mode === 'play') rate -= 0.35;
    S.stress = Math.max(0, Math.min(100, S.stress + rate * (rate > 0 ? mult : 1) * dt));
    if (S.stress >= 100 && !S.over) endRun(false);
  }

  const EVENTS = [
    ['piper', 'WOOF! WOOF! WOOF!', 5], ['baby', 'EEEEEEE!', 6], ['wife', 'Could you just…?', 4], [null, '📱 Seven group chats. Seven.', 4],
    ['jake', '♪ (the bass starts up) ♪', 5], ['momo', '*CRASH*', 4],
  ];
  function chaos(dt) {
    S.evT -= dt; if (S.evT > 0 || S.mode === 'hide' || S.mode === 'mini') return;
    S.evT = rnd(22, 38) / (S.day === 1 ? 1 : 1.5);
    const inside = chickens.filter(isIndoor);
    if (inside.length && Math.random() < 0.6) { say(pick(inside), 'BAWK BAWK BAWK!', 2.4); S.stress = Math.min(100, S.stress + 6 * 0.8); return; }
    const [who, msg, v] = pick(EVENTS); if (who) say(who, msg, 2.6); else say(dad, msg, 2.8, 'think');
    S.stress = Math.min(100, S.stress + v * 0.8 * (S.mode === 'relax' ? 0.5 : 1));
  }

  // ---------------------------------------------------------------- rendering
  let W = 800, H = 400, DPR = 1, Z = 2, camX = 0, camY = 0;
  function resize() {
    DPR = window.devicePixelRatio || 1; W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    Z = Math.max(2, Math.round(H * DPR / (T * 9.5))) / DPR;  // integer device-pixel zoom keeps the pixel art crisp
    if (qs.has('zoom')) Z = +qs.get('zoom');
  }
  window.addEventListener('resize', resize); window.addEventListener('orientationchange', () => setTimeout(resize, 200));

  function wallSegments(x0, y0, x1, y1) {
    const segs = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x > 0 && Nav.roomAt[y][x] && Nav.roomAt[y][x - 1]) {
        const a = Nav.roomAt[y][x - 1], b = Nav.roomAt[y][x];
        if (a !== b && !Nav.edgeOpen(x - 1, y, x, y, false)) segs.push({ o: 'v', x, y, a, b });
      }
      if (y > 0 && Nav.roomAt[y][x] && Nav.roomAt[y - 1][x]) {
        const a = Nav.roomAt[y - 1][x], b = Nav.roomAt[y][x];
        if (a !== b && !Nav.edgeOpen(x, y - 1, x, y, false)) segs.push({ o: 'h', x, y, a, b });
      }
    }
    return segs;
  }
  function drawTile(k, x, y) { const a = Art.atlas()[k]; ctx.drawImage(Art.img.world, a[0], a[1], 32, 32, x * T, y * T, T, T); }
  function drawWorld(vx0, vy0, vx1, vy1, t) {
    const x0 = Math.max(0, tileOf(vx0)), y0 = Math.max(0, tileOf(vy0)), x1 = Math.min(MAPW - 1, tileOf(vx1)), y1 = Math.min(MAPH - 1, tileOf(vy1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const r = Nav.roomAt[y][x]; if (r) drawTile(ROOMS[r].floor, x, y); }
    ctx.fillStyle = 'rgba(0,0,0,.10)';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const r = Nav.roomAt[y][x]; if (r && !ROOMS[r].out && ((x + y) & 1)) ctx.fillRect(x * T, y * T, T, T); }
    for (const f of furn) if (f.floor && f.x < vx1 && f.x + f.w > vx0 && f.y < vy1 && f.y + f.h > vy0) Art.sprite(ctx, f.k, f.x, f.y);
    // walls & fences
    const A = Art.atlas();
    for (const s of wallSegments(x0, y0, x1, y1)) {
      const ra = ROOMS[s.a], rb = ROOMS[s.b], fence = (ra.out && rb.out) || s.a === 'CHICKEN_RUN' || s.b === 'CHICKEN_RUN';
      if (fence) {
        ctx.fillStyle = '#6b4a2b'; if (s.o === 'v') { ctx.fillRect(s.x * T - 2, s.y * T, 4, T); ctx.fillStyle = '#a47a48'; ctx.fillRect(s.x * T - 1, s.y * T, 1, T); } else { ctx.fillRect(s.x * T, s.y * T - 2, T, 4); ctx.fillStyle = '#a47a48'; ctx.fillRect(s.x * T, s.y * T - 2, T, 1); }
        continue;
      }
      const wk = (rb.wall || ra.wall || 't_wall'), a = A[wk];
      if (s.o === 'v') {
        ctx.drawImage(Art.img.world, a[0] + 8, a[1], 8, 32, s.x * T - 4, s.y * T, 8, T);
        ctx.fillStyle = '#2c2434'; ctx.fillRect(s.x * T - 5, s.y * T, 1, T); ctx.fillRect(s.x * T + 4, s.y * T, 1, T);
      } else {
        ctx.fillStyle = '#2c2434'; ctx.fillRect(s.x * T, s.y * T - 6, T, 6);
        ctx.drawImage(Art.img.world, a[0], a[1], 32, 14, s.x * T, s.y * T, T, 14);
        ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(s.x * T, s.y * T + 14, T, 3);
      }
    }
    for (const d of DOORS) {
      const dx = d.o === 'v' ? d.at * T : d.i * T, dy = d.o === 'v' ? d.i * T : d.at * T;
      if (dx < vx0 - T || dx > vx1 + T || dy < vy0 - T || dy > vy1 + T) continue;
      d.t += ((d.open ? 1 : 0) - d.t) * Math.min(1, dtNow * 12);
      drawDoor(d, dx, dy);
    }
  }
  let dtNow = 0.016;
  // Doors and gates are drawn procedurally: a panel that shrinks away as the leaf swings open.
  function drawDoor(d, x, y) {
    const k = d.t, gate = !!d.gate, wood = gate ? '#b8894f' : '#8a5a34', dark = gate ? '#5c3d1f' : '#2c2434', hi = gate ? '#d6aa6a' : '#a8744a';
    if (d.o === 'v') {
      // posts
      ctx.fillStyle = dark; ctx.fillRect(x - 3, y, 6, 3); ctx.fillRect(x - 3, y + T - 3, 6, 3);
      const ph = (T - 6) * (1 - k);
      if (ph > 1) { ctx.fillStyle = dark; ctx.fillRect(x - 7, y + 2, 14, ph + 2); ctx.fillStyle = wood; ctx.fillRect(x - 6, y + 3, 12, ph); ctx.fillStyle = hi; ctx.fillRect(x - 6, y + 3, 3, ph); ctx.fillStyle = dark; ctx.fillRect(x - 1, y + 3, 1, ph); if (ph > 12) { ctx.fillStyle = '#f0d27a'; ctx.fillRect(x + 2, y + 3 + ph / 2 - 1, 3, 3); } }
      if (k > 0.05) { const len = 22 * k; ctx.fillStyle = dark; ctx.fillRect(x, y + 1, len, 4); ctx.fillStyle = wood; ctx.fillRect(x, y + 2, len - 1, 2); }
    } else {
      ctx.fillStyle = dark; ctx.fillRect(x, y - 6, 3, 20); ctx.fillRect(x + T - 3, y - 6, 3, 20);
      const pw = (T - 6) * (1 - k);
      if (pw > 1) {
        ctx.fillStyle = dark; ctx.fillRect(x + 3, y - 5, pw, 18); ctx.fillStyle = wood; ctx.fillRect(x + 3, y - 4, pw, 16); ctx.fillStyle = hi; ctx.fillRect(x + 3, y - 4, pw, 2);
        ctx.fillStyle = dark; if (gate) { ctx.fillRect(x + 3, y + 1, pw, 1); ctx.fillRect(x + 3, y + 6, pw, 1); } else { ctx.fillRect(x + 3 + pw / 2, y - 3, 1, 14); }
        if (pw > 12) { ctx.fillStyle = '#f0d27a'; ctx.fillRect(x + 3 + pw - 5, y + 4, 2, 2); }
      }
      if (k > 0.05) { ctx.fillStyle = dark; ctx.fillRect(x + 3, y - 5, 4, 3 + 14 * k); ctx.fillStyle = wood; ctx.fillRect(x + 4, y - 4, 2, 2 + 14 * k); }
    }
  }

  function render(dt) {
    dtNow = dt;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#1a1420'; ctx.fillRect(0, 0, W, H);
    const vw = W / Z, vh = H / Z;
    const tx = Math.max(0, Math.min(MAPW * T - vw, dad.x - vw / 2)), ty = Math.max(0, Math.min(MAPH * T - vh, dad.y - 20 - vh / 2));
    camX += (tx - camX) * Math.min(1, dt * 7); camY += (ty - camY) * Math.min(1, dt * 7);
    if (S.first) { camX = tx; camY = ty; S.first = false; }
    ctx.save(); ctx.scale(Z, Z); ctx.translate(-Math.round(camX), -Math.round(camY));
    drawWorld(camX - 8, camY - 8, camX + vw + 8, camY + vh + 8, S.t);
    // y-sorted sprites
    const q = [];
    for (const f of furn) if (!f.floor) q.push({ y: f.y + f.h, d: () => Art.sprite(ctx, f.k, f.x, f.y) });
    for (const e of S.ents) q.push({ y: centre(e.ty) + 4, d: () => { Art.sprite(ctx, e.k, centre(e.tx) - 7, centre(e.ty) - 6); } });
    for (const c of chickens) q.push({ y: c.y, d: () => Art.animal(ctx, 'chicken', c.x, c.y, c.dir, c.moving, c.anim) });
    for (const n of npcs) q.push({ y: n.y, d: () => n.kind === 'animal' ? Art.animal(ctx, n.name, n.x, n.y, n.dir, n.moving, n.anim) : Art.person(ctx, n.name, n.x, n.y, n.dir, n.moving, n.anim) });
    q.push({ y: dad.y, d: () => {
      Art.person(ctx, 'dad', dad.x, dad.y, dad.dir, dad.moving, dad.anim);
      if (S.mode === 'relax') { ctx.fillStyle = '#cfe0ff'; ctx.font = 'bold 14px system-ui'; ctx.fillText('z', dad.x + 10, dad.y - 52 - Math.sin(S.t * 3) * 3); ctx.fillText('Z', dad.x + 18, dad.y - 62 - Math.sin(S.t * 3 + 1) * 3); }
    } });
    q.sort((a, b) => a.y - b.y); q.forEach(o => o.d());
    // task markers
    ctx.textAlign = 'center'; ctx.font = '20px system-ui';
    for (const t of S.tasks) {
      let p = null;
      if (t.type === 'toys' || t.type === 'poop') { const e = S.ents.find(e => e.task === t.type); if (e) p = { x: centre(e.tx), y: centre(e.ty) - 14 }; }
      else { const f = byId(t.spot); if (f) p = { x: f.x + f.w / 2, y: f.y - 6 }; }
      if (p) { const bob = Math.sin(S.t * 4 + t.born) * 3; ctx.fillStyle = 'rgba(20,14,28,.75)'; ctx.beginPath(); ctx.arc(p.x, p.y + bob - 7, 14, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(t.icon, p.x, p.y + bob); }
    }
    if (S.marker && S.marker.t > 0) { ctx.strokeStyle = `rgba(255,230,150,${S.marker.t})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(S.marker.x, S.marker.y + 8, 12 + (0.8 - S.marker.t) * 18, 6 + (0.8 - S.marker.t) * 9, 0, 0, 7); ctx.stroke(); S.marker.t -= dt; }
    ctx.restore();
    // vignette for stress / hiding
    const st = S.stress / 100;
    if (st > .55 || S.mode === 'hide') {
      const a = S.mode === 'hide' ? 0.88 : (st - .55) / .45 * .5, g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (S.mode === 'hide' ? .12 : .35), W / 2, H / 2, Math.max(W, H) * .75);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, S.mode === 'hide' ? `rgba(0,0,0,${a})` : `rgba(150,20,30,${a})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (S.mode !== 'mini' && !Mini.active()) drawBubbles(dt);
    if (S.mode === 'mini' || Mini.active()) Mini.draw(ctx, W, H);
  }

  // ---------------------------------------------------------------- HUD
  const hud = { bar: $('stressfill'), pct: $('stresspct'), clock: $('clock'), tasks: $('tasks') };
  // Speech bubbles hang above whoever is talking. If the speaker is off screen the line shows as a thought above Dad instead.
  function say(who, text, life = 3, kind = 'say') {
    if (typeof who === 'string') who = who === 'dad' ? dad : npcs.find(n => n.name === who) || dad;
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].who === who) bubbles.splice(i, 1);
    bubbles.push({ who, text, life, kind: who === dad ? kind : 'say', t: 0 });
  }
  function wrapText(txt, maxW) {
    const words = txt.split(' '), lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  const headH = m => m === dad || ['wife', 'jake', 'baby'].includes(m.name) ? (m.name === 'baby' ? 34 : 58) : m.name === 'chicken' ? 22 : 28;
  function drawBubbles(dt) {
    const placed = [], toScr = (wx, wy) => ({ x: (wx - Math.round(camX)) * Z, y: (wy - Math.round(camY)) * Z });
    ctx.font = '600 13px system-ui, -apple-system, sans-serif'; ctx.textBaseline = 'alphabetic';
    for (let i = bubbles.length - 1; i >= 0; i--) { bubbles[i].t += dt; if (bubbles[i].t > bubbles[i].life) bubbles.splice(i, 1); }
    const topMargin = 58;
    for (const b of bubbles) {
      let who = b.who, kind = b.kind, text = b.text;
      let p = toScr(who.x, who.y - headH(who) * 1);
      const off = p.x < 4 || p.x > W - 4 || p.y < topMargin - 20 || p.y > H;
      if (off) { who = dad; kind = 'think'; text = (NAMES[b.who.name] || '') + ': ' + b.text; p = toScr(dad.x, dad.y - headH(dad)); }
      const maxW = Math.min(220, W * 0.55), lines = wrapText(text, maxW), lw = Math.max(...lines.map(l => ctx.measureText(l).width)), lh = 16, pad = 8;
      const bw = lw + pad * 2, bh = lines.length * lh + pad * 2 - 2, tail = 8;
      let bx = Math.max(4, Math.min(W - bw - 4, p.x - bw / 2)), by = Math.max(topMargin, p.y - tail - bh - 2);
      for (let k = 0; k < 4; k++) { const hit = placed.find(r => bx < r.x + r.w + 2 && bx + bw + 2 > r.x && by < r.y + r.h + 2 && by + bh + 2 > r.y); if (!hit) break; by = hit.y - bh - 4; }
      by = Math.max(topMargin - 40, by); placed.push({ x: bx, y: by, w: bw, h: bh });
      const a = Math.min(1, b.t / 0.12, (b.life - b.t) / 0.35); ctx.globalAlpha = Math.max(0, a);
      const think = kind === 'think';
      ctx.fillStyle = think ? 'rgba(226,236,255,.96)' : 'rgba(255,255,255,.97)'; ctx.strokeStyle = think ? '#6d7fa8' : '#2c2434'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, think ? 12 : 8); ctx.fill(); ctx.stroke();
      const tx = Math.max(bx + 10, Math.min(bx + bw - 10, p.x));
      if (think) {
        ctx.beginPath(); ctx.arc(tx, by + bh + 4, 3.5, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(tx + (p.x > tx ? 2 : -2), by + bh + 10, 2, 0, 7); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(tx - 5, by + bh - 0.5); ctx.lineTo(tx, by + bh + tail); ctx.lineTo(tx + 5, by + bh - 0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.97)'; ctx.fillRect(tx - 4, by + bh - 2, 8, 3);
      }
      ctx.fillStyle = '#2c2434'; ctx.textAlign = 'left';
      lines.forEach((l, i) => ctx.fillText(l, bx + pad, by + pad + 11 + i * lh));
      ctx.globalAlpha = 1;
    }
  }
  function renderHUD() {
    hud.tasks.innerHTML = '';
    for (const t of S.tasks) {
      const b = document.createElement('button'); b.className = 'chip'; const age = S.t - t.born;
      if (age > 45) b.classList.add('old'); if (age > 90) b.classList.add('late');
      b.innerHTML = `<span class="ic">${t.icon}</span><span>${t.label}</span>`;
      b.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (S.mode === 'relax' || S.mode === 'hide') S.mode = 'play'; goTask(t.type); });
      hud.tasks.appendChild(b);
    }
  }
  function updateHUD() {
    const pc = Math.round(S.stress); hud.bar.style.width = pc + '%'; hud.pct.textContent = pc + '%';
    hud.bar.style.background = pc > 80 ? '#e0453a' : pc > 55 ? '#e8a23a' : '#6ec06e';
    const left = Math.max(0, DAY_LEN - S.t), m = Math.floor(left / 60), s = Math.floor(left % 60);
    // map the 5 min day onto a household day, 6pm-10pm style clock
    const clockMin = 16 * 60 + Math.floor(S.t / DAY_LEN * 5 * 60), hh = Math.floor(clockMin / 60) % 24, mm = clockMin % 60;
    hud.clock.textContent = `Day ${S.day} · ${hh}:${String(mm).padStart(2, '0')}`;
  }

  // ---------------------------------------------------------------- modal
  function modal(o) {
    const el = $('modal'); $('mportrait').src = o.portrait ? `assets/portraits/${o.portrait}.png` : ''; $('mportrait').style.display = o.portrait ? '' : 'none';
    $('mtitle').textContent = o.title; $('mtext').innerHTML = o.text; const bs = $('mbuttons'); bs.innerHTML = '';
    for (const b of o.buttons) { const e = document.createElement('button'); e.textContent = b.label; e.addEventListener('click', () => { el.classList.remove('on'); b.fn && b.fn(); }); bs.appendChild(e); }
    el.classList.add('on'); S.paused = true;
  }
  function closeModalState() { S.paused = false; }

  // ---------------------------------------------------------------- run control
  function startDay(day) {
    S.day = day; S.t = 0; S.tn = 0; S.mode = 'play'; S.over = false; S.paused = false; S.tasks = []; S.ents = []; S.hideCD = 0; S.doneCount = 0; S.failCount = 0;
    S.stress = day === 1 ? 18 : Math.min(40, S.stress * 0.5 + 10); S.first = true;
    S.timeline = TIMELINES[day].slice(); S.evT = 20;
    bubbles.length = 0;
    const lr = ROOMS.LIVING_ROOM; const st = Nav.nearestReachable(lr.x + 6, lr.y + 13, lr.x + 6, lr.y + 13) || { x: lr.x + 6, y: lr.y + 13 };
    dad.x = centre(st.x); dad.y = centre(st.y) + 8; dad.path = []; dad.onArrive = null; dad.dir = 'down'; dad.chk = null; dad.lastDoor = null;
    spawnNPCs(); renderHUD(); Mini.cancel(); document.body.classList.remove('mini');
  }
  function endRun(win) {
    S.over = true; S.mode = 'over'; Mini.cancel();
    const stats = `Chores done: <b>${S.doneCount}</b><br>Stress at the end: <b>${Math.round(S.stress)}%</b>`;
    if (win) {
      modal(S.day === 1
        ? { portrait: 'wife', title: 'Day 1 survived', text: `The kids are down. The house is… mostly standing.<br>${stats}<br><br><i>Day 2 gets worse.</i>`, buttons: [{ label: 'Start Day 2', fn: () => { startDay(2); } }, { label: 'Replay Day 1', fn: () => startDay(1) }] }
        : { portrait: 'dad', title: 'Day 2 survived!', text: `Somehow, you made it.<br>${stats}<br><br><i>Munty isn’t in this build yet. He will be.</i>`, buttons: [{ label: 'Play again', fn: () => startDay(1) }] });
    } else {
      modal({ portrait: 'dad', title: 'Overstimulated!', text: `Dad storms off to the shed.<br>${stats}`, buttons: [{ label: 'Try again', fn: () => startDay(S.day) }] });
    }
  }
  function intro() {
    modal({ portrait: 'dad', title: 'Overstimulated', text: 'Tap anywhere to walk. Tap chores, furniture or the list at the top right to get things done. Keep the stress bar under 100%.<br><br><b>Tap a door to open or close it.</b> Dogs, chooks and the baby can’t work a handle, and Momo follows you everywhere. Shut doors to keep them where they belong.<br><br>Couches and beds calm you. The ensuite toilet is the emergency exit.', buttons: [{ label: 'Let’s go', fn: () => { S.started = true; closeModalState(); } }] });
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const paused = S.paused || !S.started;
    if (!paused) {
      if (S.mode !== 'over') {
        const sp = S.speed || 1, d = dt * sp;
        S.t += d; S.hideCD = Math.max(0, S.hideCD - d);
        while (S.timeline.length && S.timeline[0][0] <= S.t) { addTask(S.timeline.shift()[1]); }
        if (S.mode === 'play' || S.mode === 'relax' || S.mode === 'hide') stepMover(dad, d);
        if (S.mode === 'mini') Mini.update(d);
        for (const n of npcs) updateNPC(n, d); for (const c of chickens) updateChicken(c, d);
        if (S.mode !== 'mini') { updateStress(d); chaos(d); } else S.stress += (0.32 + 0.16 * S.tasks.length) * d * (S.day === 1 ? 1 : 1.25);
        if (S.t >= DAY_LEN && !S.over) endRun(true);
        if (((S.t * 2) | 0) !== S.tn) { S.tn = (S.t * 2) | 0; renderHUD(); }
      }
    }
    updateHUD(); render(dt);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- input
  function pt(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); if (S.paused || !S.started) return; const p = pt(e);
    if (S.mode === 'mini') { Mini.pointer('down', p.x, p.y, W, H); canvas.setPointerCapture(e.pointerId); return; }
    tap(camX + p.x / Z, camY + p.y / Z);
  });
  canvas.addEventListener('pointermove', e => { if (S.mode === 'mini') { const p = pt(e); Mini.pointer('move', p.x, p.y, W, H); } });
  const up = e => { if (S.mode === 'mini') { const p = pt(e); Mini.pointer('up', p.x, p.y, W, H); } };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('visibilitychange', () => { last = performance.now(); });

  // ---------------------------------------------------------------- boot
  Art.init().then(() => {
    resize(); startDay(1); $('loading').remove();
    if (qs.has('autostart')) { S.started = true; $('modal').classList.remove('on'); } else intro();
    if (qs.has('speed')) S.speed = +qs.get('speed');
    window.__G = { Mini, S, dad, npcs, chickens, furn, Nav, DOORS, bubbles, say, useDoor, tap: (tx, ty) => tap(tx * T + 16, ty * T + 16), goTask, startDay, addTask, camera: () => ({ camX, camY, Z }) };
    requestAnimationFrame(frame);
  }).catch(err => { $('loading').textContent = 'Failed to load: ' + err.message; console.error(err); });
})();
