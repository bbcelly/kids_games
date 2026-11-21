// Mods: the example mod loads and its mission can be won; broken mods never take the game down.
import { readFileSync } from 'node:fs';
import { test, assert, makeReg, baseMod, run } from './helpers.js';
import { Registry } from '../public/engine/registry.js';
import { applyMods, sortMods } from '../public/engine/modloader.js';
import { createWorld } from '../public/sim/sim.js';
import { serialize, deserialize } from '../public/sim/save.js';
import { setRecipe } from '../public/sim/kinds.js';
import { Bot } from './bot.js';

async function diskMod(dir) {
  const base = new URL(`../mods/${dir}/`, import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL('mod.json', base), 'utf8'));
  return { manifest, module: await import(new URL(manifest.main || 'main.js', base)), source: 'server' };
}
const example = await diskMod('example-kvasinky');
const fake = (id, mod, deps) => ({ manifest: { id, name: id, version: '1.0.0', dependencies: deps }, module: mod, source: 'local' });

test('example mod loads cleanly and adds its content', () => {
  const reg = makeReg([example]);
  assert.deepEqual(reg.errors, []);
  assert.deepEqual(reg.mods.map(m => m.id), ['base', 'kvasinky']);
  assert.ok(reg.items.starch && reg.items.ethanol && reg.entities.yeast && reg.techs.brewing && reg.missions.brewery);
  assert.ok(reg.kinds.composter, 'custom kind registered');
  assert.equal(reg.entities.generator.pollution, 0.2, 'api.modify changed the base game');
  assert.equal(makeReg().entities.generator.pollution, 0.25, 'and only where the mod is loaded');
  assert.ok(reg.resIndex.starch > 0);
  assert.deepEqual(reg.validate(), []);
  for (const lang of ['cs', 'en']) {
    const L = reg.locales[lang];
    for (const k of ['item.starch', 'entity.yeast', 'entity.yeast.desc', 'tech.brewing', 'mission.brewery.name', 'mission.brewery.hint.feast']) assert.ok(L[k], `${lang} ${k}`);
  }
});

test('the mod mission can be won and free play includes the new deposit', () => {
  const reg = makeReg([example]);
  const w = createWorld(reg, { mission: 'brewery' });
  const b = new Bot(w);
  const comp = b.slot('E', 1, 0);
  b.mine('glucose');
  const y = b.machine('yeast', 'ethanol', w.core, b.towards('starch', 5));
  b.mine('starch', y);
  b.fill(comp, 'composter', null, { out: false });
  b.until(() => w.won, 900, 'win brewery');
  assert.ok(w.custom.kvasinky.composted >= 9);
  assert.ok(w.stats.delivered.atp >= 1, 'control hook rewarded the tenth ethanol');
  const free = createWorld(reg, { mission: 'free', seed: 5 });
  assert.ok(free.res.includes(reg.resIndex.starch), 'starch is scattered on free-play maps');
});

test('a mod that throws is rolled back and reported; the game still works', () => {
  const bad = fake('boom', { data(api) { api.item('halfdone', { icon: {} }); api.recipe('x', { category: 'ferment', time: 1, in: { halfdone: 1 }, out: { halfdone: 1 } }); throw new Error('kaboom'); } });
  const reg = makeReg([bad, example]);
  assert.equal(reg.errors.length, 1);
  assert.equal(reg.errors[0].mod, 'boom');
  assert.match(reg.errors[0].message, /kaboom/);
  assert.equal(reg.items.halfdone, undefined, 'partial content removed');
  assert.equal(reg.recipes.x, undefined);
  assert.ok(reg.items.starch, 'later mods still load');
  assert.deepEqual(reg.validate(), []);
  run(createWorld(reg, { mission: 'm1' }), 120);
});

