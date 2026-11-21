// Main menu screens and in-game dialogs.
import { t, esc, clock, setLang } from './i18n.js';
import { loadCampaign, saveCampaign, saveSettings, saves, AUTOSAVE } from './storage.js';
import { addModFromFiles, removeLocalMod } from './modsource.js';
import { configure as configureSound, play } from '../audio/sfx.js';

const $ = (id) => document.getElementById(id);
const SIZES = { small: 96, medium: 128, large: 176 };

export function initMenu(app) {
  const root = $('menu'), modal = $('modal');
  let screen = 'main', notice = '';
  const o = { peaceful: false, seed: Math.floor(Math.random() * 99999) + 1, size: 'medium' };
  const campaign = () => app.reg.sorted('missions').filter(m => m.campaign).sort((a, b) => a.campaign - b.campaign);
  const btn = (act, label, cls = '') => `<button data-m="${act}" class="${cls}">${esc(label)}</button>`;
  const back = () => btn('go:main', '← ' + t('ui.back'), 'ghost');
  const saveName = (n) => (n === AUTOSAVE ? t('ui.autosave') : n);

  const peacefulBox = () => `<label class="check"><input type="checkbox" data-c="peaceful" ${o.peaceful ? 'checked' : ''}> ${esc(t('ui.peaceful'))}</label>`;

  function settingsHtml() {
    const s = app.settings, langs = Object.keys(app.reg.locales);
    return `<div class="form">
      <label>${esc(t('ui.language'))} <select data-c="lang">${langs.map(l => `<option value="${l}" ${l === s.lang ? 'selected' : ''}>${l === 'cs' ? 'Čeština' : l === 'en' ? 'English' : l}</option>`).join('')}</select></label>
      <label class="check"><input type="checkbox" data-c="sound" ${s.sound ? 'checked' : ''}> ${esc(t('ui.sound'))}</label>
      <label>${esc(t('ui.volume'))} <input type="range" min="0" max="1" step="0.05" value="${s.volume}" data-c="volume"></label>
      <label class="check"><input type="checkbox" data-c="grid" ${s.grid ? 'checked' : ''}> ${esc(t('ui.showGrid'))}</label>
    </div>`;
  }

  const helpHtml = () => `<div class="help">${t('ui.help.text').split('\n').map(l => `<p>${esc(l)}</p>`).join('')}</div>`;

  async function screens() {
    const reg = app.reg;
    if (screen === 'main') {
      const list = await saves.list().catch(() => []);
      const errs = reg.errors;
      const extra = reg.mods.filter(m => m.id !== 'base');
      return `<div class="mcard title"><h1>${esc(t('ui.title'))}</h1><p class="sub">${esc(t('ui.subtitle'))}</p>
        <div class="mbtns">
          ${list.length ? btn('load:' + encodeURIComponent(list[0].name), t('ui.continue'), 'primary') : ''}
          ${btn('go:campaign', t('ui.campaign'), list.length ? '' : 'primary')}${btn('go:free', t('ui.freeplay'))}${btn('go:load', t('ui.load'))}
          ${btn('go:mods', t('ui.mods') + (extra.length ? ` (${extra.length})` : ''))}${btn('go:settings', t('ui.settings'))}${btn('go:help', t('ui.help'))}
        </div>
        ${errs.length ? `<p class="warn" data-m="go:mods">${esc(t('ui.mods.errors'))}: ${errs.length}</p>` : ''}
        <small>${esc(t('ui.version', { v: reg.mods[0]?.version || '?' }))}</small></div>`;
    }
    if (screen === 'campaign') {
      const prog = loadCampaign(), ms = campaign();
      const cards = ms.map((m, i) => {
        const p = prog[m.id], open = i === 0 || prog[ms[i - 1].id]?.done || p?.done;
        return `<button class="mis ${open ? '' : 'locked'} ${p?.done ? 'done' : ''}" ${open ? `data-m="mission:${m.id}"` : 'disabled'}>
          <span class="no">${p?.done ? '✔' : m.campaign}</span><span class="grow"><b>${esc(t(`mission.${m.id}.name`))}</b><small>${esc(open ? t(`mission.${m.id}.intro`) : t('ui.locked'))}</small></span>
          <span class="star ${p?.bonus ? 'got' : ''}" title="${esc(m.bonus?.type === 'time' ? t('ui.bonus', { n: m.bonus.minutes }) : '')}">${m.bonus ? '★' : ''}</span></button>`;
      }).join('');
      return `<div class="mcard wide"><h2>${esc(t('ui.campaign'))}</h2><div class="missions">${cards}</div>${peacefulBox()}<div class="mfoot">${back()}</div></div>`;
    }
    if (screen === 'free') {
      return `<div class="mcard"><h2>${esc(t('ui.freeplay'))}</h2><p>${esc(t('mission.free.intro'))}</p><div class="form">
        <label>${esc(t('ui.seed'))} <input type="number" min="1" max="999999" value="${o.seed}" data-c="seed"></label>
        <label>${esc(t('ui.mapSize'))} <select data-c="size">${Object.keys(SIZES).map(k => `<option value="${k}" ${k === o.size ? 'selected' : ''}>${esc(t('ui.size.' + k))} (${SIZES[k]}×${SIZES[k]})</option>`).join('')}</select></label>
        ${peacefulBox()}</div><div class="mfoot">${back()}${btn('mission:free', t('ui.start'), 'primary')}</div></div>`;
    }
    if (screen === 'load') {
      const list = await saves.list().catch(() => []);
      const rows = list.map(s => `<div class="save"><div class="grow"><b>${esc(saveName(s.name))}</b><small>${esc(reg.missions[s.mission] ? t(`mission.${s.mission}.name`) : s.mission)} · ${clock(s.tick || 0)} · ${new Date(s.time).toLocaleString()}</small></div>
        ${btn('load:' + encodeURIComponent(s.name), t('ui.play'), 'primary')}${btn('export:' + encodeURIComponent(s.name), t('ui.export'))}${btn('del:' + encodeURIComponent(s.name), t('ui.delete'), 'danger')}</div>`).join('');
      return `<div class="mcard wide"><h2>${esc(t('ui.load'))}</h2><div class="saves">${rows || `<p>${esc(t('ui.noSaves'))}</p>`}</div>
        <div class="mfoot">${back()}<label class="filebtn">${esc(t('ui.import'))}<input type="file" accept=".json,application/json" data-f="save"></label></div></div>`;
    }
    if (screen === 'settings') return `<div class="mcard"><h2>${esc(t('ui.settings'))}</h2>${settingsHtml()}<div class="mfoot">${back()}${btn('reset', t('ui.resetProgress'), 'danger')}</div></div>`;
    if (screen === 'help') return `<div class="mcard wide"><h2>${esc(t('ui.help'))}</h2>${helpHtml()}<div class="mfoot">${back()}</div></div>`;
    if (screen === 'mods') {
      const info = app.modInfo, loaded = new Map(reg.mods.map(m => [m.id, m]));
      const base = reg.mods[0];
      const row = (m, fixed) => `<div class="save mod ${m.enabled && !loaded.has(m.id) && !fixed ? 'bad' : ''}"><label class="check"><input type="checkbox" data-mod="${esc(m.id)}" ${m.enabled ? 'checked' : ''} ${fixed ? 'disabled' : ''}></label>
        <div class="grow"><b>${esc(m.name)}</b> <small>${esc(m.id)} · ${esc(m.version)} · ${esc(t('ui.mods.source.' + m.source))}</small>${m.description ? `<small>${esc(m.description)}</small>` : ''}</div>
        ${m.source === 'local' ? btn('rmmod:' + m.id, t('ui.mods.remove'), 'danger') : ''}</div>`;
      const errs = reg.errors.map(e => `<li>${esc(t('ui.mods.failed', { id: e.mod, stage: e.stage, msg: e.message }))}</li>`).join('');
      return `<div class="mcard wide"><h2>${esc(t('ui.mods.title'))}</h2><p>${esc(t('ui.mods.intro'))}</p>
        <div class="saves">${row({ ...base, source: 'builtin', enabled: true }, true)}${info.listing.map(m => row(m)).join('') || ''}</div>
        ${info.listing.length ? '' : `<p><small>${esc(t('ui.mods.none'))}</small></p>`}
        ${errs ? `<h4>${esc(t('ui.mods.errors'))}</h4><ul class="errs">${errs}</ul>` : ''}
        ${notice ? `<p class="note">${esc(notice)}</p>` : ''}
        <p class="warn small">${esc(t('ui.mods.warning'))}</p>
        <div class="mfoot">${back()}<label class="filebtn">${esc(t('ui.mods.add'))}<input type="file" accept=".zip,.js" data-f="mod"></label>
        <label class="filebtn">${esc(t('ui.mods.addFolder'))}<input type="file" webkitdirectory data-f="mod"></label>${btn('reload', t('ui.mods.reload'), 'primary')}</div></div>`;
    }
    return '';
  }

  async function render() { root.innerHTML = `<div class="bubbles">${'<i></i>'.repeat(9)}</div>` + await screens(); }

  async function act(a, arg) {
    play('click');
    if (a === 'go') { screen = arg; notice = ''; return render(); }
    if (a === 'mission') return app.startMission(arg, { peaceful: o.peaceful, seed: arg === 'free' ? o.seed : undefined, size: arg === 'free' ? [SIZES[o.size], SIZES[o.size]] : undefined });
    if (a === 'load') return app.loadGame(decodeURIComponent(arg));
    if (a === 'del') { const n = decodeURIComponent(arg); if (confirm(t('ui.confirmDelete', { name: saveName(n) }))) { await saves.del(n); render(); } return; }
    if (a === 'export') {
      const rec = await saves.get(decodeURIComponent(arg));
      if (!rec) return;
      const url = URL.createObjectURL(new Blob([JSON.stringify(rec)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = `biofilm-${saveName(rec.name).replace(/[^\w-]+/g, '_')}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return;
    }
    if (a === 'reset') { if (confirm(t('ui.confirmReset'))) saveCampaign({}); return; }
    if (a === 'rmmod') { await removeLocalMod(arg); app.modInfo.listing = app.modInfo.listing.filter(m => m.id !== arg); notice = ''; return render(); }
    if (a === 'reload') return location.reload();
    // in-game dialogs
    if (a === 'resume') return app.closeModal();
    if (a === 'save') { const n = modal.querySelector('[data-c="savename"]')?.value.trim() || app.saveName || 'Kolonie'; await app.saveGame(n); return app.closeModal(); }
    if (a === 'quit') { if (app.world.won || app.world.lost || confirm(t('ui.confirmQuit'))) app.exitToMenu(); return; }
    if (a === 'dlg') return dialog(arg);
    if (a === 'next') return app.startMission(arg, { peaceful: app.world.peaceful });
    if (a === 'retry') return app.startMission(app.world.missionId, { peaceful: app.world.peaceful, seed: app.world.seed, size: [app.world.w, app.world.h] });
  }

  function change(n) {
    const s = app.settings, c = n.dataset.c;
    if (c === 'peaceful') o.peaceful = n.checked;
    else if (c === 'seed') o.seed = Math.max(1, +n.value || 1);
    else if (c === 'size') o.size = n.value;
    else if (c === 'lang') { s.lang = n.value; setLang(app.reg, s.lang); saveSettings(s); if (app.world) { app.hud.show(); dialog('settings'); } else render(); }
    else if (c === 'sound') { s.sound = n.checked; saveSettings(s); configureSound(s.sound, s.volume); }
    else if (c === 'volume') { s.volume = +n.value; saveSettings(s); configureSound(s.sound, s.volume); play('click'); }
    else if (c === 'grid') { s.grid = n.checked; saveSettings(s); }
    else if (n.dataset.mod) { s.mods = { ...s.mods, [n.dataset.mod]: n.checked }; saveSettings(s); const m = app.modInfo.listing.find(x => x.id === n.dataset.mod); if (m) m.enabled = n.checked; }
  }

  async function file(n) {
    if (!n.files?.length) return;
    if (n.dataset.f === 'mod') {
      try {
        const man = await addModFromFiles(n.files);
        app.modInfo.listing = app.modInfo.listing.filter(m => m.id !== man.id).concat({ id: man.id, name: man.name, version: man.version, description: man.description || '', source: 'local', enabled: true });
        app.settings.mods = { ...app.settings.mods, [man.id]: true }; saveSettings(app.settings);
        notice = t('ui.mods.added', { name: man.name });
      } catch (err) { notice = t('ui.mods.bad', { msg: err.message || err }); }
      return render();
    }
    try {
      const rec = JSON.parse(await n.files[0].text());
      if (!rec?.data?.v) throw new Error('not a Biofilm save');
      const name = rec.name && rec.name !== AUTOSAVE ? rec.name : n.files[0].name.replace(/\.json$/i, '');
      await saves.put(name, { mission: rec.data.mission, tick: rec.data.tick, peaceful: rec.data.peaceful }, rec.data);
    } catch (err) { alert(t('ui.loadFailed', { msg: err.message || err })); }
    render();
  }

  for (const host of [root, modal]) {
    host.addEventListener('click', (ev) => {
      const n = ev.target.closest('[data-m]');
      if (!n || n.disabled) return;
      const i = n.dataset.m.indexOf(':');
      act(i < 0 ? n.dataset.m : n.dataset.m.slice(0, i), i < 0 ? '' : n.dataset.m.slice(i + 1));
    });
    host.addEventListener('change', (ev) => { const n = ev.target; if (n.dataset.f) file(n); else if (n.dataset.c || n.dataset.mod) change(n); });
    host.addEventListener('input', (ev) => { if (ev.target.dataset.c === 'volume') change(ev.target); });
  }

  // ---- in-game dialogs -------------------------------------------------------------------
  function dialog(kind) {
    const w = app.world, ms = campaign();
    let h = '';
    if (kind === 'menu') {
      h = `<h2>${esc(t(`mission.${w.missionId}.name`))}</h2><div class="mbtns">${btn('resume', t('ui.continue'), 'primary')}
        <div class="row"><input type="text" maxlength="40" data-c="savename" value="${esc(app.saveName || t(`mission.${w.missionId}.name`))}" placeholder="${esc(t('ui.saveAs'))}">${btn('save', t('ui.save'))}</div>
        ${btn('dlg:settings', t('ui.settings'))}${btn('dlg:help', t('ui.help'))}${btn('dlg:intro', t('ui.objectives'))}${btn('quit', t('ui.toMenu'), 'danger')}</div>`;
    } else if (kind === 'settings') h = `<h2>${esc(t('ui.settings'))}</h2>${settingsHtml()}<div class="mfoot">${btn('dlg:menu', '← ' + t('ui.back'), 'ghost')}</div>`;
    else if (kind === 'help') h = `<h2>${esc(t('ui.help'))}</h2>${helpHtml()}<div class="mfoot">${btn('resume', t('ui.ok'), 'primary')}</div>`;
    else if (kind === 'intro') {
      const m = w.mission();
      h = `<small>${m.campaign ? esc(t('ui.mission', { n: m.campaign })) : ''}</small><h2>${esc(t(`mission.${m.id}.name`))}</h2><p>${esc(t(`mission.${m.id}.intro`))}</p>
        ${m.bonus?.type === 'time' ? `<p class="bonus">★ ${esc(t('ui.bonus', { n: m.bonus.minutes }))}</p>` : ''}<div class="mfoot">${btn('dlg:help', t('ui.help'), 'ghost')}${btn('resume', t('ui.start'), 'primary')}</div>`;
    } else if (kind === 'won') {
      const m = w.mission(), i = ms.findIndex(x => x.id === m.id), next = ms[i + 1], last = m.campaign && !next;
      const prog = loadCampaign()[m.id];
      h = `<h2>🎉 ${esc(t('ui.missionDone'))}</h2><p>${esc(last ? t('ui.campaignDone') : t('ui.wonText'))}</p><p>${esc(t('ui.time'))}: ${clock(w.wonTick)}${prog?.bonus ? ` · <span class="bonus">★ ${esc(t('ui.bonusGot'))}</span>` : ''}</p>
        <div class="mfoot">${btn('resume', t('ui.keepPlaying'), 'ghost')}${btn('quit', t('ui.toMenu'))}${next ? btn('next:' + next.id, t('ui.nextMission'), 'primary') : ''}</div>`;
    } else if (kind === 'lost') {
      h = `<h2>${esc(t('ui.missionFailed'))}</h2><p>${esc(t('ui.failedText'))}</p><div class="mfoot">${btn('quit', t('ui.toMenu'))}${btn('retry', t('ui.retry'), 'primary')}</div>`;
    }
    modal.onpointerdown = null;
    modal.innerHTML = `<div class="dialog small">${h}</div>`;
    modal.classList.remove('hidden');
    app.modalKind = kind;
  }

  return {
    show(s = 'main') { screen = s; notice = ''; root.classList.remove('hidden'); return render(); },
    hide() { root.classList.add('hidden'); root.innerHTML = ''; },
    dialog,
    recordWin(w, bonus) {
      const m = w.mission();
      if (!m.campaign) return;
      const c = loadCampaign(), old = c[m.id] || {};
      c[m.id] = { done: true, bonus: old.bonus || bonus, time: Math.min(old.time || Infinity, w.wonTick) };
      saveCampaign(c);
    },
  };
}
