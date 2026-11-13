// Tap/drag mini-games used to finish chores. All run in a virtual 640x360 space (letterboxed by the caller).
'use strict';
const Mini = (() => {
  const VW = 640, VH = 360;
  let cur = null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const panel = (c, title, hint) => {
    c.fillStyle = 'rgba(14,10,20,0.88)'; c.fillRect(0, 0, VW, VH);
    c.fillStyle = '#f2d48a'; c.font = 'bold 22px system-ui, sans-serif'; c.textAlign = 'center'; c.fillText(title, VW / 2, 34);
    c.fillStyle = '#b8aebf'; c.font = '14px system-ui, sans-serif'; c.fillText(hint, VW / 2, 56);
  };
  const bar = (c, x, y, w, h, f, col) => { c.fillStyle = '#2a2231'; c.fillRect(x, y, w, h); c.fillStyle = col; c.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h); c.strokeStyle = '#6b5a78'; c.strokeRect(x + .5, y + .5, w - 1, h - 1); };

  // ---- dishes: scrub back and forth over each plate
  const scrub = done => {
    const plates = [{ x: 170, y: 200 }, { x: 320, y: 200 }, { x: 470, y: 200 }].map(p => ({ ...p, p: 0, dirt: Array.from({ length: 16 }, () => ({ a: rnd(0, 6.28), r: rnd(6, 52), s: rnd(5, 12) })) }));
    let i = 0, last = null, bubbles = [];
    return {
      title: 'Wash the dishes', hint: 'Scrub each plate: rub your finger back and forth',
      pointer(t, x, y) {
        if (t === 'up') { last = null; return; }
        const p = plates[i]; if (!p) return;
        if (Math.hypot(x - p.x, y - p.y) < 62 && last) {
          p.p = Math.min(1, p.p + Math.hypot(x - last.x, y - last.y) * 0.0042);
          if (Math.random() < .5) bubbles.push({ x, y, r: rnd(3, 8), l: 1 });
          if (p.p >= 1) { i++; if (i >= plates.length) done(true, 1); }
        }
        last = { x, y };
      },
      update(dt) { bubbles.forEach(b => { b.l -= dt * 1.4; b.y -= dt * 14; }); bubbles = bubbles.filter(b => b.l > 0); },
      draw(c) {
        plates.forEach((p, k) => {
          c.fillStyle = k < i ? '#f4f7fa' : '#e8ecf0'; c.beginPath(); c.arc(p.x, p.y, 62, 0, 7); c.fill();
          c.strokeStyle = '#7d8fa0'; c.lineWidth = 4; c.stroke(); c.fillStyle = '#d4dbe2'; c.beginPath(); c.arc(p.x, p.y, 42, 0, 7); c.fill();
          if (k >= i) for (const d of p.dirt) { c.fillStyle = `rgba(104,72,34,${(1 - p.p) * .9})`; c.beginPath(); c.arc(p.x + Math.cos(d.a) * d.r, p.y + Math.sin(d.a) * d.r, d.s * (1 - p.p * .5), 0, 7); c.fill(); }
          if (k === i) bar(c, p.x - 50, p.y + 78, 100, 10, p.p, '#6ec6ff');
          if (k < i) { c.fillStyle = '#7de08d'; c.font = 'bold 30px system-ui'; c.fillText('✓', p.x, p.y + 10); }
        });
        bubbles.forEach(b => { c.strokeStyle = `rgba(190,235,255,${b.l})`; c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.stroke(); });
      },
    };
  };

  // ---- dog bowls: hold to pour, release inside the green band
  const pour = done => {
    let bowl = 0, level = 0, holding = false, hits = 0, msg = '', msgT = 0, fall = [];
    const zone = () => [0.68 + bowl * 0.04, 0.86 + bowl * 0.04];
    return {
      title: 'Feed the dogs', hint: 'Hold to pour, let go in the green band',
      pointer(t) {
        if (t === 'down') { holding = true; level = 0; }
        if (t === 'up' && holding) {
          holding = false; const [a, b] = zone();
          if (level >= a && level <= b) { hits++; msg = 'Perfect!'; msgT = 1; bowl = hits; if (hits >= 2) done(true, 1); }
          else { msg = level < a ? 'Not enough…' : 'Spilled!'; msgT = 1; }
          level = 0;
        }
      },
      update(dt) {
        if (holding) { level = Math.min(1.05, level + dt * 0.55); if (Math.random() < .6) fall.push({ x: 320 + rnd(-8, 8), y: 90, l: 1 }); }
        fall.forEach(f => { f.y += 300 * dt; f.l -= dt; }); fall = fall.filter(f => f.l > 0 && f.y < 250); msgT -= dt;
      },
      draw(c) {
        const [a, b] = zone();
        c.fillStyle = '#3a3040'; c.fillRect(260, 100, 120, 14); // scoop
        c.fillStyle = '#9b6a3b'; fall.forEach(f => c.fillRect(f.x, f.y, 6, 6));
        c.fillStyle = bowl % 2 ? '#dc7878' : '#78aadc'; c.beginPath(); c.ellipse(320, 270, 90, 36, 0, 0, 7); c.fill();
        c.fillStyle = '#4a3a30'; c.beginPath(); c.ellipse(320, 262, 70, 22, 0, 0, 7); c.fill();
        c.fillStyle = '#9b6a3b'; c.beginPath(); c.ellipse(320, 262 - level * 22, 70 * Math.min(1, .35 + level), 22 * Math.min(1, .35 + level * .8), 0, 0, 7); c.fill();
        c.fillStyle = '#2a2231'; c.fillRect(500, 90, 34, 220); c.fillStyle = 'rgba(110,220,130,.55)'; c.fillRect(500, 310 - b * 220, 34, (b - a) * 220);
        c.fillStyle = '#f2d48a'; c.fillRect(496, 310 - Math.min(1, level) * 220 - 2, 42, 4);
        c.fillStyle = '#b8aebf'; c.font = '14px system-ui'; c.fillText(`Bowl ${Math.min(2, hits + 1)} of 2`, 320, 330);
        if (msgT > 0) { c.fillStyle = msg === 'Perfect!' ? '#7de08d' : '#ff9a8a'; c.font = 'bold 26px system-ui'; c.fillText(msg, 320, 160); }
      },
    };
  };

  // ---- toys: drag each into the box
  const tidy = done => {
    const cols = ['#e65050', '#5096e6', '#f0c83c', '#6ec06e'];
    const toys = cols.map((col, k) => ({ x: rnd(90, 420), y: rnd(110, 290), col, in: false, k }));
    let drag = null; const box = { x: 520, y: 230, r: 60 };
    return {
      title: 'Tidy the toys', hint: 'Drag every toy into the box',
      pointer(t, x, y) {
        if (t === 'down') { let best = null, bd = 48; for (const o of toys) if (!o.in) { const d = Math.hypot(o.x - x, o.y - y); if (d < bd) { bd = d; best = o; } } drag = best; }
        else if (t === 'move' && drag) { drag.x = x; drag.y = y; }
        else if (t === 'up' && drag) {
          if (Math.hypot(drag.x - box.x, drag.y - box.y) < box.r) { drag.in = true; if (toys.every(o => o.in)) done(true, 1); }
          drag = null;
        }
      },
      update() {},
      draw(c) {
        c.fillStyle = '#7a4f2b'; c.fillRect(box.x - 60, box.y - 30, 120, 80); c.fillStyle = '#9a6a3b'; c.fillRect(box.x - 60, box.y - 30, 120, 18);
        c.strokeStyle = '#2a1a0a'; c.lineWidth = 3; c.strokeRect(box.x - 60, box.y - 30, 120, 80);
        toys.forEach(o => {
          if (o.in) return;
          c.fillStyle = o.col; c.fillRect(o.x - 18, o.y - 14, 36, 30); c.fillStyle = '#f8f0d0'; c.fillRect(o.x - 9, o.y - 26, 18, 14);
          c.strokeStyle = '#201818'; c.lineWidth = 2; c.strokeRect(o.x - 18, o.y - 14, 36, 30);
        });
        c.fillStyle = '#b8aebf'; c.font = '14px system-ui'; c.fillText(`${toys.filter(o => o.in).length} / ${toys.length} tidied`, 320, 336);
      },
    };
  };

  // ---- patio poop: tap before they fade
  const scoop = done => {
    let t0 = 0, spawned = 0, got = 0, missed = 0, items = [], next = 0.4; const TOTAL = 7;
    return {
      title: 'Scoop the patio', hint: 'Tap each pile before it fades',
      pointer(t, x, y) {
        if (t !== 'down') return;
        for (const o of items) if (!o.dead && Math.hypot(o.x - x, o.y - y) < 38) { o.dead = true; got++; o.pop = .3; break; }
      },
      update(dt) {
        t0 += dt; next -= dt;
        if (spawned < TOTAL && next <= 0) { spawned++; next = rnd(.7, 1.2); items.push({ x: rnd(70, 570), y: rnd(100, 300), l: 2.0, max: 2.0, dead: false }); }
        for (const o of items) { if (o.dead) o.pop -= dt; else { o.l -= dt; if (o.l <= 0 && !o.gone) { o.gone = true; missed++; } } }
        items = items.filter(o => !o.gone && !(o.dead && o.pop <= 0));
        if (spawned >= TOTAL && items.length === 0) done(got >= 5, got / TOTAL);
      },
      draw(c) {
        for (const o of items) {
          if (o.dead) { c.fillStyle = `rgba(130,230,150,${o.pop * 3})`; c.font = 'bold 22px system-ui'; c.fillText('✓', o.x, o.y); continue; }
          c.fillStyle = '#6e461e'; c.beginPath(); c.ellipse(o.x, o.y + 6, 24, 14, 0, 0, 7); c.fill(); c.fillStyle = '#84562a'; c.beginPath(); c.ellipse(o.x, o.y - 4, 16, 11, 0, 0, 7); c.fill();
          c.strokeStyle = o.l < .7 ? '#ff6a5a' : '#f2d48a'; c.lineWidth = 4; c.beginPath(); c.arc(o.x, o.y, 34, -1.57, -1.57 + 6.283 * (o.l / o.max)); c.stroke();
        }
        c.fillStyle = '#b8aebf'; c.font = '14px system-ui'; c.fillText(`Scooped ${got}   Missed ${missed}   (need 5 of ${TOTAL})`, 320, 336);
      },
    };
  };

  // ---- baby: tap as the ring meets the circle
  const lullaby = done => {
    let ring = 0, hits = 0, fusses = 0, msg = '', msgT = 0; const DUR = 1.15;
    return {
      title: 'Settle the baby', hint: 'Tap when the ring meets the circle',
      pointer(t) {
        if (t !== 'down') return;
        const r = 130 - 90 * (ring / DUR);
        if (Math.abs(r - 40) < 14) { hits++; msg = 'Shh… good'; msgT = .8; ring = 0; if (hits >= 5) done(true, 1); }
        else { fusses++; msg = 'Waaah!'; msgT = .8; ring = 0; if (fusses >= 3) done(false, 0); }
      },
      update(dt) { ring += dt; if (ring > DUR) { ring = 0; fusses += .5; msg = 'Too slow…'; msgT = .6; if (fusses >= 3) done(false, 0); } msgT -= dt; },
      draw(c) {
        const r = 130 - 90 * (ring / DUR);
        c.fillStyle = '#ffd9a0'; c.beginPath(); c.arc(320, 190, 30, 0, 7); c.fill(); c.fillStyle = '#e08840'; c.beginPath(); c.arc(320, 218, 26, 0, Math.PI); c.fill();
        c.fillStyle = '#201818'; c.fillRect(310, 186, 4, 4); c.fillRect(326, 186, 4, 4);
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.beginPath(); c.arc(320, 190, 40, 0, 7); c.stroke();
        c.strokeStyle = Math.abs(r - 40) < 14 ? '#7de08d' : '#f2d48a'; c.lineWidth = 5; c.beginPath(); c.arc(320, 190, r, 0, 7); c.stroke();
        for (let k = 0; k < 5; k++) { c.fillStyle = k < hits ? '#7de08d' : '#3a3040'; c.beginPath(); c.arc(260 + k * 30, 320, 9, 0, 7); c.fill(); }
        for (let k = 0; k < 3; k++) { c.fillStyle = k < Math.floor(fusses) ? '#ff7a6a' : '#3a3040'; c.beginPath(); c.arc(530 + k * 24, 320, 7, 0, 7); c.fill(); }
        if (msgT > 0) { c.fillStyle = msg.startsWith('Shh') ? '#7de08d' : '#ff9a8a'; c.font = 'bold 22px system-ui'; c.fillText(msg, 320, 110); }
      },
    };
  };

  const MAKERS = { dishes: scrub, dogs: pour, toys: tidy, poop: scoop, baby: lullaby };
  const fit = (W, H) => { const k = Math.min(W / VW, H / VH); return { k, ox: (W - VW * k) / 2, oy: (H - VH * k) / 2 }; };

  return {
    active: () => !!cur,
    start(type, onDone) {
      let finished = false;
      const fin = (ok, q) => {
        if (finished) return; finished = true; g.result = ok ? 'Done!' : 'Failed…';
        setTimeout(() => { if (cur === g) cur = null; onDone(ok, q); }, 600);
      };
      const g = MAKERS[type](fin);
      g.result = ''; g.__done = fin; cur = g;
    },
    update(dt) { if (cur && !cur.result) cur.update(dt); },
    draw(ctx, W, H) {
      if (!cur) return;
      const { k, ox, oy } = fit(W, H);
      ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k); ctx.beginPath(); ctx.rect(0, 0, VW, VH); ctx.clip();
      panel(ctx, cur.title, cur.hint); cur.draw(ctx);
      if (cur.result) { ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, 0, VW, VH); ctx.fillStyle = cur.result === 'Done!' ? '#7de08d' : '#ff8a7a'; ctx.font = 'bold 44px system-ui'; ctx.textAlign = 'center'; ctx.fillText(cur.result, VW / 2, VH / 2 + 12); }
      ctx.restore();
    },
    pointer(type, sx, sy, W, H) {
      if (!cur || cur.result) return;
      const { k, ox, oy } = fit(W, H);
      cur.pointer(type, (sx - ox) / k, (sy - oy) / k);
    },
    cancel() { cur = null; },
    peek: () => cur,
  };
})();
