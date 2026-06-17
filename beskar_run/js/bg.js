'use strict';
// ---- layered parallax backgrounds, one distinct look per level ----

class Background {
  constructor(level) {
    this.level = level;
    this.t = 0;
    // shared star layers (used by levels 0 & 1)
    this.stars = [];
    for (let i = 0; i < 90; i++) {
      const depth = Math.random();
      this.stars.push({
        x: Math.random() * W, y: Math.random() * H,
        spd: 14 + depth * 70, size: depth > 0.85 ? 3 : depth > 0.5 ? 2 : 1,
        c: pick(['#9fb6d8', '#cfd8ec', '#ffffff', '#ffe9b0']),
        tw: Math.random() * 6,
      });
    }

    if (level === 0) {
      // slow huge background rocks + mid-distance tumblers
      this.bigRocks = [];
      for (let i = 0; i < 4; i++) this.bigRocks.push(this.mkRock(rand(60, 130), '#1a1626', '#241d33', true));
      this.midRocks = [];
      for (let i = 0; i < 7; i++) this.midRocks.push(this.mkRock(rand(14, 34), '#3a3046', '#4c405c', false));
      this.planet = { x: W * 0.72, y: H * 0.3, r: 64 };
    } else if (level === 1) {
      // nebula blobs + giant capital-ship hulls sliding by + debris
      this.blobs = [];
      for (let i = 0; i < 12; i++) this.blobs.push({
        x: Math.random() * W, y: Math.random() * H, r: rand(80, 220),
        c: pick(['rgba(88,52,140,0.16)', 'rgba(40,70,160,0.14)', 'rgba(150,50,120,0.10)']),
        spd: rand(4, 12),
      });
      this.hulls = [
        { x: rand(0, W), y: rand(40, 150), spd: 22, c: this.mkHull(420, 80, '#10141f', '#1a2030') },
        { x: rand(W, W * 2), y: rand(300, 430), spd: 30, c: this.mkHull(520, 100, '#0c0f18', '#141927') },
      ];
      this.debris = [];
      for (let i = 0; i < 16; i++) this.debris.push({
        x: Math.random() * W, y: Math.random() * H, spd: rand(50, 130),
        s: randi(2, 6), rot: rand(0, 6), vr: rand(-2, 2),
      });
    } else {
      // warm sky, distant + near mountains, scrolling rocky ground
      this.farTile = this.mkMountains(1024, 150, '#7a4a52', 4);
      this.nearTile = this.mkMountains(1024, 220, '#54323e', 7);
      this.groundTile = this.mkGround(1024, 70);
      this.farX = 0; this.nearX = 0; this.groundX = 0;
      this.birds = [];
      for (let i = 0; i < 4; i++) this.birds.push({ x: rand(0, W), y: rand(40, 180), spd: rand(20, 45), p: rand(0, 6) });
    }
  }

