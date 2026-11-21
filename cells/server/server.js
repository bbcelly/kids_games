'use strict';
// Main thread: HTTP + WebSocket connections + room directory. Rooms are simulated
// in worker threads (room-worker.js) spread over the CPU cores.
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Worker } = require('worker_threads');
const { monitorEventLoopDelay } = require('perf_hooks');
const { WebSocketServer } = require('ws');
const { WORLD, TICK_HZ, STAGES, TRAITS } = require('./game');
const { RoomDirectory } = require('./rooms');
const { ProfileStore } = require('./profiles');
const P = require('./progression');
const CATALOG = require('../public/catalog');

const env = (k, d) => (process.env[k] != null && process.env[k] !== '' ? parseInt(process.env[k], 10) : d);
const PORT = env('PORT', 8080);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_CLIENTS = env('MAX_CLIENTS', 2000);
const WORKERS = env('WORKERS', Math.max(1, os.cpus().length - 1));
const BOT_TARGET = process.env.BOT_TARGET != null ? env('BOT_TARGET', 14) : undefined;
const PUBLIC = path.join(__dirname, '..', 'public');
const SLOW_CLIENT_BYTES = 512 * 1024; // skip snapshots to clients that can't keep up
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const TRUST_PROXY = process.env.TRUST_PROXY === '1'; // use X-Forwarded-For behind a reverse proxy
const NEW_PROFILES_PER_IP_HOUR = env('NEW_PROFILES_PER_IP_HOUR', 20);

// ---------- profiles ----------
if (process.env.REWARD_MIN_LIFE_SECS) P.CFG.minLifeSecs = +process.env.REWARD_MIN_LIFE_SECS;
if (process.env.REWARD_MIN_LIFE_MASS) P.CFG.minLifeMass = +process.env.REWARD_MIN_LIFE_MASS;
const store = new ProfileStore(DATA_DIR);
console.log(`loaded ${store.size} profile(s) from ${DATA_DIR}`);
setInterval(() => { store.flush(); }, 5000);
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => { store.flushSync(); process.exit(0); });
}
const newProfileLog = new Map(); // ip -> [timestamps]
function mayCreateProfile(ip) {
  const now = Date.now(), list = (newProfileLog.get(ip) || []).filter(t => now - t < 3600e3);
  if (list.length >= NEW_PROFILES_PER_IP_HOUR) { newProfileLog.set(ip, list); return false; }
  list.push(now); newProfileLog.set(ip, list);
  return true;
}
setInterval(() => { // forget old entries
  const now = Date.now();
  for (const [ip, list] of newProfileLog) if (!list.some(t => now - t < 3600e3)) newProfileLog.delete(ip);
}, 600e3);
// clients that disconnected recently: their last life's reward still arrives from the worker
const recentlyGone = new Map(); // cid -> client

const dir = new RoomDirectory({
  softCap: env('ROOM_SOFT_CAP', 50),
  hardCap: env('ROOM_HARD_CAP', 60),
  maxRooms: env('MAX_ROOMS', 60),
  idleMs: env('ROOM_IDLE_MS', 5 * 60 * 1000),
});

// ---------- workers ----------
const workers = []; // {w, rooms:Set, tickMs}
const roomWorker = new Map(); // roomId -> worker slot
const members = new Map(); // roomId -> Set(client)
const clients = new Map(); // cid -> client
let nextCid = 1;

