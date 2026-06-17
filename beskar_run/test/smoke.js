'use strict';
// Headless smoke test: stub the browser, load every module, then simulate
// full runs of all 3 levels — fly, shoot, kill the boss, bank, buy, loop.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ---- minimal browser stubs ----
function mkCtx() {
  const noop = () => {};
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient') return () => ({ addColorStop: noop });
      if (k === 'measureText') return () => ({ width: 10 });
      return typeof t[k] !== 'undefined' ? t[k] : noop;
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
function mkCanvas() {
  return { width: 0, height: 0, getContext: () => mkCtx(), addEventListener: () => {} };
}

const storage = {};
let rafCb = null;
const listeners = {};

const sandbox = {
  console,
  Math, JSON, Array, Object, Number, String, Boolean, Date, Promise, Proxy, Reflect,
  setTimeout, clearTimeout, setInterval, clearInterval,
  document: {
    createElement: (tag) => mkCanvas(),
    getElementById: () => mkCanvas(),
  },
  localStorage: {
    getItem: k => (k in storage ? storage[k] : null),
    setItem: (k, v) => { storage[k] = String(v); },
  },
  requestAnimationFrame: cb => { rafCb = cb; },
};
sandbox.window = {
  addEventListener: (ev, cb) => { listeners[ev] = cb; },
  AudioContext: undefined, webkitAudioContext: undefined,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const files = ['util.js', 'sprites.js', 'audio.js', 'data.js', 'save.js', 'bg.js', 'main.js'];
for (const f of files) {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
  vm.runInContext(code, sandbox, { filename: f });
}

const run = code => vm.runInContext(code, sandbox);
let failures = 0;
function check(name, cond) {
  if (cond) console.log('  PASS', name);
  else { console.log('  FAIL', name); failures++; }
}
function press(code) { listeners.keydown({ code, preventDefault: () => {}, repeat: false }); }
function release(code) { listeners.keyup({ code }); }
function step(seconds) {
  // drive the real frame() via the captured rAF callback
  const steps = Math.round(seconds / 0.016);
  for (let i = 0; i < steps; i++) {
    const cb = rafCb; rafCb = null;
    run('lastT'); // ensure context alive
    cb(sandbox.__t = (sandbox.__t || 0) + 16);
  }
}

console.log('== boot ==');
check('starts on title', run('G.state') === 'title');
check('save defaults', run('save.vault') === 0 && run('save.weapons.length') === 1);
step(0.5);

console.log('== run level 1 ==');
press('Enter'); release('Enter');
check('enters play', run('G.state') === 'play');
check('hearts = 3', run('P.hearts') === 3);
step(3);
check('enemies spawned by t=3', run('G.enemies.length') > 0);
check('auto-fire produced bullets', run('G.pbullets.length') > 0);

// move around a bit
press('ArrowUp'); step(0.5); release('ArrowUp');
press('KeyS'); step(0.5); release('KeyS');
check('player stayed in bounds', run('P.y') >= 40 && run('P.y') <= 540);

// pause / resume
press('KeyP'); check('pauses', run('G.state') === 'pause');
press('KeyP'); check('resumes', run('G.state') === 'play');

// god-mode through the wave phase: keep player invulnerable, nuke enemies as they come
run('P.inv = 1e9');
for (let i = 0; i < 80; i++) {
  step(1);
  run('for (const e of G.enemies) { e.hp = 0; dieEnemy(e); } G.enemies = [];');
  if (run('!!G.boss')) break;
}
check('boss spawned after waves', run('!!G.boss'));
check('coins dropped from kills', run('G.runBeskar') > 0 || run('G.coins.length') > 0);

// collect a coin by flying onto it
run('if (G.coins.length) { P.x = G.coins[0].x; P.y = G.coins[0].y; }');
step(0.2);
check('collected some beskar', run('G.runBeskar') > 0);

// kill the boss
step(3); // let it finish entering
run('G.boss.hp = 1;');
run('G.boss.entering = false;');
step(0.2);
run('if (G.boss && G.bossDying<=0) { G.boss.hp = 0; killBoss(); }');
step(3);
check('level complete state', run('G.state') === 'complete');
check('advanced to level 2', run('save.level') === 1);
check('vault banked', run('save.vault') > 0);
check('save persisted', !!storage['beskarRunSave_v1']);

console.log('== hangar ==');
press('Enter');
check('enters hangar', run('G.state') === 'hangar');
run('save.vault = 10000; save.gifts.magnet = 0;');
// buy first upgrade (fire rate)
press('Enter');
check('bought fire rate lvl1', run('save.upgrades.rate') === 1);
// switch to gifts tab, buy magnet
press('ArrowRight');
press('Enter');
check('bought magnet lvl1', run('save.gifts.magnet') === 1);
// weapons tab: buy twin cannon (row 1)
press('ArrowRight');
press('ArrowDown');
press('Enter');
check('bought + equipped twin cannon', run('save.weapons.includes("twin")') && run('save.equipped') === 'twin');
const vaultAfter = run('save.vault');
check('vault decreased by costs', vaultAfter === 10000 - 90 - 100 - 150);

console.log('== run level 2 with gear ==');
press('KeyL');
check('launched level 2', run('G.state') === 'play' && run('G.level') === 1);
step(3);
check('level-2 enemies spawn', run('G.enemies.length') > 0);
press('KeyQ');
check('Q switches weapon', run('save.equipped') === 'blaster' || run('save.equipped') === 'twin');

// take damage path: drop invuln & park on an enemy
run('P.inv = 0; if (G.enemies.length) { G.enemies[0].x = P.x; G.enemies[0].y = P.y; G.enemies[0].baseY = P.y; }');
step(0.1);
check('took a hit', run('P.hearts') < run('P.maxHearts'));

// force wipe
run('save.gifts.wipe = 1; P.wipeCd = 0;');
run('spawnEnemy("grunt", 200); spawnEnemy("grunt", 300);');
press('KeyF');
check('force wipe clears enemies', run('G.enemies.length') === 0);
check('wipe goes on cooldown', run('P.wipeCd') > 0);

// ship down path
run('P.inv = 0; P.hearts = 1; G.bossDying = 0;');
run('hurtPlayer();');
check('ship down state', run('G.state') === 'down');
step(1);
press('Enter');
check('back to hangar after down', run('G.state') === 'hangar');

console.log('== force bond revive ==');
run('save.gifts.bond = 1;');
press('KeyL');
run('P.inv = 0; P.hearts = 1; hurtPlayer();');
check('revived once', run('G.state') === 'play' && run('P.hearts') === run('P.maxHearts'));
run('P.inv = 0; P.hearts = 1; hurtPlayer();');
check('second death is final', run('G.state') === 'down');

console.log('== campaign loop ==');
run('save.level = 2; save.loop = 0;');
step(1);
press('Enter'); // to hangar
press('KeyL'); // launch level 3
check('launched level 3', run('G.level') === 2);
run('P.inv = 1e9;');
for (let i = 0; i < 80; i++) {
  step(1);
  run('for (const e of G.enemies) e.hp = 0; G.enemies = [];');
  if (run('!!G.boss')) break;
}
check('walker boss spawned', run('!!G.boss'));
step(3);
run('G.boss.entering = false; G.boss.hp = 0; killBoss();');
step(3);
check('campaign looped to level 1', run('save.level') === 0);
check('loop counter incremented', run('save.loop') === 1);
const m = run('JSON.stringify(loopMult(save.loop))');
console.log('  loop1 multipliers:', m);

console.log('== save/load roundtrip ==');
const saved = JSON.parse(storage['beskarRunSave_v1']);
check('saved weapons persisted', saved.weapons.includes('twin'));
check('saved loop persisted', saved.loop === 1);

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} FAILURES`);
process.exit(failures ? 1 : 0);
