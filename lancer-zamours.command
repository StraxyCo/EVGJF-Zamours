#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Kill any existing server on port 8000
pkill -f "http.server 8000" 2>/dev/null || true
sleep 1

# Start the server
echo "🎮 Les Z'Amours — Serveur en cours de démarrage..."
echo ""
echo "Accès: http://localhost:8000"
echo ""
sleep 1

# Open browser
open "http://localhost:8000"

# Start server
python3 -m http.server 8000
