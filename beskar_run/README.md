# BESKAR RUN — This is the Way

A kid-friendly side-scrolling pixel-art rocket shooter. Pilot a green beskar
gunship with a tiny green companion riding along, blast waves of Imperial-style
enemies, beat the boss, and spend your gold beskar in the hangar.

## How to play

Serve the folder and open it in a browser (any static server works):

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly with a `file://` URL also works in most browsers.

## Controls

| Key | Action |
|---|---|
| Arrows / WASD | Fly |
| (automatic) | Shoot |
| Q | Switch weapon |
| F | Grogu's Force Wipe (once bought) |
| P / Esc | Pause |
| M | Mute |

## The loop

Fly through waves → boss flies in → beat it to clear the level. Enemies drop
**beskar** (gold). Die or finish and it banks into your vault. Spend it in the
**hangar** on ship upgrades, nine weapons, and five of Grogu's Gifts (magnet,
screen-clearing Force Wipe, hull mending, lucky drops, and revives). Three
levels — Asteroid Field, Imperial Fleet, Planet Surface — then the campaign
loops, harder each time. Progress saves automatically (localStorage).

## Dev

- `node test/smoke.js` — headless simulation of full runs, hangar purchases,
  revives, and the campaign loop (no browser needed).
- `node test/shots.js` — drives the real game in headless Chromium and
  screenshots every screen into `test/shots/` (needs `npm i puppeteer-core`
  and a chromium binary).
