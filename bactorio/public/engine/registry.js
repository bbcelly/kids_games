// Registry of prototypes. Everything the game knows (items, recipes, buildings, mutations,
// enemies, missions, texts) lives here and is put here through the same API that mods use.
import { KINDS, setRecipe } from '../sim/kinds.js';
import { give, wants, take, eject, outTile } from '../sim/belts.js';
import { request } from '../sim/power.js';
import { fluidAvail, fluidDraw, fluidRoom, fluidPush } from '../sim/fluids.js';
import { DX, DY } from '../sim/world.js';

// Building blocks for custom kinds, handed to mods as api.sim
const SIM = { give, wants, take, eject, outTile, request, fluidAvail, fluidDraw, fluidRoom, fluidPush, setRecipe, DX, DY };

export const TYPES = ['items', 'fluids', 'resources', 'recipes', 'entities', 'techs', 'enemies', 'missions'];
const SINGULAR = { item: 'items', fluid: 'fluids', resource: 'resources', recipe: 'recipes', entity: 'entities', tech: 'techs', enemy: 'enemies', mission: 'missions' };

export class Registry {
  constructor() {
    for (const t of TYPES) this[t] = {};
    this.kinds = { ...KINDS };
    this.locales = {};
    this.hooks = {};
    this.mods = [];       // [{id, name, version, source}]
    this.errors = [];     // [{mod, stage, message}]
    this._n = 0;
    this.resIds = [null]; // numeric index used by the map -> resource id
    this.byCategory = {};
  }

  add(type, id, def, mod) {
    if (!TYPES.includes(type)) throw new Error(`unknown prototype type "${type}"`);
    if (!id || typeof id !== 'string') throw new Error(`${type}: missing id`);
    def.id = id;
    def.mod = mod;
    if (def.order == null) def.order = ++this._n;
    this[type][id] = def;
    return def;
  }

  on(event, fn, mod) { (this.hooks[event] ||= []).push({ fn, mod }); }

  emit(event, ...args) {
    const hs = this.hooks[event];
    if (!hs) return;
    for (let i = 0; i < hs.length; i++) {
      const h = hs[i];
      if (h.dead) continue;
      try { h.fn(...args); } catch (err) {
        h.dead = true; // a broken hook is switched off instead of killing the game loop
        this.errors.push({ mod: h.mod, stage: 'hook:' + event, message: String(err && err.message || err) });
      }
    }
  }

  sorted(type) { return Object.values(this[type]).sort((a, b) => a.order - b.order); }

  // Derived lookup tables. Call after all mods are applied.
  finalize() {
    this.resIds = [null, ...this.sorted('resources').map(r => r.id)];
    this.resIndex = {};
    this.resIds.forEach((id, i) => { if (id) this.resIndex[id] = i; });
    this.byCategory = {};
    for (const r of this.sorted('recipes')) (this.byCategory[r.category] ||= []).push(r);
    for (const t of Object.values(this.techs)) {
      t.prereq ||= []; t.packs ||= []; t.units ||= 0; t.time ||= 5;
      t.unlock ||= {}; t.unlock.entities ||= []; t.unlock.recipes ||= [];
    }
  }

