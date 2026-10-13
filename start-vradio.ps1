# start-vradio.ps1 — Start the Bolt SDR virtual radio (zeus-vradio)
#
# Emulates an HermesLite2 on the local network so BoltServer can connect
# without real hardware.  Run this in one terminal, BoltServer in another.
#
# Usage:
#   .\start-vradio.ps1                           # HL2, Protocol 1, 48 kHz, noise -110
#   .\start-vradio.ps1 --board HermesII          # Hermes II instead
#   .\start-vradio.ps1 --protocol P2             # Protocol 2
#   .\start-vradio.ps1 --tone 14074000:-73       # add a CW/FT8 test tone
#
# All extra arguments are passed through to zeus-vradio unchanged.
# See Zeus.VirtualRadio.Host/Program.cs for the full option list.

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

dotnet run `
    --project "$ScriptDir\Zeus.VirtualRadio.Host" `
    -- `
    --board HermesLite2 `
    --protocol P1 `
    --bind 0.0.0.0 `
    --noise -110 `
    @args
