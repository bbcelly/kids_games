/* ============================================================================
   make_icons.js — generate the PWA icons for Beskar Run, in code, no assets.
   Pure Node (built-in `zlib` + `fs` only — no npm dependencies), matching the
   project's "everything generated in code" philosophy.

   Draws a chunky beskar (Mandalorian-style) helmet on a deep-space navy field
   and writes PNGs used by manifest.json / index.html:
     icon-192.png, icon-512.png  — Android / maskable
     apple-touch-icon.png (180)  — iOS home screen
     favicon-32.png              — browser tab

   Run with:  node make_icons.js
   ========================================================================== */
'use strict';
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ---- minimal PNG encoder (8-bit RGBA) -------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const body = Buffer.concat([t, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- drawing --------------------------------------------------------------
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;

// helmet silhouette in normalized [0,1] coords
function inDome(u, v) { return ((u - 0.5) / 0.30) ** 2 + ((v - 0.42) / 0.30) ** 2 <= 1; }
function halfWidth(v) { const t = clamp((v - 0.42) / (0.80 - 0.42), 0, 1); return 0.30 - t * 0.13; }
function inJaw(u, v) { return v >= 0.42 && v <= 0.80 && Math.abs(u - 0.5) <= halfWidth(v); }
function inHelmet(u, v) { return inDome(u, v) || inJaw(u, v); }
function inVisor(u, v) {
  const brow = v > 0.385 && v < 0.455 && Math.abs(u - 0.5) < 0.205;
  const slot = u > 0.465 && u < 0.535 && v > 0.385 && v < 0.66;
  return brow || slot;
}

// color of one (supersampled) pixel
function sample(u, v) {
  if (inHelmet(u, v)) {
    if (inVisor(u, v)) {
      // dark visor with a faint cyan glow toward the middle
      const glow = clamp(1 - Math.abs(v - 0.5) * 2.4, 0, 1) * 0.5;
      return [Math.round(lerp(14, 60, glow)), Math.round(lerp(34, 120, glow)), Math.round(lerp(54, 150, glow)), 255];
    }
    // gold beskar — brighter at the top, darker at the chin, slight left highlight
    const shade = lerp(1.14, 0.80, clamp(v, 0, 1)) + (0.5 - u) * 0.12;
    return [
      clamp(Math.round(255 * shade), 0, 255),
      clamp(Math.round(204 * shade), 0, 255),
      clamp(Math.round(68 * shade), 0, 255),
      255,
    ];
  }
  // deep-space navy background (vertical gradient), fully opaque so it works
  // as a maskable icon
  return [
    Math.round(lerp(0x10, 0x05, v)),
    Math.round(lerp(0x20, 0x0c, v)),
    Math.round(lerp(0x3c, 0x1a, v)),
    255,
  ];
}

// render at `size`, 2x supersampled and box-downscaled for smooth edges
function render(size) {
  const ss = 2, big = size * ss;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const u = (x * ss + sx + 0.5) / big;
          const v = (y * ss + sy + 0.5) / big;
          const c = sample(u, v);
          r += c[0]; g += c[1]; b += c[2]; a += c[3];
        }
      }
      const n = ss * ss, i = (y * size + x) * 4;
      out[i] = Math.round(r / n); out[i + 1] = Math.round(g / n);
      out[i + 2] = Math.round(b / n); out[i + 3] = Math.round(a / n);
    }
  }
  return out;
}

function write(name, size) {
  const png = encodePNG(size, size, render(size));
  fs.writeFileSync(path.join(__dirname, name), png);
  console.log(`wrote ${name} (${size}x${size}, ${png.length} bytes)`);
}

write('icon-512.png', 512);
write('icon-192.png', 192);
write('apple-touch-icon.png', 180);
write('favicon-32.png', 32);
console.log('done.');
