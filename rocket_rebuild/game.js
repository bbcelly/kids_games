/* ============================================================================
   BESKAR RUN — This is the Way
   A kids' side-scrolling pixel-art rocket shooter. Single-file, no assets.
   ========================================================================== */
(() => {
'use strict';

// ============================================================================
//  CORE / CANVAS
// ============================================================================
const VW = 960, VH = 540;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const rand  = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const choice = arr => arr[(Math.random() * arr.length) | 0];
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx*dx + dy*dy; };
const TAU = Math.PI * 2;

// ============================================================================
//  AUDIO  (tiny WebAudio blip engine — no files)
// ============================================================================
const Audio2 = (() => {
  let actx = null;
  function ensure() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (actx && actx.state === 'suspended') actx.resume();
    return actx;
  }
  function blip(freq, dur, type, vol, slideTo) {
    if (SAVE.muted) return;
    const a = ensure(); if (!a) return;
    const t = a.currentTime;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol) {
    if (SAVE.muted) return;
    const a = ensure(); if (!a) return;
    const n = a.sampleRate * dur | 0;
    const buf = a.createBuffer(1, n, a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(), g = a.createGain(), f = a.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 1200;
    g.gain.value = vol || 0.18;
    src.buffer = buf; src.connect(f); f.connect(g); g.connect(a.destination);
    src.start();
  }
  return {
    resume: ensure,
    shoot:   () => blip(880, 0.06, 'square', 0.05, 520),
    laser:   () => blip(1200, 0.12, 'sawtooth', 0.05, 700),
    missile: () => blip(300, 0.18, 'triangle', 0.06, 600),
    hit:     () => blip(180, 0.08, 'square', 0.08, 90),
    explode: () => { noise(0.32, 0.22); blip(140, 0.3, 'triangle', 0.08, 50); },
    bigboom: () => { noise(0.7, 0.32); blip(90, 0.7, 'sawtooth', 0.12, 40); },
    coin:    () => blip(1320, 0.07, 'square', 0.06, 1760),
    coinbig: () => { blip(1320, 0.08, 'square', 0.07, 1760); setTimeout(()=>blip(1980,0.08,'square',0.06,2300), 60); },
    hurt:    () => blip(220, 0.2, 'sawtooth', 0.12, 70),
    force:   () => { blip(420, 0.5, 'sine', 0.14, 1400); noise(0.4, 0.1); },
    powerup: () => { blip(660,0.09,'square',0.08,990); setTimeout(()=>blip(990,0.12,'square',0.08,1320),80); },
    deny:    () => blip(160, 0.12, 'square', 0.08, 120),
    select:  () => blip(740, 0.04, 'square', 0.05),
    levelup: () => { [523,659,784,1046].forEach((f,i)=>setTimeout(()=>blip(f,0.18,'triangle',0.1),i*110)); },
    gameover:() => { [392,330,262,196].forEach((f,i)=>setTimeout(()=>blip(f,0.3,'sawtooth',0.1),i*160)); },
  };
})();

// ============================================================================
//  INPUT  (keyboard + mouse + multi-touch with on-screen buttons)
// ============================================================================
const down = new Set();      // keys currently held
const pressed = new Set();   // keys pressed this frame (consumed by logic)
const mouse = { x: 0, y: 0, clicked: false, downNow: false };
const touch = { active: false, x: 0, y: 0 };  // the current "fly" drag, if any

const IS_TOUCH = (typeof window !== 'undefined' && 'ontouchstart' in window) ||
                 (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);

// On-screen buttons for the active state. Rebuilt every frame by the draw code
// (see buildTouchButtons). Each: { x, y, r, key } in canvas coords; tapping one
// injects `key` into `pressed`, exactly like the matching keystroke.
let touchButtons = [];
function hitButton(cx, cy) {
  for (const b of touchButtons) {
    const dx = cx - b.x, dy = cy - b.y;
    if (dx * dx + dy * dy <= b.r * b.r) return b;
  }
  return null;
}

const MOVE_KEYS = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','a','d','w','s'];

window.addEventListener('keydown', e => {
  let k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (MOVE_KEYS.includes(k) || ['q','f','p','m',' ','Enter','l','Escape'].includes(k)) e.preventDefault();
  if (!down.has(k)) pressed.add(k);
  down.add(k);
  Audio2.resume();
});
window.addEventListener('keyup', e => {
  let k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  down.delete(k);
});
function toCanvas(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  return { x: (clientX - r.left) * (VW / r.width), y: (clientY - r.top) * (VH / r.height) };
}
function mapMouse(e) { const p = toCanvas(e.clientX, e.clientY); mouse.x = p.x; mouse.y = p.y; }
canvas.addEventListener('mousemove', mapMouse);
canvas.addEventListener('mousedown', e => { mapMouse(e); mouse.downNow = true; Audio2.resume(); });
canvas.addEventListener('mouseup', e => { mapMouse(e); if (mouse.downNow) mouse.clicked = true; mouse.downNow = false; });

// ---- multi-touch ---------------------------------------------------------
// Each touch is either a "fly" drag (moves the ship / acts as a menu click) or
// a "button" press. Tracking them by identifier lets a player hold a button
// with one thumb while flying with the other.
const activeTouches = new Map(); // id -> { x, y, btn }
let moveId = null;               // identifier of the active fly-drag, or null

canvas.addEventListener('touchstart', e => {
  e.preventDefault(); Audio2.resume();
  for (const t of e.changedTouches) {
    const p = toCanvas(t.clientX, t.clientY);
    const b = hitButton(p.x, p.y);
    if (b) {
      activeTouches.set(t.identifier, { x: p.x, y: p.y, btn: b.key });
      pressed.add(b.key);
      Audio2.select();
    } else {
      activeTouches.set(t.identifier, { x: p.x, y: p.y, btn: null });
      moveId = t.identifier;
      touch.active = true; touch.x = p.x; touch.y = p.y;
      mouse.x = p.x; mouse.y = p.y; mouse.downNow = true;
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const a = activeTouches.get(t.identifier); if (!a) continue;
    const p = toCanvas(t.clientX, t.clientY); a.x = p.x; a.y = p.y;
    if (t.identifier === moveId) { touch.x = p.x; touch.y = p.y; mouse.x = p.x; mouse.y = p.y; }
  }
}, { passive: false });

function endTouch(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const a = activeTouches.get(t.identifier); if (!a) continue;
    activeTouches.delete(t.identifier);
    if (t.identifier === moveId) {
      if (mouse.downNow) mouse.clicked = true;  // a fly-touch release counts as a tap/confirm
      mouse.downNow = false;
      moveId = null; touch.active = false;
      // hand the fly-drag over to another non-button finger that's still down
      for (const [id, o] of activeTouches) {
        if (!o.btn) { moveId = id; touch.active = true; touch.x = o.x; touch.y = o.y; break; }
      }
    }
  }
}
canvas.addEventListener('touchend', endTouch, { passive: false });
canvas.addEventListener('touchcancel', endTouch, { passive: false });

function consumePress(k) { if (pressed.has(k)) { pressed.delete(k); return true; } return false; }
function anyConfirm() {
  return consumePress('Enter') || consumePress(' ') || mouse.clicked;
}

// ============================================================================
//  SAVE / PERSISTENCE
// ============================================================================
const SAVE_KEY = 'beskarRun.v1';
function defaultSave() {
  return {
    vault: 0,
    owned: { blaster: true },
    equipped: 'blaster',
    upgrades: { fireRate: 0, armor: 0, thrusters: 0 },
    gifts: { magnet: 0, wipe: 0, mend: 0, frog: 0, bond: 0 },
    progress: { level: 0, loop: 0, bestScore: 0 },
    muted: false,
  };
}
let SAVE = defaultSave();
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      SAVE = Object.assign(defaultSave(), s);
      SAVE.owned = Object.assign({ blaster: true }, s.owned);
      SAVE.upgrades = Object.assign(defaultSave().upgrades, s.upgrades);
      SAVE.gifts = Object.assign(defaultSave().gifts, s.gifts);
      SAVE.progress = Object.assign(defaultSave().progress, s.progress);
    }
  } catch (e) { SAVE = defaultSave(); }
}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch (e) {} }
loadSave();

// ============================================================================
//  DATA TABLES
// ============================================================================

