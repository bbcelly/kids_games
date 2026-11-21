// Fluids. Every connected group of channels, tanks and pumps is one shared container that
// holds a single kind of fluid. Machines are not part of a network; they use the networks
// that touch them.
import { DX, DY } from './world.js';

function neighbours(w, e, fn) {
  const s = e._p.size[0];
  for (let i = 0; i < s; i++) {
    fn(w.entAt(e.x + i, e.y - 1)); fn(w.entAt(e.x + i, e.y + s));
    fn(w.entAt(e.x - 1, e.y + i)); fn(w.entAt(e.x + s, e.y + i));
  }
}

export function rebuildFluids(w, keep = true) {
  if (keep) {
    for (const n of w.nets) for (const m of n.members) {
      m.fl = n.fluid; m.fa = n.cap ? n.amt * m._p.fluidCap / n.cap : 0;
    }
  }
  w.nets = [];
  const members = w.list.filter(e => e._p.fluidCap);
  for (const m of members) m._net = null;
  for (const m of members) {
    if (m._net) continue;
    const net = { fluid: null, amt: 0, cap: 0, members: [] };
    const stack = [m];
    m._net = net;
    while (stack.length) {
      const c = stack.pop();
      net.members.push(c); net.cap += c._p.fluidCap;
      neighbours(w, c, (t) => { if (t && t._p.fluidCap && !t._net) { t._net = net; stack.push(t); } });
    }
    net.members.sort((a, b) => a.id - b.id);
    const sums = {};
    for (const c of net.members) if (c.fl && c.fa > 0) sums[c.fl] = (sums[c.fl] || 0) + c.fa;
    let best = null;
    for (const f in sums) if (best === null || sums[f] > sums[best]) best = f;
    if (best === null) for (const c of net.members) if (c.fl) { best = c.fl; break; }
    net.fluid = best; net.amt = best && sums[best] ? Math.min(sums[best], net.cap) : 0;
    w.nets.push(net);
  }
  for (const e of w.list) {
    if (!e._p.fluidUser) continue;
    const nets = [];
    neighbours(w, e, (t) => { if (t && t._net && !nets.includes(t._net)) nets.push(t._net); });
    e._nets = nets;
  }
  w.fluidsDirty = false;
}

export function fluidAvail(e, f) {
  let a = 0;
  for (const n of e._nets || []) if (n.fluid === f) a += n.amt;
  return a;
}

export function fluidDraw(e, f, amt) {
  for (const n of e._nets || []) {
    if (n.fluid !== f || amt <= 0) continue;
    const d = Math.min(n.amt, amt);
    n.amt -= d; amt -= d;
  }
}

function outNet(e, f) {
  let best = null;
  for (const n of e._nets || []) if (n.fluid === f && (!best || n.cap - n.amt > best.cap - best.amt)) best = n;
  if (best) return best;
  for (const n of e._nets || []) if (!n.fluid) return n;
  return null;
}

export function fluidRoom(e, f) { const n = outNet(e, f); return n ? n.cap - n.amt : 0; }

export function fluidPush(e, f, amt) {
  const n = outNet(e, f);
  if (!n) return false;
  n.fluid = f; n.amt = Math.min(n.cap, n.amt + amt);
  return true;
}

export function flush(net) { net.amt = 0; net.fluid = null; for (const m of net.members) { m.fl = null; m.fa = 0; } }

// Exact network contents for saving (see save.js).
export function netState(w) { return w.nets.map(n => ({ m: n.members[0].id, f: n.fluid, a: n.amt })); }

export function restoreNets(w, saved) {
  rebuildFluids(w, false);
  for (const s of saved || []) {
    const m = w.ents.get(s.m);
    if (m && m._net) { m._net.fluid = s.f; m._net.amt = Math.min(s.a, m._net.cap); }
  }
}

export const DIRS = [DX, DY];
