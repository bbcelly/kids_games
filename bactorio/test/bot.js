// A scripted player. It only uses what a real player can do (harvest by hand, build, set a
// recipe, pick a mutation) and plays missions without a browser to prove they can be won.
import { step } from '../public/sim/sim.js';
import { DX, DY, T_GROUND, T_WATER } from '../public/sim/world.js';
import { setRecipe } from '../public/sim/kinds.js';

export class Bot {
  constructor(w) {
    this.w = w; this.reserved = new Set(); this.trunk = new Map(); this.busy = new Set();
    this.cx = w.core.x; this.cy = w.core.y;
  }

  k(x, y) { return y * this.w.w + x; }

  step(n = 1) {
    for (let i = 0; i < n; i++) {
      step(this.w);
      if (this.w.lost) throw new Error(`colony lost at ${Math.round(this.w.tick / 60)} s`);
    }
  }

  until(fn, maxSec, label) {
    const end = this.w.tick + maxSec * 60;
    while (!fn()) {
      this.step(10);
      if (this.onIdle) this.onIdle();
      if (this.w.tick > end) throw new Error(`timeout after ${maxSec} s: ${label} | inv ${JSON.stringify(this.w.inv)}`);
    }
  }

  free(x, y, any) {
    const w = this.w;
    if (!w.inb(x, y)) return false;
    const i = y * w.w + x;
    return w.terrain[i] === T_GROUND && !w.occ[i] && (any || w.film[i] > 0) && !this.reserved.has(i);
  }

  resOf(item) { return Object.values(this.w.reg.resources).find(r => r.item === item); }

  // nearest deposit tile of an item to the Core
  rawTile(item) {
    const w = this.w, r = this.resOf(item);
    if (!r) return null;
    const ri = w.reg.resIndex[r.id];
    let best = null, bd = 1e9;
    for (let i = 0; i < w.res.length; i++) {
      if (w.res[i] !== ri || w.resAmt[i] <= 0) continue;
      const x = i % w.w, y = (i / w.w) | 0, d = Math.hypot(x - this.cx - 2, y - this.cy - 2);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    return best;
  }

  harvest(item, n) {
    const w = this.w, target = (w.stats.delivered[item] || 0) + n;
    let guard = 0;
    while ((w.stats.delivered[item] || 0) < target) {
      const t = this.rawTile(item);
      if (!t) throw new Error(`no ${item} left to harvest`);
      w.harvest(t[0], t[1]);
      this.step(1);
      if (++guard > 200000) throw new Error('harvest stuck');
    }
  }

  afford(cost, mul = 1) {
    const w = this.w;
    let guard = 0;
    while (!w.has(cost, mul)) {
      let acted = false;
      for (const k in cost) {
        const lack = cost[k] * mul - (w.inv[k] || 0);
        if (lack > 0 && this.rawTile(k)) { this.harvest(k, lack); acted = true; }
      }
      if (!acted) {
        this.step(30);
        if (this.onIdle) this.onIdle();
        if (++guard > 1800) throw new Error(`cannot afford ${JSON.stringify(cost)}; have ${JSON.stringify(w.inv)}`);
      }
    }
  }

  build(type, x, y, dir = 0) {
    const w = this.w, p = w.reg.entities[type];
    this.afford(p.cost || {});
    const e = w.build(type, x, y, dir);
    if (!e) throw new Error(`cannot build ${type} at ${x},${y}: ${w.canPlace(type, x, y).reason}`);
    return e;
  }

  areaFree(x, y, s, margin = 0) {
    const w = this.w;
    for (let j = -margin; j < s + margin; j++) for (let i = -margin; i < s + margin; i++) {
      const tx = x + i, ty = y + j, inside = i >= 0 && j >= 0 && i < s && j < s;
      if (inside) { if (!this.free(tx, ty)) return false; }
      else if (!w.inb(tx, ty) || w.terrain[ty * w.w + tx] !== T_GROUND || w.occ[ty * w.w + tx] || this.reserved.has(ty * w.w + tx)) return false;
    }
    return true;
  }

  // nearest free place for an s x s building around (nx, ny)
  spot(s, nx, ny, o = {}) {
    const R = o.maxR || 30, margin = o.margin ?? 1;
    let best = null, bd = 1e9;
    for (let y = Math.max(0, Math.floor(ny - R)); y < Math.min(this.w.h, ny + R); y++) {
      for (let x = Math.max(0, Math.floor(nx - R)); x < Math.min(this.w.w, nx + R); x++) {
        const d = Math.hypot(x + s / 2 - nx, y + s / 2 - ny);
        if (d >= bd || (o.minD && d < o.minD)) continue;
        if (!this.areaFree(x, y, s, margin) || (o.ok && !o.ok(x, y))) continue;
        bd = d; best = [x, y];
      }
    }
    if (!best) throw new Error(`no free ${s}x${s} spot near ${nx},${ny}`);
    return best;
  }

  minerSpot(item) {
    const w = this.w, ri = w.reg.resIndex[this.resOf(item).id];
    let best = null, bs = -1e9;
    for (let y = 0; y < w.h - 1; y++) for (let x = 0; x < w.w - 1; x++) {
      if (!this.areaFree(x, y, 2, 0)) continue;
      let c = 0, amt = 0;
      for (const [i, j] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = (y + j) * w.w + x + i; if (w.res[k] === ri) { c++; amt += w.resAmt[k]; } }
      if (!c || amt < 40) continue;
      const score = c * 100 - Math.hypot(x - this.cx - 1, y - this.cy - 1);
      if (score > bs) { bs = score; best = [x, y]; }
    }
    return best;
  }

  // grow the biofilm with slime cells until it covers (tx, ty)
  expandTo(tx, ty) {
    const w = this.w;
    for (let n = 0; n < 14 && !w.film[this.k(tx, ty)]; n++) {
      let best = null, bd = 1e9;
      for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
        if (!this.free(x, y)) continue;
        const d = Math.hypot(x - tx, y - ty);
        if (d < bd) { bd = d; best = [x, y]; }
      }
      if (!best) throw new Error('no place for a slime cell');
      this.build('node', best[0], best[1], 0);
    }
    if (!w.film[this.k(tx, ty)]) throw new Error(`could not grow biofilm to ${tx},${ty}`);
  }

