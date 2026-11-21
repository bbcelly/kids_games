'use strict';
// End-to-end test of profiles and rewards. Starts its own server (twice, to test persistence):
//   node test/profile.net.test.js
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const WebSocket = require('ws');

const PORT = 8700 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'primordial-net-'));
const wait = ms => new Promise(r => setTimeout(r, ms));

function startServer() {
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', WORKERS: '1', DATA_DIR: DATA, REWARD_MIN_LIFE_SECS: '0', REWARD_MIN_LIFE_MASS: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return new Promise((resolve, reject) => {
    proc.stdout.on('data', d => { if (/running/.test(d)) resolve(proc); });
    proc.on('exit', c => reject(new Error('server exited ' + c)));
  });
}
function stopServer(proc) {
  return new Promise(r => { proc.removeAllListeners('exit'); proc.on('exit', r); proc.kill('SIGTERM'); });
}

class Client {
  constructor() {
    this.msgs = [];
    this.waiters = [];
    this.unclaimed = [];
    this.meta = new Map(); // name -> metadata row seen in snapshots
    this.ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    this.ws.on('message', raw => {
      const m = JSON.parse(raw);
      if (m.t === 's') { this.lastSnap = m; if (m.m) for (const x of m.m) this.meta.set(x[1], x); return; }
      this.msgs.push(m);
      const w = this.waiters.find(x => x.test(m));
      if (w) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(m); }
      else this.unclaimed.push(m); // nobody waiting yet: keep it for a later next()
    });
    this.open = new Promise(r => this.ws.on('open', r));
  }
  send(m) { this.ws.send(JSON.stringify(m)); }
  next(test, ms = 3000) {
    const pred = typeof test === 'string' ? m => m.t === test : test;
    const i = this.unclaimed.findIndex(pred);
    if (i >= 0) return Promise.resolve(this.unclaimed.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      this.waiters.push({ test: pred, resolve });
      setTimeout(() => reject(new Error('timeout waiting for ' + (typeof test === 'string' ? test : pred.toString().slice(0, 60)) + ' — got: ' + this.msgs.map(x => x.t).join(','))), ms);
    });
  }
  close() { this.ws.close(); }
}

let passed = 0;
async function test(name, fn) { await fn(); passed++; console.log('ok -', name); }

