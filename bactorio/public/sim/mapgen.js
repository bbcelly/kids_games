// Map building helpers (handed to mission.setup) and the procedural map for free play.
import { T_GROUND, T_WATER, T_ROCK } from './world.js';

export function mapHelpers(w) {
  const disc = (x, y, r, fn, rough = 0.35) => {
    for (let j = Math.floor(y - r - 1); j <= y + r + 1; j++) for (let i = Math.floor(x - r - 1); i <= x + r + 1; i++) {
      if (!w.inb(i, j)) continue;
      const d = Math.hypot(i - x, j - y);
      // a deterministic wobble makes blobs instead of perfect circles
      const wob = Math.sin(i * 1.7 + j * 0.9 + x) * Math.cos(j * 1.3 - i * 0.6 + y) * rough * r * 0.5;
      if (d <= r + wob) fn(i, j, d);
    }
  };
  const h = {
    world: w,
    rng: w.rng,
    fill(terrain) { w.terrain.fill(terrain); },
    deposit(resource, x, y, r, amount = 400) {
      const idx = w.reg.resIndex[resource];
      if (!idx) throw new Error(`unknown resource "${resource}"`);
      disc(x, y, r, (i, j, d) => {
        const k = j * w.w + i;
        if (w.terrain[k] !== T_GROUND || w.occ[k]) return;
        w.res[k] = idx; w.resAmt[k] = Math.max(1, Math.min(60000, Math.round(amount * (1.15 - 0.5 * d / (r + 1)))));
      });
    },
    water(x, y, r) { disc(x, y, r, (i, j) => { const k = j * w.w + i; if (!w.occ[k]) { w.terrain[k] = T_WATER; w.res[k] = 0; w.resAmt[k] = 0; } }); },
    rock(x, y, r) { disc(x, y, r, (i, j) => { const k = j * w.w + i; if (!w.occ[k]) { w.terrain[k] = T_ROCK; w.res[k] = 0; w.resAmt[k] = 0; } }); },
    rockRect(x0, y0, x1, y1) { for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) if (w.inb(i, j) && !w.occ[j * w.w + i]) { w.terrain[j * w.w + i] = T_ROCK; w.res[j * w.w + i] = 0; } },
    clear(x, y, r) { disc(x, y, r, (i, j) => { const k = j * w.w + i; w.terrain[k] = T_GROUND; w.res[k] = 0; w.resAmt[k] = 0; }, 0); },
    light(x, y, r) { disc(x, y, r, (i, j) => { w.light[j * w.w + i] = 1; }); },
    lightAll() { w.light.fill(1); },
    core(x, y, type = 'core') { h.clear(x + 2, y + 2, 5); return w.place(type, x, y, 0, { force: true }); },
    nest(x, y, type = 'nest') { if (w.peaceful) return null; h.clear(x + 1, y + 1, 3); return w.place(type, x, y, 0, { force: true }); },
    place(type, x, y, dir = 0) { return w.place(type, x, y, dir, { force: true }); },
  };
  return h;
}

// Free play: lakes, rocks and deposits scattered from the seed. Richer and rarer further out.
export function generateFree(w, h, o = {}) {
  const rng = w.rng, W = w.w, H = w.h, cx = W >> 1, cy = H >> 1;
  const far = (min, max) => {
    for (let n = 0; n < 60; n++) {
      const a = rng.next() * Math.PI * 2, r = rng.range(min, max);
      const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
      if (x > 5 && y > 5 && x < W - 6 && y < H - 6) return [x, y];
    }
    return [cx, cy];
  };
  const reach = Math.min(W, H) / 2 - 8;
  for (let i = 0; i < Math.round(W * H / 900); i++) { const [x, y] = far(16, reach); h.water(x, y, rng.range(2.5, 6)); }
  for (let i = 0; i < Math.round(W * H / 700); i++) { const [x, y] = far(15, reach); h.rock(x, y, rng.range(1.5, 4)); }
  for (let i = 0; i < Math.round(W * H / 1500); i++) { const [x, y] = far(8, reach); h.light(x, y, rng.range(5, 9)); }
  h.clear(cx, cy, 12);   // the starting biofilm is always open ground
  // guaranteed starting deposits around the Core
  const order = w.reg.sorted('resources').filter(r => r.item && r.free !== false);
  const base = rng.next() * Math.PI * 2;
  order.forEach((r, i) => {
    const a = base + i * (Math.PI * 2 / Math.max(4, order.length)) + rng.range(-0.25, 0.25);
    const dist = 8 + i * 2.5;
    const x = Math.round(cx + Math.cos(a) * dist), y = Math.round(cy + Math.sin(a) * dist);
    h.clear(x, y, 4); h.deposit(r.id, x, y, 3 + (i < 2 ? 0.6 : 0), 900);
  });
  const wa = base + Math.PI / order.length;
  h.water(Math.round(cx + Math.cos(wa) * 15), Math.round(cy + Math.sin(wa) * 15), 3.2);
  h.light(cx, cy, 9);
  for (const r of order) {
    for (let i = 0; i < Math.round(W * H / 2600); i++) {
      const [x, y] = far(22, reach);
      h.deposit(r.id, x, y, rng.range(2.5, 4.5), 1500 + Math.hypot(x - cx, y - cy) * 40);
    }
  }
  h.core(cx - 2, cy - 2);
  if (!w.peaceful) {
    const n = o.nests ?? Math.max(2, Math.round(W * H / 6000));
    for (let i = 0; i < n; i++) {
      const a = base + i * (Math.PI * 2 / n) + rng.range(-0.3, 0.3), r = Math.min(reach, rng.range(38, 50));
      h.nest(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r));
    }
  }
}
