// config.js — all the balance knobs in one place.
// Tweak numbers here to retune the game; tweak LEVELS to change the levels/bosses.

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

// The levels, as data. Each level: a list of waves (spawn `count` enemies of
// `type`, staggered, once the run clock passes `at` seconds), then — once the
// screen is cleared — a BOSS arrives. Beat the boss to complete the level.
//
// Boss fields:
//   name, texture, hp, reward (beskar on kill)
//   speedY     vertical patrol speed (px/sec)
//   fireEvery  ms between shots
//   bulletSpeed
//   pattern    'spread' | 'aimed' | 'burst'
//   tint       starfield tint to give the level its own mood
const LEVELS = [
  {
    name: 'Asteroid Field',
    tint: 0xffffff,
    waves: [
      { at: 1, type: 'grunt', count: 3 },
      { at: 5, type: 'grunt', count: 4 },
      { at: 9, type: 'shooter', count: 2 },
      { at: 13, type: 'grunt', count: 5 },
    ],
    boss: { name: 'Mining Hauler', texture: 'boss1', hp: 36, reward: 120,
            speedY: 90, fireEvery: 1300, bulletSpeed: 300, pattern: 'spread' },
  },
  {
    name: 'Imperial Fleet',
    tint: 0xc8b4ff,
    waves: [
      { at: 1, type: 'shooter', count: 2 },
      { at: 5, type: 'grunt', count: 5 },
      { at: 9, type: 'shooter', count: 3 },
      { at: 13, type: 'grunt', count: 6 },
      { at: 17, type: 'shooter', count: 3 },
    ],
    boss: { name: 'Imperial Cruiser', texture: 'boss2', hp: 64, reward: 200,
            speedY: 120, fireEvery: 1050, bulletSpeed: 340, pattern: 'aimed' },
  },
  {
    name: 'Planet Surface',
    tint: 0xffc7a0,
    waves: [
      { at: 1, type: 'grunt', count: 5 },
      { at: 5, type: 'shooter', count: 3 },
      { at: 9, type: 'grunt', count: 6 },
      { at: 13, type: 'shooter', count: 4 },
      { at: 17, type: 'grunt', count: 7 },
    ],
    boss: { name: 'Imperial Walker', texture: 'boss3', hp: 96, reward: 320,
            speedY: 140, fireEvery: 850, bulletSpeed: 380, pattern: 'burst' },
  },
];
