'use strict';
// Organism drawing, shared by the game, the profile avatar and the lab aquarium.
// Draw.body(ctx, o) draws one organism centred at (o.x, o.y), rotated by o.angle.
(function (root) {
  const C = root.CATALOG;
  let ctx = null;        // the canvas being drawn on (set per call)
  let mode = null;       // colour mode from the equipped colour (rainbow, gold, ...)
  let modeT = 0;         // time, for animated modes
  let pattern = null;    // equipped membrane pattern id

  function drawPattern(r, t) {
    const lw = Math.max(1, r * 0.08);
    switch (pattern) {
      case 'p_dots':
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) {
          ctx.beginPath(); ctx.arc(i * r * 0.42 + (j % 2) * r * 0.21, j * r * 0.42, r * 0.09, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'p_stripes':
        ctx.save(); ctx.rotate(0.6); ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = r * 0.11;
        ctx.beginPath();
        for (let x = -r * 1.4; x <= r * 1.4; x += r * 0.34) { ctx.moveTo(x, -r * 1.5); ctx.lineTo(x, r * 1.5); }
        ctx.stroke(); ctx.restore();
        break;
      case 'p_rings':
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = r * 0.07;
        for (const k of [0.28, 0.56, 0.84]) { ctx.beginPath(); ctx.arc(0, 0, r * k, 0, Math.PI * 2); ctx.stroke(); }
        break;
      case 'p_tiger':
        ctx.strokeStyle = 'rgba(25,10,0,0.38)'; ctx.lineWidth = r * 0.13; ctx.lineCap = 'round';
        for (let k = -3; k <= 3; k++) {
          ctx.beginPath();
          for (let y = -r; y <= r; y += r / 6) {
            const x = k * r * 0.3 + Math.sin(y / r * 3 + k) * r * 0.08;
            if (y === -r) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        break;
      case 'p_crystal':
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = Math.max(1, r * 0.035);
        ctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = i / 7 * Math.PI * 2;
          ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); ctx.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1);
          const b = (i + 1) / 7 * Math.PI * 2;
          ctx.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5); ctx.lineTo(Math.cos(b) * r * 0.5, Math.sin(b) * r * 0.5);
        }
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.arc(-r * 0.25, -r * 0.25, r * 0.3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'p_swirl':
        ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = lw;
        ctx.beginPath();
        for (let a = 0; a < Math.PI * 6; a += 0.2) {
          const rr = r * a / (Math.PI * 6), x = Math.cos(a + t) * rr, y = Math.sin(a + t) * rr;
          if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        break;
      case 'p_stars':
        for (let i = 0; i < 6; i++) {
          const a = i * 2.4, d = r * (0.25 + (i % 3) * 0.25);
          ctx.fillStyle = `rgba(255,250,200,${0.35 + 0.35 * Math.sin(t * 3 + i)})`;
          star(Math.cos(a) * d, Math.sin(a) * d, r * 0.12);
        }
        break;
    }
  }
  function star(x, y, s) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? s * 0.45 : s;
      if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  }

  // Cosmetic colour modes bend every colour the body uses.
  function hsl(h, s, l, a = 1) {
    switch (mode) {
      case 'rainbow': h = (h + modeT * 90) % 360; s = Math.max(s, 75); break;
      case 'gold': h = 44 + (h % 12); s = Math.min(90, s + 10); l = Math.min(80, l + 4); break;
      case 'neon': s = 100; l = Math.min(72, l + 8); break;
      case 'shadow': s = s * 0.55; l = l * 0.42; break;
      case 'frost': h = 188 + (h % 24); s = s * 0.55; l = Math.min(92, l + 16); break;
    }
    return `hsla(${h},${s}%,${l}%,${a})`;
  }

  function blobPath(r, t, seed, wob = 0.06, n = 22) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (1 + wob * Math.sin(a * 3 + t * 2.1 + seed * 10) + wob * 0.6 * Math.sin(a * 5 - t * 1.7 + seed * 20));
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function cellFill(r, hue, light = 55) {
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, hsl(hue, 80, light + 20, 0.95));
    g.addColorStop(0.7, hsl(hue, 70, light, 0.85));
    g.addColorStop(1, hsl(hue, 75, light - 15, 0.9));
    return g;
  }

  function drawCell(r, hue, t, seed, wob, membraneLvl) {
    blobPath(r, t, seed, wob);
    ctx.fillStyle = cellFill(r, hue);
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.strokeStyle = hsl(hue, 85, 80, 0.9);
    ctx.stroke();
    if (pattern && r > 3) {
      ctx.save(); blobPath(r, t, seed, wob); ctx.clip(); drawPattern(r, t); ctx.restore();
    }
    if (membraneLvl) {
      blobPath(r * (1.06 + membraneLvl * 0.03), t, seed, wob);
      ctx.lineWidth = Math.max(2, r * 0.04 * (1 + membraneLvl));
      ctx.strokeStyle = hsl(hue, 60, 85, 0.35);
      ctx.stroke();
    }
  }

  function wavyLine(x0, y0, ang, len, amp, t, phase, width, color) {
    ctx.beginPath();
    const segs = 12;
    for (let i = 0; i <= segs; i++) {
      const f = i / segs;
      const along = f * len, side = Math.sin(f * 7 - t * 12 + phase) * amp * f;
      const x = x0 + Math.cos(ang) * along - Math.sin(ang) * side;
      const y = y0 + Math.sin(ang) * along + Math.cos(ang) * side;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
  }

  function drawSpikes(r, lvl, hue, t) {
    const n = 8 + lvl * 4;
    ctx.fillStyle = hsl((hue + 180) % 360, 70, 70, 0.9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + t * 0.2;
      const len = r * (0.18 + lvl * 0.06);
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.12) * r * 0.95, Math.sin(a - 0.12) * r * 0.95);
      ctx.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len));
      ctx.lineTo(Math.cos(a + 0.12) * r * 0.95, Math.sin(a + 0.12) * r * 0.95);
      ctx.fill();
    }
  }

  function drawCilia(r, lvl, hue, t) {
    const n = 24 + lvl * 10;
    ctx.strokeStyle = hsl(hue, 70, 85, 0.6); ctx.lineWidth = Math.max(1, r * 0.025);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sway = Math.sin(t * 8 + i) * 0.15;
      ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.lineTo(Math.cos(a + sway) * r * (1.12 + lvl * 0.03), Math.sin(a + sway) * r * (1.12 + lvl * 0.03));
    }
    ctx.stroke();
  }

  function drawJaws(r, t, hue, size = 1, x = 0.85) {
    const open = (Math.sin(t * 6) * 0.5 + 0.5) * 0.5 + 0.15;
    ctx.fillStyle = hsl(hue, 30, 92, 0.95);
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(r * x, s * r * 0.18 * size);
      ctx.rotate(s * open);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(r * 0.35 * size, s * r * 0.05, r * 0.42 * size, -s * r * 0.14 * size);
      ctx.quadraticCurveTo(r * 0.2 * size, s * r * 0.02, 0, s * r * 0.1 * size);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawEyes(r, x, spread, size, glow) {
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(r * x, s * r * spread, r * size, 0, Math.PI * 2);
      ctx.fillStyle = glow ? '#fff7b0' : '#ffffff'; ctx.fill();
      ctx.beginPath(); ctx.arc(r * (x + size * 0.35), s * r * spread, r * size * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = glow ? '#ff3b3b' : '#111'; ctx.fill();
    }
  }

  function drawProkaryote(r, hue, t, seed, tr) {
    drawCell(r, hue, t, seed, 0.07, tr.membrane);
    ctx.fillStyle = hsl(hue, 60, 30, 0.6);
    for (let i = 0; i < 5; i++) {
      const a = seed * 30 + i * 1.3 + Math.sin(t + i) * 0.2, d = r * (0.2 + (i % 3) * 0.18);
      ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, r * 0.07, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawEukaryote(r, hue, t, seed, tr) {
    drawCell(r, hue, t, seed, 0.06, tr.membrane);
    // organelles
    ctx.fillStyle = hsl((hue + 40) % 360, 70, 45, 0.75);
    for (let i = 0; i < 3; i++) {
      const a = seed * 50 + i * 2.1 + t * 0.3;
      ctx.save(); ctx.translate(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.18, r * 0.08, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    // nucleus
    ctx.beginPath(); ctx.arc(-r * 0.1, 0, r * 0.36, 0, Math.PI * 2);
    ctx.fillStyle = hsl(hue, 55, 32, 0.85); ctx.fill();
    ctx.beginPath(); ctx.arc(-r * 0.05, -r * 0.06, r * 0.12, 0, Math.PI * 2);
    ctx.fillStyle = hsl(hue, 60, 60, 0.9); ctx.fill();
  }

  function drawColony(r, hue, t, seed, tr) {
    const n = 5, sr = r * 0.34, d = r * 0.62;
    // membrane web
    ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
    ctx.fillStyle = hsl(hue, 60, 50, 0.18); ctx.fill();
    ctx.strokeStyle = hsl(hue, 70, 80, 0.25); ctx.lineWidth = r * 0.03; ctx.stroke();
    const rot = t * 0.4;
    ctx.strokeStyle = hsl(hue, 70, 75, 0.5); ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * Math.PI * 2;
      ctx.save(); ctx.translate(Math.cos(a) * d, Math.sin(a) * d);
      drawCell(sr, (hue + i * 12) % 360, t + i, seed + i, 0.08, 0);
      ctx.beginPath(); ctx.arc(0, 0, sr * 0.35, 0, Math.PI * 2); ctx.fillStyle = hsl(hue, 55, 30, 0.7); ctx.fill();
      ctx.restore();
    }
    drawCell(r * 0.42, hue, t, seed, 0.05, tr.membrane);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = hsl(hue, 55, 28, 0.85); ctx.fill();
  }

  function segBody(r, hue, t, seed, segs, wiggle) {
    // segs: [[xOffsetFactor, radiusFactor], ...] from tail to head
    const pts = segs.map(([x, s], i) => [x * r, Math.sin(t * 5 - i * 0.9 + seed * 10) * r * wiggle * (1 - i / segs.length), s * r]);
    // connective tissue
    ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.lineWidth = r * 0.3; ctx.strokeStyle = hsl(hue, 60, 45, 0.7); ctx.lineCap = 'round'; ctx.stroke();
    pts.forEach(([x, y, s], i) => {
      ctx.save(); ctx.translate(x, y);
      drawCell(s, (hue + i * 6) % 360, t + i * 0.7, seed + i, 0.05, 0);
      ctx.restore();
    });
    return pts;
  }

  function drawMulticell(r, hue, t, seed, tr) {
    const pts = segBody(r, hue, t, seed, [[-0.82, 0.2], [-0.52, 0.3], [-0.15, 0.4], [0.35, 0.5]], 0.18);
    const tail = pts[0];
    wavyLine(tail[0] - r * 0.15, tail[1], Math.PI, r * 0.9, r * 0.2, t, 0, Math.max(1.5, r * 0.05), hsl(hue, 70, 80, 0.8));
    // eyespot + nucleus on head
    const [hx, hy] = pts[pts.length - 1];
    ctx.beginPath(); ctx.arc(hx + r * 0.2, hy - r * 0.12, r * 0.09, 0, Math.PI * 2); ctx.fillStyle = '#ff5050'; ctx.fill();
    ctx.beginPath(); ctx.arc(hx - r * 0.05, hy + r * 0.05, r * 0.16, 0, Math.PI * 2); ctx.fillStyle = hsl(hue, 55, 30, 0.75); ctx.fill();
  }

  function drawPredator(r, hue, t, seed, tr) {
    // tail fin
    const sw = Math.sin(t * 6) * 0.35;
    ctx.save(); ctx.translate(-r * 0.75, 0); ctx.rotate(sw);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-r * 0.45, -r * 0.35); ctx.quadraticCurveTo(-r * 0.3, 0, -r * 0.45, r * 0.35); ctx.closePath();
    ctx.fillStyle = hsl(hue, 70, 45, 0.85); ctx.fill(); ctx.restore();
    // side fins
    for (const s of [-1, 1]) {
      ctx.save(); ctx.translate(r * 0.05, s * r * 0.45); ctx.rotate(s * (0.6 + Math.sin(t * 5) * 0.2));
      ctx.beginPath(); ctx.ellipse(-r * 0.15, 0, r * 0.28, r * 0.09, 0, 0, Math.PI * 2);
      ctx.fillStyle = hsl(hue, 70, 50, 0.8); ctx.fill(); ctx.restore();
    }
    // body
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.88, r * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = cellFill(r * 0.8, hue, 50); ctx.fill();
    if (pattern) {
      ctx.save(); ctx.clip(); drawPattern(r * 0.9, t); ctx.restore();
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.88, r * 0.55, 0, 0, Math.PI * 2); // pattern replaced the path; restore it for the outline
    }
    ctx.lineWidth = Math.max(2, r * 0.04); ctx.strokeStyle = hsl(hue, 85, 78, 0.9); ctx.stroke();
    if (tr.membrane) {
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.95, r * 0.62, 0, 0, Math.PI * 2);
      ctx.lineWidth = r * 0.03 * (1 + tr.membrane); ctx.strokeStyle = hsl(hue, 60, 85, 0.35); ctx.stroke();
    }
    // stripes
    ctx.strokeStyle = hsl(hue, 60, 30, 0.5); ctx.lineWidth = r * 0.06;
    for (let i = 0; i < 4; i++) {
      const x = -r * 0.5 + i * r * 0.25;
      ctx.beginPath(); ctx.moveTo(x, -r * 0.45); ctx.quadraticCurveTo(x + r * 0.08, 0, x, r * 0.45); ctx.stroke();
    }
    // dorsal plates
    ctx.fillStyle = hsl((hue + 30) % 360, 70, 70, 0.9);
    for (let i = 0; i < 5; i++) {
      const x = -r * 0.55 + i * r * 0.25;
      ctx.beginPath(); ctx.arc(x, 0, r * 0.06, 0, Math.PI * 2); ctx.fill();
    }
    drawJaws(r, t, hue, 1 + (tr.jaws || 0) * 0.15, 0.78);
    drawEyes(r, 0.5, 0.25, 0.1, false);
  }

  function drawApex(r, hue, t, seed, tr) {
    // tentacles from the head area
    for (let i = 0; i < 6; i++) {
      const s = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      const ang = s * (0.9 + k * 0.45);
      wavyLine(r * 0.35, s * r * 0.2, ang + Math.PI * 0.15 * s, r * (0.75 + k * 0.1), r * 0.15, t * 0.7, i, Math.max(2, r * 0.06 * (1 - k * 0.2)), hsl((hue + 20) % 360, 70, 55, 0.85));
    }
    // long segmented body
    const pts = segBody(r, hue, t * 0.8, seed, [[-0.92, 0.14], [-0.74, 0.2], [-0.52, 0.27], [-0.26, 0.34], [0.05, 0.4], [0.42, 0.46]], 0.14);
    // bioluminescent dots along body
    pts.forEach(([x, y, s], i) => {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
      ctx.beginPath(); ctx.arc(x, y - s * 0.4, s * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,255,240,${0.4 + pulse * 0.5})`; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y + s * 0.4, s * 0.15, 0, Math.PI * 2); ctx.fill();
    });
    // dorsal spines
    ctx.fillStyle = hsl((hue + 200) % 360, 60, 75, 0.9);
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y, s] = pts[i];
      ctx.beginPath(); ctx.moveTo(x - s * 0.3, y - s * 0.8); ctx.lineTo(x - s * 0.9, y - s * 1.5); ctx.lineTo(x + s * 0.2, y - s * 0.9); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - s * 0.3, y + s * 0.8); ctx.lineTo(x - s * 0.9, y + s * 1.5); ctx.lineTo(x + s * 0.2, y + s * 0.9); ctx.fill();
    }
    const [hx, hy] = pts[pts.length - 1];
    ctx.save(); ctx.translate(hx - r * 0.42, hy);
    drawJaws(r, t, hue, 1.1 + (tr.jaws || 0) * 0.15, 0.82);
    drawEyes(r, 0.55, 0.2, 0.08, true);
    ctx.restore();
  }


  // o: {x, y, r, angle, stage, traits, hue, seed, flags, look:{color, pattern}}
  function body(c, o, t) {
    ctx = c;
    const look = o.look || {};
    const col = C && C.ITEM[look.color];
    mode = col && col.mode || null; modeT = t;
    pattern = look.pattern && look.pattern !== 'p_none' ? look.pattern : null;
    const hue = o.hue, r = o.r, tr = o.traits || {}, flags = o.flags || 0;
    ctx.save();
    ctx.translate(o.x, o.y);
    if (mode === 'neon' || mode === 'shadow' || mode === 'gold') { // aura for special colours
      const g = ctx.createRadialGradient(0, 0, r * 0.7, 0, 0, r * 1.6);
      const ac = mode === 'neon' ? '120,255,200' : mode === 'gold' ? '255,215,90' : '150,80,255';
      g.addColorStop(0, `rgba(${ac},0.3)`); g.addColorStop(1, `rgba(${ac},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2); ctx.fill();
    }
    if (tr.metabolism) {
      const g = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * (1.5 + tr.metabolism * 0.15));
      g.addColorStop(0, hsl(hue, 90, 60, 0.25)); g.addColorStop(1, hsl(hue, 90, 60, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, Math.PI * 2); ctx.fill();
    }
    if (flags & 1) { // dashing streak
      ctx.save(); ctx.rotate(o.angle);
      const g = ctx.createLinearGradient(-r * 3, 0, 0, 0);
      g.addColorStop(0, 'rgba(127,215,255,0)'); g.addColorStop(1, 'rgba(127,215,255,0.35)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(-r * 1.4, 0, r * 1.8, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.rotate(o.angle);
    for (let i = 0; i < (tr.flagella || 0); i++) {
      const off = (i - (tr.flagella - 1) / 2) * r * 0.3;
      wavyLine(-r * 0.9, off, Math.PI + off / r * 0.4, r * 1.3, r * 0.22, t, i * 2, Math.max(1.5, r * 0.06), hsl(hue, 70, 75, 0.8));
    }
    if (tr.cilia) drawCilia(r, tr.cilia, hue, t);
    if (tr.spikes) drawSpikes(r, tr.spikes, hue, t);
    switch (o.stage) {
      case 0: drawProkaryote(r, hue, t, o.seed, tr); break;
      case 1: drawEukaryote(r, hue, t, o.seed, tr); break;
      case 2: drawColony(r, hue, t, o.seed, tr); break;
      case 3: drawMulticell(r, hue, t, o.seed, tr); break;
      case 4: drawPredator(r, hue, t, o.seed, tr); break;
      default: drawApex(r, hue, t, o.seed, tr); break;
    }
    if (tr.jaws && o.stage < 4) drawJaws(r, t, hue, 0.7 + tr.jaws * 0.15, 0.8);
    if (flags & 2) { // poisoned
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(120,255,80,0.22)'; ctx.fill();
    }
    ctx.restore();
    mode = null; pattern = null;
  }

  // ---------- trails: particles left behind moving organisms ----------
  class Trails {
    constructor(max = 600) { this.p = []; this.max = max; }
    // call every frame for each organism that has a trail
    emit(o, trail, dt, t) {
      if (!trail || trail === 't_none') return;
      o._trailAcc = (o._trailAcc || 0) + dt * (trail === 't_glow' ? 40 : 14);
      while (o._trailAcc >= 1 && this.p.length < this.max) {
        o._trailAcc -= 1;
        const back = o.angle + Math.PI + (Math.random() - 0.5) * 0.9;
        const d = o.r * (0.8 + Math.random() * 0.3);
        this.p.push({
          kind: trail, x: o.x + Math.cos(back) * d, y: o.y + Math.sin(back) * d,
          vx: Math.cos(back) * 10, vy: Math.sin(back) * 10 - (trail === 't_bubbles' ? 18 : 0),
          life: 0, max: trail === 't_ink' ? 1.6 : 1.1, s: o.r * (0.12 + Math.random() * 0.1) + 2, hue: o.hue, rot: Math.random() * 6,
        });
      }
    }
    update(dt) {
      for (const q of this.p) { q.life += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.97; q.vy *= 0.97; }
      this.p = this.p.filter(q => q.life < q.max);
    }
    draw(c, t) {
      ctx = c;
      for (const q of this.p) {
        const k = 1 - q.life / q.max;
        switch (q.kind) {
          case 't_bubbles':
            ctx.strokeStyle = `rgba(200,245,255,${0.6 * k})`; ctx.lineWidth = Math.max(1, q.s * 0.15);
            ctx.beginPath(); ctx.arc(q.x, q.y, q.s * (1.2 - k * 0.5), 0, Math.PI * 2); ctx.stroke();
            break;
          case 't_sparkle':
            ctx.fillStyle = `rgba(255,240,170,${k})`; star(q.x, q.y, q.s * (0.6 + 0.4 * Math.sin(t * 20 + q.rot)));
            break;
          case 't_stars':
            ctx.fillStyle = `hsla(${(q.hue + q.rot * 40) % 360},90%,75%,${k})`; star(q.x, q.y, q.s * 0.9);
            break;
          case 't_ink':
            ctx.fillStyle = `rgba(15,10,35,${0.35 * k})`;
            ctx.beginPath(); ctx.arc(q.x, q.y, q.s * (2.2 - k), 0, Math.PI * 2); ctx.fill();
            break;
          case 't_hearts': {
            const s = q.s * 0.8;
            ctx.fillStyle = `rgba(255,110,160,${k})`;
            ctx.beginPath(); ctx.moveTo(q.x, q.y + s * 0.6);
            ctx.bezierCurveTo(q.x - s * 1.2, q.y - s * 0.2, q.x - s * 0.5, q.y - s * 1.1, q.x, q.y - s * 0.4);
            ctx.bezierCurveTo(q.x + s * 0.5, q.y - s * 1.1, q.x + s * 1.2, q.y - s * 0.2, q.x, q.y + s * 0.6);
            ctx.fill();
            break;
          }
          case 't_glow':
            ctx.fillStyle = `hsla(${q.hue},100%,70%,${0.25 * k})`;
            ctx.beginPath(); ctx.arc(q.x, q.y, q.s * 1.4 * k + 1, 0, Math.PI * 2); ctx.fill();
            break;
        }
      }
    }
  }

  root.Draw = { body, Trails, star: (c, x, y, s) => { ctx = c; star(x, y, s); } };
})(window);
