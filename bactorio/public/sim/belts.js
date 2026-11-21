// Cilia pathways (conveyors), vesicle tunnels and junctions.
// A pathway tile carries up to 4 items in one lane. Each item is [itemId, p] where p is the
// distance travelled along the tile (0 = entry edge, len = exit edge), front item first.
import { DX, DY } from './world.js';

export const SPACING = 0.25;

// ---- generic item hand-over used by every building --------------------------------------
export function give(w, t, item, dir, src) { return t && t._k.put ? t._k.put(w, t, item, dir, src) : false; }
export function wants(w, t, item) { return t && t._k.wants ? t._k.wants(w, t, item) : false; }
export function take(w, t, pred) { return t && t._k.take ? t._k.take(w, t, pred) : null; }

// Tile in front of a building (middle of the edge it faces).
export function outTile(e) {
  const s = e._p.size[0], m = (s - 1) >> 1;
  switch (e.dir) {
    case 0: return [e.x + s, e.y + m];
    case 1: return [e.x + m, e.y + s];
    case 2: return [e.x - 1, e.y + m];
    default: return [e.x + m, e.y - 1];
  }
}

// Push one buffered product out of the front of a building.
export function eject(w, e) {
  const o = e.out;
  let it = null;
  for (const k in o) if (o[k] > 0) { it = k; break; }
  if (!it) return false;
  const [tx, ty] = outTile(e);
  const t = w.entAt(tx, ty);
  if (t && t !== e && give(w, t, it, e.dir, e)) {
    if (--o[it] <= 0) delete o[it];
    return true;
  }
  return false;
}

function beltLen(w, e) {
  if (e._p.tunnel && e.mode === 'in' && e.pair) {
    const q = w.ents.get(e.pair);
    if (q) return Math.abs(q.x - e.x) + Math.abs(q.y - e.y);
  }
  return 1;
}

function beltTarget(w, e) {
  if (e._p.tunnel && e.mode === 'in') return e.pair ? w.ents.get(e.pair) || null : null;
  return w.entAt(e.x + DX[e.dir], e.y + DY[e.dir]);
}

function pairTunnel(w, e, p) {
  e.mode = 'in'; e.pair = 0;
  const back = (e.dir + 2) & 3;
  for (let i = 1; i <= (p.reach || 5); i++) {
    const t = w.entAt(e.x + DX[back] * i, e.y + DY[back] * i);
    if (t && t.type === e.type && t.dir === e.dir) {
      if (t.mode === 'in' && !t.pair) { t.pair = e.id; e.pair = t.id; e.mode = 'out'; }
      return;
    }
  }
}

function unpair(w, e) {
  const q = e.pair && w.ents.get(e.pair);
  if (q) { q.pair = 0; q.mode = 'in'; }
  e.pair = 0;
}

export const belt = {
  init(w, e, p) { e.items = []; if (p.tunnel) pairTunnel(w, e, p); },
  rotated(w, e, p) { if (p.tunnel) { unpair(w, e); pairTunnel(w, e, p); } },
  removed(w, e, p, o) {
    if (p.tunnel) unpair(w, e);
    if (o.refund && !o.keepItems) for (const it of e.items) w.give(it[0], 1);
  },
  wants() { return true; },
  put(w, e, item, dir, src) {
    const its = e.items;
    let p0 = 0;
    if (e._p.tunnel) {
      if (e.mode === 'out') { if (!src || src.id !== e.pair) return false; }
      else if (dir !== e.dir) return false;
    } else {
      if (dir === ((e.dir + 2) & 3)) return false;          // head-on
      if (dir !== e.dir && e._in !== dir) p0 = 0.5;          // joining from the side
    }
    if (p0 === 0) {
      if (its.length && its[its.length - 1][1] < SPACING) return false;
      its.push([item, 0]);
      return true;
    }
    let at = its.length;
    for (let i = 0; i < its.length; i++) {
      const q = its[i][1];
      if (Math.abs(q - p0) < SPACING) return false;
      if (q < p0 && at === its.length) at = i;
    }
    its.splice(at, 0, [item, p0]);
    return true;
  },
  take(w, e, pred) {
    const its = e.items;
    for (let i = 0; i < its.length; i++) {
      if (pred(its[i][0])) { const it = its[i][0]; its.splice(i, 1); return it; }
    }
    return null;
  },
};