// ---- Weapons -------------------------------------------------------------
function bolt(x, y, vx, vy, opts) {
  G.bullets.push(makeBullet(x, y, vx, vy, Object.assign({
    friendly: true, damage: 1, w: 16, h: 6, color: '#aaffb4', glow: '#3dff6e', kind: 'bolt', life: 2.4,
  }, opts)));
}
function ang(vx, deg) { // rotate a (vx,0) vector by deg degrees
  const r = deg * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return [vx * c, vx * s];
}
const WEAPONS = {
  blaster: { name: 'Blaster', cost: 0, premium: false, interval: 0.30, desc: 'Reliable single bolt',
    fire(p) { bolt(p.x + 30, p.y, 760, 0); Audio2.shoot(); } },
  twin: { name: 'Twin Cannon', cost: 120, interval: 0.32, desc: 'Two parallel bolts',
    fire(p) { bolt(p.x + 30, p.y - 9, 780, 0); bolt(p.x + 30, p.y + 9, 780, 0); Audio2.shoot(); } },
  spread: { name: 'Spread Shot', cost: 220, interval: 0.40, desc: '3-way fan for crowds',
    fire(p) { [-15, 0, 15].forEach(d => { const [vx, vy] = ang(720, d); bolt(p.x + 28, p.y, vx, vy); }); Audio2.shoot(); } },
  scatter: { name: 'Scatter Gun', cost: 320, interval: 0.55, desc: 'Wide 5-way blast, short range',
    fire(p) { [-28, -14, 0, 14, 28].forEach(d => { const [vx, vy] = ang(640, d); bolt(p.x + 26, p.y, vx, vy, { life: 0.46, w: 12, h: 8, color: '#ffd76e', glow: '#ff9d2e' }); }); Audio2.shoot(); } },
  vulcan: { name: 'Vulcan', cost: 400, interval: 0.075, desc: 'Rapid-fire stream',
    fire(p) { bolt(p.x + 30, p.y + rand(-6, 6), 900, rand(-20, 20), { w: 12, h: 4, color: '#fff0a0', glow: '#ffd000', damage: 0.7 }); Audio2.shoot(); } },
  homing: { name: 'Homing Missiles', cost: 500, interval: 0.55, desc: 'Curve toward enemies',
    fire(p) { bolt(p.x + 26, p.y - 8, 380, -60, { kind: 'missile', homing: true, w: 16, h: 8, color: '#dfe7ee', glow: '#ff7a18', damage: 2, life: 3 });
              bolt(p.x + 26, p.y + 8, 380, 60, { kind: 'missile', homing: true, w: 16, h: 8, color: '#dfe7ee', glow: '#ff7a18', damage: 2, life: 3 }); Audio2.missile(); } },
  laser: { name: 'Laser Lance', cost: 580, interval: 0.42, desc: 'Piercing beam, hits a whole line',
    fire(p) { bolt(p.x + 30, p.y, 1500, 0, { kind: 'laser', pierce: 99, w: 60, h: 7, color: '#bff0ff', glow: '#36c9ff', damage: 1.2, life: 1.2 }); Audio2.laser(); } },
  storm: { name: 'Beskar Storm', cost: 850, premium: true, interval: 0.30, desc: 'Twin bolts + homing missile',
    fire(p) { bolt(p.x + 30, p.y - 12, 800, 0); bolt(p.x + 30, p.y + 12, 800, 0);
              bolt(p.x + 26, p.y, 420, 0, { kind: 'missile', homing: true, w: 16, h: 8, color: '#ffd76e', glow: '#ff7a18', damage: 2, life: 3 }); Audio2.shoot(); } },
  darksaber: { name: 'Darksaber Array', cost: 1150, premium: true, interval: 0.34, desc: 'Spread bolts + piercing core',
    fire(p) { [-18, 18].forEach(d => { const [vx, vy] = ang(720, d); bolt(p.x + 26, p.y, vx, vy, { color: '#d8b3ff', glow: '#a64dff' }); });
              bolt(p.x + 30, p.y, 1200, 0, { kind: 'laser', pierce: 99, w: 46, h: 8, color: '#f0e0ff', glow: '#a64dff', damage: 1.4, life: 1.1 }); Audio2.laser(); } },
};
const WEAPON_ORDER = ['blaster','twin','spread','scatter','vulcan','homing','laser','storm','darksaber'];

// ---- Upgrades ------------------------------------------------------------
const UPGRADES = {
  fireRate:  { name: 'Blaster Fire Rate', max: 5, desc: 'Shoot faster',  cost: l => 90 + l * 90 },
  armor:     { name: 'Beskar Armor',      max: 5, desc: 'Extra hull',    cost: l => 110 + l * 100 },
  thrusters: { name: 'Thrusters',         max: 4, desc: 'Fly faster',    cost: l => 100 + l * 90 },
};
const UPGRADE_ORDER = ['fireRate','armor','thrusters'];

// ---- Grogu's Gifts -------------------------------------------------------
const GIFTS = {
  magnet: { name: 'Beskar Magnet', max: 4, desc: 'Pull gold toward you from afar', cost: l => 80 + l * 80 },
  wipe:   { name: 'Force Wipe',    max: 3, desc: 'F: pulse clears the screen',     cost: l => l === 0 ? 180 : 120 + l * 90 },
  mend:   { name: 'Force Mend',    max: 3, desc: 'Companion repairs your hull',    cost: l => 150 + l * 130 },
  frog:   { name: 'Lucky Frog',    max: 3, desc: 'Chance of bonus sparkly gold',   cost: l => 120 + l * 110 },
  bond:   { name: 'Force Bond',    max: 2, desc: 'Revive once or twice per run',   cost: l => 260 + l * 280 },
};
const GIFT_ORDER = ['magnet','wipe','mend','frog','bond'];

// ---- Levels --------------------------------------------------------------
const LEVELS = [
  { name: 'Asteroid Field', boss: 'Mining Hauler',    waves: 3, tint: '#7fd0ff', enemyMix: ['grunt','grunt','shooter'] },
  { name: 'Imperial Fleet', boss: 'Imperial Cruiser',  waves: 4, tint: '#c79bff', enemyMix: ['grunt','shooter','shooter'] },
  { name: 'Planet Surface', boss: 'Imperial Walker',   waves: 5, tint: '#ffc06e', enemyMix: ['grunt','shooter','grunt','shooter'] },
];

// derived player stats
function maxHull() { return 3 + SAVE.upgrades.armor; }
function playerSpeed() { return 250 + SAVE.upgrades.thrusters * 48; }
function fireInterval(w) { return Math.max(0.05, w.interval * (1 - 0.10 * SAVE.upgrades.fireRate)); }
function magnetRadius() { const l = SAVE.gifts.magnet; return l === 0 ? 46 : 90 + l * 75; }
function mendRate() { return SAVE.gifts.mend * 0.06; } // hull per second
function frogChance() { return SAVE.gifts.frog * 0.14; }
function bondRevives() { return SAVE.gifts.bond; }
function wipeOwned() { return SAVE.gifts.wipe >= 1; }
function wipeCooldown() { return 14 - (SAVE.gifts.wipe - 1) * 2.5; } // lv1=14 ... lv3=9
function ownedWeapons() { return WEAPON_ORDER.filter(id => SAVE.owned[id]); }

// ============================================================================
//  DRAW HELPERS
// ============================================================================
const R = Math.round;
function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(R(x), R(y), R(w), R(h)); }
function text(str, x, y, size, color, align, weight) {
  ctx.font = `${weight || 'bold'} ${size}px "Trebuchet MS", system-ui, sans-serif`;
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color; ctx.fillText(str, R(x), R(y));
}
function textC(str, x, y, size, color, weight) { text(str, x, y, size, color, 'center', weight); }
function roundRect(x, y, w, h, r, fill, stroke, lw) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); }
}
function glowDot(x, y, r, c) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}

// ---- Sprites (procedural, chunky) ---------------------------------------
function drawShip(x, y, t, thrust, flash) {
  ctx.save(); ctx.translate(R(x), R(y));
  // engine flame
  const f = 10 + Math.sin(t * 32) * 4 + (thrust ? 8 : 0);
  rect(-30 - f, -5, f, 4, '#ffd23f');
  rect(-30 - f * 0.7, -6, f * 0.7, 6, '#ff7a18');
  rect(-28, -7, 6, 14, '#3a2a10');
  // wings
  rect(-18, -22, 16, 8, '#1f6b42'); rect(-18, 14, 16, 8, '#1f6b42');
  rect(-6, -24, 8, 6, '#155233');  rect(-6, 18, 8, 6, '#155233');
  // main hull
  rect(-26, -10, 48, 20, '#2f7d4f');
  rect(-26, -10, 48, 6, '#57c97e');     // top highlight
  rect(-26, 4, 48, 6, '#1c5a36');       // bottom shade
  rect(22, -7, 12, 14, '#2f7d4f');      // nose
  rect(30, -3, 8, 6, '#9fb0a6');        // gun tip
  // gold beskar trim
  rect(-20, -2, 30, 4, '#ffcc44');
  // side cannons
  rect(8, -16, 18, 5, '#c9d4cc'); rect(8, 11, 18, 5, '#c9d4cc');
  rect(24, -16, 8, 5, '#ffcc44'); rect(24, 11, 8, 5, '#ffcc44');
  // cockpit
  rect(2, -7, 12, 10, '#0a3a55');
  rect(4, -6, 9, 6, '#7fe7ff');
  rect(5, -5, 4, 3, '#d8fbff');
  // outline accents
  rect(-26, -10, 2, 20, '#0e3a22');
  if (flash) { ctx.globalCompositeOperation = 'lighter'; rect(-30, -24, 70, 48, 'rgba(255,255,255,0.5)'); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
}
function drawGrogu(x, y, t) {
  // little green companion in a hover-pram, bobbing
  ctx.save(); ctx.translate(R(x), R(y + Math.sin(t * 3) * 3));
  // pram
  rect(-12, 2, 24, 10, '#8a7a5a'); rect(-12, 2, 24, 3, '#b5a17a');
  rect(-12, 11, 24, 3, '#5c4f38');
  glowDot(0, 8, 16, 'rgba(120,200,255,0.25)');
  // robe
  rect(-7, -4, 14, 8, '#caa66a');
  // head
  rect(-6, -12, 12, 9, '#9cc36b'); rect(-6, -12, 12, 3, '#b6da86');
  // big ears
  rect(-12, -10, 6, 5, '#9cc36b'); rect(6, -10, 6, 5, '#9cc36b');
  rect(-13, -9, 3, 3, '#b6da86'); rect(10, -9, 3, 3, '#b6da86');
  // eyes
  rect(-4, -8, 3, 3, '#1a1208'); rect(2, -8, 3, 3, '#1a1208');
  ctx.restore();
}
function drawGrunt(e, t) {
  const x = e.x, y = e.y, fl = e.flash > 0;
  ctx.save(); ctx.translate(R(x), R(y));
  rect(-14, -3, 28, 6, '#6b7079');               // central bar/wing
  rect(-16, -12, 6, 24, '#8a9099'); rect(10, -12, 6, 24, '#8a9099'); // wings
  rect(-16, -12, 6, 4, '#b3bac4'); rect(10, -12, 6, 4, '#b3bac4');
  rect(-7, -7, 14, 14, '#444a55');                // body
  rect(-5, -5, 10, 10, '#2a2e36');
  rect(-3, -3, 6, 6, fl ? '#ffffff' : '#ff4d4d'); // eye
  glowDot(0, 0, 9, 'rgba(255,60,60,0.25)');
  if (fl) { rect(-16, -12, 32, 24, 'rgba(255,255,255,0.45)'); }
  ctx.restore();
}
function drawShooter(e, t) {
  const x = e.x, y = e.y, fl = e.flash > 0;
  ctx.save(); ctx.translate(R(x), R(y));
  rect(-20, -8, 40, 16, '#5a5f6b'); rect(-20, -8, 40, 5, '#7e8593');
  rect(-22, -3, 6, 6, '#3a3e47');
  rect(14, -10, 12, 20, '#73798a'); rect(20, -6, 8, 12, '#a23a3a'); // gun pod
  rect(-12, -12, 24, 6, '#454a55'); rect(-12, 6, 24, 6, '#454a55');
  rect(-6, -5, 12, 10, fl ? '#ffffff' : '#ff8a3a'); // glowing core
  glowDot(0, 0, 12, 'rgba(255,140,40,0.28)');
  if (fl) rect(-22, -12, 48, 24, 'rgba(255,255,255,0.4)');
  ctx.restore();
}
function drawAsteroid(a) {
  ctx.save(); ctx.translate(R(a.x), R(a.y));
  const s = a.size;
  rect(-s, -s * 0.8, s * 2, s * 1.6, '#5b5347');
  rect(-s * 0.8, -s, s * 1.6, s * 2, '#5b5347');
  rect(-s, -s * 0.8, s * 2, s * 0.5, '#7a7060');
  rect(-s * 0.5, -s * 0.4, s * 0.4, s * 0.4, '#3e382e');
  rect(s * 0.1, s * 0.2, s * 0.3, s * 0.3, '#3e382e');
  ctx.restore();
}

// ============================================================================
//  PARTICLES & FLOATERS
// ============================================================================
function spawnExplosion(x, y, color, big) {
  const n = big ? 46 : 18;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), sp = rand(40, big ? 360 : 220);
    G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      life: rand(0.3, big ? 1.0 : 0.6), max: 0.9, size: rand(2, big ? 9 : 5),
      color: choice([color, '#ffd23f', '#ff7a18', '#ffffff']) });
  }
  if (big) for (let i = 0; i < 12; i++) {
    const a = rand(0, TAU), sp = rand(20, 90);
    G.particles.push({ x, y, vx: Math.cos(a)*sp, vy: Math.sin(a)*sp, life: rand(0.6,1.4), max:1.4, size: rand(4,10), color:'#552200', smoke:true });
  }
  G.shake = Math.min(18, G.shake + (big ? 16 : 5));
}
function spawnSparks(x, y, color, n) {
  for (let i = 0; i < (n || 6); i++) {
    const a = rand(0, TAU), sp = rand(30, 160);
    G.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.15, 0.4), max: 0.4, size: rand(1.5, 3.5), color });
  }
}
function floater(x, y, str, color, size) {
  G.floaters.push({ x, y, str, color: color || '#ffcc44', size: size || 18, life: 1.0 });
}

