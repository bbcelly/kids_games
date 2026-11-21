// Proof that the campaign can be finished: a scripted player wins every mission, with the
// immune system on and in peaceful mode, using only moves a real player has.
import { test, assert, makeReg } from './helpers.js';
import { createWorld } from '../public/sim/sim.js';
import { bonusEarned } from '../public/sim/objectives.js';
import { Bot } from './bot.js';
import { setRecipe } from '../public/sim/kinds.js';

export const reg = makeReg();

// the usual start: glucose to the Core, a fibre line and a protein line
function basics(b, o = {}) {
  b.mine('glucose');
  const ff = b.machine('fermentor', 'fiber', b.w.core, o.fiberAt || b.towards('glucose', 5));
  b.mine('glucose', ff);
  const fp = b.machine('fermentor', 'protein', b.w.core, o.proteinAt || b.towards('amino', 5));
  b.mine('amino', fp);
  if (o.iron !== false) b.mine('iron');
}

function towers(b, places) {
  if (b.w.peaceful) return;
  for (const [x, y] of places) { const [sx, sy] = b.spot(2, x, y, { margin: 0 }); b.build('turret', sx, sy, 0); }
}

export const PLAY = {
  m1(b) {
    b.harvest('glucose', 15);
    b.mine('glucose');
    const f = b.machine('fermentor', 'atp');
    b.mine('glucose', f);
  },

  m2(b) {
    const rib = b.slot('N', 3);
    basics(b);
    b.fill(rib, 'ribosome', 'enzyme');
  },

  m3(b, w) {
    const gen = b.slot('E', 2, 0), rib = b.slot('N', 3);
    basics(b);
    b.fill(gen, 'generator', null, { out: false });
    const [vx, vy] = b.spot(2, b.cx + 2, b.cy + 9);
    b.build('vacuole', vx, vy, 0);
    b.fill(rib, 'ribosome', 'enzyme');
    while (w.counts.node < 3 || w.filmTiles < 520) b.growFilm();
  },

  m4(b, w) {
    const lab = b.slot('N', 3), rib = b.slot('W', 3);
    basics(b);
    b.fill(lab, 'lab', null, { out: false });
    const r = b.fill(rib, 'ribosome', 'seqA');
    b.research('photosynthesis');
    b.research('absorption');
    b.until(() => (w.stats.produced.seqA || 0) >= 30, 600, 'seqA');
    b.craft(r, 'enzyme', 10);
    for (let i = 0; i < 2; i++) { const [x, y] = b.spot(2, b.cx + 8, b.cy + 8); b.build('solar', x, y, 0); }
  },

  m5(b, w) {
    const atp = b.slot('E', 2, 0), rib = b.slot('W', 3), rea = b.slot('S', 3), lab = b.slot('N', 3);
    basics(b);
    const fa = b.fill(atp, 'fermentor', null);
    const r = b.fill(rib, 'ribosome', null);
    b.fill(lab, 'lab', null, { out: false });
    const x = b.fill(rea, 'reactor', null);
    b.pumpTo(x);
    b.craft(x, 'lipid', 20);
    w.startResearch('membranes');
    b.stock(r, 'enzyme', 26);
    b.craft(fa, 'atp', 26);
    b.craft(r, 'seqA', 25);
    b.craft(r, 'seqB', 25);
    b.research('membranes');
    b.stock(x, 'lipid', 20);
    b.craft(r, 'membrane', 10);
  },

  m6(b, w) {
    const rib = b.slot('W', 3);
    towers(b, [[b.cx + 9, b.cy], [b.cx + 9, b.cy + 4], [b.cx + 7, b.cy - 5]]);
    if (w.peaceful) for (let i = 0; i < 3; i++) { const [x, y] = b.spot(2, b.cx + 9, b.cy + i * 3, { margin: 0 }); b.build('turret', x, y, 0); }
    for (let i = 0; i < 8; i++) { const [x, y] = b.spot(1, b.cx + 12, b.cy - 2 + i, { margin: 0 }); b.build('wall', x, y, 0); }
    basics(b);
    const r = b.fill(rib, 'ribosome', null);
    while (!w.won) { b.stock(r, 'enzyme', 14); b.craft(r, 'bacteriocin', 36); }
  },

  m7(b, w) {
    const atp = b.slot('E', 2, 0), arm = b.slot('E', 3, 2), rib = b.slot('W', 3), rea = b.slot('S', 3), lab = b.slot('N', 3);
    towers(b, [[b.cx + 10, b.cy - 1], [b.cx + 10, b.cy + 4], [b.cx + 9, b.cy + 8], [b.cx + 8, b.cy - 5]]);
    basics(b);
    b.mine('phosphate');
    const fa = b.fill(atp, 'fermentor', null);
    const r = b.fill(rib, 'ribosome', null);
    armoury(b, arm, r);
    b.fill(lab, 'lab', null, { out: false });
    const x = b.fill(rea, 'reactor', null);
    b.tankAt(x);
    b.pumpTo(x);
    const enzyme = (n) => b.stock(r, 'enzyme', n + (w.peaceful ? 0 : 20));
    w.startResearch('resistance');
    enzyme(40);
    b.craft(fa, 'atp', 64);
    b.craft(x, 'nucleotide', 82);
    b.stock(x, 'lipid', 32);
    b.craft(r, 'rna', 30);
    b.craft(r, 'seqC', 30);
    b.craft(r, 'seqA', 30);
    enzyme(32);
    b.craft(r, 'seqB', 30);
    b.research('resistance');
    enzyme(22);
    b.craft(x, 'acid', 100);
    b.craft(x, 'vitamin', 10);
    b.craft(x, 'acid', 100);
    b.craft(x, 'vitamin', 10);
  },

  m8(b, w) {
    const atp = b.slot('E', 2, 0), arm = b.slot('E', 3, 2), rib = b.slot('W', 3), rea = b.slot('S', 3), spo = b.slot('N', 4);
    towers(b, [[b.cx + 9, b.cy + 8], [b.cx + 6, b.cy + 10], [b.cx - 5, b.cy - 5], [b.cx - 7, b.cy - 2]]);
    basics(b);
    b.mine('phosphate');
    const fa = b.fill(atp, 'fermentor', null);
    const r = b.fill(rib, 'ribosome', null);
    armoury(b, arm, r);
    const x = b.fill(rea, 'reactor', null);
    b.pumpTo(x);
    const enzyme = (n) => b.stock(r, 'enzyme', n + (w.peaceful ? 0 : 20));
    b.craft(fa, 'atp', 80);
    b.craft(x, 'nucleotide', 80);
    b.craft(r, 'rna', 40);
    enzyme(24);
    b.craft(r, 'dna', 20);
    b.stock(x, 'lipid', 60);
    b.stock(r, 'membrane', 46);
    enzyme(10);
    b.craft(r, 'plasmid', 10);
    const s = b.fill(spo, 'sporangium', 'spore', { out: false });
    b.pumpTo(s);
  },
};

