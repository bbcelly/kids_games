# GOAL: Build "Beskar Run" — a kids' rocket shooter

Build a complete, playable side-scrolling pixel-art **rocket shooter** for an
8–12-year-old. Themed (not licensed) after the Mandalorian/Grogu vibe: pilot a
green beskar gunship with a tiny green companion, blast waves of Imperial-style
enemies, and fight a boss to clear each level. Bright, chunky, arcade-y, fun in
the first ten seconds.

## Feel
Fast and friendly. The ship **fires automatically** — a young player just flies
and dodges. Big readable sprites, satisfying explosions, gold loot flying toward
you, a helpful companion, and always something to save up for.

## Core loop
Fly through timed **waves** of enemies → clear the screen and a **boss** flies in
→ beat it to complete the level. Enemies and bosses drop **beskar** (gold = the
currency). Die or finish → beskar banks into a vault → spend it in the **hangar**
→ launch again stronger. After the last level the campaign **loops** harder, so
there's always a "one more run."

## Controls
Move with Arrows/WASD. Auto-fire. **Q** switch weapon, **F** Force power, **P**
pause.

## Combat
Weave around collecting gold while avoiding fire and crashes. A small hull (a few
hearts) — too many hits ends the run. Enemies: quick **grunts** that rush you and
tougher **shooters** that fire back. Score rises with kills and survival, but
beskar is what matters.

## Weapons (earned & equipped in the hangar)
Start with the Blaster and work up to flashy combos; own several and swap with Q.
- **Blaster** — reliable single bolt (free starter)
- **Twin Cannon** — two parallel bolts
- **Spread Shot** — 3-way fan for crowds
- **Scatter Gun** — wide 5-way blast, short range
- **Vulcan** — rapid-fire stream
- **Homing Missiles** — curve toward enemies
- **Laser Lance** — piercing beam, hits a whole line
- **Beskar Storm** (premium) — twin bolts + a homing missile
- **Darksaber Array** (premium) — spread bolts + a piercing core

## Ship upgrades
- **Blaster Fire Rate** — shoot faster
- **Beskar Armor** — extra hull
- **Thrusters** — fly faster

## Grogu's Gifts (companion's Force powers)
- **Beskar Magnet** — gold pulled toward you from afar
- **Force Wipe** (press F) — pulse clears enemies + bullets, hurts the boss; on a
  cooldown
- **Force Mend** — companion slowly repairs your hull
- **Lucky Frog** — chance for bonus (double, sparkly) beskar drops
- **Force Bond** — revive once or twice per run when downed

## Levels & bosses
Three distinct levels, each with its own look, enemy mix, and unique boss, all
getting harder as you go — and harder again each loop. Each must genuinely *feel*
like a different place (layered scrolling backdrops with depth, not a recolor).
1. **Asteroid Field** — deep space, drifting asteroids. Boss: **Mining Hauler**,
   sprays a spread of shots.
2. **Imperial Fleet** — nebula with giant capital-ship hulls and floating debris.
   Boss: **Imperial Cruiser**, aimed shots.
3. **Planet Surface** — warm sky, distant mountains, scrolling ground. Boss:
   **Imperial Walker**, fires bursts toward you.

## Hangar (shop) & progress
Between runs, spend beskar across three areas — **Upgrades**, **Grogu's Gifts**,
**Weapons** — seeing each cost, your level in it, and the equipped weapon, then
launch back in. Everything bought and your level/loop progress is **saved**
between sessions.

## Presentation
Chunky retro pixel-art sprites and a glowing arcade HUD (hull hearts, score,
vault, beskar this run, weapon, Force status). A title screen ("BESKAR RUN — This
is the Way") with the ship drifting and progress shown. Clear "Level Complete" /
"Ship Down" moments and a pause menu.

## North star
A snackable, encouraging shoot-'em-up for short bursts: easy to start, always a
new weapon or perk to chase, scaling so it never runs out. Build the basics first
(a flyable ship shooting one enemy), then add weapons, hangar, bosses, perks, and
themed levels.