// ============================================================================
//  ENTITY FACTORIES
// ============================================================================
function makeBullet(x, y, vx, vy, o) {
  return Object.assign({ x, y, vx, vy, life: 2.4, pierce: 0, hits: new Set(), dead: false }, o);
}
function makePlayer() {
  return {
    x: 150, y: VH / 2, vx: 0, vy: 0,
    hull: maxHull(), maxHull: maxHull(),
    fireCd: 0, invuln: 1.0, t: 0,
    revives: bondRevives(), alive: true,
    weaponIdx: Math.max(0, ownedWeapons().indexOf(SAVE.equipped)),
  };
}
function makeLoot(x, y, value, sparkly) {
  return { x, y, vx: rand(-30, 120), vy: rand(-120, -40), value, sparkly: !!sparkly,
    life: 9, t: rand(0, TAU), collected: false };
}
function makeEnemy(type, x, y, scale) {
  const base = {
    type, x, y, t: rand(0, TAU), flash: 0, dead: false,
    fireCd: rand(0.6, 1.6), homeAmount: 0,
  };
  if (type === 'grunt') {
    return Object.assign(base, {
      hp: 2 * scale, maxhp: 2 * scale, r: 16, speed: rand(150, 210) * (1 + 0.04 * G.loop),
      reward: randInt(1, 3) + G.loop, contact: 1, homeAmount: rand(40, 90),
    });
  }
  // shooter
  return Object.assign(base, {
    hp: 5 * scale, maxhp: 5 * scale, r: 20, speed: rand(70, 110),
    reward: randInt(3, 6) + G.loop, contact: 1, anchorX: rand(560, 820), strafe: rand(40, 90), phase: rand(0, TAU),
  });
}
function makeBoss(levelIndex, loop) {
  const hpBase = [60, 90, 120][levelIndex] * (1 + 0.6 * loop);
  return {
    levelIndex, x: VW + 120, y: VH / 2, t: 0, hp: hpBase, maxhp: hpBase,
    enterDone: false, fireCd: 2.0, pattern: 0, flash: 0, r: 70, dead: false,
    name: LEVELS[levelIndex].boss,
  };
}

// ============================================================================
//  BACKGROUND (parallax, per-level)
// ============================================================================
function buildBackground(level) {
  const bg = { level, stars: [], asteroids: [], hulls: [], debris: [], mountains: [], scroll: 0 };
  for (let i = 0; i < 90; i++) bg.stars.push({ x: rand(0, VW), y: rand(0, VH), z: rand(0.15, 1), size: rand(1, 3) });
  if (level === 0) {
    for (let i = 0; i < 8; i++) bg.asteroids.push({ x: rand(0, VW), y: rand(40, VH - 40), size: rand(14, 40), spd: rand(20, 60), spin: rand(-1, 1) });
  } else if (level === 1) {
    for (let i = 0; i < 4; i++) bg.hulls.push({ x: rand(0, VW * 1.5), y: rand(60, VH - 120), w: rand(220, 380), h: rand(70, 130), spd: rand(8, 16), c: choice(['#2a2740','#1f2238','#332a44']) });
    for (let i = 0; i < 14; i++) bg.debris.push({ x: rand(0, VW), y: rand(0, VH), size: rand(3, 10), spd: rand(40, 110) });
  } else {
    for (let i = 0; i < 10; i++) bg.mountains.push({ x: i * 130 + rand(-30, 30), h: rand(80, 190), spd: 18, layer: 1, c: '#3a2b4a' });
    for (let i = 0; i < 8; i++) bg.mountains.push({ x: i * 170 + rand(-30, 30), h: rand(140, 260), spd: 34, layer: 2, c: '#4a2f3a' });
  }
  return bg;
}
function updateBackground(dt) {
  const bg = G.bg, base = 60 + G.level * 10;
  bg.scroll += dt * base;
  for (const s of bg.stars) { s.x -= s.z * base * dt; if (s.x < -3) { s.x = VW + 3; s.y = rand(0, VH); } }
  for (const a of bg.asteroids) { a.x -= a.spd * dt; a.y += Math.sin((bg.scroll + a.x) * 0.01) * 0.2; if (a.x < -50) { a.x = VW + 50; a.y = rand(40, VH - 40); a.size = rand(14, 40); } }
  for (const h of bg.hulls) { h.x -= h.spd * dt; if (h.x + h.w < -20) { h.x = VW + rand(50, 300); h.y = rand(60, VH - 120); } }
  for (const d of bg.debris) { d.x -= d.spd * dt; if (d.x < -10) { d.x = VW + 10; d.y = rand(0, VH); } }
}
function drawBackground() {
  const bg = G.bg, L = G.level;
  if (L === 0) {
    let g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0a1430'); g.addColorStop(0.6, '#070b1c'); g.addColorStop(1, '#02030a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    glowDot(VW * 0.75, VH * 0.25, 260, 'rgba(60,90,170,0.20)');
  } else if (L === 1) {
    let g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#241338'); g.addColorStop(0.5, '#160d28'); g.addColorStop(1, '#0a0617');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    glowDot(VW * 0.3, VH * 0.4, 320, 'rgba(150,70,200,0.18)');
    glowDot(VW * 0.8, VH * 0.7, 260, 'rgba(70,90,220,0.16)');
  } else {
    let g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#ffb56b'); g.addColorStop(0.45, '#e87a6a'); g.addColorStop(0.8, '#5e3a66'); g.addColorStop(1, '#2a1c3a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    glowDot(VW * 0.7, VH * 0.3, 130, 'rgba(255,240,180,0.5)'); // sun
  }
  // stars (space levels)
  if (L < 2) for (const s of bg.stars) { ctx.globalAlpha = 0.4 + s.z * 0.6; rect(s.x, s.y, s.size, s.size, '#cfe2ff'); }
  ctx.globalAlpha = 1;
  // capital hulls
  for (const h of bg.hulls) {
    rect(h.x, h.y, h.w, h.h, h.c);
    rect(h.x, h.y, h.w, 5, '#4a4668');
    for (let i = 0; i < h.w; i += 22) if ((i + (h.x | 0)) % 44 < 22) rect(h.x + i + 4, h.y + h.h * 0.4, 8, 6, '#ffd98a');
    rect(h.x + h.w * 0.2, h.y - 14, h.w * 0.1, 14, h.c);
  }
  for (const d of bg.debris) { ctx.globalAlpha = 0.6; rect(d.x, d.y, d.size, d.size, '#6a6480'); }
  ctx.globalAlpha = 1;
  // asteroids
  for (const a of bg.asteroids) drawAsteroid(a);
  // mountains + ground (planet)
  if (L === 2) {
    for (const layer of [1, 2]) {
      for (const m of bg.mountains) {
        if (m.layer !== layer) continue;
        const off = -(bg.scroll * (m.spd / 60)) % (VW + 200);
        let mx = m.x + off; if (mx < -200) mx += VW + 200;
        const baseY = VH - 70;
        ctx.fillStyle = m.c; ctx.beginPath();
        ctx.moveTo(mx - 90, baseY); ctx.lineTo(mx, baseY - m.h); ctx.lineTo(mx + 90, baseY); ctx.closePath(); ctx.fill();
      }
    }
    // scrolling ground
    rect(0, VH - 70, VW, 70, '#3a2436');
    rect(0, VH - 70, VW, 8, '#6a3f54');
    const goff = (bg.scroll * 2) % 48;
    for (let x = -goff; x < VW; x += 48) { rect(x, VH - 60, 24, 6, '#52304a'); rect(x + 24, VH - 40, 24, 6, '#52304a'); }
  }
}

