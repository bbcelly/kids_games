# BESKAR RUN — *This is the Way*

A kids' side-scrolling pixel-art **rocket shooter** (ages 8–12). Pilot a green
beskar gunship with a tiny green companion, blast waves of enemies, beat a boss
to clear each level, bank gold **beskar**, and spend it in the **Hangar** to come
back stronger. The campaign loops harder forever, so there's always "one more run."

No build step, no dependencies, no assets — everything (sprites, sound, parallax
backdrops) is generated in code.

## Play

Just open **`index.html`** in any modern browser (double-click it, or serve the
folder). Progress is saved automatically in the browser via `localStorage`.

### Controls
| Key | Action |
|-----|--------|
| Arrows / WASD | Move (you can also drag on a touchscreen) |
| *(auto)* | The ship fires by itself — just fly and dodge |
| **Q** | Switch weapon |
| **F** | Grogu's Force Wipe (clears the screen; on a cooldown) |
| **P** | Pause |
| **M** | Mute / unmute |
| Enter / Space / Click | Confirm, launch, advance screens |

## The loop
Fly through timed **waves** → screen clears and a **boss** flies in → beat it to
complete the level. Enemies and bosses drop **beskar** (gold). Die or finish →
beskar banks into your **vault** → spend it in the **Hangar** → launch again.

- **Upgrades** — Blaster Fire Rate, Beskar Armor (extra hull), Thrusters (speed)
- **Grogu's Gifts** — Beskar Magnet, Force Wipe, Force Mend, Lucky Frog, Force Bond (revive)
- **Weapons** — Blaster → Twin Cannon → Spread → Scatter → Vulcan → Homing →
  Laser Lance → ★ Beskar Storm → ★ Darksaber Array

## Levels
1. **Asteroid Field** — boss *Mining Hauler* (spread spray)
2. **Imperial Fleet** — boss *Imperial Cruiser* (aimed shots)
3. **Planet Surface** — boss *Imperial Walker* (bursts)

Clear all three → the campaign **loops**, tougher each time.

## Files
- `index.html` — page shell + canvas
- `game.js` — the whole game (engine, audio, save, weapons, enemies, bosses, hangar, HUD)
- `test_harness.js` — headless Node smoke test that mocks the canvas/DOM and drives
  the game through every state. Run with `node test_harness.js`.

> Themed (not licensed) homage to the Mandalorian/Grogu vibe.
