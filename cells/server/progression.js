'use strict';
// Pure progression rules. Every function takes the profile object (mutates it) and `now`
// (a Date or ms timestamp) so tests can fake the clock. Nothing here does I/O.
const C = require('../public/catalog');

const TZ = 'Europe/Prague';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
function dayOf(now) { return dayFmt.format(new Date(now)); } // 'YYYY-MM-DD'
function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }

// Lives shorter/smaller than this earn nothing (anti-farming). Mutable for tests.
const CFG = { minLifeSecs: 10, minLifeMass: 15 };
const STAGE_XP = [0, 10, 25, 50, 100, 200];
const MAX_LEVEL = 99;

function newProfileData(now) {
  return {
    v: 1, createdAt: +new Date(now), lastSeen: +new Date(now), name: '',
    xp: 0, level: 1, dna: 0,
    owned: {}, equipped: {},
    lab: { slots: {}, specimens: [] },
    life: {
      games: 0, kills: 0, playerKills: 0, killsBig: 0, killedApex: 0, food: 0, dashes: 0, poisoned: 0,
      secs: 0, longestLife: 0, bestMass: 0, bestStage: 0, colonyReached: 0, predatorReached: 0, apexReached: 0,
      mastered: {}, specimensSaved: 0,
    },
    daily: { lastClaimDay: null, streak: 0, maxStreak: 0, lastForgiveDay: null },
    tasks: { day: null, list: [], rerolled: false },
    achievements: {}, entries: {}, showcase: [],
  };
}

// ---------- ownership / equipment ----------
function owns(p, id) {
  const it = C.ITEM[id];
  return !!it && (it.source === 'default' || !!p.owned[id]);
}
function equippedLook(p) {
  const out = {};
  for (const s of C.LOOK_SLOTS) out[s] = owns(p, p.equipped[s]) ? p.equipped[s] : C.DEFAULTS[s];
  return out;
}
function labSlots(p) {
  const out = {};
  for (const s of C.LAB_SLOTS) out[s] = owns(p, p.lab.slots[s]) ? p.lab.slots[s] : C.DEFAULTS[s];
  return out;
}
function slotAccepts(slot, it) {
  if (!it) return false;
  if (C.LOOK_SLOTS.includes(slot)) return it.type === slot;
  if (it.type !== 'decor') return false;
  if (slot === 'plantL' || slot === 'plantR') return it.slot === 'plant';
  return it.slot === slot;
}
function equip(p, slot, id) {
  const it = C.ITEM[id];
  if (!slotAccepts(slot, it)) return { ok: false, error: 'That item does not go there.' };
  if (!owns(p, id)) return { ok: false, error: 'You do not own that yet.' };
  if (C.LOOK_SLOTS.includes(slot)) p.equipped[slot] = id; else p.lab.slots[slot] = id;
  return { ok: true };
}
function grant(p, id, unlocked) {
  if (!C.ITEM[id] || owns(p, id)) return false;
  p.owned[id] = true;
  if (unlocked) unlocked.push(id);
  return true;
}
function buy(p, id) {
  const it = C.ITEM[id];
  if (!it || it.price == null) return { ok: false, error: 'That item is not for sale.' };
  if (owns(p, id)) return { ok: false, error: 'You already own it.' };
  if (p.dna < it.price) return { ok: false, error: 'Not enough DNA.' };
  p.dna -= it.price;
  p.owned[id] = true;
  return { ok: true };
}

// ---------- levels ----------
function levelFromXp(xp) {
  let lvl = 1, need = C.xpForLevel(1);
  while (xp >= need && lvl < MAX_LEVEL) { xp -= need; lvl++; need = C.xpForLevel(lvl); }
  return { level: lvl, into: xp, need };
}
function addXp(p, amount, summary) {
  p.xp += Math.max(0, Math.round(amount));
  const target = levelFromXp(p.xp).level;
  while (p.level < target) {
    p.level++;
    const dna = C.levelDna(p.level);
    p.dna += dna;
    summary.dna += dna;
    const items = [];
    for (const id of C.LEVEL_REWARDS[p.level] || []) grant(p, id, items);
    summary.levelUps.push({ level: p.level, dna, items });
  }
}

