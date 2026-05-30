#!/usr/bin/env bash
# Lance Les Z'Amours en local (mode offline complet)
set -e

PORT=8765
DIR="$(cd "$(dirname "$0")" && pwd)"

open_browser() {
  sleep 0.4
  if command -v open &>/dev/null; then
    open "http://localhost:$PORT"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "http://localhost:$PORT"
  fi
}

echo ""
echo "  🎮  Les Z'Amours"
echo "  ➜   http://localhost:$PORT"
echo ""

if command -v python3 &>/dev/null; then
  open_browser &
  python3 -m http.server $PORT --directory "$DIR"
elif command -v python &>/dev/null; then
  cd "$DIR"
  open_browser &
  python -m SimpleHTTPServer $PORT
elif command -v npx &>/dev/null; then
  open_browser &
  npx --yes serve "$DIR" --listen $PORT
else
  echo "  ❌  Python 3 ou Node.js requis."
  echo "      → https://www.python.org/downloads/"
  exit 1
fi
