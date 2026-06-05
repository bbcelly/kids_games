// grogu.js — Grogu's Force perks. Leveled like the stat upgrades. Most are
// passive; Force Wipe is an active ability (press F in-flight).
//
// Add an entry here and it shows up in the hangar's GROGU column automatically.
// GameScene reads the derived values from computeGrogu().

const GROGU_PERKS = [
  {
    id: 'magnet', label: 'Beskar Magnet', desc: 'Pull beskar toward you from afar.',
    baseCost: 90, costGrowth: 1.6, maxLevel: 4,
  },
  {
    id: 'wipe', label: 'Force Wipe', desc: 'Press F: a Force pulse clears the screen.',
    baseCost: 150, costGrowth: 1.7, maxLevel: 4,
  },
  {
    id: 'mend', label: 'Force Mend', desc: 'Grogu slowly repairs the hull.',
    baseCost: 160, costGrowth: 1.8, maxLevel: 3,
  },
  {
    id: 'lucky', label: 'Lucky Frog', desc: 'Chance for bonus beskar drops.',
    baseCost: 120, costGrowth: 1.6, maxLevel: 3,
  },
  {
    id: 'bond', label: 'Force Bond', desc: 'Revive once per run when downed.',
    baseCost: 300, costGrowth: 2.0, maxLevel: 2,
  },
];

function groguCost(p, level) {
  return Math.round(p.baseCost * Math.pow(p.costGrowth, level));
}

// Fold owned perk levels into the values the GameScene actually uses.
function computeGrogu(levels) {
  levels = levels || {};
  const lv = (id) => levels[id] || 0;
  const wipe = lv('wipe');
  const mend = lv('mend');
  return {
    magnetRadius: lv('magnet') * 75,                      // px, 0 = no magnet
    wipeLevel: wipe,
    wipeCooldown: 26000 - (wipe > 0 ? (wipe - 1) * 4500 : 0), // ms (only if owned)
    mendEvery: mend > 0 ? 14000 - (mend - 1) * 3500 : 0,  // ms between repairs, 0 = off
    luckyChance: lv('lucky') * 0.18,                      // chance of a bonus drop
    luckyMult: 2,
    reviveCharges: lv('bond'),                            // free revives per run
  };
}
