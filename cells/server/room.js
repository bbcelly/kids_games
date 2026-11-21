'use strict';
// One game room: a Game simulation plus the per-client snapshot logic.
// It never touches sockets; it emits ready-made JSON strings through `out`:
//   out.send(cid, str)      -> one client
//   out.broadcast(str)      -> every client in this room
//   out.session(cid, life)  -> a player's life ended (for rewards; handled by the main thread)
//   out.snap(cid, life)     -> summary of a living creature the player wants to save to the lab
const { Game, WORLD, TICK_HZ, packTraits } = require('./game');
const CATALOG = require('../public/catalog');

class Room {
  constructor(id, name, out, opts = {}) {
    this.id = id;
    this.name = name;
    this.out = out;
    this.game = new Game(opts.game || {});
    this.clients = new Map(); // cid -> {cid, org, knownMeta}
  }

  get humans() { return this.clients.size; }
  get bots() { return this.game.orgs.size - this.clients.size; }

  send(c, msg) { this.out.send(c.cid, JSON.stringify(msg)); }
  broadcast(msg) { this.out.broadcast(JSON.stringify(msg)); }

  // look: validated cosmetics {color, pattern, trail, frame, title} or null; pid: public profile id
  join(cid, name, look, pid) {
    let c = this.clients.get(cid);
    if (!c) {
      c = { cid, org: null, knownMeta: new Set() };
      this.clients.set(cid, c);
    }
    if (c.org && c.org.alive) return;
    if (!c.org) {
      c.org = this.game.addOrganism(name, false);
    } else {
      c.org.name = name;
      this.game.respawn(c.org);
    }
    c.org.pid = pid || null;
    c.org.cos = look ? [look.color, look.pattern, look.trail, look.frame, look.title] : null;
    const col = look && CATALOG.ITEM[look.color];
    if (col && col.hue != null) c.org.hue = col.hue;
    // name may have changed: make everyone (including us) refetch it
    for (const other of this.clients.values()) other.knownMeta.delete(c.org.id);
    this.send(c, { t: 'spawned', id: c.org.id });
  }

  input(cid, m) {
    const c = this.clients.get(cid);
    if (!c || !c.org) return;
    switch (m.t) {
      case 'in':
        this.game.setInput(c.org, +m.x, +m.y);
        this.game.setView(c.org, +m.w, +m.h);
        break;
      case 'dash': this.game.dash(c.org); break;
      case 'pick': this.game.pickTrait(c.org, m.i | 0); break;
      case 'snap': // save the living creature to the lab without ending the life
        if (c.org.alive && this.out.snap) this.out.snap(cid, this.game.lifeSummary(c.org));
        break;
    }
  }

  leave(cid) {
    const c = this.clients.get(cid);
    if (!c) return;
    this.clients.delete(cid);
    if (c.org && c.org.alive) this.out.session(cid, this.game.lifeSummary(c.org));
    if (c.org) {
      this.game.removeOrganism(c.org.id);
      this.broadcast({ t: 'gone', id: c.org.id });
    }
  }

  step() {
    const game = this.game;
    game.step();

    for (const ev of game.events) {
      if (ev.t === 'kill') {
        this.broadcast({ t: 'kill', a: ev.eaterName, b: ev.preyName, ai: ev.eater, bi: ev.prey });
        for (const c of this.clients.values()) {
          if (c.org && c.org.id === ev.prey) {
            const o = c.org;
            this.out.session(c.cid, game.lifeSummary(o));
            this.send(c, {
              t: 'dead', by: ev.eaterName, mass: Math.round(o.maxMass), kills: o.kills,
              stage: o.maxStage, secs: Math.round((game.tick - o.bornAt) / TICK_HZ),
            });
          }
        }
      } else if (ev.t === 'gone') {
        this.broadcast({ t: 'gone', id: ev.id });
      } else if (ev.t === 'evolve') {
        for (const c of this.clients.values()) if (c.org && c.org.id === ev.id) this.send(c, { t: 'evolve', stage: ev.stage });
      }
    }
    game.events.length = 0;

    if (game.tick % 2 === 0) {
      const withFood = game.tick % 6 === 0;
      for (const c of this.clients.values()) this.out.send(c.cid, JSON.stringify(this.snapshotFor(c, withFood)));
    }
    if (game.tick % TICK_HZ === 0) {
      this.broadcast({ t: 'lb', l: game.leaderboard(10), n: this.humans, b: this.bots });
    }
  }

  snapshotFor(c, withFood) {
    const game = this.game;
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
        meta.push([org.id, org.name, org.hue, org.isBot ? 1 : 0, org.cos || 0, org.pid || 0]);
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
}

module.exports = { Room };
