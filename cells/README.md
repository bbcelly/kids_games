# Primordial

Massively multiplayer cell-evolution PvP game, split into rooms ("soups") of up to 50–60 players:
start as a single-celled prokaryote, eat nutrients and smaller organisms (players or wild AI
creatures), and evolve through six stages:

Prokaryote → Eukaryote → Colony → Multicellular → Predator → Apex Leviathan

Each evolution lets you pick one of two traits (Flagella, Thick Membrane, Toxin Spikes, Jaws,
Cilia, Fast Metabolism), stackable up to 3 levels. You can eat another organism when you are about
20% heavier (Jaws/Membrane shift that ratio). New spawns get a 3-second shield.

## Play

- **LAN:** http://192.168.96.134:8080/ (also `http://cc-fable.cvetler.home:8080/`)
- Controls: mouse / finger / WASD or arrows to steer · Space or DASH button to dash · 1 / 2 to pick a trait.
- **Rooms:** PLAY puts you in the fullest room with space (new rooms open automatically). The start
  screen lists rooms; "+ New room" opens a fresh one. After joining, the URL becomes `?room=abcd` —
  the **Invite** button copies it, and friends opening it land in the same room.

## Rewards (reasons to come back)

All rewards are **cosmetic** — nothing gives an advantage in PvP.

- **XP & levels:** every life earns XP (mass, organisms eaten, players eaten ×more, stage reached,
  time survived; lives under 10 s / 15 mass earn nothing). Each level pays DNA; some levels unlock
  fixed items (level track up to 50).
- **DNA** (currency) buys colours, patterns, trails, name frames, titles, card backgrounds and lab
  décor in the **Wardrobe**.
- **Daily reward:** a 7-day streak (20 → 150 DNA, day 7 adds a random item); one missed day per
  week is forgiven. Days follow Europe/Prague time.
- **Daily tasks:** 3 random tasks per day (one swap allowed).
- **Achievements:** 23 badges, many with exclusive items; up to 3 can be shown on your card.
- **Collection:** 21 entries (stages, traits, trait masters, special events), each with a real
  biology fact.
- **Lab:** save creatures (Colony stage or higher) as specimens, either mid-game with the 🧪 button or on the end screen, that swim in your own decorated
  aquarium; more places at higher levels.
- **Profile card:** avatar, title, badges, stats, and your lab — shareable via `?profile=<id>`, and
  opened by clicking a name on the in-game leaderboard.

**Saving without accounts:** the server creates a profile and the browser keeps a secret token in
`localStorage`. The profile panel shows a transfer code (`XXXX-XXXX-XXXX`) to continue on another
device. Profiles are JSON files in `data/profiles/` (`DATA_DIR`), written every 5 s and on shutdown —
back up that folder. Max 20 new profiles per IP per hour (`NEW_PROFILES_PER_IP_HOUR`); set
`TRUST_PROXY=1` behind a reverse proxy so the real client IP is used.

## Run

```bash
npm install         # only dependency: ws
npm start           # PORT=8080 by default
npm test            # simulation, rooms, progression, profile storage
npm run test:net    # starts its own servers: rooms end to end, profiles/rewards incl. restart
node test/load.js 1000 ws://127.0.0.1:8080/ws 20   # load test against a running server
```

It runs permanently as a systemd service (auto-restart, starts on boot):

```bash
sudo cp primordial.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now primordial
systemctl status primordial
journalctl -u primordial -f
```

### Docker / Komodo

`Dockerfile` + `compose.yaml` build a small `node:20-alpine` image with a health check on `/health`.
Profiles are stored in a **directory on the host**, bind-mounted at `/data`: by default
`/srv/primordial/data` (change it with `PRIMORDIAL_DATA_DIR`). Docker creates it on first start and the
entrypoint makes it owned by `PUID:PGID` (default 1000:1000); the game itself never runs as root.
Back up that directory — it holds one JSON file per player in `profiles/`.

```bash
docker compose up -d --build      # http://<host>:8080/
docker compose logs -f
```

In **Komodo**: create a *Stack* with source **Git Repo** (`bbcelly/kids_games`, branch `master`),
**Run Directory** `cells`, **File Path** `compose.yaml`, then Deploy. Optional variables (Komodo
"Environment" or a `.env` file):
- `PRIMORDIAL_DATA_DIR` — host directory for profiles (`/srv/primordial/data`); use an absolute path
  outside the stack/repo folder so a re-clone never touches it