// ============================================================================
//  GAME STATE
// ============================================================================
const G = {
  state: 'title',
  player: null, companion: { x: 110, y: VH / 2 },
  bullets: [], enemies: [], loot: [], particles: [], floaters: [],
  boss: null, bg: null,
  level: SAVE.progress.level | 0, loop: SAVE.progress.loop | 0,
  wave: 0, phase: 'waves', spawnQueue: [], waveGap: 0, waveAnnounce: 0,
  runBeskar: 0, score: 0, combo: 0,
  forceWipeCd: 0, wipeFx: 0,
  time: 0, shake: 0, stateTime: 0,
  bannerTitle: '', bannerSub: '',
  titleShipX: -80,
};

function setState(s) { G.state = s; G.stateTime = 0; }

// ============================================================================
//  RUN MANAGEMENT
// ============================================================================
function startRun() {
  G.level = clamp(SAVE.progress.level | 0, 0, LEVELS.length - 1);
  G.loop = SAVE.progress.loop | 0;
  beginLevel();
}
function beginLevel() {
  G.player = makePlayer();
  G.bullets = []; G.enemies = []; G.loot = []; G.particles = []; G.floaters = [];
  G.boss = null; G.bg = buildBackground(G.level);
  G.wave = 0; G.phase = 'waves'; G.spawnQueue = []; G.waveGap = 1.2; G.waveAnnounce = 2.2;
  G.runBeskar = 0; G.score = 0; G.combo = 0;
  G.forceWipeCd = 0; G.wipeFx = 0;
  G.bannerTitle = LEVELS[G.level].name.toUpperCase();
  G.bannerSub = G.loop > 0 ? `LOOP ${G.loop + 1} • Level ${G.level + 1}` : `Level ${G.level + 1}`;
  setState('play');
  Audio2.levelup();
}
function scale() { return 1 + 0.22 * G.level + 0.55 * G.loop; }

function queueWave(n) {
  const lvl = LEVELS[G.level];
  const count = 5 + n * 2 + G.level * 2 + G.loop * 2;
  let t = 0;
  for (let i = 0; i < count; i++) {
    const type = choice(lvl.enemyMix);
    t += rand(0.35, 0.9);
    G.spawnQueue.push({ at: t, type, y: rand(70, VH - 90) });
  }
  G.waveTimer = 0;
}
function updateWaves(dt) {
  if (G.phase === 'waves') {
    if (G.waveAnnounce > 0) { G.waveAnnounce -= dt; return; }
    if (G.spawnQueue.length === 0 && G.waveGap > 0 && G.enemies.length === 0) {
      G.waveGap -= dt;
      if (G.waveGap <= 0) {
        if (G.wave < LEVELS[G.level].waves) { queueWave(G.wave); G.wave++; }
        else { G.phase = 'boss'; G.boss = makeBoss(G.level, G.loop); G.bannerTitle = 'WARNING'; G.bannerSub = G.boss.name + ' incoming!'; G.waveAnnounce = 2.0; }
      }
      return;
    }
    G.waveTimer = (G.waveTimer || 0) + dt;
    while (G.spawnQueue.length && G.spawnQueue[0].at <= G.waveTimer) {
      const s = G.spawnQueue.shift();
      G.enemies.push(makeEnemy(s.type, VW + 40, s.y, scale()));
    }
    if (G.spawnQueue.length === 0 && G.enemies.length === 0) { G.waveGap = 1.4; }
  }
}

function dropBeskar(x, y, amount) {
  const lucky = Math.random() < frogChance();
  const n = clamp(amount, 1, 8);
  for (let i = 0; i < n; i++) {
    G.loot.push(makeLoot(x + rand(-12, 12), y + rand(-12, 12), lucky ? 2 : 1, lucky));
  }
  if (lucky) { floater(x, y - 20, 'LUCKY!', '#9cff9c', 16); }
}

function gainBeskar(v, x, y) {
  G.runBeskar += v;
  G.combo++;
  floater(x, y, '+' + v, '#ffd23f', 15);
  if (v >= 2) Audio2.coinbig(); else Audio2.coin();
}

// ============================================================================
//  COMBAT UPDATE
// ============================================================================
function fireWeapon() {
  const ids = ownedWeapons();
  const id = ids[clamp(G.player.weaponIdx, 0, ids.length - 1)] || 'blaster';
  WEAPONS[id].fire(G.player);
  // muzzle flash
  spawnSparks(G.player.x + 32, G.player.y, '#fff0a0', 3);
}

function triggerForceWipe() {
  if (!wipeOwned() || G.forceWipeCd > 0 || !G.player.alive) { Audio2.deny(); return; }
  G.forceWipeCd = wipeCooldown();
  G.wipeFx = 0.6;
  Audio2.force();
  G.shake = 14;
  // clear enemy bullets
  for (const b of G.bullets) if (!b.friendly) { b.dead = true; spawnSparks(b.x, b.y, '#7fe7ff', 3); }
  // damage all enemies
  for (const e of G.enemies) {
    e.hp -= 6 + G.level * 2;
    e.flash = 0.2;
    if (e.hp <= 0) killEnemy(e);
  }
  if (G.boss && G.boss.enterDone) { G.boss.hp -= G.boss.maxhp * 0.12; G.boss.flash = 0.3; }
}

function killEnemy(e) {
  if (e.dead) return; e.dead = true;
  spawnExplosion(e.x, e.y, e.type === 'grunt' ? '#ff6b6b' : '#ff9d3a');
  Audio2.explode();
  dropBeskar(e.x, e.y, e.reward);
  G.score += e.type === 'grunt' ? 50 : 120;
}

function damagePlayer(amount) {
  const p = G.player;
  if (!p.alive || p.invuln > 0) return;
  p.hull -= amount; p.invuln = 1.3;
  Audio2.hurt();
  G.shake = 12; G.combo = 0;
  spawnExplosion(p.x, p.y, '#7fe7ff');
  if (p.hull <= 0) {
    if (p.revives > 0) {
      p.revives--; p.hull = Math.max(2, Math.ceil(p.maxHull * 0.5)); p.invuln = 2.5;
      floater(p.x, p.y - 30, 'FORCE BOND!', '#9cff9c', 22);
      Audio2.powerup(); G.wipeFx = 0.5;
      for (const b of G.bullets) if (!b.friendly) b.dead = true;
    } else {
      p.alive = false;
      spawnExplosion(p.x, p.y, '#9fffb0', true);
      Audio2.bigboom();
    }
  }
}

