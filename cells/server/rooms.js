'use strict';
// Pure room bookkeeping: which rooms exist, how full they are, where a new player goes.
// No threads or sockets here, so it is easy to test.

const ROOM_NAMES = [
  'Tide Pool', 'Deep Vent', 'Lagoon', 'Kelp Forest', 'Coral Shelf', 'Hot Spring',
  'Brine Pool', 'Mangrove', 'Estuary', 'Reef', 'Abyss', 'Mud Flat',
];

class RoomDirectory {
  constructor(opts = {}) {
    this.softCap = opts.softCap || 50;   // auto-join fills rooms up to this
    this.hardCap = opts.hardCap || 60;   // invite links may go up to this
    this.maxRooms = opts.maxRooms || 60;
    this.idleMs = opts.idleMs != null ? opts.idleMs : 5 * 60 * 1000;
    this.now = opts.now || Date.now;
    this.rand = opts.rand || Math.random;
    this.rooms = new Map(); // id -> {id, name, humans, emptySince, createdAt, seq}
    this.seq = 0;
  }

  newId() {
    let id;
    do { id = Math.floor(this.rand() * 36 ** 4).toString(36).padStart(4, '0'); } while (this.rooms.has(id));
    return id;
  }

  newName() {
    const used = new Set([...this.rooms.values()].map(r => r.name));
    for (let round = 1; ; round++) {
      for (const base of ROOM_NAMES) {
        const name = round === 1 ? base : `${base} ${round}`;
        if (!used.has(name)) return name;
      }
    }
  }

  create() {
    if (this.rooms.size >= this.maxRooms) return null;
    const r = { id: this.newId(), name: this.newName(), humans: 0, emptySince: this.now(), createdAt: this.now(), seq: this.seq++ };
    this.rooms.set(r.id, r);
    return r;
  }

  get(id) { return this.rooms.get(id); }

  // Fullest room that still has auto-join space.
  autoRoom() {
    let best = null;
    for (const r of this.rooms.values()) {
      if (r.humans >= this.softCap) continue;
      if (!best || r.humans > best.humans || (r.humans === best.humans && r.seq < best.seq)) best = r;
    }
    return best;
  }

  // requested: room id, 'auto' or 'new'.
  // Returns {room, created, note} — room is null only if every room is full and none can be made.
  pick(requested) {
    let note = null;
    if (requested && requested !== 'auto' && requested !== 'new') {
      const r = this.rooms.get(requested);
      if (r && r.humans < this.hardCap) return { room: r, created: false, note: null };
      note = r ? 'That room is full — you were placed in another one.' : 'That room no longer exists — you were placed in another one.';
    }
    if (requested === 'new') {
      const r = this.create();
      if (r) return { room: r, created: true, note: null };
      note = 'Too many rooms right now — you were placed in an existing one.';
    }
    const auto = this.autoRoom();
    if (auto) return { room: auto, created: false, note };
    const r = this.create();
    if (r) return { room: r, created: true, note };
    // everything is at soft cap and no new rooms allowed: squeeze into any room under hard cap
    for (const room of this.rooms.values()) if (room.humans < this.hardCap) return { room, created: false, note };
    return { room: null, created: false, note: 'The game is full. Try again in a minute.' };
  }

  joined(id) {
    const r = this.rooms.get(id);
    if (r) { r.humans++; r.emptySince = null; }
  }

  left(id) {
    const r = this.rooms.get(id);
    if (r) { r.humans = Math.max(0, r.humans - 1); if (r.humans === 0) r.emptySince = this.now(); }
  }

  remove(id) { this.rooms.delete(id); }

  // Rooms that have been empty longer than idleMs. The oldest room always survives.
  sweep() {
    const now = this.now();
    const keep = [...this.rooms.values()].sort((a, b) => a.seq - b.seq)[0];
    const closed = [];
    for (const r of this.rooms.values()) {
      if (r === keep || r.humans > 0 || r.emptySince == null) continue;
      if (now - r.emptySince >= this.idleMs) closed.push(r);
    }
    for (const r of closed) this.rooms.delete(r.id);
    return closed;
  }

  list() {
    return [...this.rooms.values()].sort((a, b) => b.humans - a.humans || a.seq - b.seq)
      .map(r => ({ id: r.id, name: r.name, players: r.humans, cap: this.hardCap }));
  }

  totalHumans() {
    let n = 0;
    for (const r of this.rooms.values()) n += r.humans;
    return n;
  }
}

module.exports = { RoomDirectory, ROOM_NAMES };