// ---------- daily login ----------
function dailyStatus(p, now) {
  const today = dayOf(now);
  const d = p.daily;
  const available = d.lastClaimDay !== today;
  let nextStreak = 1;
  if (d.lastClaimDay) {
    const gap = daysBetween(d.lastClaimDay, today);
    if (gap === 0) nextStreak = d.streak;
    else if (gap === 1) nextStreak = d.streak + 1;
    else if (gap === 2 && canForgive(d, today)) nextStreak = d.streak + 1;
  }
  return { available, today, streak: d.streak, maxStreak: d.maxStreak, nextStreak, nextIndex: (nextStreak - 1) % 7, rewards: C.DAILY_REWARDS };
}
function canForgive(d, today) { return !d.lastForgiveDay || daysBetween(d.lastForgiveDay, today) >= 7; }

function claimDaily(p, now, rand = Math.random) {
  const st = dailyStatus(p, now);
  if (!st.available) return { ok: false, error: 'Already claimed today — come back tomorrow!' };
  const d = p.daily;
  if (d.lastClaimDay && daysBetween(d.lastClaimDay, st.today) === 2 && st.nextStreak > 1) d.lastForgiveDay = st.today;
  d.streak = st.nextStreak;
  d.maxStreak = Math.max(d.maxStreak, d.streak);
  d.lastClaimDay = st.today;
  const idx = (d.streak - 1) % 7;
  let dna = C.DAILY_REWARDS[idx];
  let item = null;
  if (idx === 6) {
    const pool = C.ITEMS.filter(i => i.daily && !owns(p, i.id));
    if (pool.length) { item = pool[Math.floor(rand() * pool.length)].id; grant(p, item); }
    else dna += 150;
  }
  p.dna += dna;
  const summary = { dna: 0, achievements: [], items: [] };
  checkAchievements(p, summary);
  return { ok: true, day: idx + 1, streak: d.streak, dna, item, achievements: summary.achievements, achievementDna: summary.dna };
}

// ---------- daily tasks ----------
function ensureTasks(p, now, rand = Math.random) {
  const today = dayOf(now);
  if (p.tasks.day === today && p.tasks.list.length) return false;
  const pool = C.TASKS.map(t => t.id);
  const list = [];
  while (list.length < C.DAILY_TASK_COUNT && pool.length) {
    const i = Math.floor(rand() * pool.length);
    list.push({ id: pool.splice(i, 1)[0], progress: 0, done: false });
  }
  p.tasks = { day: today, list, rerolled: false };
  return true;
}
function rerollTask(p, idx, now, rand = Math.random) {
  ensureTasks(p, now, rand);
  const t = p.tasks.list[idx];
  if (!t) return { ok: false, error: 'No such task.' };
  if (p.tasks.rerolled) return { ok: false, error: 'You can swap one task per day.' };
  if (t.done) return { ok: false, error: 'That task is already done.' };
  const used = new Set(p.tasks.list.map(x => x.id));
  const pool = C.TASKS.filter(x => !used.has(x.id));
  if (!pool.length) return { ok: false, error: 'No other tasks available.' };
  p.tasks.list[idx] = { id: pool[Math.floor(rand() * pool.length)].id, progress: 0, done: false };
  p.tasks.rerolled = true;
  return { ok: true };
}

function sessionValue(s, stat) {
  if (stat.startsWith('trait_')) return s.traits && s.traits[stat.slice(6)] > 0 ? 1 : 0;
  switch (stat) {
    case 'games': return 1;
    case 'stage': return s.maxStage;
    case 'mass': return s.maxMass;
    default: return s[stat] || 0;
  }
}

