'use strict';
// ---- persistent progress in localStorage ----
const SAVE_KEY = 'beskarRunSave_v1';

function defaultSave() {
  return {
    vault: 0,                 // banked beskar
    weapons: ['blaster'],     // owned weapon ids
    equipped: 'blaster',
    upgrades: { rate: 0, armor: 0, thrust: 0 },
    gifts: { magnet: 0, wipe: 0, mend: 0, lucky: 0, bond: 0 },
    level: 0,                 // next level to fly (0..2)
    loop: 0,                  // how many times the campaign has looped
    bestScore: 0,
  };
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const s = JSON.parse(raw);
    // merge over defaults so old saves survive new fields
    const d = defaultSave();
    return {
      ...d, ...s,
      upgrades: { ...d.upgrades, ...(s.upgrades || {}) },
      gifts: { ...d.gifts, ...(s.gifts || {}) },
      weapons: Array.isArray(s.weapons) && s.weapons.length ? s.weapons : d.weapons,
    };
  } catch (e) {
    return defaultSave();
  }
}

function storeSave(s) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { /* private mode etc. */ }
}
