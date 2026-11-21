// World state: tile map, buildings, colony inventory, mutations. Pure data + rules, no DOM.
import { RNG } from '../engine/rng.js';

export const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1]; // 0=E 1=S 2=W 3=N
export const T_GROUND = 0, T_WATER = 1, T_ROCK = 2;
export const CHUNK = 8;

export class World {
  constructor(reg, o = {}) {
    this.reg = reg;
    this.w = o.w || 96; this.h = o.h || 96;
    const n = this.w * this.h;
    this.terrain = new Uint8Array(n);
    this.res = new Uint8Array(n);       // index into reg.resIds
    this.resAmt = new Uint16Array(n);
    this.light = new Uint8Array(n);
    this.film = new Uint8Array(n);      // how many emitters cover the tile; >0 = biofilm
    this.occ = new Int32Array(n);       // entity id on the tile
    this.flow = new Uint16Array(n);     // enemy path distances
    this.cw = Math.ceil(this.w / CHUNK); this.ch = Math.ceil(this.h / CHUNK);
    this.tox = new Float32Array(this.cw * this.ch);
    this.ents = new Map(); this.list = []; this.lists = {}; this.tickers = [];
    this.nextId = 1; this.counts = {};
    this.inv = {}; this.core = null;
    this.unlockedE = new Set(); this.unlockedR = new Set();
    this.techs = {}; this.research = null; this.bonus = {};
    this.stats = { produced: {}, delivered: {}, built: {}, launched: 0, killed: 0, wavesCleared: 0 };
    this.power = { sat: 1, demand: 0, supply: 0, stored: 0, cap: 0, req: 0 };
    this.tick = 0;
    this.seed = o.seed || 1; this.rng = new RNG(this.seed);
    this.missionId = o.missionId || 'free';
    this.peaceful = !!o.peaceful;
    this.enemies = []; this.nests = []; this.threat = null; this.antibiotic = false; this.nextEnemy = 1;
    this.objDone = {}; this.won = false; this.lost = false; this.wonTick = 0;
    this.filmTiles = 0; this.lastHarvest = -99;
    this.beltsDirty = this.fluidsDirty = this.pathDirty = true;
    this.beltOrder = []; this.nets = [];
    this.fx = [];            // transient effects for the renderer, never saved
    this.mapRev = 0; this.filmRev = 0;
    this.custom = {};        // free space for mods; saved with the game (must be JSON)
  }

  inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  entAt(x, y) { return this.inb(x, y) ? this.ents.get(this.occ[y * this.w + x]) || null : null; }
  proto(type) { return this.reg.entities[type]; }
  mission() { return this.reg.missions[this.missionId]; }
  effect(f) { if (this.fx.length < 300) this.fx.push(f); }

  // ---- colony inventory -------------------------------------------------
  has(cost, mul = 1) { for (const k in cost) if ((this.inv[k] || 0) < cost[k] * mul) return false; return true; }
  pay(cost) { for (const k in cost) this.inv[k] = (this.inv[k] || 0) - cost[k]; }
  give(item, n = 1) { this.inv[item] = (this.inv[item] || 0) + n; }
  deliver(item, n = 1) { this.give(item, n); this.stats.delivered[item] = (this.stats.delivered[item] || 0) + n; }

  // Collect one unit of a deposit by hand. Rate limited so automation stays worth it.
  harvest(x, y) {
    if (!this.inb(x, y) || this.tick - this.lastHarvest < 12) return null;
    const i = y * this.w + x;
    const r = this.reg.resources[this.reg.resIds[this.res[i]]];
    if (!r || !r.item || this.resAmt[i] <= 0) return null;
    this.lastHarvest = this.tick;
    this.takeRes(i);
    this.deliver(r.item, 1);
    return r.item;
  }

  takeRes(i) {
    if (--this.resAmt[i] <= 0) { this.res[i] = 0; this.resAmt[i] = 0; this.mapRev++; }
  }

