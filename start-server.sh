#!/bin/bash
# Start the Les Z'Amours game server

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Kill any existing server on port 8000
pkill -f "http.server 8000" 2>/dev/null || true
sleep 1

# Start the server
echo "🎮 Démarrage du serveur sur http://localhost:8000"
echo "Appuie sur Ctrl+C pour arrêter"
python3 -m http.server 8000