// A junction takes items from behind and hands them out in turn: ahead, right, left.
export const splitter = {
  init(w, e) { e.buf = null; e.rr = 0; e.t = 0; },
  removed(w, e, p, o) { if (o.refund && e.buf) w.give(e.buf, 1); },
  wants(w, e) { return !e.buf; },
  put(w, e, item, dir) {
    if (e.buf || dir !== e.dir) return false;
    e.buf = item; e.t = 5;
    return true;
  },
  take(w, e, pred) { if (e.buf && pred(e.buf)) { const it = e.buf; e.buf = null; return it; } return null; },
  tick(w, e) {
    if (!e.buf) return;
    if (e.t > 0) { e.t--; return; }
    const dirs = [e.dir, (e.dir + 1) & 3, (e.dir + 3) & 3];
    for (let k = 0; k < 3; k++) {
      const d = dirs[(e.rr + k) % 3];
      const t = w.entAt(e.x + DX[d], e.y + DY[d]);
      if (t && give(w, t, e.buf, d, e)) { e.buf = null; e.rr = (e.rr + k + 1) % 3; return; }
    }
  },
};

// Work out the processing order (downstream first, so a full line still flows in one tick)
// and where each tile is fed from (used for drawing bends and for side-joins).
export function rebuildBelts(w) {
  const belts = w.lists.belt || [];
  const order = [];
  for (const b of belts) { b._next = null; b._in = b.dir; }
  for (const b of belts) {
    const t = beltTarget(w, b);
    if (t && t._p.kind === 'belt' && t !== b) b._next = t;
  }
  for (const b of belts) {
    if (b._p.tunnel) continue;
    const back = w.entAt(b.x - DX[b.dir], b.y - DY[b.dir]);
    const feeds = (t) => t && t._p.kind === 'belt' && t._next === b;
    if (feeds(back)) continue;
    const side = [];
    for (const d of [(b.dir + 1) & 3, (b.dir + 3) & 3]) {
      const t = w.entAt(b.x + DX[d], b.y + DY[d]);
      if (feeds(t)) side.push(t);
    }
    if (side.length === 1) b._in = side[0].dir;
  }
  for (const b of belts) order.push(b);
  const depth = new Map();
  const d = (x) => {
    if (depth.has(x)) return depth.get(x);
    depth.set(x, 0);
    const v = x._next ? d(x._next) + 1 : 0;
    depth.set(x, v);
    return v;
  };
  for (const b of belts) d(b);
  order.sort((a, b2) => depth.get(a) - depth.get(b2) || a.id - b2.id);
  w.beltOrder = order;
  w.beltsDirty = false;
}

export function tickBelts(w) {
  if (w.beltsDirty) rebuildBelts(w);
  const order = w.beltOrder;
  const mul = 1 + (w.bonus.beltSpeed || 0);
  for (let n = 0; n < order.length; n++) {
    const e = order[n], its = e.items, len = its.length;
    if (!len) continue;
    const dp = e._p.speed * mul / 60, L = beltLen(w, e);
    if (its[0][1] >= L) {
      const t = e._p.tunnel && e.mode === 'in' ? beltTarget(w, e) : w.entAt(e.x + DX[e.dir], e.y + DY[e.dir]);
      if (t && give(w, t, its[0][0], e.dir, e)) its.shift();
    }
    // keep the spacing across the tile boundary too, so a jam never overlaps items
    let lim = L;
    const nx = e._next;
    if (nx && nx.items.length) { const rear = nx.items[nx.items.length - 1][1]; if (rear < SPACING) lim = L + rear - SPACING; }
    for (let i = 0; i < its.length; i++) {
      const it = its[i];
      const np = it[1] + dp;
      it[1] = np < lim ? np : (lim > it[1] ? lim : it[1]);
      lim = it[1] - SPACING;
    }
  }
}
