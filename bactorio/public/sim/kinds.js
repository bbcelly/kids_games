// Behaviour of buildings, by "kind". A kind is a set of optional handlers:
//   init(w,e,p)            set up state on a freshly placed building
//   tick(w,e,p)            called 60x per second while the building stands on biofilm
//   put(w,e,item,dir,src)  try to accept an item; return true if taken
//   wants(w,e,item)        would put() be useful? (used by pili to choose what to carry)
//   take(w,e,pred)         give up one item for which pred(item) is true, or null
//   removed(w,e,p,o)       clean up; o.refund is true when the player dismantles it
// Mods can add kinds with api.kind(id, handlers).
import { DX, DY } from './world.js';
import { belt, splitter, give, wants, take, eject } from './belts.js';
import { request } from './power.js';
import { fluidAvail, fluidDraw, fluidRoom, fluidPush } from './fluids.js';

function slow(w) { return w.antibiotic && !w.bonus.resist ? 0.25 : 1; }
function refundMap(w, m) { for (const k in m || {}) if (m[k] > 0) w.give(k, m[k]); }
function count(w, key, item, n) { w.stats[key][item] = (w.stats[key][item] || 0) + n; }

const core = {
  wants() { return true; },
  put(w, e, item) {
    w.deliver(item, 1);
    const calm = w.reg.items[item]?.calm; // gifts for the host make the immune nodes less angry
    if (calm) for (const n of w.nests) n.anger = Math.max(0, (n.anger || 0) - calm);
    return true;
  },
  take(w, e, pred) {
    for (const k in w.inv) if (w.inv[k] > 0 && pred(k)) { w.inv[k]--; return k; }
    return null;
  },
};

const storage = {
  init(w, e) { e.inv = {}; e.n = 0; },
  removed(w, e, p, o) { if (o.refund) refundMap(w, e.inv); },
  wants(w, e) { return e.n < e._p.capacity; },
  put(w, e, item) {
    if (e.n >= e._p.capacity) return false;
    e.inv[item] = (e.inv[item] || 0) + 1; e.n++;
    return true;
  },
  take(w, e, pred) {
    for (const k in e.inv) if (e.inv[k] > 0 && pred(k)) {
      if (--e.inv[k] <= 0) delete e.inv[k];
      e.n--;
      return k;
    }
    return null;
  },
};

const miner = {
  init(w, e) { e.out = {}; e.prog = 0; e.ti = 0; e.empty = false; },
  removed(w, e, p, o) { if (o.refund) refundMap(w, e.out); },
  take(w, e, pred) { return takeOut(e, pred); },
  tick(w, e, p) {
    let n = 0;
    for (const k in e.out) n += e.out[k];
    if (n > 0 && (w.tick + e.id) % 6 === 0) eject(w, e);
    if (n >= 4 || e.empty) { if (e.empty && w.tick % 120 === 0) e.empty = false; return; }
    let s = p.speed * (1 + (w.bonus.minerSpeed || 0)) * slow(w);
    if (p.power) s *= request(w, p.power);
    e.prog += s;
    if (e.prog < 60) return;
    const size = p.size[0], tiles = size * size;
    for (let k = 0; k < tiles; k++) {
      const t = (e.ti + k) % tiles;
      const i = (e.y + ((t / size) | 0)) * w.w + e.x + (t % size);
      const r = w.reg.resources[w.reg.resIds[w.res[i]]];
      if (!r || !r.item || w.resAmt[i] <= 0) continue;
      w.takeRes(i);
      e.out[r.item] = (e.out[r.item] || 0) + 1;
      count(w, 'produced', r.item, 1);
      e.ti = (t + 1) % tiles; e.prog = 0;
      if (p.pollution) w.pollute(e.x, e.y, p.pollution);
      return;
    }
    e.prog = 0; e.empty = true;
  },
};

function takeOut(e, pred) {
  for (const k in e.out) if (e.out[k] > 0 && pred(k)) {
    if (--e.out[k] <= 0) delete e.out[k];
    return k;
  }
  return null;
}

export function setRecipe(w, e, id) {
  if (e.recipe === id) return;
  refundMap(w, e.inp); refundMap(w, e.out);
  e.inp = {}; e.out = {}; e.busy = false; e.prog = 0;
  e.recipe = id || null;
}

