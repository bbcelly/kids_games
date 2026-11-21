# Primordial

Massively multiplayer cell-evolution PvP game. Everyone shares one "primordial soup":
start as a single-celled prokaryote, eat nutrients and smaller organisms (players or wild AI
creatures), and evolve through six stages:

Prokaryote → Eukaryote → Colony → Multicellular → Predator → Apex Leviathan

Each evolution lets you pick one of two traits (Flagella, Thick Membrane, Toxin Spikes, Jaws,
Cilia, Fast Metabolism), stackable up to 3 levels. You can eat another organism when you are about
20% heavier (Jaws/Membrane shift that ratio). New spawns get a 3-second shield.

## Play

- **LAN:** http://192.168.96.134:8080/ (also `http://cc-fable.cvetler.home:8080/`)
- Controls: mouse / finger / WASD or arrows to steer · Space or DASH button to dash · 1 / 2 to pick a trait.

## Run

```bash
npm install         # only dependency: ws
npm start           # PORT=8080 by default
npm test            # simulation tests
npm run test:net    # 4 bot clients against a running server
```

It runs permanently as a systemd service (auto-restart, starts on boot):

```bash
sudo cp primordial.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now primordial
systemctl status primordial
journalctl -u primordial -f
```

`GET /health` returns `{ok, players, tick}`.

## Architecture

- `server/game.js` — pure, server-authoritative simulation (30 Hz): movement, food grid, eating,
  evolution, traits, AI bots (bots fill the world to ~14 organisms and leave as humans join).
- `server/server.js` — one Node process serving `public/` over HTTP plus the WebSocket at `/ws`.
  Sends each client ~15 snapshots/s culled to its viewport; food is sent at 5 Hz.
  Input is validated and rate-limited; the client is never trusted.
- `public/` — single canvas client, no build step. Procedurally drawn organisms per stage/trait,
  client-side smoothing, HUD, leaderboard, minimap, kill feed, mobile touch support.

## Going public later

The client connects to `ws(s)://<same host>/ws`, so nothing in the code changes. Needed:
1. Forward a port from your router (public IP) to `192.168.96.134:8080`, **or** put it behind a
   reverse proxy (nginx/Caddy) on a domain.
2. For HTTPS, the proxy must also forward WebSocket upgrades on `/ws` (nginx:
   `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`).
3. To embed it in a website: link to it, or `<iframe src="https://game.example.com/" allow="fullscreen">`.
