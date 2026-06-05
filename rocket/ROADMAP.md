# ROADMAP.md — Beskar Run

What's built, what's planned, and ideas to pull from. See [CLAUDE.md](CLAUDE.md)
for how to add things and [ARCHITECTURE.md](ARCHITECTURE.md) for how it works.

## ✅ Built

- **Core loop:** side-scrolling auto-shooter; move (Arrows/WASD), the ship fires
  itself; collect beskar; die → bank → hangar → relaunch.
- **Levels + bosses:** 3 levels (Asteroid Field, Imperial Fleet, Planet Surface),
  each = data-driven waves → a unique boss (Mining Hauler / Imperial Cruiser /
  Imperial Walker) with a health bar, vertical patrol, and a fire pattern
  (spread / aimed / burst). Beat the boss to advance; die to retry the level.
- **Rising, looping difficulty:** `computeDifficulty(stage)` scales enemy hull,
  speed, fire rate, bullet speed, and wave size every level, and keeps climbing
  each loop (persistent `lap`). Bosses scale too.
- **Weapons (9):** Blaster, Twin Cannon, Spread, Scatter, Vulcan, Homing
  Missiles, Laser Lance, + combos Beskar Storm & Darksaber Array. Bought/equipped
  in the hangar; switched in-flight with **Q**.
- **Grogu's Gifts (5):** Beskar Magnet, Force Wipe (**F**), Force Mend, Lucky
  Frog, Force Bond (revive).
- **Stat upgrades (3):** Fire Rate, Beskar Armor (+hull), Thrusters (speed).
- **Hangar:** 3-column navigable shop; all purchases persist in `localStorage`.
- **Pause menu (P):** Resume / Restart run / Hangar.
- **HUD:** hull, level + score, vault total + beskar this run, active weapon,
  Force-ability status (cooldown / Bond charges).
- **Robustness:** procedural pixel art (no assets); refuses to run from `file://`
  with instructions; `play.command` launcher for macOS.

## 🔜 Planned (next, roughly in order)

1. **Themed art & terrain per level** — distinct backdrops/obstacles (asteroids,
   fleet hulls, ground turrets) instead of just a tint. Biggest visual upgrade.
2. **Boss attack-pattern variety & phases** — multi-phase bosses that change
   patterns as HP drops; telegraphed special attacks.
3. **Mid-flight weapon power-up pickups** — temporary weapon drops during play
   (the "Both" acquisition option we deferred).
4. **Sound** — simple SFX (shoot, hit, explosion, pickup, boss) and light music;
   would need an audio approach that still works without external files or via a
   tiny CDN/base64.
5. **Reward scaling** — harder enemies/bosses drop more beskar so deeper loops
   stay worthwhile.

## 💡 Idea backlog (unscheduled)

- More Grogu perks: **Force Slow** (bullet-time burst), **Force Shield** (absorb
  N hits at run start), **Beskar Bloom** (pickups worth more).
- More weapons: charge beam, boomerang bolts, drone/companion turret.
- Difficulty options / kid-friendly "easy" toggle; per-curve tuning in the menu.
- Endless/score-attack mode separate from the level campaign; high-score save.
- Combo/score multiplier for chained kills; on-screen score popups.
- Controller/touch support (the audience is keyboard today).
- Real pixel-art sprite sheets to replace procedural textures (swap in
  `textures.js` without touching scenes).
- Settings: volume, screen shake toggle, reset-progress confirmation (currently
  **R** in the hangar wipes everything immediately — a confirm would be safer).

## ⚠️ Known rough edges

- Hangar **R** resets ALL progress with no confirmation (footgun for kids).
- Two Grogu center-flash messages can briefly overlap if they fire on the same
  frame (cosmetic; only with coincident timers).
- No audio yet.
- Only the Phaser CDN is an external dependency; offline play needs it cached.
