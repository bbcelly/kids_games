// Game creation and the fixed simulation step (60 per second).
import { World } from './world.js';
import { tickBelts } from './belts.js';
import { rebuildFluids } from './fluids.js';
import { powerTick } from './power.js';
import { threatTick, toxinTick, regen, initThreat } from './enemies.js';
import { checkObjectives } from './objectives.js';
import { mapHelpers } from './mapgen.js';

export const TICKS = 60;

// o = { mission, seed, peaceful, size }
export function createWorld(reg, o = {}) {
  const m = reg.missions[o.mission || 'free'];
  if (!m) throw new Error(`unknown mission "${o.mission}"`);
  const size = (m.free && o.size) || m.size || [96, 96];
  const w = new World(reg, { w: size[0], h: size[1], seed: o.seed ?? m.seed ?? 1, missionId: m.id, peaceful: o.peaceful });
  w.refreshUnlocks();
  const h = mapHelpers(w);
  m.setup(w, h, o);
  if (!w.core) h.core((w.w >> 1) - 2, (w.h >> 1) - 2);
  for (const t of m.start?.techs || []) w.completeTech(t, true);
  for (const k in m.start?.items || {}) w.inv[k] = (w.inv[k] || 0) + m.start.items[k];
  if (m.threat && !w.peaceful) w.threat = initThreat(m.threat);
  w.stats.built = {};
  reg.emit('init', w);
  return w;
}

export function step(w) {
  if (w.lost) return;
  if (w.fluidsDirty) rebuildFluids(w);
  tickBelts(w);
  const T = w.tickers, film = w.film, W = w.w, now = w.tick;
  for (let i = 0; i < T.length; i++) {
    const e = T[i];
    if (e.dis > now || !film[e.y * W + e.x]) continue;
    e._k.tick(w, e, e._p);
  }
  powerTick(w);
  threatTick(w);
  if (now % 60 === 0) { toxinTick(w); regen(w); }
  if (now % 20 === 0) checkObjectives(w);
  w.reg.emit('tick', w);
  w.tick++;
}