// Free play from an empty start: research the whole chain up to Sporulation, then release spores.
export function playFree(b, w, spores = 3) {
  const atp = b.slot('E', 2, 0), rib = b.slot('W', 3), rea = b.slot('S', 3), lab = b.slot('N', 3);
  basics(b);
  b.mine('phosphate');
  const fa = b.fill(atp, 'fermentor', null), r = b.fill(rib, 'ribosome', null);
  b.fill(lab, 'lab', null, { out: false });
  const A = (n) => b.craft(r, 'seqA', n);
  const B = (n) => { b.stock(r, 'enzyme', n); b.craft(fa, 'atp', n); b.craft(r, 'seqB', n); };
  const go = (id, ...packs) => { w.startResearch(id); const u = w.reg.techs[id].units; for (const p of packs) p(u); b.research(id, 3000); };
  go('osmosis', A);
  b.stock(r, 'enzyme', 10);
  const x = b.fill(rea, 'reactor', null);
  b.pumpTo(x);
  go('hemes', A); go('seqB', A);
  go('membranes', A, B); go('nucleotides', A, B); go('seqC', A, B);
  const rna = (n) => { b.craft(x, 'nucleotide', 2 * n); b.craft(fa, 'atp', n); b.craft(r, 'rna', n); };
  const C = (n) => { rna(n); b.stock(x, 'lipid', n); b.craft(r, 'seqC', n); };
  go('dnatech', A, B, C); go('seqD', A, B, C);
  const dna = (n) => { rna(2 * n); b.stock(r, 'enzyme', n); b.craft(r, 'dna', n); };
  const membrane = (n) => { b.craft(x, 'lipid', 2 * n); b.craft(r, 'membrane', n); };
  const D = (n) => { dna(n); b.craft(r, 'heme', n); membrane(n); b.craft(r, 'seqD', n); };
  go('sporulation', A, B, C, D);
  // the Sporangium itself, then what the spores need
  dna(2 * 4 + 4 * spores); membrane(4 + 2 * spores + 20 + 4 * spores);
  b.craft(r, 'plasmid', 4 + 2 * spores);
  b.craft(x, 'gel', 20); b.craft(r, 'heme', 10); b.craft(fa, 'atp', 10 * spores);
  // the Genome centre has done its job: its place next to the Core goes to the Sporangium
  for (const e of [...w.list]) if (e.type === 'lab' || (e.type === 'pilus' && e.y === b.cy - 1)) w.remove(e, { refund: true });
  const s = b.fill(b.slot('N', 4), 'sporangium', 'spore', { out: false });
  b.pumpTo(s);
  b.until(() => w.stats.launched >= spores, 1200, 'launch spores');
}

