// ATP network. The whole colony shares one network. Consumers call request() while they work
// and are slowed down by the satisfaction of the previous tick.
export function request(w, rate) { w.power.req += rate; return w.power.sat; }

export function powerTick(w) {
  const P = w.power, D = P.req;
  const core = w.core;
  let free = core ? (core._p.basePower || 0) : 0;
  for (const e of w.lists.solar || []) {
    if (!w.film[e.y * w.w + e.x]) continue;
    free += e._p.power * (w.light[e.y * w.w + e.x] ? 1 : (e._p.dim ?? 0.15));
  }
  const gens = w.lists.generator || [];
  let genCap = 0;
  for (const e of gens) {
    e._on = (e.burn > 0 || e.fn > 0) && w.film[e.y * w.w + e.x] > 0;
    if (e._on) genCap += e._p.power;
  }
  let cap = 0;
  for (const e of w.lists.accumulator || []) cap += e._p.store;
  P.cap = cap;
  if (P.stored > cap) P.stored = cap;

  let delivered = Math.min(D, free), load = 0;
  if (D > free) {
    if (genCap > 0) { load = Math.min(1, (D - free) / genCap); delivered += genCap * load; }
    if (delivered < D && P.stored > 0) {
      const take = Math.min(P.stored, (D - delivered) / 60);
      P.stored -= take; delivered += take * 60;
    }
  } else if (cap > P.stored) {
    // spare free energy charges the stores; generators also top them up at a gentle rate
    let spare = free - D;
    if (genCap > 0) { load = Math.min(1, (cap - P.stored) * 60 / genCap) * 0.5; spare += genCap * load; }
    P.stored = Math.min(cap, P.stored + spare / 60);
  }
  if (load > 0) {
    for (const e of gens) {
      if (!e._on) continue;
      if (e.burn <= 0 && e.fn > 0) {
        e.fn--;
        e.burn += (w.reg.items[e.fi]?.fuel || 0) * (e._p.efficiency || 1);
      }
      e.burn -= e._p.power * load / 60;
      if (e.burn < 0 && e.fn <= 0) e.burn = 0;
      e._load = load;
      if (e._p.pollution && (w.tick + e.id) % 60 === 0) w.pollute(e.x, e.y, e._p.pollution * load);
    }
  } else for (const e of gens) e._load = 0;
  P.sat = D > 0 ? Math.min(1, delivered / D) : 1;
  P.demand = D; P.supply = free + genCap; P.req = 0;
}
