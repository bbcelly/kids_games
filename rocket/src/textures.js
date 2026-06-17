// textures.js — builds every sprite procedurally with Phaser Graphics so the
// game needs ZERO external image files (runs fine from file://). Each texture
// is a small set of colored rectangles = chunky pixel art. Swap these for real
// PNG sprite sheets later without touching the scenes.

function buildTextures(scene) {
  // helper: draw one filled "pixel block"
  const px = (g, color, x, y, w, h) => {
    g.fillStyle(color, 1);
    g.fillRect(x, y, w, h);
  };

  // helper: render a draw() into a named texture of size w x h
  function make(key, w, h, draw) {
    const g = scene.make.graphics({ x: 0, y: 0, add: false });
    draw(g);
    g.generateTexture(key, w, h);
    g.destroy();
  }

  // --- Player ship: green beskar-plated gunship, nose pointing right ---
  make('ship', 46, 26, (g) => {
    px(g, 0x2a382a, 6, 2, 14, 6);    // top fin
    px(g, 0x2a382a, 6, 18, 14, 6);   // bottom fin
    px(g, 0x3a4d3a, 4, 8, 30, 10);   // hull
    px(g, 0x6f8f6f, 6, 10, 24, 6);   // lighter plating
    px(g, 0x8fae8f, 30, 9, 10, 8);   // nose
    px(g, 0xb9c6cf, 22, 11, 6, 4);   // cockpit frame
    px(g, 0x7ef0ff, 23, 12, 4, 2);   // cockpit glass
    px(g, 0xe9eef2, 40, 11, 4, 4);   // nose tip
    px(g, 0xff9a3c, 0, 11, 4, 4);    // thruster flame
  });

  // --- Grogu-ish companion: little green friend with ears ---
  make('companion', 14, 13, (g) => {
    px(g, 0x4f6b29, 1, 4, 2, 5);     // left ear
    px(g, 0x4f6b29, 11, 4, 2, 5);    // right ear
    px(g, 0x6b8e3a, 3, 2, 8, 7);     // head
    px(g, 0xd9c79a, 4, 9, 6, 3);     // robe
    px(g, 0x101510, 5, 4, 1, 2);     // left eye
    px(g, 0x101510, 8, 4, 1, 2);     // right eye
  });

  // --- Grunt enemy: dark TIE-ish fighter ---
  make('grunt', 30, 24, (g) => {
    px(g, 0x2b2f36, 0, 2, 6, 20);    // left wing
    px(g, 0x2b2f36, 24, 2, 6, 20);   // right wing
    px(g, 0x1f2228, 0, 2, 6, 3);
    px(g, 0x1f2228, 24, 2, 6, 3);
    px(g, 0x3a3f48, 6, 9, 18, 6);    // strut
    px(g, 0x4a505a, 10, 6, 10, 12);  // cockpit ball
    px(g, 0x9a3030, 12, 9, 6, 6);    // red eye
  });

  // --- Shooter enemy: heavier, rust/red, with a gun nub on the left ---
  make('shooter', 32, 26, (g) => {
    px(g, 0x332018, 0, 3, 6, 20);    // left wing
    px(g, 0x332018, 26, 3, 6, 20);   // right wing
    px(g, 0x4a3326, 6, 8, 20, 10);   // body
    px(g, 0x6b4a36, 8, 10, 14, 6);   // plating
    px(g, 0xc4502a, 10, 11, 8, 4);   // hot core
    px(g, 0x222, 0, 11, 6, 4);       // gun nub (faces player)
  });

  // --- Player bullet: cyan bolt ---
  make('pbullet', 14, 4, (g) => {
    px(g, 0x2bd6ff, 0, 0, 14, 4);
    px(g, 0xffffff, 9, 1, 5, 2);
  });

  // --- Enemy bullet: red plasma ball ---
  make('ebullet', 9, 9, (g) => {
    px(g, 0xff5a3c, 1, 1, 7, 7);
    px(g, 0xffd24a, 3, 3, 3, 3);
  });

  // --- Beskar pickup: gold ingot ---
  make('beskar', 16, 10, (g) => {
    px(g, 0xb8860b, 2, 7, 12, 2);
    px(g, 0xffd24a, 2, 2, 12, 6);
    px(g, 0xfff0a8, 3, 3, 9, 2);
  });

  // --- Plasma bolt: round-ish purple/cyan, used by spread/scatter ---
  make('plasma', 10, 10, (g) => {
    px(g, 0x9a5cff, 1, 1, 8, 8);
    px(g, 0x2bd6ff, 3, 3, 4, 4);
    px(g, 0xffffff, 4, 4, 2, 2);
  });

  // --- Missile: little rocket with an exhaust tail ---
  make('missile', 16, 8, (g) => {
    px(g, 0xff9a3c, 0, 3, 4, 2);    // exhaust
    px(g, 0xb9c6cf, 4, 2, 8, 4);    // body
    px(g, 0xd9534f, 12, 2, 4, 4);   // warhead
    px(g, 0x2a382a, 4, 1, 3, 1);    // fin
    px(g, 0x2a382a, 4, 6, 3, 1);    // fin
  });

  // --- Laser lance: long bright piercing beam ---
  make('laser', 44, 6, (g) => {
    px(g, 0xff3ca0, 0, 1, 44, 4);   // magenta core
    px(g, 0xffd2ef, 0, 2, 44, 2);   // white-hot center
    px(g, 0xffffff, 36, 1, 8, 4);   // bright tip
  });

  // --- Boss 1: Mining Hauler (bulky, industrial grey + orange) ---
  make('boss1', 96, 64, (g) => {
    px(g, 0x4a5058, 10, 14, 76, 38);   // hull
    px(g, 0x6b7480, 10, 14, 76, 8);    // top deck
    px(g, 0x3a3f48, 18, 50, 60, 10);   // underbelly
    px(g, 0x2b2f36, 30, 4, 12, 10);    // tower
    px(g, 0x2b2f36, 54, 4, 12, 10);    // tower
    px(g, 0xc4502a, 0, 26, 12, 14);    // front engine block
    px(g, 0xffd24a, 2, 30, 6, 6);      // engine glow
    px(g, 0x9a3030, 40, 24, 16, 12);   // core
    px(g, 0x222831, 86, 18, 10, 28);   // rear
  });

  // --- Boss 2: Imperial Cruiser (angular grey wedge, nose left) ---
  make('boss2', 112, 56, (g) => {
    px(g, 0x6f7d86, 30, 4, 76, 48);    // body
    px(g, 0x8fa0aa, 30, 4, 76, 8);     // top
    px(g, 0x6f7d86, 18, 16, 14, 24);   // nose step
    px(g, 0x6f7d86, 6, 22, 14, 12);    // nose tip
    px(g, 0x9a3030, 2, 24, 6, 8);      // tip light
    px(g, 0x3a4048, 40, 22, 52, 14);   // trench
    px(g, 0x2b2f36, 92, 6, 20, 44);    // engines
    px(g, 0x7ef0ff, 94, 14, 4, 8);     // thruster
    px(g, 0x7ef0ff, 94, 34, 4, 8);     // thruster
  });

  // --- Boss 3: Imperial Walker (head + legs, grey) ---
  make('boss3', 88, 80, (g) => {
    px(g, 0x556070, 24, 6, 42, 30);    // head
    px(g, 0x778496, 28, 10, 30, 10);   // visor housing
    px(g, 0x9a3030, 32, 16, 22, 8);    // eye band
    px(g, 0x222831, 2, 18, 14, 8);     // chin gun
    px(g, 0x222831, 72, 18, 14, 8);    // chin gun
    px(g, 0x445060, 36, 36, 16, 16);   // neck/body
    px(g, 0x445060, 18, 50, 8, 28);    // leg
    px(g, 0x445060, 62, 50, 8, 28);    // leg
    px(g, 0x333b48, 12, 74, 18, 6);    // foot
    px(g, 0x333b48, 58, 74, 18, 6);    // foot
  });

  // --- Starfield tile (seamless dots) for a scrolling background ---
  make('startile', 256, 256, (g) => {
    for (let i = 0; i < 90; i++) {
      const x = Math.floor(Math.random() * 256);
      const y = Math.floor(Math.random() * 256);
      const bright = Math.random();
      const c = bright > 0.85 ? 0xffffff : bright > 0.5 ? 0x9fb0d0 : 0x55617f;
      const s = bright > 0.85 ? 2 : 1;
      px(g, c, x, y, s, s);
    }
  });

  // ===== Per-level parallax backdrops (all 256 wide so they tile horizontally) =====

  // helper: soft seamless nebula clouds — clusters of tiny low-contrast specks
  // (wrapped mod 256 so the tile has no visible seam). Looks like diffuse dust
  // rather than hard rectangular blocks.
  const wrap = (v) => ((Math.floor(v) % 256) + 256) % 256;
  function cloudField(g, colors, clusters, perCluster, spread) {
    for (let cl = 0; cl < clusters; cl++) {
      const cx = Math.random() * 256, cy = Math.random() * 256;
      const n = perCluster[0] + Math.floor(Math.random() * (perCluster[1] - perCluster[0]));
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.pow(Math.random(), 0.6) * spread; // denser toward the center
        const c = colors[Math.floor(Math.random() * colors.length)];
        const s = 2 + Math.floor(Math.random() * 3);
        px(g, c, wrap(cx + Math.cos(a) * r), wrap(cy + Math.sin(a) * r), s, s);
      }
    }
  }

  // --- L1 far layer: asteroid void — near-black with faint diffuse dust + stars ---
  make('bg_dust', 256, 256, (g) => {
    px(g, 0x070910, 0, 0, 256, 256);   // deep space fill
    // very low-contrast dust (barely above the fill) so it never reads as blocks
    cloudField(g, [0x0c0f18, 0x10131f, 0x121023], 7, [34, 64], 60);
    for (let i = 0; i < 45; i++) {     // sparse faint stars
      px(g, 0x55617f, Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), 1, 1);
    }
  });

  // --- L2 far layer: cool nebula — soft blue/violet dust + sparse stars ---
  make('bg_nebula', 256, 256, (g) => {
    px(g, 0x0a0c1c, 0, 0, 256, 256);   // dark blue fill
    cloudField(g, [0x111634, 0x16183a, 0x1b1740, 0x12203e], 8, [40, 72], 64);
    for (let i = 0; i < 55; i++) {
      const bright = Math.random();
      const c = bright > 0.85 ? 0xcdd6ff : 0x6a76a0;
      const s = bright > 0.92 ? 2 : 1;
      px(g, c, Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), s, s);
    }
  });

  // --- L3 far layer: warm planet sky — peach/orange horizontal bands + few stars ---
  make('bg_sky', 256, 256, (g) => {
    const bands = [0x2a1730, 0x3d1f33, 0x55293a, 0x6e3a3c, 0x8a5340, 0xa87049, 0xc78d54];
    const bh = Math.ceil(256 / bands.length);
    for (let i = 0; i < bands.length; i++) px(g, bands[i], 0, i * bh, 256, bh);
    for (let i = 0; i < 22; i++) {       // a few faint high stars in the dark top bands
      px(g, 0xffe2b0, Math.floor(Math.random() * 256), Math.floor(Math.random() * 90), 1, 1);
    }
  });

  // --- L2 mid layer: capital-ship hull silhouettes (kept off the edges → tiles cleanly) ---
  make('fleet_hulls', 256, 96, (g) => {
    // big wedge hull
    px(g, 0x20262f, 24, 40, 120, 30);
    px(g, 0x2b333d, 24, 40, 120, 6);     // top deck highlight
    px(g, 0x171b22, 40, 70, 90, 8);      // underbelly shadow
    for (let x = 36; x < 132; x += 12) px(g, 0xffd24a, x, 52, 3, 2); // lit windows
    // smaller hull, offset + higher
    px(g, 0x1c2128, 160, 22, 74, 20);
    px(g, 0x262d36, 160, 22, 74, 4);
    for (let x = 168; x < 226; x += 11) px(g, 0xbfe6ff, x, 30, 2, 2);
  });

  // --- L3 mid layer: distant mountain ridge (base-aligned edges → tiles cleanly) ---
  make('mountains', 256, 110, (g) => {
    px(g, 0x3a2433, 0, 84, 256, 26);     // ridge base band (spans full width, edges match)
    // peaks rising from the base; none touch the L/R edge so the seam stays flat
    const peaks = [[20, 40], [70, 24], [120, 56], [176, 32], [216, 46]];
    for (let i = 0; i < peaks.length; i++) {
      const cx = peaks[i][0], ph = peaks[i][1];
      for (let s = 0; s < ph; s += 4) {  // stepped triangle
        const half = Math.floor((ph - s) * 0.6);
        px(g, 0x46293f, cx - half, 84 - s, half * 2, 4);
      }
    }
    px(g, 0x583450, 0, 84, 256, 3);      // lit ridge line
  });

  // --- L3 near layer: scrolling ground/terrain strip ---
  make('ground', 256, 70, (g) => {
    px(g, 0x4a3326, 0, 8, 256, 62);      // dirt body
    px(g, 0x6b4a36, 0, 4, 256, 6);       // surface band
    px(g, 0x8a6a4a, 0, 2, 256, 3);       // lit surface line
    for (let i = 0; i < 30; i++) {       // rock/grit specks
      const c = Math.random() > 0.5 ? 0x35251b : 0x5e4231;
      px(g, c, Math.floor(Math.random() * 256), 14 + Math.floor(Math.random() * 50), 2 + Math.floor(Math.random() * 3), 2);
    }
  });

  // --- Drifting props ---
  // L1 asteroids (chunky grey rocks, two sizes)
  make('rock_sm', 16, 16, (g) => {
    px(g, 0x4b4843, 3, 2, 10, 12);
    px(g, 0x615d56, 3, 2, 10, 5);        // lit top
    px(g, 0x35332f, 6, 10, 6, 4);        // shadow
    px(g, 0x7a766c, 5, 4, 3, 2);         // highlight
  });
  make('rock_lg', 28, 24, (g) => {
    px(g, 0x4b4843, 4, 3, 20, 18);
    px(g, 0x615d56, 4, 3, 20, 7);        // lit top
    px(g, 0x35332f, 10, 15, 12, 6);      // shadow
    px(g, 0x2a2825, 18, 6, 5, 5);        // crater
    px(g, 0x7a766c, 7, 5, 5, 3);         // highlight
  });
  // L2 metal debris (angular scrap, grey + hot edge)
  make('debris', 18, 12, (g) => {
    px(g, 0x5a626b, 2, 3, 12, 6);
    px(g, 0x7e8893, 2, 3, 12, 2);        // lit edge
    px(g, 0x343a42, 6, 7, 8, 3);         // shadow
    px(g, 0xc4502a, 12, 4, 4, 3);        // rusty/hot end
  });
}
