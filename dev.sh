#!/usr/bin/env bash
# dev.sh — bolt-sdr development stack met virtuele radio
#
# Start 3 processen:
#   1. zeus-vradio   — virtuele HPSDR radio op 127.0.0.1 (geen echte radio nodig)
#   2. StationEngine — bolt-sdr backend op poort 6061
#   3. bolt-web      — Vite dev server op poort 5173
#
# Gebruik:
#   ./dev.sh          # start alles
#   ./dev.sh stop     # stop alles
#   ./dev.sh logs     # tail alle logs
#
# Browser: http://localhost:5173
# Discover → 127.0.0.1 → virtuele radio verschijnt

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
mkdir -p .dev

VRADIO_PID_FILE=".dev/vradio.pid"
BACKEND_PID_FILE=".dev/backend.pid"
VITE_PID_FILE=".dev/vite.pid"
VRADIO_LOG=".dev/vradio.log"
BACKEND_LOG=".dev/backend.log"
VITE_LOG=".dev/vite.log"

# Tonen die zichtbaar zijn in de panadapter:
#   14.074 MHz  FT8 band  (S9, -73 dBc)
#   14.200 MHz  SSB band  (S7, -80 dBc)
#   7.074 MHz   40m FT8   (S5, -90 dBc)
VRADIO_ARGS="--board HermesLite2 --protocol P1 --bind 127.0.0.1 --rate 48 \
  --tone 14074000:-73 --tone 14200000:-80 --tone 7074000:-90 --noise -110"

# ── stop ──────────────────────────────────────────────────────────────────
stop_all() {
  echo "→ stoppen..."
  for f in "$VRADIO_PID_FILE" "$BACKEND_PID_FILE" "$VITE_PID_FILE"; do
    if [ -f "$f" ]; then
      pid=$(cat "$f")
      if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        echo "  gestopt PID $pid ($(basename "$f" .pid))"
      fi
      rm -f "$f"
    fi
  done
  echo "klaar."
}

# ── logs ──────────────────────────────────────────────────────────────────
show_logs() {
  tail -f "$VRADIO_LOG" "$BACKEND_LOG" "$VITE_LOG" 2>/dev/null
}

# ── commando's ────────────────────────────────────────────────────────────
case "${1:-start}" in
  stop)  stop_all; exit 0 ;;
  logs)  show_logs; exit 0 ;;
  start) ;;
  *) echo "gebruik: ./dev.sh [start|stop|logs]" >&2; exit 1 ;;
esac

# ── start ─────────────────────────────────────────────────────────────────

# Bestaande processen opruimen
stop_all 2>/dev/null || true
sleep 1

# 1. Virtuele radio
echo "→ virtuele radio starten (zeus-vradio op 127.0.0.1)..."
: > "$VRADIO_LOG"
# shellcheck disable=SC2086
nohup dotnet run --project Zeus.VirtualRadio.Host -- $VRADIO_ARGS \
  > "$VRADIO_LOG" 2>&1 &
echo $! > "$VRADIO_PID_FILE"
disown $! 2>/dev/null || true

# 2. bolt-web Vite dev server
echo "→ bolt-web Vite dev server starten op poort 5173..."
: > "$VITE_LOG"
nohup npm --prefix bolt-web run dev \
  > "$VITE_LOG" 2>&1 &
echo $! > "$VITE_PID_FILE"
disown $! 2>/dev/null || true

# 3. StationEngine backend (als binary beschikbaar is)
if [ -f "./StationEngine" ]; then
  echo "→ StationEngine backend starten op poort 6061..."
  : > "$BACKEND_LOG"
  nohup ./StationEngine --port 6060 --bind lan \
    > "$BACKEND_LOG" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"
  disown $! 2>/dev/null || true
else
  echo "⚠  StationEngine niet gevonden — alleen virtuele radio + Vite gestart."
  echo "   Zet de StationEngine binary in de root map."
fi

# Wacht even voor Vite klaar is
echo "→ wachten op Vite..."
tries=0
while [ $tries -lt 30 ]; do
  if curl -s http://localhost:5173 > /dev/null 2>&1; then
    break
  fi
  sleep 1
  tries=$((tries + 1))
done

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  bolt-sdr dev stack actief                          ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Browser:   http://localhost:5173                   ║"
echo "║  Discover → 127.0.0.1 → verbind met virtuele radio ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Tonen in panadapter:                               ║"
echo "║    14.074 MHz  (FT8, S9)                            ║"
echo "║    14.200 MHz  (SSB, S7)                            ║"
echo "║     7.074 MHz  (40m FT8, S5)                        ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Logs:   ./dev.sh logs                              ║"
echo "║  Stop:   ./dev.sh stop                              ║"
echo "╚══════════════════════════════════════════════════════╝"
