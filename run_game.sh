#!/bin/bash

# Navigate to the GlassTones directory
cd /Users/ny2022/Documents/Cursor/GlassTones

# Start a simple HTTP server accessible from local network
python3 -m http.server 8002 --bind 0.0.0.0 &

# Output the local IP for convenience
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
echo "Server running: http://$LOCAL_IP:8002"

# Wait for the server to start
sleep 2

# Open the game in the default web browser
open http://localhost:8002 