// Player inputs are batched per worker and flushed once per event-loop turn.
// Steering ('in') is coalesced: only the newest one per player matters.
const pendingIn = new Map();   // worker entry -> Map(cid -> [room, cid, m])
const pendingOther = new Map(); // worker entry -> [[room, cid, m], ...]
let flushScheduled = false;
function queueInput(e, room, cid, m) {
  if (m.t === 'in') {
    let map = pendingIn.get(e);
    if (!map) { map = new Map(); pendingIn.set(e, map); }
    map.set(cid, [room, cid, m]);
  } else {
    let arr = pendingOther.get(e);
    if (!arr) { arr = []; pendingOther.set(e, arr); }
    arr.push([room, cid, m]);
  }
  if (!flushScheduled) { flushScheduled = true; setImmediate(flushInputs); }
}
function flushInputs() {
  flushScheduled = false;
  const ws = new Set([...pendingIn.keys(), ...pendingOther.keys()]);
  for (const e of ws) {
    const list = [...(pendingIn.get(e) || new Map()).values(), ...(pendingOther.get(e) || [])];
    if (list.length && workers[e.slot] === e) e.w.postMessage({ t: 'inputs', list });
  }
  pendingIn.clear(); pendingOther.clear();
}

function startWorker(slot) {
  const w = new Worker(path.join(__dirname, 'room-worker.js'), { workerData: { botTarget: BOT_TARGET } });
  const entry = { w, rooms: new Set(), tickMs: 0, slot };
  workers[slot] = entry;
  w.on('message', m => onWorkerMessage(entry, m));
  w.on('error', err => console.error(`worker ${slot} error:`, err));
  w.on('exit', code => {
    console.error(`worker ${slot} exited (${code}); restarting`);
    for (const roomId of entry.rooms) {
      for (const c of members.get(roomId) || []) {
        c.room = null;
        send(c, { t: 'roomclosed' });
      }
      members.delete(roomId);
      roomWorker.delete(roomId);
      dir.remove(roomId);
    }
    startWorker(slot);
    ensureOneRoom();
  });
  return entry;
}

function onWorkerMessage(entry, m) {
  if (m.t === 'batch') {
    for (const [cid, str, roomId] of m.out) {
      const c = clients.get(cid);
      if (!c || c.room !== roomId || c.ws.readyState !== 1) continue;
      // drop snapshots (but never other messages) for clients that fall behind
      if (c.ws.bufferedAmount > SLOW_CLIENT_BYTES && str.startsWith('{"t":"s"')) continue;
      c.ws.send(str);
    }
    for (const [roomId, str] of m.bc) {
      const set = members.get(roomId);
      if (!set) continue;
      for (const c of set) if (c.ws.readyState === 1) c.ws.send(str);
    }
    if (m.sess) for (const [cid, , life] of m.sess) onLifeEnded(clients.get(cid) || recentlyGone.get(cid), life);
  } else if (m.t === 'stats') {
    entry.tickMs = m.tickMs;
  }
}

function onLifeEnded(c, life) {
  if (!c || !c.profile) return;
  const p = c.profile;
  life.look = P.equippedLook(p);
  c.lastLife = { ...life, saved: false };
  const summary = P.applySession(p, life, Date.now());
  store.touch(p);
  summary.canSave = life.maxStage >= 2 && p.lab.specimens.length < CATALOG.labCapacity(p.level);
  summary.labFull = life.maxStage >= 2 && !summary.canSave;
  send(c, { t: 'reward', s: summary });
  sendProfile(c);
}

function sendProfile(c, extra) {
  if (c.profile) send(c, { t: 'profile', p: P.privateView(c.profile, Date.now()), ...extra });
}

// Profile actions sent by the client. Each returns {ok, error, ...}.
function profileAction(c, m) {
  const p = c.profile, now = Date.now();
  switch (m.t) {
    case 'claimDaily': return P.claimDaily(p, now);
    case 'buy': return P.buy(p, String(m.id));
    case 'equip': return P.equip(p, String(m.slot), String(m.id));
    case 'reroll': return P.rerollTask(p, m.i | 0, now);
    case 'showcase': return P.setShowcase(p, m.ids);
    case 'release': return P.releaseSpecimen(p, String(m.id));
    case 'saveSpecimen': return P.saveSpecimen(p, c.lastLife, now);
  }
  return { ok: false, error: 'Unknown action.' };
}

