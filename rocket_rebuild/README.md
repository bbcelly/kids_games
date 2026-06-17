# BESKAR RUN — *This is the Way*

A kids' side-scrolling pixel-art **rocket shooter** (ages 8–12). Pilot a green
beskar gunship with a tiny green companion, blast waves of enemies, beat a boss
to clear each level, bank gold **beskar**, and spend it in the **Hangar** to come
back stronger. The campaign loops harder forever, so there's always "one more run."

No build step, no dependencies, no assets — everything (sprites, sound, parallax
backdrops, even the app icons) is generated in code.

## Play

Just open **`index.html`** in any modern browser (double-click it, or serve the
folder). Progress is saved automatically in the browser via `localStorage`.

### Controls — desktop
| Key | Action |
|-----|--------|
| Arrows / WASD | Move |
| *(auto)* | The ship fires by itself — just fly and dodge |
| **Q** | Switch weapon |
| **F** | Grogu's Force Wipe (clears the screen; on a cooldown) |
| **P** | Pause |
| **M** | Mute / unmute |
| Enter / Space / Click | Confirm, launch, advance screens |

### Controls — mobile / touch
On a phone or tablet the controls adapt automatically:
- **Touch & hold anywhere** to summon a floating **joystick**: where you press becomes
  its centre, and pushing your thumb out from there steers the ship in that direction
  (the further you push, the faster it flies). The ship holds position until you push,
  and fires on its own. Push past the ring and the joystick base trails your thumb.
- **On-screen buttons** appear at the edges: ⏸ pause + 🔊 mute (top-right), and — once
  you own the gear — **WPN** to swap weapon and **F** for the Force Wipe (bottom-right).
- **Tap** menus, cards, and the LAUNCH button; **‹** in the Hangar goes back to the title.
- A second finger can hold a button while the first keeps flying (multi-touch).

## Install as a phone app (PWA)
Beskar Run is a Progressive Web App, so it installs to the home screen and runs
fullscreen & offline — no app store, no native build:

1. **Serve it over http(s)** (a service worker needs it — `file://` won't register one).
   Quick local test: `python3 -m http.server` in this folder, then open the URL on your phone
   (same Wi-Fi), e.g. `http://<your-computer-ip>:8000/`. For real use, host the folder anywhere
   static (GitHub Pages, Netlify, etc.).
2. **Add to Home Screen** — Android Chrome shows an install prompt / menu item; on iOS use
   Safari → Share → *Add to Home Screen*.
3. Launch from the icon: it opens fullscreen in landscape with the touch controls.

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
- `index.html` — page shell + canvas, PWA wiring (manifest, icons, service-worker
  registration, fullscreen/landscape on first tap, rotate-to-landscape prompt)
- `game.js` — the whole game (engine, audio, save, weapons, enemies, bosses, hangar,
  HUD, keyboard + multi-touch input, on-screen touch buttons)
- `manifest.json` — web app manifest (name, icons, standalone + landscape display)
- `sw.js` — service worker; caches the app shell for offline play
- `make_icons.js` — regenerates the app icons in code (pure Node, no deps). Run with
  `node make_icons.js`. Outputs `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`,
  `favicon-32.png`
- `test_harness.js` — headless Node smoke test that mocks the canvas/DOM and drives
  the game through every state, including the touch controls. Run with `node test_harness.js`.

> Themed (not licensed) homage to the Mandalorian/Grogu vibe.
