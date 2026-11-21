'use strict';
// Runs in a worker_thread. Hosts several rooms and steps them all at TICK_HZ.
// Messages from main:  {t:'create',room,name} {t:'close',room}
//                      {t:'join',room,cid,name} {t:'msg',room,cid,m} {t:'leave',room,cid}
//                      {t:'inputs', list:[[room,cid,m],...]}  (batched player input)
// Messages to main:    {t:'batch', out:[[cid,str,roomId],...], bc:[[roomId,str],...], sess:[[cid,roomId,life],...]}
//                      {t:'stats', rooms:{id:{humans,bots,tickMs}}}
const { parentPort, workerData } = require('worker_threads');
const { Room } = require('./room');
const { TICK_HZ } = require('./game');

const botTarget = workerData && workerData.botTarget != null ? workerData.botTarget : undefined;
const rooms = new Map();
let out = [], bc = [], sess = [];

function makeRoom(id, name) {
  return new Room(id, name, {
    send: (cid, str) => out.push([cid, str, id]),
    broadcast: str => bc.push([id, str]),
    session: (cid, life) => sess.push([cid, id, life]),
  }, { game: botTarget != null ? { botTarget } : {} });
}

parentPort.on('message', m => {
  switch (m.t) {
    case 'create': if (!rooms.has(m.room)) rooms.set(m.room, makeRoom(m.room, m.name)); break;
    case 'close': rooms.delete(m.room); break;
    case 'join': { const r = rooms.get(m.room); if (r) r.join(m.cid, m.name, m.look, m.pid); break; }
    case 'msg': { const r = rooms.get(m.room); if (r) r.input(m.cid, m.m); break; }
    case 'inputs':
      for (const [room, cid, msg] of m.list) { const r = rooms.get(room); if (r) r.input(cid, msg); }
      break;
    case 'leave': { const r = rooms.get(m.room); if (r) r.leave(m.cid); break; }
  }
  flush();
});

function flush() {
  if (out.length || bc.length || sess.length) {
    parentPort.postMessage({ t: 'batch', out, bc, sess });
    out = []; bc = []; sess = [];
  }
}

const STEP_MS = 1000 / TICK_HZ;
let last = Date.now(), acc = 0, busyMs = 0, ticks = 0;

function loop() {
  const now = Date.now();
  acc += now - last;
  last = now;
  if (acc > 250) acc = 250; // don't spiral after a stall
  while (acc >= STEP_MS) {
    const t0 = performance.now();
    for (const r of rooms.values()) r.step();
    busyMs += performance.now() - t0;
    ticks++;
    acc -= STEP_MS;
    flush();
  }
  setTimeout(loop, Math.max(1, STEP_MS - acc));
}
loop();

setInterval(() => {
  const s = {};
  for (const r of rooms.values()) s[r.id] = { humans: r.humans, bots: r.bots };
  parentPort.postMessage({ t: 'stats', rooms: s, tickMs: ticks ? busyMs / ticks : 0 });
  busyMs = 0; ticks = 0;
}, 1000);