function updateBullets(dt) {
  for (const b of G.bullets) {
    if (b.dead) continue;
    if (b.homing) {
      // find nearest target
      let best = null, bd = 1e9;
      const targets = G.boss && G.boss.enterDone ? G.enemies.concat([G.boss]) : G.enemies;
      for (const e of targets) { const d = dist2(b.x, b.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
      if (best) {
        const a = Math.atan2(best.y - b.y, best.x - b.x);
        const sp = Math.hypot(b.vx, b.vy) || 420;
        b.vx = lerp(b.vx, Math.cos(a) * sp, dt * 4);
        b.vy = lerp(b.vy, Math.sin(a) * sp, dt * 4);
        if (Math.random() < 0.6) spawnSparks(b.x - b.vx * 0.02, b.y, '#ff7a18', 1);
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -40 || b.x > VW + 60 || b.y < -40 || b.y > VH + 40) b.dead = true;
  }

  // collisions: friendly bullets vs enemies/boss
  for (const b of G.bullets) {
    if (b.dead || !b.friendly) continue;
    for (const e of G.enemies) {
      if (e.dead) continue;
      if (b.hits.has(e)) continue;
      if (Math.abs(b.x - e.x) < e.r + b.w * 0.5 && Math.abs(b.y - e.y) < e.r) {
        e.hp -= b.damage; e.flash = 0.12;
        spawnSparks(b.x, b.y, b.glow || '#ffd23f', 4);
        if (b.pierce > 0) { b.hits.add(e); } else { b.dead = true; }
        if (e.hp <= 0) killEnemy(e);
        if (!b.dead && b.pierce <= 0) break;
        if (b.dead) break;
      }
    }
    if (b.dead) continue;
    const boss = G.boss;
    if (boss && boss.enterDone && !boss.dead && !b.hits.has(boss)) {
      if (Math.abs(b.x - boss.x) < boss.r && Math.abs(b.y - boss.y) < boss.r * 0.8) {
        boss.hp -= b.damage; boss.flash = 0.1;
        spawnSparks(b.x, b.y, '#ffd23f', 5);
        if (b.pierce > 0) b.hits.add(boss); else b.dead = true;
        if (boss.hp <= 0) defeatBoss();
      }
    }
  }
  // enemy bullets vs player
  const p = G.player;
  for (const b of G.bullets) {
    if (b.dead || b.friendly || !p.alive) continue;
    if (Math.abs(b.x - p.x) < 20 + b.w * 0.4 && Math.abs(b.y - p.y) < 14) {
      b.dead = true; damagePlayer(1);
    }
  }
  G.bullets = G.bullets.filter(b => !b.dead);
}

function updateEnemies(dt) {
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    if (e.type === 'grunt') {
      e.x -= e.speed * dt;
      if (p.alive) e.y += clamp(p.y - e.y, -e.homeAmount, e.homeAmount) * dt;
      e.y += Math.sin(e.t * 4) * 18 * dt;
    } else { // shooter
      if (e.x > e.anchorX) e.x -= e.speed * dt;
      e.y += Math.sin(e.t * 1.6 + e.phase) * e.strafe * dt;
      e.fireCd -= dt;
      if (e.fireCd <= 0 && e.x < VW && p.alive) {
        e.fireCd = rand(1.2, 2.2);
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        const sp = 260 + G.loop * 20;
        G.bullets.push(makeBullet(e.x - 16, e.y, Math.cos(a) * sp, Math.sin(a) * sp,
          { friendly: false, w: 12, h: 12, color: '#ff5a3a', glow: '#ff2a00', kind: 'eblast', life: 4 }));
        spawnSparks(e.x - 16, e.y, '#ff5a3a', 3);
      }
    }
    e.y = clamp(e.y, 40, VH - 50);
    // contact with player
    if (p.alive && p.invuln <= 0 && Math.abs(e.x - p.x) < e.r + 18 && Math.abs(e.y - p.y) < e.r) {
      damagePlayer(e.contact);
      if (e.type === 'grunt') { e.hp = 0; killEnemy(e); }
    }
    if (e.x < -60) e.dead = true;
  }
  G.enemies = G.enemies.filter(e => !e.dead);
}

function updateLoot(dt) {
  const p = G.player;
  const mr = magnetRadius(), mr2 = mr * mr;
  for (const l of G.loot) {
    l.t += dt; l.life -= dt;
    if (p.alive) {
      const d2 = dist2(l.x, l.y, p.x, p.y);
      if (d2 < mr2) {
        const a = Math.atan2(p.y - l.y, p.x - l.x);
        const pull = lerp(420, 120, Math.sqrt(d2) / mr);
        l.vx = lerp(l.vx, Math.cos(a) * (pull + 200), dt * 6);
        l.vy = lerp(l.vy, Math.sin(a) * (pull + 200), dt * 6);
      }
    }
    l.vy += 220 * dt; // gravity
    l.x += l.vx * dt; l.y += l.vy * dt;
    if (l.y > VH - 36) { l.y = VH - 36; l.vy *= -0.45; l.vx *= 0.8; }
    if (l.x < -30) l.collected = true;
    if (p.alive && Math.abs(l.x - p.x) < 26 && Math.abs(l.y - p.y) < 22) {
      l.collected = true; gainBeskar(l.value, l.x, l.y - 10);
      spawnSparks(l.x, l.y, l.sparkly ? '#9cff9c' : '#ffd23f', 4);
    }
    if (l.life <= 0) l.collected = true;
  }
  G.loot = G.loot.filter(l => !l.collected);
}

function updateParticles(dt) {
  for (const pt of G.particles) {
    pt.life -= dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.96; pt.vy *= 0.96; if (pt.smoke) pt.vy -= 8 * dt;
  }
  G.particles = G.particles.filter(p => p.life > 0);
  for (const f of G.floaters) { f.life -= dt; f.y -= 26 * dt; }
  G.floaters = G.floaters.filter(f => f.life > 0);
}

// ---- Boss ----------------------------------------------------------------
function defeatBoss() {
  const b = G.boss; if (!b || b.dead) return;
  b.dead = true;
  spawnExplosion(b.x, b.y, '#ffd23f', true);
  for (let i = 0; i < 5; i++) setTimeout(() => { if (G.state === 'play') spawnExplosion(b.x + rand(-50, 50), b.y + rand(-40, 40), choice(['#ff7a18','#ffd23f','#ffffff']), true); }, i * 120);
  Audio2.bigboom();
  // big beskar reward
  const reward = 30 + G.level * 20 + G.loop * 25;
  for (let i = 0; i < 18; i++) G.loot.push(makeLoot(b.x + rand(-40, 40), b.y + rand(-40, 40), Math.random() < frogChance() ? 4 : 3, Math.random() < 0.4));
  G.score += 1000 + G.level * 500;
  floater(b.x, b.y - 60, b.name + ' DOWN!', '#ffd23f', 26);
  G.phase = 'cleared'; G.clearTimer = 3.0;
}
function updateBoss(dt) {
  const b = G.boss, p = G.player;
  if (!b) return;
  b.t += dt; if (b.flash > 0) b.flash -= dt;
  if (!b.enterDone) {
    b.x = lerp(b.x, VW - 150, dt * 1.6);
    if (b.x < VW - 148) b.enterDone = true;
    return;
  }
  b.y = VH / 2 + Math.sin(b.t * 0.8) * (VH * 0.28);
  b.fireCd -= dt;
  if (b.fireCd <= 0 && p.alive) {
    const sp = 230 + G.loop * 25;
    if (b.levelIndex === 0) { // Mining Hauler: spread spray
      b.fireCd = 1.5;
      for (let i = -3; i <= 3; i++) { const [vx, vy] = ang(-sp, i * 12); G.bullets.push(makeBullet(b.x - 60, b.y, vx, vy, { friendly: false, w: 14, h: 14, color: '#ffae3a', glow: '#ff6a00', life: 5 })); }
    } else if (b.levelIndex === 1) { // Cruiser: aimed double shots
      b.fireCd = 0.9;
      for (const oy of [-30, 30]) { const a = Math.atan2(p.y - (b.y + oy), p.x - b.x); G.bullets.push(makeBullet(b.x - 60, b.y + oy, Math.cos(a) * sp, Math.sin(a) * sp, { friendly: false, w: 14, h: 10, color: '#ff5a8a', glow: '#ff0050', life: 5 })); }
    } else { // Walker: bursts toward player
      b.fireCd = 1.8;
      const a0 = Math.atan2(p.y - b.y, p.x - b.x);
      for (let i = 0; i < 5; i++) setTimeout(() => {
        if (G.state !== 'play' || b.dead) return;
        G.bullets.push(makeBullet(b.x - 50, b.y + 30, Math.cos(a0) * sp, Math.sin(a0) * sp, { friendly: false, w: 13, h: 13, color: '#ffd23f', glow: '#ff7a00', life: 5 }));
        Audio2.shoot();
      }, i * 110);
    }
  }
  // contact damage
  if (p.alive && p.invuln <= 0 && Math.abs(b.x - p.x) < b.r && Math.abs(b.y - p.y) < b.r * 0.7) damagePlayer(1);
}
function drawBoss() {
  const b = G.boss; if (!b) return;
  ctx.save(); ctx.translate(R(b.x), R(b.y));
  const fl = b.flash > 0;
  if (b.levelIndex === 0) { // Mining Hauler — bulky industrial ship
    rect(-70, -50, 140, 100, '#6b5a3a'); rect(-70, -50, 140, 14, '#8a7448');
    rect(-70, 36, 140, 14, '#4a3d26');
    rect(-90, -30, 24, 60, '#8a9099'); rect(-86, -24, 16, 48, '#aab0ba');
    rect(40, -36, 36, 72, '#5a4d30'); rect(48, -24, 20, 48, '#ffae3a');
    rect(-60, -36, 30, 24, '#2a2418'); rect(-20, -36, 30, 24, '#2a2418');
    rect(-66, -8, 12, 16, fl ? '#fff' : '#ff7a18');
  } else if (b.levelIndex === 1) { // Imperial Cruiser — angular wedge
    ctx.fillStyle = fl ? '#ffffff' : '#8e94a6'; ctx.beginPath();
    ctx.moveTo(70, 0); ctx.lineTo(-70, -56); ctx.lineTo(-70, 56); ctx.closePath(); ctx.fill();
    rect(-70, -56, 140, 8, '#b6bcca');
    for (let x = -60; x < 40; x += 16) rect(x, -2, 8, 5, '#ffd98a');
    rect(-30, -34, 50, 30, '#5a6072'); rect(-20, -26, 30, 16, '#aeb6c8');
    rect(-70, -10, 14, 20, fl ? '#fff' : '#ff5a8a');
  } else { // Imperial Walker head
    rect(-46, -40, 92, 60, fl ? '#ffffff' : '#7a808c'); rect(-46, -40, 92, 12, '#9aa0ac');
    rect(-60, -10, 18, 30, '#5a606c'); rect(46, -10, 18, 30, '#5a606c'); // side guns
    rect(-58, 6, 12, 10, fl ? '#fff' : '#ffd23f'); rect(48, 6, 12, 10, fl ? '#fff' : '#ffd23f');
    rect(-30, -28, 60, 22, '#4a505c'); rect(-22, -22, 14, 10, '#ff7a18'); rect(8, -22, 14, 10, '#ff7a18'); // eyes
    rect(-46, 20, 92, 14, '#3a3f48');
    rect(-30, 34, 14, 26, '#5a606c'); rect(16, 34, 14, 26, '#5a606c'); // legs hint
  }
  ctx.restore();
  // boss HP bar
  const bw = 520, bx = (VW - bw) / 2, by = 24;
  roundRect(bx - 4, by - 4, bw + 8, 22, 6, 'rgba(0,0,0,0.55)', '#ffcc44', 2);
  rect(bx, by, bw * clamp(b.hp / b.maxhp, 0, 1), 14, '#ff4d4d');
  rect(bx, by, bw * clamp(b.hp / b.maxhp, 0, 1), 5, '#ff8a8a');
  textC(b.name.toUpperCase(), VW / 2, by + 36, 15, '#ffe8a0');
}

// ============================================================================
//  PLAY UPDATE + DRAW
// ============================================================================
function updatePlay(dt) {
  const p = G.player;
  G.time += dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);
  if (G.wipeFx > 0) G.wipeFx -= dt;
  if (G.forceWipeCd > 0) G.forceWipeCd -= dt;

  // pause
  if (consumePress('p')) { setState('paused'); return; }
  if (consumePress('m')) { SAVE.muted = !SAVE.muted; persist(); }

  // input: discrete
  if (consumePress('q')) {
    const ids = ownedWeapons();
    if (ids.length > 1) { p.weaponIdx = (p.weaponIdx + 1) % ids.length; SAVE.equipped = ids[p.weaponIdx]; persist(); Audio2.select(); floater(p.x, p.y - 34, WEAPONS[SAVE.equipped].name, '#7fe7ff', 16); }
  }
  if (consumePress('f')) triggerForceWipe();

  updateBackground(dt);

  if (p.alive) {
    p.t += dt;
    if (p.invuln > 0) p.invuln -= dt;
    // movement
    let mx = 0, my = 0;
    if (down.has('ArrowLeft') || down.has('a')) mx -= 1;
    if (down.has('ArrowRight') || down.has('d')) mx += 1;
    if (down.has('ArrowUp') || down.has('w')) my -= 1;
    if (down.has('ArrowDown') || down.has('s')) my += 1;
    if (touch.active) { // drag toward touch (ship rides above the finger)
      const dx = touch.x - p.x, dy = (touch.y - 38) - p.y;
      if (Math.abs(dx) > 6) mx = clamp(dx / 60, -1, 1);
      if (Math.abs(dy) > 6) my = clamp(dy / 60, -1, 1);
    }
    const sp = playerSpeed();
    p.x = clamp(p.x + mx * sp * dt, 30, VW - 30);
    p.y = clamp(p.y + my * sp * dt, 36, VH - 40);
    // thruster trail
    if (Math.random() < 0.8) G.particles.push({ x: p.x - 32, y: p.y + rand(-4, 4), vx: -rand(60, 160), vy: rand(-20, 20), life: rand(0.15, 0.35), max: 0.35, size: rand(2, 5), color: choice(['#ffd23f', '#ff7a18']) });
    // Force Mend
    if (mendRate() > 0 && p.hull < p.maxHull) { p.healAcc = (p.healAcc || 0) + mendRate() * dt; if (p.healAcc >= 1) { p.healAcc -= 1; p.hull = Math.min(p.maxHull, p.hull + 1); floater(p.x, p.y - 30, '+1 HULL', '#9cff9c', 14); Audio2.powerup(); } }
    // auto fire
    p.fireCd -= dt;
    if (p.fireCd <= 0) { const w = WEAPONS[ownedWeapons()[p.weaponIdx] || 'blaster']; fireWeapon(); p.fireCd = fireInterval(w); }
    // companion follows
    G.companion.x = lerp(G.companion.x, p.x - 46, dt * 5);
    G.companion.y = lerp(G.companion.y, p.y + 30, dt * 5);
  }

  updateWaves(dt);
  updateEnemies(dt);
  if (G.boss) updateBoss(dt);
  updateBullets(dt);
  updateLoot(dt);
  updateParticles(dt);

  // banner timers
  if (G.waveAnnounce > 0) {} // shown in draw

  // end conditions
  if (!p.alive && G.particles.length < 4 && G.stateTime > 1.2) { endRun(false); }
  if (G.phase === 'cleared') {
    G.clearTimer -= dt;
    updateLoot(dt);
    if (G.clearTimer <= 0) { endRun(true); }
  }
}

function endRun(victory) {
  SAVE.vault += G.runBeskar;
  if (G.score > (SAVE.progress.bestScore | 0)) SAVE.progress.bestScore = G.score;
  if (victory) {
    // advance level / loop
    let lvl = G.level + 1, loop = G.loop;
    if (lvl >= LEVELS.length) { lvl = 0; loop++; }
    SAVE.progress.level = lvl; SAVE.progress.loop = loop;
    G.bannerTitle = 'LEVEL COMPLETE'; G.bannerSub = `+${G.runBeskar} beskar banked`;
    setState('levelclear'); Audio2.levelup();
  } else {
    G.bannerTitle = 'SHIP DOWN'; G.bannerSub = `+${G.runBeskar} beskar banked`;
    setState('shipdown'); Audio2.gameover();
  }
  persist();
}

function drawPlay() {
  ctx.save();
  if (G.shake > 0) ctx.translate(rand(-G.shake, G.shake), rand(-G.shake, G.shake));
  drawBackground();

  // loot
  for (const l of G.loot) {
    const s = 9 + Math.sin(l.t * 8) * 1.5;
    const col = l.sparkly ? '#9cff9c' : '#ffd23f';
    glowDot(l.x, l.y, s + 6, l.sparkly ? 'rgba(150,255,150,0.5)' : 'rgba(255,210,60,0.5)');
    rect(l.x - s / 2, l.y - s / 2, s, s, col);
    rect(l.x - s / 2, l.y - s / 2, s, 2, '#fff7d0');
  }
  // enemies
  for (const e of G.enemies) { if (e.type === 'grunt') drawGrunt(e, G.time); else drawShooter(e, G.time); }
  // boss
  if (G.boss) drawBoss();
  // bullets
  for (const b of G.bullets) {
    if (b.kind === 'laser') {
      glowDot(b.x, b.y, b.h + 4, 'rgba(120,220,255,0.4)');
      rect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.color);
      rect(b.x - b.w / 2, b.y - 1, b.w, 2, '#ffffff');
    } else {
      glowDot(b.x, b.y, (b.w + b.h) * 0.4 + 3, (b.glow || b.color) + '');
      ctx.save(); ctx.translate(b.x, b.y);
      if (b.vy || b.kind === 'missile') ctx.rotate(Math.atan2(b.vy, b.vx));
      rect(-b.w / 2, -b.h / 2, b.w, b.h, b.color);
      if (b.kind === 'missile') rect(-b.w / 2 - 4, -2, 4, 4, '#ff7a18');
      ctx.restore();
    }
  }
  // companion + ship
  const p = G.player;
  if (p) {
    drawGrogu(G.companion.x, G.companion.y, G.time);
    if (p.alive && !(p.invuln > 0 && Math.floor(G.time * 20) % 2)) {
      const moving = down.has('ArrowRight') || down.has('d') || down.has('ArrowUp') || down.has('w') || down.has('ArrowDown') || down.has('s') || down.has('ArrowLeft') || down.has('a');
      drawShip(p.x, p.y, G.time, moving, false);
    }
  }
  // particles
  for (const pt of G.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    rect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size, pt.color);
  }
  ctx.globalAlpha = 1;

  // force wipe flash ring
  if (G.wipeFx > 0 && p) {
    const r = lerp(40, 700, 1 - G.wipeFx / 0.6);
    ctx.strokeStyle = `rgba(150,230,255,${G.wipeFx})`; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, TAU); ctx.stroke();
  }

  // floaters
  for (const f of G.floaters) { ctx.globalAlpha = clamp(f.life, 0, 1); textC(f.str, f.x, f.y, f.size, f.color); }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawHUD();

  // wave / boss announce banner
  if (G.waveAnnounce > 0) {
    ctx.globalAlpha = clamp(G.waveAnnounce, 0, 1) * clamp(G.waveAnnounce > 1.2 ? (2.2 - G.waveAnnounce) * 3 : 1, 0, 1);
    textC(G.bannerTitle, VW / 2, VH / 2 - 10, 56, G.phase === 'boss' ? '#ff6b6b' : '#ffe8a0', '900');
    textC(G.bannerSub, VW / 2, VH / 2 + 30, 22, '#cfe2ff');
    ctx.globalAlpha = 1;
  }
}

