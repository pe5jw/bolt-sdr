#!/bin/bash
cd "$(dirname "$0")"

# Installeer websockets als nodig
python3 -c "import websockets" 2>/dev/null || pip3 install websockets

echo ""
echo "=== Bolt SDR TCI Bridge ==="
echo "CAT poort : 4532  (N1MM+: Kenwood TS-2000 / 0.0.0.0:4532)"
echo "DVK map   : ~/.local/share/Bolt/dvk/"
echo "Stoppen   : Ctrl+C"
echo ""

python3 tci_bridge.py
