// Canvas renderer: camera, map layers, buildings, items, immune cells and effects.
import { DX, DY, T_WATER, T_ROCK, CHUNK } from '../sim/world.js';
import { outTile } from '../sim/belts.js';
import { drawEntity, drawPilusArm, drawEnemy, itemSprite, shade } from './sprites.js';

const TAU = Math.PI * 2;

export class Renderer {
  constructor(canvas, app) {
    this.cv = canvas; this.ctx = canvas.getContext('2d'); this.app = app;
    this.cam = { x: 0, y: 0, px: 32 };
    this.fx = []; this.resSprites = new Map(); this.entSprites = new Map();
    this.terrainMask = null; this.filmMask = null; this.mapRev = -1; this.filmRev = -1;
    this.dpr = 1; this.W = 0; this.H = 0;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = this.cv.clientWidth, H = this.cv.clientHeight;
    if (this.cv.width !== Math.round(W * dpr) || this.cv.height !== Math.round(H * dpr)) { this.cv.width = Math.round(W * dpr); this.cv.height = Math.round(H * dpr); }
    this.dpr = dpr; this.W = W; this.H = H;
  }

  setWorld(w) {
    this.w = w; this.fx = []; this.mapRev = -1; this.filmRev = -1;
    if (w.core) { this.cam.x = w.core.x + 2; this.cam.y = w.core.y + 2; }
    this.cam.px = 32;
  }

  toTile(sx, sy) { const c = this.cam; return [(sx - this.W / 2) / c.px + c.x, (sy - this.H / 2) / c.px + c.y]; }
  toScreen(tx, ty) { const c = this.cam; return [(tx - c.x) * c.px + this.W / 2, (ty - c.y) * c.px + this.H / 2]; }

  zoom(factor, sx, sy) {
    const c = this.cam, [tx, ty] = this.toTile(sx, sy);
    c.px = Math.max(10, Math.min(72, c.px * factor));
    c.x = tx - (sx - this.W / 2) / c.px; c.y = ty - (sy - this.H / 2) / c.px;
    this.clamp();
  }

  clamp() { const c = this.cam, w = this.w; if (!w) return; c.x = Math.max(0, Math.min(w.w, c.x)); c.y = Math.max(0, Math.min(w.h, c.y)); }

