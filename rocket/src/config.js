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
    bg: {
      layers: [
        { tex: 'bg_dust', speed: 16 },                 // far void + dust
        { tex: 'startile', speed: 32, tint: 0x9fb0d0 },// mid stars
        { tex: 'startile', speed: 64 },                // near (brighter) stars
      ],
      props: { textures: ['rock_sm', 'rock_lg'], everyMin: 900, everyMax: 2200,
               speedMin: 70, speedMax: 170, spin: true },
    },
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
    bg: {
      layers: [
        { tex: 'bg_nebula', speed: 18 },                       // far nebula
        { tex: 'startile', speed: 40, tint: 0xc8b4ff },        // mid stars
        { tex: 'fleet_hulls', speed: 24, y: 300, height: 96 }, // slow capital-ship hulls
      ],
      props: { textures: ['debris'], everyMin: 1000, everyMax: 2400,
               speedMin: 90, speedMax: 200, spin: true },
    },
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
    bg: {
      layers: [
        { tex: 'bg_sky', speed: 12 },                         // far warm sky
        { tex: 'mountains', speed: 28, y: 360, height: 110 }, // distant ridge
        { tex: 'ground', speed: 130, y: 470, height: 70 },    // fast scrolling ground
      ],
      // no drifting props on the surface — the ground does the motion
    },
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

// Difficulty scales with the "stage" number = lap * LEVELS.length + levelIndex.
// So enemies get tougher with every level AND keep getting harder each loop
// through the levels. Stage 0 (Level 1, first lap) is the baseline (all 1x).
function computeDifficulty(stage) {
  return {
    hpBonus: Math.floor(stage / 2),                 // +1 enemy hull every 2 stages
    speedMult: Math.min(2.2, 1 + stage * 0.08),     // enemies move faster
    fireMult: Math.max(0.45, 1 - stage * 0.07),     // shooters fire faster (lower delay)
    bulletMult: Math.min(1.8, 1 + stage * 0.06),    // bullets travel faster
    countBonus: Math.min(6, Math.floor(stage / 2)), // more enemies per wave
    bossMult: 1 + stage * 0.10,                     // tougher bosses
  };
}
