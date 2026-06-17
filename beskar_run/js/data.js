'use strict';
// ---- all the tunable game data: weapons, upgrades, gifts, levels & waves ----

// A weapon fires its `shots` every `interval` seconds (modified by the Fire Rate
// upgrade). Optional `sub` is an extra battery with its own cadence (premium combos).
const WEAPONS = [
  { id: 'blaster', name: 'Blaster', cost: 0, desc: 'Reliable single bolt',
    interval: 0.30, shots: [{ kind: 'bolt', dmg: 1 }] },
  { id: 'twin', name: 'Twin Cannon', cost: 150, desc: 'Two parallel bolts',
    interval: 0.30, shots: [{ kind: 'bolt', dmg: 1, dy: -11 }, { kind: 'bolt', dmg: 1, dy: 11 }] },
  { id: 'spread', name: 'Spread Shot', cost: 400, desc: '3-way fan for crowds',
    interval: 0.34, shots: [{ kind: 'bolt', dmg: 1, ang: -0.22 }, { kind: 'bolt', dmg: 1 }, { kind: 'bolt', dmg: 1, ang: 0.22 }] },
  { id: 'scatter', name: 'Scatter Gun', cost: 700, desc: 'Wide 5-way blast, short range',
    interval: 0.42, shots: [-0.5, -0.25, 0, 0.25, 0.5].map(a => ({ kind: 'pellet', dmg: 1, ang: a, life: 0.42 })) },
  { id: 'vulcan', name: 'Vulcan', cost: 1100, desc: 'Rapid-fire bolt stream',
    interval: 0.11, shots: [{ kind: 'bolt', dmg: 0.7, jitter: 0.07 }] },
  { id: 'homing', name: 'Homing Missiles', cost: 1600, desc: 'Missiles curve to enemies',
    interval: 0.55, shots: [{ kind: 'missile', dmg: 3 }] },
  { id: 'laser', name: 'Laser Lance', cost: 2400, desc: 'Piercing beam, hits a line',
    interval: 0.50, shots: [{ kind: 'laser', dmg: 2.5 }] },
  { id: 'storm', name: 'Beskar Storm', cost: 3600, desc: 'Twin bolts + homing missile',
    interval: 0.28, shots: [{ kind: 'bolt', dmg: 1, dy: -11 }, { kind: 'bolt', dmg: 1, dy: 11 }],
    sub: { interval: 0.8, shots: [{ kind: 'missile', dmg: 3 }] } },
  { id: 'darksaber', name: 'Darksaber Array', cost: 5200, desc: 'Spread bolts + piercing core',
    interval: 0.32, shots: [{ kind: 'bolt', dmg: 1, ang: -0.24 }, { kind: 'bolt', dmg: 1, ang: 0.24 }],
    sub: { interval: 0.5, shots: [{ kind: 'laser', dmg: 2.5, dark: true }] } },
];

const UPGRADES = [
  { id: 'rate', name: 'Blaster Fire Rate', desc: 'Shoot faster', max: 5,
    costs: [90, 180, 360, 640, 1000], info: l => 'x' + (1 / Math.pow(0.88, l)).toFixed(2) + ' speed' },
  { id: 'armor', name: 'Beskar Armor', desc: 'Extra hull heart', max: 3,
    costs: [120, 300, 700], info: l => (3 + l) + ' hearts' },
  { id: 'thrust', name: 'Thrusters', desc: 'Fly faster', max: 4,
    costs: [80, 160, 320, 560], info: l => 'x' + (1 + l * 0.14).toFixed(2) + ' speed' },
];

const GIFTS = [
  { id: 'magnet', name: 'Beskar Magnet', desc: 'Gold flies to you', max: 3,
    costs: [100, 250, 500], info: l => l ? ['', 'small', 'big', 'huge'][l] + ' pull' : 'no pull' },
  { id: 'wipe', name: 'Force Wipe [F]', desc: 'Pulse clears the screen', max: 3,
    costs: [200, 450, 850], info: l => l ? (WIPE_CD[l]) + 's cooldown' : 'locked' },
  { id: 'mend', name: 'Force Mend', desc: 'Grogu repairs your hull', max: 3,
    costs: [150, 350, 650], info: l => l ? '1 heart / ' + MEND_T[l] + 's' : 'no healing' },
  { id: 'lucky', name: 'Lucky Frog', desc: 'Bonus sparkly beskar', max: 3,
    costs: [120, 280, 550], info: l => (l * 12) + '% double drops' },
  { id: 'bond', name: 'Force Bond', desc: 'Revive when downed', max: 2,
    costs: [400, 900], info: l => l + (l === 1 ? ' revive' : ' revives') + '/run' },
];