const crafter = {
  init(w, e, p) {
    e.inp = {}; e.out = {}; e.prog = 0; e.busy = false; e.recipe = null;
    const rs = w.recipesFor(e);
    if (rs.length === 1) e.recipe = rs[0].id;
  },
  removed(w, e, p, o) { if (o.refund) { refundMap(w, e.inp); refundMap(w, e.out); } },
  wants(w, e, item) {
    const r = w.reg.recipes[e.recipe];
    return !!r && !!r.in && r.in[item] > 0 && (e.inp[item] || 0) < r.in[item] * 2;
  },
  put(w, e, item) {
    if (!crafter.wants(w, e, item)) return false;
    e.inp[item] = (e.inp[item] || 0) + 1;
    return true;
  },
  take(w, e, pred) { return takeOut(e, pred); },
  tick(w, e, p) {
    const r = w.reg.recipes[e.recipe];
    if (!r) return;
    e._state = null;
    if (e.busy) {
      let s = p.speed * (1 + (w.bonus.craftSpeed || 0)) * slow(w);
      if (p.power) s *= request(w, p.power);
      e.prog += s;
      if (e.prog >= r.time * 60) {
        e.prog = r.time * 60;
        let ok = true;
        for (const f in r.fout || {}) if (fluidRoom(e, f) < r.fout[f]) ok = false;
        if (!ok) e._state = 'fluidOut';
        else {
          for (const f in r.fout || {}) fluidPush(e, f, r.fout[f]);
          for (const k in r.out || {}) { e.out[k] = (e.out[k] || 0) + r.out[k]; count(w, 'produced', k, r.out[k]); }
          e.busy = false; e.prog = 0;
          if (p.pollution) w.pollute(e.x, e.y, p.pollution * r.time);
          if (p.launch && e.out[p.launch] > 0) {
            w.stats.launched += e.out[p.launch]; delete e.out[p.launch];
            w.effect({ t: 'launch', x: e.x + p.size[0] / 2, y: e.y + p.size[0] / 2 });
          }
          w.reg.emit('crafted', w, e, r);
        }
      }
    }
    if (!e.busy) {
      let ok = true;
      for (const k in r.out || {}) if ((e.out[k] || 0) >= r.out[k] * 2 + 2) { ok = false; e._state = 'full'; }
      if (ok) for (const k in r.in || {}) if ((e.inp[k] || 0) < r.in[k]) { ok = false; e._state = 'input'; break; }
      if (ok) for (const f in r.fin || {}) if (fluidAvail(e, f) < r.fin[f]) { ok = false; e._state = 'fluidIn'; break; }
      if (ok) {
        for (const k in r.in || {}) e.inp[k] -= r.in[k];
        for (const f in r.fin || {}) fluidDraw(e, f, r.fin[f]);
        e.busy = true; e.prog = 0;
      }
    }
    if ((w.tick + e.id) % 6 === 0) eject(w, e);
  },
};

// Pilus: an arm that moves one item from the tile behind it to the tile in front of it.
const pilus = {
  init(w, e) { e.held = null; e.t = 0; e.filter = null; },
  removed(w, e, p, o) { if (o.refund && e.held) w.give(e.held, 1); },
  tick(w, e, p) {
    if (e.t > 0) { e.t--; return; }
    const r = p.reach || 1, dx = DX[e.dir] * r, dy = DY[e.dir] * r;
    const d = w.entAt(e.x + dx, e.y + dy);
    const swing = Math.max(4, Math.round(p.swing / (1 + (w.bonus.pilusSpeed || 0))));
    const s = w.entAt(e.x - dx, e.y - dy);
    if (e.held) {
      if (d && give(w, d, e.held, e.dir, e)) { e.held = null; e.t = swing; }
      else if (d && s && !wants(w, d, e.held)) {
        // the target changed its mind (new recipe, finished research): put the item back
        if (s._p.kind === 'core') { w.give(e.held, 1); e.held = null; e.t = swing; }
        else if (give(w, s, e.held, (e.dir + 2) & 3, e)) { e.held = null; e.t = swing; }
      }
      return;
    }
    if (!s || !d || s === d) return;
    const f = e.filter;
    const it = take(w, s, (item) => (!f || item === f) && wants(w, d, item));
    if (it) { e.held = it; e.t = swing; }
  },
};

const generator = {
  init(w, e) { e.fi = null; e.fn = 0; e.burn = 0; },
  removed(w, e, p, o) { if (o.refund && e.fn > 0) w.give(e.fi, e.fn); },
  wants(w, e, item) {
    const f = w.reg.items[item]?.fuel;
    return f > 0 && (e.fn === 0 || e.fi === item) && e.fn < 10;
  },
  put(w, e, item) {
    if (!generator.wants(w, e, item)) return false;
    e.fi = item; e.fn++;
    return true;
  },
};

