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
