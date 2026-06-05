#!/bin/bash
# Double-click this file (macOS) to play Beskar Run.
# It starts a tiny local web server in this folder and opens the game.
# Close this Terminal window (or press Ctrl+C) to stop the server.

cd "$(dirname "$0")" || exit 1
PORT=8000

# Pick a Python that has http.server
if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python isn't installed. Install it, or run any static server in this folder."
  echo "Press any key to close."; read -r -n 1; exit 1
fi

echo "🚀 Beskar Run is starting at http://localhost:$PORT"
echo "   Keep this window open while you play. Ctrl+C to stop."

# Open the browser once the server is up
( sleep 1; (command -v open >/dev/null 2>&1 && open "http://localhost:$PORT/index.html") || true ) &

# Serve (this blocks until you stop it)
"$PY" -m http.server "$PORT"
