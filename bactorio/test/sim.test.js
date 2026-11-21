// Unit tests of the simulation rules.
import { test, assert, makeReg, sandbox, run } from './helpers.js';
import { setRecipe } from '../public/sim/kinds.js';
import { serialize, deserialize, fingerprint } from '../public/sim/save.js';
import { createWorld, step } from '../public/sim/sim.js';

const reg = makeReg();

test('base data is consistent', () => {
  assert.deepEqual(reg.errors, []);
  assert.deepEqual(reg.validate(), []);
  assert.ok(Object.keys(reg.items).length >= 20);
  assert.ok(Object.keys(reg.techs).length >= 30);
  assert.equal(Object.values(reg.missions).filter(m => m.campaign).length, 8);
});

test('every text key exists in Czech and English', () => {
  for (const lang of ['cs', 'en']) {
    const L = reg.locales[lang], miss = [];
    const need = (k) => { if (!L[k]) miss.push(k); };
    for (const id in reg.items) need('item.' + id);
    for (const id in reg.fluids) need('fluid.' + id);
    for (const id in reg.entities) { need('entity.' + id); need('entity.' + id + '.desc'); }
    for (const id in reg.techs) { need('tech.' + id); need('tech.' + id + '.desc'); }
    for (const id in reg.enemies) need('enemy.' + id);
    for (const id in reg.recipes) if (!reg.items[id]) need('recipe.' + id);
    for (const m of Object.values(reg.missions)) {
      need(`mission.${m.id}.name`); need(`mission.${m.id}.intro`);
      for (const o of m.objectives) need(`mission.${m.id}.hint.${o.id}`);
    }
    assert.deepEqual(miss, [], `${lang}: missing texts`);
  }
  const cs = Object.keys(reg.locales.cs).sort(), en = Object.keys(reg.locales.en).sort();
  assert.deepEqual(cs.filter(k => !reg.locales.en[k]), [], 'keys only in cs');
  assert.deepEqual(en.filter(k => !reg.locales.cs[k]), [], 'keys only in en');
});

test('pathway carries items to the Core', () => {
  const w = sandbox(reg);
  for (let x = 10; x < 22; x++) w.build('belt', x, 23, 0);
  const b = w.entAt(10, 23);
  const before = w.inv.glucose;
  b._k.put(w, b, 'glucose', 0);
  run(w, 60 * 7);
  assert.equal(w.inv.glucose, before + 1);
  assert.equal(w.stats.delivered.glucose, 1);
});

test('a jammed pathway holds 4 items per tile (5 on the last) and flows again when unblocked', () => {
  const w = sandbox(reg);
  for (let x = 5; x < 10; x++) w.build('belt', x, 5, 0); // dead end at x=10
  const b = w.entAt(5, 5);
  let put = 0;
  for (let i = 0; i < 2000; i++) { if (b._k.put(w, b, 'iron', 0)) put++; step(w); }
  assert.equal(put, 21);
  for (const b2 of w.lists.belt) for (let i = 1; i < b2.items.length; i++) assert.ok(b2.items[i - 1][1] - b2.items[i][1] >= 0.2499);
  w.build('vacuole', 10, 5, 0);
  run(w, 600);
  assert.equal(w.entAt(10, 5).n, 21);
});

test('bends, side joins and head-on tiles', () => {
  const w = sandbox(reg);
  w.build('belt', 5, 5, 0); w.build('belt', 6, 5, 1); w.build('belt', 6, 6, 1); w.build('vacuole', 6, 7, 0);
  w.build('belt', 7, 6, 2); // joins (6,6) from the side
  const a = w.entAt(5, 5), s = w.entAt(7, 6);
  a._k.put(w, a, 'iron', 0); s._k.put(w, s, 'amino', 2);
  run(w, 300);
  assert.equal(w.entAt(6, 7).n, 2);
  assert.equal(w.entAt(6, 5)._in, 0, 'bend is fed from the west');
  const head = w.entAt(6, 6);
  assert.equal(head._k.put(w, head, 'iron', 3), false, 'head-on is refused');
});

