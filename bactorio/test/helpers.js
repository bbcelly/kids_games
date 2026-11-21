// Shared helpers for the plain-node tests.
import assert from 'node:assert/strict';
import { Registry } from '../public/engine/registry.js';
import { applyMods } from '../public/engine/modloader.js';
import { World } from '../public/sim/world.js';
import { step } from '../public/sim/sim.js';
import * as base from '../public/base/main.js';

export { assert, step };

const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }

export async function runAll(filter) {
  let failed = 0, passed = 0;
  for (const t of tests) {
    if (filter && !t.name.includes(filter)) continue;
    const t0 = Date.now();
    try { await t.fn(); passed++; console.log(`ok   - ${t.name} (${Date.now() - t0} ms)`); }
    catch (err) { failed++; console.log(`FAIL - ${t.name}\n       ${String(err && err.stack || err).split('\n').slice(0, 6).join('\n       ')}`); }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  return failed;
}

export const baseMod = { manifest: base.manifest, module: base, source: 'builtin' };

export function makeReg(extra = []) {
  const reg = new Registry();
  applyMods(reg, [baseMod, ...extra]);
  return reg;
}

// An open test world: everything unlocked, biofilm everywhere, a rich Core.
export function sandbox(reg = makeReg(), size = 48) {
  const w = new World(reg, { w: size, h: size, missionId: 'free', peaceful: true });
  for (const id in reg.techs) w.completeTech(id, true);
  w.place('core', 22, 22, 0, { force: true });
  w.film.fill(1);
  for (const id in reg.items) w.inv[id] = 100000;
  return w;
}

export function run(w, n) { for (let i = 0; i < n; i++) step(w); }
