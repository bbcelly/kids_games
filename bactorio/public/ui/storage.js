// Browser storage: settings and campaign progress in localStorage, saved games and uploaded
// mods in IndexedDB.
const LS_SETTINGS = 'biofilm.settings', LS_CAMPAIGN = 'biofilm.campaign';

export function loadSettings() {
  const d = { lang: 'cs', sound: true, volume: 0.5, grid: false, mods: {} }; // Czech first; English is in the settings
  try { return { ...d, ...JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}') }; } catch { return d; }
}
export function saveSettings(s) { try { localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); } catch { /* private mode */ } }

export function loadCampaign() { try { return JSON.parse(localStorage.getItem(LS_CAMPAIGN) || '{}'); } catch { return {}; } }
export function saveCampaign(c) { try { localStorage.setItem(LS_CAMPAIGN, JSON.stringify(c)); } catch { /* private mode */ } }

let dbp = null;
function db() {
  return dbp ||= new Promise((res, rej) => {
    const r = indexedDB.open('biofilm', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('saves', { keyPath: 'name' });
      r.result.createObjectStore('mods', { keyPath: 'id' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode), rq = fn(t.objectStore(store));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = () => rej(t.error);
  });
}

export const AUTOSAVE = '\u0000auto';
export const saves = {
  put: (name, meta, data) => tx('saves', 'readwrite', s => s.put({ name, time: Date.now(), ...meta, data })),
  get: (name) => tx('saves', 'readonly', s => s.get(name)),
  del: (name) => tx('saves', 'readwrite', s => s.delete(name)),
  async list() { const all = await tx('saves', 'readonly', s => s.getAll()); return (all || []).map(({ data, ...m }) => m).sort((a, b) => b.time - a.time); },
};
export const modStore = {
  put: (rec) => tx('mods', 'readwrite', s => s.put(rec)),
  del: (id) => tx('mods', 'readwrite', s => s.delete(id)),
  all: async () => (await tx('mods', 'readonly', s => s.getAll())) || [],
};