  // ---- placing and removing --------------------------------------------
  canPlace(type, x, y, o = {}) {
    const p = this.reg.entities[type];
    if (!p) return { ok: false, reason: 'unknown' };
    if (!o.force && !this.unlockedE.has(type)) return { ok: false, reason: 'locked' };
    const s = p.size[0];
    let onRes = false, nearWater = false;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const tx = x + i, ty = y + j;
      if (!this.inb(tx, ty)) return { ok: false, reason: 'bounds' };
      const k = ty * this.w + tx;
      if (this.terrain[k] !== T_GROUND) return { ok: false, reason: 'terrain' };
      if (this.occ[k]) return { ok: false, reason: 'occupied' };
      if (!o.force && !this.film[k]) return { ok: false, reason: 'film' };
      if (this.res[k] && this.reg.resources[this.reg.resIds[this.res[k]]]?.item) onRes = true;
      for (let d = 0; d < 4; d++) {
        const wx = tx + DX[d], wy = ty + DY[d];
        if (this.inb(wx, wy) && this.terrain[wy * this.w + wx] === T_WATER) nearWater = true;
      }
    }
    if (p.kind === 'miner' && !onRes) return { ok: false, reason: 'resource' };
    if (p.needsWater && !nearWater) return { ok: false, reason: 'water' };
    if (!o.force && !o.free && p.cost && !this.has(p.cost)) return { ok: false, reason: 'cost' };
    return { ok: true };
  }

  place(type, x, y, dir = 0, o = {}) {
    if (!this.canPlace(type, x, y, o).ok) return null;
    const p = this.reg.entities[type];
    if (!o.force && !o.free && p.cost) this.pay(p.cost);
    const e = { id: this.nextId++, type, x, y, dir: dir & 3, hp: this.maxHp(p) };
    this.attach(e);
    e._k.init?.(this, e, p);
    if (p.film) this.applyFilm(e, 1);
    this.stats.built[type] = (this.stats.built[type] || 0) + 1;
    this.reg.emit('built', this, e);
    return e;
  }

  // Build with the conveniences a player expects: re-placing the same 1x1 building turns it,
  // placing a pathway over another pathway replaces it.
  build(type, x, y, dir = 0) {
    const t = this.entAt(x, y), p = this.reg.entities[type];
    if (t && p) {
      if (t.type === type && p.size[0] === 1) {
        if (t.dir !== (dir & 3)) { t.dir = dir & 3; t._k.rotated?.(this, t, p); this.beltsDirty = this.pathDirty = true; }
        return t;
      }
      if (t._p.kind === 'belt' && p.kind === 'belt' && !t._p.tunnel && !p.tunnel && this.unlockedE.has(type)) {
        const items = t.items;
        this.remove(t, { refund: true, keepItems: true });
        const e = this.place(type, x, y, dir);
        if (e) e.items = items; else this.place(t.type, x, y, t.dir);
        return e;
      }
      return null;
    }
    return this.place(type, x, y, dir);
  }

  maxHp(p) { return Math.round((p.hp || 100) * (p.enemy ? 1 : 1 + (this.bonus.hp || 0))); }

  attach(e) {
    const p = this.reg.entities[e.type];
    e._p = p; e._k = this.reg.kinds[p.kind];
    this.ents.set(e.id, e);
    this.list.push(e);
    (this.lists[p.kind] ||= []).push(e);
    this.counts[e.type] = (this.counts[e.type] || 0) + 1;
    const s = p.size[0];
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) this.occ[(e.y + j) * this.w + e.x + i] = e.id;
    if (e._k.tick) this.tickers.push(e);
    if (p.kind === 'core') this.core = e;
    if (p.enemy) this.nests.push(e);
    this.beltsDirty = this.fluidsDirty = this.pathDirty = true;
  }

  remove(e, o = {}) {
    if (!this.ents.has(e.id)) return;
    const p = e._p, s = p.size[0];
    e._k.removed?.(this, e, p, o);
    if (p.film) this.applyFilm(e, -1);
    this.ents.delete(e.id);
    const drop = (a) => { const i = a.indexOf(e); if (i >= 0) a.splice(i, 1); };
    drop(this.list); drop(this.lists[p.kind]); drop(this.tickers); drop(this.nests);
    this.counts[e.type]--;
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) this.occ[(e.y + j) * this.w + e.x + i] = 0;
    if (o.refund && p.cost) for (const k in p.cost) this.give(k, p.cost[k]);
    this.beltsDirty = this.fluidsDirty = this.pathDirty = true;
    if (p.kind === 'core') { this.core = null; this.lost = true; }
    e.gone = true;
    this.reg.emit('removed', this, e, o);
  }

  damage(e, amount) {
    e.hp -= amount; e._hit = this.tick;
    if (e.hp <= 0) {
      this.effect({ t: 'boom', x: e.x + e._p.size[0] / 2, y: e.y + e._p.size[0] / 2, r: e._p.size[0] });
      this.remove(e, { destroyed: true });
    }
  }

  // ---- biofilm ----------------------------------------------------------
  filmRadius(p) { return p.film + (p.kind === 'core' ? 0 : (this.bonus.filmRadius || 0)); }

  applyFilm(e, d) {
    const r = d > 0 ? (e.fr = this.filmRadius(e._p)) : e.fr;
    const c = e._p.size[0] / 2, cx = e.x + c, cy = e.y + c, r2 = r * r;
    for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(this.h - 1, Math.ceil(cy + r)); y++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(this.w - 1, Math.ceil(cx + r)); x++) {
        const ddx = x + 0.5 - cx, ddy = y + 0.5 - cy;
        if (ddx * ddx + ddy * ddy > r2) continue;
        const k = y * this.w + x, before = this.film[k];
        this.film[k] = before + d;
        if (!before && d > 0) this.filmTiles++; else if (before === 1 && d < 0) this.filmTiles--;
      }
    }
    this.filmRev++;
  }

  recomputeFilm() {
    this.film.fill(0); this.filmTiles = 0;
    for (const e of this.list) if (e._p.film) this.applyFilm(e, 1);
  }

  // ---- mutations (research) --------------------------------------------
  techAllowed(id) { const m = this.mission(); return !m?.techs || m.techs.includes(id) || !!this.techs[id]?.done; }

  techAvailable(id) {
    const t = this.reg.techs[id];
    if (!t || this.techs[id]?.done || !this.techAllowed(id)) return false;
    return t.prereq.every(p => this.techs[p]?.done);
  }

  startResearch(id) {
    if (id && !this.techAvailable(id)) return false;
    this.research = id || null;
    if (id && !this.reg.techs[id].units) this.completeTech(id); // free mutations finish at once
    return true;
  }

  applyTech(id) {
    const t = this.reg.techs[id];
    if (!t) return;
    for (const e of t.unlock.entities) this.unlockedE.add(e);
    for (const r of t.unlock.recipes) this.unlockedR.add(r);
    for (const k in t.bonus || {}) this.bonus[k] = (this.bonus[k] || 0) + t.bonus[k];
  }

  completeTech(id, silent) {
    if (!this.reg.techs[id] || this.techs[id]?.done) return;
    this.techs[id] = { done: true, prog: this.reg.techs[id].units };
    this.applyTech(id);
    if (this.reg.techs[id].bonus?.filmRadius) this.recomputeFilm();
    if (this.research === id) this.research = null;
    if (!silent) { this.effect({ t: 'tech', id }); this.reg.emit('researched', this, id); }
  }

  // Rebuild unlocks from finished mutations (used after loading a save).
  refreshUnlocks() {
    this.unlockedE.clear(); this.unlockedR.clear(); this.bonus = {};
    for (const id in this.reg.entities) if (this.reg.entities[id].enabled) this.unlockedE.add(id);
    for (const id in this.reg.recipes) if (this.reg.recipes[id].enabled) this.unlockedR.add(id);
    for (const id in this.techs) if (this.techs[id].done) this.applyTech(id);
  }

  recipesFor(e) {
    return (this.reg.byCategory[e._p.category] || []).filter(r => this.unlockedR.has(r.id));
  }

  pollute(x, y, amt) {
    this.tox[Math.floor(y / CHUNK) * this.cw + Math.floor(x / CHUNK)] += amt;
  }
}