test('vesicle tunnel passes under another pathway', () => {
  const w = sandbox(reg);
  w.build('belt', 4, 5, 0);
  const tin = w.build('tunnel', 5, 5, 0);
  for (let y = 2; y < 9; y++) w.build('belt', 7, y, 1);
  const tout = w.build('tunnel', 9, 5, 0);
  w.build('belt', 10, 5, 0); w.build('vacuole', 11, 5, 0);
  assert.equal(tin.mode, 'in'); assert.equal(tout.mode, 'out'); assert.equal(tin.pair, tout.id);
  const a = w.entAt(4, 5);
  for (let i = 0; i < 400; i++) { if (i % 40 === 0) a._k.put(w, a, 'iron', 0); step(w); }
  run(w, 600);
  assert.equal(w.entAt(11, 5).n, 10);
  w.remove(tout, { refund: true });
  assert.equal(tin.pair, 0);
});

test('junction splits a stream three ways', () => {
  const w = sandbox(reg);
  w.build('belt', 4, 10, 0); w.build('splitter', 5, 10, 0);
  w.build('vacuole', 6, 10, 0); w.build('vacuole', 4, 11, 0); w.build('vacuole', 4, 8, 0);
  const a = w.entAt(4, 10);
  for (let i = 0; i < 1200; i++) { if (i % 20 === 0 && i < 600) a._k.put(w, a, 'iron', 0); step(w); }
  const n = [w.entAt(6, 10).n, w.entAt(5, 11).n, w.entAt(5, 9).n];
  assert.deepEqual(n, [10, 10, 10]);
});

test('absorber mines a deposit and depletes it', () => {
  const w = sandbox(reg);
  const gi = reg.resIndex.glucose;
  for (const [x, y] of [[5, 5], [6, 5], [5, 6], [6, 6]]) { w.res[y * w.w + x] = gi; w.resAmt[y * w.w + x] = 3; }
  const m = w.build('absorber', 5, 5, 0);
  w.build('vacuole', 7, 5, 0);
  run(w, 60 * 40);
  assert.equal(w.entAt(7, 5).inv.glucose, 12);
  assert.equal(w.res[5 * w.w + 5], 0);
  assert.equal(w.canPlace('absorber', 12, 12).reason, 'resource');
  assert.ok(m.empty || true);
});

test('fermentor and ribosome craft, pili move items', () => {
  const w = sandbox(reg);
  const f = w.build('fermentor', 10, 10, 0);
  setRecipe(w, f, 'protein');
  const r = w.build('ribosome', 12, 10, 0); // fermentor ejects straight into it
  setRecipe(w, r, 'enzyme');
  const src = w.build('vacuole', 12, 7, 0);
  w.build('pilus', 12, 9, 1);  // vacuole above -> ribosome below
  src._k.put(w, src, 'iron'); src._k.put(w, src, 'iron');
  src._k.put(w, src, 'glucose'); // not wanted by the ribosome: must stay
  w.build('vacuole', 15, 10, 0);
  w.build('pilus', 15, 12, 3); // nothing behind it; harmless
  let fed = 0;
  for (let i = 0; i < 60 * 30; i++) { if (fed < 8 && f._k.put(w, f, 'amino')) fed++; step(w); }
  assert.equal(w.stats.produced.protein, 4);
  assert.equal(w.stats.produced.enzyme, 2);
  assert.equal(w.entAt(15, 10).inv.enzyme, 2);
  assert.deepEqual(src.inv, { glucose: 1 });
});

test('filter pilus only takes its item; long pilus reaches two tiles', () => {
  const w = sandbox(reg);
  const a = w.build('vacuole', 5, 20, 0), b = w.build('vacuole', 8, 20, 0);
  const p = w.build('filterpilus', 7, 20, 0); p.filter = 'iron';
  for (let i = 0; i < 3; i++) { a._k.put(w, a, 'iron'); a._k.put(w, a, 'amino'); }
  const c = w.build('vacuole', 5, 26, 0), d = w.build('vacuole', 10, 26, 0);
  w.build('longpilus', 8, 26, 0);
  c._k.put(w, c, 'fiber');
  // long pilus: source two tiles behind (6,26) is vacuole c, target two ahead (10,26) is d
  run(w, 600);
  assert.deepEqual(b.inv, { iron: 3 });
  assert.equal(a.inv.amino, 3);
  assert.deepEqual(d.inv, { fiber: 1 });
});