// ---------- achievements / collection ----------
function statValue(p, stat) {
  switch (stat) {
    case 'maxStreak': return p.daily.maxStreak;
    case 'entries': return Object.keys(p.entries).length;
    case 'traitsMastered': return Object.keys(p.life.mastered).length;
    default: return p.life[stat] || 0;
  }
}
function checkAchievements(p, summary) {
  for (const a of C.ACHIEVEMENTS) {
    if (p.achievements[a.id] || statValue(p, a.stat) < a.goal) continue;
    p.achievements[a.id] = Date.now();
    p.dna += a.dna;
    summary.dna += a.dna;
    const items = [];
    if (a.item) grant(p, a.item, items);
    summary.achievements.push({ id: a.id, dna: a.dna, items });
  }
}
function unlockEntries(p, s, summary) {
  const found = [];
  for (const e of C.ENTRIES) {
    if (p.entries[e.id]) continue;
    let ok = false;
    if (e.stage != null) ok = s.maxStage >= e.stage;
    else if (e.trait) ok = (s.traits[e.trait] || 0) >= (e.master ? 3 : 1);
    else if (e.id === 'e_ate_player') ok = s.playerKills > 0;
    else if (e.id === 'e_ate_apex') ok = s.killedApex > 0;
    else if (e.id === 'e_poisoned') ok = s.poisoned > 0;
    if (ok) { p.entries[e.id] = Date.now(); found.push(e.id); }
  }
  p.dna += found.length * C.ENTRY_DNA;
  summary.dna += found.length * C.ENTRY_DNA;
  summary.entries = found;
}

// ---------- a finished life ----------
function cleanSession(raw) {
  const n = v => (Number.isFinite(+v) && +v > 0 ? +v : 0);
  const traits = {};
  for (const k of C.TRAIT_KEYS) traits[k] = Math.min(3, Math.floor(n(raw.traits && raw.traits[k])));
  return {
    maxMass: n(raw.maxMass), maxStage: Math.min(5, Math.floor(n(raw.maxStage))), secs: n(raw.secs),
    kills: n(raw.kills), playerKills: n(raw.playerKills), killsBig: n(raw.killsBig), killedApex: n(raw.killedApex),
    food: n(raw.food), dashes: n(raw.dashes), poisoned: n(raw.poisoned), traits,
  };
}

function lifeXp(s) {
  return s.maxMass * 0.5 + (s.kills - s.playerKills) * 15 + s.playerKills * 40 + STAGE_XP[s.maxStage] + s.secs / 6;
}

// Returns a summary for the end-of-life screen.
function applySession(p, raw, now, rand = Math.random) {
  const s = cleanSession(raw);
  const summary = { counted: false, xp: 0, dna: 0, levelUps: [], tasksDone: [], achievements: [], entries: [], levelBefore: p.level };
  p.lastSeen = +new Date(now);
  if (s.secs < CFG.minLifeSecs || s.maxMass < CFG.minLifeMass) {
    summary.reason = 'Survive a little longer to earn XP.';
    return summary;
  }
  summary.counted = true;
  const L = p.life;
  L.games++; L.kills += s.kills; L.playerKills += s.playerKills; L.killsBig += s.killsBig;
  L.killedApex += s.killedApex; L.food += s.food; L.dashes += s.dashes; L.poisoned += s.poisoned;
  L.secs += s.secs; L.longestLife = Math.max(L.longestLife, s.secs);
  L.bestMass = Math.max(L.bestMass, Math.round(s.maxMass)); L.bestStage = Math.max(L.bestStage, s.maxStage);
  if (s.maxStage >= 2) L.colonyReached++;
  if (s.maxStage >= 4) L.predatorReached++;
  if (s.maxStage >= 5) L.apexReached++;
  for (const k of C.TRAIT_KEYS) if (s.traits[k] >= 3) L.mastered[k] = true;

  unlockEntries(p, s, summary);

  // daily tasks
  ensureTasks(p, now, rand);
  let taskXp = 0;
  for (const t of p.tasks.list) {
    if (t.done) continue;
    const def = C.TASKS.find(x => x.id === t.id);
    if (!def) continue;
    const v = sessionValue(s, def.stat);
    t.progress = def.mode === 'max' ? Math.max(t.progress, v) : t.progress + v;
    if (t.progress >= def.goal) {
      t.progress = def.goal; t.done = true;
      p.dna += def.dna; summary.dna += def.dna; taskXp += def.dna;
      summary.tasksDone.push({ id: def.id, dna: def.dna });
    }
  }

  checkAchievements(p, summary);

  summary.xp = Math.round(lifeXp(s) + taskXp);
  addXp(p, summary.xp, summary);
  checkAchievements(p, summary);
  summary.stats = s;
  return summary;
}