// ============================================================================
//  HUD
// ============================================================================
function drawHeart(x, y, full) {
  ctx.save(); ctx.translate(x, y);
  const c = full ? '#ff4d6d' : '#3a2230';
  rect(-7, -4, 5, 6, c); rect(2, -4, 5, 6, c); rect(-7, 0, 14, 4, c); rect(-4, 4, 8, 3, c); rect(-2, 7, 4, 2, c);
  if (full) { rect(-6, -3, 2, 2, '#ff9db0'); }
  ctx.restore();
}
function drawHUD() {
  const p = G.player; if (!p) return;
  // top-left panel
  roundRect(10, 10, 250, 92, 8, 'rgba(8,14,26,0.72)', '#1d3a5c', 2);
  // hearts
  for (let i = 0; i < p.maxHull; i++) drawHeart(30 + i * 22, 34, i < p.hull);
  // beskar this run
  rect(22, 52, 12, 12, '#ffd23f'); rect(22, 52, 12, 3, '#fff7d0');
  text('BESKAR  ' + G.runBeskar, 42, 63, 16, '#ffe8a0');
  text('VAULT  ' + SAVE.vault, 22, 84, 13, '#9fd3c7');
  text('SCORE  ' + G.score, 150, 84, 13, '#9fd3c7');

  // top-right: weapon + force
  const wId = ownedWeapons()[p.weaponIdx] || 'blaster';
  roundRect(VW - 270, 10, 260, 70, 8, 'rgba(8,14,26,0.72)', '#1d3a5c', 2);
  text('WEAPON', VW - 256, 30, 12, '#9fd3c7');
  text(WEAPONS[wId].name, VW - 256, 50, 18, '#aaffb4');
  if (ownedWeapons().length > 1) text(IS_TOUCH ? 'tap WPN to swap' : '[Q] swap', VW - 256, 68, 12, '#5e7ea0');
  // force gauge
  if (wipeOwned()) {
    const ready = G.forceWipeCd <= 0;
    const fx = VW - 100, fy = 50;
    text(IS_TOUCH ? 'FORCE' : 'FORCE [F]', fx - 4, 30, 12, '#9fd3c7');
    roundRect(fx, 36, 84, 14, 5, 'rgba(0,0,0,0.5)', ready ? '#9cff9c' : '#46506a', 2);
    if (!ready) rect(fx + 2, 38, 80 * (1 - G.forceWipeCd / wipeCooldown()), 10, '#7fe7ff');
    else { rect(fx + 2, 38, 80, 10, '#9cff9c'); }
    text(ready ? 'READY' : Math.ceil(G.forceWipeCd) + 's', fx + 30, 66, 12, ready ? '#9cff9c' : '#7fe7ff');
  } else {
    text('Force Wipe locked', VW - 100, 50, 12, '#5e7ea0');
  }

  // wave progress (bottom center)
  if (G.phase === 'waves') {
    textC(`WAVE ${Math.min(G.wave, LEVELS[G.level].waves)} / ${LEVELS[G.level].waves}`, VW / 2, VH - 14, 14, '#7fa6d0');
  } else if (G.phase === 'boss') {
    textC('DEFEAT THE BOSS', VW / 2, VH - 14, 14, '#ff8a8a');
  }
  if (SAVE.muted) text('🔇', VW - 28, VH - 14, 16, '#5e7ea0');
}