const WIPE_CD = [0, 30, 22, 15];   // seconds by gift level
const MEND_T = [0, 45, 30, 20];    // seconds per heart by gift level
const MAGNET_R = [0, 110, 190, 300];

// wave events: at second `t`, spawn `n` of `type`, one every `gap` seconds,
// arranged by `pat` ('train' same y, 'vee', 'rand', 'col' spaced column)
const LEVELS = [
  {
    name: 'Asteroid Field', boss: 'Mining Hauler', bossSpr: 'boss1', bossHp: 60,
    waves: [
      { t: 1.5, type: 'grunt', n: 4, gap: 0.5, pat: 'train' },
      { t: 7, type: 'grunt', n: 5, gap: 0.45, pat: 'train' },
      { t: 12, type: 'asteroid', n: 3, gap: 1.2, pat: 'rand' },
      { t: 17, type: 'waver', n: 4, gap: 0.5, pat: 'vee' },
      { t: 24, type: 'shooter', n: 2, gap: 1.5, pat: 'col' },
      { t: 26, type: 'grunt', n: 4, gap: 0.5, pat: 'train' },
      { t: 33, type: 'asteroid', n: 4, gap: 0.9, pat: 'rand' },
      { t: 38, type: 'grunt', n: 7, gap: 0.38, pat: 'train' },
      { t: 45, type: 'shooter', n: 3, gap: 1.4, pat: 'col' },
      { t: 50, type: 'waver', n: 5, gap: 0.5, pat: 'vee' },
      { t: 55, type: 'asteroid', n: 3, gap: 0.8, pat: 'rand' },
    ],
  },
  {
    name: 'Imperial Fleet', boss: 'Imperial Cruiser', bossSpr: 'boss2', bossHp: 95,
    waves: [
      { t: 1.5, type: 'drone', n: 5, gap: 0.4, pat: 'train' },
      { t: 7, type: 'grunt', n: 5, gap: 0.45, pat: 'vee' },
      { t: 13, type: 'shooter', n: 2, gap: 1.4, pat: 'col' },
      { t: 16, type: 'drone', n: 6, gap: 0.35, pat: 'train' },
      { t: 23, type: 'waver', n: 5, gap: 0.5, pat: 'vee' },
      { t: 29, type: 'shooter', n: 3, gap: 1.3, pat: 'col' },
      { t: 33, type: 'grunt', n: 6, gap: 0.4, pat: 'train' },
      { t: 40, type: 'drone', n: 8, gap: 0.3, pat: 'rand' },
      { t: 47, type: 'shooter', n: 3, gap: 1.2, pat: 'col' },
      { t: 50, type: 'waver', n: 6, gap: 0.45, pat: 'vee' },
      { t: 57, type: 'grunt', n: 8, gap: 0.35, pat: 'train' },
    ],
  },
  {
    name: 'Planet Surface', boss: 'Imperial Walker', bossSpr: 'boss3', bossHp: 130,
    waves: [
      { t: 1.5, type: 'grunt', n: 5, gap: 0.45, pat: 'train' },
      { t: 7, type: 'drone', n: 6, gap: 0.35, pat: 'rand' },
      { t: 13, type: 'shooter', n: 3, gap: 1.3, pat: 'col' },
      { t: 18, type: 'waver', n: 5, gap: 0.5, pat: 'vee' },
      { t: 24, type: 'grunt', n: 7, gap: 0.38, pat: 'train' },
      { t: 30, type: 'drone', n: 7, gap: 0.3, pat: 'rand' },
      { t: 36, type: 'shooter', n: 4, gap: 1.1, pat: 'col' },
      { t: 42, type: 'waver', n: 6, gap: 0.45, pat: 'vee' },
      { t: 48, type: 'grunt', n: 9, gap: 0.32, pat: 'train' },
      { t: 54, type: 'shooter', n: 3, gap: 1.0, pat: 'col' },
      { t: 57, type: 'drone', n: 8, gap: 0.28, pat: 'rand' },
    ],
  },
];

// per-enemy-type base stats (scaled up each campaign loop)
const ENEMY_STATS = {
  grunt:    { hp: 1, spd: 170, score: 50, coins: [2, 3], w: 34, h: 34 },
  waver:    { hp: 2, spd: 150, score: 80, coins: [2, 4], w: 40, h: 30 },
  shooter:  { hp: 4, spd: 90, score: 120, coins: [4, 7], w: 48, h: 38 },
  drone:    { hp: 1, spd: 230, score: 60, coins: [2, 3], w: 26, h: 26 },
  asteroid: { hp: 3, spd: 70, score: 30, coins: [3, 5], w: 44, h: 40 },
};

function loopMult(loop) {
  return {
    hp: 1 + 0.5 * loop,
    spd: 1 + 0.1 * loop,
    coins: 1 + 0.3 * loop,
    fire: 1 + 0.15 * loop,
  };
}
