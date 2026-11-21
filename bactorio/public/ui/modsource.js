// Where mods come from in the browser:
//   1. the mods/ folder next to the game, listed by the server at api/mods
//   2. mods uploaded in this browser (.zip, a folder, or a single .js), kept in IndexedDB
import { modStore } from './storage.js';
import { checkManifest } from '../engine/modloader.js';

async function importCode(code) {
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
  try { return await import(url); } finally { URL.revokeObjectURL(url); }
}

// Returns { mods: [{manifest, module, source}], listing: [...], errors: [...] }
export async function gatherMods(settings) {
  const mods = [], listing = [], errors = [];
  // on unless the player switched it off; a mod can ask to start switched off ("enabledByDefault": false)
  const enabled = (id, man) => settings.mods?.[id] ?? (man?.enabledByDefault !== false);
  const seen = new Set(['base']);
  let server = [];
  try {
    const r = await fetch('api/mods', { cache: 'no-store' });
    if (r.ok) server = await r.json();
  } catch { /* plain static hosting: no server-side mod folder */ }
  for (const s of server) {
    const man = s.manifest, bad = s.error || checkManifest(man);
    if (bad) { errors.push({ mod: s.dir, stage: 'manifest', message: bad }); continue; }
    if (seen.has(man.id)) { errors.push({ mod: man.id, stage: 'manifest', message: 'duplicate mod id' }); continue; }
    seen.add(man.id);
    const item = { id: man.id, name: man.name, version: man.version, description: man.description || '', source: 'server', enabled: enabled(man.id, man) };
    listing.push(item);
    if (!item.enabled) continue;
    try {
      const module = await import(new URL(`mods/${s.dir}/${man.main || 'main.js'}`, document.baseURI).href);
      mods.push({ manifest: man, module, source: 'server' });
    } catch (err) { errors.push({ mod: man.id, stage: 'load', message: String(err.message || err) }); }
  }
  let local = [];
  try { local = await modStore.all(); } catch { /* IndexedDB unavailable */ }
  for (const rec of local) {
    const man = rec.manifest;
    if (seen.has(man.id)) { errors.push({ mod: man.id, stage: 'manifest', message: 'duplicate mod id (also on the server)' }); continue; }
    seen.add(man.id);
    const item = { id: man.id, name: man.name, version: man.version, description: man.description || '', source: 'local', enabled: enabled(man.id, man) };
    listing.push(item);
    if (!item.enabled) continue;
    try { mods.push({ manifest: man, module: await importCode(rec.code), source: 'local' }); }
    catch (err) { errors.push({ mod: man.id, stage: 'load', message: String(err.message || err) }); }
  }
  return { mods, listing, errors };
}

// ---- adding a mod from files ---------------------------------------------------------------
async function unzip(file) {
  const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = new Map(), dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('damaged zip file');
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nameLen = dv.getUint16(p + 28, true);
    const extra = dv.getUint16(p + 30, true), comment = dv.getUint16(p + 32, true), local = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extra + comment;
    if (name.endsWith('/')) continue;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const raw = buf.subarray(start, start + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()));
    else throw new Error(`unsupported zip compression in ${name}`);
  }
  return out;
}

// files: FileList / array of File. Stores the mod and returns its manifest. Throws with a message.
export async function addModFromFiles(files) {
  files = [...files];
  if (!files.length) throw new Error('no file chosen');
  const dec = new TextDecoder();
  let texts = new Map();   // path -> text
  if (files.length === 1 && /\.zip$/i.test(files[0].name)) {
    for (const [name, data] of await unzip(files[0])) texts.set(name, dec.decode(data));
  } else {
    for (const f of files) if (/\.(js|json)$/i.test(f.name)) texts.set(f.webkitRelativePath || f.name, await f.text());
  }
  const paths = [...texts.keys()].sort((a, b) => a.length - b.length);
  const jsonPath = paths.find(p => /(^|\/)mod\.json$/.test(p));
  let manifest = null, code = null;
  if (jsonPath) {
    try { manifest = JSON.parse(texts.get(jsonPath)); } catch { throw new Error('mod.json is not valid JSON'); }
    const dir = jsonPath.slice(0, jsonPath.length - 'mod.json'.length);
    code = texts.get(dir + (manifest.main || 'main.js'));
    if (code == null) throw new Error(`${manifest.main || 'main.js'} not found next to mod.json`);
  } else {
    const js = paths.filter(p => /\.js$/i.test(p));
    if (js.length !== 1) throw new Error('expected mod.json + main.js, or one .js file that exports "manifest"');
    code = texts.get(js[0]);
  }
  if (/^\s*import\s[^(]/m.test(code) && /from\s+['"]\.{1,2}\//.test(code)) throw new Error('mods added in the browser must be a single main.js (no relative imports); put multi-file mods in the server mods/ folder');
  let module;
  try { module = await importCode(code); } catch (err) { throw new Error('main.js failed to load: ' + (err.message || err)); }
  manifest ||= module.manifest;
  const bad = checkManifest(manifest);
  if (bad) throw new Error(bad);
  if (manifest.id === 'base') throw new Error('"base" is reserved for the game itself');
  const mod = module.default && (module.default.data || module.default.control) ? module.default : module;
  if (typeof mod.data !== 'function' && typeof mod.control !== 'function') throw new Error('main.js must export data(api) and/or control(api)');
  await modStore.put({ id: manifest.id, manifest, code, added: Date.now() });
  return manifest;
}

export const removeLocalMod = (id) => modStore.del(id);