function onHello(c, m) {
  let p = store.byTokenGet(m.token), created = false;
  if (!p) {
    if (!mayCreateProfile(c.ip)) { send(c, { t: 'profile', p: null, error: 'Too many new profiles from your network — try again later.' }); return; }
    p = store.create();
    created = true;
  }
  c.profile = p;
  p.lastSeen = Date.now();
  if (P.ensureTasks(p, Date.now()) || created) store.touch(p);
  sendProfile(c, created ? { token: p.token } : {});
}

function onRestore(c, m) {
  if (++c.restoreTries > 5) { send(c, { t: 'op', op: 'restore', ok: false, error: 'Too many attempts — reload the page and try again.' }); return; }
  const p = store.byCodeGet(m.code);
  if (!p) { send(c, { t: 'op', op: 'restore', ok: false, error: 'No profile with that code.' }); return; }
  c.profile = p;
  send(c, { t: 'op', op: 'restore', ok: true });
  sendProfile(c, { token: p.token });
}

function createRoom(room) {
  // least loaded worker: players + a small weight per room (each room has bots)
  let best = null, bestLoad = Infinity;
  for (const e of workers) {
    let load = e.rooms.size * 8;
    for (const id of e.rooms) { const r = dir.get(id); if (r) load += r.humans; }
    if (load < bestLoad) { bestLoad = load; best = e; }
  }
  best.rooms.add(room.id);
  roomWorker.set(room.id, best);
  members.set(room.id, new Set());
  best.w.postMessage({ t: 'create', room: room.id, name: room.name });
}

function closeRoom(room) {
  const e = roomWorker.get(room.id);
  if (e) { e.rooms.delete(room.id); e.w.postMessage({ t: 'close', room: room.id }); }
  roomWorker.delete(room.id);
  members.delete(room.id);
}

function ensureOneRoom() {
  if (dir.rooms.size === 0) createRoom(dir.create());
}

const loopLag = monitorEventLoopDelay({ resolution: 20 });
loopLag.enable();

for (let i = 0; i < WORKERS; i++) startWorker(i);
ensureOneRoom();

setInterval(() => { for (const r of dir.sweep()) closeRoom(r); }, 10000);

// ---------- HTTP ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

function json(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); } catch { res.writeHead(400); return res.end(); }
  if (urlPath === '/rooms') {
    return json(res, { rooms: dir.list(), players: dir.totalHumans(), softCap: dir.softCap });
  }
  if (urlPath.startsWith('/api/profile/')) {
    const p = store.byPublicGet(urlPath.slice('/api/profile/'.length));
    if (!p) { res.writeHead(404, { 'Content-Type': 'application/json' }); return res.end('{"error":"not found"}'); }
    return json(res, P.publicView(p));
  }
  if (urlPath === '/health') {
    json(res, {
      ok: true, connections: clients.size, players: dir.totalHumans(), rooms: dir.rooms.size, profiles: store.size,
      workers: workers.map(e => ({ rooms: e.rooms.size, tickMs: Math.round(e.tickMs * 100) / 100 })),
      // histogram includes the 20 ms sampling interval itself
      mainLagMs: { p50: Math.max(0, Math.round(loopLag.percentile(50) / 1e5) / 10 - 20), p99: Math.max(0, Math.round(loopLag.percentile(99) / 1e5) / 10 - 20) },
    });
    loopLag.reset();
    return;
  }
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const file = path.normalize(path.join(PUBLIC, urlPath));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

server.on('upgrade', (req, socket, head) => {
  if ((req.url || '').split('?')[0] !== '/ws' || clients.size >= MAX_CLIENTS) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
});

function send(c, msg) {
  if (c.ws.readyState === 1) c.ws.send(JSON.stringify(msg));
}
function cleanName(n) {
  n = String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  return n || 'Cell ' + ((Math.random() * 900 + 100) | 0);
}
function cleanRoom(r) {
  r = String(r || 'auto').toLowerCase();
  return /^(auto|new|[0-9a-z]{4})$/.test(r) ? r : 'auto';
}