// A second ribosome that only makes bacteriocin, switched on whenever the stock runs low.
// While the main ribosome has nothing else to do, it keeps a reserve of enzyme for it.
function armoury(b, slot, main) {
  const w = b.w;
  if (w.peaceful) return;
  const a = b.fill(slot, 'ribosome', null);
  b.onIdle = () => {
    const low = (w.inv.bacteriocin || 0) < 120;
    if (low !== (a.recipe === 'bacteriocin')) setRecipe(w, a, low ? 'bacteriocin' : null);
    if (b.busy.has(main)) return;
    const e = w.inv.enzyme || 0;
    if (e < 25 && main.recipe !== 'enzyme') setRecipe(w, main, 'enzyme');
    else if (e > 60 && main.recipe === 'enzyme') setRecipe(w, main, null);
  };
}

export function playMission(id, peaceful, limitMin = 90) {
  const w = createWorld(reg, { mission: id, peaceful });
  const b = new Bot(w);
  PLAY[id](b, w);
  b.until(() => w.won, limitMin * 60, `win ${id}`);
  return w;
}

for (const id of Object.keys(PLAY)) {
  for (const peaceful of [false, true]) {
    test(`campaign ${id} can be won (${peaceful ? 'peaceful' : 'immune system on'})`, () => {
      const w = playMission(id, peaceful);
      assert.equal(w.won, true);
      assert.equal(w.lost, false);
      const min = (w.wonTick / 3600).toFixed(1), bonus = reg.missions[id].bonus;
      console.log(`       won after ${min} game minutes${bonus ? ` (bonus limit ${bonus.minutes} min: ${bonusEarned(w) ? 'earned' : 'missed'})` : ''}`);
    });
  }
}

test('free play: from an empty start through the whole mutation chain to the first spores', () => {
  const w = createWorld(reg, { mission: 'free', seed: 3, peaceful: true, size: [128, 128] });
  const b = new Bot(w);
  playFree(b, w, 3);
  assert.ok(w.techs.sporulation.done);
  assert.equal(w.stats.launched >= 3, true);
  assert.equal(w.won, false, 'the free-play goal is 100 spores');
  console.log(`       first 3 spores after ${(w.tick / 216000).toFixed(1)} game hours with one machine of each kind`);
});

test('free-play maps: every seed has all resources, water and light within reach of the Core', () => {
  for (const size of [96, 128, 176]) for (let seed = 1; seed <= 12; seed++) {
    for (const peaceful of [true, false]) {
      const w = createWorld(reg, { mission: 'free', seed, peaceful, size: [size, size] });
      const c = w.core, seen = new Uint8Array(w.w * w.h), q = [c.y * w.w + c.x - 1], found = new Set();
      let water = false, light = false;
      seen[q[0]] = 1;
      for (let h = 0; h < q.length; h++) {
        const k = q[h], x = k % w.w, y = (k / w.w) | 0;
        if (w.res[k]) found.add(reg.resIds[w.res[k]]);
        if (w.light[k]) light = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, nk = ny * w.w + nx;
          if (!w.inb(nx, ny) || seen[nk]) continue;
          if (w.terrain[nk] === 1) { water = true; continue; }
          if (w.terrain[nk] !== 0 || (w.occ[nk] && w.ents.get(w.occ[nk]) !== c)) continue;
          seen[nk] = 1; q.push(nk);
        }
      }
      const label = `size ${size} seed ${seed}`;
      assert.deepEqual([...found].sort(), ['amino', 'glucose', 'iron', 'phosphate'], label);
      assert.ok(water && light, label + ': water/light');
      assert.equal(w.nests.length > 0, !peaceful, label + ': nests');
      // near the Core: glucose and amino acids inside or just outside the first biofilm
      const near = (res) => { let d = 1e9; for (let i = 0; i < w.res.length; i++) if (w.res[i] === reg.resIndex[res]) d = Math.min(d, Math.hypot(i % w.w - c.x - 2, ((i / w.w) | 0) - c.y - 2)); return d; };
      assert.ok(near('glucose') < 10 && near('amino') < 13 && near('iron') < 16 && near('phosphate') < 19, label + ': start deposits');
      for (const n of w.nests) assert.ok(Math.hypot(n.x - c.x, n.y - c.y) > 30, label + ': nest too close');
    }
  }
});
