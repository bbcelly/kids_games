// Browser play-test: drives the real page in headless Chromium with mouse and keyboard.
//   node tools/playtest.js            (starts its own server on a spare port)
//   CHROME=/path/to/chromium SHOTS=dir node tools/playtest.js
// Exits non-zero if a step fails or the page logs an error. Screenshots go to test/shots/.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync, cpSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = process.env.SHOTS || path.join(ROOT, 'test', 'shots');
const CHROME = process.env.CHROME || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync);
const PORT = 8000 + Math.floor(Math.random() * 900) + 90;
const MODS = path.join(SHOTS, 'mods-for-test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// a small .zip writer (deflate), to test uploading a mod the way a player would
function zip(files) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const locals = [], central = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text), comp = deflateRawSync(data), nameB = Buffer.from(name), crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(8, 8); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nameB.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(8, 10); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nameB.length, 28); c.writeUInt32LE(offset, 42);
    locals.push(h, nameB, comp); central.push(c, nameB);
    offset += 30 + nameB.length + comp.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

if (!CHROME) { console.error('No Chromium found; set CHROME=/path/to/browser'); process.exit(2); }
rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(MODS, { recursive: true });

const server = spawn(process.execPath, [path.join(ROOT, 'server', 'server.js')], { env: { ...process.env, PORT: String(PORT), MODS_DIR: MODS }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => { server.stdout.on('data', (d) => { if (String(d).includes('running')) res(); }); server.on('exit', () => rej(new Error('server did not start'))); });

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-gpu', '--mute-audio', '--window-size=1440,900'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const problems = [];
page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
page.on('pageerror', (e) => problems.push('pageerror: ' + (e.stack || e.message || e)));
page.on('requestfailed', (r) => problems.push('request failed: ' + r.url()));
page.on('dialog', (d) => d.accept());

let n = 0, failed = 0;
const shot = async (name) => { await page.screenshot({ path: path.join(SHOTS, `${String(++n).padStart(2, '0')}-${name}.png`) }); };
async function check(name, fn) {
  try { await fn(); console.log('ok   - ' + name); }
  catch (err) { failed++; console.log(`FAIL - ${name}\n       ${String(err.message || err).split('\n')[0]}`); await shot('FAIL-' + name.replace(/\W+/g, '_').slice(0, 40)).catch(() => {}); }
}
const assert = (c, msg) => { if (!c) throw new Error(msg || 'assertion failed'); };
const ev = (fn, ...a) => page.evaluate(fn, ...a);
// menus re-render asynchronously, so a button can be replaced between "found" and "clicked": retry
const clickM = async (act) => {
  for (let i = 0; ; i++) {
    try { await page.waitForSelector(`[data-m="${act}"]`, { timeout: 5000 }); await page.click(`[data-m="${act}"]`); await sleep(60); return; }
    catch (err) { if (i >= 3) throw err; await sleep(150); }
  }
};
const world = (fn, ...a) => page.evaluate(new Function('...a', `const app = window.__biofilm, w = app.world; return (${fn.toString()})(w, app, ...a);`), ...a);
// screen position of the middle of a tile
const at = (x, y) => world((w, app, x, y) => { const [sx, sy] = app.renderer.toScreen(x + 0.5, y + 0.5); return { x: sx, y: sy }; }, x, y);
const clickTile = async (x, y, o) => { const p = await at(x, y); await page.mouse.click(p.x, p.y, o); };
const pick = async (type) => {
  // open the tab that holds the building, then press its button
  const group = await world((w, app, type) => w.reg.entities[type].group, type);
  await page.evaluate((g) => document.querySelector(`#tabs [data-act="tab:${g}"]`)?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })), group);
  await page.evaluate((t) => document.querySelector(`#builds [data-id="${t}"]`).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })), type);
  assert(await world((w, app) => app.tool?.type) === type, `tool ${type} not selected`);
};
// run the simulation forward inside the page (faster than waiting in real time)
const forward = (sec) => page.evaluate(async (sec) => { const { step } = await import('./sim/sim.js'); const w = window.__biofilm.world; for (let i = 0; i < sec * 60 && !w.won && !w.lost; i++) step(w); }, sec);

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

  await check('main menu appears in Czech', async () => {
    await page.waitForSelector('#menu .mcard h1');
    assert(await ev(() => document.querySelector('#menu h1').textContent) === 'Biofilm');
    assert((await ev(() => document.querySelector('[data-m="go:campaign"]').textContent)).includes('Kampaň'));
    await shot('menu');
  });

  await check('campaign list shows 8 missions, only the first unlocked', async () => {
    await clickM('go:campaign');
    await page.waitForSelector('.missions .mis');
    const r = await ev(() => ({ all: document.querySelectorAll('.mis').length, locked: document.querySelectorAll('.mis.locked').length }));
    assert(r.all === 8 && r.locked === 7, JSON.stringify(r));
    await shot('campaign');
  });

  await check('mission 1 starts with an intro and the HUD', async () => {
    await clickM('mission:m1');
    await page.waitForSelector('#modal .dialog');
    await shot('m1-intro');
    await clickM('resume');
    assert(await world((w) => w.missionId) === 'm1');
    assert(await ev(() => !document.getElementById('hud').classList.contains('hidden')));
    await sleep(400);
    await shot('m1-start');
  });

  let dep;
  await check('gathering glucose by hand (hold the mouse on a deposit)', async () => {
    dep = await world((w) => { const c = w.core; let best = null; for (let i = 0; i < w.res.length; i++) if (w.res[i] && w.film[i]) { const x = i % w.w, y = (i / w.w) | 0, d = Math.hypot(x - c.x, y - c.y); if (!best || d < best.d) best = { x, y, d }; } return best; });
    const p = await at(dep.x, dep.y);
    const before = await world((w) => w.inv.glucose);
    await page.mouse.move(p.x, p.y); await page.mouse.down(); await sleep(1500); await page.mouse.up();
    const after = await world((w) => w.inv.glucose);
    assert(after >= before + 4, `gathered ${after - before}`);
  });

  let ab;
  await check('placing an absorber with the mouse, rotating with R', async () => {
    await pick('absorber');
    ab = await world((w) => { for (let y = 0; y < w.h; y++) for (let x = w.core.x + 5; x < w.w; x++) { if (w.canPlace('absorber', x, y).ok && w.res[y * w.w + x] && w.res[y * w.w + x + 1] && y > w.core.y && y < w.core.y + 2) return { x, y }; } return null; });
    assert(ab, 'no spot');
    const p = await at(ab.x, ab.y);
    await page.mouse.move(p.x, p.y);
    await page.keyboard.press('KeyR'); await page.keyboard.press('KeyR'); // face west, towards the Core
    await sleep(100); await shot('ghost');
    await page.mouse.click(p.x, p.y);
    const e = await world((w, app, x, y) => { const e = w.entAt(x, y); return e && { type: e.type, dir: e.dir }; }, ab.x, ab.y);
    assert(e && e.type === 'absorber' && e.dir === 2, JSON.stringify(e));
    await page.keyboard.press('KeyQ');
    assert(await world((w, app) => app.tool) === null, 'Q should put the tool away');
  });

  await check('dragging a pathway from the absorber to the Core', async () => {
    await pick('belt');
    const core = await world((w) => ({ x: w.core.x, y: w.core.y }));
    const a = await at(ab.x - 1, ab.y), b = await at(core.x + 4, ab.y);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 }); await page.mouse.up();
    await page.keyboard.press('Escape');
    const r = await world((w, app, x0, x1, y) => { let n = 0, west = 0; for (let x = x1; x <= x0; x++) { const e = w.entAt(x, y); if (e?.type === 'belt') { n++; if (e.dir === 2) west++; } } return { n, west, want: x0 - x1 + 1 }; }, ab.x - 1, core.x + 4, ab.y);
    assert(r.n === r.want && r.west === r.want, JSON.stringify(r));
    await forward(40);
    assert(await world((w) => w.stats.produced.glucose) > 10, 'absorber is not producing');
    assert(await world((w) => w.objDone.absorber && w.objDone.belt), 'objectives not ticked');
    await sleep(300); await shot('m1-line');
  });

  await check('fermentor: placing, inspector, recipe shown', async () => {
    await pick('fermentor');
    const f = await world((w) => { const c = w.core; return { x: c.x - 3, y: c.y + 1 }; });
    await clickTile(f.x, f.y);
    await page.keyboard.press('Escape');
    assert(await world((w, app, x, y) => w.entAt(x, y)?.type, f.x, f.y) === 'fermentor', 'not placed');
    await clickTile(f.x, f.y);
    await page.waitForSelector('#inspector:not(.hidden)');
    assert(await world((w, app) => app.sel?.recipe) === 'atp', 'single recipe should be preselected');
    await shot('inspector');
    // right mouse button dismantles and refunds
    const before = await world((w) => w.inv.glucose);
    await clickTile(f.x, f.y, { button: 'right' });
    assert(await world((w, app, x, y) => w.entAt(x, y), f.x, f.y) === null, 'not dismantled');
    assert(await world((w) => w.inv.glucose) === before + 20, 'no refund');
  });

  await check('camera: wheel zoom and keyboard pan', async () => {
    const c0 = await world((w, app) => ({ ...app.renderer.cam }));
    await page.mouse.move(700, 450); await page.mouse.wheel({ deltaY: -300 });
    await page.keyboard.down('KeyD'); await sleep(300); await page.keyboard.up('KeyD');
    const c1 = await world((w, app) => ({ ...app.renderer.cam }));
    assert(c1.px > c0.px && c1.x > c0.x, JSON.stringify([c0, c1]));
    await page.mouse.wheel({ deltaY: 300 });
  });

  await check('pause, speed and the game menu', async () => {
    await page.keyboard.press('Space');
    const t0 = await world((w) => w.tick); await sleep(300);
    assert(await world((w) => w.tick) === t0, 'game runs while paused');
    await page.keyboard.press('Space');
    await page.keyboard.press('Equal');
    assert(await world((w, app) => app.speed) === 2);
    await page.keyboard.press('Escape');
    await page.waitForSelector('#modal [data-m="save"]');
    await shot('game-menu');
    await clickM('resume');
  });

  await check('saving, leaving and loading restores the colony', async () => {
    const before = await world((w) => ({ tick: w.tick, ents: w.list.length, glucose: w.inv.glucose }));
    await page.keyboard.down('Control'); await page.keyboard.press('KeyS'); await page.keyboard.up('Control');
    await sleep(400);
    await page.keyboard.press('Escape'); await clickM('quit');
    await page.waitForSelector('#menu [data-m="go:load"]');
    await clickM('go:load');
    await page.waitForSelector('.saves .save');
    await shot('saves');
    const names = await ev(() => [...document.querySelectorAll('.saves .save b')].map(b => b.textContent));
    assert(names.includes('První kapka'), names.join());
    await page.evaluate(() => [...document.querySelectorAll('.saves .save')].find(s => s.querySelector('b').textContent === 'První kapka').querySelector('[data-m^="load:"]').click());
    await page.waitForFunction(() => window.__biofilm.world);
    const after = await world((w) => ({ tick: w.tick, ents: w.list.length, glucose: w.inv.glucose }));
    assert(after.ents === before.ents && after.tick >= before.tick && after.tick - before.tick < 600, JSON.stringify([before, after]));
  });

  await check('finishing mission 1 shows the win dialog and unlocks mission 2', async () => {
    // build the rest the way a player would: a second absorber feeding a fermentor
    const plan = await world((w) => {
      const c = w.core;
      for (let y = c.y + 2; y < c.y + 6; y++) for (let x = c.x + 6; x < w.w - 3; x++) {
        let res = 0; for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (w.res[(y + j) * w.w + x + i]) res++;
        if (res >= 3 && w.canPlace('absorber', x, y).ok) return { x, y, cx: c.x, cy: c.y };
      }
      return null;
    });
    assert(plan, 'no second absorber spot');
    await pick('absorber');
    let p = await at(plan.x, plan.y); await page.mouse.move(p.x, p.y);
    await page.keyboard.press('KeyR'); await page.keyboard.press('KeyR'); await page.keyboard.press('KeyR'); // absorber faced west; R once more: north... make it face south
    await world((w, app) => { app.tool.dir = 1; });
    await page.mouse.click(p.x, p.y);
    // pathway: down from the absorber, then west under the Core to a fermentor that faces north into the Core
    const by = plan.cy + 5;
    await pick('belt');
    let a = await at(plan.x, plan.y + 2), b = await at(plan.x, by), c2 = await at(plan.cx + 3, by);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.move(c2.x, c2.y, { steps: 14 }); await page.mouse.up();
    await pick('fermentor');
    await world((w, app) => { app.tool.dir = 3; });
    await clickTile(plan.cx + 1, by - 1); // 2x2 just under the Core, facing north into it
    await page.keyboard.press('Escape');
    const got = await world((w, app, x, y) => { const e = w.entAt(x, y); return e && { type: e.type, dir: e.dir, recipe: e.recipe }; }, plan.cx + 1, by);
    assert(got && got.type === 'fermentor', 'fermentor missing: ' + JSON.stringify(got));
    await sleep(200); await shot('m1-factory');
    await forward(400);
    await sleep(500);
    assert(await world((w) => w.won), 'mission not won: ' + JSON.stringify(await world((w) => ({ done: w.objDone, del: w.stats.delivered }))));
    await page.waitForSelector('#modal [data-m^="next:"]');
    await shot('m1-won');
    assert(await ev(() => JSON.parse(localStorage.getItem('biofilm.campaign')).m1.done) === true);
    await clickM('next:m2');
    await page.waitForSelector('#modal [data-m="resume"]');
    await clickM('resume');
    assert(await world((w) => w.missionId) === 'm2');
  });

  await check('mutation tree opens with T, research can be started', async () => {
    await page.keyboard.press('Escape'); await clickM('quit');
    await page.waitForSelector('[data-m="go:free"]'); await clickM('go:free');
    await page.waitForSelector('[data-c="seed"]');
    await shot('freeplay-setup');
    await clickM('mission:free'); await clickM('resume');
    await sleep(300); await shot('free-start');
    await page.keyboard.press('KeyT');
    await page.waitForSelector('.techdlg .tech');
    const cnt = await ev(() => ({ all: document.querySelectorAll('.tech').length, done: document.querySelectorAll('.tech.done').length, avail: document.querySelectorAll('.tech.avail').length, links: document.querySelectorAll('.links path').length }));
    assert(cnt.all >= 30 && cnt.done === 4 && cnt.avail === 6 && cnt.links > 30, JSON.stringify(cnt));
    await page.evaluate(() => document.querySelector('.tech[data-id="photosynthesis"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.evaluate(() => document.querySelector('[data-tt="go"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    assert(await world((w) => w.research) === 'photosynthesis');
    await sleep(200); await shot('tech-tree');
    await page.keyboard.press('KeyT');
    assert(await ev(() => document.getElementById('modal').classList.contains('hidden')), 'T should close the tree');
  });

  await check('a busy late-game colony renders (immune wave, fluids, towers)', async () => {
    await page.evaluate(async () => {
      const app = window.__biofilm, { createWorld, step } = await import('./sim/sim.js'), { setRecipe } = await import('./sim/kinds.js');
      const w = createWorld(app.reg, { mission: 'm8' });
      for (const id in app.reg.items) w.inv[id] = 9000;
      const c = w.core;
      const B = (t, x, y, d = 0) => w.build(t, x, y, d);
      for (let i = 0; i < 4; i++) B('turret', c.x + 7, c.y - 4 + i * 3);
      B('sprayer', c.x + 10, c.y); B('cleaner', c.x + 10, c.y + 3);
      for (let i = 0; i < 8; i++) B('wall', c.x + 11, c.y - 2 + i);
      const r = B('ribosome', c.x - 4, c.y, 0); setRecipe(w, r, 'membrane'); B('pilus', c.x - 1, c.y, 2); B('pilus', c.x - 1, c.y + 1, 0);
      const f = B('fermentor', c.x + 5, c.y, 2); setRecipe(w, f, 'atp'); B('pilus', c.x + 4, c.y, 0); B('pilus', c.x + 4, c.y + 1, 2);
      B('lab', c.x, c.y - 4, 1); B('generator', c.x - 4, c.y + 5); B('solar', c.x - 7, c.y + 5); B('accumulator', c.x - 7, c.y + 2);
      B('vacuole', c.x - 7, c.y - 2); B('respirator', c.x + 1, c.y + 6); B('splitter', c.x + 5, c.y + 5); B('tank', c.x - 4, c.y - 4);
      for (let i = 0; i < 6; i++) B('fastbelt', c.x + 6 + i, c.y + 5, 0);
      B('tunnel', c.x + 5, c.y + 7, 0); B('tunnel', c.x + 8, c.y + 7, 0); B('belt', c.x + 4, c.y + 7, 0); B('belt', c.x + 9, c.y + 7, 0);
      w.threat.next = w.tick + 60; w.threat.base = 9;
      for (let i = 0; i < 60 * 48; i++) step(w);
      app.enter(w);
      app.showTox = true;
    });
    await sleep(600);
    const st = await world((w) => ({ enemies: w.enemies.length, ents: w.list.length, lost: w.lost }));
    assert(st.ents >= 25 && st.enemies > 0 && !st.lost, JSON.stringify(st));
    await shot('late-game');
    await page.mouse.move(720, 450); await page.mouse.wheel({ deltaY: 500 });
    await sleep(300); await shot('late-game-zoomed-out');
  });

  await check('inspector: choosing a recipe, setting a filter, draining a channel', async () => {
    const hud = (sel) => page.evaluate((s) => { const n = document.querySelector(s); if (!n) throw new Error('missing ' + s); n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 })); }, sel);
    await page.mouse.wheel({ deltaY: -500 });
    await world((w, app) => { app.showTox = false; });
    const pos = await world((w) => {
      const c = w.core;
      // first free spot for an s x s building, scanning outwards from the Core
      const spot = (type, s) => { for (let r = 5; r < 10; r++) for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) if (w.canPlace(type, x, y).ok) { const e = w.build(type, x, y, 0); if (e) return { x: e.x, y: e.y }; } return null; };
      for (const e of [...w.enemies]) e.hp = 0;
      w.threat.next = w.tick + 1e7;
      const rib = [...w.list].find(e => e.type === 'ribosome');
      return { rib: rib && { x: rib.x, y: rib.y }, fp: spot('filterpilus', 1), tank: spot('tank', 2) };
    });
    assert(pos.rib && pos.tank, 'setup failed: ' + JSON.stringify(pos));
    assert(pos.fp, 'filter pilus not built');
    await clickTile(pos.rib.x, pos.rib.y);
    await page.waitForSelector('#inspector [data-act="pick"]');
    await hud('#inspector [data-act="pick"]');
    await page.waitForSelector('#inspector [data-act="recipe:enzyme"]');
    await sleep(350); await shot('recipe-list');
    await hud('#inspector [data-act="recipe:enzyme"]');
    assert(await world((w, app) => app.sel.recipe) === 'enzyme', 'recipe not changed');
    await clickTile(pos.fp.x, pos.fp.y);
    await page.waitForSelector('#inspector [data-act="filter:iron"]');
    await hud('#inspector [data-act="filter:iron"]');
    assert(await world((w, app) => app.sel.filter) === 'iron', 'filter not set');
    await sleep(300); await shot('filter');
    await world((w) => { const t = [...w.list].find(e => e.type === 'tank'); t._net.fluid = 'water'; t._net.amt = 300; });
    await clickTile(pos.tank.x, pos.tank.y);
    await page.waitForSelector('#inspector [data-act="flush"]');
    await hud('#inspector [data-act="flush"]');
    assert(await world((w, app) => app.sel._net.amt) === 0, 'channel not drained');
    await hud('#inspector [data-act="dismantle"]');
    assert(await world((w) => w.counts.tank) === 0, 'tank not dismantled');
    assert(await world((w, app) => app.sel) === null, 'selection should be cleared');
  });

  await check('settings: switching to English changes the interface', async () => {
    await page.keyboard.press('Escape'); await clickM('dlg:settings');
    await page.select('[data-c="lang"]', 'en');
    await sleep(200);
    assert((await ev(() => document.querySelector('#tabs button').textContent)) === 'Transport', 'build bar not translated');
    await shot('settings-en');
    await page.select('[data-c="lang"]', 'cs');
    await clickM('dlg:menu'); await clickM('quit');
    await page.waitForSelector('[data-m="go:mods"]');
  });

  // ---- mods ---------------------------------------------------------------------------
  const reload = async () => { await page.reload({ waitUntil: 'networkidle0' }); await page.waitForSelector('#menu .mcard'); };
  const regHas = (kind, id) => ev((k, i) => !!window.__biofilm.reg[k][i], kind, id);
  const upload = async (file) => { const input = await page.$('input[data-f="mod"]'); await input.uploadFile(file); await page.waitForSelector('.note'); return ev(() => document.querySelector('.note').textContent); };

  await check('a mod in the server mods/ folder is offered and loaded', async () => {
    cpSync(path.join(ROOT, 'mods', 'example-kvasinky'), path.join(MODS, 'example-kvasinky'), { recursive: true });
    await reload();
    assert(!(await regHas('items', 'starch')), 'the example mod must start switched off');
    await clickM('go:mods');
    await page.waitForSelector('input[data-mod="kvasinky"]');
    await page.click('input[data-mod="kvasinky"]');
    await reload();
    assert(await regHas('items', 'starch') && await regHas('missions', 'brewery'), 'mod content missing');
    await clickM('go:mods');
    await page.waitForSelector('.save.mod');
    const rows = await ev(() => [...document.querySelectorAll('.save.mod')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
    assert(rows.length === 2 && rows[1].includes('Kvasinky') && rows[1].includes('složka mods/'), JSON.stringify(rows));
    await shot('mods');
    await clickM('go:main'); await clickM('go:campaign');
    await page.waitForSelector('[data-m="mission:brewery"]');
    await shot('campaign-with-mod');
    await clickM('mission:brewery'); await clickM('resume');
    await world((w) => { const c = w.core; w.build('yeast', c.x + 5, c.y, 0); w.build('composter', c.x + 5, c.y + 3, 0); });
    await pick('yeast');
    await sleep(300); await shot('mod-mission');
    assert(await world((w) => w.counts.yeast) === 1);
    // the inspector shows the extra line the mod asked for
    await page.keyboard.press('Escape');
    const c = await world((w) => ({ x: w.core.x + 5, y: w.core.y + 3 }));
    await clickTile(c.x, c.y);
    await page.waitForSelector('#inspector:not(.hidden)');
    assert((await ev(() => document.getElementById('inspector').textContent)).includes('/ 12'), 'mod inspector line missing');
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await clickM('quit');
    await page.waitForSelector('[data-m="go:mods"]');
  });

  await check('switching a mod off removes its content after reload', async () => {
    await clickM('go:mods');
    await page.click('input[data-mod="kvasinky"]');
    await reload();
    assert(!(await regHas('items', 'starch')), 'mod still loaded');
    await clickM('go:mods'); await page.click('input[data-mod="kvasinky"]'); await reload();
    assert(await regHas('items', 'starch'), 'mod did not come back');
  });

  await check('uploading a mod as .zip, as one .js file, and removing it', async () => {
    const main = `export function data(api) {\n  api.item('zipgoo', { icon: { shape: 'orb', color: '#ff00aa' } });\n  api.recipe('zipgoo', { category: 'ferment', time: 1, in: { glucose: 1 }, out: { zipgoo: 1 }, enabled: true });\n  api.locale('cs', { 'item.zipgoo': 'Zip sliz' }); api.locale('en', { 'item.zipgoo': 'Zip goo' });\n}`;
    const zf = path.join(SHOTS, 'zipmod.zip'), jf = path.join(SHOTS, 'single.js');
    writeFileSync(zf, zip({ 'zipmod/mod.json': JSON.stringify({ id: 'zipmod', name: 'Zip mod', version: '0.1.0' }), 'zipmod/main.js': main, 'zipmod/readme.txt': 'hello' }));
    writeFileSync(jf, `export const manifest = { id: 'single', name: 'Single file', version: '2.0.0' };\nexport function data(api) { api.modify('item', 'glucose', { fuel: 61 }); }`);
    await clickM('go:mods');
    let note = await upload(zf);
    assert(note.includes('Zip mod'), note);
    note = await upload(jf);
    assert(note.includes('Single file'), note);
    await reload();
    assert(await regHas('items', 'zipgoo'), 'zip mod not loaded');
    assert(await ev(() => window.__biofilm.reg.items.glucose.fuel) === 61, 'single-file mod not loaded');
    assert((await ev(() => window.__biofilm.reg.mods.map(m => m.id).join())) === 'base,kvasinky,single,zipmod');
    await clickM('go:mods');
    await page.waitForSelector('[data-m="rmmod:zipmod"]');
    await shot('mods-uploaded');
    await clickM('rmmod:zipmod'); await clickM('rmmod:single');
    await reload();
    assert(!(await regHas('items', 'zipgoo')), 'removed mod still loaded');
  });

  await check('a broken mod is refused or reported, and the game still starts', async () => {
    const syntax = path.join(SHOTS, 'syntax.js'), thrower = path.join(SHOTS, 'thrower.js');
    writeFileSync(syntax, `export const manifest = { id: 'syntax', name: 'Syntax', version: '1' };\nexport function data(api) { this is not javascript }`);
    writeFileSync(thrower, `export const manifest = { id: 'thrower', name: 'Thrower', version: '1' };\nexport function data(api) { api.item('partial', { icon: {} }); throw new Error('mod exploded'); }`);
    await clickM('go:mods');
    let note = await upload(syntax);
    assert(note.includes('nepodařilo'), note);
    note = await upload(thrower);
    assert(note.includes('Thrower'), note);
    problems.length = 0; // the refused upload above logs a syntax error on purpose
    await reload();
    assert(!(await regHas('items', 'partial')), 'half-loaded content left behind');
    const errs = await ev(() => window.__biofilm.reg.errors.map(e => e.mod + ':' + e.message));
    assert(errs.length === 1 && errs[0].includes('mod exploded'), JSON.stringify(errs));
    assert(await ev(() => document.querySelector('#menu .warn')?.textContent.includes('1')), 'no warning on the main menu');
    await shot('menu-mod-error');
    await clickM('go:mods'); await page.waitForSelector('.errs li'); await shot('mods-error');
    await clickM('rmmod:thrower');
    await clickM('go:main'); await clickM('go:campaign'); await clickM('mission:m1'); await clickM('resume');
    assert(await world((w) => w.missionId) === 'm1', 'game did not start');
  });

  if (process.env.EXTRA) await (await import(process.env.EXTRA)).default({ page, check, assert, shot, world, ev, clickM, sleep, MODS, ROOT, PORT });
} finally {
  await sleep(200);
  await browser.close();
  server.kill();
}

writeFileSync(path.join(SHOTS, 'problems.txt'), problems.join('\n'));
if (problems.length) { console.log(`\nPage problems (${problems.length}):\n  ` + problems.slice(0, 15).join('\n  ')); failed++; }
console.log(`\n${failed ? 'FAILED' : 'All browser checks passed'}; screenshots in ${SHOTS}`);
process.exit(failed ? 1 : 0);
