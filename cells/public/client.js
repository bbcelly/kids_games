'use strict';
(() => {
  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const mini = $('minimap'), mctx = mini.getContext('2d');
  const ui = {
    hud: $('hud'), start: $('startscreen'), death: $('deathscreen'),
    name: $('name'), play: $('play'), again: $('again'), status: $('status'),
    roomlist: $('roomlist'), roomtotal: $('roomtotal'), newroom: $('newroom'), changeroom: $('changeroom'),
    roomname: $('roomname'), invite: $('invite'),
    stagename: $('stagename'), stagesub: $('stagesub'), evobar: $('evobar').firstElementChild,
    dashbar: $('dashbar').firstElementChild, mass: $('mass'), kills: $('kills'), traitlist: $('traitlist'),
    lblist: $('lblist'), online: $('online'), feed: $('feed'), toast: $('toast'),
    choice: $('choice'), opt: [$('opt0'), $('opt1')], dashbtn: $('dashbtn'), ping: $('ping'),
  };

  try { ui.name.value = localStorage.getItem('primordial-name') || ''; } catch {}

  // ---------- state ----------
  let ws = null, connected = false;
  let world = 5000, stages = [], traits = [];
  let myId = null, me = null, playing = false;
  // room we are in (from server), and room we want (from ?room= link or the list)
  let room = null; // {id, name}
  let wantRoom = new URLSearchParams(location.search).get('room') || null;
  let roomsCache = [];
  const meta = new Map();   // id -> {name, hue, bot}
  const ents = new Map();   // id -> render entity
  let food = [];            // flat [x,y,c,...]
  let lb = [], online = 0, bots = 0;
  let lastSnap = 0, pingMs = 0;
  let cam = { x: 2500, y: 2500, scale: 1 };
  let lastStage = 0;

  const FOOD_COLORS = ['#7dffb2', '#ffd36e', '#7fd7ff', '#ff8fc8', '#c39bff', '#ffa36b'];

  // ---------- networking ----------
  function connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    ui.status.textContent = 'Connecting to the soup…';
    ws.onopen = () => {
      connected = true;
      ui.play.disabled = false; ui.play.textContent = 'PLAY';
      ui.status.textContent = '';
      refreshRooms();
      send({ t: 'hello', token: Meta.token() });
    };
    ws.onclose = () => {
      connected = false; playing = false;
      ui.play.disabled = true; ui.play.textContent = 'RECONNECTING…';
      ui.status.textContent = 'Lost connection — retrying…';
      ui.hud.classList.add('hidden'); ui.death.classList.add('hidden'); ui.start.classList.remove('hidden');
      resetWorld(); myId = null; me = null;
      if (room) wantRoom = room.id; // reconnect into the same room
      room = null;
      setTimeout(connect, 1500);
    };
    ws.onmessage = e => handle(JSON.parse(e.data));
  }
  function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }
  window.Net = { send };

  function handle(m) {
    switch (m.t) {
      case 'welcome': world = m.world; stages = m.stages; traits = m.traits; break;
      case 's': onSnapshot(m); break;
      case 'spawned':
        myId = m.id; playing = true; lastStage = 0;
        ui.start.classList.add('hidden'); ui.death.classList.add('hidden'); ui.hud.classList.remove('hidden');
        break;
      case 'lb': lb = m.l; online = m.n; bots = m.b; renderLeaderboard(); break;
      case 'room':
        if (!room || room.id !== m.id) resetWorld();
        room = { id: m.id, name: m.name }; wantRoom = m.id;
        ui.roomname.textContent = m.name;
        try { history.replaceState(null, '', `${location.pathname}?room=${m.id}`); } catch {}
        if (m.note) showToast(m.note, '');
        break;
      case 'roomclosed':
        playing = false; room = null; wantRoom = null; resetWorld();
        showMenu('That room was closed — pick another one.');
        break;
      case 'full': ui.status.textContent = m.note; break;
      case 'kill': addFeed(m); break;
      case 'gone': ents.delete(m.id); meta.delete(m.id); break;
      case 'evolve': showToast(`EVOLVED!`, stages[m.stage] ? stages[m.stage].name : ''); break;
      case 'dead': onDead(m); break;
      case 'pong': pingMs = Math.round(performance.now() - m.ts); break;
      case 'profile': case 'reward': case 'op': Meta.handle(m); break;
    }
  }

  function onSnapshot(m) {
    lastSnap = performance.now();
    if (m.m) for (const [id, name, hue, bot, cos, pid] of m.m) {
      meta.set(id, { name, hue, bot, pid: pid || null, look: cos ? { color: cos[0], pattern: cos[1], trail: cos[2], frame: cos[3], title: cos[4] } : null });
    }
    const seen = new Set();
    for (const a of m.o) {
      const [id, x, y, r, stage, ang, tr, fl] = a;
      seen.add(id);
      let e = ents.get(id);
      if (!e) {
        e = { id, x, y, r, dx: x, dy: y, dr: r, angle: ang / 100, da: ang / 100, seed: (id * 9301 + 49297) % 233280 / 233280 };
        ents.set(id, e);
      }
      e.x = x; e.y = y; e.r = r; e.stage = stage; e.angle = ang / 100; e.traits = unpackTraits(tr); e.flags = fl;
    }
    for (const id of ents.keys()) if (!seen.has(id)) ents.delete(id);
    if (m.f) food = m.f;
    if (m.y) {
      me = m.y;
      if (me.st > lastStage) lastStage = me.st;
    }
  }

  function unpackTraits(n) {
    const t = {};
    traits.forEach((tr, i) => { t[tr.key] = (n >> (i * 2)) & 3; });
    return t;
  }

  // ---------- menus ----------
  function startGame(target) {
    if (!connected) return;
    const name = ui.name.value.trim();
    try { localStorage.setItem('primordial-name', name); } catch {}
    send({ t: 'join', name, room: typeof target === 'string' ? target : (wantRoom || 'auto') });
  }
  ui.play.onclick = () => startGame();
  ui.again.onclick = () => startGame(room ? room.id : 'auto');
  ui.newroom.onclick = () => startGame('new');
  ui.changeroom.onclick = () => {
    send({ t: 'leave' });
    room = null; wantRoom = null; resetWorld();
    try { history.replaceState(null, '', location.pathname); } catch {}
    showMenu('');
  };
  ui.invite.addEventListener('pointerdown', e => e.stopPropagation());
  ui.invite.onclick = async e => {
    e.stopPropagation();
    if (!room) return;
    const link = `${location.origin}${location.pathname}?room=${room.id}`;
    if (await copyText(link)) showToast('Invite link copied!', link);
    else prompt('Send this link to your friends:', link);
  };

  // navigator.clipboard only exists on HTTPS/localhost; plain-HTTP LAN needs the old way
  async function copyText(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }

  function resetWorld() { ents.clear(); meta.clear(); food = []; lb = []; renderLeaderboard(); }

  function showMenu(status) {
    ui.hud.classList.add('hidden'); ui.death.classList.add('hidden'); ui.choice.classList.add('hidden');
    ui.start.classList.remove('hidden');
    ui.status.textContent = status || '';
    refreshRooms();
  }

  function updatePlayLabel() {
    if (!connected) return;
    const r = wantRoom && roomsCache.find(x => x.id === wantRoom);
    ui.play.textContent = r ? `PLAY IN ${r.name.toUpperCase()}` : 'PLAY';
  }

  async function refreshRooms() {
    if (ui.start.classList.contains('hidden')) return;
    try {
      const res = await fetch('rooms', { cache: 'no-store' });
      const data = await res.json();
      roomsCache = data.rooms;
      ui.roomtotal.textContent = `· ${data.players} playing in ${data.rooms.length} room${data.rooms.length === 1 ? '' : 's'}`;
      ui.roomlist.innerHTML = data.rooms.map(r =>
        `<button class="room${r.id === wantRoom ? ' sel' : ''}${r.players >= r.cap ? ' full' : ''}" data-id="${esc(r.id)}">${esc(r.name)}<span>${r.players} / ${r.cap} players</span></button>`
      ).join('') || '<div class="empty">No rooms yet — press PLAY to open one.</div>';
      if (wantRoom && !roomsCache.some(r => r.id === wantRoom)) {
        ui.status.textContent = 'The room from your link is gone — PLAY puts you in another one.';
        wantRoom = null;
      }
    } catch { /* offline: keep the old list */ }
    updatePlayLabel();
  }
  ui.roomlist.addEventListener('click', e => {
    const b = e.target.closest('.room');
    if (!b || b.classList.contains('full')) return;
    startGame(b.dataset.id);
  });
  setInterval(refreshRooms, 3000);
  ui.name.addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); e.stopPropagation(); });

  function onDead(m) {
    playing = false;
    Meta.onDeath();
    $('deathby').textContent = `Swallowed by ${m.by}`;
    $('d-stage').textContent = stages[m.stage] ? stages[m.stage].name : '-';
    $('d-mass').textContent = m.mass;
    $('d-kills').textContent = m.kills;
    $('d-secs').textContent = m.secs >= 60 ? `${Math.floor(m.secs / 60)}m ${m.secs % 60}s` : `${m.secs}s`;
    setTimeout(() => {
      ui.choice.classList.add('hidden');
      ui.death.classList.remove('hidden');
    }, 900);
  }

  function addFeed(m) {
    const d = document.createElement('div');
    const youA = m.ai === myId, youB = m.bi === myId;
    d.innerHTML = `${esc(youA ? 'You' : m.a)} ate <b>${esc(youB ? 'you' : m.b)}</b>`;
    ui.feed.prepend(d);
    while (ui.feed.children.length > 4) ui.feed.lastChild.remove();
    setTimeout(() => d.remove(), 5000);
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  let toastTimer = 0;
  function showToast(big, small) {
    ui.toast.innerHTML = `${esc(big)}<small>${esc(small)}</small>`;
    ui.toast.style.opacity = 1;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { ui.toast.style.opacity = 0; }, 2200);
  }

  function renderLeaderboard() {
    ui.lblist.innerHTML = lb.map(p =>
      `<li class="${p.id === myId ? 'me' : ''}${p.pid ? ' haspid' : ''}" ${p.pid ? `data-pid="${esc(p.pid)}"` : ''}>${esc(p.name)}<span>${p.mass}</span></li>`).join('') +
      (playing && me && me.a && !lb.some(p => p.id === myId)
        ? `<li class="me" value="0" style="list-style:none">You<span>${Math.floor(me.ms)}</span></li>` : '');
    ui.online.textContent = `${online} player${online === 1 ? '' : 's'} in this room · ${bots} wild organisms`;
  }

  ui.lblist.addEventListener('pointerdown', e => {
    const li = e.target.closest('li[data-pid]');
    if (li) { e.stopPropagation(); Meta.openPublicProfile(li.dataset.pid); }
  });

  let lastHud = 0, lastChoiceKey = '';
  function updateHud(now) {
    if (now - lastHud < 100 || !me) return;
    lastHud = now;
    const st = me.st, cur = stages[st], next = stages[st + 1];
    ui.stagename.textContent = cur ? cur.name : '';
    ui.stagesub.textContent = `Stage ${st + 1} / ${stages.length}` + (next ? ` · next: ${next.name} at ${next.mass}` : ' · fully evolved');
    ui.evobar.style.width = next ? `${Math.min(100, (me.ms - cur.mass) / (next.mass - cur.mass) * 100)}%` : '100%';
    ui.mass.textContent = Math.floor(me.ms);
    ui.kills.textContent = me.k;
    const t = unpackTraits(me.tr);
    const maxCd = 3 * (1 - 0.25 * (t.metabolism || 0));
    ui.dashbar.style.width = `${(1 - me.cd / maxCd) * 100}%`;
    ui.traitlist.innerHTML = traits.filter(tr => t[tr.key]).map(tr => `${esc(tr.name)} ${'●'.repeat(t[tr.key])}`).join('<br>');
    ui.ping.textContent = `${pingMs} ms`;

    const key = me.ch ? me.ch.join(',') + me.nc : '';
    if (key !== lastChoiceKey) {
      lastChoiceKey = key;
      if (me.ch && playing) {
        me.ch.forEach((k, i) => {
          const tr = traits.find(x => x.key === k);
          ui.opt[i].querySelector('b').textContent = `${tr.name}${t[k] ? ' ' + (t[k] + 1) : ''}`;
          ui.opt[i].querySelector('small').textContent = tr.desc;
          ui.opt[i].classList.toggle('hidden', !tr);
        });
        ui.opt[1].classList.toggle('hidden', me.ch.length < 2);
        ui.choice.classList.remove('hidden');
      } else ui.choice.classList.add('hidden');
    }
  }
  ui.opt.forEach((b, i) => b.addEventListener('click', e => { e.stopPropagation(); pick(i); }));
  ui.opt.forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));
  function pick(i) { if (me && me.ch) { send({ t: 'pick', i }); lastChoiceKey = '?'; ui.choice.classList.add('hidden'); } }

  // ---------- input ----------
  let pointer = { x: 0, y: 0, active: false };
  const keys = new Set();
  let useKeys = false;
  const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (isTouch) document.body.classList.add('touch');

  canvas.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; useKeys = false; });
  canvas.addEventListener('pointerdown', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; useKeys = false; });
  canvas.addEventListener('pointerup', e => { if (e.pointerType === 'touch') pointer.active = false; });
  ui.dashbtn.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); send({ t: 'dash' }); });

  addEventListener('keydown', e => {
    if (Meta.isOpen()) return;
    if (!playing) {
      if ((e.key === 'Enter' || e.key === ' ') && !ui.start.classList.contains('hidden') || !ui.death.classList.contains('hidden') && e.key === 'Enter') {
        e.preventDefault(); startGame();
      }
      return;
    }
    const k = e.key.toLowerCase();
    if (k === ' ') { e.preventDefault(); send({ t: 'dash' }); return; }
    if (k === '1') return pick(0);
    if (k === '2') return pick(1);
    if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault(); keys.add(k); useKeys = true;
    }
  });
  addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  function currentInput() {
    if (useKeys) {
      let x = 0, y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x--;
      if (keys.has('d') || keys.has('arrowright')) x++;
      if (keys.has('w') || keys.has('arrowup')) y--;
      if (keys.has('s') || keys.has('arrowdown')) y++;
      const l = Math.hypot(x, y) || 1;
      return { x: x / l * 2000, y: y / l * 2000 };
    }
    if (!pointer.active) return { x: 0, y: 0 };
    return { x: (pointer.x - innerWidth / 2) / cam.scale, y: (pointer.y - innerHeight / 2) / cam.scale };
  }

  setInterval(() => {
    if (!playing) return;
    const i = currentInput();
    send({ t: 'in', x: Math.round(i.x), y: Math.round(i.y), w: Math.round(innerWidth / 2 / cam.scale), h: Math.round(innerHeight / 2 / cam.scale) });
  }, 50);
  setInterval(() => send({ t: 'ping', ts: performance.now() }), 2000);

  // ---------- rendering ----------
  let W = 0, H = 0, dpr = 1;
  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ms = mini.clientWidth || 150;
    mini.width = ms * dpr; mini.height = ms * dpr;
  }
  addEventListener('resize', resize); resize();

  // pre-rendered food sprites
  const foodSprites = FOOD_COLORS.map(c => [5, 9].map(rad => {
    const s = document.createElement('canvas'), size = rad * 4;
    s.width = s.height = size;
    const g = s.getContext('2d');
    const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.25, c); grd.addColorStop(0.5, c + '66'); grd.addColorStop(1, c + '00');
    g.fillStyle = grd; g.fillRect(0, 0, size, size);
    return s;
  }));

  // drifting motes for parallax depth
  const motes = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 2 + 0.5, p: Math.random() * 0.5 + 0.15 }));

  function hsl(h, s, l, a = 1) { return `hsla(${h},${s}%,${l}%,${a})`; }
  const trails = new Draw.Trails(800);

  function lookOf(id) { const m = meta.get(id); return m && m.look; }

  function drawOrganism(e, t) {
    const m = meta.get(e.id) || { name: '', hue: 160 };
    const r = e.dr;
    Draw.body(ctx, { x: e.dx, y: e.dy, r, angle: e.da, stage: e.stage, traits: e.traits, hue: m.hue, seed: e.seed, flags: e.flags, look: m.look }, t);
    if (e.flags & 4) { // spawn shield bubble
      ctx.beginPath(); ctx.arc(e.dx, e.dy, r * 1.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(160,230,255,0.10)'; ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.06); ctx.strokeStyle = `rgba(190,240,255,${0.45 + 0.25 * Math.sin(t * 8)})`; ctx.stroke();
    }
    if (!m.name) return;
    // name tag (screen-space size), optional frame and title
    const fs = Math.max(11, Math.min(28, r * 0.32 * cam.scale));
    const look = m.look || {};
    const frame = look.frame && look.frame !== 'f_none' && CATALOG.ITEM[look.frame];
    const title = look.title && look.title !== 'ti_none' && CATALOG.ITEM[look.title];
    ctx.save();
    ctx.translate(e.dx, e.dy + r + 6 / cam.scale);
    ctx.scale(1 / cam.scale, 1 / cam.scale);
    ctx.font = `700 ${fs}px Trebuchet MS, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    if (frame) {
      const w = ctx.measureText(m.name).width + fs * 1.1, h = fs * 1.45;
      ctx.beginPath(); ctx.roundRect(-w / 2, -fs * 0.22, w, h, h / 2);
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = frame.color; ctx.stroke();
    }
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.strokeText(m.name, 0, 0);
    ctx.fillStyle = e.id === myId ? '#ffffff' : 'rgba(255,255,255,0.88)';
    ctx.fillText(m.name, 0, 0);
    if (title) {
      const ts = Math.max(10, fs * 0.72);
      ctx.font = `italic 700 ${ts}px Trebuchet MS, sans-serif`;
      ctx.strokeText(title.name, 0, fs * 1.35);
      ctx.fillStyle = '#ffcf4a';
      ctx.fillText(title.name, 0, fs * 1.35);
    }
    ctx.restore();
  }

  function drawBackground(t) {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
    g.addColorStop(0, '#0b3442'); g.addColorStop(1, '#03141e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // parallax motes
    ctx.fillStyle = 'rgba(160,240,230,0.18)';
    for (const m of motes) {
      const x = ((m.x * W - cam.x * cam.scale * m.p + t * 6 * m.p) % W + W) % W;
      const y = ((m.y * H - cam.y * cam.scale * m.p) % H + H) % H;
      ctx.beginPath(); ctx.arc(x, y, m.s, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawWorldGrid() {
    const step = 100;
    const x0 = cam.x - W / 2 / cam.scale, y0 = cam.y - H / 2 / cam.scale;
    const x1 = cam.x + W / 2 / cam.scale, y1 = cam.y + H / 2 / cam.scale;
    ctx.strokeStyle = 'rgba(120,220,210,0.05)'; ctx.lineWidth = 1 / cam.scale;
    ctx.beginPath();
    for (let x = Math.max(0, Math.floor(x0 / step) * step); x <= Math.min(world, x1); x += step) { ctx.moveTo(x, Math.max(0, y0)); ctx.lineTo(x, Math.min(world, y1)); }
    for (let y = Math.max(0, Math.floor(y0 / step) * step); y <= Math.min(world, y1); y += step) { ctx.moveTo(Math.max(0, x0), y); ctx.lineTo(Math.min(world, x1), y); }
    ctx.stroke();
    // world edge
    ctx.strokeStyle = 'rgba(255,93,115,0.55)'; ctx.lineWidth = 8 / cam.scale;
    ctx.strokeRect(0, 0, world, world);
    // darken outside
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    if (x0 < 0) ctx.fillRect(x0, y0, -x0, y1 - y0);
    if (x1 > world) ctx.fillRect(world, y0, x1 - world, y1 - y0);
    if (y0 < 0) ctx.fillRect(Math.max(0, x0), y0, Math.min(world, x1) - Math.max(0, x0), -y0);
    if (y1 > world) ctx.fillRect(Math.max(0, x0), world, Math.min(world, x1) - Math.max(0, x0), y1 - world);
  }

  function drawFood(t) {
    const myE = ents.get(myId);
    for (let i = 0; i < food.length; i += 3) {
      const x = food[i], y = food[i + 1], c = food[i + 2];
      // hide food we're obviously already swallowing (server will confirm)
      if (myE && (x - myE.dx) ** 2 + (y - myE.dy) ** 2 < myE.dr * myE.dr * 0.8) continue;
      const big = c >= 10 ? 1 : 0;
      const spr = foodSprites[c % 10][big];
      const bob = Math.sin(t * 2 + x * 0.05 + y * 0.03) * 2;
      const size = spr.width;
      ctx.drawImage(spr, x - size / 2, y - size / 2 + bob);
    }
  }

  function drawMinimap() {
    const s = mini.width, k = s / world;
    mctx.clearRect(0, 0, s, s);
    mctx.fillStyle = 'rgba(0,0,0,0.25)'; mctx.fillRect(0, 0, s, s);
    // view rectangle
    mctx.strokeStyle = 'rgba(255,255,255,0.35)'; mctx.lineWidth = 1 * dpr;
    mctx.strokeRect((cam.x - W / 2 / cam.scale) * k, (cam.y - H / 2 / cam.scale) * k, W / cam.scale * k, H / cam.scale * k);
    for (const p of lb) {
      const m = meta.get(p.id);
      mctx.fillStyle = hsl(m ? m.hue : p.hue, 80, 60, 0.9);
      mctx.beginPath(); mctx.arc(p.x * k, p.y * k, (2 + p.stage * 0.6) * dpr, 0, Math.PI * 2); mctx.fill();
    }
    if (me && me.a) {
      mctx.fillStyle = '#fff'; mctx.beginPath(); mctx.arc(me.x * k, me.y * k, 3.5 * dpr, 0, Math.PI * 2); mctx.fill();
    }
  }

  let lastFrame = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    const t = now / 1000;
    const sm = 1 - Math.exp(-dt * 14);

    for (const e of ents.values()) {
      const px = e.dx, py = e.dy;
      e.dx += (e.x - e.dx) * sm; e.dy += (e.y - e.dy) * sm; e.dr += (e.r - e.dr) * sm;
      const look = lookOf(e.id);
      if (look && look.trail && look.trail !== 't_none' && Math.hypot(e.dx - px, e.dy - py) > 0.4) {
        e.tp = e.tp || {};
        Object.assign(e.tp, { x: e.dx, y: e.dy, r: e.dr, angle: e.da, hue: (meta.get(e.id) || {}).hue || 0 });
        trails.emit(e.tp, look.trail, dt, t);
      }
      let da = e.angle - e.da;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      e.da += da * Math.min(1, sm * 0.8);
    }

    // camera
    const myE = ents.get(myId);
    let tx = cam.x, ty = cam.y, tr = 30;
    if (myE) { tx = myE.dx; ty = myE.dy; tr = myE.dr; }
    else if (me) { tx = me.x; ty = me.y; }
    const targetScale = Math.min(W, H) / (560 + tr * 7);
    cam.x += (tx - cam.x) * Math.min(1, dt * 8);
    cam.y += (ty - cam.y) * Math.min(1, dt * 8);
    cam.scale += (targetScale - cam.scale) * Math.min(1, dt * 2);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground(t);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.scale, cam.scale);
    ctx.translate(-cam.x, -cam.y);
    drawWorldGrid();
    drawFood(t);
    trails.update(dt);
    trails.draw(ctx, t);
    // smaller organisms underneath bigger ones
    const list = [...ents.values()].sort((a, b) => a.dr - b.dr);
    for (const e of list) drawOrganism(e, t);
    ctx.restore();

    if (playing) { updateHud(now); drawMinimap(); }
    requestAnimationFrame(frame);
  }

  connect();
  requestAnimationFrame(frame);
})();