// ---------- lab ----------
function saveSpecimen(p, life, now) {
  if (!life || life.saved) return { ok: false, error: 'Nothing to save.' };
  if (life.maxStage < 2) return { ok: false, error: 'Only Colony stage or higher can be saved.' };
  if (p.lab.specimens.length >= C.labCapacity(p.level)) return { ok: false, error: 'Your lab is full — release a specimen first.' };
  const sp = {
    id: Math.random().toString(36).slice(2, 10),
    name: String(life.name || '').slice(0, 16), stage: life.maxStage, traits: life.traits, hue: life.hue,
    look: life.look, mass: Math.round(life.maxMass), kills: life.kills, date: +new Date(now),
  };
  p.lab.specimens.push(sp);
  p.life.specimensSaved++;
  life.saved = true;
  const summary = { dna: 0, achievements: [] };
  checkAchievements(p, summary);
  return { ok: true, specimen: sp, achievements: summary.achievements };
}
function releaseSpecimen(p, id) {
  const i = p.lab.specimens.findIndex(s => s.id === id);
  if (i < 0) return { ok: false, error: 'No such specimen.' };
  p.lab.specimens.splice(i, 1);
  return { ok: true };
}
function setShowcase(p, ids) {
  if (!Array.isArray(ids)) return { ok: false, error: 'Bad request.' };
  const clean = [...new Set(ids.map(String))].filter(id => p.achievements[id]).slice(0, 3);
  p.showcase = clean;
  return { ok: true };
}

// ---------- views ----------
function privateView(p, now) {
  const lv = levelFromXp(p.xp);
  return {
    publicId: p.publicId, transferCode: p.transferCode, name: p.name,
    xp: p.xp, level: p.level, into: lv.into, need: lv.need, dna: p.dna,
    owned: Object.keys(p.owned), equipped: equippedLook(p),
    lab: { slots: labSlots(p), specimens: p.lab.specimens, capacity: C.labCapacity(p.level) },
    life: p.life, daily: dailyStatus(p, now), tasks: p.tasks,
    achievements: p.achievements, entries: p.entries, showcase: p.showcase,
  };
}
function publicView(p) {
  const L = p.life;
  return {
    publicId: p.publicId, name: p.name, level: p.level, equipped: equippedLook(p), createdAt: p.createdAt,
    lab: { slots: labSlots(p), specimens: p.lab.specimens, capacity: C.labCapacity(p.level) },
    stats: {
      games: L.games, kills: L.kills, playerKills: L.playerKills, bestMass: L.bestMass, bestStage: L.bestStage,
      apexReached: L.apexReached, maxStreak: p.daily.maxStreak, hours: Math.round(L.secs / 360) / 10,
    },
    achievements: Object.keys(p.achievements), showcase: p.showcase, entries: Object.keys(p.entries).length,
  };
}

module.exports = {
  dayOf, daysBetween, newProfileData, owns, equip, buy, grant, equippedLook, labSlots,
  levelFromXp, addXp, dailyStatus, claimDaily, ensureTasks, rerollTask, applySession, lifeXp,
  saveSpecimen, releaseSpecimen, setShowcase, privateView, publicView, statValue,
  CFG,
};