// ============================================================================
//  TITLE SCREEN
// ============================================================================
function updateTitle(dt) {
  G.time += dt;
  G.titleShipX = lerp(G.titleShipX, VW / 2, dt * 1.4);
  if (!G.bg || G.bg.level !== 0) G.bg = buildBackground(0);
  updateBackground(dt);
  if (anyConfirm() || consumePress('Enter')) { Audio2.powerup(); openHangar(); }
}
function drawTitle() {
  drawBackground();
  // drifting ship
  const sx = G.titleShipX, sy = VH / 2 + 40 + Math.sin(G.time * 1.2) * 14;
  drawGrogu(sx - 52, sy + 30, G.time);
  drawShip(sx, sy, G.time, true, false);
  // title
  ctx.save();
  textC('BESKAR RUN', VW / 2, 170, 84, 'rgba(0,0,0,0.5)', '900');
  textC('BESKAR RUN', VW / 2 - 3, 167, 84, '#ffcc44', '900');
  textC('★ THIS IS THE WAY ★', VW / 2, 210, 22, '#9fd3c7');
  ctx.restore();
  // progress
  const prog = `Level ${(SAVE.progress.level | 0) + 1}` + (SAVE.progress.loop ? `  •  Loop ${SAVE.progress.loop + 1}` : '');
  textC('VAULT  ' + SAVE.vault + ' beskar', VW / 2, VH - 120, 20, '#ffe8a0');
  textC(prog + '   •   Best Score ' + (SAVE.progress.bestScore | 0), VW / 2, VH - 92, 16, '#9fd3c7');
  // prompt
  if (Math.floor(G.time * 1.6) % 2)
    textC(IS_TOUCH ? 'Tap to enter the Hangar' : 'Press ENTER  —  or click to enter the Hangar', VW / 2, VH - 50, 22, '#ffffff');
}

// ============================================================================
//  HANGAR (shop)
// ============================================================================
const hangar = { cat: 0, idx: 0, clickRects: [] };
function openHangar() { setState('hangar'); hangar.cat = 0; hangar.idx = 0; if (!G.bg) G.bg = buildBackground(0); }

function categoryItems(cat) {
  if (cat === 0) return UPGRADE_ORDER.map(k => ({ k, type: 'upgrade' }));
  if (cat === 1) return GIFT_ORDER.map(k => ({ k, type: 'gift' }));
  return WEAPON_ORDER.map(k => ({ k, type: 'weapon' }));
}
function buyItem(item) {
  if (item.type === 'upgrade') {
    const u = UPGRADES[item.k], lvl = SAVE.upgrades[item.k];
    if (lvl >= u.max) { Audio2.deny(); return; }
    const c = u.cost(lvl);
    if (SAVE.vault >= c) { SAVE.vault -= c; SAVE.upgrades[item.k]++; persist(); Audio2.powerup(); }
    else Audio2.deny();
  } else if (item.type === 'gift') {
    const g = GIFTS[item.k], lvl = SAVE.gifts[item.k];
    if (lvl >= g.max) { Audio2.deny(); return; }
    const c = g.cost(lvl);
    if (SAVE.vault >= c) { SAVE.vault -= c; SAVE.gifts[item.k]++; persist(); Audio2.powerup(); }
    else Audio2.deny();
  } else {
    const w = WEAPONS[item.k];
    if (SAVE.owned[item.k]) { SAVE.equipped = item.k; persist(); Audio2.select(); } // equip
    else if (SAVE.vault >= w.cost) { SAVE.vault -= w.cost; SAVE.owned[item.k] = true; SAVE.equipped = item.k; persist(); Audio2.powerup(); }
    else Audio2.deny();
  }
}
function updateHangar(dt) {
  G.time += dt; updateBackground(dt);
  const items = categoryItems(hangar.cat);
  if (consumePress('ArrowLeft') || consumePress('a')) { hangar.cat = (hangar.cat + 2) % 3; hangar.idx = 0; Audio2.select(); }
  if (consumePress('ArrowRight') || consumePress('d')) { hangar.cat = (hangar.cat + 1) % 3; hangar.idx = 0; Audio2.select(); }
  if (consumePress('ArrowUp') || consumePress('w')) { hangar.idx = (hangar.idx + items.length - 1) % items.length; Audio2.select(); }
  if (consumePress('ArrowDown') || consumePress('s')) { hangar.idx = (hangar.idx + 1) % items.length; Audio2.select(); }
  if (consumePress('Enter')) buyItem(items[hangar.idx]);
  if (consumePress('m')) { SAVE.muted = !SAVE.muted; persist(); }
  if (consumePress('Escape')) { setState('title'); }
  // launch
  let launch = consumePress('l') || consumePress(' ');

  // mouse clicks on cards / launch button
  if (mouse.clicked) {
    for (const r of hangar.clickRects) {
      if (mouse.x >= r.x && mouse.x <= r.x + r.w && mouse.y >= r.y && mouse.y <= r.y + r.h) {
        if (r.launch) launch = true;
        else { hangar.cat = r.cat; hangar.idx = r.idx; buyItem(categoryItems(r.cat)[r.idx]); }
        break;
      }
    }
  }
  if (launch) { Audio2.powerup(); startRun(); }
}
function levelPips(x, y, lvl, max, col) {
  for (let i = 0; i < max; i++) rect(x + i * 12, y, 9, 9, i < lvl ? (col || '#ffcc44') : '#2a3344');
}
function drawHangar() {
  drawBackground();
  ctx.fillStyle = 'rgba(4,8,16,0.78)'; ctx.fillRect(0, 0, VW, VH);
  hangar.clickRects = [];
  // header
  textC('⚙  THE HANGAR  ⚙', VW / 2, 44, 30, '#ffcc44', '900');
  rect(VW / 2 - 120, 54, 240, 3, '#1d3a5c');
  // vault
  rect(VW / 2 - 86, 64, 14, 14, '#ffd23f'); rect(VW / 2 - 86, 64, 14, 3, '#fff7d0');
  text('VAULT  ' + SAVE.vault + ' beskar', VW / 2 - 64, 77, 20, '#ffe8a0');

  const cats = [
    { title: 'UPGRADES', items: categoryItems(0) },
    { title: "GROGU'S GIFTS", items: categoryItems(1) },
    { title: 'WEAPONS', items: categoryItems(2) },
  ];
  const colW = 300, gap = 14, startX = (VW - (colW * 3 + gap * 2)) / 2, topY = 100;
  for (let c = 0; c < 3; c++) {
    const cx = startX + c * (colW + gap);
    const sel = hangar.cat === c;
    textC(cats[c].title, cx + colW / 2, topY + 4, 18, sel ? '#7fe7ff' : '#9fd3c7', '900');
    const items = cats[c].items;
    const cardH = c === 2 ? 42 : 84;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const cy = topY + 18 + i * (cardH + 8);
      const isSel = sel && hangar.idx === i;
      drawCard(it, cx, cy, colW, cardH, isSel);
      hangar.clickRects.push({ x: cx, y: cy, w: colW, h: cardH, cat: c, idx: i });
    }
  }

  // launch button
  const bw = 280, bx = VW / 2 - bw / 2, by = VH - 52;
  const hover = mouse.x >= bx && mouse.x <= bx + bw && mouse.y >= by && mouse.y <= by + 40;
  roundRect(bx, by, bw, 40, 10, hover ? '#1ea05a' : '#147a43', '#9cff9c', 3);
  textC('▶  LAUNCH  —  ' + LEVELS[clamp(SAVE.progress.level|0,0,2)].name + (SAVE.progress.loop?` (Loop ${SAVE.progress.loop+1})`:''), VW / 2, by + 27, 18, '#eafff0', '900');
  hangar.clickRects.push({ x: bx, y: by, w: bw, h: 40, launch: true });
  text(IS_TOUCH ? 'Tap a card to buy / equip  •  ‹ Back  •  tap LAUNCH to fly'
                : 'Arrows move • Enter buy/equip • Space launch • Esc title', IS_TOUCH ? 90 : 14, VH - 12, 13, '#5e7ea0');
}
function drawCard(it, x, y, w, h, sel) {
  let title, sub, costStr, lvl = 0, max = 0, owned = false, equipped = false, pipsCol = '#ffcc44', locked = false, premium = false;
  if (it.type === 'upgrade') {
    const u = UPGRADES[it.k]; lvl = SAVE.upgrades[it.k]; max = u.max; title = u.name; sub = u.desc;
    costStr = lvl >= max ? 'MAX' : u.cost(lvl) + ' ✦';
  } else if (it.type === 'gift') {
    const g = GIFTS[it.k]; lvl = SAVE.gifts[it.k]; max = g.max; title = g.name; sub = g.desc; pipsCol = '#9cff9c';
    costStr = lvl >= max ? 'MAX' : g.cost(lvl) + ' ✦';
  } else {
    const wp = WEAPONS[it.k]; title = wp.name; sub = wp.desc; premium = wp.premium;
    owned = !!SAVE.owned[it.k]; equipped = SAVE.equipped === it.k;
    costStr = owned ? (equipped ? 'EQUIPPED' : 'EQUIP') : wp.cost + ' ✦';
  }
  const affordable = costStr === 'MAX' || costStr === 'EQUIPPED' || costStr === 'EQUIP' ||
    SAVE.vault >= parseInt(costStr);
  let bg = 'rgba(12,20,34,0.9)';
  if (equipped) bg = 'rgba(20,90,60,0.9)';
  roundRect(x, y, w, h, 8, bg, sel ? '#7fe7ff' : (premium ? '#caa6ff' : '#27425f'), sel ? 3 : 2);
  text(title, x + 12, y + 22, h > 50 ? 17 : 16, premium ? '#e0c6ff' : '#eafff0');
  if (premium) text('★', x + w - 22, y + 22, 16, '#ffcc44');
  if (h > 50) {
    text(sub, x + 12, y + 42, 12, '#8fb0cf');
    if (max) levelPips(x + 12, y + 54, lvl, max, pipsCol);
    // cost badge (right-aligned)
    const cc = (costStr === 'MAX' || equipped) ? '#9cff9c' : (affordable ? '#ffd23f' : '#7a4a4a');
    text(costStr, x + w - 12, y + 66, 16, cc, 'right');
  } else {
    // compact weapon row
    text(sub, x + 12, y + 36, 11, '#8fb0cf');
    const cc = equipped ? '#9cff9c' : (owned ? '#7fe7ff' : (affordable ? '#ffd23f' : '#7a4a4a'));
    ctx.textAlign = 'right'; ctx.fillStyle = cc;
    ctx.font = 'bold 15px "Trebuchet MS", system-ui, sans-serif'; ctx.fillText(costStr, x + w - 12, y + 25); ctx.textAlign = 'left';
  }
}

