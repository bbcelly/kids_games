# GOAL: "Beskar Run" — a kids' rocket shooter (Android phone game)

A complete, playable side-scrolling pixel-art **rocket shooter** for an
8–12-year-old, as a **native Android phone game**. Themed (not licensed) after
the Mandalorian/Grogu vibe: pilot a green beskar gunship with a tiny companion,
blast Imperial-style enemy waves, beat a boss per level. Bright, chunky,
arcade-y, fun in ten seconds.

## Platform & tech
Native Android app in **Godot** (GDScript), exported to an installable
**APK/AAB**. Locked **landscape**, built for **phone screens**: big touch
targets, a HUD readable at arm's length, scaling across resolutions. Saves to
**local device storage** — no account or network.

## Controls
Touchscreen for small thumbs. Fly with a **virtual joystick** (left) and
**auto-fire** — a young player just flies and dodges. Right-side tap buttons:
**Switch Weapon** and **Force Power**. **Pause** in a top corner. Controls are
chunky, kid-friendly, and placed so thumbs never cover the action.

## Core loop
Fly timed **waves** → clear the screen → a **boss** flies in → beat it to finish
the level. Enemies and bosses drop **beskar** (gold = currency). Die or finish →
beskar banks to a vault → spend in the **hangar** → relaunch stronger. After the
last level the campaign **loops** harder — always "one more run."

## Combat
Collect gold while dodging fire and crashes. A small hull (a few hearts) — too
many hits ends the run. Enemies: quick **grunts** that rush you, tougher
**shooters** that fire back. Score rises with kills, but beskar matters most.

## Weapons (earned & equipped in the hangar)
Start with the Blaster, work up to flashy combos; own several and swap mid-run.
- **Blaster** — single bolt (free starter)
- **Twin Cannon** — two parallel bolts
- **Spread Shot** — 3-way fan for crowds
- **Scatter Gun** — wide 5-way, short range
- **Vulcan** — rapid-fire stream
- **Homing Missiles** — curve toward enemies
- **Laser Lance** — piercing beam, hits a line
- **Beskar Storm** (premium) — twin bolts + homing missile
- **Darksaber Array** (premium) — spread bolts + piercing core

## Ship upgrades
- **Blaster Fire Rate** — shoot faster
- **Beskar Armor** — extra hull
- **Thrusters** — fly faster

## Grogu's Gifts (companion's Force powers)
- **Beskar Magnet** — gold pulled to you from afar
- **Force Wipe** (Force Power button) — pulse clears enemies + bullets, hurts the
  boss; cooldown
- **Force Mend** — companion slowly repairs your hull
- **Lucky Frog** — chance for bonus (sparkly) beskar drops
- **Force Bond** — revive once or twice per run

## Levels & bosses
Three distinct levels — each its own look, enemy mix, and boss — harder as you go
and each loop. Each must *feel* like a different place (layered scrolling
backdrops with depth, not a recolor).
1. **Asteroid Field** — deep space, drifting asteroids. Boss: **Mining Hauler**,
   sprays shots.
2. **Imperial Fleet** — nebula with capital-ship hulls and debris. Boss:
   **Imperial Cruiser**, aimed shots.
3. **Planet Surface** — warm sky, mountains, scrolling ground. Boss: **Imperial
   Walker**, fires bursts.

## Hangar (shop) & progress
Between runs, spend beskar across **Upgrades**, **Grogu's Gifts**, **Weapons** —
each showing cost, your level, and the equipped weapon — then relaunch.
Everything bought and your level/loop progress is **saved**.

## Presentation
Chunky retro pixel-art and a glowing arcade HUD (hearts, score, vault, beskar,
weapon, Force status), laid out for a **landscape phone** with status pinned to
the edges so controls never cover it. Title screen ("BESKAR RUN — This is the
Way"), clear "Level Complete" / "Ship Down" moments, and a pause menu.

## North star
A snackable shoot-'em-up for short bursts: easy to start, always a new weapon or
perk to chase, scaling so it never runs out. Build basics first (a flyable ship,
one enemy), then weapons, hangar, bosses, perks, themed levels.
