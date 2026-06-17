// Headless smoke test: mock canvas/DOM, load game.js, drive all states.
const fs = require('fs');
const path = require('path');

const winListeners = {};
const canvasListeners = {};

function gradient() { return { addColorStop() {} }; }
const ctx = new Proxy({}, {
  get(t, p) {
    if (p === 'createLinearGradient' || p === 'createRadialGradient') return gradient;
    if (p === 'measureText') return () => ({ width: 10 });
    if (typeof t[p] === 'function') return t[p];
    // return a no-op function for any method, allow property get/set otherwise
    return (...a) => {};
  },
  set() { return true; },
});
const canvas = {
  width: 960, height: 540,
  getContext: () => ctx,
  addEventListener: (type, fn) => { (canvasListeners[type] = canvasListeners[type] || []).push(fn); },
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
};

global.window = {
  addEventListener: (type, fn) => { (winListeners[type] = winListeners[type] || []).push(fn); },
  AudioContext: undefined, webkitAudioContext: undefined,
};
global.document = { getElementById: () => canvas };
const store = {};
global.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
};
let rafCb = null;
global.requestAnimationFrame = cb => { rafCb = cb; };

// load game (runs IIFE, registers rafCb)
require(path.resolve(__dirname, 'game.js'));

let ts = 0;
let frameErr = null, frameCount = 0;
function step(dtMs) {
  if (!rafCb || frameErr) return;
  ts += dtMs;
  const cb = rafCb; rafCb = null;
  try { cb(ts); frameCount++; }
  catch (e) { frameErr = e; }
}
function key(k) {
  const ev = { key: k, preventDefault() {} };
  (winListeners.keydown || []).forEach(fn => fn(ev));
  step(50);
  (winListeners.keyup || []).forEach(fn => fn(ev));
}
function click(x, y) {
  const r = { clientX: x, clientY: y, preventDefault() {} };
  (canvasListeners.mousedown || []).forEach(fn => fn(r));
  (canvasListeners.mouseup || []).forEach(fn => fn(r));
  step(50);
}
function hold(k, on) {
  const ev = { key: k, preventDefault() {} };
  (winListeners[on ? 'keydown' : 'keyup'] || []).forEach(fn => fn(ev));
}

// 1) Title idle
for (let i = 0; i < 5; i++) step(50);
console.log('after title idle, frame ok:', frameCount, frameErr ? frameErr.stack : '');

// 2) Enter -> hangar
key('Enter');
// navigate + buy in each category via keyboard
for (const cat of [0, 1, 2]) {
  key('ArrowDown'); key('Enter'); // try buy
}
// click a weapon card region + launch button
click(800, 200);
// 3) launch
key(' ');
console.log('launched? running play frames...');

// 4) play many frames; occasionally move, switch weapon, force wipe
for (let i = 0; i < 4000 && !frameErr; i++) {
  if (i % 7 === 0) hold('ArrowUp', true);
  if (i % 7 === 3) { hold('ArrowUp', false); hold('ArrowDown', true); }
  if (i % 7 === 6) hold('ArrowDown', false);
  if (i === 200) key('q');
  if (i % 400 === 100) key('f');
  if (i === 500) { key('p'); key('p'); } // pause toggle
  step(50);
}
console.log('after play, frames:', frameCount, 'err:', frameErr ? frameErr.stack : 'none');

// 5) drive a few more frames + try confirm to advance any end screen
for (let i = 0; i < 30; i++) step(50);
key('Enter');
for (let i = 0; i < 30; i++) step(50);

console.log('TOTAL frames:', frameCount);
console.log(frameErr ? ('FAILED: ' + frameErr.stack) : 'ALL FRAMES OK — no runtime errors');
// inspect persisted save to confirm the run loop executed end-to-end
try { console.log('SAVE STATE:', store['beskarRun.v1'] || '(none written)'); } catch(e){}
process.exit(frameErr ? 1 : 0);
