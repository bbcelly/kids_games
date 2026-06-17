'use strict';
// Drive the real game in headless Chromium and screenshot every screen/level.
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const p = path.join(root, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  try {
    const data = fs.readFileSync(p);
    res.writeHead(200, { 'Content-Type': mime[path.extname(p)] || 'text/plain' });
    res.end(data);
  } catch (e) { res.writeHead(404); res.end('nope'); }
});

(async () => {
  await new Promise(r => server.listen(8765, r));
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-gpu', '--mute-audio'],
    headless: 'new',
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 540 });
  page.on('pageerror', e => console.log('PAGE ERROR:', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });
  await page.goto('http://localhost:8765/', { waitUntil: 'load' });
  await page.waitForFunction('typeof G !== "undefined"');

  const out = path.join(__dirname, 'shots');
  fs.mkdirSync(out, { recursive: true });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shot = async name => {
    await page.screenshot({ path: path.join(out, name + '.png') });
    console.log('shot:', name);
  };

  await wait(800);
  await shot('1-title');

  // launch level 1 and play a few seconds
  await page.keyboard.press('Enter');
  await wait(4000);
  await shot('2-level1-play');

  // pause
  await page.keyboard.press('KeyP');
  await wait(300);
  await shot('3-pause');
  await page.keyboard.press('KeyP');

  // boss fight: skip waves, spawn boss directly
  await page.evaluate(`
    G.waveFired = G.waveFired.map(() => true);
    G.spawnQueue = []; G.enemies = [];
    P.inv = 1e9;
    spawnBoss();
  `);
  await wait(2500);
  await shot('4-level1-boss');

  // kill boss -> level complete
  await page.evaluate('G.boss.hp = 0; killBoss();');
  await wait(2500);
  await shot('5-level-complete');

  // hangar tabs
  await page.keyboard.press('Enter');
  await page.evaluate('save.vault = 3000;');
  await wait(400);
  await shot('6-hangar-upgrades');
  await page.keyboard.press('ArrowRight');
  await wait(200);
  await shot('7-hangar-gifts');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await wait(200);
  await shot('8-hangar-weapons');

  // level 2 with spread weapon + boss
  await page.evaluate(`
    save.level = 1; save.weapons = ['blaster','spread']; save.equipped = 'spread'; storeSave(save);
  `);
  await page.keyboard.press('KeyL');
  await wait(4000);
  await shot('9-level2-play');
  await page.evaluate(`
    G.waveFired = G.waveFired.map(() => true);
    G.spawnQueue = []; G.enemies = []; P.inv = 1e9; spawnBoss();
  `);
  await wait(2500);
  await shot('10-level2-boss');

  // level 3 + walker boss + force wipe visuals
  await page.evaluate(`
    bankRun(); save.level = 2; save.gifts.wipe = 2; storeSave(save); setState('hangar');
  `);
  await page.keyboard.press('KeyL');
  await wait(4000);
  await shot('11-level3-play');
  await page.keyboard.press('KeyF');
  await wait(250);
  await shot('12-force-wipe');
  await page.evaluate(`
    G.waveFired = G.waveFired.map(() => true);
    G.spawnQueue = []; G.enemies = []; P.inv = 1e9; spawnBoss();
  `);
  await wait(2500);
  await shot('13-level3-boss');

  // ship down screen
  await page.evaluate('P.inv = 0; P.revives = 0; P.hearts = 1; hurtPlayer();');
  await wait(600);
  await shot('14-ship-down');

  await browser.close();
  server.close();
  console.log('done');
})().catch(e => { console.error(e); process.exit(1); });
