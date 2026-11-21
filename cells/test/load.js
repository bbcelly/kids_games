'use strict';
// Load test: many headless players against a running server.
//   node test/load.js [count=1000] [ws://host:port/ws] [seconds=20] [--profiles]
// Each bot joins 'auto', steers at 20 Hz like the real client, dashes now and then,
// and measures snapshot rate and ping. Snapshots are counted, not parsed, to keep the
// generator itself cheap.
const WebSocket = require('ws');
const N = parseInt(process.argv[2] || '1000', 10);
const URL = process.argv[3] || 'ws://127.0.0.1:8080/ws';
const SECS = parseInt(process.argv[4] || '20', 10);
const PROFILES = process.argv.includes('--profiles'); // needs NEW_PROFILES_PER_IP_HOUR raised on the server
const wait = ms => new Promise(r => setTimeout(r, ms));

const bots = [];
let failed = 0, closed = 0;

function bot(i) {
  const b = { snaps: 0, rooms: null, pings: [], ws: new WebSocket(URL, { perMessageDeflate: false }) };
  b.ws.on('open', () => {
    if (PROFILES) b.ws.send(JSON.stringify({ t: 'hello' })); // creates a profile per bot
    b.ws.send(JSON.stringify({ t: 'join', name: 'Load' + i, room: 'auto' }));
    let a = Math.random() * 6.28;
    b.iv = setInterval(() => {
      a += (Math.random() - 0.5) * 0.4;
      b.ws.send(JSON.stringify({ t: 'in', x: Math.cos(a) * 400, y: Math.sin(a) * 400, w: 900, h: 600 }));
      if (Math.random() < 0.005) b.ws.send('{"t":"dash"}');
    }, 50);
    b.pv = setInterval(() => b.ws.send(JSON.stringify({ t: 'ping', ts: Date.now() })), 2000);
  });
  b.ws.on('message', raw => {
    const s = raw.toString();
    if (s.startsWith('{"t":"s"')) b.snaps++;
    else if (s.startsWith('{"t":"pong"')) b.pings.push(Date.now() - JSON.parse(s).ts);
    else if (s.startsWith('{"t":"room"')) b.room = JSON.parse(s).id;
    else if (s.startsWith('{"t":"dead"')) setTimeout(() => b.ws.readyState === 1 && b.ws.send(JSON.stringify({ t: 'join', name: 'Load' + i, room: b.room })), 1000);
  });
  b.ws.on('error', () => { failed++; });
  b.ws.on('close', () => { closed++; clearInterval(b.iv); clearInterval(b.pv); });
  return b;
}

(async () => {
  const health = URL.replace(/^ws/, 'http').replace(/\/ws$/, '/health');
  console.log(`ramping up ${N} players against ${URL} ...`);
  for (let i = 0; i < N; i++) {
    bots.push(bot(i));
    if (i % 50 === 49) await wait(250);
  }
  await wait(4000); // settle
  bots.forEach(b => { b.snaps = 0; b.pings = []; });
  const t0 = Date.now();
  await wait(SECS * 1000);
  const dt = (Date.now() - t0) / 1000;

  const rates = bots.map(b => b.snaps / dt).sort((a, b) => a - b);
  const pings = bots.flatMap(b => b.pings).sort((a, b) => a - b);
  const pct = (arr, p) => arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))] : NaN;
  const h = await (await fetch(health)).json();
  const rooms = new Set(bots.map(b => b.room).filter(Boolean));

  console.log(`connected: ${N - failed - closed}/${N} (errors ${failed}, closed ${closed}), rooms used: ${rooms.size}`);
  console.log(`snapshots/s per player: median ${pct(rates, 0.5).toFixed(1)}, p5 ${pct(rates, 0.05).toFixed(1)}, min ${rates[0].toFixed(1)} (target 15)`);
  console.log(`ping ms: median ${pct(pings, 0.5)}, p95 ${pct(pings, 0.95)}, max ${pings[pings.length - 1]}`);
  console.log('server health:', JSON.stringify(h));
  bots.forEach(b => b.ws.terminate());
  setTimeout(() => process.exit(0), 300);
})();