  // ---- low-resolution masks, drawn scaled up with smoothing for a soft organic look ----
  // Soften a low-resolution mask. (Browsers without canvas filters just keep the hard edges.)
  soften(src, radius, background) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    if (background) { g.fillStyle = background; g.fillRect(0, 0, c.width, c.height); }
    g.filter = `blur(${radius}px)`;
    g.drawImage(src, 0, 0);
    return c;
  }

  buildTerrain() {
    const w = this.w, R = 4, c = document.createElement('canvas');
    c.width = w.w * R; c.height = w.h * R;
    const g = c.getContext('2d');
    g.fillStyle = '#12261f'; g.fillRect(0, 0, c.width, c.height);
    // large soft patches so the ground is not one flat colour (same for a given map)
    let s = (w.seed * 2654435761) >>> 0;
    const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < w.w * w.h / 120; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(30,62,50,0.5)' : 'rgba(8,20,16,0.5)';
      g.beginPath(); g.arc(rnd() * c.width, rnd() * c.height, (1.5 + rnd() * 4) * R, 0, TAU); g.fill();
    }
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      if (w.light[y * w.w + x] && !w.terrain[y * w.w + x]) { g.fillStyle = 'rgba(88,128,70,0.42)'; g.fillRect(x * R, y * R, R, R); }
    }
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
      const t = w.terrain[y * w.w + x], n = ((x * 73856093) ^ (y * 19349663)) >>> 0;
      if (t === T_WATER) g.fillStyle = (n % 5) ? '#1f6f9c' : '#2f8fc2';
      else if (t === T_ROCK) g.fillStyle = (n % 3) ? '#3b3a44' : '#514e5c';
      else continue;
      g.fillRect(x * R, y * R, R, R);
    }
    this.terrainMask = this.soften(c, R * 0.55, '#12261f'); this.mapRev = w.mapRev;
  }

  buildFilm() {
    const w = this.w, R = 4;
    const c = this.filmRaw || (this.filmRaw = document.createElement('canvas'));
    c.width = w.w * R; c.height = w.h * R;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.fillStyle = '#7fe0a8';
    for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) if (w.film[y * w.w + x]) g.fillRect(x * R, y * R, R, R);
    this.filmMask = this.soften(c, R * 0.45); this.filmRev = w.filmRev;
  }

  // Pre-rendered building sprites. Pathways always use them (4 animation frames); every other
  // building uses one when zoomed far out, where details would not be visible anyway.
  entSprite(e, ipx, frame) {
    const p = e._p, din = e._in ?? e.dir;
    const key = `${e.type}|${e.dir}|${din}|${e.mode || ''}|${ipx}|${frame}`;
    let c = this.entSprites.get(key);
    if (c) return c;
    if (this.entSprites.size > 900) this.entSprites.clear();
    const S = p.size[0] * ipx;
    c = document.createElement('canvas'); c.width = S; c.height = S;
    const proxy = { id: 1, type: e.type, x: 0, y: 0, dir: e.dir, _in: din, mode: e.mode, hp: p.hp, _p: p, items: [], out: {}, inp: {}, inv: {}, n: 0, ammo: 1, _icon: true };
    drawEntity(c.getContext('2d'), null, proxy, ipx, p.kind === 'belt' ? frame / (4 * (p.speed || 1)) : 0);
    this.entSprites.set(key, c);
    return c;
  }

  resSprite(idx, px) {
    const key = idx + ':' + px;
    let c = this.resSprites.get(key);
    if (c) return c;
    if (this.resSprites.size > 200) this.resSprites.clear();
    const col = this.w.reg.resources[this.w.reg.resIds[idx]]?.color || '#888';
    c = document.createElement('canvas'); c.width = px; c.height = px;
    const g = c.getContext('2d');
    for (const [x, y, r] of [[0.28, 0.3, 0.2], [0.68, 0.36, 0.16], [0.42, 0.7, 0.18], [0.76, 0.76, 0.11]]) {
      g.beginPath(); g.arc(x * px, y * px, r * px, 0, TAU);
      g.fillStyle = col; g.fill(); g.lineWidth = Math.max(1, px * 0.04); g.strokeStyle = shade(col, -0.5); g.stroke();
      g.beginPath(); g.arc((x - r * 0.3) * px, (y - r * 0.3) * px, r * 0.3 * px, 0, TAU); g.fillStyle = shade(col, 0.5); g.fill();
    }
    this.resSprites.set(key, c);
    return c;
  }

  // ---- effects coming from the simulation -----------------------------------------------
  takeEffects() {
    const w = this.w;
    for (const f of w.fx) {
      if (f.t === 'shot') {
        const e = w.entAt(Math.floor(f.x - 0.01), Math.floor(f.y - 0.01));
        if (e) e._ang = Math.atan2(f.y2 - f.y, f.x2 - f.x);
        this.fx.push({ ...f, life: 0.12, max: 0.12 });
      } else if (f.t === 'boom') this.fx.push({ ...f, life: 0.5, max: 0.5 });
      else if (f.t === 'pop' || f.t === 'bite' || f.t === 'infect') this.fx.push({ ...f, life: 0.3, max: 0.3 });
      else if (f.t === 'spray') this.fx.push({ ...f, life: 0.35, max: 0.35 });
      else if (f.t === 'launch') this.fx.push({ ...f, life: 2.5, max: 2.5 });
      this.app.onEffect?.(f);
    }
    w.fx.length = 0;
    if (this.fx.length > 400) this.fx.splice(0, this.fx.length - 400);
  }

  draw(time, dt) {
    const w = this.w, ctx = this.ctx, c = this.cam, app = this.app;
    if (!w) return;
    this.resize();
    if (this.mapRev !== w.mapRev || !this.terrainMask) this.buildTerrain();
    if (this.filmRev !== w.filmRev || !this.filmMask) this.buildFilm();
    this.takeEffects();
    const px = c.px, W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#081511'; ctx.fillRect(0, 0, W, H);
    const ox = W / 2 - c.x * px, oy = H / 2 - c.y * px;   // screen position of tile (0,0)
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.terrainMask, ox, oy, w.w * px, w.h * px);
    ctx.globalAlpha = 0.2; ctx.drawImage(this.filmMask, ox, oy, w.w * px, w.h * px); ctx.globalAlpha = 1;

    const x0 = Math.max(0, Math.floor(-ox / px)), y0 = Math.max(0, Math.floor(-oy / px));
    const x1 = Math.min(w.w - 1, Math.floor((W - ox) / px)), y1 = Math.min(w.h - 1, Math.floor((H - oy) / px));
    const ipx = Math.round(px);

    // deposits
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const k = y * w.w + x, r = w.res[k];
      if (!r || w.occ[k]) continue;
      ctx.globalAlpha = 0.55 + 0.45 * Math.min(1, w.resAmt[k] / 300);
      ctx.drawImage(this.resSprite(r, ipx), ox + x * px, oy + y * px, px, px);
    }
    ctx.globalAlpha = 1;

    if (app.showTox) {
      for (let cy = Math.floor(y0 / CHUNK); cy <= Math.floor(y1 / CHUNK); cy++) for (let cx = Math.floor(x0 / CHUNK); cx <= Math.floor(x1 / CHUNK); cx++) {
        const v = w.tox[cy * w.cw + cx];
        if (v < 0.2) continue;
        ctx.fillStyle = `rgba(200,70,230,${Math.min(0.6, v / 30)})`;
        ctx.fillRect(ox + cx * CHUNK * px, oy + cy * CHUNK * px, CHUNK * px, CHUNK * px);
      }
    }
    if ((app.tool || app.settings.grid) && px >= 18) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = x0; x <= x1 + 1; x++) { ctx.moveTo(Math.round(ox + x * px) + 0.5, oy + y0 * px); ctx.lineTo(Math.round(ox + x * px) + 0.5, oy + (y1 + 1) * px); }
      for (let y = y0; y <= y1 + 1; y++) { ctx.moveTo(ox + x0 * px, Math.round(oy + y * px) + 0.5); ctx.lineTo(ox + (x1 + 1) * px, Math.round(oy + y * px) + 0.5); }
      ctx.stroke();
    }

    // buildings
    const belts = [], pili = [], bars = [], far = px < 20;
    const seen = this._seen || (this._seen = new Set());
    seen.clear();
    for (let y = Math.max(0, y0 - 3); y <= y1; y++) for (let x = Math.max(0, x0 - 3); x <= x1; x++) {
      const id = w.occ[y * w.w + x];
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const e = w.ents.get(id);
      if (!e) continue;
      const p = e._p, dormant = !p.enemy && !w.film[e.y * w.w + e.x], sick = e.dis > w.tick;
      ctx.save();
      ctx.translate(ox + e.x * px, oy + e.y * px);
      if (dormant) ctx.globalAlpha = 0.45;
      if (p.draw) drawEntity(ctx, w, e, px, time);
      else if (p.kind === 'belt') ctx.drawImage(this.entSprite(e, ipx, far ? 0 : Math.floor(time * p.speed * 4) & 3), 0, 0, px, px);
      else if (far) ctx.drawImage(this.entSprite(e, ipx, 0), 0, 0, p.size[0] * px, p.size[0] * px);
      else drawEntity(ctx, w, e, px, time);
      if (sick) { const S = p.size[0] * px; ctx.strokeStyle = `rgba(110,190,255,${0.6 + 0.4 * Math.sin(time * 10)})`; ctx.lineWidth = 3; ctx.strokeRect(2, 2, S - 4, S - 4); }
      ctx.restore();
      if (p.kind === 'belt') belts.push(e); else if (p.kind === 'pilus') pili.push(e);
      const max = w.maxHp(p);
      if (e.hp < max) bars.push(e, e.hp / max);
    }

    // items riding the pathways
    if (px >= 12) {
      const isz = Math.max(8, Math.round(px * 0.44));
      for (const e of belts) {
        const its = e.items;
        if (!its.length) continue;
        const tun = e._p.tunnel, din = tun ? e.dir : (e._in ?? e.dir);
        const cx = ox + (e.x + 0.5) * px, cy = oy + (e.y + 0.5) * px;
        for (let i = 0; i < its.length; i++) {
          let p = its[i][1];
          if (tun) { if (e.mode === 'in' ? p > 0.45 : p < 0.55) continue; }
          let sx, sy;
          if (p < 0.5) { const k = (0.5 - p) * px; sx = cx - DX[din] * k; sy = cy - DY[din] * k; }
          else { const k = (Math.min(p, 1) - 0.5) * px; sx = cx + DX[e.dir] * k; sy = cy + DY[e.dir] * k; }
          const sp = itemSprite(w.reg, its[i][0], isz);
          ctx.drawImage(sp, sx - isz / 2, sy - isz / 2);
        }
      }
    }
    if (!far) for (const e of pili) { ctx.save(); ctx.translate(ox + e.x * px, oy + e.y * px); drawPilusArm(ctx, w, e, px, time); ctx.restore(); }

    // immune cells
    for (const u of w.enemies) {
      const sx = ox + u.x * px, sy = oy + u.y * px;
      if (sx < -px || sy < -px || sx > W + px || sy > H + px) continue;
      const p = w.reg.enemies[u.type];
      ctx.save(); ctx.translate(sx, sy); drawEnemy(ctx, u, p, px, time); ctx.restore();
      if (p && u.hp < p.hp) bars.push({ x: u.x - 0.4, y: u.y - 0.1, _p: { size: [0.8] } }, u.hp / p.hp);
    }

    // health bars
    for (let i = 0; i < bars.length; i += 2) {
      const e = bars[i], f = bars[i + 1], S = e._p.size[0] * px;
      const bx = ox + e.x * px + S * 0.15, by = oy + (e.y + e._p.size[0]) * px - 5, bw = S * 0.7;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
      ctx.fillStyle = f > 0.5 ? '#7bed9f' : f > 0.25 ? '#ffd166' : '#ff5d5d'; ctx.fillRect(bx, by, bw * Math.max(0, f), 3);
    }

    this.drawEffects(ctx, ox, oy, px, dt);
    this.drawOverlay(ctx, ox, oy, px, time);

    if (w.antibiotic) { ctx.fillStyle = `rgba(120,200,255,${0.06 + 0.03 * Math.sin(time * 3)})`; ctx.fillRect(0, 0, W, H); }
  }

  drawEffects(ctx, ox, oy, px, dt) {
    const fx = this.fx;
    let j = 0;
    for (let i = 0; i < fx.length; i++) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) continue;
      fx[j++] = f;
      const k = f.life / f.max, x = ox + f.x * px, y = oy + f.y * px;
      if (f.t === 'shot') {
        ctx.strokeStyle = `rgba(255,120,150,${k})`; ctx.lineWidth = Math.max(1.5, px * 0.07);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ox + f.x2 * px, oy + f.y2 * px); ctx.stroke();
      } else if (f.t === 'boom') {
        ctx.strokeStyle = `rgba(255,200,120,${k})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, (1 - k) * px * (f.r || 1) * 1.2, 0, TAU); ctx.stroke();
      } else if (f.t === 'pop' || f.t === 'bite' || f.t === 'infect') {
        ctx.fillStyle = f.t === 'pop' ? `rgba(240,220,255,${k * 0.8})` : f.t === 'infect' ? `rgba(110,190,255,${k})` : `rgba(255,90,90,${k * 0.8})`;
        ctx.beginPath(); ctx.arc(x, y, (1.2 - k) * px * 0.5, 0, TAU); ctx.fill();
      } else if (f.t === 'spray') {
        ctx.fillStyle = `rgba(224,86,253,${k * 0.25})`; ctx.beginPath(); ctx.arc(x, y, f.r * px, 0, TAU); ctx.fill();
      } else if (f.t === 'launch') {
        const up = (1 - k) * px * 9;
        const sp = itemSprite(this.w.reg, 'spore', Math.max(10, Math.round(px * 0.9)));
        if (this.w.reg.items.spore) { ctx.globalAlpha = Math.min(1, k * 2); ctx.drawImage(sp, x - sp.width / 2 + Math.sin(k * 14) * px * 0.4, y - up - sp.height / 2); ctx.globalAlpha = 1; }
      }
    }
    fx.length = j;
  }

  // ghost of the building in hand, selection, ranges
  drawOverlay(ctx, ox, oy, px, time) {
    const w = this.w, app = this.app, m = app.mouse;
    const ring = (cx, cy, r, color) => { ctx.beginPath(); ctx.arc(ox + cx * px, oy + cy * px, r * px, 0, TAU); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]); };
    const sel = app.sel;
    if (sel && !sel.gone) {
      const s = sel._p.size[0];
      ctx.strokeStyle = '#fff3a8'; ctx.lineWidth = 2;
      ctx.strokeRect(ox + sel.x * px - 1, oy + sel.y * px - 1, s * px + 2, s * px + 2);
      if (sel._p.range) ring(sel.x + s / 2, sel.y + s / 2, sel._p.range + (w.bonus.turretRange || 0), 'rgba(255,120,150,0.8)');
      if (sel._p.film) ring(sel.x + s / 2, sel.y + s / 2, sel.fr || sel._p.film, 'rgba(127,224,168,0.8)');
    }
    const tool = app.tool;
    if (tool && m.inside) {
      const p = w.reg.entities[tool.type], s = p.size[0], off = (s - 1) >> 1;
      const tx = Math.floor(m.tx) - off, ty = Math.floor(m.ty) - off;
      const ok = w.canPlace(tool.type, tx, ty);
      const same = w.entAt(tx, ty);
      const fine = ok.ok || (same && same.type === tool.type && s === 1) || (same && same._p.kind === 'belt' && p.kind === 'belt' && !p.tunnel && !same._p.tunnel);
      const ghost = { id: 0, type: tool.type, x: tx, y: ty, dir: tool.dir, hp: p.hp, _p: p, items: [], out: {}, inp: {}, inv: {}, n: 0, mode: 'in', _icon: true };
      ctx.save(); ctx.translate(ox + tx * px, oy + ty * px); ctx.globalAlpha = 0.7; drawEntity(ctx, w, ghost, px, time); ctx.restore();
      ctx.fillStyle = fine ? 'rgba(120,255,170,0.18)' : 'rgba(255,70,70,0.35)';
      ctx.fillRect(ox + tx * px, oy + ty * px, s * px, s * px);
      app.ghostReason = fine ? null : ok.reason;
      if (p.film) ring(tx + s / 2, ty + s / 2, w.filmRadius(p), 'rgba(127,224,168,0.9)');
      if (p.range) ring(tx + s / 2, ty + s / 2, p.range + (w.bonus.turretRange || 0), 'rgba(255,120,150,0.8)');
      if (p.kind === 'pilus') {
        const r = p.reach || 1;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffd166'; ctx.strokeRect(ox + (tx - DX[tool.dir] * r) * px + 3, oy + (ty - DY[tool.dir] * r) * px + 3, px - 6, px - 6);
        ctx.strokeStyle = '#7bed9f'; ctx.strokeRect(ox + (tx + DX[tool.dir] * r) * px + 3, oy + (ty + DY[tool.dir] * r) * px + 3, px - 6, px - 6);
      }
      if (p.kind === 'miner' || (p.kind === 'crafter' && !p.launch)) {
        const [qx, qy] = outTile(ghost);
        ctx.strokeStyle = '#7bed9f'; ctx.lineWidth = 2; ctx.strokeRect(ox + qx * px + 3, oy + qy * px + 3, px - 6, px - 6);
      }
    } else app.ghostReason = null;
  }
}
