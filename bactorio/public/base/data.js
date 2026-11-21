// Base game content: items, fluids, deposits, recipes, buildings, mutations and immune cells.
// It goes through the same api a mod gets, so this file doubles as a reference for modders.
export function data(api) {
  // ---- items ------------------------------------------------------------------------------
  const item = (id, shape, color, extra = {}) => api.item(id, { icon: { shape, color }, ...extra });
  item('glucose', 'hex', '#f2c94c', { fuel: 60 });
  item('amino', 'chain', '#6fcf97');
  item('iron', 'crystal', '#c9703a');
  item('phosphate', 'crystal', '#9b8cf0');
  item('atp', 'bolt', '#ffe14d', { fuel: 300 });
  item('protein', 'knot', '#27ae60');
  item('fiber', 'rod', '#d8c9a3');
  item('enzyme', 'pac', '#eb5757');
  item('heme', 'ring', '#b03a2e');
  item('lipid', 'drop', '#f2994a');
  item('gel', 'cube', '#8fe3c0');
  item('membrane', 'wave', '#f7b267');
  item('flagellin', 'spiral', '#56ccf2');
  item('nucleotide', 'diamond', '#bb6bd9');
  item('rna', 'strand', '#e056fd');
  item('dna', 'helix', '#2d9cdb');
  item('plasmid', 'loop', '#2f80ed');
  item('bacteriocin', 'spike', '#ff4d6d');
  item('vitamin', 'pill', '#f78fb3', { calm: 3 }); // delivered to the Core, it soothes the host
  item('spore', 'orb', '#fdf5c9');
  item('seqA', 'seq', '#ff6b6b', { science: true });
  item('seqB', 'seq', '#51cf66', { science: true });
  item('seqC', 'seq', '#4dabf7', { science: true });
  item('seqD', 'seq', '#b197fc', { science: true });

  api.fluid('water', { color: '#4aa3df' });
  api.fluid('acid', { color: '#c6e84a' });

  api.resource('glucose', { item: 'glucose', color: '#f2c94c' });
  api.resource('amino', { item: 'amino', color: '#6fcf97' });
  api.resource('iron', { item: 'iron', color: '#c9703a' });
  api.resource('phosphate', { item: 'phosphate', color: '#9b8cf0' });

  // ---- recipes ----------------------------------------------------------------------------
  const R = (id, category, time, inp, out, extra = {}) => api.recipe(id, { category, time, in: inp, out, ...extra });
  R('atp', 'ferment', 2, { glucose: 2 }, { atp: 1 });
  R('protein', 'ferment', 2, { amino: 2 }, { protein: 1 });
  R('fiber', 'ferment', 1.5, { glucose: 2 }, { fiber: 1 });
  R('enzyme', 'assemble', 3, { protein: 2, iron: 1 }, { enzyme: 1 });
  R('seqA', 'assemble', 4, { protein: 1, fiber: 1 }, { seqA: 1 });
  R('heme', 'assemble', 3, { iron: 2, protein: 1 }, { heme: 1 });
  R('seqB', 'assemble', 5, { enzyme: 1, atp: 1 }, { seqB: 1 });
  R('bacteriocin', 'assemble', 3, { protein: 1, enzyme: 1 }, { bacteriocin: 6 });
  R('membrane', 'assemble', 4, { lipid: 2, protein: 1 }, { membrane: 1 });
  R('flagellin', 'assemble', 3, { protein: 2, atp: 1 }, { flagellin: 1 });
  R('rna', 'assemble', 4, { nucleotide: 2, atp: 1 }, { rna: 1 });
  R('seqC', 'assemble', 6, { rna: 1, lipid: 1 }, { seqC: 1 });
  R('dna', 'assemble', 5, { rna: 2, enzyme: 1 }, { dna: 1 });
  R('plasmid', 'assemble', 6, { dna: 2, membrane: 1 }, { plasmid: 1 });
  R('seqD', 'assemble', 8, { dna: 1, heme: 1, membrane: 1 }, { seqD: 1 });
  R('lipid', 'react', 3, { glucose: 2 }, { lipid: 1 }, { fin: { water: 10 } });
  R('gel', 'react', 3, { fiber: 2 }, { gel: 1 }, { fin: { water: 10 } });
  R('nucleotide', 'react', 3, { phosphate: 1, glucose: 1 }, { nucleotide: 2 }, { fin: { water: 10 } });
  R('acid', 'react', 2, { glucose: 2 }, {}, { fin: { water: 10 }, fout: { acid: 10 } });
  R('vitamin', 'react', 5, { enzyme: 1, nucleotide: 1 }, { vitamin: 1 }, { fin: { acid: 10 } });
  R('spore', 'spore', 20, { plasmid: 2, membrane: 4, atp: 10 }, { spore: 1 }, { fin: { water: 20 } });

  // ---- buildings --------------------------------------------------------------------------
  const E = (id, kind, size, group, def) => api.entity(id, { kind, size: [size, size], group, ...def });
  E('core', 'core', 4, 'colony', { hp: 2000, film: 10, basePower: 40, color: '#7bdcb5', buildable: false });
  E('node', 'node', 1, 'colony', { hp: 120, film: 6.5, cost: { fiber: 15, protein: 5 }, color: '#9be7c4' });
  E('vacuole', 'storage', 2, 'colony', { hp: 150, capacity: 200, cost: { fiber: 10 }, color: '#a5d8ff' });

  E('belt', 'belt', 1, 'logistics', { hp: 40, speed: 2, cost: { glucose: 1 }, color: '#5b8a72' });
  E('fastbelt', 'belt', 1, 'logistics', { hp: 50, speed: 4, cost: { flagellin: 1, fiber: 1 }, color: '#3fa7d6' });
  E('tunnel', 'belt', 1, 'logistics', { hp: 60, speed: 2, tunnel: true, reach: 5, cost: { fiber: 5, protein: 2 }, color: '#8d7b68' });
  E('splitter', 'splitter', 1, 'logistics', { hp: 60, cost: { fiber: 4, protein: 2 }, color: '#c9b458' });
  E('pilus', 'pilus', 1, 'logistics', { hp: 40, swing: 20, cost: { fiber: 2, protein: 1 }, color: '#e8a87c' });
  E('longpilus', 'pilus', 1, 'logistics', { hp: 40, swing: 20, reach: 2, cost: { flagellin: 2, protein: 2 }, color: '#56ccf2' });
  E('filterpilus', 'pilus', 1, 'logistics', { hp: 40, swing: 18, filter: true, cost: { enzyme: 2, fiber: 2, protein: 2 }, color: '#eb5757' });

  E('absorber', 'miner', 2, 'production', { hp: 100, speed: 0.7, power: 2, pollution: 0.03, cost: { glucose: 10 }, color: '#e0b84c' });
  E('fermentor', 'crafter', 2, 'production', { hp: 120, category: 'ferment', speed: 1, power: 4, pollution: 0.08, cost: { glucose: 20 }, color: '#d98c4a' });
  E('ribosome', 'crafter', 3, 'production', { hp: 180, category: 'assemble', speed: 1, power: 8, pollution: 0.12, cost: { protein: 10, fiber: 10 }, color: '#4fb286' });
  E('reactor', 'crafter', 3, 'production', { hp: 200, category: 'react', speed: 1, power: 12, pollution: 0.25, fluidUser: true, cost: { protein: 20, enzyme: 10, iron: 10 }, color: '#7c6fd6' });
  E('sporangium', 'crafter', 4, 'production', { hp: 500, category: 'spore', speed: 1, power: 30, pollution: 0.3, fluidUser: true, launch: 'spore', cost: { plasmid: 4, membrane: 20, gel: 20, heme: 10 }, color: '#f3e7a1' });

  E('generator', 'generator', 2, 'energy', { hp: 120, power: 60, pollution: 0.25, cost: { protein: 10, iron: 5 }, color: '#f08a4b' });
  E('solar', 'solar', 2, 'energy', { hp: 80, power: 25, dim: 0.15, cost: { protein: 10, enzyme: 5 }, color: '#74c365' });
  E('accumulator', 'accumulator', 2, 'energy', { hp: 100, store: 3000, cost: { lipid: 10, gel: 5 }, color: '#ffd166' });
  E('respirator', 'generator', 3, 'energy', { hp: 220, power: 200, efficiency: 3, pollution: 0.2, cost: { heme: 20, membrane: 10, enzyme: 10 }, color: '#c0392b' });

  E('pump', 'pump', 1, 'fluids', { hp: 80, needsWater: true, fluidCap: 25, fluid: 'water', speed: 20, power: 4, cost: { protein: 10, iron: 5 }, color: '#4aa3df' });
  E('pipe', 'pipe', 1, 'fluids', { hp: 40, fluidCap: 25, cost: { fiber: 2 }, color: '#8fb8c9' });
  E('tank', 'pipe', 2, 'fluids', { hp: 150, fluidCap: 600, cost: { gel: 10, iron: 5 }, color: '#6c93a8' });

  E('lab', 'lab', 3, 'research', { hp: 200, speed: 1, power: 10, cost: { protein: 20, fiber: 20, iron: 10 }, color: '#5dade2' });

  E('turret', 'turret', 2, 'defense', { hp: 250, range: 7, damage: 20, cooldown: 30, ammo: 'bacteriocin', cost: { enzyme: 10, iron: 10, protein: 10 }, color: '#ff4d6d' });
  E('wall', 'wall', 1, 'defense', { hp: 400, cost: { fiber: 5 }, color: '#b8a98a' });
  E('sprayer', 'turret', 2, 'defense', { hp: 250, range: 4, damage: 5, cooldown: 20, splash: true, power: 20, cost: { enzyme: 20, heme: 10, membrane: 10 }, color: '#e056fd' });
  E('cleaner', 'cleaner', 2, 'defense', { hp: 120, clean: 3, power: 10, cost: { membrane: 10, gel: 10 }, color: '#1dd1a1' });

  E('nest', 'nest', 3, 'enemy', { hp: 600, enemy: true, buildable: false, color: '#d9d2e9' });

  // ---- mutations --------------------------------------------------------------------------
  const T = (id, tier, prereq, units, unlock = {}, extra = {}) => api.tech(id, {
    tier, prereq, units, time: 4 + tier * 2,
    packs: ['seqA', 'seqB', 'seqC', 'seqD'].slice(0, tier),
    unlock, ...extra,
  });
  T('basics', 0, [], 0, { entities: ['absorber', 'belt', 'fermentor'], recipes: ['atp'] });
  T('proteins', 0, ['basics'], 0, { entities: ['pilus', 'ribosome'], recipes: ['protein', 'fiber', 'enzyme'] });
  T('colony', 0, ['proteins'], 0, { entities: ['node', 'vacuole', 'generator', 'splitter', 'tunnel'] });
  T('genomics', 0, ['colony'], 0, { entities: ['lab'], recipes: ['seqA'] });

  T('photosynthesis', 1, ['genomics'], 15, { entities: ['solar'] });
  T('absorption', 1, ['genomics'], 15, {}, { bonus: { minerSpeed: 0.25 } });
  T('osmosis', 1, ['genomics'], 20, { entities: ['pump', 'pipe', 'tank', 'reactor'], recipes: ['lipid', 'gel'] });
  T('bacteriocins', 1, ['genomics'], 20, { entities: ['turret', 'wall'], recipes: ['bacteriocin'] });
  T('hemes', 1, ['genomics'], 15, { recipes: ['heme'] });
  T('seqB', 1, ['genomics'], 25, { recipes: ['seqB'] });

  T('membranes', 2, ['osmosis', 'seqB'], 25, { recipes: ['membrane'] });
  T('flagella', 2, ['seqB'], 25, { entities: ['fastbelt', 'longpilus'], recipes: ['flagellin'] });
  T('sorting', 2, ['seqB'], 20, { entities: ['filterpilus'] });
  T('storage', 2, ['membranes'], 30, { entities: ['accumulator'] });
  T('nucleotides', 2, ['osmosis', 'seqB'], 30, { recipes: ['nucleotide', 'rna'] });
  T('acidferm', 2, ['osmosis', 'seqB'], 25, { recipes: ['acid'] });
  T('enzymes2', 2, ['seqB'], 30, {}, { bonus: { craftSpeed: 0.25 } });
  T('quickpili', 2, ['flagella'], 25, {}, { bonus: { pilusSpeed: 0.5 } });
  T('toxins2', 2, ['bacteriocins', 'seqB'], 30, {}, { bonus: { turretDamage: 0.3 } });
  T('slime2', 2, ['seqB'], 30, {}, { bonus: { filmRadius: 2 } });
  T('seqC', 2, ['nucleotides'], 40, { recipes: ['seqC'] });

  T('dnatech', 3, ['seqC'], 40, { recipes: ['dna', 'plasmid'] });
  T('respiration', 3, ['seqC', 'hemes'], 40, { entities: ['respirator'] });
  T('sprayers', 3, ['seqC', 'toxins2', 'membranes'], 40, { entities: ['sprayer'] });
  T('detox', 3, ['seqC', 'membranes'], 35, { entities: ['cleaner'] });
  T('resistance', 3, ['seqC'], 30, {}, { bonus: { resist: 1, hp: 0.25 } });
  T('vitamins', 3, ['seqC', 'acidferm'], 30, { recipes: ['vitamin'] });
  T('absorption2', 3, ['seqC', 'absorption'], 50, {}, { bonus: { minerSpeed: 0.5 } });
  T('enzymes3', 3, ['seqC', 'enzymes2'], 50, {}, { bonus: { craftSpeed: 0.25 } });
  T('seqD', 3, ['dnatech', 'hemes', 'membranes'], 50, { recipes: ['seqD'] });

  T('sporulation', 4, ['seqD'], 60, { entities: ['sporangium'], recipes: ['spore'] });
  T('fortress', 4, ['seqD'], 60, {}, { bonus: { hp: 0.5, turretRange: 1 } });
  T('hypermetabolism', 4, ['seqD', 'enzymes3'], 80, {}, { bonus: { craftSpeed: 0.5, beltSpeed: 0.25 } });

  // ---- immune cells -----------------------------------------------------------------------
  api.enemy('neutrophil', { hp: 30, speed: 1.6, damage: 5, cooldown: 1, size: 0.7, color: '#f6e5f5' });
  api.enemy('macrophage', { hp: 160, speed: 0.8, damage: 14, cooldown: 1.2, size: 1.2, color: '#d7bde2' });
  api.enemy('phage', { hp: 14, speed: 2.3, damage: 6, cooldown: 1, infect: 8, size: 0.5, color: '#85c1e9' });
}

export const TIER0 = ['basics', 'proteins', 'colony', 'genomics'];
export const TIER1 = ['photosynthesis', 'absorption', 'osmosis', 'bacteriocins', 'hemes', 'seqB'];
export const TIER2 = ['membranes', 'flagella', 'sorting', 'storage', 'nucleotides', 'acidferm', 'enzymes2', 'quickpili', 'toxins2', 'slime2', 'seqC'];
export const TIER3 = ['dnatech', 'respiration', 'sprayers', 'detox', 'resistance', 'vitamins', 'absorption2', 'enzymes3', 'seqD'];
export const TIER4 = ['sporulation', 'fortress', 'hypermetabolism'];