(async () => {
  let server = await startServer();
  let token, publicId, code;
  try {
    await test('hello without a token creates a profile and returns its token', async () => {
      const c = new Client(); await c.open;
      c.send({ t: 'hello' });
      const m = await c.next('profile');
      assert.match(m.token, /^[0-9a-f]{64}$/);
      assert.strictEqual(m.p.level, 1);
      assert.strictEqual(m.p.tasks.list.length, 3);
      assert.ok(m.p.daily.available);
      ({ publicId, transferCode: code } = m.p);
      token = m.token;
      c.close();
    });

    await test('hello with the token returns the same profile (and no token again)', async () => {
      const c = new Client(); await c.open;
      c.send({ t: 'hello', token });
      const m = await c.next('profile');
      assert.strictEqual(m.p.publicId, publicId);
      assert.strictEqual(m.token, undefined);
      // daily reward once
      c.send({ t: 'claimDaily' });
      const r = await c.next(x => x.t === 'op' && x.op === 'claimDaily');
      assert.ok(r.ok && r.dna === 20);
      const p = await c.next('profile');
      assert.strictEqual(p.p.dna, 20);
      c.send({ t: 'claimDaily' });
      const r2 = await c.next(x => x.t === 'op' && x.op === 'claimDaily');
      assert.ok(!r2.ok);
      // cannot buy without DNA, cannot equip what you don't own
      c.send({ t: 'buy', id: 'c_frost' });
      assert.ok(!(await c.next(x => x.t === 'op' && x.op === 'buy')).ok);
      c.send({ t: 'equip', slot: 'color', id: 'c_rainbow' });
      assert.ok(!(await c.next(x => x.t === 'op' && x.op === 'equip')).ok);
      c.close();
    });

    await test('a finished life gives a reward; spoofed cosmetics are ignored', async () => {
      const a = new Client(), b = new Client();
      await a.open; await b.open;
      a.send({ t: 'hello', token }); await a.next('profile');
      a.send({ t: 'join', name: 'Tester', room: 'auto', look: { color: 'c_rainbow' } });
      const room = (await a.next('room')).id;
      b.send({ t: 'join', name: 'Watcher', room });
      await wait(1200);
      // b sees a's profile id and default (not spoofed) cosmetics in the metadata
      const iv = setInterval(() => { // watcher swims towards Tester so they are surely in view
        const pa = a.lastSnap && a.lastSnap.y, pb = b.lastSnap && b.lastSnap.y;
        const dx = pa && pb ? pa.x - pb.x : 0, dy = pa && pb ? pa.y - pb.y : 0;
        b.send({ t: 'in', x: dx, y: dy, w: 2600, h: 2600 });
        a.send({ t: 'in', x: 0, y: 0, w: 2600, h: 2600 });
      }, 50);
      for (let i = 0; i < 200 && !b.meta.has('Tester'); i++) await wait(100);
      clearInterval(iv);
      const metaB = b.meta.get('Tester');
      assert.ok(metaB, 'watcher received Tester metadata; a at ' + JSON.stringify(a.lastSnap && a.lastSnap.y && [a.lastSnap.y.x, a.lastSnap.y.y]) + ' b at ' + JSON.stringify(b.lastSnap && b.lastSnap.y && [b.lastSnap.y.x, b.lastSnap.y.y]) + ' b sees ' + [...b.meta.keys()].join('/'));
      assert.strictEqual(metaB[5], publicId);
      assert.deepStrictEqual(metaB[4], ['c_auto', 'p_none', 't_none', 'f_none', 'ti_none']);
      a.send({ t: 'leave' }); // ending the life by leaving still counts
      const rw = await a.next('reward');
      assert.ok(rw.s.counted && rw.s.xp > 0, 'xp ' + rw.s.xp);
      const p = await a.next('profile');
      assert.strictEqual(p.p.life.games, 1);
      assert.ok(p.p.entries.stage_0);
      a.close(); b.close();
    });

    await test('public profile endpoint hides the secret token and transfer code', async () => {
      const res = await fetch(`${BASE}/api/profile/${publicId}`);
      const txt = await res.text();
      const pub = JSON.parse(txt);
      assert.strictEqual(pub.publicId, publicId);
      assert.strictEqual(pub.name, 'Tester');
      assert.ok(!txt.includes(token) && !txt.includes(code));
      assert.strictEqual((await fetch(`${BASE}/api/profile/nope`)).status, 404);
    });

    await test('profiles survive a server restart', async () => {
      await stopServer(server);
      server = await startServer();
      const c = new Client(); await c.open;
      c.send({ t: 'hello', token });
      const m = await c.next('profile');
      assert.strictEqual(m.p.publicId, publicId);
      assert.strictEqual(m.p.life.games, 1);
      assert.strictEqual(m.p.dna >= 20, true);
      c.close();
    });

    await test('transfer code restores the profile on another device', async () => {
      const c = new Client(); await c.open;
      c.send({ t: 'restore', code: code.toLowerCase() });
      const op = await c.next(x => x.t === 'op' && x.op === 'restore');
      assert.ok(op.ok);
      const m = await c.next('profile');
      assert.strictEqual(m.p.publicId, publicId);
      assert.strictEqual(m.token, token);
      c.send({ t: 'restore', code: 'XXXX-XXXX-XXXX' });
      assert.ok(!(await c.next(x => x.t === 'op' && x.op === 'restore')).ok);
      c.close();
    });
    console.log(`\n${passed} tests passed`);
  } catch (e) {
    console.error('FAIL:', e.stack || e.message);
    process.exitCode = 1;
  } finally {
    await stopServer(server);
    fs.rmSync(DATA, { recursive: true, force: true });
  }
})();
