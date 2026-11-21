#!/bin/sh
# Starts as root only to prepare the bind-mounted mods directory, then drops to an
# unprivileged user (PUID/PGID, default 1000 = "node") to run the server.
set -e
PUID="${PUID:-1000}"
PGID="${PGID:-1000}"
MODS_DIR="${MODS_DIR:-/mods}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$MODS_DIR"
  # first start with an empty folder: put the example mod there (it is switched off by default)
  if [ -z "$(ls -A "$MODS_DIR" 2>/dev/null)" ] && [ -d /app/mods-bundled ]; then
    cp -R /app/mods-bundled/. "$MODS_DIR"/
  fi
  find "$MODS_DIR" \( ! -user "$PUID" -o ! -group "$PGID" \) -exec chown "$PUID:$PGID" {} +
  exec su-exec "$PUID:$PGID" "$@"
fi
exec "$@"
