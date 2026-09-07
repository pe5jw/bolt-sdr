#!/bin/bash
# Bolt SDR Start Script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Bolt SDR ==="
echo "Starting StationEngine..."
echo "Open Chrome and navigate to https://$(hostname -I | awk '{print $1}'):6443"
echo ""

chmod +x ./StationEngine
./StationEngine --port 6061 --bind lan --lan-https-port 6443 --product-lan-https-port 6444 --webroot ./web