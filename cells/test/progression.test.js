'use strict';
// node test/progression.test.js
const assert = require('assert');
const C = require('../public/catalog');
const P = require('../server/progression');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }
const fresh = () => ({ publicId: 'pub12345', transferCode: 'AAAA-BBBB-CCCC', ...P.newProfileData(Date.UTC(2026, 10, 21, 10)) });
const at = (d, h = 10) => Date.UTC(2026, 10, d, h); // November 2026, 10:00 UTC = 11:00 Prague
const life = (o = {}) => ({ maxMass: 200, maxStage: 3, secs: 120, kills: 4, playerKills: 1, killsBig: 0, killedApex: 0, food: 60, dashes: 5, poisoned: 0, traits: { jaws: 1 }, ...o });

test('catalog is consistent', () => {
  const ids = new Set();
  for (const it of C.ITEMS) { assert.ok(!ids.has(it.id), 'dup ' + it.id); ids.add(it.id); }
  for (const lv in C.LEVEL_REWARDS) for (const id of C.LEVEL_REWARDS[lv]) assert.ok(C.ITEM[id], id);
  for (const a of C.ACHIEVEMENTS) if (a.item) assert.ok(C.ITEM[a.item], a.item);
  for (const s in C.DEFAULTS) assert.strictEqual(C.ITEM[C.DEFAULTS[s]].source, 'default', s);
  assert.strictEqual(C.ENTRIES.length, 21);
  assert.strictEqual(C.ACHIEVEMENTS.find(a => a.id === 'a_encyclopedia').goal, C.ENTRIES.length);
  // every non-default, non-shop item must be obtainable somewhere
  const sources = new Set([...Object.values(C.LEVEL_REWARDS).flat(), ...C.ACHIEVEMENTS.map(a => a.item).filter(Boolean)]);
  for (const it of C.ITEMS) if (it.source === 'level' || it.source === 'achievement') assert.ok(sources.has(it.id), 'unobtainable ' + it.id);
});

test('day boundaries use Prague time', () => {
  assert.strictEqual(P.dayOf(Date.UTC(2026, 10, 21, 22, 30)), '2026-11-21'); // 23:30 Prague
  assert.strictEqual(P.dayOf(Date.UTC(2026, 10, 21, 23, 30)), '2026-11-22'); // 00:30 Prague
});

test('a life earns XP, stats, tasks and collection entries', () => {
  const p = fresh();
  const s = P.applySession(p, life(), at(21));
  assert.ok(s.counted && s.xp > 100, 'xp ' + s.xp);
  assert.strictEqual(p.life.games, 1);
  assert.strictEqual(p.life.kills, 4);
  assert.ok(p.entries.stage_3 && p.entries.trait_jaws && p.entries.e_ate_player && !p.entries.stage_4);
  assert.ok(p.achievements.a_first && p.achievements.a_colony && p.achievements.a_pvp);
  assert.strictEqual(p.tasks.list.length, 3);
  assert.ok(p.level >= 2 && p.owned.c_teal, 'levelled up and got the level-2 colour');
});

test('very short lives earn nothing (anti farming)', () => {
  const p = fresh();
  const s = P.applySession(p, life({ secs: 5 }), at(21));
  assert.ok(!s.counted && p.xp === 0 && p.life.games === 0);
});

test('session input is sanitised', () => {
  const p = fresh();
  P.applySession(p, life({ maxStage: 99, kills: -50, traits: { jaws: 50, hacks: 9 } }), at(21));
  assert.strictEqual(p.life.bestStage, 5);
  assert.strictEqual(p.life.kills, 0);
  assert.ok(p.life.mastered.jaws && !('hacks' in p.life.mastered));
});

test('level curve and DNA per level', () => {
  assert.strictEqual(P.levelFromXp(0).level, 1);
  assert.strictEqual(P.levelFromXp(C.xpForLevel(1)).level, 2);
  const p = fresh();
  const sum = { dna: 0, levelUps: [] };
  P.addXp(p, 5000, sum);
  assert.strictEqual(p.level, P.levelFromXp(5000).level);
  assert.ok(sum.levelUps.length === p.level - 1 && p.dna === sum.dna);
});

test('daily reward: streak grows, cannot claim twice, day 7 gives an item', () => {
  const p = fresh();
  let r = P.claimDaily(p, at(1));
  assert.ok(r.ok && r.streak === 1 && r.dna === 20);
  assert.ok(!P.claimDaily(p, at(1, 20)).ok, 'second claim same day refused');
  for (let d = 2; d <= 7; d++) r = P.claimDaily(p, at(d));
  assert.strictEqual(r.streak, 7);
  assert.ok(r.item && p.owned[r.item] && C.ITEM[r.item].daily);
  assert.ok(p.achievements.a_streak3 && p.achievements.a_streak7 && p.owned.ti_devoted);
});

