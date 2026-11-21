'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Game, WORLD, TICK_HZ, STAGES, TRAITS, packTraits } = require('./game');

const PORT = parseInt(process.env.PORT || '8080', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_CLIENTS = parseInt(process.env.MAX_CLIENTS || '150', 10);
const PUBLIC = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, players: clients.size, tick: game.tick }));
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

const game = new Game();
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
const clients = new Set();

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
function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of clients) if (c.ws.readyState === 1) c.ws.send(s);
}
function cleanName(n) {
  n = String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16);
  return n || 'Cell ' + ((Math.random() * 900 + 100) | 0);
}

wss.on('connection', ws => {
  const c = { ws, org: null, knownMeta: new Set(), msgCount: 0, alive: true };
  clients.add(c);
  ws.on('pong', () => { c.alive = true; });

  send(c, {
    t: 'welcome', world: WORLD, tickHz: TICK_HZ,
    stages: STAGES, traits: TRAITS,
  });

  ws.on('message', raw => {
    if (++c.msgCount > 120) { ws.close(1008, 'rate'); return; }
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    switch (m.t) {
      case 'join': {
        if (c.org && c.org.alive) return;
        if (!c.org) {
          c.org = game.addOrganism(cleanName(m.name), false);
        } else {
          c.org.name = cleanName(m.name);
          game.respawn(c.org);
          c.knownMeta.delete(c.org.id); // name may have changed
        }
        send(c, { t: 'spawned', id: c.org.id });
        break;
      }
      case 'in':
        if (c.org) {
          game.setInput(c.org, +m.x, +m.y);
          game.setView(c.org, +m.w, +m.h);
        }
        break;
      case 'dash': if (c.org) game.dash(c.org); break;
      case 'pick': if (c.org) game.pickTrait(c.org, m.i | 0); break;
      case 'ping': send(c, { t: 'pong', ts: m.ts }); break;
    }
  });

  ws.on('close', () => {
    clients.delete(c);
    if (c.org) {
      game.removeOrganism(c.org.id);
      broadcast({ t: 'gone', id: c.org.id });
    }
  });
  ws.on('error', () => {});
});

// reset rate counters every second; heartbeat every 15s
setInterval(() => { for (const c of clients) c.msgCount = 0; }, 1000);
setInterval(() => {
  for (const c of clients) {
    if (!c.alive) { c.ws.terminate(); continue; }
    c.alive = false;
    try { c.ws.ping(); } catch {}
  }
}, 15000);

function snapshotFor(c, withFood) {
  const me = c.org;
  // centre of view: own organism, or where you died
  const cx = me ? me.x : WORLD / 2, cy = me ? me.y : WORLD / 2;
  const hw = (me ? me.view.hw : 1200) + 250, hh = (me ? me.view.hh : 900) + 250;
  const o = [];
  const meta = [];
  for (const org of game.orgs.values()) {
    if (!org.alive) continue;
    if (Math.abs(org.x - cx) > hw + org.r || Math.abs(org.y - cy) > hh + org.r) continue;
    o.push([
      org.id, Math.round(org.x), Math.round(org.y), Math.round(org.r * 10) / 10,
      org.stage, Math.round(org.angle * 100), packTraits(org.traits),
      (org.dashT > 0 ? 1 : 0) | (org.poisonT > 0 ? 2 : 0) | (game.shielded(org) ? 4 : 0),
    ]);
    if (!c.knownMeta.has(org.id)) {
      c.knownMeta.add(org.id);
      meta.push([org.id, org.name, org.hue, org.isBot ? 1 : 0]);
    }
  }
  const msg = { t: 's', k: game.tick, o };
  if (meta.length) msg.m = meta;
  if (me) {
    msg.y = {
      a: me.alive ? 1 : 0, x: Math.round(me.x), y: Math.round(me.y),
      ms: Math.round(me.mass * 10) / 10, st: me.stage,
      cd: Math.round(me.dashCd * 10) / 10, tr: packTraits(me.traits),
      ch: me.pendingChoices[0] || null, nc: me.pendingChoices.length, k: me.kills,
    };
  }
  if (withFood) {
    const f = game.foodInRect(cx - hw, cy - hh, cx + hw, cy + hh);
    const arr = new Array(f.length * 3);
    for (let i = 0; i < f.length; i++) {
      arr[i * 3] = Math.round(f[i].x);
      arr[i * 3 + 1] = Math.round(f[i].y);
      arr[i * 3 + 2] = f[i].c + (f[i].m > 1 ? 10 : 0);
    }
    msg.f = arr;
  }
  return msg;
}

let lastTime = Date.now();
let acc = 0;
const STEP_MS = 1000 / TICK_HZ;

function loop() {
  const now = Date.now();
  acc += now - lastTime;
  lastTime = now;
  if (acc > 250) acc = 250; // don't spiral after a stall
  while (acc >= STEP_MS) {
    game.step();
    acc -= STEP_MS;

    for (const ev of game.events) {
      if (ev.t === 'kill') {
        broadcast({ t: 'kill', a: ev.eaterName, b: ev.preyName, ai: ev.eater, bi: ev.prey });
        for (const c of clients) {
          if (c.org && c.org.id === ev.prey) {
            const o = c.org;
            send(c, {
              t: 'dead', by: ev.eaterName, mass: Math.round(o.maxMass), kills: o.kills,
              stage: o.maxStage, secs: Math.round((game.tick - o.bornAt) / TICK_HZ),
            });
          }
        }
      } else if (ev.t === 'gone') {
        broadcast({ t: 'gone', id: ev.id });
      } else if (ev.t === 'evolve') {
        for (const c of clients) if (c.org && c.org.id === ev.id) send(c, { t: 'evolve', stage: ev.stage });
      }
    }
    game.events.length = 0;

    if (game.tick % 2 === 0) {
      const withFood = game.tick % 6 === 0;
      for (const c of clients) send(c, snapshotFor(c, withFood));
    }
    if (game.tick % TICK_HZ === 0) {
      let humans = 0;
      for (const c of clients) if (c.org) humans++;
      broadcast({ t: 'lb', l: game.leaderboard(10), n: humans, b: game.orgs.size - humans });
    }
  }
  setTimeout(loop, Math.max(1, STEP_MS - acc));
}
loop();

server.listen(PORT, HOST, () => {
  console.log(`Primordial running on http://${HOST}:${PORT}`);
});

module.exports = { server, game };
