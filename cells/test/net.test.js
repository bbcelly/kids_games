'use strict';
// End-to-end multi-room test. Starts its own server with tiny room caps:
//   node test/net.test.js
const { spawn } = require('child_process');
const path = require('path');
const assert = require('assert');
const WebSocket = require('ws');

const PORT = 8190 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const wait = ms => new Promise(r => setTimeout(r, ms));

function startServer() {
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', ROOM_SOFT_CAP: '3', ROOM_HARD_CAP: '4', WORKERS: '2' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    proc.stdout.on('data', d => { if (/running/.test(d)) resolve(proc); });
    proc.on('exit', c => reject(new Error('server exited ' + c)));
  });
}

class Client {
  constructor(name) {
    this.name = name;
    this.room = null; this.id = null; this.snaps = 0; this.seen = new Set(); this.notes = [];
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    this.ws.on('message', raw => {
      const m = JSON.parse(raw);
      if (m.t === 'room') { this.room = m.id; this.roomName = m.name; if (m.note) this.notes.push(m.note); this.seen.clear(); this.snaps = 0; }
      if (m.t === 'spawned') this.id = m.id;
      if (m.t === 's') { this.snaps++; if (m.m) for (const x of m.m) this.seen.add(x[1]); } // names of organisms in view
    });
    this.iv = setInterval(() => {
      if (this.ws.readyState === 1) this.ws.send(JSON.stringify({ t: 'in', x: 100, y: 50, w: 2600, h: 2600 }));
    }, 50);
    this.open = new Promise(r => this.ws.on('open', r));
  }
  join(room) { this.ws.send(JSON.stringify({ t: 'join', name: this.name, room })); }
  close() { clearInterval(this.iv); this.ws.close(); }
}

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('ok -', name); }

(async () => {
  const server = await startServer();
  const clients = [];
  try {
    await test('8 auto-joining players spread over rooms of max 3', async () => {
      for (let i = 0; i < 8; i++) {
        const c = new Client('P' + i); clients.push(c);
        await c.open; c.join('auto'); await wait(60); // sequential so assignment is deterministic
      }
      await wait(1500);
      const byRoom = {};
      for (const c of clients) {
        assert.ok(c.room && c.id, `${c.name} joined`);
        assert.ok(c.snaps > 10, `${c.name} gets snapshots (${c.snaps})`);
        (byRoom[c.room] = byRoom[c.room] || []).push(c);
      }
      const sizes = Object.values(byRoom).map(a => a.length).sort();
      assert.deepStrictEqual(sizes, [2, 3, 3]);
    });

    await test('players only see organisms from their own room', async () => {
      for (const c of clients) {
        for (const other of clients) {
          if (other.room !== c.room) assert.ok(!c.seen.has(other.name), `${c.name} must not see ${other.name}`);
        }
      }
      // with a 2600 view radius, roommates are normally visible to each other
      const a = clients[0], mates = clients.filter(c => c !== a && c.room === a.room);
      assert.ok(mates.some(m => a.seen.has(m.name)), 'sees at least one roommate');
    });

    await test('/rooms reports every room and player', async () => {
      const data = await (await fetch(`${BASE}/rooms`)).json();
      assert.strictEqual(data.players, 8);
      assert.strictEqual(data.rooms.length, 3);
      assert.ok(data.rooms.every(r => r.cap === 4 && r.name));
    });

    await test('invite link joins a soft-full room up to the hard cap', async () => {
      const full = clients[0].room; // has 3
      const friend = new Client('Friend'); clients.push(friend);
      await friend.open; friend.join(full); await wait(300);
      assert.strictEqual(friend.room, full);
      const late = new Client('Late'); clients.push(late);
      await late.open; late.join(full); await wait(300);
      assert.notStrictEqual(late.room, full, 'hard cap respected');
      assert.ok(late.notes.some(n => /full/.test(n)));
    });

    await test('"new" opens a private room and leaving frees the slot', async () => {
      const c = clients[1], before = c.room;
      const prev = (await (await fetch(`${BASE}/rooms`)).json()).rooms.find(r => r.id === before).players;
      c.join('new'); await wait(400);
      assert.notStrictEqual(c.room, before);
      const data = await (await fetch(`${BASE}/rooms`)).json();
      const mine = data.rooms.find(r => r.id === c.room);
      assert.strictEqual(mine.players, 1);
      assert.strictEqual(data.rooms.find(r => r.id === before).players, prev - 1);
    });

    await test('disconnects are accounted for; server survives garbage input', async () => {
      clients[2].ws.send('garbage'); clients[2].ws.send(JSON.stringify({ t: 'join', room: '../../etc', name: 'x'.repeat(500) }));
      await wait(200);
      for (const c of clients) c.close();
      await wait(500);
      const h = await (await fetch(`${BASE}/health`)).json();
      assert.strictEqual(h.ok, true);
      assert.strictEqual(h.players, 0);
      assert.strictEqual(h.connections, 0);
      console.log('   health:', JSON.stringify(h));
    });
    console.log(`\n${passed} tests passed`);
  } catch (e) {
    console.error('FAIL:', e.message);
    process.exitCode = 1;
  } finally {
    clients.forEach(c => { try { c.close(); } catch {} });
    server.kill();
  }
})();
