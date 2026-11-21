// In-game interface: top bar, tasks, research, build bar, inspector, minimap, toasts.
import { t, esc, recipeName, clock, num } from './i18n.js';
import { iconURL } from '../render/sprites.js';
import { activeObjectives, progress } from '../sim/objectives.js';
import { setRecipe } from '../sim/kinds.js';
import { flush } from '../sim/fluids.js';
import { play } from '../audio/sfx.js';

const GROUPS = ['logistics', 'production', 'colony', 'energy', 'fluids', 'research', 'defense', 'other'];
const $ = (id) => document.getElementById(id);

export function initHud(app) {
  const reg = () => app.reg, W = () => app.world;
  const el = { hud: $('hud'), mname: $('mname'), chips: $('chips'), gauges: $('gauges'), ctl: $('ctl'), obj: $('objectives'), res: $('research'),
    insp: $('inspector'), tabs: $('tabs'), builds: $('builds'), mini: $('minimap'), toasts: $('toasts'), ctip: $('cursorTip'), tip: $('tip'), banner: $('banner') };
  let tab = 'logistics', barKey = '', pickRecipe = false, last = { slow: 0, mini: 0 }, tipSeq = 0;
  const tips = new Map();

  // name tooltips are resolved from the key itself, so re-rendering never piles up closures
  const ic = (kind, id, n, cls = '') => `<span class="ic ${cls}" data-tip="n|${kind}|${id}"><img src="${iconURL(reg(), kind, id, 40)}" alt="">${n != null ? `<b>${n}</b>` : ''}</span>`;
  function tipKey(fn) { const k = 't' + (tipSeq++); tips.set(k, fn); return k; }
  const fixedTips = { atp: () => t('ui.atpTip'), tox: () => t('ui.toxinTip'), nofilter: () => t('ui.noFilter'), pause: () => t('ui.pause') + ' (Space)' };
  function nameOf(kind, id) { return kind === 'recipe' ? recipeName(reg(), id) : t(`${kind}.${id}`); }
  const costHtml = (cost, w) => Object.keys(cost || {}).map(k => ic('item', k, cost[k], (w.inv[k] || 0) < cost[k] ? 'lack' : '')).join('');

  // ---- tooltips (delegated) ------------------------------------------------------------
  document.addEventListener('mouseover', (ev) => {
    const n = ev.target.closest?.('[data-tip]');
    if (!n) { el.tip.classList.add('hidden'); return; }
    const key = n.dataset.tip;
    const fn = key.startsWith('n|') ? () => esc(nameOf(...key.split('|').slice(1))) : fixedTips[key] || tips.get(key);
    if (!fn) return;
    el.tip.innerHTML = fn();
    el.tip.classList.remove('hidden');
    const r = n.getBoundingClientRect(), tw = el.tip.offsetWidth, th = el.tip.offsetHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.top - th - 8;
    if (y < 4) y = r.bottom + 8;
    el.tip.style.left = Math.max(4, Math.min(innerWidth - tw - 4, x)) + 'px';
    el.tip.style.top = y + 'px';
  });

  // ---- controls in the top bar -----------------------------------------------------------
  function buildCtl() {
    el.ctl.innerHTML = `
      <button data-act="pause" data-tip="pause">⏸</button>
      ${[1, 2, 4].map(s => `<button data-act="speed:${s}" class="spd" data-s="${s}">${s}×</button>`).join('')}
      <button data-act="tech" class="wide">${esc(t('ui.techTree'))}</button>
      <button data-act="menu" class="wide">${esc(t('ui.menu'))}</button>`;
  }

  // ---- build bar -------------------------------------------------------------------------
  function buildables() {
    const w = W(), by = {};
    for (const p of reg().sorted('entities')) {
      if (p.buildable === false || p.enemy || !w.unlockedE.has(p.id)) continue;
      (by[GROUPS.includes(p.group) ? p.group : 'other'] ||= []).push(p);
    }
    return by;
  }

  function rebuildBar() {
    const w = W(), by = buildables();
    tips.clear();
    const groups = GROUPS.filter(g => by[g]);
    if (!groups.includes(tab)) tab = groups[0] || 'logistics';
    el.tabs.innerHTML = groups.map(g => `<button data-act="tab:${g}" class="${g === tab ? 'on' : ''}">${esc(t('group.' + g))}</button>`).join('');
    el.builds.innerHTML = (by[tab] || []).map((p, i) => `
      <button class="bld" data-act="tool:${p.id}" data-id="${p.id}" data-tip="${tipKey(() => `<b>${esc(t('entity.' + p.id))}</b><p>${esc(t('entity.' + p.id + '.desc'))}</p><div class="row">${costHtml(p.cost, W())}</div>${i < 9 ? `<small>${esc(t('ui.hotkey', { k: i + 1 }))}</small>` : ''}`)}">
        <img src="${iconURL(reg(), 'entity', p.id, 48)}" alt="">${i < 9 ? `<i>${i + 1}</i>` : ''}</button>`).join('');
    barKey = [...w.unlockedE].join() + tab;
    markBar();
  }

  function markBar() {
    const w = W();
    for (const b of el.builds.children) {
      const p = reg().entities[b.dataset.id];
      b.classList.toggle('poor', !!p.cost && !w.has(p.cost));
      b.classList.toggle('on', app.tool?.type === p.id);
    }
  }

  // ---- tasks and research ---------------------------------------------------------------
  function objText(o) {
    if (o.text) return t(o.text);
    const name = o.item ? t('item.' + o.item) : o.entity ? t('entity.' + o.entity) : o.tech ? t('tech.' + o.tech) : '';
    return t('obj.' + o.type, { name });
  }

  function drawObjectives() {
    const w = W(), m = w.mission(), objs = activeObjectives(w);
    let hint = '', rows = '';
    for (const o of objs) {
      const done = !!w.objDone[o.id], [c, n] = progress(w, o);
      if (!done && !hint) hint = t(`mission.${m.id}.hint.${o.id}`);
      rows += `<li class="${done ? 'done' : ''}"><span class="chk">${done ? '✔' : ''}</span><span>${esc(objText(o))}</span><em>${done ? '' : `${num(c)} / ${num(n)}`}</em></li>`;
    }
    const bonus = m.bonus?.type === 'time' && !w.won ? `<div class="bonus ${w.tick > m.bonus.minutes * 3600 ? 'gone' : ''}">★ ${esc(t('ui.bonus', { n: m.bonus.minutes }))}</div>` : '';
    el.obj.innerHTML = `<h3>${esc(t('ui.objectives'))}</h3><ul>${rows}</ul>${bonus}${hint && !w.won ? `<div class="hint"><b>${esc(t('ui.hint'))}:</b> ${esc(hint)}</div>` : ''}`;
  }

  function drawResearch() {
    const w = W(), id = w.research, tech = reg().techs[id];
    if (tech) {
      const st = w.techs[id] || { prog: 0 };
      el.res.innerHTML = `<h3>${esc(t('ui.researching'))}</h3><div class="row"><img class="big" src="${iconURL(reg(), 'tech', id, 40)}" alt=""><div class="grow"><div>${esc(t('tech.' + id))}</div>
        <div class="bar"><i style="width:${Math.round(100 * st.prog / Math.max(1, tech.units))}%"></i></div><small>${st.prog} / ${tech.units} ${tech.packs.map(p => ic('item', p)).join('')}</small></div></div>`;
      el.res.classList.remove('hidden');
    } else if ((w.counts.lab || 0) > 0 && Object.keys(reg().techs).some(k => w.techAvailable(k))) {
      el.res.innerHTML = `<div class="hint nag" data-act="tech">${esc(t('ui.noResearch'))}</div>`;
      el.res.classList.remove('hidden');
    } else el.res.classList.add('hidden');
  }

  function drawTop() {
    const w = W(), P = w.power;
    el.mname.innerHTML = `<b>${esc(t(`mission.${w.missionId}.name`))}</b><span>${clock(w.tick)}</span>`;
    let chips = '';
    let n = 0;
    for (const it of reg().sorted('items')) {
      const c = w.inv[it.id] || 0;
      if (c <= 0) continue;
      if (++n > 14) break;
      chips += ic('item', it.id, num(c));
    }
    el.chips.innerHTML = chips;
    const short = P.demand > P.supply + 0.5 && P.sat < 0.999;
    let g = `<span class="gauge ${short ? 'bad' : ''}" data-tip="atp">⚡ ${Math.round(P.demand)} / ${Math.round(P.supply)}${P.cap ? ` <small>(${num(P.stored)})</small>` : ''}</span>`;
    if (w.threat && !w.peaceful) {
      const tox = Math.round(w.toxTotal || 0), left = Math.max(0, w.threat.next - w.tick);
      g += `<span class="gauge tox" data-tip="tox">☣ ${tox}</span>`;
      g += w.enemies.length ? `<span class="gauge bad">${esc(t('ui.waveNow'))} (${w.enemies.length})</span>` : `<span class="gauge">${esc(t('ui.wave', { t: clock(left) }))}</span>`;
    }
    if (w.stats.launched) g += `<span class="gauge">${esc(t('ui.launched'))}: ${w.stats.launched}</span>`;
    el.gauges.innerHTML = g;
    for (const b of el.ctl.querySelectorAll('.spd')) b.classList.toggle('on', !app.paused && app.speed === +b.dataset.s);
    el.ctl.firstElementChild.classList.toggle('on', app.paused);
    el.banner.textContent = w.antibiotic && !w.bonus.resist ? t('ui.antibiotic') : app.paused ? t('ui.paused') : '';
    el.banner.classList.toggle('hidden', !el.banner.textContent);
  }

  // ---- inspector --------------------------------------------------------------------------
  const mapRow = (label, m, kind = 'item') => { const ks = Object.keys(m || {}).filter(k => m[k] > 0); return `<div class="kv"><span>${esc(label)}</span><div class="row">${ks.length ? ks.map(k => ic(kind, k, num(m[k]))).join('') : `<small>${esc(t('ui.empty'))}</small>`}</div></div>`; };

  function recipeRow(r, cur) {
    const io = (m, f) => Object.keys(m || {}).map(k => ic('item', k, m[k])).join('') + Object.keys(f || {}).map(k => ic('fluid', k, f[k])).join('');
    return `<button class="rec ${cur ? 'on' : ''}" data-act="recipe:${r.id}"><span class="row">${io(r.in, r.fin)}</span><span class="arrow">→</span><span class="row">${io(r.out, r.fout)}</span><small>${esc(recipeName(reg(), r.id))} · ${r.time} s</small></button>`;
  }

  function drawInspector() {
    const w = W(), e = app.sel;
    if (!e || e.gone) { el.insp.classList.add('hidden'); return; }
    const p = e._p, max = w.maxHp(p);
    let h = `<div class="head"><img src="${iconURL(reg(), 'entity', p.id, 48)}" alt=""><div><b>${esc(t('entity.' + p.id))}</b><div class="bar hp"><i style="width:${Math.round(100 * e.hp / max)}%"></i></div></div><button class="x" data-act="close">×</button></div>`;
    h += `<p class="desc">${esc(t('entity.' + p.id + '.desc'))}</p>`;
    if (!p.enemy && !w.film[e.y * w.w + e.x]) h += `<p class="warn">${esc(t('ui.dormant'))}</p>`;
    if (e.dis > w.tick) h += `<p class="warn">${esc(t('ui.infected'))}</p>`;
    const state = (s) => `<p class="state">${esc(t('ui.state.' + s))}</p>`;
    switch (p.kind) {
      case 'core': h += mapRow(t('ui.core.inventory'), w.inv) + `<div class="kv"><span>${esc(t('ui.output'))}</span><span>${p.basePower || 0} ATP${esc(t('ui.perSecond'))}</span></div>`; break;
      case 'crafter': {
        const r = reg().recipes[e.recipe], list = w.recipesFor(e);
        if (pickRecipe || !r) h += `<div class="kv"><span>${esc(t('ui.chooseRecipe'))}</span></div><div class="recs">${list.map(x => recipeRow(x, x.id === e.recipe)).join('')}</div>`;
        else {
          h += `<div class="kv"><span>${esc(t('ui.recipe'))}</span></div>${recipeRow(r, true).replace('data-act="recipe:' + r.id + '"', 'data-act="pick"')}`;
          h += state(e.busy ? (w.power.sat < 0.6 && p.power ? 'noPower' : 'working') : (e._state || 'idle'));
          h += `<div class="bar"><i style="width:${e.busy ? Math.round(100 * e.prog / (r.time * 60)) : 0}%"></i></div>`;
          h += mapRow(t('ui.inputs'), e.inp) + mapRow(t('ui.outputs'), e.out);
        }
        break;
      }
      case 'miner': h += state(e.empty ? 'depleted' : 'working') + mapRow(t('ui.outputs'), e.out); break;
      case 'storage': h += mapRow(`${t('ui.buffer')} ${e.n} / ${p.capacity}`, e.inv); break;
      case 'pilus':
        h += `<div class="kv"><span>${esc(t('ui.holding'))}</span><div class="row">${e.held ? ic('item', e.held) : `<small>${esc(t('ui.empty'))}</small>`}</div></div>`;
        if (p.filter) h += `<div class="kv"><span>${esc(t('ui.filter'))}</span></div><div class="grid"><button class="fil ${!e.filter ? 'on' : ''}" data-act="filter:" data-tip="nofilter">∅</button>${reg().sorted('items').filter(i => w.inv[i.id] != null || w.stats.produced[i.id] || e.filter === i.id).map(i => `<button class="fil ${e.filter === i.id ? 'on' : ''}" data-act="filter:${i.id}">${ic('item', i.id)}</button>`).join('')}</div>`;
        break;
      case 'generator':
        h += `<div class="kv"><span>${esc(t('ui.fuel'))}</span><div class="row">${e.fn > 0 ? ic('item', e.fi, e.fn) : `<small>${esc(t('ui.empty'))}</small>`}</div></div>`;
        h += `<div class="kv"><span>${esc(t('ui.output'))}</span><span>${Math.round((e._load || 0) * p.power)} / ${p.power} ATP${esc(t('ui.perSecond'))}</span></div>`;
        break;
      case 'solar': { const lit = w.light[e.y * w.w + e.x]; h += `<p class="state">${esc(lit ? t('ui.light') : t('ui.dark', { n: Math.round((p.dim ?? 0.15) * 100) }))}</p><div class="kv"><span>${esc(t('ui.output'))}</span><span>${(p.power * (lit ? 1 : p.dim ?? 0.15)).toFixed(1)} ATP${esc(t('ui.perSecond'))}</span></div>`; break; }
      case 'accumulator': h += `<div class="kv"><span>${esc(t('ui.stored'))}</span><span>${num(w.power.stored)} / ${num(w.power.cap)}</span></div>`; break;
      case 'lab': h += state(e.unit > 0 ? 'working' : w.research ? 'input' : 'idle') + mapRow(t('ui.buffer'), e.inv); break;
      case 'turret':
        if (p.ammo) h += `<div class="kv"><span>${esc(t('ui.ammo'))}</span><div class="row">${ic('item', p.ammo, e.ammo)}</div></div>`;
        break;
      case 'pipe': case 'pump': {
        const n = e._net;
        h += `<div class="kv"><span>${esc(t('ui.fluid'))}</span><div class="row">${n && n.fluid ? ic('fluid', n.fluid, `${Math.round(n.amt)} / ${n.cap}`) : `<small>${esc(t('ui.empty'))}</small>`}</div></div>`;
        if (n && n.fluid) h += `<button data-act="flush">${esc(t('ui.flush'))}</button>`;
        break;
      }
      default:
        if (typeof p.inspect === 'function') h += p.inspect(w, e, { ic, t, esc }) || '';
    }
    if (p.kind !== 'core' && !p.enemy) h += `<div class="acts">${p.size[0] === 1 || p.kind === 'miner' || p.kind === 'crafter' ? `<button data-act="rotate">${esc(t('ui.rotate'))} (R)</button>` : ''}<button data-act="dismantle" class="danger">${esc(t('ui.dismantle'))}</button></div>`;
    el.insp.innerHTML = h;
    el.insp.classList.remove('hidden');
  }

  // ---- actions (pointerdown so that periodic re-rendering never swallows a click) ---------
  document.addEventListener('pointerdown', (ev) => {
    const n = ev.target.closest?.('#hud [data-act]');
    if (!n || ev.button !== 0) return;
    const [act, arg] = n.dataset.act.split(':'), w = W(), e = app.sel;
    ev.preventDefault();
    play('click');
    if (act === 'pause') app.togglePause();
    else if (act === 'speed') { app.paused = false; app.setSpeed(+arg); }
    else if (act === 'tech') app.openTech();
    else if (act === 'menu') app.openGameMenu();
    else if (act === 'tab') { tab = arg; rebuildBar(); }
    else if (act === 'tool') app.setTool(app.tool?.type === arg ? null : arg);
    else if (act === 'close') app.select(null);
    else if (act === 'pick') { pickRecipe = true; drawInspector(); }
    else if (e && !e.gone) {
      if (act === 'recipe') { setRecipe(w, e, arg); app.lastRecipe[e.type] = arg; pickRecipe = false; }
      else if (act === 'filter') { e.filter = arg || null; app.lastFilter = e.filter; }
      else if (act === 'flush' && e._net) flush(e._net);
      else if (act === 'rotate') { e.dir = (e.dir + 1) & 3; e._k.rotated?.(w, e, e._p); w.beltsDirty = true; }
      else if (act === 'dismantle') { app.select(null); w.remove(e, { refund: true }); play('remove'); }
      drawInspector();
    }
    drawTop(); markBar();
  });

  // ---- minimap ----------------------------------------------------------------------------
  function drawMini() {
    const w = W(), c = el.mini, g = c.getContext('2d'), r = app.renderer;
    const k = c.width / Math.max(w.w, w.h), ox = (c.width - w.w * k) / 2, oy = (c.height - w.h * k) / 2;
    g.fillStyle = '#081511'; g.fillRect(0, 0, c.width, c.height);
    if (r.terrainMask) g.drawImage(r.terrainMask, ox, oy, w.w * k, w.h * k);
    if (r.filmMask) { g.globalAlpha = 0.3; g.drawImage(r.filmMask, ox, oy, w.w * k, w.h * k); g.globalAlpha = 1; }
    for (let i = 0; i < w.res.length; i += 1) if (w.res[i] && ((i % w.w) + ((i / w.w) | 0)) % 2 === 0) { g.fillStyle = reg().resources[reg().resIds[w.res[i]]]?.color || '#888'; g.fillRect(ox + (i % w.w) * k, oy + ((i / w.w) | 0) * k, Math.max(1, k), Math.max(1, k)); }
    for (const e of w.list) { g.fillStyle = e._p.enemy ? '#d6305c' : e._p.kind === 'core' ? '#ffffff' : e._p.color || '#ccc'; const s = e._p.size[0] * k; g.fillRect(ox + e.x * k, oy + e.y * k, Math.max(1.5, s), Math.max(1.5, s)); }
    g.fillStyle = '#ff4d6d';
    for (const u of w.enemies) g.fillRect(ox + u.x * k - 1, oy + u.y * k - 1, 3, 3);
    const cam = r.cam, vw = r.W / cam.px, vh = r.H / cam.px;
    g.strokeStyle = '#fff3a8'; g.lineWidth = 1; g.strokeRect(ox + (cam.x - vw / 2) * k, oy + (cam.y - vh / 2) * k, vw * k, vh * k);
    c._k = k; c._ox = ox; c._oy = oy;
  }
  const miniGo = (ev) => { const c = el.mini, r = c.getBoundingClientRect(); const cam = app.renderer.cam; cam.x = ((ev.clientX - r.left) * c.width / r.width - c._ox) / c._k; cam.y = ((ev.clientY - r.top) * c.height / r.height - c._oy) / c._k; app.renderer.clamp(); };
  el.mini.addEventListener('mousedown', (ev) => { miniGo(ev); el.mini._drag = true; ev.stopPropagation(); });
  window.addEventListener('mousemove', (ev) => { if (el.mini._drag) miniGo(ev); });
  window.addEventListener('mouseup', () => { el.mini._drag = false; });

  function cursorTip() {
    const w = W(), m = app.mouse;
    let s = '';
    if (m.inside) {
      const x = Math.floor(m.tx), y = Math.floor(m.ty);
      if (app.tool && app.ghostReason) s = t('reason.' + app.ghostReason);
      else if (!app.tool && w.inb(x, y) && !w.occ[y * w.w + x] && w.res[y * w.w + x]) {
        const r = reg().resources[reg().resIds[w.res[y * w.w + x]]];
        if (r?.item) s = app.harvestTile ? t('ui.harvest', { name: t('item.' + r.item) }) : t('ui.deposit', { name: t('item.' + r.item), n: w.resAmt[y * w.w + x] });
      }
    }
    el.ctip.textContent = s;
    el.ctip.classList.toggle('hidden', !s);
    if (s) { el.ctip.style.left = m.x + 18 + 'px'; el.ctip.style.top = m.y + 18 + 'px'; }
  }

  return {
    show() { el.hud.classList.remove('hidden'); buildCtl(); rebuildBar(); pickRecipe = false; this.refresh(); },
    hide() { el.hud.classList.add('hidden'); el.tip.classList.add('hidden'); },
    refresh() { drawTop(); drawObjectives(); drawResearch(); drawInspector(); markBar(); drawMini(); },
    selectionChanged() { pickRecipe = false; drawInspector(); },
    toolChanged() { markBar(); },
    hotkey(i) { const b = el.builds.children[i]; if (b) app.setTool(app.tool?.type === b.dataset.id ? null : b.dataset.id); },
    update(now) {
      cursorTip();
      const w = W();
      if (now - last.slow > 250) {
        last.slow = now;
        if (barKey !== [...w.unlockedE].join() + tab) rebuildBar();
        drawTop(); drawObjectives(); drawResearch(); markBar();
        // do not rebuild lists under the mouse while the player is choosing from them
        if (!(pickRecipe && el.insp.matches(':hover')) && !el.insp.querySelector('.grid:hover')) drawInspector();
      }
      if (now - last.mini > 500) { last.mini = now; drawMini(); }
    },
    toast(msg, kind = '') {
      const d = document.createElement('div');
      d.className = 'toast ' + kind; d.textContent = msg;
      el.toasts.appendChild(d);
      while (el.toasts.children.length > 4) el.toasts.firstChild.remove();
      setTimeout(() => d.classList.add('out'), 3600);
      setTimeout(() => d.remove(), 4200);
    },
  };
}
