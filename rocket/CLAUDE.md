# CLAUDE.md — guide for Claude Code (and humans)

This file orients an AI assistant or developer working on **Beskar Run**, a
kids' browser game in this folder. Read this first. Player-facing instructions
live in [README.md](README.md); deeper code notes in
[ARCHITECTURE.md](ARCHITECTURE.md); plans in [ROADMAP.md](ROADMAP.md).

## What this is

A side-scrolling pixel-art **rocket shooter** for an ~8–12-year-old, themed
(not licensed) after Mandalorian/Grogu. You fly a beskar gunship with a little
green companion, clear waves of Imperial-style enemies, beat a boss to advance
a level, and spend **beskar** in a hangar on stat upgrades, weapons, and
Grogu's Force perks. Difficulty rises every level and keeps climbing as the
levels loop.

## Tech & golden rules

- **Phaser 3** (loaded from CDN in `index.html`). **No build step, no npm, no
  bundler.** Plain browser JavaScript.
- **Classic global scripts**, NOT ES modules. Files share one global scope; load
  order in `index.html` matters (see below). Do not add `import`/`export`.
- **All art is generated procedurally** in `src/textures.js` (chunky pixel rects
  via Phaser Graphics → `generateTexture`). There are **no image/audio asset
  files** and adding external ones is discouraged (keeps it dependency-free and
  avoids `file://`/CORS issues). The only network dependency is the Phaser CDN.
- **Must be served over HTTP.** Opening `index.html` as a `file://` is blocked by
  browsers (Phaser breaks); `src/main.js` detects this and shows instructions
  instead of crashing.
- **Persistence** is `localStorage` under key `beskar_run_save_v1` (see Save
  schema below), all funneled through the `Save` object in `src/save.js`.

## Run it

```bash
# from this folder (rocket/)
python3 -m http.server 8000      # or: npx serve .
# then open http://localhost:8000
```
Or double-click `play.command` (macOS). **Never** test by opening the file
directly.

## Verify changes (the established method)

There is no unit-test suite — this is a real-time canvas game, so we verify by
**driving the running game in a headless browser** and checking console errors +
screenshots. The repeatable recipe used throughout development:

1. Start a static server: `python3 -m http.server 8770` in `rocket/`.
2. Install a driver in a temp dir: `npm i puppeteer-core@23` (no Chromium
   download — it drives the **system Google Chrome** at
   `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`).
3. Write a small ESM script that: launches Chrome headless, `page.goto` the
   `http://localhost:PORT/index.html`, seeds `localStorage` to reach the state
   you want, drives keys (`page.keyboard`), reads game state via
   `page.evaluate(() => game.scene.getScene('Game').<field>)`, screenshots, and
   collects `page.on('pageerror', …)`.
4. Assert: **no page errors**, plus the specific behavior you changed.

`game` is a global (top-level `let` in `main.js`). Scenes: `game.scene.getScene('Game'|'Shop'|'Menu')`.
Always seed `localStorage` (key above) to jump straight to the case under test
(e.g. give beskar, owned weapons, a level/lap). Clean up the server + temp dir
after.

## File map & load order

`index.html` loads scripts in THIS order (dependencies first):

```
src/config.js     CONFIG (tuning), LEVELS (+bosses), computeDifficulty()
src/upgrades.js   UPGRADES registry, upgradeCost(), computeStats()
src/weapons.js    WEAPONS registry, getWeapon(), DEFAULT_WEAPON
src/grogu.js      GROGU_PERKS registry, groguCost(), computeGrogu()
src/save.js       Save (localStorage; reads the registries above)
src/textures.js   buildTextures(scene) — all procedural sprites
src/scenes/BootScene.js   builds textures → starts Menu
src/scenes/MenuScene.js   title, current level/loop, launch
src/scenes/GameScene.js   the core loop (biggest file)
src/scenes/ShopScene.js   the 3-column hangar
src/main.js       file:// guard + new Phaser.Game(...); exposes `game`
```
If you add a file, add a `<script>` in `index.html` **before** anything that
uses it.

