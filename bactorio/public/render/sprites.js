// All graphics are drawn by code: item icons, buildings and immune cells.
// Mods can describe an icon declaratively ({ shape, color, glyph }) or pass draw(ctx, r).
import { DX, DY } from '../sim/world.js';

const TAU = Math.PI * 2;

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; }
  else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function poly(ctx, n, r, rot = 0, inner = 0) {
  ctx.beginPath();
  const m = inner ? n * 2 : n;
  for (let i = 0; i < m; i++) {
    const a = rot + i * TAU / m, rr = inner && i % 2 ? inner : r;
    ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
}

function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Draw an icon centred on (0,0) with radius r.
export function drawShape(ctx, icon, r) {
  const c = icon.color || '#cccccc', dark = shade(c, -0.45), light = shade(c, 0.45);
  if (typeof icon.draw === 'function') { icon.draw(ctx, r); return; }
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.fillStyle = c; ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, r * 0.16);
  const fs = () => { ctx.fill(); ctx.stroke(); };
  switch (icon.shape) {
    case 'hex': poly(ctx, 6, r * 0.92, Math.PI / 6); fs(); ctx.fillStyle = light; poly(ctx, 6, r * 0.4, Math.PI / 6); ctx.fill(); break;
    case 'chain':
      for (const [x, y] of [[-0.48, 0.3], [0, -0.3], [0.48, 0.3]]) { ctx.beginPath(); ctx.arc(x * r, y * r, r * 0.36, 0, TAU); fs(); }
      break;
    case 'crystal':
      ctx.beginPath(); ctx.moveTo(0, -r * 0.95); ctx.lineTo(r * 0.7, -r * 0.2); ctx.lineTo(r * 0.45, r * 0.85); ctx.lineTo(-r * 0.45, r * 0.85); ctx.lineTo(-r * 0.7, -r * 0.2); ctx.closePath(); fs();
      ctx.strokeStyle = light; ctx.beginPath(); ctx.moveTo(0, -r * 0.95); ctx.lineTo(0, r * 0.3); ctx.moveTo(-r * 0.7, -r * 0.2); ctx.lineTo(0, r * 0.3); ctx.lineTo(r * 0.7, -r * 0.2); ctx.stroke();
      break;
    case 'bolt':
      rrect(ctx, -r * 0.55, -r * 0.9, r * 1.1, r * 1.8, r * 0.5); fs();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(r * 0.15, -r * 0.6); ctx.lineTo(-r * 0.3, r * 0.1); ctx.lineTo(0, r * 0.1); ctx.lineTo(-r * 0.15, r * 0.6); ctx.lineTo(r * 0.3, -r * 0.1); ctx.lineTo(0, -r * 0.1); ctx.closePath(); ctx.fill();
      break;
    case 'knot':
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU, rr = r * (0.72 + 0.2 * Math.sin(a * 3)); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.closePath(); fs();
      ctx.strokeStyle = light; ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0.5, 4.5); ctx.stroke();
      break;
    case 'rod': ctx.save(); ctx.rotate(-0.6); rrect(ctx, -r * 0.95, -r * 0.32, r * 1.9, r * 0.64, r * 0.3); fs(); ctx.restore(); break;
    case 'pac': ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r * 0.9, 0.6, TAU - 0.6); ctx.closePath(); fs(); break;
    case 'ring': ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, TAU); ctx.lineWidth = r * 0.55; ctx.strokeStyle = dark; ctx.stroke(); ctx.lineWidth = r * 0.32; ctx.strokeStyle = c; ctx.stroke(); break;
    case 'drop': ctx.beginPath(); ctx.moveTo(0, -r * 0.95); ctx.bezierCurveTo(r * 0.9, 0, r * 0.75, r * 0.9, 0, r * 0.9); ctx.bezierCurveTo(-r * 0.75, r * 0.9, -r * 0.9, 0, 0, -r * 0.95); fs(); ctx.fillStyle = light; ctx.beginPath(); ctx.arc(-r * 0.2, r * 0.3, r * 0.18, 0, TAU); ctx.fill(); break;
    case 'cube': rrect(ctx, -r * 0.75, -r * 0.75, r * 1.5, r * 1.5, r * 0.35); fs(); ctx.fillStyle = light; rrect(ctx, -r * 0.45, -r * 0.45, r * 0.5, r * 0.5, r * 0.15); ctx.fill(); break;
    case 'wave':
      for (const oy of [-0.35, 0.35]) {
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) { const x = (i / 12 * 2 - 1) * r * 0.9, y = oy * r + Math.sin(i / 12 * TAU * 1.5) * r * 0.2; ctx[i ? 'lineTo' : 'moveTo'](x, y); }
        ctx.lineWidth = r * 0.5; ctx.strokeStyle = dark; ctx.stroke(); ctx.lineWidth = r * 0.28; ctx.strokeStyle = c; ctx.stroke();
      }
      break;
    case 'spiral':
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) { const a = i / 40 * TAU * 2.2, rr = r * 0.12 + r * 0.8 * i / 40; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
      ctx.lineWidth = r * 0.42; ctx.strokeStyle = dark; ctx.stroke(); ctx.lineWidth = r * 0.22; ctx.strokeStyle = c; ctx.stroke();
      break;
    case 'diamond': poly(ctx, 4, r * 0.95); fs(); ctx.fillStyle = light; poly(ctx, 4, r * 0.4); ctx.fill(); break;
    case 'strand': case 'helix':
      for (const ph of icon.shape === 'helix' ? [0, Math.PI] : [0]) {
        ctx.beginPath();
        for (let i = 0; i <= 16; i++) { const y = (i / 16 * 2 - 1) * r * 0.9, x = Math.sin(i / 16 * TAU * 1.25 + ph) * r * 0.5; ctx[i ? 'lineTo' : 'moveTo'](x, y); }
        ctx.lineWidth = r * 0.44; ctx.strokeStyle = dark; ctx.stroke(); ctx.lineWidth = r * 0.24; ctx.strokeStyle = ph ? light : c; ctx.stroke();
      }
      break;
    case 'loop': ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0.5, TAU - 0.1); ctx.lineWidth = r * 0.5; ctx.strokeStyle = dark; ctx.stroke(); ctx.lineWidth = r * 0.28; ctx.strokeStyle = c; ctx.stroke(); ctx.fillStyle = light; ctx.beginPath(); ctx.arc(r * 0.62, 0, r * 0.2, 0, TAU); ctx.fill(); break;
    case 'spike': poly(ctx, 7, r * 0.98, -Math.PI / 2, r * 0.45); fs(); break;
    case 'pill': ctx.save(); ctx.rotate(-0.7); rrect(ctx, -r * 0.9, -r * 0.42, r * 1.8, r * 0.84, r * 0.42); fs(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.rect(0, -r * 0.3, r * 0.6, r * 0.6); ctx.fill(); ctx.restore(); break;
    case 'orb': ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, TAU); fs(); ctx.strokeStyle = shade(c, -0.2); ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, TAU); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.3, r * 0.16, 0, TAU); ctx.fill(); break;
    case 'seq':
      rrect(ctx, -r * 0.45, -r * 0.92, r * 0.9, r * 1.84, r * 0.4); ctx.fillStyle = '#e9f3f0'; ctx.fill();
      ctx.save(); ctx.clip(); ctx.fillStyle = c; ctx.fillRect(-r, -r * 0.1, r * 2, r * 1.2); ctx.restore();
      rrect(ctx, -r * 0.45, -r * 0.92, r * 0.9, r * 1.84, r * 0.4); ctx.strokeStyle = '#22312c'; ctx.stroke();
      break;
    default: ctx.beginPath(); ctx.arc(0, 0, r * 0.85, 0, TAU); fs();
  }
  if (icon.glyph) {
    ctx.fillStyle = icon.glyphColor || '#10201a'; ctx.font = `bold ${Math.round(r * 1.1)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(icon.glyph, 0, r * 0.06);
  }
}

// ---- cached sprites ---------------------------------------------------------------------
const cache = new Map();
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

export function itemSprite(reg, id, px) {
  const key = `i:${id}:${px}`;
  let c = cache.get(key);
  if (!c) {
    c = canvas(px, px);
    const ctx = c.getContext('2d');
    ctx.translate(px / 2, px / 2);
    drawShape(ctx, reg.items[id]?.icon || { color: '#999', glyph: '?' }, px / 2 - 1);
    cache.set(key, c);
  }
  return c;
}

const urls = new Map();
// data: URL of an icon for use in the DOM. kind = item | fluid | entity | tech | enemy | recipe
export function iconURL(reg, kind, id, px = 40) {
  const key = `${kind}:${id}:${px}`;
  let u = urls.get(key);
  if (u) return u;
  const c = canvas(px, px), ctx = c.getContext('2d');
  if (kind === 'item') { ctx.translate(px / 2, px / 2); drawShape(ctx, reg.items[id]?.icon || { glyph: '?' }, px / 2 - 2); }
  else if (kind === 'fluid') { ctx.translate(px / 2, px / 2); drawShape(ctx, { shape: 'drop', color: reg.fluids[id]?.color || '#888' }, px / 2 - 2); }
  else if (kind === 'recipe') {
    const r = reg.recipes[id], out = r && Object.keys(r.out || {})[0];
    ctx.translate(px / 2, px / 2);
    if (out) drawShape(ctx, reg.items[out].icon, px / 2 - 2);
    else drawShape(ctx, { shape: 'drop', color: reg.fluids[Object.keys(r?.fout || {})[0]]?.color || '#888' }, px / 2 - 2);
  } else if (kind === 'entity') {
    const p = reg.entities[id];
    if (p) {
      const s = p.size[0], tp = Math.floor((px - 4) / s);
      ctx.translate((px - tp * s) / 2, (px - tp * s) / 2);
      drawEntity(ctx, null, fakeEntity(p), tp, 0, reg);
    }
  } else if (kind === 'enemy') { ctx.translate(px / 2, px / 2); drawEnemy(ctx, { id: 1, type: id, hp: 1 }, reg.enemies[id], px * 0.8, 0); }
  else if (kind === 'tech') {
    const t = reg.techs[id];
    const e = t?.unlock?.entities?.[0], r = t?.unlock?.recipes?.[0];
    if (t?.icon) { ctx.translate(px / 2, px / 2); drawShape(ctx, t.icon, px / 2 - 2); }
    else if (e) return iconURL(reg, 'entity', e, px);
    else if (r) return iconURL(reg, 'recipe', r, px);
    else { ctx.translate(px / 2, px / 2); drawShape(ctx, { shape: 'helix', color: BONUS_COLORS[Object.keys(t?.bonus || {})[0]] || '#9be7c4' }, px / 2 - 3); }
  }
  u = c.toDataURL();
  urls.set(key, u);
  return u;
}
const BONUS_COLORS = { minerSpeed: '#e0b84c', craftSpeed: '#eb5757', pilusSpeed: '#56ccf2', turretDamage: '#ff4d6d', filmRadius: '#9be7c4', resist: '#1dd1a1', hp: '#b8a98a', beltSpeed: '#3fa7d6' };

function fakeEntity(p) {
  return { id: 1, type: p.id, x: 0, y: 0, dir: 0, hp: p.hp || 100, _p: p, items: [], out: {}, inp: {}, inv: {}, n: 0, ammo: 5, mode: 'in', _icon: true };
}

// ---- buildings --------------------------------------------------------------------------
function body(ctx, S, color, pad = 0.08, round = 0.3) {
  const p = S * pad;
  rrect(ctx, p, p, S - p * 2, S - p * 2, S * round);
  const g = ctx.createRadialGradient(S * 0.4, S * 0.35, S * 0.05, S * 0.5, S * 0.5, S * 0.75);
  g.addColorStop(0, shade(color, 0.35)); g.addColorStop(1, shade(color, -0.25));
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(1.5, S * 0.035); ctx.strokeStyle = shade(color, -0.6); ctx.stroke();
}

function arrow(ctx, S, dir, color = 'rgba(255,255,255,0.85)') {
  ctx.save();
  ctx.translate(S / 2, S / 2); ctx.rotate(dir * Math.PI / 2);
  const a = Math.min(S * 0.16, 12);
  ctx.beginPath(); ctx.moveTo(S / 2 - 1, 0); ctx.lineTo(S / 2 - 1 - a, -a * 0.8); ctx.lineTo(S / 2 - 1 - a, a * 0.8); ctx.closePath();
  ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.stroke();
  ctx.restore();
}

function blob(ctx, x, y, r, color, t = 0, n = 0) {
  ctx.beginPath();
  for (let i = 0; i <= 16; i++) {
    const a = i / 16 * TAU, rr = r * (1 + 0.08 * Math.sin(a * 3 + t * 2 + n));
    ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

const DRAW = {
  core(ctx, w, e, p, S, t) {
    body(ctx, S, p.color, 0.04, 0.38);
    const pulse = 1 + 0.06 * Math.sin(t * 2);
    blob(ctx, S / 2, S / 2, S * 0.24 * pulse, shade(p.color, -0.45), t);
    blob(ctx, S / 2, S / 2, S * 0.13 * pulse, '#f6ffd9', t, 2);
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 0.3; ctx.beginPath(); ctx.arc(S / 2 + Math.cos(a) * S * 0.34, S / 2 + Math.sin(a) * S * 0.34, S * 0.035, 0, TAU); ctx.fillStyle = shade(p.color, 0.5); ctx.fill(); }
  },
  node(ctx, w, e, p, S, t) {
    blob(ctx, S / 2, S / 2, S * 0.4, shade(p.color, -0.2), t, e.id);
    blob(ctx, S / 2, S / 2, S * 0.24, shade(p.color, 0.35), t, e.id + 1);
    ctx.strokeStyle = shade(p.color, -0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.4, 0, TAU); ctx.stroke();
  },
  storage(ctx, w, e, p, S) {
    body(ctx, S, p.color, 0.08, 0.5);
    const f = Math.min(1, (e.n || 0) / (p.capacity || 1));
    ctx.save(); rrect(ctx, S * 0.2, S * 0.2, S * 0.6, S * 0.6, S * 0.3); ctx.clip();
    ctx.fillStyle = 'rgba(8,30,40,0.55)'; ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = shade(p.color, 0.5); ctx.fillRect(0, S * 0.8 - S * 0.6 * f, S, S);
    ctx.restore();
  },
  belt(ctx, w, e, p, S, t) {
    const dark = shade(p.color, -0.55);
    ctx.fillStyle = dark; rrect(ctx, 1, 1, S - 2, S - 2, S * 0.18); ctx.fill();
    ctx.save(); ctx.translate(S / 2, S / 2);
    const din = e._in ?? e.dir, bend = din !== e.dir && !p.tunnel;
    ctx.strokeStyle = shade(p.color, 0.25); ctx.lineWidth = Math.max(1.5, S * 0.09); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const ph = (t * p.speed) % 1;
    if (!bend) {
      ctx.rotate(e.dir * Math.PI / 2);
      for (let i = -1; i < 2; i++) {
        const x = (i + ph) * S * 0.5 - S * 0.12;
        if (x < -S * 0.42 || x > S * 0.34) continue;
        ctx.beginPath(); ctx.moveTo(x - S * 0.1, -S * 0.2); ctx.lineTo(x + S * 0.08, 0); ctx.lineTo(x - S * 0.1, S * 0.2); ctx.stroke();
      }
      if (p.tunnel) {
        ctx.fillStyle = '#0b1512'; ctx.beginPath();
        const x = e.mode === 'out' ? -S * 0.5 : S * 0.5;
        ctx.arc(x, 0, S * 0.36, e.mode === 'out' ? -Math.PI / 2 : Math.PI / 2, e.mode === 'out' ? Math.PI / 2 : Math.PI * 1.5); ctx.fill();
        ctx.strokeStyle = shade(p.color, 0.3); ctx.lineWidth = Math.max(2, S * 0.08); ctx.stroke();
      }
    } else {
      // a bend: an arc from the entry side to the exit side
      const ax = -DX[din] * S / 2, ay = -DY[din] * S / 2, bx = DX[e.dir] * S / 2, by = DY[e.dir] * S / 2;
      ctx.beginPath(); ctx.moveTo(ax * 0.8, ay * 0.8); ctx.quadraticCurveTo(0, 0, bx * 0.8, by * 0.8); ctx.stroke();
      ctx.rotate(e.dir * Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(S * 0.18, -S * 0.16); ctx.lineTo(S * 0.36, 0); ctx.lineTo(S * 0.18, S * 0.16); ctx.stroke();
    }
    ctx.restore();
  },
  splitter(ctx, w, e, p, S) {
    body(ctx, S, p.color, 0.06, 0.25);
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(e.dir * Math.PI / 2);
    ctx.strokeStyle = '#10201a'; ctx.lineWidth = Math.max(1.5, S * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-S * 0.3, 0); ctx.lineTo(S * 0.3, 0); ctx.moveTo(0, 0); ctx.lineTo(0, -S * 0.3); ctx.moveTo(0, 0); ctx.lineTo(0, S * 0.3); ctx.stroke();
    ctx.restore();
  },
  pilus(ctx, w, e, p, S) {
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.3, 0, TAU);
    ctx.fillStyle = shade(p.color, -0.3); ctx.fill(); ctx.lineWidth = Math.max(1.5, S * 0.05); ctx.strokeStyle = shade(p.color, -0.65); ctx.stroke();
    if (p.filter && e.filter && w) { const sp = itemSprite(w.reg, e.filter, Math.max(8, Math.round(S * 0.36))); ctx.drawImage(sp, S / 2 - sp.width / 2, S / 2 - sp.height / 2); }
  },
  miner(ctx, w, e, p, S, t) {
    body(ctx, S, p.color);
    const spin = e.empty || e._icon ? 0 : t * 1.5;
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(spin);
    ctx.strokeStyle = shade(p.color, -0.6); ctx.lineWidth = Math.max(1.5, S * 0.05); ctx.lineCap = 'round';
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * S * 0.14, Math.sin(a) * S * 0.14); ctx.lineTo(Math.cos(a + 0.4) * S * 0.3, Math.sin(a + 0.4) * S * 0.3); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, S * 0.13, 0, TAU); ctx.fillStyle = shade(p.color, 0.5); ctx.fill();
    ctx.restore();
    arrow(ctx, S, e.dir);
  },
  crafter(ctx, w, e, p, S, t) {
    body(ctx, S, p.color);
    const r = w && w.reg.recipes[e.recipe];
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.27, 0, TAU); ctx.fillStyle = 'rgba(8,24,20,0.55)'; ctx.fill();
    if (r && e.busy) {
      ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.27, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, e.prog / (r.time * 60)));
      ctx.strokeStyle = '#eaffd0'; ctx.lineWidth = Math.max(2, S * 0.05); ctx.stroke();
    }
    if (r) {
      const out = Object.keys(r.out || {})[0], px = Math.max(8, Math.round(S * 0.36));
      if (out) { const sp = itemSprite(w.reg, out, px); ctx.drawImage(sp, S / 2 - px / 2, S / 2 - px / 2); }
      else { ctx.save(); ctx.translate(S / 2, S / 2); drawShape(ctx, { shape: 'drop', color: w.reg.fluids[Object.keys(r.fout || {})[0]]?.color || '#888' }, px / 2); ctx.restore(); }
    } else if (!e._icon) {
      ctx.fillStyle = '#ffd166'; ctx.font = `bold ${Math.round(S * 0.3)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', S / 2, S / 2 + 1);
    } else {
      // in menus: a small symbol of what kind of work the building does
      const sym = p.icon || { ferment: { shape: 'bolt' }, assemble: { shape: 'knot' }, react: { shape: 'drop' }, spore: { shape: 'orb' } }[p.category] || { shape: 'hex' };
      ctx.save(); ctx.translate(S / 2, S / 2); drawShape(ctx, { color: shade(p.color, 0.6), ...sym }, S * 0.17); ctx.restore();
    }
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU + (e.busy ? t : 0) * 0.8; ctx.beginPath(); ctx.arc(S / 2 + Math.cos(a) * S * 0.37, S / 2 + Math.sin(a) * S * 0.37, S * 0.035, 0, TAU); ctx.fillStyle = shade(p.color, 0.55); ctx.fill(); }
    if (e._state && e._state !== 'input' && !e.busy) { ctx.beginPath(); ctx.arc(S * 0.84, S * 0.16, Math.max(3, S * 0.06), 0, TAU); ctx.fillStyle = '#ff5d5d'; ctx.fill(); }
    if (!p.launch) arrow(ctx, S, e.dir);
  },
  generator(ctx, w, e, p, S, t) {
    body(ctx, S, p.color);
    const on = (e._load || 0) > 0;
    const k = on ? 0.75 + 0.25 * Math.sin(t * 9 + e.id) : 0.35;
    ctx.save(); ctx.translate(S / 2, S / 2);
    ctx.fillStyle = `rgba(255,236,120,${k})`;
    ctx.beginPath(); ctx.moveTo(S * 0.06, -S * 0.3); ctx.lineTo(-S * 0.16, S * 0.04); ctx.lineTo(-S * 0.01, S * 0.04); ctx.lineTo(-S * 0.08, S * 0.3); ctx.lineTo(S * 0.16, -S * 0.06); ctx.lineTo(S * 0.01, -S * 0.06); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,0,0.7)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
  },
  solar(ctx, w, e, p, S, t) {
    const lit = !w || w.light[e.y * w.w + e.x];
    body(ctx, S, lit ? p.color : shade(p.color, -0.35));
    for (const [x, y] of [[0.33, 0.35], [0.66, 0.4], [0.42, 0.68], [0.7, 0.7]]) {
      ctx.save(); ctx.translate(S * x, S * y); ctx.rotate(x * 9 + (lit ? Math.sin(t + x * 7) * 0.2 : 0));
      rrect(ctx, -S * 0.11, -S * 0.06, S * 0.22, S * 0.12, S * 0.06); ctx.fillStyle = lit ? '#d8ff8a' : '#6b8f52'; ctx.fill(); ctx.restore();
    }
  },
  accumulator(ctx, w, e, p, S) {
    body(ctx, S, shade(p.color, -0.3));
    const f = w && w.power.cap ? w.power.stored / w.power.cap : 0;
    rrect(ctx, S * 0.28, S * 0.2, S * 0.44, S * 0.6, S * 0.1); ctx.fillStyle = 'rgba(8,24,20,0.6)'; ctx.fill();
    ctx.fillStyle = p.color; ctx.fillRect(S * 0.32, S * 0.76 - S * 0.52 * f, S * 0.36, S * 0.52 * f);
  },
  lab(ctx, w, e, p, S, t) {
    body(ctx, S, p.color);
    ctx.save(); ctx.translate(S / 2, S / 2);
    drawShape(ctx, { shape: 'helix', color: e.unit > 0 ? '#eaffd0' : '#9fc5e8' }, S * 0.3);
    if (e.unit > 0) { ctx.rotate(t * 2); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(1.5, S * 0.03); ctx.beginPath(); ctx.arc(0, 0, S * 0.38, 0, 1.6); ctx.stroke(); }
    ctx.restore();
  },
  turret(ctx, w, e, p, S, t) {
    body(ctx, S, shade(p.color, -0.35), 0.08, 0.5);
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(p.splash ? t * 1.2 : (e._ang ?? e.id));
    if (p.splash) { ctx.fillStyle = p.color; poly(ctx, 8, S * 0.3, 0, S * 0.14); ctx.fill(); }
    else {
      ctx.fillStyle = p.color; rrect(ctx, 0, -S * 0.07, S * 0.42, S * 0.14, S * 0.05); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, S * 0.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
    if (p.ammo && !e.ammo && !e._icon) { ctx.fillStyle = '#ffd166'; ctx.font = `bold ${Math.round(S * 0.3)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', S * 0.82, S * 0.2); }
  },
  wall(ctx, w, e, p, S) { body(ctx, S, p.color, 0.03, 0.2); ctx.fillStyle = shade(p.color, -0.3); rrect(ctx, S * 0.25, S * 0.25, S * 0.5, S * 0.5, S * 0.12); ctx.fill(); },
  pipe(ctx, w, e, p, S) {
    const s = p.size[0];
    if (s > 1) {
      body(ctx, S, p.color, 0.08, 0.5);
      const n = e._net, f = n && n.cap ? n.amt / n.cap : 0;
      ctx.save(); ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.3, 0, TAU); ctx.clip();
      ctx.fillStyle = 'rgba(8,24,30,0.7)'; ctx.fillRect(0, 0, S, S);
      if (n && n.fluid && w) { ctx.fillStyle = w.reg.fluids[n.fluid]?.color || '#888'; ctx.fillRect(0, S * 0.8 - S * 0.6 * f, S, S); }
      ctx.restore();
      return;
    }
    pipeArms(ctx, w, e, p, S);
  },
  pump(ctx, w, e, p, S, t) {
    pipeArms(ctx, w, e, p, S);
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.32, 0, TAU); ctx.fillStyle = shade(p.color, -0.3); ctx.fill(); ctx.strokeStyle = shade(p.color, -0.65); ctx.lineWidth = Math.max(1.5, S * 0.05); ctx.stroke();
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(t * 3); ctx.strokeStyle = '#dff3ff'; ctx.lineWidth = Math.max(1.5, S * 0.06);
    ctx.beginPath(); ctx.moveTo(-S * 0.18, 0); ctx.lineTo(S * 0.18, 0); ctx.moveTo(0, -S * 0.18); ctx.lineTo(0, S * 0.18); ctx.stroke(); ctx.restore();
  },
  cleaner(ctx, w, e, p, S, t) {
    body(ctx, S, p.color, 0.08, 0.5);
    ctx.save(); ctx.translate(S / 2, S / 2); ctx.rotate(-t * 1.5); ctx.strokeStyle = '#eafff8'; ctx.lineWidth = Math.max(1.5, S * 0.05); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.arc(S * 0.1, 0, S * 0.18, 0.3, 2.6); ctx.stroke(); }
    ctx.restore();
  },
  nest(ctx, w, e, p, S, t) {
    blob(ctx, S / 2, S / 2, S * 0.46, '#8e7aa8', t * 0.6, e.id);
    blob(ctx, S / 2, S / 2, S * 0.34, p.color, t, e.id + 3);
    const k = 0.5 + 0.5 * Math.sin(t * 2.5);
    ctx.beginPath(); ctx.arc(S / 2, S / 2, S * (0.12 + 0.03 * k), 0, TAU); ctx.fillStyle = `rgba(214,48,92,${0.6 + 0.4 * k})`; ctx.fill();
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + t * 0.4; ctx.beginPath(); ctx.arc(S / 2 + Math.cos(a) * S * 0.24, S / 2 + Math.sin(a) * S * 0.24, S * 0.04, 0, TAU); ctx.fillStyle = '#6c5b7b'; ctx.fill(); }
  },
};

function pipeArms(ctx, w, e, p, S) {
  const n = e._net, col = n && n.fluid && n.amt > 0.5 && w ? w.reg.fluids[n.fluid]?.color : null;
  const arms = [];
  if (w) for (let d = 0; d < 4; d++) { const t = w.entAt(e.x + DX[d], e.y + DY[d]); if (t && (t._p.fluidCap || t._p.fluidUser)) arms.push(d); }
  if (!arms.length) arms.push(0, 2);
  ctx.save(); ctx.translate(S / 2, S / 2); ctx.lineCap = 'round';
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass ? (col || '#22343a') : shade(p.color, -0.2); ctx.lineWidth = pass ? S * 0.2 : S * 0.42;
    ctx.beginPath();
    for (const d of arms) { ctx.moveTo(0, 0); ctx.lineTo(DX[d] * S / 2, DY[d] * S / 2); }
    ctx.stroke();
  }
  ctx.restore();
}

// Draw one building in a box of size*px, origin at its top-left tile.
export function drawEntity(ctx, w, e, px, t, reg) {
  const p = e._p, S = p.size[0] * px;
  const custom = p.draw;
  if (typeof custom === 'function') { custom(ctx, e, S, t, w); return; }
  const fn = DRAW[p.sprite || p.kind];
  if (fn) fn(ctx, w, e, p, S, t);
  else {
    body(ctx, S, p.color || '#888');
    if (p.icon) { ctx.save(); ctx.translate(S / 2, S / 2); drawShape(ctx, p.icon, S * 0.28); ctx.restore(); }
  }
  void reg;
}

// Arm of a pilus, drawn above items. Returns nothing.
export function drawPilusArm(ctx, w, e, px, t) {
  const p = e._p, r = p.reach || 1;
  const swing = Math.max(4, Math.round(p.swing / (1 + (w.bonus.pilusSpeed || 0))));
  const k = e.t > 0 ? 1 - e.t / swing : 1;       // 0..1 progress of the current move
  const f = e.held ? k * 2 - 1 : 1 - k * 2;      // -1 = over the source, +1 = over the target
  const cx = px / 2, cy = px / 2, tx = cx + DX[e.dir] * px * r * f * 0.85, ty = cy + DY[e.dir] * px * r * f * 0.85;
  ctx.strokeStyle = shade(p.color, 0.1); ctx.lineWidth = Math.max(2, px * 0.1); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo((cx + tx) / 2 + DY[e.dir] * px * 0.12 * Math.sin(t * 3 + e.id), (cy + ty) / 2 + DX[e.dir] * px * 0.12 * Math.sin(t * 3 + e.id), tx, ty); ctx.stroke();
  ctx.beginPath(); ctx.arc(tx, ty, Math.max(2, px * 0.09), 0, TAU); ctx.fillStyle = shade(p.color, 0.4); ctx.fill();
  if (e.held) { const sp = itemSprite(w.reg, e.held, Math.max(8, Math.round(px * 0.42))); ctx.drawImage(sp, tx - sp.width / 2, ty - sp.height / 2); }
}

// ---- immune cells -----------------------------------------------------------------------
export function drawEnemy(ctx, u, p, px, t) {
  if (!p) return;
  const r = (p.size || 0.8) * px / 2;
  if (typeof p.draw === 'function') { p.draw(ctx, u, r, t); return; }
  if (p.infect) {
    // bacteriophage: a head on thin legs
    ctx.strokeStyle = shade(p.color, -0.4); ctx.lineWidth = Math.max(1, r * 0.14);
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(0, r * 0.1); ctx.lineTo(i * r * 0.8, r * (0.9 + 0.1 * Math.sin(t * 12 + u.id + i))); ctx.stroke(); }
    poly(ctx, 6, r * 0.6, Math.PI / 6); ctx.save(); ctx.translate(0, -r * 0.35); poly(ctx, 6, r * 0.6, Math.PI / 6); ctx.fillStyle = p.color; ctx.fill(); ctx.stroke(); ctx.restore();
    return;
  }
  blob(ctx, 0, 0, r, shade(p.color, -0.15), t * 2, u.id);
  ctx.strokeStyle = shade(p.color, -0.55); ctx.lineWidth = Math.max(1, r * 0.1); ctx.stroke();
  blob(ctx, r * 0.1, -r * 0.05, r * 0.45, '#7d5ba6', t, u.id + 2);
  if (r > 7) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-r * 0.3, -r * 0.3, r * 0.14, 0, TAU); ctx.fill(); }
}
