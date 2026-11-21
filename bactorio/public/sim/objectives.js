// Mission objectives. An objective is { id, type, ...params }:
//   deliver  { item, count }    items that arrived in the Core (by pathway, pilus or by hand)
//   produce  { item, count }    items made by machines or absorbers
//   build    { entity, count }  buildings of that type standing right now
//   research { tech }           a finished mutation
//   film     { count }          tiles covered by biofilm
//   power    { count }          ATP supply available per second
//   survive  { count }          immune waves beaten
//   kill     { count }          immune cells destroyed
//   launch   { count }          spores released
//   custom   { check(world) -> [current, target] }   for mods
// threatOnly / peacefulOnly limit an objective to one of the two threat settings.
export const OBJECTIVE_TYPES = {
  deliver: (w, o) => [w.stats.delivered[o.item] || 0, o.count],
  produce: (w, o) => [w.stats.produced[o.item] || 0, o.count],
  build: (w, o) => [w.counts[o.entity] || 0, o.count || 1],
  research: (w, o) => [w.techs[o.tech]?.done ? 1 : 0, 1],
  film: (w, o) => [w.filmTiles, o.count],
  power: (w, o) => [Math.floor(w.power.supply), o.count],
  survive: (w, o) => [w.stats.wavesCleared, o.count],
  kill: (w, o) => [w.stats.killed, o.count],
  launch: (w, o) => [w.stats.launched, o.count],
  custom: (w, o) => o.check(w),
};

export function activeObjectives(w) {
  const m = w.mission();
  return (m?.objectives || []).filter(o => !(o.threatOnly && w.peaceful) && !(o.peacefulOnly && !w.peaceful));
}

export function progress(w, o) {
  const fn = OBJECTIVE_TYPES[o.type];
  if (!fn) return [0, 1];
  const r = fn(w, o);
  return [Math.min(r[0], r[1]), r[1]];
}

export function checkObjectives(w) {
  if (w.won || w.lost) return;
  const objs = activeObjectives(w);
  if (!objs.length) return;
  let all = true;
  for (const o of objs) {
    if (w.objDone[o.id]) continue;
    const [c, t] = progress(w, o);
    if (c >= t) {
      w.objDone[o.id] = w.tick || 1;
      w.effect({ t: 'objective', id: o.id });
      w.reg.emit('objectiveDone', w, o);
    } else all = false;
  }
  if (all) {
    w.won = true; w.wonTick = w.tick;
    w.effect({ t: 'won' });
    w.reg.emit('missionWon', w);
  }
}

// Did the player earn the mission's bonus star?
export function bonusEarned(w) {
  const b = w.mission()?.bonus;
  if (!b || !w.won) return false;
  if (b.type === 'time') return w.wonTick <= b.minutes * 3600;
  if (b.type === 'custom') return !!b.check(w);
  return false;
}
