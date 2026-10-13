#!/usr/bin/env bash
# start-vradio.sh — Start the Bolt SDR virtual radio (zeus-vradio)
#
# Emulates an HermesLite2 on the local network so BoltServer can connect
# without real hardware.  Run this in one terminal, BoltServer in another.
#
# Usage:
#   ./start-vradio.sh                     # HL2, Protocol 1, 48 kHz, noise -110
#   ./start-vradio.sh --board HermesII    # Hermes II instead
#   ./start-vradio.sh --protocol P2       # Protocol 2
#   ./start-vradio.sh --tone 14074000:-73 # add a CW/FT8 test tone
#
# All extra arguments are passed through to zeus-vradio unchanged.
# See Zeus.VirtualRadio.Host/Program.cs for the full option list.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

exec dotnet run \
    --project "$SCRIPT_DIR/Zeus.VirtualRadio.Host" \
    -- \
    --board HermesLite2 \
    --protocol P1 \
    --bind 0.0.0.0 \
    --noise -110 \
    "$@"
