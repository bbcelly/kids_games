// config.js — all the balance knobs in one place.
// Tweak numbers here to retune the game; tweak WAVES to change the level.

const CONFIG = {
  width: 960,
  height: 540,

  // Base player stats BEFORE upgrades are applied (see upgrades.js).
  player: {
    baseSpeed: 280,       // px/sec movement
    baseFireDelay: 320,   // ms between shots (lower = faster)
    baseHull: 3,          // hits the ship can take
    bulletSpeed: 640,     // px/sec for player shots
  },

  // Enemy types. Add a new key here + a texture in textures.js to make a new enemy.
  enemies: {
    grunt:   { texture: 'grunt',   speed: 170, hp: 1, reward: 5 },
    shooter: { texture: 'shooter', speed: 110, hp: 2, reward: 12,
               fireEvery: 1600, bulletSpeed: 340 },
  },

  beskar: { dropSpeed: 120 }, // how fast collected beskar drifts left
};

// The level, as data. Each wave spawns `count` enemies of `type`,
// staggered, once the run clock passes `at` seconds.
// After the last wave, GameScene switches to endless escalating spawns.
const WAVES = [
  { at: 1,  type: 'grunt',   count: 3 },
  { at: 5,  type: 'grunt',   count: 4 },
  { at: 9,  type: 'shooter', count: 2 },
  { at: 14, type: 'grunt',   count: 5 },
  { at: 19, type: 'shooter', count: 3 },
  { at: 25, type: 'grunt',   count: 6 },
];
