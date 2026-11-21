// Browser play-test: drives the real page in headless Chromium with mouse and keyboard.
//   node tools/playtest.js            (starts its own server on a spare port)
//   CHROME=/path/to/chromium SHOTS=dir node tools/playtest.js
// Exits non-zero if a step fails or the page logs an error. Screenshots go to test/shots/.
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHOTS = process.env.SHOTS || path.join(ROOT, 'test', 'shots');
const CHROME = process.env.CHROME || ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].find(existsSync);
const PORT = 8000 + Math.floor(Math.random() * 900) + 90;
const MODS = path.join(SHOTS, 'mods-for-test');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
const clickM = async (act) => { await page.waitForSelector(`[data-m="${act}"]`, { timeout: 5000 }); await page.click(`[data-m="${act}"]`); };
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