  // shortest chain of free tiles from (sx, sy) to a tile next to `target`
  // (any = true also walks over ground that has no biofilm yet; lay() then grows it)
  path(sx, sy, target, any = false) {
    const w = this.w;
    if (!this.free(sx, sy, any)) return null;
    const prev = new Map(), start = this.k(sx, sy), q = [start];
    prev.set(start, -1);
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % w.w, y = (c / w.w) | 0;
      for (let d = 0; d < 4; d++) {
        const t = w.entAt(x + DX[d], y + DY[d]);
        // reaching the target, or joining a pathway that already leads to it
        if (t === target || (t && this.trunk.get(t) === target && t.dir !== ((d + 2) & 3) && !t._p.tunnel)) {
          const tiles = [];
          for (let t = c; t !== -1; t = prev.get(t)) tiles.unshift([t % w.w, (t / w.w) | 0]);
          return { tiles, last: d, target };
        }
      }
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d], ny = y + DY[d], nk = this.k(nx, ny);
        if (prev.has(nk) || !this.free(nx, ny, any)) continue;
        prev.set(nk, c); q.push(nk);
      }
    }
    return null;
  }

  lay(p, type = 'belt') {
    const out = [];
    // grow biofilm under the route first, keeping slime cells off the route itself
    const keys = p.tiles.map(([x, y]) => this.k(x, y)).filter(k => !this.reserved.has(k));
    for (const k of keys) this.reserved.add(k);
    for (const [x, y] of p.tiles) if (!this.w.film[this.k(x, y)]) this.expandTo(x, y);
    for (const k of keys) this.reserved.delete(k);
    p.tiles.forEach(([x, y], i) => {
      let dir = p.last;
      if (i < p.tiles.length - 1) { const [nx, ny] = p.tiles[i + 1]; dir = nx > x ? 0 : nx < x ? 2 : ny > y ? 1 : 3; }
      out.push(this.build(type, x, y, dir));
    });
    if (type === 'belt' && p.target) for (const e of out) this.trunk.set(e, p.target);
    return out;
  }

  outTileOf(x, y, s, dir) {
    const m = (s - 1) >> 1;
    return dir === 0 ? [x + s, y + m] : dir === 1 ? [x + m, y + s] : dir === 2 ? [x - 1, y + m] : [x + m, y - 1];
  }

  // place a building whose output is carried by pathway to `dst` (picks the best facing)
  placeRouted(type, x, y, dst) {
    const w = this.w, s = w.reg.entities[type].size[0];
    const mine = [];
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) { const k = this.k(x + i, y + j); if (!this.reserved.has(k)) { this.reserved.add(k); mine.push(k); } }
    let best = null;
    for (let dir = 0; dir < 4; dir++) {
      const [ox, oy] = this.outTileOf(x, y, s, dir);
      if (w.entAt(ox, oy) === dst) { best = { dir, p: null, n: 0 }; break; }
      const p = this.path(ox, oy, dst);
      if (p && (!best || p.tiles.length < best.n)) best = { dir, p, n: p.tiles.length };
    }
    if (!best) for (let dir = 0; dir < 4; dir++) {
      const [ox, oy] = this.outTileOf(x, y, s, dir);
      const p = this.path(ox, oy, dst, true);
      if (p && (!best || p.tiles.length < best.n)) best = { dir, p, n: p.tiles.length };
    }
    for (const k of mine) this.reserved.delete(k);
    if (!best) throw new Error(`no route from ${type} at ${x},${y} to ${dst.type}`);
    const e = this.build(type, x, y, best.dir);
    if (best.p) this.lay(best.p);
    return e;
  }

  // absorber on the nearest deposit of `item`, pathway to dst (default: the Core)
  mine(item, dst = this.w.core) {
    let s = this.minerSpot(item);
    for (let n = 0; !s && n < 8; n++) {
      const t = this.rawTile(item);
      if (!t) throw new Error(`no ${item} deposit`);
      this.expandTo(t[0], t[1]);
      s = this.minerSpot(item);
      if (!s) {
        // covered the nearest tile only; push one more slime cell towards the middle of the deposit
        const far = this.farTile(item);
        this.expandTo(far[0], far[1]);
        s = this.minerSpot(item);
      }
    }
    if (!s) throw new Error(`no place for an absorber on ${item}`);
    return this.placeRouted('absorber', s[0], s[1], dst);
  }

  // a point `back` tiles from the nearest deposit of `item` towards the Core
  towards(item, back = 4) {
    const t = this.rawTile(item), cx = this.cx + 2, cy = this.cy + 2;
    const d = Math.hypot(cx - t[0], cy - t[1]) || 1, k = Math.min(1, back / d);
    return [Math.round(t[0] + (cx - t[0]) * k), Math.round(t[1] + (cy - t[1]) * k)];
  }

  farTile(item) {
    const w = this.w, ri = w.reg.resIndex[this.resOf(item).id], near = this.rawTile(item);
    let best = near, bd = -1;
    for (let i = 0; i < w.res.length; i++) {
      if (w.res[i] !== ri || w.film[i]) continue;
      const x = i % w.w, y = (i / w.w) | 0, d = Math.hypot(x - near[0], y - near[1]);
      if (d <= 5 && d > bd) { bd = d; best = [x, y]; }
    }
    return best;
  }

  // a machine near the Core, fed by pathway from elsewhere, sending its product to dst
  machine(type, recipe, dst = this.w.core, near) {
    const s = this.w.reg.entities[type].size[0];
    const [x, y] = this.spot(s, near ? near[0] : this.cx + 2, near ? near[1] : this.cy + 2, { margin: 1, minD: near ? 0 : 5 });
    if (this.trace) console.log('machine', type, recipe, x, y);
    const e = this.placeRouted(type, x, y, dst);
    if (recipe) setRecipe(this.w, e, recipe);
    return e;
  }

  // ---- machines served by pili straight from the Core ---------------------------------
  // A slot is a place on one side of the Core: [Core][pilus gap][machine].
  slot(side, s, row = 0) {
    const { cx, cy } = this;
    const sl = { side, s, row };
    if (side === 'E') Object.assign(sl, { mx: cx + 5, my: cy + row, pin: [cx + 4, cy + row, 0], pout: [cx + 4, cy + row + 1, 2], face: 2 });
    else if (side === 'W') Object.assign(sl, { mx: cx - 1 - s, my: cy + row, pin: [cx - 1, cy + row, 2], pout: [cx - 1, cy + row + 1, 0], face: 0 });
    else if (side === 'S') Object.assign(sl, { mx: cx + row, my: cy + 5, pin: [cx + row, cy + 4, 1], pout: [cx + row + 1, cy + 4, 3], face: 3 });
    else Object.assign(sl, { mx: cx + row, my: cy - 1 - s, pin: [cx + row, cy - 1, 3], pout: [cx + row + 1, cy - 1, 1], face: 1 });
    sl.tiles = [this.k(sl.pin[0], sl.pin[1]), this.k(sl.pout[0], sl.pout[1])];
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) sl.tiles.push(this.k(sl.mx + i, sl.my + j));
    for (const t of sl.tiles) {
      if (!this.free(t % this.w.w, (t / this.w.w) | 0)) throw new Error(`slot ${side}${row} is blocked`);
    }
    for (const t of sl.tiles) this.reserved.add(t);
    return sl;
  }

  fill(sl, type, recipe, o = {}) {
    for (const t of sl.tiles) this.reserved.delete(t);
    const e = this.build(type, sl.mx, sl.my, sl.face);
    this.build('pilus', sl.pin[0], sl.pin[1], sl.pin[2]);
    if (o.out !== false) this.build('pilus', sl.pout[0], sl.pout[1], sl.pout[2]);
    if (recipe) setRecipe(this.w, e, recipe);
    return e;
  }

  // run a recipe on a Core-fed machine until n more products are back in the Core
  craft(m, recipe, n, maxSec) {
    const w = this.w, r = w.reg.recipes[recipe], item = Object.keys(r.out)[0];
    if (!w.unlockedR.has(recipe)) throw new Error(`recipe ${recipe} is locked`);
    setRecipe(w, m, recipe);
    this.busy.add(m);
    const t0 = w.tick;
    if (item) {
      const target = (w.stats.delivered[item] || 0) + n;
      this.until(() => (w.stats.delivered[item] || 0) >= target, maxSec || 240 + n * r.time * 5, `craft ${n} ${recipe} (state ${m._state})`);
    } else {
      const f = Object.keys(r.fout)[0], crafts = Math.ceil(n / r.fout[f]);
      const net = () => (m._nets || []).find(x => x.fluid === f);
      this.until(() => (net()?.amt || 0) >= crafts * r.fout[f], maxSec || 240 + crafts * r.time * 5, `craft ${n} ${recipe}`);
    }
    setRecipe(w, m, null);
    this.busy.delete(m);
    if (this.trace) console.log(`  ${(w.tick / 3600).toFixed(1)} min: ${n} ${recipe} took ${Math.round((w.tick - t0) / 60)} s`);
  }

  // make sure the Core holds at least n of an item, crafting the difference
  stock(m, recipe, n) {
    const item = Object.keys(this.w.reg.recipes[recipe].out)[0];
    const have = this.w.inv[item] || 0;
    if (have < n) this.craft(m, recipe, n - have);
  }

  // ---- fluids ----------------------------------------------------------------------------
  // pump on the shore + channels to a tile next to `target`
  pumpTo(target) {
    const w = this.w;
    const shore = (needFilm) => {
      const out = [];
      for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
        const i = y * w.w + x;
        if (w.terrain[i] !== T_GROUND || w.occ[i] || this.reserved.has(i) || (needFilm && !w.film[i])) continue;
        let wet = false;
        for (let d = 0; d < 4; d++) { const nx = x + DX[d], ny = y + DY[d]; if (w.inb(nx, ny) && w.terrain[ny * w.w + nx] === T_WATER) wet = true; }
        if (wet) out.push([x, y]);
      }
      return out;
    };
    const c = target._p.size[0] / 2, tx = target.x + c, ty = target.y + c;
    const pick = (any) => {
      let best = null;
      for (const [x, y] of shore(!any)) {
        const p = this.path(x, y, target, any);
        if (p && (!best || p.tiles.length < best.tiles.length)) best = p;
      }
      return best;
    };
    const p = pick(false) || pick(true);
    if (!p) throw new Error('no channel route from water');
    void tx; void ty;
    const [px, py] = p.tiles[0];
    const keys = p.tiles.map(([x, y]) => this.k(x, y));
    for (const k of keys) this.reserved.add(k);
    for (const [x, y] of p.tiles) if (!w.film[this.k(x, y)]) this.expandTo(x, y);
    for (const k of keys) this.reserved.delete(k);
    const pump = this.build('pump', px, py, 0);
    this.lay({ tiles: p.tiles.slice(1), last: p.last }, 'pipe');
    return pump;
  }

  // a tank touching `m`, kept away from other channels so it forms its own network
  tankAt(m) {
    const w = this.w, s = m._p.size[0];
    const cands = [];
    for (let i = -1; i < s; i++) { cands.push([m.x + i, m.y + s], [m.x + i, m.y - 2], [m.x + s, m.y + i], [m.x - 2, m.y + i]); }
    for (const [x, y] of cands) {
      if (!this.areaFree(x, y, 2, 0)) continue;
      const t = this.build('tank', x, y, 0);
      for (let j = -1; j <= 2; j++) for (let i = -1; i <= 2; i++) if (w.inb(x + i, y + j)) this.reserved.add(this.k(x + i, y + j));
      return t;
    }
    throw new Error('no place for a tank');
  }

  // slime cell on the free biofilm tile furthest from the Core
  growFilm() {
    const w = this.w;
    let best = null, bd = -1;
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      if (!this.free(x, y)) continue;
      const d = Math.hypot(x - this.cx - 2, y - this.cy - 2);
      if (d > bd) { bd = d; best = [x, y]; }
    }
    return this.build('node', best[0], best[1], 0);
  }

  research(id, maxSec = 1500) {
    const w = this.w;
    if (w.techs[id]?.done) return;
    if (!w.startResearch(id)) throw new Error(`cannot research ${id}`);
    this.until(() => w.techs[id]?.done, maxSec, `research ${id} (${JSON.stringify(w.techs[id])})`);
  }
}
