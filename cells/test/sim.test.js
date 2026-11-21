'use strict';
// Plain-node tests for the simulation core: node test/sim.test.js
const assert = require('assert');
const { Game, STAGES, START_MASS, canEat, stageFor, WORLD } = require('../server/game');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }

test('stage thresholds', () => {
  assert.strictEqual(stageFor(10), 0);
  assert.strictEqual(stageFor(30), 1);
  assert.strictEqual(stageFor(899), 4);
  assert.strictEqual(stageFor(5000), STAGES.length - 1);
});

test('eat ratio respects membrane and jaws', () => {
  const g = new Game({ botTarget: 0 });
  const a = g.addOrganism('a'), b = g.addOrganism('b');
  a.mass = 115; b.mass = 100;
  assert.ok(!canEat(a, b));
  a.traits.jaws = 1; // ratio 1.14
  assert.ok(canEat(a, b));
  b.traits.membrane = 2; // ratio 1.30
  assert.ok(!canEat(a, b));
});

test('bigger organism eats overlapping smaller one and gains mass', () => {
  const g = new Game({ botTarget: 0 });
  const a = g.addOrganism('big'), b = g.addOrganism('small');
  a.mass = 100; b.mass = 20;
  a.x = b.x = 1000; a.y = b.y = 1000; a.r = 60; b.r = 27;
  b.bornAt = -1000; // past the spawn shield
  g.step();
  assert.ok(!b.alive, 'prey should be dead');
  assert.ok(a.mass > 110, 'eater gains mass: ' + a.mass);
  assert.ok(g.events.some(e => e.t === 'kill' && e.prey === b.id));
});

test('spawn shield protects freshly spawned organisms', () => {
  const g = new Game({ botTarget: 0 });
  const a = g.addOrganism('big'), b = g.addOrganism('newbie');
  a.mass = 100; b.mass = 10;
  a.x = b.x = 1500; a.y = b.y = 1500;
  g.step();
  assert.ok(b.alive, 'shielded newbie survives');
  for (let i = 0; i < 30 * 3; i++) { a.x = b.x; a.y = b.y; g.step(); }
  assert.ok(!b.alive, 'eaten once the shield expires');
});

test('toxin spikes poison the eater', () => {
  const g = new Game({ botTarget: 0 });
  const a = g.addOrganism('big'), b = g.addOrganism('spiky');
  a.mass = 100; b.mass = 20; b.traits.spikes = 2;
  a.x = b.x = 2000; a.y = b.y = 2000;
  b.bornAt = -1000;
  g.step();
  assert.ok(!b.alive);
  assert.ok(a.poisonT > 0);
});

test('growing past a threshold evolves and offers two traits', () => {
  const g = new Game({ botTarget: 0 });
  const a = g.addOrganism('grower');
  a.mass = 35;
  g.step();
  assert.strictEqual(a.stage, 1);
  assert.strictEqual(a.pendingChoices.length, 1);
  assert.strictEqual(a.pendingChoices[0].length, 2);
  const key = a.pendingChoices[0][1];
  assert.ok(g.pickTrait(a, 1));
  assert.strictEqual(a.traits[key], 1);
  assert.strictEqual(a.pendingChoices.length, 0);
});

test('jumping several stages queues several trait offers', () => {
  const g = new Game({ botTarget: 0 });
  const a = g.addOrganism('jumper');
  a.mass = 200;
  g.step();
  assert.strictEqual(a.stage, 3);
  assert.strictEqual(a.pendingChoices.length, 3);
});

test('eating food grows you', () => {
  const g = new Game({ botTarget: 0 });
  const a = g.addOrganism('eater');
  const f = g.spawnFood(a.x + 3, a.y, 3);
  g.step();
  assert.ok(!g.food.has(f.id));
  assert.ok(a.mass >= START_MASS + 3);
});

test('organisms stay inside the world and input is sanitised', () => {
  const g = new Game({ botTarget: 0 });
  const a = g.addOrganism('runner');
  g.setInput(a, NaN, Infinity); // ignored
  g.setInput(a, 1e9, -1e9);
  for (let i = 0; i < 30 * 40; i++) g.step();
  assert.ok(a.x <= WORLD && a.x >= 0 && a.y <= WORLD && a.y >= 0);
});

test('dash costs mass and has cooldown', () => {
  const g = new Game({ botTarget: 0 });
  const a = g.addOrganism('dasher');
  a.mass = 50;
  assert.ok(g.dash(a));
  assert.ok(a.mass < 50);
  assert.ok(!g.dash(a));
});

test('bots fill the world and long simulation stays stable', () => {
  const g = new Game({ botTarget: 14 });
  for (let i = 0; i < 30 * 120; i++) { g.step(); g.events.length = 0; }
  const bots = [...g.orgs.values()].filter(o => o.isBot);
  assert.ok(bots.length >= 10, 'bots: ' + bots.length);
  for (const o of g.orgs.values()) {
    assert.ok(Number.isFinite(o.x) && Number.isFinite(o.y) && Number.isFinite(o.mass));
  }
  const maxStage = Math.max(...bots.map(b => b.maxStage));
  console.log('   after 2 min: max bot stage', maxStage, 'max mass', Math.round(Math.max(...bots.map(b => b.mass))));
});

console.log(`\n${passed} tests passed`);