test('inconsistent data, bad manifests and missing dependencies are refused', () => {
  const dangling = fake('dangling', { data(api) { api.recipe('ghost', { category: 'ferment', time: 1, in: { nothing: 1 }, out: { glucose: 1 }, enabled: true }); } });
  const locked = fake('locked', { data(api) { api.entity('orphan', { kind: 'wall', size: [1, 1], cost: { fiber: 1 } }); } });
  const badId = { manifest: { id: 'Bad Id!', name: 'x', version: '1' }, module: { data() {} } };
  const noExports = fake('empty', {});
  const needs = fake('needs', { data() {} }, ['not-installed']);
  const child = fake('child', { data() {} }, ['needs']);
  const reg = makeReg([dangling, locked, badId, noExports, needs, child]);
  const by = Object.fromEntries(reg.errors.map(e => [e.mod, e]));
  assert.match(by.dangling.message, /unknown item "nothing"/);
  assert.match(by.locked.message, /nothing unlocks it/);
  assert.equal(by['Bad Id!'].stage, 'manifest');
  assert.match(by.empty.message, /must export/);
  assert.match(by.needs.message, /missing dependency "not-installed"/);
  assert.match(by.child.message, /dependency "needs" failed/);
  assert.deepEqual(reg.mods.map(m => m.id), ['base']);
  assert.equal(reg.recipes.ghost, undefined);
  assert.deepEqual(reg.validate(), []);
});

test('mods load in dependency order whatever order they are given in', () => {
  const a = fake('aaa', { data(api) { api.modify('item', 'zzzitem', { fuel: 7 }); } }, ['zzz']);
  const z = fake('zzz', { data(api) { api.item('zzzitem', { icon: {} }); api.resource('zzzres', { item: 'zzzitem', color: '#fff' }); } });
  assert.deepEqual(sortMods([a, z, baseMod]).order.map(m => m.manifest.id), ['base', 'zzz', 'aaa']);
  const reg = makeReg([a, z]);
  assert.deepEqual(reg.errors, []);
  assert.equal(reg.items.zzzitem.fuel, 7);
});

test('a hook that throws is switched off; the simulation keeps running', () => {
  let calls = 0;
  const flaky = fake('flaky', { control(api) { api.on('tick', () => { calls++; throw new Error('hook broke'); }); } });
  const reg = makeReg([flaky]);
  const w = createWorld(reg, { mission: 'm1' });
  run(w, 300);
  assert.equal(calls, 1);
  assert.equal(w.tick, 300);
  assert.equal(reg.errors.length, 1);
  assert.equal(reg.errors[0].stage, 'hook:tick');
});

test('a save made with a mod opens without it: its content is dropped with warnings', () => {
  const reg = makeReg([example]);
  const w = createWorld(reg, { mission: 'm4' });
  for (const id in reg.items) w.inv[id] = 500;
  w.completeTech('brewing', true);
  const c = w.core;
  const y = w.build('yeast', c.x + 5, c.y, 0); setRecipe(w, y, 'ethanol');
  w.build('composter', c.x + 5, c.y + 3, 0);
  w.build('fermentor', c.x - 4, c.y, 0);
  for (let i = 0; i < 600; i++) { y._k.put(w, y, 'starch'); run(w, 1); }
  assert.ok(w.custom.kvasinky.brewed >= 2, 'the yeast cell brewed');
  const data = JSON.parse(JSON.stringify(serialize(w)));
  const plain = makeReg();
  const { world, warnings } = deserialize(plain, data);
  assert.deepEqual(warnings.map(x => x.type).sort(), ['droppedEntities', 'missingMod']);
  assert.equal(warnings.find(x => x.type === 'droppedEntities').count, 2);
  assert.equal(world.inv.starch, undefined);
  assert.equal(world.techs.brewing, undefined);
  assert.equal(world.counts.fermentor, 1);
  run(world, 600);
  // and with the mod it comes back whole
  const again = deserialize(reg, data);
  assert.deepEqual(again.warnings, []);
  assert.equal(again.world.counts.yeast, 1);
  assert.equal(again.world.custom.kvasinky.brewed, w.custom.kvasinky.brewed);
  // a mission that only exists in the mod cannot be opened without it, and says why
  const bw = createWorld(reg, { mission: 'brewery' });
  assert.throws(() => deserialize(plain, JSON.parse(JSON.stringify(serialize(bw)))), /mission "brewery" is not available/);
});

test('registry rejects prototypes of an unknown type', () => {
  const reg = new Registry();
  applyMods(reg, [baseMod]);
  assert.throws(() => reg.add('gadgets', 'x', {}), /unknown prototype type/);
});