function leaveRoom(c) {
  if (!c.room) return;
  const e = roomWorker.get(c.room);
  if (e) e.w.postMessage({ t: 'leave', room: c.room, cid: c.cid });
  const set = members.get(c.room);
  if (set) set.delete(c);
  dir.left(c.room);
  c.room = null;
}

function joinRoom(c, name, requested) {
  if (c.room && requested === c.room) {
    // respawn in the room you are already in
    roomWorker.get(c.room).w.postMessage({ t: 'join', room: c.room, cid: c.cid, name, ...joinExtras(c, name) });
    return;
  }
  leaveRoom(c);
  const { room, created, note } = dir.pick(requested);
  if (!room) { send(c, { t: 'full', note }); return; }
  if (created) createRoom(room);
  dir.joined(room.id);
  c.room = room.id;
  members.get(room.id).add(c);
  send(c, { t: 'room', id: room.id, name: room.name, note });
  roomWorker.get(room.id).w.postMessage({ t: 'join', room: room.id, cid: c.cid, name, ...joinExtras(c, name) });
}

// cosmetics come only from the server-side profile, never from the client
function joinExtras(c, name) {
  if (!c.profile) return { look: null, pid: null };
  if (c.profile.name !== name) { c.profile.name = name; store.touch(c.profile); }
  const { color, pattern, trail, frame, title } = P.equippedLook(c.profile);
  return { look: { color, pattern, trail, frame, title }, pid: c.profile.publicId };
}

wss.on('connection', (ws, req) => {
  const fwd = TRUST_PROXY && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || req.socket.remoteAddress || '?';
  const c = { cid: nextCid++, ws, ip, room: null, msgCount: 0, alive: true, profile: null, lastLife: null, restoreTries: 0 };
  clients.set(c.cid, c);
  ws.on('pong', () => { c.alive = true; });

  send(c, { t: 'welcome', world: WORLD, tickHz: TICK_HZ, stages: STAGES, traits: TRAITS });

  ws.on('message', raw => {
    // over 120 msg/s: ignore the excess (lag bursts happen); only real flooding disconnects
    if (++c.msgCount > 1000) { ws.close(1008, 'rate'); return; }
    if (c.msgCount > 120) return;
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'join': joinRoom(c, cleanName(m.name), cleanRoom(m.room)); break;
      case 'leave': leaveRoom(c); send(c, { t: 'left' }); break;
      case 'in': case 'dash': case 'pick': {
        const e = c.room && roomWorker.get(c.room);
        if (e) queueInput(e, c.room, c.cid, { t: m.t, x: m.x, y: m.y, w: m.w, h: m.h, i: m.i });
        break;
      }
      case 'ping': send(c, { t: 'pong', ts: m.ts }); break;
      case 'hello': onHello(c, m); break;
      case 'restore': onRestore(c, m); break;
      case 'claimDaily': case 'buy': case 'equip': case 'reroll': case 'showcase': case 'release': case 'saveSpecimen': {
        if (!c.profile) { send(c, { t: 'op', op: m.t, ok: false, error: 'Profile not loaded yet.' }); break; }
        const r = profileAction(c, m);
        if (r.ok) store.touch(c.profile);
        send(c, { t: 'op', op: m.t, ...r });
        if (r.ok) sendProfile(c);
        break;
      }
    }
  });

  ws.on('close', () => {
    leaveRoom(c);
    clients.delete(c.cid);
    if (c.profile) { recentlyGone.set(c.cid, c); setTimeout(() => recentlyGone.delete(c.cid), 30000); }
  });
  ws.on('error', () => {});
});

// reset rate counters every second; heartbeat every 15s
setInterval(() => { for (const c of clients.values()) c.msgCount = 0; }, 1000);
setInterval(() => {
  for (const c of clients.values()) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false;
    try { c.ws.ping(); } catch {}
  }
}, 15000);

server.listen(PORT, HOST, () => {
  console.log(`Primordial running on http://${HOST}:${PORT} with ${WORKERS} room worker(s)`);
});

module.exports = { server, dir };
