// The host's immune response: toxins from production spread over the map, immune nodes soak
// them up and send waves of cells at the colony.
import { DX, DY, T_GROUND } from './world.js';

export function initThreat(def) {
  return {
    interval: def.interval ?? 120, base: def.base ?? 2, growth: def.growth ?? 1, angerPer: def.angerPer ?? 40,
    max: def.max ?? 30, types: def.types || [{ id: 'neutrophil', from: 0 }],
    next: Math.round((def.first ?? 180) * 60), wave: 0, pending: 0,
    anti: def.antibiotic ? { interval: def.antibiotic.interval, duration: def.antibiotic.duration, next: Math.round((def.antibiotic.first ?? def.antibiotic.interval) * 60), until: 0 } : null,
  };
}

export function toxinTick(w) {
  const { cw, ch, tox } = w, k = 0.03;
  const src = Float32Array.from(tox);
  let total = 0;
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const i = y * cw + x, v = src[i];
    let s = 0, n = 0;
    if (x > 0) { s += src[i - 1]; n++; }
    if (x < cw - 1) { s += src[i + 1]; n++; }
    if (y > 0) { s += src[i - cw]; n++; }
    if (y < ch - 1) { s += src[i + cw]; n++; }
    const nv = (v + k * (s - n * v)) * 0.997;
    tox[i] = nv < 0.001 ? 0 : nv;
    total += tox[i];
  }
  w.toxTotal = total;
  if (w.peaceful) return;
  for (const nest of w.nests) {
    const cx = (nest.x / 8) | 0, cy = (nest.y / 8) | 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const x = cx + i, y = cy + j;
      if (x < 0 || y < 0 || x >= cw || y >= ch) continue;
      const take = tox[y * cw + x] * 0.1;
      tox[y * cw + x] -= take;
      nest.anger = (nest.anger || 0) + take;
    }
  }
}

export function rebuildFlow(w) {
  const { w: W, h: H, flow, occ, terrain } = w;
  flow.fill(65535);
  const q = new Int32Array(W * H);
  let head = 0, tail = 0;
  for (const e of w.list) {
    if (e._p.enemy) continue;
    const s = e._p.size[0];
    for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
      const k = (e.y + j) * W + e.x + i;
      flow[k] = 0; q[tail++] = k;
    }
  }
  while (head < tail) {
    const k = q[head++], x = k % W, y = (k / W) | 0, d = flow[k] + 1;
    for (let dir = 0; dir < 4; dir++) {
      const nx = x + DX[dir], ny = y + DY[dir];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = ny * W + nx;
      if (flow[nk] <= d || terrain[nk] !== T_GROUND || occ[nk]) continue;
      flow[nk] = d; q[tail++] = nk;
    }
  }
  w.pathDirty = false;
  w.flowTick = w.tick;
}

function spawnWave(w) {
  const th = w.threat;
  const types = th.types.filter(t => t.from <= th.wave);
  let spawned = 0;
  for (const nest of w.nests) {
    const n = Math.min(th.max, Math.floor(th.base + th.growth * th.wave + (nest.anger || 0) / th.angerPer));
    nest.anger = 0;
    const c = nest._p.size[0] / 2;
    for (let i = 0; i < n; i++) {
      const type = types[Math.min(types.length - 1, w.rng.int(types.length + (i % 2)))].id;
      const proto = w.reg.enemies[type];
      if (!proto) continue;
      const a = w.rng.next() * Math.PI * 2, r = c + 0.8 + w.rng.next() * 1.5;
      w.enemies.push({ id: w.nextEnemy++, type, x: nest.x + c + Math.cos(a) * r, y: nest.y + c + Math.sin(a) * r, hp: proto.hp, cd: 0 });
      spawned++;
    }
  }
  th.wave++;
  if (spawned) { th.pending++; w.effect({ t: 'wave', n: spawned }); w.reg.emit('wave', w, spawned); }
}