## Data-driven content — how to add things

Most additions are a single registry entry; the scenes render/consume them
automatically.

- **New weapon** → add an entry to `WEAPONS` in `src/weapons.js` with a
  `fire(scene, x, y)` that calls `scene.firePlayerShot(x, y, angleDeg, opts)`
  (`opts`: `tex`, `speedMult`, `damage`, `pierce`, `homing`). It shows up in the
  hangar's WEAPONS column and works in-flight (Q to switch). New bullet shape?
  add a texture in `textures.js` and reference its key as `tex`.
- **New Grogu perk** → add to `GROGU_PERKS` in `src/grogu.js`, surface its derived
  value in `computeGrogu()`, and implement the effect in `GameScene`. Passive
  perks read `this.grogu.<value>`; active ones bind a key in `create()`.
- **New stat upgrade** → add to `UPGRADES` in `src/upgrades.js` with
  `apply(stats, level)`. `computeStats()` folds it into the ship automatically.
- **New level** → append to `LEVELS` in `src/config.js` (`name`, `tint`, `waves`,
  `boss`) and add the boss texture (`boss<N>`) in `textures.js`. Difficulty
  scaling is automatic via `computeDifficulty(stage)`.
- **New enemy type** → add to `CONFIG.enemies` (+ a texture), then reference its
  key in some level's `waves`.
- **Retune difficulty** → edit `computeDifficulty(stage)` in `src/config.js`
  (`stage = lap * LEVELS.length + levelIndex`).

## Save schema (`localStorage["beskar_run_save_v1"]`)

```jsonc
{
  "beskar": 0,                 // banked vault total
  "level": 0,                  // current level index (next run starts here)
  "lap":   0,                  // loops completed (drives difficulty past level 3)
  "upgrades": { "fireRate": 2 },        // stat upgrade levels
  "grogu":    { "magnet": 1, "wipe": 2 }, // Grogu perk levels
  "weapons":  { "owned": ["blaster","spread"], "active": "spread" }
}
```
Always go through `Save` (`load/save/addBeskar/buy/buyWeapon/buyGrogu/setActiveWeapon/setLevel/setProgress/reset`). `load()` normalizes/migrates missing fields.

## Gotchas (learned the hard way — don't re-break these)

- **Phaser overlap arg order:** `overlap(group, sprite, cb)` calls back
  **sprite-first** — `cb(sprite, groupChild)`. So collision callbacks in
  `GameScene` are written **order-independent** (identify each object by
  `=== this.player` / `group.contains(x)`) and never blindly `destroy(args[0])`.
  Getting this wrong destroyed the player and froze the game.
- **`file://` is blocked.** Keep the guard in `main.js`. Test over HTTP only.
- **Globals aren't on `window`.** Top-level `const`/`let` (e.g. `CONFIG`,
  `WEAPONS`, `game`) are global *lexical* bindings — reference them by bare name
  in `page.evaluate`, not `window.CONFIG`. The canvas mount div is `#game-root`
  (renamed so it doesn't collide with a `window.game` element global).
- **Timing:** cooldowns/fire use the loop `time` (stored as `this.now`); pause
  uses `this.time.paused` + `this.physics.pause()` + `this.tweens.pauseAll()`.
- **No external assets** — if a texture is missing it's a `textures.js` omission,
  not a load error.

## Current state (high level)

Built: levels 1–3 with bosses, rising+looping difficulty, auto-shoot, 9 weapons,
5 Grogu perks, 3 stat upgrades, hangar shop, pause menu, localStorage progress.
See [ROADMAP.md](ROADMAP.md) for the full done/planned/ideas list.

## Working agreements

- The owner iterates fast and in small steps ("start small, then iterate").
- After a change, **verify by running the game** (recipe above) before claiming
  it works; report console-error status honestly.
- Commit messages end with the project's Co-Authored-By trailer; push to
  `origin/master` (`git@github.com:bbcelly/kids_games.git`) when asked.
- Keep new code matching the surrounding style (plain ES5-ish classes, monospace
  HUD, comment density as in existing files).