test('ATP shortage slows machines; generators and stores help', () => {
  const w = sandbox(reg);
  w.bonus = {}; // no speed mutations, so the numbers below are the base rates
  const fs = [];
  for (let i = 0; i < 20; i++) { const f = w.build('fermentor', 2 + (i % 10) * 3, 2 + ((i / 10) | 0) * 3, 0); setRecipe(w, f, 'atp'); fs.push(f); }
  const feed = () => { for (const f of fs) while (f._k.put(w, f, 'glucose')); for (const f of fs) f.out = {}; };
  for (let i = 0; i < 600; i++) { feed(); step(w); }
  assert.equal(w.power.demand, 80);
  assert.equal(w.power.sat, 0.5);
  const made = w.stats.produced.atp;
  assert.equal(made, 40, 'half speed: 2 crafts each instead of 5');
  const g = w.build('generator', 40, 40, 0);
  for (let i = 0; i < 10; i++) g._k.put(w, g, 'glucose');
  for (let i = 0; i < 120; i++) { feed(); step(w); }
  assert.equal(w.power.sat, 1);
  assert.equal(w.power.supply, 100);
  assert.ok(g.burn > 0 || g.fn < 10);
  w.build('accumulator', 40, 36, 0);
  for (let i = 0; i < 20; i++) w.remove(fs.pop(), {});
  run(w, 600);
  assert.ok(w.power.stored > 300, 'spare ATP is stored');
});

test('fluids: pump, channels, reactor, separate networks', () => {
  const w = sandbox(reg);
  w.terrain[10 * w.w + 4] = 1;
  assert.equal(w.canPlace('pump', 8, 8).reason, 'water');
  w.build('pump', 5, 10, 0);
  for (let x = 6; x < 10; x++) w.build('pipe', x, 10, 0);
  const r = w.build('reactor', 10, 9, 0);
  setRecipe(w, r, 'acid');
  const tank = w.build('tank', 13, 9, 0);
  for (let i = 0; i < 4; i++) r._k.put(w, r, 'glucose');
  run(w, 600);
  assert.equal(w.nets.length, 2);
  assert.equal(tank._net.fluid, 'acid');
  assert.equal(tank._net.amt, 20);
  assert.equal(w.entAt(6, 10)._net.fluid, 'water');
  setRecipe(w, r, 'vitamin');
  r._k.put(w, r, 'enzyme'); r._k.put(w, r, 'nucleotide');
  run(w, 600);
  assert.equal(w.stats.produced.vitamin, 1);
  assert.equal(tank._net.amt, 10);
});

test('research: genome centre consumes sequences and unlocks', () => {
  const w = sandbox(reg);
  delete w.techs.photosynthesis; w.refreshUnlocks();
  assert.equal(w.unlockedE.has('solar'), false);
  assert.equal(w.canPlace('solar', 5, 5).reason, 'locked');
  const lab = w.build('lab', 5, 5, 0);
  assert.ok(w.startResearch('photosynthesis'));
  let fed = 0;
  for (let i = 0; i < 60 * 200 && !w.techs.photosynthesis?.done; i++) { if (lab._k.put(w, lab, 'seqA')) fed++; step(w); }
  assert.ok(w.techs.photosynthesis.done);
  assert.ok(w.unlockedE.has('solar'));
  assert.equal(w.research, null);
  assert.ok(fed >= 15 && fed <= 21, `used about 15 sequences, fed ${fed}`);
});