  // Returns a list of human-readable problems; empty list = the data is consistent.
  validate() {
    const E = [];
    const item = (id, where) => { if (!this.items[id]) E.push(`${where}: unknown item "${id}"`); };
    const fluid = (id, where) => { if (!this.fluids[id]) E.push(`${where}: unknown fluid "${id}"`); };
    for (const r of Object.values(this.resources)) {
      if (r.item) item(r.item, `resource ${r.id}`);
    }
    const cats = new Set();
    for (const e of Object.values(this.entities)) {
      if (!this.kinds[e.kind]) E.push(`entity ${e.id}: unknown kind "${e.kind}"`);
      for (const k in e.cost || {}) item(k, `entity ${e.id} cost`);
      if (e.category) cats.add(e.category);
      if (e.ammo) item(e.ammo, `entity ${e.id} ammo`);
      if (!Array.isArray(e.size)) E.push(`entity ${e.id}: size must be [w, h]`);
      else if (e.size[0] !== e.size[1]) E.push(`entity ${e.id}: only square sizes are supported`);
    }
    for (const r of Object.values(this.recipes)) {
      const w = `recipe ${r.id}`;
      for (const k in r.in || {}) item(k, w);
      for (const k in r.out || {}) item(k, w);
      for (const k in r.fin || {}) fluid(k, w);
      for (const k in r.fout || {}) fluid(k, w);
      if (!cats.has(r.category)) E.push(`${w}: no building crafts category "${r.category}"`);
      if (!(r.time > 0)) E.push(`${w}: time must be > 0`);
    }
    const unlockedE = new Set(), unlockedR = new Set();
    for (const e of Object.values(this.entities)) if (e.enabled || e.enemy || e.kind === 'core') unlockedE.add(e.id);
    for (const r of Object.values(this.recipes)) if (r.enabled) unlockedR.add(r.id);
    for (const t of Object.values(this.techs)) {
      const w = `tech ${t.id}`;
      for (const p of t.prereq || []) if (!this.techs[p]) E.push(`${w}: unknown prerequisite "${p}"`);
      for (const p of t.packs || []) item(p, w);
      for (const id of t.unlock?.entities || []) { if (!this.entities[id]) E.push(`${w}: unlocks unknown entity "${id}"`); unlockedE.add(id); }
      for (const id of t.unlock?.recipes || []) { if (!this.recipes[id]) E.push(`${w}: unlocks unknown recipe "${id}"`); unlockedR.add(id); }
    }
    // prerequisite cycles
    const state = {};
    const visit = (id) => {
      if (state[id] === 2) return true;
      if (state[id] === 1) return false;
      state[id] = 1;
      for (const p of this.techs[id]?.prereq || []) if (this.techs[p] && !visit(p)) return false;
      state[id] = 2;
      return true;
    };
    for (const id in this.techs) if (!visit(id)) { E.push(`tech ${id}: prerequisite cycle`); break; }
    for (const e of Object.values(this.entities)) if (!unlockedE.has(e.id)) E.push(`entity ${e.id}: nothing unlocks it`);
    for (const r of Object.values(this.recipes)) if (!unlockedR.has(r.id)) E.push(`recipe ${r.id}: nothing unlocks it`);
    // every item must come from somewhere
    const obtainable = new Set();
    for (const r of Object.values(this.resources)) if (r.item) obtainable.add(r.item);
    for (const r of Object.values(this.recipes)) for (const k in r.out || {}) obtainable.add(k);
    for (const id in this.items) if (!obtainable.has(id)) E.push(`item ${id}: cannot be obtained (no resource or recipe makes it)`);
    for (const m of Object.values(this.missions)) {
      const w = `mission ${m.id}`;
      if (typeof m.setup !== 'function') E.push(`${w}: setup(world, helpers) is required`);
      for (const t of m.start?.techs || []) if (!this.techs[t]) E.push(`${w}: unknown start tech "${t}"`);
      for (const k in m.start?.items || {}) item(k, w);
      for (const o of m.objectives || []) {
        if (o.item) item(o.item, `${w} objective ${o.id}`);
        if (o.entity && !this.entities[o.entity]) E.push(`${w} objective ${o.id}: unknown entity "${o.entity}"`);
        if (o.tech && !this.techs[o.tech]) E.push(`${w} objective ${o.id}: unknown tech "${o.tech}"`);
        if (!o.id) E.push(`${w}: every objective needs an id`);
        if (o.type === 'custom' && typeof o.check !== 'function') E.push(`${w} objective ${o.id}: custom objectives need check(world)`);
        else if (!['deliver', 'produce', 'build', 'research', 'film', 'power', 'survive', 'kill', 'launch', 'custom'].includes(o.type)) E.push(`${w} objective ${o.id}: unknown type "${o.type}"`);
      }
    }
    return E;
  }

  snapshot() {
    const s = { locales: {}, hooks: {}, kinds: { ...this.kinds }, n: this._n };
    for (const t of TYPES) s[t] = { ...this[t] };
    for (const l in this.locales) s.locales[l] = { ...this.locales[l] };
    for (const h in this.hooks) s.hooks[h] = [...this.hooks[h]];
    return s;
  }

  restore(s) {
    for (const t of TYPES) this[t] = s[t];
    this.locales = s.locales; this.hooks = s.hooks; this.kinds = s.kinds; this._n = s.n;
  }
}

// The object handed to a mod's data(api) and control(api).
export function makeApi(reg, modId) {
  const api = {
    modId,
    registry: reg,
    sim: SIM,
    get(type, id) { return reg[SINGULAR[type] || type]?.[id]; },
    all(type) { return reg.sorted(SINGULAR[type] || type); },
    modify(type, id, patch) {
      const d = reg[SINGULAR[type] || type]?.[id];
      if (!d) throw new Error(`modify: ${type} "${id}" does not exist`);
      if (typeof patch === 'function') patch(d); else Object.assign(d, patch);
      return d;
    },
    remove(type, id) { delete reg[SINGULAR[type] || type][id]; },
    kind(id, handlers) { reg.kinds[id] = handlers; },
    locale(lang, strings) { Object.assign(reg.locales[lang] ||= {}, strings); },
    on(event, fn) { reg.on(event, fn, modId); },
  };
  for (const s in SINGULAR) api[s] = (id, def) => reg.add(SINGULAR[s], id, def, modId);
  return api;
}
