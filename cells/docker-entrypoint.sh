#!/bin/sh
# Starts as root only to make the bind-mounted data directory writable,
# then drops to an unprivileged user (PUID/PGID, default 1000 = "node") to run the game.
set -e
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
DATA_DIR="${DATA_DIR:-/data}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DATA_DIR"
  # fix ownership only where needed (a fresh host directory is created by Docker as root)
  find "$DATA_DIR" \( ! -user "$PUID" -o ! -group "$PGID" \) -exec chown "$PUID:$PGID" {} +
  exec su-exec "$PUID:$PGID" "$@"
fi
exec "$@"