- `PUID` / `PGID` — owner of the files there (1000), e.g. your backup user
- `PRIMORDIAL_PORT` — host port (8080)
- `WORKERS` — set to the CPUs the container may use (default: all host cores − 1)
- `TRUST_PROXY=1` behind a reverse proxy, plus `MAX_CLIENTS`, `ROOM_SOFT_CAP`, `ROOM_HARD_CAP`,
  `MAX_ROOMS`, `NEW_PROFILES_PER_IP_HOUR`

Notes:
- A reverse proxy must pass WebSocket upgrades on `/ws` (Traefik and Caddy do by default; nginx needs
  `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`). With HTTPS the
  client switches to `wss://` automatically.
- Moving existing players from the systemd install: stop the old server, then copy
  `cells/data/profiles/` into `$PRIMORDIAL_DATA_DIR/profiles/` and (re)start the container — ownership
  is fixed automatically.
- Profiles are written every 5 s and flushed on `docker compose stop/down`. For a consistent backup
  copy the directory as is (each file is written atomically), or stop the stack briefly.

`GET /rooms` lists rooms; `GET /api/profile/<id>` is a public profile (no secrets); `GET /health` returns players, rooms, per-worker tick time and main-thread lag.

Settings (environment variables in `primordial.service`): `PORT` (8080), `WORKERS` (CPU cores − 1),
`ROOM_SOFT_CAP` (50, auto-join fills to this), `ROOM_HARD_CAP` (60, invite links up to this),
`MAX_ROOMS` (60), `ROOM_IDLE_MS` (300000, empty rooms close after this), `MAX_CLIENTS` (2000).

## Architecture

- `server/game.js` — pure, server-authoritative simulation (30 Hz): movement, food grid, eating,
  evolution, traits, AI bots (bots fill each room to ~14 organisms and leave as humans join).
- `server/room.js` — one room: a `Game` plus per-player snapshot building (viewport-culled,
  ~15 snapshots/s, food at 5 Hz). Emits ready-made JSON strings, never touches sockets.
- `server/room-worker.js` — a worker thread hosting several rooms; one worker per spare CPU core.
- `server/rooms.js` — pure room directory: auto-assignment, invite links, caps, closing idle rooms.
- `server/progression.js` — pure reward rules: XP/levels, daily streak, tasks, achievements,
  collection, shop/equip validation, lab. `public/catalog.js` holds every item/achievement/task and
  is shared by server and browser.
- `server/profiles.js` — profile storage (one JSON file each, atomic writes), tokens, transfer codes.
- `server/server.js` — main thread: HTTP (`public/`, `/rooms`, `/api/profile`, `/health`), WebSockets at `/ws`,
  routes players to rooms. Player input is batched per worker (steering coalesced) and validated;
  the client is never trusted. Snapshots are skipped for clients that fall behind.
- `public/draw.js` — organism drawing (shared by game, avatars, aquarium), patterns, colour modes, trails.
- `public/meta.js` — out-of-game screens: level bar, profile, lab, collection, daily/achievements, wardrobe.
- `public/` — single canvas client, no build step. Procedurally drawn organisms per stage/trait,
  client-side smoothing, HUD, leaderboard, minimap, kill feed, mobile touch support,
  room list / invite links.

## Capacity (measured on this 4-core / 4 GB container)

Load-test generator running on the same machine, so the server only had part of the CPU:

| players | rooms | snapshots/s per player | ping median / p95 | worker tick (budget 33 ms) |
|---|---|---|---|---|
| 500  | 10 | 15.0 (all) | 1 / 15 ms | ~3 ms |
| 1000 | 20 | 15.0 (all) | 13 / 122 ms | ~8–10 ms |
| 1500 | 30 | 14.8 median, some clients throttled | ~80 / 600 ms | ~9 ms |

~1000 concurrent players run comfortably; 1500 works with higher latency (here partly because the
load generator itself was using ~3 of the 4 cores). The main thread (sockets) is the next limit;
beyond that, run several instances behind a load balancer.


## Going public later

The client connects to `ws(s)://<same host>/ws`, so nothing in the code changes. Needed:
1. Forward a port from your router (public IP) to `192.168.96.134:8080`, **or** put it behind a
   reverse proxy (nginx/Caddy) on a domain.
2. For HTTPS, the proxy must also forward WebSocket upgrades on `/ws` (nginx:
   `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`).
3. To embed it in a website: link to it, or `<iframe src="https://game.example.com/" allow="fullscreen">`.
