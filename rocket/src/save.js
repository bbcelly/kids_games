// save.js — the single source of truth for persistence (localStorage).
// Shape: { beskar, upgrades:{<id>:<lvl>}, grogu:{<id>:<lvl>},
//          weapons:{ owned:[ids], active:<id> } }

const Save = {
  KEY: 'beskar_run_save_v1',

  defaults() {
    return {
      beskar: 0, upgrades: {}, grogu: {},
      weapons: { owned: [DEFAULT_WEAPON], active: DEFAULT_WEAPON },
    };
  },

  // Make sure a weapons object is valid: always own the starter, active must be owned.
  normWeapons(w) {
    w = w || {};
    let owned = Array.isArray(w.owned) ? w.owned.slice() : [];
    owned = owned.filter((id) => WEAPONS.some((x) => x.id === id));
    if (!owned.includes(DEFAULT_WEAPON)) owned.unshift(DEFAULT_WEAPON);
    const active = owned.includes(w.active) ? w.active : DEFAULT_WEAPON;
    return { owned, active };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) {
        const d = JSON.parse(raw);
        return {
          beskar: d.beskar || 0,
          upgrades: d.upgrades || {},
          grogu: d.grogu || {},
          weapons: this.normWeapons(d.weapons),
        };
      }
    } catch (e) {
      // corrupt/unavailable storage — fall through to a fresh save
    }
    return this.defaults();
  },

  save(state) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(state));
    } catch (e) {
      // storage might be disabled (private mode); game still runs this session
    }
  },

  addBeskar(amount) {
    const s = this.load();
    s.beskar += amount;
    this.save(s);
    return s;
  },

  // Buy the next level of a stat upgrade. Returns { ok, reason }.
  buy(id) {
    const up = UPGRADES.find((u) => u.id === id);
    if (!up) return { ok: false, reason: 'unknown' };

    const s = this.load();
    const level = s.upgrades[id] || 0;
    if (level >= up.maxLevel) return { ok: false, reason: 'max' };

    const cost = upgradeCost(up, level);
    if (s.beskar < cost) return { ok: false, reason: 'poor' };

    s.beskar -= cost;
    s.upgrades[id] = level + 1;
    this.save(s);
    return { ok: true, state: s };
  },

  // Buy a weapon (or just equip it if already owned). Returns { ok, reason }.
  // reason: 'equipped' when it was already owned and is now the active weapon.
  buyWeapon(id) {
    const w = WEAPONS.find((x) => x.id === id);
    if (!w) return { ok: false, reason: 'unknown' };

    const s = this.load();
    if (s.weapons.owned.includes(id)) {
      s.weapons.active = id;
      this.save(s);
      return { ok: true, reason: 'equipped' };
    }
    if (s.beskar < w.cost) return { ok: false, reason: 'poor' };

    s.beskar -= w.cost;
    s.weapons.owned.push(id);
    s.weapons.active = id;
    this.save(s);
    return { ok: true };
  },

  // Buy the next level of a Grogu perk. Returns { ok, reason }.
  buyGrogu(id) {
    const p = GROGU_PERKS.find((x) => x.id === id);
    if (!p) return { ok: false, reason: 'unknown' };

    const s = this.load();
    const level = s.grogu[id] || 0;
    if (level >= p.maxLevel) return { ok: false, reason: 'max' };

    const cost = groguCost(p, level);
    if (s.beskar < cost) return { ok: false, reason: 'poor' };

    s.beskar -= cost;
    s.grogu[id] = level + 1;
    this.save(s);
    return { ok: true, state: s };
  },

  // Set the active weapon (used by in-flight cycling). Only if owned.
  setActiveWeapon(id) {
    const s = this.load();
    if (s.weapons.owned.includes(id)) {
      s.weapons.active = id;
      this.save(s);
    }
    return s.weapons;
  },

  reset() {
    this.save(this.defaults());
  },
};
