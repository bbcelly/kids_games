// Saving and loading. A save is plain JSON. Tile arrays are base64, buildings are the entity
// objects without their cached (underscore) fields.
import { World } from './world.js';
import { netState, restoreNets } from './fluids.js';
import { hashStr } from '../engine/rng.js';

export const SAVE_VERSION = 1;

function b64(arr) {
  const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

function unb64(str, Type) {
  const s = atob(str), u8 = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
  return new Type(u8.buffer, 0, u8.length / Type.BYTES_PER_ELEMENT);
}

const clean = (k, v) => (k[0] === '_' ? undefined : v);

export function serialize(w) {
  return {
    v: SAVE_VERSION,
    mods: w.reg.mods.map(m => ({ id: m.id, version: m.version })),
    mission: w.missionId, peaceful: w.peaceful, seed: w.seed, rng: w.rng.s,
    w: w.w, h: w.h, tick: w.tick,
    resIds: w.reg.resIds,
    terrain: b64(w.terrain), res: b64(w.res), resAmt: b64(w.resAmt), light: b64(w.light), tox: b64(w.tox),
    ents: JSON.parse(JSON.stringify(w.list, clean)),
    nets: netState(w),
    nextId: w.nextId, nextEnemy: w.nextEnemy,
    inv: w.inv, techs: w.techs, research: w.research, stats: w.stats,
    power: { stored: w.power.stored, sat: w.power.sat },
    enemies: w.enemies, threat: w.threat, antibiotic: w.antibiotic,
    objDone: w.objDone, won: w.won, lost: w.lost, wonTick: w.wonTick,
    lastHarvest: w.lastHarvest, custom: w.custom,
  };
}

// Returns { world, warnings }. Throws if the save cannot be used at all.
export function deserialize(reg, data) {
  if (!data || typeof data !== 'object' || !data.v) throw new Error('not a Biofilm save');
  if (data.v > SAVE_VERSION) throw new Error('save is from a newer version of the game');
  const warnings = [];
  for (const m of data.mods || []) {
    const have = reg.mods.find(x => x.id === m.id);
    if (!have) warnings.push({ type: 'missingMod', id: m.id });
    else if (have.version !== m.version) warnings.push({ type: 'modVersion', id: m.id, saved: m.version, current: have.version });
  }
  if (!reg.missions[data.mission]) throw new Error(`mission "${data.mission}" is not available (missing mod?)`);
  const w = new World(reg, { w: data.w, h: data.h, seed: data.seed, missionId: data.mission, peaceful: data.peaceful });
  w.rng.s = data.rng >>> 0;
  w.tick = data.tick;
  w.terrain.set(unb64(data.terrain, Uint8Array));
  w.resAmt.set(unb64(data.resAmt, Uint16Array));
  w.light.set(unb64(data.light, Uint8Array));
  w.tox.set(unb64(data.tox, Float32Array));
  // resources are stored by index; remap in case mods changed the list
  const res = unb64(data.res, Uint8Array);
  const map = (data.resIds || []).map(id => (id ? reg.resIndex[id] || 0 : 0));
  for (let i = 0; i < res.length; i++) { w.res[i] = map[res[i]] || 0; if (!w.res[i]) w.resAmt[i] = 0; }
  w.techs = data.techs || {};
  for (const id in w.techs) if (!reg.techs[id]) delete w.techs[id];
  w.refreshUnlocks();
  w.research = reg.techs[data.research] ? data.research : null;
  w.inv = data.inv || {};
  for (const k in w.inv) if (!reg.items[k]) delete w.inv[k];
  let dropped = 0;
  for (const e of data.ents || []) {
    const p = reg.entities[e.type];
    if (!p || !reg.kinds[p.kind]) { dropped++; continue; }
    w.attach({ ...e });
  }
  if (dropped) warnings.push({ type: 'droppedEntities', count: dropped });
  w.nextId = data.nextId; w.nextEnemy = data.nextEnemy || 1;
  w.recomputeFilm();
  restoreNets(w, data.nets);
  w.stats = { produced: {}, delivered: {}, built: {}, launched: 0, killed: 0, wavesCleared: 0, ...data.stats };
  w.power.stored = data.power?.stored || 0; w.power.sat = data.power?.sat ?? 1;
  w.enemies = (data.enemies || []).filter(u => reg.enemies[u.type]);
  w.threat = data.threat || null; w.antibiotic = !!data.antibiotic;
  w.objDone = data.objDone || {}; w.won = !!data.won; w.lost = !!data.lost; w.wonTick = data.wonTick || 0;
  w.lastHarvest = data.lastHarvest ?? -99; w.custom = data.custom || {};
  return { world: w, warnings };
}

// Fingerprint of the simulation state, used by tests to prove that runs are repeatable.
export function fingerprint(w) {
  const parts = [w.tick, w.rng.s, JSON.stringify(w.inv), JSON.stringify(w.stats), JSON.stringify(w.techs)];
  parts.push(JSON.stringify(w.list, clean));
  parts.push(JSON.stringify(w.enemies));
  parts.push(JSON.stringify(netState(w)));
  parts.push(hashStr(b64(w.resAmt)), hashStr(b64(w.tox)), w.power.stored.toFixed(6));
  return hashStr(parts.join('|'));
}
