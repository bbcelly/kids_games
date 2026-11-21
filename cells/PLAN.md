# Primordial — multiplayer evolution game (cells/)

## Context
User wants an online multiplayer PvP game: start as a single cell, eat food and other players, evolve into progressively more complex multicellular creatures. `cells/` is empty. Infra check: this host is a LAN Proxmox container (192.168.96.134, `cc-fable.cvetler.home`), Node 20 installed, no web server running, no website. User chose **LAN only for now, no website yet** → one Node process serves both the page and the real-time WebSocket, reachable at `http://192.168.96.134:8080/`, structured so it can later sit behind a reverse proxy / public domain unchanged (client connects to `ws(s)://<same host>/ws`).

## Architecture
- `cells/server/server.js` — Node `http` server: serves `cells/public/` static files + WebSocket at `/ws` (`ws` npm package; if npm unavailable, a ~100-line built-in RFC6455 handler). Server-authoritative simulation, 30 Hz tick, 15–20 Hz snapshots per client culled to their viewport (spatial hash grid).
- `cells/server/game.js` — pure simulation (world, entities, eating, evolution), no I/O → unit-testable.
- `cells/public/index.html` + `client.js` — single canvas client: name entry → play; interpolates snapshots; mouse / touch (follow finger) / keyboard (WASD/arrows) steering; Space = dash, mobile dash button.
- `cells/package.json`, `cells/README.md`, `cells/primordial.service` (systemd unit, auto-restart, installed to `/etc/systemd/system`).
- JSON messages (small, rounded numbers); input messages rate-limited and validated server-side (no client trust).

## Gameplay
- World 5000×5000 "primordial soup", nutrient food particles respawn continuously; AI bot organisms keep it lively when few humans are online (bots fill up to ~12 entities, fewer as humans join).
- **Evolution stages by biomass** (each visibly different, procedurally drawn):
  1. Prokaryote — wobbly single blob
  2. Eukaryote — nucleus + organelles, slightly faster
  3. Colony — cluster of 3–5 linked cells orbiting
  4. Multicellular organism — segmented body + flagella tail
  5. Predator — jaws, eyes, spikes
  6. Apex creature — large multi-segment beast with tentacles
- On each evolve, player picks 1 of 2 traits (e.g. Flagella = speed, Membrane armor = harder to eat, Spikes = damage on contact, Jaws = eat at smaller size ratio, Cilia = turning/magnetic food pickup).
- **PvP eating**: you can absorb another organism when your mass ≥ 1.2× theirs (modified by traits) and you overlap its center; gain a share of its mass. Bigger = slower. Slow mass decay at high stages so leaders don't run away forever.
- Dash: short burst costing a little mass, cooldown.
- Death → respawn screen with stats (stage reached, kills, max mass); keep name.
- HUD: stage name + progress bar to next evolution, mass, leaderboard top 10, minimap, kill feed, online player count.

## Steps
1. Scaffold package, check `npm install ws` works (fallback to built-in WS).
2. Write `game.js` simulation + `server.js` networking/static serving.
3. Write client (rendering per stage, interpolation, input, HUD, mobile layout).
4. Unit-ish tests: node script exercising game.js (eat rule, evolution thresholds, bounds).
5. Install systemd service, start, enable on boot.
6. Commit in `cells/` (repo root /root/kids_games, branch master).

## Verification
- `node test/sim.test.js` passes.
- `systemctl status primordial` active; `curl http://192.168.96.134:8080/` returns the page.
- Headless multi-client test script: spawn 3 WebSocket clients, steer them, confirm snapshots arrive, one eats another, evolution triggers.
- Browser check with puppeteer-core (already used in `beskar_run/`) if a Chromium is available: load page, enter name, screenshot gameplay.
- Report the LAN URL; note what's needed later for public access (port forward/reverse proxy + domain + TLS → wss).
