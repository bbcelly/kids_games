'use strict';
(() => {
  // ---------- DOM ----------
  const $ = id => document.getElementById(id);
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const mini = $('minimap'), mctx = mini.getContext('2d');
  const ui = {
    hud: $('hud'), start: $('startscreen'), death: $('deathscreen'),
    name: $('name'), play: $('play'), again: $('again'), status: $('status'),
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
    };
    ws.onclose = () => {
      connected = false; playing = false;
      ui.play.disabled = true; ui.play.textContent = 'RECONNECTING…';
      ui.status.textContent = 'Lost connection — retrying…';
      ui.hud.classList.add('hidden'); ui.death.classList.add('hidden'); ui.start.classList.remove('hidden');
      ents.clear(); meta.clear(); myId = null; me = null;
      setTimeout(connect, 1500);
    };
    ws.onmessage = e => handle(JSON.parse(e.data));
  }
  function send(m) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(m)); }

  function handle(m) {
    switch (m.t) {
      case 'welcome': world = m.world; stages = m.stages; traits = m.traits; break;
      case 's': onSnapshot(m); break;
      case 'spawned':
        myId = m.id; playing = true; lastStage = 0;
        ui.start.classList.add('hidden'); ui.death.classList.add('hidden'); ui.hud.classList.remove('hidden');
        break;
      case 'lb': lb = m.l; online = m.n; bots = m.b; renderLeaderboard(); break;
      case 'kill': addFeed(m); break;
      case 'gone': ents.delete(m.id); meta.delete(m.id); break;
      case 'evolve': showToast(`EVOLVED!`, stages[m.stage] ? stages[m.stage].name : ''); break;
      case 'dead': onDead(m); break;
      case 'pong': pingMs = Math.round(performance.now() - m.ts); break;
    }
  }

  function onSnapshot(m) {
    lastSnap = performance.now();
    if (m.m) for (const [id, name, hue, bot] of m.m) meta.set(id, { name, hue, bot });
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
  function startGame() {
    if (!connected) return;
    const name = ui.name.value.trim();
    try { localStorage.setItem('primordial-name', name); } catch {}
    send({ t: 'join', name });
  }
  ui.play.onclick = startGame;
  ui.again.onclick = startGame;
  ui.name.addEventListener('keydown', e => { if (e.key === 'Enter') startGame(); e.stopPropagation(); });

  function onDead(m) {
    playing = false;
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
      `<li class="${p.id === myId ? 'me' : ''}">${esc(p.name)}<span>${p.mass}</span></li>`).join('');
    ui.online.textContent = `${online} player${online === 1 ? '' : 's'} online · ${bots} wild organisms`;
  }

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

  function blobPath(r, t, seed, wob = 0.06, n = 22) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (1 + wob * Math.sin(a * 3 + t * 2.1 + seed * 10) + wob * 0.6 * Math.sin(a * 5 - t * 1.7 + seed * 20));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function cellFill(r, hue, light = 55) {
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, hsl(hue, 80, light + 20, 0.95));
    g.addColorStop(0.7, hsl(hue, 70, light, 0.85));
    g.addColorStop(1, hsl(hue, 75, light - 15, 0.9));
    return g;
  }

  function drawCell(r, hue, t, seed, wob, membraneLvl) {
    blobPath(r, t, seed, wob);
    ctx.fillStyle = cellFill(r, hue);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.strokeStyle = hsl(hue, 85, 80, 0.9);
    ctx.stroke();
    if (membraneLvl) {
      blobPath(r * (1.06 + membraneLvl * 0.03), t, seed, wob);
      ctx.lineWidth = Math.max(2, r * 0.04 * (1 + membraneLvl));
      ctx.strokeStyle = hsl(hue, 60, 85, 0.35);
      ctx.stroke();
    }
  }

  function wavyLine(x0, y0, ang, len, amp, t, phase, width, color) {
    ctx.beginPath();
    const segs = 12;
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const along = f * len, side = Math.sin(f * 7 - t * 12 + phase) * amp * f;
      const x = x0 + Math.cos(ang) * along - Math.sin(ang) * side;
      const y = y0 + Math.sin(ang) * along + Math.cos(ang) * side;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
  }

  function drawSpikes(r, lvl, hue, t) {
    const n = 8 + lvl * 4;
    ctx.fillStyle = hsl((hue + 180) % 360, 70, 70, 0.9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.2;
      const len = r * (0.18 + lvl * 0.06);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.12) * r * 0.95, Math.sin(a - 0.12) * r * 0.95);
      ctx.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len));
      ctx.lineTo(Math.cos(a + 0.12) * r * 0.95, Math.sin(a + 0.12) * r * 0.95);
      ctx.fill();
    }
  }

  function drawCilia(r, lvl, hue, t) {
    const n = 24 + lvl * 10;
    ctx.strokeStyle = hsl(hue, 70, 85, 0.6); ctx.lineWidth = Math.max(1, r * 0.025);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sway = Math.sin(t * 8 + i) * 0.15;
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + sway) * r * (1.12 + lvl * 0.03), Math.sin(a + sway) * r * (1.12 + lvl * 0.03));
    }
    ctx.stroke();
  }

  function drawJaws(r, t, hue, size = 1, x = 0.85) {
    const open = (Math.sin(t * 6) * 0.5 + 0.5) * 0.5 + 0.15;
    ctx.fillStyle = hsl(hue, 30, 92, 0.95);
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(r * x, s * r * 0.18 * size);
      ctx.rotate(s * open);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.35 * size, s * r * 0.05, r * 0.42 * size, -s * r * 0.14 * size);
      ctx.quadraticCurveTo(r * 0.2 * size, s * r * 0.02, 0, s * r * 0.1 * size);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEyes(r, x, spread, size, glow) {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(r * x, s * r * spread, r * size, 0, Math.PI * 2);
      ctx.fillStyle = glow ? '#fff7b0' : '#ffffff'; ctx.fill();
      ctx.beginPath(); ctx.arc(r * (x + size * 0.35), s * r * spread, r * size * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = glow ? '#ff3b3b' : '#111'; ctx.fill();
    }
  }

  function drawOrganism(e, t) {
    const m = meta.get(e.id) || { name: '', hue: 160 };
    const hue = m.hue, r = e.dr, tr = e.traits || {};
    ctx.save();
    ctx.translate(e.dx, e.dy);

    // metabolism glow / dash streak / poison tint
    if (tr.metabolism) {
      const g = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * (1.5 + tr.metabolism * 0.15));
      g.addColorStop(0, hsl(hue, 90, 60, 0.25)); g.addColorStop(1, hsl(hue, 90, 60, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2); ctx.fill();
    }
    if (e.flags & 1) {
      ctx.save(); ctx.rotate(e.da);
      const g = ctx.createLinearGradient(-r * 3, 0, 0, 0);
      g.addColorStop(0, 'rgba(127,215,255,0)'); g.addColorStop(1, 'rgba(127,215,255,0.35)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-r * 1.4, 0, r * 1.8, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    ctx.rotate(e.da);
    // flagella trait tails (all stages)
    for (let i = 0; i < (tr.flagella || 0); i++) {
      const off = (i - (tr.flagella - 1) / 2) * r * 0.3;
      wavyLine(-r * 0.9, off, Math.PI + off / r * 0.4, r * 1.3, r * 0.22, t, i * 2, Math.max(1.5, r * 0.06), hsl(hue, 70, 75, 0.8));
    }
    if (tr.cilia) drawCilia(r, tr.cilia, hue, t);
    if (tr.spikes) drawSpikes(r, tr.spikes, hue, t);

    switch (e.stage) {
      case 0: drawProkaryote(r, hue, t, e.seed, tr); break;
      case 1: drawEukaryote(r, hue, t, e.seed, tr); break;
      case 2: drawColony(r, hue, t, e.seed, tr); break;
      case 3: drawMulticell(r, hue, t, e.seed, tr); break;
      case 4: drawPredator(r, hue, t, e.seed, tr); break;
      default: drawApex(r, hue, t, e.seed, tr); break;
    }
    if (tr.jaws && e.stage < 4) drawJaws(r, t, hue, 0.7 + tr.jaws * 0.15, 0.8);
    if (e.flags & 2) { // poisoned
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,255,80,0.22)'; ctx.fill();
    }
    ctx.restore();
    if (e.flags & 4) { // spawn shield bubble
      ctx.beginPath(); ctx.arc(e.dx, e.dy, r * 1.35, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(160,230,255,0.10)'; ctx.fill();
      ctx.lineWidth = Math.max(2, r * 0.06); ctx.strokeStyle = `rgba(190,240,255,${0.45 + 0.25 * Math.sin(t * 8)})`; ctx.stroke();
    }

    // name tag (not rotated)
    if (m.name) {
      const fs = Math.max(11, Math.min(28, r * 0.32)) * cam.scale;
      if (fs > 6) {
        ctx.save();
        ctx.translate(e.dx, e.dy + r + 6 / cam.scale);
        ctx.scale(1 / cam.scale, 1 / cam.scale);
        ctx.font = `700 ${Math.max(11, fs)}px Trebuchet MS, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeText(m.name, 0, 0);
        ctx.fillStyle = e.id === myId ? '#ffffff' : 'rgba(255,255,255,0.85)';
        ctx.fillText(m.name, 0, 0);
        ctx.restore();
      }
    }
  }

  function drawProkaryote(r, hue, t, seed, tr) {
    drawCell(r, hue, t, seed, 0.07, tr.membrane);
    ctx.fillStyle = hsl(hue, 60, 30, 0.6);
    for (let i = 0; i < 5; i++) {
      const a = seed * 30 + i * 1.3 + Math.sin(t + i) * 0.2, d = r * (0.2 + (i % 3) * 0.18);
      ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.07, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawEukaryote(r, hue, t, seed, tr) {
    drawCell(r, hue, t, seed, 0.06, tr.membrane);
    // organelles
    ctx.fillStyle = hsl((hue + 40) % 360, 70, 45, 0.75);
    for (let i = 0; i < 3; i++) {
      const a = seed * 50 + i * 2.1 + t * 0.3;
      ctx.save(); ctx.translate(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.18, r * 0.08, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // nucleus
    ctx.beginPath(); ctx.arc(-r * 0.1, 0, r * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = hsl(hue, 55, 32, 0.85); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.06, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = hsl(hue, 60, 60, 0.9); ctx.fill();
  }

  function drawColony(r, hue, t, seed, tr) {
    const n = 5, sr = r * 0.34, d = r * 0.62;
    // membrane web
    ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = hsl(hue, 60, 50, 0.18); ctx.fill();
    ctx.strokeStyle = hsl(hue, 70, 80, 0.25); ctx.lineWidth = r * 0.03; ctx.stroke();
    const rot = t * 0.4;
    ctx.strokeStyle = hsl(hue, 70, 75, 0.5); ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
      drawCell(sr, (hue + i * 12) % 360, t + i, seed + i, 0.08, 0);
      ctx.beginPath(); ctx.arc(0, 0, sr * 0.35, 0, Math.PI * 2); ctx.fillStyle = hsl(hue, 55, 30, 0.7); ctx.fill();
      ctx.restore();
    }
    drawCell(r * 0.42, hue, t, seed, 0.05, tr.membrane);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = hsl(hue, 55, 28, 0.85); ctx.fill();
  }

  function segBody(r, hue, t, seed, segs, wiggle) {
    // segs: [[xOffsetFactor, radiusFactor], ...] from tail to head
    const pts = segs.map(([x, s], i) => [x * r, Math.sin(t * 5 - i * 0.9 + seed * 10) * r * wiggle * (1 - i / segs.length), s * r]);
    // connective tissue
    ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.lineWidth = r * 0.3; ctx.strokeStyle = hsl(hue, 60, 45, 0.7); ctx.lineCap = 'round'; ctx.stroke();
    pts.forEach(([x, y, s], i) => {
      ctx.save(); ctx.translate(x, y);
      drawCell(s, (hue + i * 6) % 360, t + i * 0.7, seed + i, 0.05, 0);
      ctx.restore();
    });
    return pts;
  }

  function drawMulticell(r, hue, t, seed, tr) {
    const pts = segBody(r, hue, t, seed, [[-0.82, 0.2], [-0.52, 0.3], [-0.15, 0.4], [0.35, 0.5]], 0.18);
    const tail = pts[0];
    wavyLine(tail[0] - r * 0.15, tail[1], Math.PI, r * 0.9, r * 0.2, t, 0, Math.max(1.5, r * 0.05), hsl(hue, 70, 80, 0.8));
    // eyespot + nucleus on head
    const [hx, hy] = pts[pts.length - 1];
    ctx.beginPath(); ctx.arc(hx + r * 0.2, hy - r * 0.12, r * 0.09, 0, Math.PI * 2); ctx.fillStyle = '#ff5050'; ctx.fill();
    ctx.beginPath(); ctx.arc(hx - r * 0.05, hy + r * 0.05, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = hsl(hue, 55, 30, 0.75); ctx.fill();
  }

  function drawPredator(r, hue, t, seed, tr) {
    // tail fin
    const sw = Math.sin(t * 6) * 0.35;
    ctx.save(); ctx.translate(-r * 0.75, 0); ctx.rotate(sw);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.45, -r * 0.35); ctx.quadraticCurveTo(-r * 0.3, 0, -r * 0.45, r * 0.35); ctx.closePath();
    ctx.fillStyle = hsl(hue, 70, 45, 0.85); ctx.fill(); ctx.restore();
    // side fins
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(r * 0.05, s * r * 0.45); ctx.rotate(s * (0.6 + Math.sin(t * 5) * 0.2));
      ctx.beginPath(); ctx.ellipse(-r * 0.15, 0, r * 0.28, r * 0.09, 0, 0, Math.PI * 2);
      ctx.fillStyle = hsl(hue, 70, 50, 0.8); ctx.fill(); ctx.restore();
    }
    // body
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.88, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = cellFill(r * 0.8, hue, 50); ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.04); ctx.strokeStyle = hsl(hue, 85, 78, 0.9); ctx.stroke();
    if (tr.membrane) {
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.62, 0, 0, Math.PI * 2);
      ctx.lineWidth = r * 0.03 * (1 + tr.membrane); ctx.strokeStyle = hsl(hue, 60, 85, 0.35); ctx.stroke();
    }
    // stripes
    ctx.strokeStyle = hsl(hue, 60, 30, 0.5); ctx.lineWidth = r * 0.06;
    for (let i = 0; i < 4; i++) {
      const x = -r * 0.5 + i * r * 0.25;
      ctx.beginPath(); ctx.moveTo(x, -r * 0.45); ctx.quadraticCurveTo(x + r * 0.08, 0, x, r * 0.45); ctx.stroke();
    }
    // dorsal plates
    ctx.fillStyle = hsl((hue + 30) % 360, 70, 70, 0.9);
    for (let i = 0; i < 5; i++) {
      const x = -r * 0.55 + i * r * 0.25;
      ctx.beginPath(); ctx.arc(x, 0, r * 0.06, 0, Math.PI * 2); ctx.fill();
    }
    drawJaws(r, t, hue, 1 + (tr.jaws || 0) * 0.15, 0.78);
    drawEyes(r, 0.5, 0.25, 0.1, false);
  }

  function drawApex(r, hue, t, seed, tr) {
    // tentacles from the head area
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      const ang = s * (0.9 + k * 0.45);
      wavyLine(r * 0.35, s * r * 0.2, ang + Math.PI * 0.15 * s, r * (0.75 + k * 0.1), r * 0.15, t * 0.7, i, Math.max(2, r * 0.06 * (1 - k * 0.2)), hsl((hue + 20) % 360, 70, 55, 0.85));
    }
    // long segmented body
    const pts = segBody(r, hue, t * 0.8, seed, [[-0.92, 0.14], [-0.74, 0.2], [-0.52, 0.27], [-0.26, 0.34], [0.05, 0.4], [0.42, 0.46]], 0.14);
    // bioluminescent dots along body
    pts.forEach(([x, y, s], i) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
      ctx.beginPath(); ctx.arc(x, y - s * 0.4, s * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,255,240,${0.4 + pulse * 0.5})`; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + s * 0.4, s * 0.15, 0, Math.PI * 2); ctx.fill();
    });
    // dorsal spines
    ctx.fillStyle = hsl((hue + 200) % 360, 60, 75, 0.9);
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y, s] = pts[i];
      ctx.beginPath(); ctx.moveTo(x - s * 0.3, y - s * 0.8); ctx.lineTo(x - s * 0.9, y - s * 1.5); ctx.lineTo(x + s * 0.2, y - s * 0.9); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - s * 0.3, y + s * 0.8); ctx.lineTo(x - s * 0.9, y + s * 1.5); ctx.lineTo(x + s * 0.2, y + s * 0.9); ctx.fill();
    }
    const [hx, hy] = pts[pts.length - 1];
    ctx.save(); ctx.translate(hx - r * 0.42, hy);
    drawJaws(r, t, hue, 1.1 + (tr.jaws || 0) * 0.15, 0.82);
    drawEyes(r, 0.55, 0.2, 0.08, true);
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
      e.dx += (e.x - e.dx) * sm; e.dy += (e.y - e.dy) * sm; e.dr += (e.r - e.dr) * sm;
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
