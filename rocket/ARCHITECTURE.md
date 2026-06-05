# ARCHITECTURE.md — how Beskar Run is built

Code-level companion to [CLAUDE.md](CLAUDE.md). Describes the scenes, the game
loop, data flow, and the key systems.

## Big picture

```
            BootScene ──► MenuScene ──► GameScene ──► ShopScene
          (build all      (title,       (one LEVEL:    (3-column hangar:
           textures)       launch)       waves→boss)    spend beskar)
                                            │  ▲              │
                                   death/win│  └──────────────┘
                                            ▼   launch next run
```

- **Phaser.Game** is created in `main.js` with `scene: [Boot, Menu, Game, Shop]`,
  arcade physics (zero gravity), `pixelArt: true`, `Scale.FIT` at a fixed logical
  960×540.
- Scenes are `Phaser.Scene` subclasses. Only one runs at a time; transitions use
  `this.scene.start('<Key>')`.
- There is no global game-state object beyond `Save` (localStorage). Each run is
  a fresh `GameScene` that reads the save on `create()` and writes back on
  death / level-complete / purchases.

## Registries & helpers (plain global data)

| File | Exposes | Consumed by |
|------|---------|-------------|
| `config.js` | `CONFIG` (tuning), `LEVELS` (waves+boss per level), `computeDifficulty(stage)` | GameScene, MenuScene |
| `upgrades.js` | `UPGRADES`, `upgradeCost(up,lvl)`, `computeStats(levels)` | GameScene (stats), ShopScene |
| `weapons.js` | `WEAPONS`, `getWeapon(id)`, `DEFAULT_WEAPON` | GameScene (firing), ShopScene |
| `grogu.js` | `GROGU_PERKS`, `groguCost(p,lvl)`, `computeGrogu(levels)` | GameScene (perks), ShopScene |
| `textures.js` | `buildTextures(scene)` | BootScene |
| `save.js` | `Save` (the only persistence API) | every scene |

`computeStats` / `computeGrogu` fold owned levels into a flat object the
GameScene reads each run. This is the pattern: **registry of definitions →
compute derived values → scene reads derived values.**

## GameScene — the core loop

`create()` reads the save and sets up the run:
- level/difficulty: `levelIndex`, `level`, `waves`, `lap`,
  `stage = lap*LEVELS.length + levelIndex`, `diff = computeDifficulty(stage)`,
  and pre-scaled shooter values.
- loadout: `stats` (from upgrades), `ownedWeapons`, `activeWeapon`, `grogu`
  (perk-derived values), `reviveLeft`.
- entities: physics groups `playerBullets`, `enemyBullets`, `enemies`, `pickups`;
  the `player` sprite + `companion` image.
- input: cursors + WASD; key handlers for **Q** (cycle weapon), **F** (Force
  Wipe), **P** (pause), and **R/H** (only while paused).
- collisions: four `overlap`s (see Collisions below). Boss overlaps are added
  when the boss spawns.
- HUD text objects (hull, level+score, vault, run beskar, weapon, Force status).

`update(time, delta)` (skipped while `over`/`won`/`paused`):
`now=time` → movement → auto-shoot → homing steering → magnet → mend →
wave dispatch → boss trigger → boss update → enemy fire → cull offscreen →
refresh HUD.

### Firing & weapons
Auto-shoot: when `time > nextFire`, the active weapon's `fire(scene, x, y)` runs
and `nextFire = time + stats.fireDelay * weapon.fireMult`. Weapons spawn bullets
through `scene.firePlayerShot(x, y, angleDeg, opts)`, which sets velocity from
the angle and tags the bullet with `damage` / `pierce` / `homing`. Homing bullets
steer toward `nearestTarget()` each frame; piercing bullets keep a `hitIds` list
so they damage each enemy (and the boss, id `'boss'`) only once.

### Waves → boss
`handleWaves()` dispatches each wave's enemies (staggered `delayedCall`s) once the
run clock passes the wave's `at`. Wave size = `wave.count + diff.countBonus`.
`handleBossTrigger()` waits until **all waves are dispatched and the screen is
clear** (`pendingSpawns === 0 && enemies empty`), shows a telegraph, then
`spawnBoss()`. The boss is a single physics sprite (not in the `enemies` group)
with its own overlaps, a health bar (a Rectangle scaled by `hp/maxHp`), vertical
patrol, and a fire `pattern` (`spread`/`aimed`/`burst`). `defeatBoss()` →
`levelComplete()`.

### Difficulty
`computeDifficulty(stage)` returns multipliers/bonuses applied at spawn time:
enemy `hp += hpBonus`, speed `*= speedMult`, shooter `fireEvery *= fireMult` and
`bulletSpeed *= bulletMult`, wave `count += countBonus`, boss hp/fire/bullet
scaled. `stage` grows with level and with each completed loop (`lap`), so it's
monotonic and unbounded.

### Grogu perks (in GameScene)
- **magnet** (`magnetRadius`): `handleMagnet()` redirects nearby pickups to the player.
- **wipe** (`wipeLevel`, `wipeCooldown`): `forceWipe()` on **F** clears enemies +
  enemy bullets, chips the boss, with a cooldown shown in the HUD.
- **mend** (`mendEvery`): `handleMend()` repairs 1 hull on an interval.
- **lucky** (`luckyChance`/`luckyMult`): `killEnemy()` may drop multiplied
  (purple-tinted) beskar.
- **bond** (`reviveCharges`→`reviveLeft`): in `damage()`, a lethal hit triggers
  `forceRevive()` instead of death until charges run out.

### Death vs win
`endRun()` banks beskar, shows SHIP DOWN, SPACE → Shop (retry same level).
`levelComplete()` banks beskar, advances `Save.setProgress(level, lap)` (loop +
lap++ after the finale), shows LEVEL COMPLETE, SPACE → Shop.

### Pause
`pauseGame()` sets `paused`, `physics.pause()`, `time.paused = true`,
`tweens.pauseAll()`, and draws the overlay. Resume reverses it. R/H bank +
`scene.restart()` / `scene.start('Shop')`.

## Collisions (order-independent)

Registered in `create()` (+ boss overlaps in `spawnBoss`):
- `playerBullets × enemies` → `hitEnemy` (identify enemy via `enemies.contains`)
- `player × enemies` → `crashIntoEnemy`
- `enemyBullets × player` → `hitByBullet`
- `player × pickups` → `collectBeskar`
- `playerBullets × boss` → `hitBoss`; `player × boss` → `crashIntoBoss`

Each callback figures out which argument is which (Phaser may pass them
sprite-first) and never destroys the player. See the gotcha in CLAUDE.md.

## ShopScene — the hangar

Three columns built from a `this.cols` array: `{title, kind, list, x}` for
`UPGRADES` / `GROGU_PERKS` / `WEAPONS`. A cursor (`this.col`,`this.row`) moves
with arrows/WASD; **ENTER** buys/equips via the matching `Save.buy*`; **SPACE**
launches the current level; **R** resets all progress. `refresh()` redraws every
row (level dots for leveled items; `◆`/`✓`/`◈cost` for weapons) and a detail
line for the selected item. Adding a registry entry adds a row automatically.

## Rendering notes

All sprites are built once in `buildTextures(scene)` as small rectangle
compositions, then referenced by texture key. The starfield is a 256×256 tiled
texture scrolled via `tilePositionX`, tinted per level. HUD is monospace text;
overlays are translucent Rectangles + text at high depth.
