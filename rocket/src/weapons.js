// weapons.js — the weapon registry. Like upgrades.js, this is data-driven:
// add an entry and it shows up in the hangar and works in-flight automatically.
//
// Each weapon:
//   id, label, desc
//   cost      beskar price in the hangar (0 = owned from the start)
//   fireMult  multiplies the player's base fire delay (1 = normal, <1 faster, >1 slower)
//   fire(scene, x, y)  spawns its shot pattern via scene.firePlayerShot(...)
//
// scene.firePlayerShot(x, y, angleDeg, opts) — opts:
//   tex        bullet texture ('pbullet' | 'plasma' | 'missile' | 'laser')
//   speedMult  fraction of base bullet speed
//   damage     hit points removed (default 1)
//   pierce     true = passes through enemies (beam)
//   homing     true = curves toward the nearest enemy

const WEAPONS = [
  {
    id: 'blaster', label: 'Blaster', desc: 'Single forward bolt. Reliable.',
    cost: 0, fireMult: 1.0,
    fire(s, x, y) { s.firePlayerShot(x, y, 0, { tex: 'pbullet' }); },
  },
  {
    id: 'twin', label: 'Twin Cannon', desc: 'Two parallel bolts for wider cover.',
    cost: 120, fireMult: 1.05,
    fire(s, x, y) {
      s.firePlayerShot(x, y - 8, 0, { tex: 'pbullet' });
      s.firePlayerShot(x, y + 8, 0, { tex: 'pbullet' });
    },
  },
  {
    id: 'spread', label: 'Spread Shot', desc: '3-way fan. Good crowd control.',
    cost: 200, fireMult: 1.2,
    fire(s, x, y) { [-12, 0, 12].forEach((a) => s.firePlayerShot(x, y, a, { tex: 'plasma' })); },
  },
  {
    id: 'scatter', label: 'Scatter Gun', desc: 'Wide 5-way blast, shorter range.',
    cost: 300, fireMult: 1.35,
    fire(s, x, y) {
      [-26, -13, 0, 13, 26].forEach((a) => s.firePlayerShot(x, y, a, { tex: 'plasma', speedMult: 0.9 }));
    },
  },
  {
    id: 'vulcan', label: 'Vulcan', desc: 'Rapid-fire stream of bolts.',
    cost: 260, fireMult: 0.45,
    fire(s, x, y) { s.firePlayerShot(x, y + Phaser.Math.Between(-3, 3), 0, { tex: 'pbullet' }); },
  },
  {
    id: 'missiles', label: 'Homing Missiles', desc: 'Curve toward enemies. Fire & forget.',
    cost: 340, fireMult: 1.7,
    fire(s, x, y) {
      s.firePlayerShot(x, y - 10, -8, { tex: 'missile', homing: true, damage: 2, speedMult: 0.7 });
      s.firePlayerShot(x, y + 10, 8, { tex: 'missile', homing: true, damage: 2, speedMult: 0.7 });
    },
  },
  {
    id: 'laser', label: 'Laser Lance', desc: 'Piercing beam, hits a whole line.',
    cost: 400, fireMult: 1.5,
    fire(s, x, y) { s.firePlayerShot(x + 18, y, 0, { tex: 'laser', pierce: true, damage: 2, speedMult: 1.6 }); },
  },
  // --- combinations (premium) ---
  {
    id: 'storm', label: 'Beskar Storm', desc: 'Twin bolts + a homing missile.',
    cost: 600, fireMult: 1.3,
    fire(s, x, y) {
      s.firePlayerShot(x, y - 8, 0, { tex: 'pbullet' });
      s.firePlayerShot(x, y + 8, 0, { tex: 'pbullet' });
      s.firePlayerShot(x, y, 0, { tex: 'missile', homing: true, damage: 2, speedMult: 0.7 });
    },
  },
  {
    id: 'darksaber', label: 'Darksaber Array', desc: 'Spread bolts + a piercing core.',
    cost: 800, fireMult: 1.5,
    fire(s, x, y) {
      [-14, 14].forEach((a) => s.firePlayerShot(x, y, a, { tex: 'plasma' }));
      s.firePlayerShot(x + 18, y, 0, { tex: 'laser', pierce: true, damage: 2, speedMult: 1.6 });
    },
  },
];

const DEFAULT_WEAPON = 'blaster';

function getWeapon(id) {
  return WEAPONS.find((w) => w.id === id) || WEAPONS[0];
}
