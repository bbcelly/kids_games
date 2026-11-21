'use strict';
// Out-of-game screens: level bar, profile card, lab aquarium, collection, tasks/achievements,
// wardrobe/shop, daily reward and the end-of-life reward summary.
(function () {
  const C = window.CATALOG;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const send = m => window.Net && Net.send(m);
  const TOKEN_KEY = 'primordial-token';

  let prof = null;           // own private profile view
  let dailyShown = false;    // daily popup shown this session
  let currentPanel = null;   // {name, arg}
  let lastReward = null;
  let pendingDeath = false;

  function token() { try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; } }
  function setToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch {} }

  // ---------- tiny animation loop for preview canvases ----------
  const anims = new Set(); // {canvas, draw(ctx, t, w, h, dt)}
  let animRunning = false, lastT = 0;
  function animate(canvas, draw) {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = canvas.clientWidth || +canvas.getAttribute('width'), h = canvas.clientHeight || +canvas.getAttribute('height');
    canvas.width = w * dpr; canvas.height = h * dpr;
    anims.add({ canvas, draw, w, h, dpr });
    if (!animRunning) { animRunning = true; lastT = performance.now(); requestAnimationFrame(loop); }
  }
  function loop(now) {
    const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
    const t = now / 1000;
    for (const a of anims) {
      if (!a.canvas.isConnected) { anims.delete(a); continue; }
      if (!a.canvas.offsetParent) continue; // hidden
      const c = a.canvas.getContext('2d');
      c.setTransform(a.dpr, 0, 0, a.dpr, 0, 0);
      c.clearRect(0, 0, a.w, a.h);
      a.draw(c, t, a.w, a.h, dt);
    }
    if (anims.size) requestAnimationFrame(loop); else animRunning = false;
  }
  function organismPreview(canvas, o) {
    const seed = Math.random();
    animate(canvas, (c, t, w, h) => {
      const r = Math.min(w, h) * (o.stage >= 3 ? 0.36 : 0.3);
      Draw.body(c, { x: w / 2, y: h / 2, r, angle: o.angle != null ? o.angle : -0.3 + Math.sin(t * 0.7) * 0.15, stage: o.stage, traits: o.traits || {}, hue: o.hue, seed, flags: 0, look: o.look }, t);
    });
  }
  const hueOf = look => { const it = C.ITEM[look && look.color]; return it && it.hue != null ? it.hue : 165; };

  // ---------- incoming ----------
  function handle(m) {
    if (m.t === 'profile') {
      if (m.token) setToken(m.token);
      if (!m.p) { $('metabar').classList.add('hidden'); return; }
      prof = m.p;
      renderBar();
      if (currentPanel) openPanel(currentPanel.name, currentPanel.arg, true);
      // don't cover an open panel (e.g. a profile opened from a link); show it when the panel closes
      if (prof.daily.available && !dailyShown && !currentPanel) { dailyShown = true; showDaily(); }
    } else if (m.t === 'reward') {
      lastReward = m.s;
      renderReward();
    } else if (m.t === 'op') {
      onOp(m);
    }
  }

  function onOp(m) {
    if (m.op === 'claimDaily') {
      if (!m.ok) return toast(m.error);
      const item = m.item && C.ITEM[m.item];
      $('dailybody').innerHTML = `<div class="claimed">+${m.dna} DNA${item ? `<br><small>and a new item: <b>${esc(item.name)}</b></small>` : ''}</div>
        <p class="muted">Day ${m.day} of 7 · streak ${m.streak} day${m.streak === 1 ? '' : 's'}</p>
        <button class="play" id="dailyclose">NICE!</button>`;
      $('dailyclose').onclick = () => $('dailypop').classList.add('hidden');
      for (const a of m.achievements || []) toast(`🏆 ${achName(a.id)} unlocked!`);
    } else if (m.op === 'saveSpecimen') {
      if (!m.ok) return toast(m.error);
      toast('Specimen saved to your lab! 🧪');
      const b = $('savespec'); if (b) { b.disabled = true; b.textContent = 'SAVED TO LAB ✓'; }
    } else if (m.op === 'restore') {
      toast(m.ok ? 'Profile loaded! Welcome back.' : m.error);
    } else if (!m.ok && m.error) toast(m.error);
    else if (m.op === 'buy') toast('Bought! Equip it in the Wardrobe.');
  }

  let toastT = 0;
  function toast(text) {
    const el = $('metatoast');
    el.textContent = text; el.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600);
  }
  const achName = id => (C.ACHIEVEMENTS.find(a => a.id === id) || {}).name || id;

  // ---------- top bar ----------
  function renderBar() {
    const bar = $('metabar');
    bar.classList.remove('hidden');
    $('mb-level').textContent = prof.level;
    $('mb-xp').style.width = `${Math.min(100, prof.into / prof.need * 100)}%`;
    $('mb-xptext').textContent = `${prof.into} / ${prof.need} XP`;
    $('mb-dna').textContent = prof.dna;
    const tasksOpen = prof.tasks.list.some(t => !t.done);
    $('mb-tasks').classList.toggle('dot', prof.daily.available);
    $('mb-tasks').title = tasksOpen ? 'Daily tasks waiting' : 'All tasks done';
  }

  // ---------- daily reward popup ----------
  function showDaily() {
    const d = prof.daily;
    $('dailybody').innerHTML = `<div class="days">${d.rewards.map((r, i) =>
      `<div class="day ${i < d.nextIndex ? 'past' : ''} ${i === d.nextIndex ? 'today' : ''}"><small>Day ${i + 1}</small><b>${r}</b><span>DNA${i === 6 ? ' + 🎁' : ''}</span></div>`).join('')}</div>
      <p class="muted">${d.nextStreak > 1 ? `🔥 ${d.nextStreak}-day streak! ` : ''}Come back every day for bigger rewards.</p>
      <button class="play" id="dailyclaim">CLAIM ${d.rewards[d.nextIndex]} DNA</button>`;
    $('dailyclaim').onclick = () => send({ t: 'claimDaily' });
    $('dailypop').classList.remove('hidden');
  }

  // ---------- end of life ----------
  function onDeath() { lastReward = null; pendingDeath = true; $('rewardbox').innerHTML = '<div class="muted">Counting your rewards…</div>'; }

  function renderReward() {
    const box = $('rewardbox');
    if (!box || !lastReward) return;
    const s = lastReward;
    if (!pendingDeath) { // life ended by leaving: just a toast
      if (s.counted) toast(`+${s.xp} XP`);
      return;
    }
    pendingDeath = false;
    if (!s.counted) { box.innerHTML = `<div class="muted">${esc(s.reason || 'No XP this time.')}</div>`; return; }
    const lines = [];
    for (const l of s.levelUps) lines.push(`<div class="rw lvl">⬆️ Level ${l.level}! +${l.dna} DNA${l.items.length ? ' · unlocked ' + l.items.map(i => `<b>${esc(C.ITEM[i].name)}</b>`).join(', ') : ''}</div>`);
    for (const t of s.tasksDone) lines.push(`<div class="rw">✅ Task done: ${esc(C.TASKS.find(x => x.id === t.id).text)} · +${t.dna} DNA</div>`);
    for (const a of s.achievements) lines.push(`<div class="rw ach">${(C.ACHIEVEMENTS.find(x => x.id === a.id) || {}).icon || '🏆'} ${esc(achName(a.id))} · +${a.dna} DNA${a.items.length ? ' · ' + a.items.map(i => `<b>${esc(C.ITEM[i].name)}</b>`).join(', ') : ''}</div>`);
    if (s.entries.length) lines.push(`<div class="rw">🔬 New in your collection: ${s.entries.map(e => `<b>${esc(C.ENTRIES.find(x => x.id === e).name)}</b>`).join(', ')}</div>`);
    box.innerHTML = `
      <div class="xpline"><b>+${s.xp} XP</b>${s.dna ? ` <span class="dna">+${s.dna} DNA</span>` : ''}</div>
      <div class="bar big"><div id="rw-xp"></div></div>
      <div class="muted small" id="rw-lvl">Level ${prof ? prof.level : ''}</div>
      ${lines.join('')}
      ${s.canSave ? '<button class="ghost wide" id="savespec">🧪 Save this creature to your lab</button>' : ''}
      ${s.labFull ? '<div class="muted small">Your lab is full — release a specimen in the Lab to save new ones.</div>' : ''}`;
    if (prof) requestAnimationFrame(() => { const el = $('rw-xp'); if (el) el.style.width = `${Math.min(100, prof.into / prof.need * 100)}%`; });
    const b = $('savespec');
    if (b) b.onclick = () => send({ t: 'saveSpecimen' });
  }

  // ---------- panels ----------
  function openPanel(name, arg, refresh) {
    currentPanel = { name, arg };
    const body = $('panelbody');
    const scroll = refresh ? body.scrollTop : 0;
    $('panel').classList.remove('hidden');
    const r = PANELS[name](arg);
    $('paneltitle').textContent = r.title;
    if (r.html != null) { body.innerHTML = r.html; if (r.after) r.after(body); }
    body.scrollTop = scroll;
  }
  function closePanel() {
    $('panel').classList.add('hidden');
    currentPanel = null;
    $('panelbody').innerHTML = '';
    if (new URLSearchParams(location.search).has('profile')) {
      try { history.replaceState(null, '', location.pathname); } catch {}
    }
    if (prof && prof.daily.available && !dailyShown) { dailyShown = true; showDaily(); }
  }

  // Profile card HTML (shared by own and public profile). data: publicView-like object.
  function cardHtml(d, own) {
    const bg = (C.ITEM[d.equipped.cardbg] || C.ITEM.cb_default).css;
    const frame = C.ITEM[d.equipped.frame];
    const title = d.equipped.title !== 'ti_none' ? C.ITEM[d.equipped.title].name : '';
    const st = d.stats;
    const show = (d.showcase || []).map(id => C.ACHIEVEMENTS.find(a => a.id === id)).filter(Boolean);
    return `<div class="pcard" style="background:${bg}">
      <div class="pc-top">
        <canvas class="pc-avatar" width="140" height="140"></canvas>
        <div class="pc-id">
          <div class="pc-name" style="${frame && frame.color ? `border-color:${frame.color}` : ''}">${esc(d.name || 'Nameless cell')}</div>
          ${title ? `<div class="pc-title">${esc(title)}</div>` : ''}
          <div class="pc-level">Level <b>${d.level}</b></div>
          <div class="pc-badges">${show.map(a => `<span class="badge" title="${esc(a.name)}">${a.icon}</span>`).join('') || (own ? '<span class="muted small">Pick badges to show below</span>' : '')}</div>
        </div>
      </div>
      <div class="pc-stats">
        <div><b>${C.STAGE_NAMES[st.bestStage]}</b><small>Best stage</small></div>
        <div><b>${st.bestMass}</b><small>Best mass</small></div>
        <div><b>${st.kills}</b><small>Eaten</small></div>
        <div><b>${st.games}</b><small>Games</small></div>
        <div><b>${st.apexReached}</b><small>Apex reached</small></div>
        <div><b>${st.maxStreak}</b><small>Best streak</small></div>
        <div><b>${d.achievements.length}/${C.ACHIEVEMENTS.length}</b><small>Badges</small></div>
        <div><b>${d.entries}/${C.ENTRIES.length}</b><small>Collection</small></div>
      </div>
    </div>`;
  }
  function ownPublic() {
    const L = prof.life;
    return {
      publicId: prof.publicId, name: prof.name, level: prof.level, equipped: prof.equipped, lab: prof.lab,
      stats: { games: L.games, kills: L.kills, bestMass: L.bestMass, bestStage: L.bestStage, apexReached: L.apexReached, maxStreak: prof.daily.maxStreak },
      achievements: Object.keys(prof.achievements), showcase: prof.showcase, entries: Object.keys(prof.entries).length,
    };
  }
  function mountCard(root, d) {
    const cv = root.querySelector('.pc-avatar');
    if (cv) organismPreview(cv, { stage: d.stats.bestStage, look: d.equipped, hue: hueOf(d.equipped), traits: {} });
  }
  const profileLink = id => `${location.origin}${location.pathname}?profile=${id}`;

  async function copy(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch {}
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }

  const PANELS = {
    profile() {
      if (!prof) return { title: 'Profile', html: '<p class="muted">Loading…</p>' };
      const d = ownPublic();
      const earned = C.ACHIEVEMENTS.filter(a => prof.achievements[a.id]);
      return {
        title: 'Your profile',
        html: `${cardHtml(d, true)}
          <div class="row"><button class="ghost" id="pf-share">🔗 Copy profile link</button><button class="ghost" id="pf-look">🎨 Change look</button><button class="ghost" id="pf-lab">🧪 Your lab</button></div>
          <h4>Badges on your card <small class="muted">(pick up to 3)</small></h4>
          <div class="chips">${earned.map(a => `<button class="chip ${prof.showcase.includes(a.id) ? 'on' : ''}" data-ach="${a.id}">${a.icon} ${esc(a.name)}</button>`).join('') || '<span class="muted small">Earn achievements to show them off here.</span>'}</div>
          <h4>Play on another device</h4>
          <p class="muted small">Your progress is saved on the server for this browser. To continue on another phone or computer, enter this code there. Keep it secret — anyone with the code can use your profile.</p>
          <div class="row"><button class="ghost" id="pf-code">Show my code</button><span id="pf-codeval" class="code"></span></div>
          <div class="row"><input id="pf-restore" type="text" maxlength="14" placeholder="XXXX-XXXX-XXXX" autocomplete="off"><button class="ghost" id="pf-restorebtn">Load profile</button></div>`,
        after(root) {
          mountCard(root, d);
          $('pf-share').onclick = async () => toast(await copy(profileLink(prof.publicId)) ? 'Profile link copied!' : profileLink(prof.publicId));
          $('pf-look').onclick = () => openPanel('wardrobe', 'color');
          $('pf-lab').onclick = () => openPanel('lab');
          root.querySelectorAll('[data-ach]').forEach(b => b.onclick = () => {
            const id = b.dataset.ach;
            let ids = prof.showcase.includes(id) ? prof.showcase.filter(x => x !== id) : [...prof.showcase, id];
            if (ids.length > 3) ids = ids.slice(-3);
            send({ t: 'showcase', ids });
          });
          $('pf-code').onclick = () => { $('pf-codeval').textContent = prof.transferCode; };
          const inp = $('pf-restore');
          inp.addEventListener('keydown', e => e.stopPropagation());
          $('pf-restorebtn').onclick = () => {
            if (!inp.value.trim()) return;
            if (confirm('Load the profile with this code? This browser will switch to that profile.')) send({ t: 'restore', code: inp.value });
          };
        },
      };
    },

    publicProfile(pid) {
      return {
        title: 'Player profile',
        html: '<p class="muted">Loading…</p>',
        after(root) {
          fetch(`api/profile/${encodeURIComponent(pid)}`).then(r => (r.ok ? r.json() : null)).then(d => {
            if (!currentPanel || currentPanel.arg !== pid) return;
            if (!d) { root.innerHTML = '<p class="muted">This profile does not exist.</p>'; return; }
            root.innerHTML = `${cardHtml(d, false)}
              <h4>${esc(d.name || 'Their')}'s lab</h4><canvas class="tank" id="pp-tank"></canvas>
              <div class="row"><button class="ghost" id="pp-share">🔗 Copy link</button></div>`;
            mountCard(root, d);
            mountTank($('pp-tank'), d.lab);
            $('pp-share').onclick = async () => toast(await copy(profileLink(d.publicId)) ? 'Link copied!' : profileLink(d.publicId));
          }).catch(() => { root.innerHTML = '<p class="muted">Could not load the profile.</p>'; });
        },
      };
    },

    lab() {
      if (!prof) return { title: 'Lab', html: '<p class="muted">Loading…</p>' };
      const lab = prof.lab;
      const slotNames = { bg: 'Background', floor: 'Floor', plantL: 'Left plant', plantR: 'Right plant', center: 'Centrepiece', light: 'Light', bubbler: 'Bubbler' };
      const owned = new Set(prof.owned);
      const decor = slot => C.ITEMS.filter(i => i.type === 'decor' && (i.slot === slot || (i.slot === 'plant' && (slot === 'plantL' || slot === 'plantR'))) && (i.source === 'default' || owned.has(i.id)));
      return {
        title: 'Your lab',
        html: `<canvas class="tank" id="lab-tank"></canvas>
          <h4>Specimens <small class="muted">${lab.specimens.length} / ${lab.capacity} — more places at higher levels</small></h4>
          <div class="specs">${lab.specimens.map(s => `<div class="spec"><canvas width="70" height="70" data-spec="${s.id}"></canvas>
            <div><b>${esc(s.name || 'Specimen')}</b><small>${C.STAGE_NAMES[s.stage]} · mass ${s.mass} · ate ${s.kills}</small><small>${new Date(s.date).toLocaleDateString()}</small></div>
            <button class="ghost small" data-release="${s.id}">Release</button></div>`).join('') || '<p class="muted small">Reach the Colony stage, then save your creature from the end-of-game screen.</p>'}</div>
          <h4>Decorate <small class="muted">— buy more in the Wardrobe</small></h4>
          ${C.LAB_SLOTS.map(slot => `<div class="slotrow"><span>${slotNames[slot]}</span><div class="chips">${decor(slot).map(i => `<button class="chip ${lab.slots[slot] === i.id ? 'on' : ''}" data-slot="${slot}" data-id="${i.id}">${esc(i.name)}</button>`).join('')}</div></div>`).join('')}
          <div class="row"><button class="ghost" id="lab-shop">🛒 Shop decorations</button></div>`,
        after(root) {
          mountTank($('lab-tank'), lab);
          root.querySelectorAll('[data-spec]').forEach(cv => {
            const s = lab.specimens.find(x => x.id === cv.dataset.spec);
            organismPreview(cv, { stage: s.stage, traits: s.traits, hue: s.hue, look: s.look });
          });
          root.querySelectorAll('[data-release]').forEach(b => b.onclick = () => {
            if (confirm('Release this specimen back into the wild? It will be gone from your lab.')) send({ t: 'release', id: b.dataset.release });
          });
          root.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => send({ t: 'equip', slot: b.dataset.slot, id: b.dataset.id }));
          $('lab-shop').onclick = () => openPanel('wardrobe', 'decor');
        },
      };
    },

    collection() {
      if (!prof) return { title: 'Collection', html: '<p class="muted">Loading…</p>' };
      const groups = [...new Set(C.ENTRIES.map(e => e.group))];
      const n = Object.keys(prof.entries).length;
      return {
        title: `Collection ${n} / ${C.ENTRIES.length}`,
        html: groups.map(g => `<h4>${g}</h4><div class="entries">${C.ENTRIES.filter(e => e.group === g).map(e => {
          const got = prof.entries[e.id];
          return `<div class="entry ${got ? '' : 'locked'}"><canvas width="64" height="64" data-entry="${e.id}"></canvas>
            <div><b>${got ? esc(e.name) : '???'}</b><p>${got ? esc(e.fact) : esc(hint(e))}</p></div></div>`;
        }).join('')}</div>`).join(''),
        after(root) {
          root.querySelectorAll('[data-entry]').forEach(cv => {
            const e = C.ENTRIES.find(x => x.id === cv.dataset.entry);
            if (!prof.entries[e.id]) { const c = cv.getContext('2d'); c.fillStyle = 'rgba(255,255,255,.12)'; c.font = '700 34px sans-serif'; c.textAlign = 'center'; c.fillText('?', 32, 44); return; }
            const traits = {}; if (e.trait) traits[e.trait] = e.master ? 3 : 2;
            const stage = e.stage != null ? e.stage : e.trait ? 1 : e.id === 'e_ate_apex' ? 5 : 2;
            organismPreview(cv, { stage, traits, hue: (e.id.length * 47) % 360, look: e.id === 'e_poisoned' ? { color: 'c_lime' } : null });
          });
        },
      };
    },

    tasks() {
      if (!prof) return { title: 'Tasks', html: '<p class="muted">Loading…</p>' };
      const d = prof.daily;
      return {
        title: 'Daily & achievements',
        html: `<h4>Daily reward ${d.streak ? `<small class="muted">🔥 streak ${d.streak}</small>` : ''}</h4>
          <div class="days">${d.rewards.map((r, i) => {
            const cur = d.available ? d.nextIndex : (d.streak - 1) % 7;
            const done = d.available ? i < cur : i <= cur;
            return `<div class="day ${done ? 'past' : ''} ${i === cur && d.available ? 'today' : ''}"><small>Day ${i + 1}</small><b>${r}</b><span>DNA${i === 6 ? ' + 🎁' : ''}</span></div>`;
          }).join('')}</div>
          ${d.available ? '<button class="play" id="tk-claim">CLAIM TODAY\'S REWARD</button>' : '<p class="muted small">Today\'s reward is claimed. Come back tomorrow!</p>'}
          <h4>Today's tasks <small class="muted">— new ones every day</small></h4>
          ${prof.tasks.list.map((t, i) => {
            const def = C.TASKS.find(x => x.id === t.id);
            return `<div class="task ${t.done ? 'done' : ''}"><div><b>${esc(def.text)}</b><small>${t.done ? 'Done!' : `${Math.floor(t.progress)} / ${def.goal}`} · ${def.dna} DNA + XP</small>
              <div class="bar"><div style="width:${Math.min(100, t.progress / def.goal * 100)}%"></div></div></div>
              ${!t.done && !prof.tasks.rerolled ? `<button class="ghost small" data-reroll="${i}">Swap</button>` : ''}</div>`;
          }).join('')}
          <h4>Achievements <small class="muted">${Object.keys(prof.achievements).length} / ${C.ACHIEVEMENTS.length}</small></h4>
          ${C.ACHIEVEMENTS.map(a => {
            const got = prof.achievements[a.id];
            const v = Math.min(a.goal, statValue(a.stat));
            return `<div class="ach ${got ? 'got' : ''}"><span class="aicon">${a.icon}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)} · ${a.dna} DNA${a.item ? ' + ' + esc(C.ITEM[a.item].name) : ''}</small>
              ${got ? '' : `<div class="bar"><div style="width:${v / a.goal * 100}%"></div></div>`}</div><span class="small">${got ? '✅' : `${Math.floor(v)}/${a.goal}`}</span></div>`;
          }).join('')}`,
        after() {
          const cl = $('tk-claim'); if (cl) cl.onclick = () => { showDaily(); };
          document.querySelectorAll('[data-reroll]').forEach(b => b.onclick = () => send({ t: 'reroll', i: +b.dataset.reroll }));
        },
      };
    },

    wardrobe(tab = 'color') {
      if (!prof) return { title: 'Wardrobe', html: '<p class="muted">Loading…</p>' };
      const tabs = { color: 'Colour', pattern: 'Pattern', trail: 'Trail', frame: 'Name frame', title: 'Title', cardbg: 'Card', decor: 'Lab décor' };
      const owned = new Set(prof.owned);
      const items = C.ITEMS.filter(i => i.type === tab);
      const lockText = i => {
        if (i.source === 'level') { const lv = Object.keys(C.LEVEL_REWARDS).find(l => C.LEVEL_REWARDS[l].includes(i.id)); return `🔒 Level ${lv}`; }
        if (i.source === 'achievement') { const a = C.ACHIEVEMENTS.find(x => x.item === i.id); return `🏆 ${a ? a.name : 'Achievement'}`; }
        return '🔒';
      };
      const card = i => {
        const has = i.source === 'default' || owned.has(i.id);
        const equipped = tab === 'decor' ? Object.values(prof.lab.slots).includes(i.id) : prof.equipped[tab] === i.id;
        let action;
        if (equipped) action = '<span class="eq">✓ Equipped</span>';
        else if (has) action = tab === 'decor' ? '<span class="muted small">Place it in your Lab</span>' : `<button class="ghost small" data-equip="${i.id}">Equip</button>`;
        else if (i.price != null) action = `<button class="ghost small buy" data-buy="${i.id}" ${prof.dna < i.price ? 'disabled' : ''}>🧬 ${i.price}</button>`;
        else action = `<span class="muted small">${esc(lockText(i))}</span>`;
        return `<div class="item ${has ? '' : 'notowned'} ${i.rarity || ''}"><div class="prev" data-prev="${i.id}"></div><b>${esc(i.name)}</b>${i.rarity ? `<small class="rar">${i.rarity}</small>` : ''}${action}</div>`;
      };
      return {
        title: `Wardrobe · 🧬 ${prof.dna} DNA`,
        html: `<div class="tabs">${Object.entries(tabs).map(([k, v]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${v}</button>`).join('')}</div>
          <div class="items">${items.map(card).join('')}</div>`,
        after(root) {
          root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => openPanel('wardrobe', b.dataset.tab));
          root.querySelectorAll('[data-equip]').forEach(b => b.onclick = () => send({ t: 'equip', slot: tab, id: b.dataset.equip }));
          root.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
            const it = C.ITEM[b.dataset.buy];
            if (confirm(`Buy ${it.name} for ${it.price} DNA?`)) send({ t: 'buy', id: it.id });
          });
          root.querySelectorAll('[data-prev]').forEach(el => itemPreview(el, C.ITEM[el.dataset.prev]));
        },
      };
    },
  };

  function hint(e) {
    if (e.stage != null) return `Reach the ${e.name} stage to discover this.`;
    if (e.master) return `Evolve ${C.TRAIT_NAMES[e.trait]} to level 3.`;
    if (e.trait) return `Evolve ${C.TRAIT_NAMES[e.trait]}.`;
    return { e_ate_player: 'Eat another player.', e_ate_apex: 'Eat an Apex Leviathan.', e_poisoned: 'Eat something with toxin spikes.' }[e.id] || 'Keep playing!';
  }
  function statValue(stat) {
    if (stat === 'maxStreak') return prof.daily.maxStreak;
    if (stat === 'entries') return Object.keys(prof.entries).length;
    if (stat === 'traitsMastered') return Object.keys(prof.life.mastered).length;
    return prof.life[stat] || 0;
  }

  function itemPreview(el, it) {
    const stage = Math.max(1, Math.min(4, prof.life.bestStage || 1));
    const look = { ...prof.equipped };
    if (it.type === 'color' || it.type === 'pattern') {
      look[it.type] = it.id;
      el.innerHTML = '<canvas width="84" height="84"></canvas>';
      organismPreview(el.firstChild, { stage, look, hue: hueOf(look) });
    } else if (it.type === 'trail') {
      el.innerHTML = '<canvas width="84" height="84"></canvas>';
      const tr = new Draw.Trails(80), o = { x: 0, y: 0, r: 12, angle: 0, hue: hueOf(look) };
      animate(el.firstChild, (c, t, w, h, dt) => {
        const a = t * 1.6;
        o.x = w / 2 + Math.cos(a) * w * 0.28; o.y = h / 2 + Math.sin(a) * h * 0.28; o.angle = a + Math.PI / 2;
        tr.emit(o, it.id, dt, t); tr.update(dt); tr.draw(c, t);
        Draw.body(c, { ...o, stage: 0, traits: {}, seed: 0.3, look }, t);
      });
    } else if (it.type === 'frame') {
      el.innerHTML = `<span class="framep" style="${it.color ? `border-color:${it.color}` : 'border-color:transparent'}">${esc(prof.name || 'You')}</span>`;
    } else if (it.type === 'title') {
      el.innerHTML = `<span class="titlep">${it.id === 'ti_none' ? '—' : esc(it.name)}</span>`;
    } else if (it.type === 'cardbg') {
      el.innerHTML = `<span class="swatch" style="background:${it.css}"></span>`;
    } else if (it.type === 'decor') {
      el.innerHTML = '<canvas width="84" height="84"></canvas>';
      const slots = { ...C.DEFAULTS, bg: 'bg_default' };
      if (it.slot === 'plant') slots.plantL = it.id; else slots[it.slot] = it.id;
      const st = { specs: [] };
      animate(el.firstChild, (c, t, w, h) => drawTank(c, t, w, h, { slots, specimens: [] }, st, 0.35));
    }
  }

  // ---------- aquarium ----------
  function mountTank(canvas, lab) {
    const st = { specs: lab.specimens.map((s, i) => ({ s, x: 0.2 + 0.6 * Math.random(), y: 0.25 + 0.4 * Math.random(), a: Math.random() * 6, seed: (i * 0.37) % 1, turn: 0 })) };
    animate(canvas, (c, t, w, h, dt) => drawTank(c, t, w, h, lab, st, 1, dt));
  }

  function drawTank(c, t, w, h, lab, st, scale = 1, dt = 0.016) {
    const sl = lab.slots || C.DEFAULTS, floorY = h * 0.84;
    // background
    const bgs = {
      bg_default: ['#0f5468', '#062431'], bg_kelp: ['#1f6b50', '#06261c'], bg_abyss: ['#071630', '#01040b'],
      bg_lagoon: ['#3ad1d6', '#0b6f8c'], bg_vent: ['#2b1a1a', '#090404'],
    };
    const [c1, c2] = bgs[sl.bg] || bgs.bg_default;
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, c1); g.addColorStop(1, c2);
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (sl.bg === 'bg_lagoon' || sl.bg === 'bg_default') { // light rays
      c.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < 4; i++) {
        const x = w * (0.15 + i * 0.25) + Math.sin(t * 0.3 + i) * w * 0.03;
        c.beginPath(); c.moveTo(x - w * 0.04, 0); c.lineTo(x + w * 0.04, 0); c.lineTo(x + w * 0.12, floorY); c.lineTo(x - w * 0.02, floorY); c.fill();
      }
    }
    if (sl.bg === 'bg_kelp') {
      c.strokeStyle = 'rgba(10,40,25,0.6)'; c.lineWidth = w * 0.02;
      for (let i = 0; i < 7; i++) { const x = w * (0.05 + i * 0.15); c.beginPath(); c.moveTo(x, floorY); c.quadraticCurveTo(x + Math.sin(t + i) * w * 0.04, h * 0.4, x + Math.sin(t * 0.8 + i) * w * 0.02, 0); c.stroke(); }
    }
    if (sl.bg === 'bg_abyss') {
      for (let i = 0; i < 30; i++) { c.fillStyle = `rgba(140,220,255,${0.2 + 0.3 * Math.sin(t * 2 + i)})`; c.fillRect((i * 97) % w, (i * 53) % floorY, 2, 2); }
    }
    if (sl.bg === 'bg_vent') {
      const vg = c.createRadialGradient(w * 0.5, floorY, 0, w * 0.5, floorY, w * 0.5);
      vg.addColorStop(0, 'rgba(255,120,40,0.45)'); vg.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = vg; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { const k = ((t * 0.3 + i / 8) % 1); c.fillStyle = `rgba(80,70,70,${0.4 * (1 - k)})`; c.beginPath(); c.arc(w * 0.82 + Math.sin(i + t) * 6, floorY - k * h * 0.8, 6 + k * 20, 0, Math.PI * 2); c.fill(); }
    }
    // floor
    const floors = { fl_sand: '#c9b27a', fl_pebbles: '#b9a77c', fl_coral: '#d98a8a', fl_crystal: '#5b4a9a' };
    c.fillStyle = floors[sl.floor] || floors.fl_sand;
    c.beginPath(); c.moveTo(0, h);
    for (let x = 0; x <= w; x += w / 20) c.lineTo(x, floorY + Math.sin(x * 0.05) * 4);
    c.lineTo(w, h); c.fill();
    if (sl.floor === 'fl_pebbles') for (let i = 0; i < 16; i++) { c.fillStyle = ['#8d8d8d', '#a77d5a', '#6f7f8a', '#c2c2b0'][i % 4]; c.beginPath(); c.ellipse((i * 61) % w, floorY + 8 + (i % 3) * 6, 7, 4, 0, 0, Math.PI * 2); c.fill(); }
    if (sl.floor === 'fl_coral') for (let i = 0; i < 12; i++) { c.fillStyle = 'rgba(255,170,170,0.8)'; c.beginPath(); c.arc((i * 83) % w, floorY + 4, 5 + (i % 3) * 2, Math.PI, 0); c.fill(); }
    if (sl.floor === 'fl_crystal') for (let i = 0; i < 9; i++) { const x = (i * 113) % w; c.fillStyle = `rgba(200,170,255,${0.6 + 0.3 * Math.sin(t + i)})`; c.beginPath(); c.moveTo(x - 6, floorY + 6); c.lineTo(x, floorY - 14 - (i % 3) * 6); c.lineTo(x + 6, floorY + 6); c.fill(); }
    // plants
    plant(c, sl.plantL, w * 0.12, floorY, h, t, 0);
    plant(c, sl.plantR, w * 0.88, floorY, h, t, 2);
    centerpiece(c, sl.center, w * 0.5, floorY, h, t);
    // bubbler
    if (sl.bubbler !== 'bu_none') {
      for (let i = 0; i < 10; i++) {
        const k = (t * 0.35 + i / 10) % 1, x = w * 0.68 + Math.sin(k * 12 + i) * 5;
        c.strokeStyle = sl.bubbler === 'bu_rainbow' ? `hsla(${i * 36},90%,70%,${1 - k})` : `rgba(220,250,255,${1 - k})`;
        c.lineWidth = 1.5; c.beginPath(); c.arc(x, floorY - k * floorY, 3 + i % 3, 0, Math.PI * 2); c.stroke();
      }
    }
    // specimens
    for (const p of st.specs) {
      p.turn += (Math.random() - 0.5) * dt * 2; p.turn *= 0.98;
      p.a += p.turn * dt * 2;
      p.x += Math.cos(p.a) * dt * 0.05; p.y += Math.sin(p.a) * dt * 0.03;
      if (p.x < 0.1 || p.x > 0.9) p.a = Math.PI - p.a;
      if (p.y < 0.1 || p.y > 0.72) p.a = -p.a;
      p.x = Math.max(0.1, Math.min(0.9, p.x)); p.y = Math.max(0.1, Math.min(0.72, p.y));
      const r = Math.min(w, h) * (0.05 + p.s.stage * 0.012) * scale;
      Draw.body(c, { x: p.x * w, y: p.y * h, r, angle: p.a, stage: p.s.stage, traits: p.s.traits, hue: p.s.hue, seed: p.seed, flags: 0, look: p.s.look }, t);
      if (scale === 1 && w >= 480) { // names only when there is room
        c.font = '700 11px Trebuchet MS, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,0.75)';
        c.fillText(p.s.name || '', p.x * w, p.y * h + r + 13);
      }
    }
    // lighting overlay
    if (sl.light === 'li_warm') { const lg = c.createRadialGradient(w * 0.5, 0, 0, w * 0.5, 0, h); lg.addColorStop(0, 'rgba(255,200,120,0.28)'); lg.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = lg; c.fillRect(0, 0, w, h); }
    if (sl.light === 'li_cyan') { c.fillStyle = 'rgba(40,255,220,0.08)'; c.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { c.fillStyle = `rgba(120,255,230,${0.3 + 0.3 * Math.sin(t * 1.5 + i)})`; c.beginPath(); c.arc((i * 71) % w, (i * 37 + t * 8) % floorY, 1.8, 0, Math.PI * 2); c.fill(); } }
    if (sl.light === 'li_disco') { for (let i = 0; i < 5; i++) { const a = t * 0.8 + i * 1.26; c.fillStyle = `hsla(${i * 72 + t * 40},90%,60%,0.10)`; c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2 + Math.cos(a) * w, h); c.lineTo(w / 2 + Math.cos(a + 0.25) * w, h); c.fill(); } }
  }

  function plant(c, id, x, fy, h, t, ph) {
    switch (id) {
      case 'pl_kelp':
        c.strokeStyle = '#3f9b4f'; c.lineWidth = 6; c.lineCap = 'round';
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x + i * 10, fy); c.bezierCurveTo(x + i * 10 + Math.sin(t + ph + i) * 18, fy - h * 0.3, x + i * 6 - Math.sin(t * 0.8 + ph) * 14, fy - h * 0.5, x + i * 8 + Math.sin(t * 1.2 + i) * 10, fy - h * (0.62 + i * 0.05)); c.stroke(); }
        break;
      case 'pl_seagrass':
        c.strokeStyle = '#6fcf6a'; c.lineWidth = 2.5;
        for (let i = 0; i < 9; i++) { const bx = x + (i - 4) * 5; c.beginPath(); c.moveTo(bx, fy); c.quadraticCurveTo(bx + Math.sin(t * 1.5 + i + ph) * 10, fy - h * 0.15, bx + Math.sin(t + i) * 14, fy - h * (0.2 + (i % 3) * 0.06)); c.stroke(); }
        break;
      case 'pl_anemone':
        c.fillStyle = '#c0436b'; c.beginPath(); c.ellipse(x, fy - 6, 16, 10, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#ff8fb5'; c.lineWidth = 3; c.lineCap = 'round';
        for (let i = 0; i < 11; i++) { const a = -Math.PI + i / 10 * Math.PI; c.beginPath(); c.moveTo(x + Math.cos(a) * 12, fy - 10); c.quadraticCurveTo(x + Math.cos(a) * 22 + Math.sin(t * 2 + i) * 5, fy - 24, x + Math.cos(a) * 26 + Math.sin(t * 2.4 + i) * 7, fy - 38 - Math.sin(a) * 8); c.stroke(); }
        break;
      case 'pl_coralfan': {
        c.strokeStyle = '#ff7d4f'; c.lineCap = 'round';
        const branch = (bx, by, a, len, d) => {
          if (d > 4) return;
          const ex = bx + Math.cos(a) * len, ey = by + Math.sin(a) * len;
          c.lineWidth = 5 - d; c.beginPath(); c.moveTo(bx, by); c.lineTo(ex, ey); c.stroke();
          branch(ex, ey, a - 0.45 + Math.sin(t * 0.8) * 0.03, len * 0.75, d + 1); branch(ex, ey, a + 0.45, len * 0.75, d + 1);
        };
        branch(x, fy, -Math.PI / 2, h * 0.14, 0);
        break;
      }
      case 'pl_glowshroom':
        for (let i = 0; i < 4; i++) {
          const mx = x + (i - 1.5) * 13, mh = 18 + (i % 2) * 14;
          c.strokeStyle = '#d8e7e0'; c.lineWidth = 3; c.beginPath(); c.moveTo(mx, fy); c.lineTo(mx, fy - mh); c.stroke();
          const gl = 0.6 + 0.4 * Math.sin(t * 2 + i);
          const gg = c.createRadialGradient(mx, fy - mh, 0, mx, fy - mh, 22); gg.addColorStop(0, `rgba(90,255,230,${0.45 * gl})`); gg.addColorStop(1, 'rgba(90,255,230,0)');
          c.fillStyle = gg; c.beginPath(); c.arc(mx, fy - mh, 22, 0, Math.PI * 2); c.fill();
          c.fillStyle = `rgba(120,255,235,${gl})`; c.beginPath(); c.ellipse(mx, fy - mh, 10, 6, 0, Math.PI, 0); c.fill();
        }
        break;
    }
  }

  function centerpiece(c, id, x, fy, h, t) {
    switch (id) {
      case 'ce_rock':
        c.fillStyle = '#6d7680'; c.beginPath(); c.ellipse(x, fy - 8, h * 0.13, h * 0.08, 0, Math.PI, 0); c.fill();
        c.fillStyle = '#87909a'; c.beginPath(); c.ellipse(x - h * 0.03, fy - 16, h * 0.06, h * 0.035, 0, Math.PI, 0); c.fill();
        break;
      case 'ce_chest': {
        const cw = h * 0.16, ch = h * 0.09, open = 0.25 + 0.2 * Math.sin(t * 0.7);
        c.fillStyle = '#7a4a24'; c.fillRect(x - cw / 2, fy - ch, cw, ch);
        c.fillStyle = '#e8b33e'; c.fillRect(x - cw / 2, fy - ch * 0.6, cw, 3);
        const gg = c.createRadialGradient(x, fy - ch, 0, x, fy - ch, cw * 0.6); gg.addColorStop(0, 'rgba(255,220,100,0.6)'); gg.addColorStop(1, 'rgba(255,220,100,0)');
        c.fillStyle = gg; c.beginPath(); c.arc(x, fy - ch, cw * 0.6, 0, Math.PI * 2); c.fill();
        c.save(); c.translate(x - cw / 2, fy - ch); c.rotate(-open); c.fillStyle = '#8d5a2c'; c.fillRect(0, -ch * 0.45, cw, ch * 0.45); c.restore();
        break;
      }
      case 'ce_castle': {
        const s = h * 0.06;
        c.fillStyle = '#d9c18b';
        c.fillRect(x - s * 2, fy - s * 2, s * 4, s * 2);
        for (const dx of [-2, 1.2]) { c.fillRect(x + dx * s, fy - s * 3.6, s * 0.8, s * 3.6); c.beginPath(); c.moveTo(x + dx * s - 2, fy - s * 3.6); c.lineTo(x + dx * s + s * 0.4, fy - s * 4.4); c.lineTo(x + dx * s + s * 0.8 + 2, fy - s * 3.6); c.fill(); }
        c.fillStyle = '#5a4630'; c.beginPath(); c.arc(x, fy, s * 0.7, Math.PI, 0); c.fill();
        break;
      }
      case 'ce_fossil':
        c.strokeStyle = '#d7c6a4'; c.lineWidth = 4; c.beginPath();
        for (let a = 0; a < Math.PI * 5; a += 0.15) { const rr = 2 + a * 3.2; const px = x + Math.cos(a) * rr, py = fy - 26 + Math.sin(a) * rr; if (a === 0) c.moveTo(px, py); else c.lineTo(px, py); }
        c.stroke();
        break;
      case 'ce_microscope': {
        const s = h * 0.05;
        c.fillStyle = '#e8b33e'; c.strokeStyle = '#a77a1c'; c.lineWidth = 2;
        c.fillRect(x - s * 1.6, fy - s * 0.5, s * 3.2, s * 0.5);
        c.fillRect(x + s * 0.4, fy - s * 3.6, s * 0.5, s * 3.2);
        c.save(); c.translate(x, fy - s * 3.2); c.rotate(-0.5); c.fillRect(-s * 0.35, -s * 1.6, s * 0.7, s * 2.6); c.restore();
        c.fillRect(x - s, fy - s * 1.6, s * 1.6, s * 0.3);
        const gl = c.createRadialGradient(x, fy - s * 2, 0, x, fy - s * 2, s * 4); gl.addColorStop(0, `rgba(255,220,120,${0.25 + 0.1 * Math.sin(t * 2)})`); gl.addColorStop(1, 'rgba(255,220,120,0)');
        c.fillStyle = gl; c.beginPath(); c.arc(x, fy - s * 2, s * 4, 0, Math.PI * 2); c.fill();
        break;
      }
    }
  }

  // ---------- wiring ----------
  function init() {
    $('mb-profile').onclick = () => openPanel('profile');
    $('mb-lab').onclick = () => openPanel('lab');
    $('mb-collection').onclick = () => openPanel('collection');
    $('mb-tasks').onclick = () => openPanel('tasks');
    $('mb-wardrobe').onclick = () => openPanel('wardrobe', 'color');
    $('panelclose').onclick = closePanel;
    $('panel').addEventListener('pointerdown', e => { if (e.target.id === 'panel') closePanel(); });
    $('dailypop').addEventListener('pointerdown', e => { if (e.target.id === 'dailypop') $('dailypop').classList.add('hidden'); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && currentPanel) closePanel(); });
    const pp = new URLSearchParams(location.search).get('profile');
    if (pp) openPanel('publicProfile', pp);
  }

  window.Meta = {
    handle, token, onDeath, openPublicProfile: pid => openPanel('publicProfile', pid),
    isOpen: () => !!currentPanel || !$('dailypop').classList.contains('hidden'),
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
