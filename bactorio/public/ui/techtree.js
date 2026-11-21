// The mutation tree: columns by tier, lines between prerequisites, details on the right.
import { t, esc, recipeName } from './i18n.js';
import { iconURL } from '../render/sprites.js';

export function openTechTree(app, modal) {
  const reg = app.reg, w = app.world;
  let sel = w.research || Object.keys(reg.techs).find(id => w.techAvailable(id)) || Object.keys(reg.techs)[0];

  const depth = {};
  const tierOf = (id) => {
    const tech = reg.techs[id];
    if (tech.tier != null) return tech.tier;
    if (depth[id] != null) return depth[id];
    depth[id] = 0;
    return (depth[id] = tech.prereq.length ? 1 + Math.max(...tech.prereq.map(p => (reg.techs[p] ? tierOf(p) : 0))) : 0);
  };
  const state = (id) => (w.techs[id]?.done ? 'done' : w.research === id ? 'cur' : !w.techAllowed(id) ? 'off' : w.techAvailable(id) ? 'avail' : 'locked');
  const ic = (kind, id, n) => `<span class="ic" title="${esc(kind === 'recipe' ? recipeName(reg, id) : t(kind + '.' + id))}"><img src="${iconURL(reg, kind, id, 40)}" alt="">${n != null ? `<b>${n}</b>` : ''}</span>`;

  function detail() {
    const tech = reg.techs[sel], st = state(sel), prog = w.techs[sel]?.prog || 0;
    let h = `<div class="head"><img src="${iconURL(reg, 'tech', sel, 56)}" alt=""><div><b>${esc(t('tech.' + sel))}</b><small>${esc(tech.tier ? t('ui.tier', { n: tech.tier }) : t('ui.tier0'))}</small></div></div>`;
    h += `<p>${esc(t('tech.' + sel + '.desc'))}</p>`;
    if (tech.units) h += `<div class="kv"><span>${esc(t('ui.cost'))}</span><div class="row">${tech.packs.map(p => ic('item', p)).join('')} <small>${esc(t('ui.units', { n: tech.units }))} · ${tech.time} s</small></div></div>`;
    const un = [...tech.unlock.entities.map(e => ic('entity', e)), ...tech.unlock.recipes.map(r => ic('recipe', r))];
    if (un.length) h += `<div class="kv"><span>${esc(t('ui.unlocks'))}</span><div class="row">${un.join('')}</div></div>`;
    if (st !== 'done' && tech.units) h += `<div class="bar"><i style="width:${Math.round(100 * prog / tech.units)}%"></i></div><small>${prog} / ${tech.units}</small>`;
    if (st === 'done') h += `<p class="state ok">✔ ${esc(t('ui.researched'))}</p>`;
    else if (st === 'cur') h += `<button data-tt="stop">${esc(t('ui.stopResearch'))}</button>`;
    else if (st === 'avail') h += `<button class="primary" data-tt="go">${esc(t('ui.startResearch'))}</button>`;
    else if (st === 'off') h += `<p class="state">${esc(t('ui.notInMission'))}</p>`;
    else h += `<p class="state">${esc(t('ui.needsPrereq', { list: tech.prereq.filter(p => !w.techs[p]?.done).map(p => t('tech.' + p)).join(', ') }))}</p>`;
    return h;
  }

  function render() {
    const tiers = {};
    for (const tech of reg.sorted('techs')) (tiers[tierOf(tech.id)] ||= []).push(tech);
    const cols = Object.keys(tiers).map(Number).sort((a, b) => a - b).map(n => `
      <div class="tier"><h4>${esc(n ? t('ui.tier', { n }) : t('ui.tier0'))}</h4>
      ${tiers[n].map(tech => `<button class="tech ${state(tech.id)} ${tech.id === sel ? 'sel' : ''}" data-tt="sel:${tech.id}" data-id="${tech.id}"><img src="${iconURL(reg, 'tech', tech.id, 40)}" alt=""><span>${esc(t('tech.' + tech.id))}</span></button>`).join('')}</div>`).join('');
    modal.innerHTML = `<div class="dialog techdlg"><div class="dhead"><h2>${esc(t('ui.research'))}</h2><button class="x" data-tt="close">×</button></div>
      <div class="techbody"><div class="tree"><svg class="links"></svg><div class="tiers">${cols}</div></div><div class="tdetail">${detail()}</div></div></div>`;
    requestAnimationFrame(links);
  }

  function links() {
    const tree = modal.querySelector('.tree'), svg = modal.querySelector('.links');
    if (!tree) return;
    const base = tree.getBoundingClientRect(), pos = {};
    for (const b of tree.querySelectorAll('.tech')) { const r = b.getBoundingClientRect(); pos[b.dataset.id] = { l: r.left - base.left + tree.scrollLeft, r: r.right - base.left + tree.scrollLeft, y: r.top - base.top + tree.scrollTop + r.height / 2 }; }
    svg.setAttribute('width', tree.scrollWidth); svg.setAttribute('height', tree.scrollHeight);
    let d = '';
    for (const tech of Object.values(reg.techs)) for (const p of tech.prereq) {
      const a = pos[p], b = pos[tech.id];
      if (!a || !b) continue;
      const on = tech.id === sel || p === sel, mx = (a.r + b.l) / 2;
      d += `<path d="M${a.r},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.l},${b.y}" class="${on ? 'on' : ''} ${w.techs[p]?.done ? 'done' : ''}"/>`;
    }
    svg.innerHTML = d;
  }

  modal.onpointerdown = (ev) => {
    const n = ev.target.closest('[data-tt]');
    if (!n) { if (ev.target === modal) app.closeModal(); return; }
    const [act, arg] = n.dataset.tt.split(':');
    if (act === 'close') return app.closeModal();
    if (act === 'sel') sel = arg;
    else if (act === 'go') { w.startResearch(sel); app.sfx('click'); }
    else if (act === 'stop') w.startResearch(null);
    const sc = modal.querySelector('.tree'), sx = sc.scrollLeft, sy = sc.scrollTop;
    render();
    const n2 = modal.querySelector('.tree'); n2.scrollLeft = sx; n2.scrollTop = sy;
  };
  render();
  return { refresh() { const d = modal.querySelector('.tdetail'); if (d && !d.matches(':hover')) d.innerHTML = detail(); for (const b of modal.querySelectorAll('.tech')) b.className = `tech ${state(b.dataset.id)} ${b.dataset.id === sel ? 'sel' : ''}`; } };
}
