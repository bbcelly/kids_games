// Texts. Falls back to English, then to the key itself, so a mod with missing texts still works.
let L = {}, FB = {}, lang = 'cs';

export function setLang(reg, code) {
  lang = reg.locales[code] ? code : 'en';
  L = reg.locales[lang] || {}; FB = reg.locales.en || {};
  document.documentElement.lang = lang;
}
export function getLang() { return lang; }

export function t(key, params) {
  let s = L[key] ?? FB[key] ?? key;
  if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (params[k] != null ? params[k] : m));
  return s;
}
export function has(key) { return L[key] != null || FB[key] != null; }

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function recipeName(reg, id) {
  if (has('recipe.' + id)) return t('recipe.' + id);
  const r = reg.recipes[id], out = r && Object.keys(r.out || {})[0];
  return out ? t('item.' + out) : id;
}

export function clock(ticks) {
  const s = Math.floor(ticks / 60), m = Math.floor(s / 60);
  return (m >= 60 ? Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') : m) + ':' + String(s % 60).padStart(2, '0');
}

export function num(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e4) return Math.floor(n / 1000) + 'k';
  return String(Math.floor(n));
}