  mkRock(r, c1, c2, slow) {
    return {
      x: rand(0, W * 1.5), y: rand(0, H), r,
      spd: slow ? rand(8, 18) : rand(28, 55),
      rot: rand(0, 6), vr: rand(-0.3, 0.3),
      c1, c2,
      pts: Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const rr = r * rand(0.72, 1);
        return [Math.cos(a) * rr, Math.sin(a) * rr];
      }),
    };
  }

  mkHull(w, h, dark, lite) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    // long wedge silhouette with lit window rows
    g.fillStyle = dark;
    g.beginPath();
    g.moveTo(0, h * 0.5); g.lineTo(w * 0.25, h * 0.1); g.lineTo(w, h * 0.22);
    g.lineTo(w, h * 0.78); g.lineTo(w * 0.25, h * 0.9); g.closePath(); g.fill();
    g.fillStyle = lite;
    g.fillRect(w * 0.55, h * 0.05, w * 0.18, h * 0.18); // bridge tower
    g.fillStyle = 'rgba(255,235,140,0.5)';
    for (let i = 0; i < 26; i++) {
      if (Math.random() < 0.7) g.fillRect(w * 0.2 + Math.random() * w * 0.75, h * (0.3 + Math.random() * 0.4), 3, 2);
    }
    return c;
  }

  mkMountains(w, h, color, jag) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, h);
    let y = h * rand(0.4, 0.7);
    const step = w / (jag * 4);
    for (let x = 0; x <= w; x += step) {
      // wrap-friendly: ease back to the start height near the right edge
      const target = x > w - step * 2 ? h * 0.55 : h * rand(0.15, 0.8);
      y = lerp(y, target, 0.6);
      g.lineTo(x, y);
    }
    g.lineTo(w, h);
    g.closePath(); g.fill();
    return c;
  }

  mkGround(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#3d2a35'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#54323e'; g.fillRect(0, 0, w, 6);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = pick(['#4a3340', '#33222c', '#5d3c49']);
      const s = randi(3, 12);
      g.fillRect(Math.random() * w, 8 + Math.random() * (h - 16), s, s * 0.6);
    }
    return c;
  }

  update(dt) {
    this.t += dt;
    for (const s of this.stars) {
      s.x -= s.spd * dt;
      if (s.x < -3) { s.x = W + 3; s.y = Math.random() * H; }
    }
    if (this.level === 0) {
      for (const r of [...this.bigRocks, ...this.midRocks]) {
        r.x -= r.spd * dt; r.rot += r.vr * dt;
        if (r.x < -r.r * 2) { r.x = W + r.r * 2; r.y = Math.random() * H; }
      }
    } else if (this.level === 1) {
      for (const b of this.blobs) { b.x -= b.spd * dt; if (b.x < -b.r) b.x = W + b.r; }
      for (const hull of this.hulls) {
        hull.x -= hull.spd * dt;
        if (hull.x < -hull.c.width - 60) { hull.x = W + rand(100, 500); hull.y = rand(30, H - 150); }
      }
      for (const d of this.debris) {
        d.x -= d.spd * dt; d.rot += d.vr * dt;
        if (d.x < -8) { d.x = W + 8; d.y = Math.random() * H; }
      }
    } else {
      this.farX = (this.farX + 18 * dt) % 1024;
      this.nearX = (this.nearX + 45 * dt) % 1024;
      this.groundX = (this.groundX + 130 * dt) % 1024;
      for (const b of this.birds) {
        b.x -= b.spd * dt; b.p += dt * 7;
        if (b.x < -10) { b.x = W + 10; b.y = rand(40, 180); }
      }
    }
  }

  draw(g) {
    if (this.level === 0) {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#070512'); gr.addColorStop(1, '#0d0a20');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // distant planet
      g.fillStyle = '#1d2b4f'; g.beginPath(); g.arc(this.planet.x, this.planet.y, this.planet.r, 0, 7); g.fill();
      g.fillStyle = '#27395f'; g.beginPath(); g.arc(this.planet.x - 14, this.planet.y - 12, this.planet.r * 0.8, 0, 7); g.fill();
      this.drawStars(g);
      for (const r of this.bigRocks) this.drawRockShape(g, r);
      for (const r of this.midRocks) this.drawRockShape(g, r);
    } else if (this.level === 1) {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#120a24'); gr.addColorStop(0.5, '#1c0f33'); gr.addColorStop(1, '#0a0a1e');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (const b of this.blobs) {
        g.fillStyle = b.c; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 7); g.fill();
      }
      this.drawStars(g);
      for (const hull of this.hulls) g.drawImage(hull.c, hull.x | 0, hull.y | 0);
      g.fillStyle = '#5a657a';
      for (const d of this.debris) {
        g.save(); g.translate(d.x, d.y); g.rotate(d.rot);
        g.fillRect(-d.s / 2, -d.s / 2, d.s, d.s * 0.6);
        g.restore();
      }
    } else {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#ffb45e'); gr.addColorStop(0.45, '#e8775a'); gr.addColorStop(1, '#9c4a64');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // sun
      g.fillStyle = '#ffe9b8'; g.beginPath(); g.arc(W * 0.7, 110, 46, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,233,184,0.25)'; g.beginPath(); g.arc(W * 0.7, 110, 70, 0, 7); g.fill();
      // birds
      g.strokeStyle = '#5a2e3c'; g.lineWidth = 2;
      for (const b of this.birds) {
        const f = Math.sin(b.p) * 4;
        g.beginPath(); g.moveTo(b.x - 6, b.y - f); g.lineTo(b.x, b.y); g.lineTo(b.x + 6, b.y - f); g.stroke();
      }
      // mountain layers (tiled)
      this.tile(g, this.farTile, this.farX, H - 70 - 150);
      this.tile(g, this.nearTile, this.nearX, H - 70 - 130);
      this.tile(g, this.groundTile, this.groundX, H - 70);
    }
  }

  tile(g, c, off, y) {
    const x = -(off % c.width);
    g.drawImage(c, x | 0, y | 0);
    g.drawImage(c, (x + c.width) | 0, y | 0);
  }

  drawStars(g) {
    for (const s of this.stars) {
      const blink = Math.sin(this.t * 3 + s.tw) > -0.8 ? 1 : 0.3;
      g.globalAlpha = (0.35 + s.size * 0.2) * blink;
      g.fillStyle = s.c;
      g.fillRect(s.x | 0, s.y | 0, s.size, s.size);
    }
    g.globalAlpha = 1;
  }

  drawRockShape(g, r) {
    g.save(); g.translate(r.x, r.y); g.rotate(r.rot);
    g.fillStyle = r.c1;
    g.beginPath();
    g.moveTo(r.pts[0][0], r.pts[0][1]);
    for (const p of r.pts) g.lineTo(p[0], p[1]);
    g.closePath(); g.fill();
    g.fillStyle = r.c2;
    g.beginPath(); g.arc(-r.r * 0.25, -r.r * 0.2, r.r * 0.3, 0, 7); g.fill();
    g.restore();
  }
}
