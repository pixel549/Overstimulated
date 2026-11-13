// Asset loading and sprite drawing (LPC Revised art, baked by mobile/tools/bake.py).
'use strict';
const Art = (() => {
  const img = {}; let atlas = {};
  const load = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('failed ' + src)); i.src = src; });
  const CHARS = ['dad', 'wife', 'jake', 'baby'];
  async function init() {
    const jobs = [];
    atlas = await (await fetch('assets/world.json')).json();
    jobs.push(load('assets/world.png').then(i => img.world = i));
    for (const c of CHARS) {
      jobs.push(load(`assets/chars/${c}_walk.png`).then(i => img[c + '_walk'] = i));
      jobs.push(load(`assets/chars/${c}_idle.png`).then(i => img[c + '_idle'] = i).catch(() => img[c + '_idle'] = null));
    }
    for (const a of ['momo', 'piper', 'chicken']) jobs.push(load(`assets/chars/${a}.png`).then(i => img[a] = i));
    for (const p of ['dad', 'wife', 'jake', 'baby', 'momo', 'piper']) jobs.push(load(`assets/portraits/${p}.png`).then(i => img['p_' + p] = i).catch(() => {}));
    await Promise.all(jobs);
  }
  const size = k => atlas[k] ? { w: atlas[k][2], h: atlas[k][3] } : { w: 32, h: 32 };
  function sprite(ctx, k, x, y, flip) {
    const a = atlas[k]; if (!a) return;
    if (flip) { ctx.save(); ctx.translate(x + a[2], y); ctx.scale(-1, 1); ctx.drawImage(img.world, a[0], a[1], a[2], a[3], 0, 0, a[2], a[3]); ctx.restore(); }
    else ctx.drawImage(img.world, a[0], a[1], a[2], a[3], x, y, a[2], a[3]);
  }
  // LPC sheets: rows are up(0) left(1) down(2) right(3); walk = 8 frames of 64px, idle = 3 (baby idle = 1)
  const DIRROW = { up: 0, left: 1, down: 2, right: 3 };
  function person(ctx, name, x, y, dir, moving, t) {
    const row = DIRROW[dir] ?? 2;
    let sheet = moving ? img[name + '_walk'] : (img[name + '_idle'] || img[name + '_walk']);
    let frame = 0;
    if (moving) frame = Math.floor(t * 11) % 8;
    else if (img[name + '_idle']) { const n = Math.max(1, Math.floor(img[name + '_idle'].width / 64)); frame = Math.floor(t * 2.2) % n; }
    ctx.drawImage(sheet, frame * 64, row * 64, 64, 64, Math.round(x - 32), Math.round(y - 58), 64, 64);
  }
  function animal(ctx, name, x, y, dir, moving, t) {
    const im = img[name], fw = name === 'chicken' ? 16 : 32, fh = name === 'chicken' ? 16 : 24;
    const frame = moving ? Math.floor(t * 8) % 2 : 2;
    const sc = name === 'chicken' ? 1 : 1;
    if (dir === 'left') { ctx.save(); ctx.translate(Math.round(x + fw / 2), Math.round(y - fh)); ctx.scale(-1, 1); ctx.drawImage(im, frame * fw, 0, fw, fh, 0, 0, fw * sc, fh * sc); ctx.restore(); }
    else ctx.drawImage(im, frame * fw, 0, fw, fh, Math.round(x - fw / 2), Math.round(y - fh), fw * sc, fh * sc);
  }
  return { init, img, size, sprite, person, animal, atlas: () => atlas };
})();