// ============================================================================
//  OVERLAYS: pause, level clear, ship down
// ============================================================================
function updatePaused(dt) {
  if (consumePress('p') || consumePress('Enter')) setState('play');
  if (consumePress('Escape')) { endRun(false); }
  if (consumePress('m')) { SAVE.muted = !SAVE.muted; persist(); }
}
function drawPaused() {
  drawPlay();
  ctx.fillStyle = 'rgba(2,4,10,0.7)'; ctx.fillRect(0, 0, VW, VH);
  textC('PAUSED', VW / 2, VH / 2 - 20, 60, '#ffcc44', '900');
  textC(IS_TOUCH ? 'Tap ▶ to resume   •   QUIT to the hangar'
                 : '[P] resume   •   [Esc] quit run to hangar   •   [M] ' + (SAVE.muted ? 'unmute' : 'mute'),
        VW / 2, VH / 2 + 30, 20, '#cfe2ff');
}
function updateEndScreen(dt) {
  G.time += dt; updateParticles(dt);
  if (G.stateTime > 0.8 && anyConfirm()) openHangar();
}
function drawEndScreen(victory) {
  drawBackground();
  ctx.fillStyle = victory ? 'rgba(6,30,16,0.78)' : 'rgba(24,6,10,0.8)'; ctx.fillRect(0, 0, VW, VH);
  textC(G.bannerTitle, VW / 2, VH / 2 - 50, 64, victory ? '#9cff9c' : '#ff6b6b', '900');
  rect(VW / 2 - 16, VH / 2 - 14, 32, 32, '#ffd23f'); rect(VW / 2 - 16, VH / 2 - 14, 32, 6, '#fff7d0');
  textC(G.bannerSub, VW / 2, VH / 2 + 50, 26, '#ffe8a0');
  textC('VAULT  ' + SAVE.vault + ' beskar    •    SCORE  ' + G.score, VW / 2, VH / 2 + 86, 18, '#9fd3c7');
  if (victory) textC('Next up: ' + LEVELS[clamp(SAVE.progress.level|0,0,2)].name + (SAVE.progress.loop ? ` (Loop ${SAVE.progress.loop + 1})` : ''), VW / 2, VH / 2 + 116, 16, '#7fe7ff');
  if (Math.floor(G.time * 1.6) % 2) textC(IS_TOUCH ? 'Tap — to the Hangar' : 'Press ENTER / click — to the Hangar', VW / 2, VH - 50, 20, '#ffffff');
}

// ============================================================================
//  ON-SCREEN TOUCH BUTTONS
//  Only shown on touch devices. Tapping a button injects the matching key into
//  `pressed`, so the existing keyboard logic handles it with no special cases.
// ============================================================================
function tb(x, y, r, key, icon, opt) { return Object.assign({ x, y, r, key, icon }, opt || {}); }
function drawSpeaker(x, y, muted) {
  rect(x - 10, y - 5, 6, 10, '#cfe2ff');
  ctx.fillStyle = '#cfe2ff';
  ctx.beginPath(); ctx.moveTo(x - 4, y - 5); ctx.lineTo(x + 3, y - 11); ctx.lineTo(x + 3, y + 11); ctx.lineTo(x - 4, y + 5); ctx.closePath(); ctx.fill();
  if (muted) { ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 12, y - 11); ctx.lineTo(x + 12, y + 11); ctx.stroke(); }
  else { ctx.strokeStyle = '#9fd3c7'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + 6, y, 6, -0.6, 0.6); ctx.stroke(); ctx.beginPath(); ctx.arc(x + 6, y, 10, -0.6, 0.6); ctx.stroke(); }
}
function drawTouchButton(b) {
  const x = b.x, y = b.y, r = b.r;
  glowDot(x, y, r + 6, 'rgba(0,0,0,0.30)');
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = 'rgba(8,14,26,0.72)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = b.ring || '#1d3a5c'; ctx.stroke();
  switch (b.icon) {
    case 'pause': rect(x - 8, y - 10, 5, 20, '#eafff0'); rect(x + 3, y - 10, 5, 20, '#eafff0'); break;
    case 'play': ctx.fillStyle = '#eafff0'; ctx.beginPath(); ctx.moveTo(x - 9, y - 13); ctx.lineTo(x - 9, y + 13); ctx.lineTo(x + 14, y); ctx.closePath(); ctx.fill(); break;
    case 'weapon': textC('WPN', x, y + 5, 15, '#bff0ff', '900'); break;
    case 'force':
      if (b.ready) textC('F', x, y + 9, 28, '#9cff9c', '900');
      else { textC('F', x, y + 2, 18, '#7fe7ff', '900'); textC(Math.ceil(G.forceWipeCd) + 's', x, y + 19, 12, '#7fe7ff'); }
      break;
    case 'mute': drawSpeaker(x, y, SAVE.muted); break;
    case 'quit': textC('QUIT', x, y + 5, 14, '#ffb0b0', '900'); break;
    case 'back': textC('‹', x - 1, y + 9, 30, '#cfe7ff', '900'); break;
  }
}
function buildTouchButtons() {
  touchButtons = [];
  if (!IS_TOUCH) return;
  const s = G.state;
  if (s === 'play') {
    touchButtons.push(tb(VW - 42, 112, 26, 'p', 'pause'));
    touchButtons.push(tb(VW - 42, 172, 24, 'm', 'mute'));
    if (ownedWeapons().length > 1) touchButtons.push(tb(VW - 48, VH - 152, 30, 'q', 'weapon', { ring: '#7fe7ff' }));
    if (wipeOwned()) {
      const ready = G.forceWipeCd <= 0;
      touchButtons.push(tb(VW - 58, VH - 66, 42, 'f', 'force', { ring: ready ? '#9cff9c' : '#46506a', ready }));
    }
  } else if (s === 'paused') {
    touchButtons.push(tb(VW / 2 - 96, VH / 2 + 104, 40, 'p', 'play', { ring: '#9cff9c' }));
    touchButtons.push(tb(VW / 2 + 96, VH / 2 + 104, 40, 'Escape', 'quit', { ring: '#ff8a8a' }));
    touchButtons.push(tb(VW - 42, 112, 24, 'm', 'mute'));
  } else if (s === 'hangar') {
    touchButtons.push(tb(52, 46, 28, 'Escape', 'back', { ring: '#7fa6d0' }));
  }
  for (const b of touchButtons) drawTouchButton(b);
}

// ============================================================================
//  MAIN LOOP
// ============================================================================
let last = 0;
function frame(ts) {
  const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016);
  last = ts;
  G.stateTime += dt;

  switch (G.state) {
    case 'title': updateTitle(dt); drawTitle(); break;
    case 'hangar': updateHangar(dt); drawHangar(); break;
    case 'play': updatePlay(dt); drawPlay(); break;
    case 'paused': updatePaused(dt); drawPaused(); break;
    case 'levelclear': updateEndScreen(dt); drawEndScreen(true); break;
    case 'shipdown': updateEndScreen(dt); drawEndScreen(false); break;
  }

  // vignette
  const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.35, VW / 2, VH / 2, VH * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);

  // on-screen touch controls (touch devices only), drawn above everything
  buildTouchButtons();

  // consume per-frame input flags
  pressed.clear();
  mouse.clicked = false;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

})();
