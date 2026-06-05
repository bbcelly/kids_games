// upgrades.js — the upgrade registry. This is the "spine" of progression.
// Add an entry here and it automatically shows up in the hangar shop and
// affects the ship — no scene code to touch.
//
// Each upgrade:
//   id         unique key, also used as the save slot
//   label      shown in the shop
//   desc       short hint shown in the shop
//   baseCost   cost of the FIRST level
//   costGrowth multiplier per level already owned
//   maxLevel   cap
//   apply(stats, level)  mutates the player's stats for the owned level

const UPGRADES = [
  {
    id: 'fireRate',
    label: 'Blaster Fire Rate',
    desc: 'Shoot faster',
    baseCost: 60, costGrowth: 1.6, maxLevel: 5,
    apply(stats, level) { stats.fireDelay *= Math.pow(0.84, level); },
  },
  {
    id: 'armor',
    label: 'Beskar Armor',
    desc: '+1 hull per level',
    baseCost: 80, costGrowth: 1.7, maxLevel: 4,
    apply(stats, level) { stats.maxHull += level; },
  },
  {
    id: 'thrusters',
    label: 'Thrusters',
    desc: 'Fly faster',
    baseCost: 50, costGrowth: 1.55, maxLevel: 5,
    apply(stats, level) { stats.speed *= Math.pow(1.12, level); },
  },
];

// Cost to buy the NEXT level, given how many you already own.
function upgradeCost(up, currentLevel) {
  return Math.round(up.baseCost * Math.pow(up.costGrowth, currentLevel));
}

// Fold all owned upgrade levels into a fresh stats object the GameScene uses.
function computeStats(upgradeLevels) {
  const stats = {
    speed: CONFIG.player.baseSpeed,
    fireDelay: CONFIG.player.baseFireDelay,
    maxHull: CONFIG.player.baseHull,
    bulletSpeed: CONFIG.player.bulletSpeed,
  };
  UPGRADES.forEach((up) => {
    const lvl = upgradeLevels[up.id] || 0;
    if (lvl > 0) up.apply(stats, lvl);
  });
  return stats;
}