const lab = {
  init(w, e) { e.inv = {}; e.unit = 0; },
  removed(w, e, p, o) { if (o.refund) refundMap(w, e.inv); },
  wants(w, e, item) {
    const t = w.reg.techs[w.research];
    return !!t && t.packs.includes(item) && (e.inv[item] || 0) < 6;
  },
  put(w, e, item) {
    if (!lab.wants(w, e, item)) return false;
    e.inv[item] = (e.inv[item] || 0) + 1;
    return true;
  },
  tick(w, e, p) {
    const id = w.research, t = w.reg.techs[id];
    if (!t) { e.unit = 0; return; }
    if (e.unit <= 0) {
      const st = (w.techs[id] ||= { done: false, prog: 0 });
      // do not start a unit that is not needed any more
      let running = 0;
      for (const l of w.lists.lab) if (l.unit > 0) running++;
      if (st.prog + running >= t.units) return;
      for (const k of t.packs) if (!(e.inv[k] > 0)) return;
      for (const k of t.packs) e.inv[k]--;
      e.unit = t.time * 60;
      return;
    }
    let s = p.speed * (1 + (w.bonus.labSpeed || 0)) * slow(w);
    if (p.power) s *= request(w, p.power);
    e.unit -= s;
    if (e.unit <= 0) {
      e.unit = 0;
      const st = (w.techs[id] ||= { done: false, prog: 0 });
      st.prog++;
      if (st.prog >= t.units) w.completeTech(id);
    }
  },
};

const turret = {
  init(w, e) { e.ammo = 0; e.cd = 0; },
  removed(w, e, p, o) { if (o.refund && e.ammo > 0 && p.ammo) w.give(p.ammo, e.ammo); },
  wants(w, e, item) { return item === e._p.ammo && e.ammo < 20; },
  put(w, e, item) { if (!turret.wants(w, e, item)) return false; e.ammo++; return true; },
  tick(w, e, p) {
    if (e.cd > 0) { e.cd--; return; }
    // towers standing on biofilm are restocked from the Core through the slime
    if (p.ammo && e.ammo < 5 && w.inv[p.ammo] > 0 && (w.tick + e.id) % 30 === 0) {
      const n = Math.min(10, w.inv[p.ammo]);
      w.inv[p.ammo] -= n; e.ammo += n;
    }
    if (p.ammo && e.ammo <= 0) return;
    if (!w.enemies.length && !w.nests.length) { e.cd = 20; return; }
    const c = p.size[0] / 2, cx = e.x + c, cy = e.y + c;
    const range = p.range + (w.bonus.turretRange || 0), r2 = range * range;
    const dmg = p.damage * (1 + (w.bonus.turretDamage || 0));
    if (p.splash) {
      let sat = p.power ? request(w, p.power) : 1, hit = false;
      if (sat < 0.3) { e.cd = 30; return; }
      for (const u of w.enemies) {
        const ddx = u.x - cx, ddy = u.y - cy;
        if (ddx * ddx + ddy * ddy <= r2) { u.hp -= dmg * sat; hit = true; }
      }
      if (hit) w.effect({ t: 'spray', x: cx, y: cy, r: range });
      e.cd = hit ? p.cooldown : 15;
      return;
    }
    let best = null, bd = r2;
    for (const u of w.enemies) {
      const ddx = u.x - cx, ddy = u.y - cy, dd = ddx * ddx + ddy * ddy;
      if (dd <= bd) { bd = dd; best = u; }
    }
    if (best) {
      best.hp -= dmg;
      w.effect({ t: 'shot', x: cx, y: cy, x2: best.x, y2: best.y });
    } else {
      let nest = null;
      for (const n of w.nests) {
        const nc = n._p.size[0] / 2, ddx = n.x + nc - cx, ddy = n.y + nc - cy, dd = ddx * ddx + ddy * ddy;
        if (dd <= bd) { bd = dd; nest = n; }
      }
      if (!nest) { e.cd = 15; return; }
      w.effect({ t: 'shot', x: cx, y: cy, x2: nest.x + 1, y2: nest.y + 1 });
      w.damage(nest, dmg);
    }
    if (p.ammo) e.ammo--;
    e.cd = p.cooldown;
  },
};

const pump = {
  tick(w, e, p) {
    const n = e._net;
    if (!n || (n.fluid && n.fluid !== p.fluid) || n.amt >= n.cap) return;
    let s = p.speed * slow(w);
    if (p.power) s *= request(w, p.power);
    n.fluid = p.fluid;
    n.amt = Math.min(n.cap, n.amt + s / 60);
  },
};

const cleaner = {
  tick(w, e, p) {
    if ((w.tick + e.id) % 30) return;
    const sat = p.power ? request(w, p.power) : 1;
    const cx = (e.x / 8) | 0, cy = (e.y / 8) | 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const x = cx + i, y = cy + j;
      if (x < 0 || y < 0 || x >= w.cw || y >= w.ch) continue;
      const k = y * w.cw + x;
      w.tox[k] = Math.max(0, w.tox[k] - p.clean * sat * (i || j ? 0.25 : 1) / 2);
    }
  },
};

// Keeps drawing power so that ATP requests stay honest for always-on consumers.
const passive = {};

export const KINDS = {
  core, storage, miner, crafter, pilus, generator, lab, turret, pump, cleaner, belt, splitter,
  solar: passive, accumulator: passive, node: passive, wall: passive, pipe: passive, nest: passive,
};