export function threatTick(w) {
  const th = w.threat;
  if (th && !w.peaceful) {
    if (w.tick >= th.next) {
      th.next = w.tick + Math.round(th.interval * 60);
      if (w.nests.length) spawnWave(w);
    }
    const a = th.anti;
    if (a) {
      if (w.tick >= a.next) { a.until = w.tick + Math.round(a.duration * 60); a.next = w.tick + Math.round(a.interval * 60); w.effect({ t: 'antibiotic' }); }
      w.antibiotic = w.tick < a.until;
    }
  }
  const en = w.enemies;
  if (!en.length) {
    if (th && th.pending) { w.stats.wavesCleared += th.pending; th.pending = 0; }
    return;
  }
  if (w.pathDirty && (w.flowTick == null || w.tick - w.flowTick >= 20)) rebuildFlow(w);
  const W = w.w, flow = w.flow;
  let dead = false;
  for (let n = 0; n < en.length; n++) {
    const u = en[n];
    if (u.hp <= 0) { dead = true; continue; }
    const p = w.reg.enemies[u.type];
    if (!p) { u.hp = 0; dead = true; continue; }
    const tx = Math.floor(u.x), ty = Math.floor(u.y);
    if (!w.inb(tx, ty)) { u.hp = 0; dead = true; continue; }
    const here = flow[ty * W + tx];
    // next to a building: attack it
    let target = null;
    if (here <= 1) {
      target = w.entAt(tx, ty);
      for (let d = 0; d < 4 && (!target || target._p.enemy); d++) target = w.entAt(tx + DX[d], ty + DY[d]);
      if (target && target._p.enemy) target = null;
    }
    if (target) {
      if (u.cd > 0) { u.cd--; continue; }
      u.cd = Math.round(p.cooldown * 60);
      if (p.infect) {
        target.dis = w.tick + Math.round(p.infect * 60);
        w.effect({ t: 'infect', x: u.x, y: u.y });
        u.hp = 0; dead = true;
      }
      w.effect({ t: 'bite', x: u.x, y: u.y });
      w.damage(target, p.damage);
      if (w.lost) return;
      continue;
    }
    // walk downhill on the distance field (or straight at the core when cut off)
    let gx, gy;
    if (here === 65535) {
      if (!w.core) continue;
      gx = w.core.x + 2; gy = w.core.y + 2;
    } else {
      let best = here, bd = -1;
      for (let d = 0; d < 4; d++) {
        const nx = tx + DX[d], ny = ty + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= w.h) continue;
        const v = flow[ny * W + nx];
        if (v < best || (v === best && bd >= 0 && ((u.id + d) & 3) === 0)) { best = v; bd = d; }
      }
      if (bd < 0) continue;
      const off = ((u.id * 37) % 7) / 7 * 0.5 + 0.25;
      gx = tx + DX[bd] + (DX[bd] ? 0.5 : off); gy = ty + DY[bd] + (DY[bd] ? 0.5 : off);
    }
    const ddx = gx - u.x, ddy = gy - u.y, len = Math.hypot(ddx, ddy) || 1, sp = p.speed / 60;
    u.x += ddx / len * Math.min(sp, len); u.y += ddy / len * Math.min(sp, len);
  }
  if (dead) {
    let j = 0;
    for (let n = 0; n < en.length; n++) {
      const u = en[n];
      if (u.hp > 0) en[j++] = u;
      else { w.stats.killed++; w.effect({ t: 'pop', x: u.x, y: u.y }); w.reg.emit('enemyKilled', w, u); }
    }
    en.length = j;
  }
}

// Buildings slowly heal when they have not been hit for a while.
export function regen(w) {
  for (const e of w.list) {
    const max = w.maxHp(e._p);
    if (e.hp < max && !(w.tick - (e._hit || -9999) < 600)) e.hp = Math.min(max, e.hp + max * 0.02);
  }
}
