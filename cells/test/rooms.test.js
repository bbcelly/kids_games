'use strict';
// Tests for the pure room directory: node test/rooms.test.js
const assert = require('assert');
const { RoomDirectory } = require('../server/rooms');

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }

function dirWith(opts = {}) {
  let t = 0;
  const d = new RoomDirectory({ softCap: 3, hardCap: 4, maxRooms: 5, idleMs: 1000, now: () => t, ...opts });
  d.advance = ms => { t += ms; };
  return d;
}
function joinN(d, req, n) {
  const got = [];
  for (let i = 0; i < n; i++) { const { room } = d.pick(req); d.joined(room.id); got.push(room.id); }
  return got;
}

test('auto creates the first room and fills it to the soft cap', () => {
  const d = dirWith();
  const ids = joinN(d, 'auto', 3);
  assert.strictEqual(new Set(ids).size, 1);
  assert.strictEqual(d.rooms.size, 1);
});

test('auto overflows into a new room past the soft cap', () => {
  const d = dirWith();
  const ids = joinN(d, 'auto', 7);
  assert.strictEqual(new Set(ids).size, 3);
  assert.deepStrictEqual(d.list().map(r => r.players), [3, 3, 1]);
});

test('auto prefers the fullest room that still has space', () => {
  const d = dirWith();
  joinN(d, 'auto', 4);                 // room A=3, room B=1
  const [a, b] = [...d.rooms.values()];
  d.left(a.id); d.left(a.id);          // A=1, B=1 -> tie: oldest wins
  assert.strictEqual(d.pick('auto').room.id, a.id);
  d.joined(b.id);                      // B=2 now fullest
  assert.strictEqual(d.pick('auto').room.id, b.id);
});

test('invite link joins that room up to the hard cap, then falls back', () => {
  const d = dirWith();
  const [id] = joinN(d, 'auto', 3);
  const r = d.pick(id);
  assert.strictEqual(r.room.id, id); // 4th player via link is allowed (hard cap 4)
  d.joined(id);
  const r2 = d.pick(id);
  assert.notStrictEqual(r2.room.id, id);
  assert.ok(/full/.test(r2.note));
});

test('unknown room id falls back to auto with a note', () => {
  const d = dirWith();
  const r = d.pick('zzzz');
  assert.ok(r.room);
  assert.ok(/no longer exists/.test(r.note));
});

test('"new" always opens a fresh room until maxRooms', () => {
  const d = dirWith();
  const ids = joinN(d, 'new', 5);
  assert.strictEqual(new Set(ids).size, 5);
  const r = d.pick('new');
  assert.ok(r.room && !r.created && /Too many/.test(r.note));
});

test('game full when every room is at hard cap and no more rooms allowed', () => {
  const d = dirWith({ maxRooms: 2 });
  joinN(d, 'auto', 6); // two rooms at soft cap
  for (const r of d.rooms.values()) d.joined(r.id); // both at hard cap 4
  const r = d.pick('auto');
  assert.strictEqual(r.room, null);
  assert.ok(/full/.test(r.note));
});

test('idle empty rooms are swept, but the oldest room is kept', () => {
  const d = dirWith();
  const ids = joinN(d, 'new', 3);
  ids.forEach(id => d.left(id));
  d.advance(500);
  assert.strictEqual(d.sweep().length, 0);
  d.advance(600);
  const closed = d.sweep();
  assert.strictEqual(closed.length, 2);
  assert.ok(d.rooms.has(ids[0]));
});

test('room names and ids are unique', () => {
  const d = dirWith({ maxRooms: 40 });
  for (let i = 0; i < 40; i++) d.create();
  const names = [...d.rooms.values()].map(r => r.name);
  assert.strictEqual(new Set(names).size, 40);
  assert.ok(names.includes('Tide Pool 2'));
});

console.log(`\n${passed} tests passed`);