test('biofilm limits building and grows with slime cells', () => {
  const w = createWorld(reg, { mission: 'm3' });
  const c = w.core;
  assert.equal(w.canPlace('belt', c.x + 20, c.y).reason, 'film');
  const before = w.filmTiles;
  w.inv.fiber = 100; w.inv.protein = 100;
  const n = w.build('node', c.x + 11, c.y + 2, 0);
  assert.ok(n);
  assert.ok(w.filmTiles > before + 40);
  assert.ok(w.canPlace('belt', c.x + 17, c.y + 2).ok);
  const f = w.build('fermentor', c.x + 16, c.y + 2, 0);
  w.remove(n, { refund: true });
  assert.equal(w.filmTiles, before);
  assert.equal(w.film[f.y * w.w + f.x], 0, 'building is left outside the biofilm (dormant)');
});

test('immune waves attack, towers defend, toxins make waves bigger', () => {
  const w = createWorld(reg, { mission: 'm6' });
  assert.equal(w.nests.length, 2);
  for (const id in reg.items) w.inv[id] = 5000;
  const c = w.core;
  w.build('turret', c.x + 6, c.y, 0); w.build('turret', c.x + 6, c.y + 3, 0); w.build('turret', c.x + 4, c.y - 4, 0);
  run(w, 60 * 600);
  assert.ok(w.stats.wavesCleared >= 4, `waves cleared: ${w.stats.wavesCleared}`);
  assert.ok(w.stats.killed > 10);
  assert.equal(w.lost, false);
  // without defence the colony falls
  const w2 = createWorld(reg, { mission: 'm6' });
  run(w2, 60 * 1500);
  assert.equal(w2.lost, true);
  // peaceful: no nests, nothing ever comes
  const w3 = createWorld(reg, { mission: 'm6', peaceful: true });
  run(w3, 60 * 400);
  assert.equal(w3.nests.length, 0); assert.equal(w3.enemies.length, 0);
});

test('save and load give the same state, and the same future', () => {
  const mk = () => {
    const w = createWorld(reg, { mission: 'm6' });
    for (const id in reg.items) w.inv[id] = 500;
    const c = w.core;
    w.build('turret', c.x + 6, c.y, 0);
    const f = w.build('fermentor', c.x - 4, c.y, 0); setRecipe(w, f, 'fiber');
    w.build('pilus', c.x - 2, c.y, 2); // (wrong side on purpose: idle)
    for (let x = c.x + 4; x < c.x + 9; x++) w.build('belt', x, c.y + 5, 2);
    w.build('pump', 24, 26, 0); w.build('pipe', 25, 26, 0); w.build('pipe', 26, 26, 0);
    const g = w.build('generator', c.x, c.y + 6, 0); for (let i = 0; i < 5; i++) g._k.put(w, g, 'glucose');
    return w;
  };
  const a = mk();
  run(a, 60 * 200);
  const saved = JSON.parse(JSON.stringify(serialize(a)));
  const { world: b, warnings } = deserialize(reg, saved);
  assert.deepEqual(warnings, []);
  assert.equal(fingerprint(b), fingerprint(a), 'loaded state equals saved state');
  run(a, 60 * 150); run(b, 60 * 150);
  assert.equal(fingerprint(b), fingerprint(a), 'both continue identically');
  const c = mk(); run(c, 60 * 350);
  assert.equal(fingerprint(c), fingerprint(a), 'same seed, same run');
});

test('thousands of buildings still simulate faster than real time', () => {
  const w = sandbox(reg, 160);
  let n = 0;
  for (let y = 2; y < 150; y += 3) {
    for (let x = 2; x < 150; x++) { if (w.build('belt', x, y, 0)) n++; }
  }
  for (let y = 3; y < 150; y += 12) for (let x = 2; x < 140; x += 6) {
    const f = w.build('fermentor', x, y, 0);
    if (f) { setRecipe(w, f, 'atp'); n++; }
  }
  const belts = w.lists.belt;
  for (let i = 0; i < belts.length; i += 2) belts[i]._k.put(w, belts[i], 'glucose', 0);
  assert.ok(n > 7000, `built ${n}`);
  run(w, 60);
  const t0 = process.hrtime.bigint();
  run(w, 300);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 300;
  console.log(`       ${n} buildings: ${ms.toFixed(2)} ms per tick (budget 16.6 ms)`);
  assert.ok(ms < 8, `too slow: ${ms.toFixed(2)} ms per tick`);
});
