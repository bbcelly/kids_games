// The campaign (m1..m8) and free play. Texts live in locale/*.js under mission.<id>.*
import { generateFree } from '../sim/mapgen.js';
import { TIER0, TIER1, TIER2, TIER3, TIER4 } from './data.js';

export function missions(api) {
  const M = (id, def) => api.mission(id, def);

  M('m1', {
    campaign: 1, size: [64, 64], seed: 11,
    setup(w, h) {
      h.core(30, 30);
      h.deposit('glucose', 41, 31, 3.2, 500);
      h.deposit('glucose', 24, 39, 2.6, 400);
      h.light(32, 32, 14);
    },
    start: { items: { glucose: 30 }, techs: ['basics'] },
    techs: ['basics'],
    objectives: [
      { id: 'hand', type: 'deliver', item: 'glucose', count: 15 },
      { id: 'absorber', type: 'build', entity: 'absorber', count: 1 },
      { id: 'belt', type: 'build', entity: 'belt', count: 4 },
      { id: 'flow', type: 'deliver', item: 'glucose', count: 60 },
      { id: 'fermentor', type: 'build', entity: 'fermentor', count: 1 },
      { id: 'atp', type: 'deliver', item: 'atp', count: 20 },
    ],
    bonus: { type: 'time', minutes: 8 },
  });

  M('m2', {
    campaign: 2, size: [64, 64], seed: 12,
    setup(w, h) {
      h.core(30, 30);
      h.deposit('glucose', 41, 31, 3.2, 700);
      h.deposit('amino', 23, 30, 3.2, 700);
      h.deposit('iron', 32, 41, 2.8, 500);
      h.light(32, 32, 14);
    },
    start: { items: { glucose: 70, amino: 10 }, techs: ['basics', 'proteins'] },
    techs: ['basics', 'proteins'],
    objectives: [
      { id: 'protein', type: 'deliver', item: 'protein', count: 20 },
      { id: 'fiber', type: 'deliver', item: 'fiber', count: 20 },
      { id: 'ribosome', type: 'build', entity: 'ribosome', count: 1 },
      { id: 'pilus', type: 'build', entity: 'pilus', count: 2 },
      { id: 'enzyme', type: 'deliver', item: 'enzyme', count: 15 },
    ],
    bonus: { type: 'time', minutes: 12 },
  });

  M('m3', {
    campaign: 3, size: [72, 72], seed: 13,
    setup(w, h) {
      h.core(34, 34);
      h.deposit('glucose', 45, 35, 3.2, 900);
      h.deposit('amino', 18, 34, 3.4, 900);
      h.deposit('iron', 36, 55, 3.2, 700);
      h.rock(50, 22, 3); h.rock(22, 50, 2.5);
      h.light(36, 36, 16);
    },
    start: { items: { glucose: 80, protein: 30, fiber: 70 }, techs: ['basics', 'proteins', 'colony'] },
    techs: ['basics', 'proteins', 'colony'],
    objectives: [
      { id: 'node', type: 'build', entity: 'node', count: 3 },
      { id: 'film', type: 'film', count: 520 },
      { id: 'generator', type: 'build', entity: 'generator', count: 1 },
      { id: 'power', type: 'power', count: 100 },
      { id: 'vacuole', type: 'build', entity: 'vacuole', count: 1 },
      { id: 'enzyme', type: 'deliver', item: 'enzyme', count: 20 },
    ],
    bonus: { type: 'time', minutes: 15 },
  });

  M('m4', {
    campaign: 4, size: [72, 72], seed: 14,
    setup(w, h) {
      h.core(34, 34);
      h.deposit('glucose', 45, 35, 3.2, 1200);
      h.deposit('amino', 27, 33, 3.2, 1200);
      h.deposit('iron', 35, 46, 3, 800);
      h.light(44, 44, 5.5); h.light(26, 26, 4);
      h.rock(52, 24, 3);
    },
    start: { items: { glucose: 80, protein: 40, fiber: 50, iron: 20 }, techs: TIER0 },
    techs: [...TIER0, ...TIER1],
    objectives: [
      { id: 'lab', type: 'build', entity: 'lab', count: 1 },
      { id: 'seqA', type: 'produce', item: 'seqA', count: 30 },
      { id: 'photo', type: 'research', tech: 'photosynthesis' },
      { id: 'absorb', type: 'research', tech: 'absorption' },
      { id: 'solar', type: 'build', entity: 'solar', count: 2 },
    ],
    bonus: { type: 'time', minutes: 18 },
  });

  M('m5', {
    campaign: 5, size: [72, 72], seed: 15,
    setup(w, h) {
      h.core(34, 34);
      h.deposit('glucose', 45, 35, 3.2, 1500);
      h.deposit('amino', 27, 33, 3.2, 1500);
      h.deposit('iron', 37, 46, 3, 1000);
      h.water(26, 44, 3.6); h.water(54, 50, 5);
      h.light(44, 26, 5);
    },
    start: { items: { glucose: 100, protein: 60, fiber: 60, iron: 40, enzyme: 20 }, techs: [...TIER0, 'photosynthesis', 'osmosis', 'hemes', 'seqB'] },
    techs: [...TIER0, ...TIER1, 'membranes', 'flagella', 'sorting'],
    objectives: [
      { id: 'pump', type: 'build', entity: 'pump', count: 1 },
      { id: 'reactor', type: 'build', entity: 'reactor', count: 1 },
      { id: 'lipid', type: 'produce', item: 'lipid', count: 20 },
      { id: 'membranes', type: 'research', tech: 'membranes' },
      { id: 'membrane', type: 'produce', item: 'membrane', count: 10 },
    ],
    bonus: { type: 'time', minutes: 22 },
  });

  M('m6', {
    campaign: 6, size: [80, 72], seed: 16,
    setup(w, h) {
      h.core(30, 34);
      h.deposit('glucose', 41, 35, 3.2, 1500);
      h.deposit('amino', 23, 33, 3.2, 1500);
      h.deposit('iron', 32, 45, 3, 1200);
      h.water(22, 24, 3);
      h.rock(52, 20, 4); h.rock(54, 52, 4);
      h.light(32, 36, 12);
      h.nest(68, 33); h.nest(64, 12);
    },
    start: { items: { glucose: 100, protein: 80, fiber: 80, iron: 60, enzyme: 40, bacteriocin: 30 }, techs: [...TIER0, ...TIER1] },
    techs: [...TIER0, ...TIER1, 'toxins2', 'slime2', 'flagella', 'sorting', 'membranes'],
    threat: { first: 170, interval: 80, base: 2, growth: 1.2, max: 14, types: [{ id: 'neutrophil', from: 0 }, { id: 'macrophage', from: 4 }] },
    objectives: [
      { id: 'ammo', type: 'produce', item: 'bacteriocin', count: 40 },
      { id: 'turret', type: 'build', entity: 'turret', count: 3 },
      { id: 'wall', type: 'build', entity: 'wall', count: 8 },
      { id: 'waves', type: 'survive', count: 5, threatOnly: true },
      { id: 'stock', type: 'produce', item: 'bacteriocin', count: 160, peacefulOnly: true },
    ],
    bonus: { type: 'time', minutes: 14 },
  });

  M('m7', {
    campaign: 7, size: [104, 56], seed: 17,
    setup(w, h) {
      // the gut: a long tunnel between two folded walls
      for (let x = 0; x < w.w; x++) {
        const top = 7 + Math.round(Math.sin(x * 0.21) * 3 + Math.sin(x * 0.07) * 2);
        const bot = w.h - 8 + Math.round(Math.sin(x * 0.17 + 2) * 3 + Math.sin(x * 0.05) * 2);
        h.rockRect(x, 0, x, top); h.rockRect(x, bot, x, w.h - 1);
      }
      h.core(22, 26);
      h.deposit('glucose', 33, 27, 3.2, 2500);
      h.deposit('amino', 15, 25, 3, 2500);
      h.deposit('iron', 24, 37, 2.8, 1800);
      h.deposit('phosphate', 25, 17, 2.8, 1800);
      h.water(36, 37, 3.2);
      h.nest(92, 22); h.nest(88, 34);
    },
    start: {
      items: { glucose: 150, protein: 120, fiber: 120, iron: 80, enzyme: 60, lipid: 30, gel: 20, bacteriocin: 60 },
      techs: [...TIER0, ...TIER1, ...TIER2, 'vitamins'],
    },
    techs: [...TIER0, ...TIER1, ...TIER2, ...TIER3.filter(t => t !== 'seqD')],
    threat: {
      first: 240, interval: 110, base: 2, growth: 0.6, max: 9,
      types: [{ id: 'neutrophil', from: 0 }, { id: 'phage', from: 2 }, { id: 'macrophage', from: 5 }],
      antibiotic: { first: 300, interval: 150, duration: 40 },
    },
    objectives: [
      { id: 'seqC', type: 'produce', item: 'seqC', count: 20 },
      { id: 'resist', type: 'research', tech: 'resistance' },
      { id: 'vitamin', type: 'deliver', item: 'vitamin', count: 20 },
    ],
    bonus: { type: 'time', minutes: 35 },
  });

  M('m8', {
    campaign: 8, size: [88, 88], seed: 18,
    setup(w, h) {
      h.core(42, 42);
      h.deposit('glucose', 53, 43, 3.4, 4000);
      h.deposit('amino', 35, 41, 3.2, 3000);
      h.deposit('iron', 45, 54, 3, 2500);
      h.deposit('phosphate', 44, 33, 3, 2500);
      h.water(33, 52, 3.4); h.water(60, 28, 4);
      h.rock(24, 24, 4); h.rock(66, 62, 4);
      h.light(44, 44, 9); h.light(62, 44, 5);
      h.nest(76, 76); h.nest(10, 12);
    },
    start: {
      items: { glucose: 200, protein: 150, fiber: 150, iron: 100, enzyme: 80, lipid: 40, gel: 40, membrane: 20, heme: 20, bacteriocin: 80 },
      techs: [...TIER0, ...TIER1, ...TIER2, ...TIER3, ...TIER4],
    },
    threat: {
      first: 300, interval: 130, base: 2, growth: 0.8, max: 12,
      types: [{ id: 'neutrophil', from: 0 }, { id: 'macrophage', from: 4 }, { id: 'phage', from: 6 }],
    },
    objectives: [
      { id: 'sporangium', type: 'build', entity: 'sporangium', count: 1 },
      { id: 'launch', type: 'launch', count: 3 },
    ],
    bonus: { type: 'time', minutes: 45 },
  });

  M('free', {
    free: true, size: [128, 128],
    setup(w, h, o) { generateFree(w, h, o); },
    start: { items: { glucose: 60, amino: 20, fiber: 20, protein: 10 }, techs: TIER0 },
    threat: {
      first: 600, interval: 180, base: 1, growth: 0.6, max: 30,
      types: [{ id: 'neutrophil', from: 0 }, { id: 'macrophage', from: 5 }, { id: 'phage', from: 8 }],
    },
    objectives: [{ id: 'launch', type: 'launch', count: 100 }],
  });
}