test('daily reward: one missed day per week is forgiven, two reset', () => {
  const p = fresh();
  P.claimDaily(p, at(1)); P.claimDaily(p, at(2));
  let r = P.claimDaily(p, at(4)); // skipped the 3rd -> forgiven
  assert.strictEqual(r.streak, 3);
  r = P.claimDaily(p, at(6)); // skipped again within a week -> reset
  assert.strictEqual(r.streak, 1);
  r = P.claimDaily(p, at(10)); // gap of 4 -> reset
  assert.strictEqual(r.streak, 1);
});

test('daily tasks: three per day, one reroll, progress and rewards', () => {
  const p = fresh();
  P.ensureTasks(p, at(21), () => 0); // picks the first tasks in order
  assert.deepStrictEqual(p.tasks.list.map(t => t.id), ['t_kills5', 't_kills15', 't_pvp']);
  assert.ok(P.rerollTask(p, 2, at(21)).ok);
  assert.ok(!P.rerollTask(p, 1, at(21)).ok, 'only one reroll per day');
  p.tasks.list[2] = { id: 't_pvp', progress: 0, done: false };
  const dnaBefore = p.dna;
  const s = P.applySession(p, life({ kills: 6, playerKills: 1 }), at(21));
  assert.deepStrictEqual(s.tasksDone.map(t => t.id).sort(), ['t_kills5', 't_pvp']);
  assert.strictEqual(p.tasks.list[1].progress, 6);
  assert.ok(p.dna > dnaBefore);
  P.ensureTasks(p, at(22));
  assert.ok(p.tasks.day === '2026-11-22' && p.tasks.list.every(t => !t.done && t.progress === 0) && !p.tasks.rerolled);
});

test('shop and equipment only allow owned, matching items', () => {
  const p = fresh();
  assert.ok(!P.buy(p, 'c_coral').ok, 'no DNA');
  p.dna = 1000;
  assert.ok(P.buy(p, 'c_coral').ok && p.dna === 1000 - C.ITEM.c_coral.price);
  assert.ok(!P.buy(p, 'c_coral').ok, 'already owned');
  assert.ok(!P.buy(p, 'c_rainbow').ok, 'level reward is not for sale');
  assert.ok(P.equip(p, 'color', 'c_coral').ok);
  assert.ok(!P.equip(p, 'color', 'c_rainbow').ok, 'not owned');
  assert.ok(!P.equip(p, 'pattern', 'c_coral').ok, 'wrong slot');
  assert.ok(P.equip(p, 'center', 'ce_none').ok);
  p.owned.pl_kelp = true;
  assert.ok(P.equip(p, 'plantR', 'pl_kelp').ok && !P.equip(p, 'floor', 'pl_kelp').ok);
  assert.strictEqual(P.equippedLook(p).color, 'c_coral');
  p.equipped.color = 'c_gold'; // tampered data falls back to default
  assert.strictEqual(P.equippedLook(p).color, 'c_auto');
});

test('lab: save specimens up to capacity, release, curator achievement', () => {
  const p = fresh();
  const mk = () => ({ maxStage: 3, maxMass: 300, traits: { jaws: 2 }, hue: 120, look: {}, name: 'Blob', kills: 3 });
  assert.ok(!P.saveSpecimen(p, { ...mk(), maxStage: 1 }, at(21)).ok, 'too small');
  for (let i = 0; i < 3; i++) assert.ok(P.saveSpecimen(p, mk(), at(21)).ok);
  assert.ok(!P.saveSpecimen(p, mk(), at(21)).ok, 'lab full at level 1');
  const l = mk(); P.releaseSpecimen(p, p.lab.specimens[0].id);
  assert.ok(P.saveSpecimen(p, l, at(21)).ok && !P.saveSpecimen(p, l, at(21)).ok, 'same life only once');
  p.lab.specimens = []; p.level = 10;
  P.saveSpecimen(p, mk(), at(21));
  assert.ok(p.achievements.a_curator && p.owned.bu_rainbow);
});

test('showcase keeps max 3 earned achievements; public view hides secrets', () => {
  const p = fresh();
  p.achievements = { a_first: 1, a_pvp: 1, a_colony: 1, a_hungry: 1 };
  P.setShowcase(p, ['a_first', 'a_apex', 'a_pvp', 'a_colony', 'a_hungry']);
  assert.deepStrictEqual(p.showcase, ['a_first', 'a_pvp', 'a_colony']);
  p.token = 'secret';
  const pub = JSON.stringify(P.publicView(p));
  assert.ok(!pub.includes('secret') && !pub.includes('AAAA-BBBB'));
});

console.log(`\n${passed} tests passed`);
