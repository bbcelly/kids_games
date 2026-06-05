# Beskar Run 🚀

A side-scrolling pixel-art rocket shooter with an upgradeable ship.
Mandalorian/Grogu *themed* (original art — no copyrighted assets). Built with
[Phaser 3](https://phaser.io/), no build step.

## How to play

- **Move:** Arrow keys or WASD
- **Fire:** automatic — the ship auto-shoots, nothing to hold
- **Switch weapon:** Q (cycles weapons you own)
- **Pause:** P (then Resume / Restart run / go to Hangar)
- **Goal:** blast Imperial-style fighters, collect **beskar**, survive.
- When your ship goes down, you keep the beskar you collected. Spend it in the
  **Hangar** between runs, then launch again — stronger.

### Hangar (between runs)
Navigate with arrows/WASD, **ENTER** to buy/equip, **SPACE** to launch.

**Stat upgrades:** Blaster Fire Rate (shoot faster) · Beskar Armor (+1 hull) ·
Thrusters (fly faster).

**Weapons** (buy with beskar, then ENTER to equip; switch in-flight with Q):
Blaster (starter) · Twin Cannon · Spread Shot · Scatter Gun · Vulcan ·
Homing Missiles · Laser Lance · plus combinations Beskar Storm and
Darksaber Array.

Progress (beskar, upgrades, owned/active weapons) is saved in your browser
(`localStorage`).

## How to run

⚠️ **It must be served over HTTP — do not open `index.html` as a file.**
Browsers lock down `file://` pages (each is a unique origin), which breaks
Phaser. If you open the file directly, the game shows instructions instead of
running.

**Easiest (macOS):** double-click **`play.command`**. It starts a local server
and opens the game in your browser. Keep the Terminal window open while playing.

**Any platform**, from this folder:

```bash
python3 -m http.server 8000     # or:  npx serve .
```

then open **http://localhost:8000**.

## How to tinker

- **`src/config.js`** — balance knobs (speeds, hull, fire rate) and the `WAVES`
  array that defines the level. Edit `WAVES` to change difficulty/pacing.
- **`src/upgrades.js`** — the stat-upgrade registry. Add one entry and it shows
  up in the hangar and affects the ship automatically.
- **`src/weapons.js`** — the weapon registry. Each weapon defines its own
  `fire()` shot pattern; add one entry and it appears in the hangar and works
  in-flight automatically.
- **`src/textures.js`** — the procedural pixel-art sprites/bullets. Swap these
  for real PNG sprite sheets later without touching the scenes.
- **`src/scenes/`** — `Boot → Menu → Game → Shop`.

## Roadmap (next iterations)
Boss fights → 3 distinct themed levels (Asteroid Field / Imperial Fleet /
Planet Surface) → Grogu Force-blast special → mid-flight weapon power-up
pickups → sound effects → real pixel-art sprite sheets.
