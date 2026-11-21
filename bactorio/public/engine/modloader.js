// Applies mods to a registry. A mod is { manifest, module, source }:
//   manifest = contents of mod.json  { id, name, version, dependencies?: [ids] }
//   module   = the imported main.js  { data(api), control(api) }  (or a default export with those)
// The base game is the first mod. A mod that throws or leaves the data inconsistent is rolled
// back and reported in registry.errors; the game keeps running without it.
import { makeApi } from './registry.js';

export function sortMods(mods) {
  const byId = new Map(mods.map(m => [m.manifest.id, m]));
  const out = [], state = new Map(), problems = [];
  const visit = (m) => {
    const id = m.manifest.id;
    if (state.get(id) === 2) return true;
    if (state.get(id) === 1) { problems.push({ mod: id, stage: 'dependencies', message: 'dependency cycle' }); return false; }
    state.set(id, 1);
    const deps = [...(m.manifest.dependencies || [])];
    if (id !== 'base' && byId.has('base') && !deps.includes('base')) deps.unshift('base');
    for (const d of deps) {
      const dm = byId.get(d);
      if (!dm) { problems.push({ mod: id, stage: 'dependencies', message: `missing dependency "${d}"` }); state.set(id, 3); return false; }
      if (!visit(dm)) { if (!problems.some(p => p.mod === id)) problems.push({ mod: id, stage: 'dependencies', message: `dependency "${d}" failed` }); state.set(id, 3); return false; }
    }
    state.set(id, 2);
    out.push(m);
    return true;
  };
  for (const m of [...mods].sort((a, b) => (a.manifest.id === 'base' ? -1 : b.manifest.id === 'base' ? 1 : a.manifest.id < b.manifest.id ? -1 : 1))) {
    if (!state.has(m.manifest.id)) visit(m);
  }
  return { order: out, problems };
}

export function checkManifest(man) {
  if (!man || typeof man !== 'object') return 'mod.json is not an object';
  if (!/^[a-z0-9][a-z0-9_-]{1,40}$/.test(man.id || '')) return 'mod.json: "id" must be 2-41 chars of a-z, 0-9, "-" or "_"';
  if (!man.name) return 'mod.json: "name" is required';
  if (!man.version) return 'mod.json: "version" is required';
  if (man.dependencies && !Array.isArray(man.dependencies)) return 'mod.json: "dependencies" must be a list of mod ids';
  return null;
}

export function applyMods(reg, mods) {
  const { order, problems } = sortMods(mods);
  reg.errors.push(...problems);
  for (const m of order) {
    const id = m.manifest.id;
    const snap = reg.snapshot();
    const fail = (stage, message) => { reg.restore(snap); reg.errors.push({ mod: id, stage, message }); };
    const bad = checkManifest(m.manifest);
    if (bad) { fail('manifest', bad); continue; }
    const mod = m.module?.default && (m.module.default.data || m.module.default.control) ? m.module.default : m.module;
    if (!mod || (typeof mod.data !== 'function' && typeof mod.control !== 'function')) { fail('load', 'main.js must export data(api) and/or control(api)'); continue; }
    const api = makeApi(reg, id);
    try {
      if (mod.data) mod.data(api);
      reg.finalize();
      const errs = reg.validate();
      if (errs.length) { fail('data', errs.slice(0, 5).join('; ') + (errs.length > 5 ? ` (+${errs.length - 5} more)` : '')); reg.finalize(); continue; }
      if (mod.control) mod.control(api);
    } catch (err) {
      fail('run', String(err && err.stack ? err.stack.split('\n').slice(0, 2).join(' ') : err));
      reg.finalize();
      continue;
    }
    reg.mods.push({ id, name: m.manifest.name, version: m.manifest.version, source: m.source || 'builtin', description: m.manifest.description || '' });
  }
  reg.finalize();
  return reg;
}
