# dev.ps1 — bolt-sdr development stack met virtuele radio
#
# Start 3 processen in aparte vensters:
#   1. zeus-vradio   — virtuele HPSDR radio op 127.0.0.1
#   2. StationEngine — bolt-sdr backend op poort 6061
#   3. bolt-web      — Vite dev server op poort 5173
#
# Gebruik:
#   .\dev.ps1          # start alles
#   .\dev.ps1 stop     # stop alles
#
# Browser: http://localhost:5173
# Discover → 127.0.0.1 → verbind met virtuele radio

param(
    [string]$Action = "start"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$PidFile = "$ScriptDir\.dev\pids.txt"
New-Item -ItemType Directory -Force -Path "$ScriptDir\.dev" | Out-Null

function Stop-All {
    if (Test-Path $PidFile) {
        Get-Content $PidFile | ForEach-Object {
            $pid = [int]$_
            try {
                Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                Write-Host "  gestopt PID $pid"
            } catch {}
        }
        Remove-Item $PidFile -Force
    }
    Write-Host "klaar."
}

if ($Action -eq "stop") {
    Write-Host "-> stoppen..."
    Stop-All
    exit 0
}

# Bestaande processen opruimen
Write-Host "-> bestaande processen stoppen..."
Stop-All 2>$null
Start-Sleep -Seconds 1

$pids = @()

# 1. Virtuele radio
Write-Host "-> virtuele radio starten (zeus-vradio op 127.0.0.1)..."
$vradio = Start-Process -FilePath "dotnet" -ArgumentList @(
    "run", "--project", "Zeus.VirtualRadio.Host", "--",
    "--board", "HermesLite2",
    "--protocol", "P1",
    "--bind", "127.0.0.1",
    "--rate", "48",
    "--tone", "14074000:-73",
    "--tone", "14200000:-80",
    "--tone", "7074000:-90",
    "--noise", "-110"
) -PassThru -WindowStyle Normal
$pids += $vradio.Id

# 2. bolt-web Vite dev server
Write-Host "-> bolt-web Vite dev server starten op poort 5173..."
$vite = Start-Process -FilePath "cmd" -ArgumentList "/c npm --prefix bolt-web run dev" `
    -PassThru -WindowStyle Normal
$pids += $vite.Id

# 3. StationEngine (als aanwezig)
if (Test-Path "$ScriptDir\StationEngine.exe") {
    Write-Host "-> StationEngine backend starten op poort 6061..."
    $backend = Start-Process -FilePath "$ScriptDir\StationEngine.exe" `
        -ArgumentList "--port 6061 --bind lan" `
        -PassThru -WindowStyle Normal
    $pids += $backend.Id
} else {
    Write-Host "⚠  StationEngine.exe niet gevonden — alleen virtuele radio + Vite gestart."
}

# PIDs opslaan voor stop commando
$pids | Set-Content $PidFile

# Wacht even
Start-Sleep -Seconds 3

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗"
Write-Host "║  bolt-sdr dev stack actief                          ║"
Write-Host "╠══════════════════════════════════════════════════════╣"
Write-Host "║  Browser:   http://localhost:5173                   ║"
Write-Host "║  Discover → 127.0.0.1 → verbind met virtuele radio ║"
Write-Host "╠══════════════════════════════════════════════════════╣"
Write-Host "║  Tonen in panadapter:                               ║"
Write-Host "║    14.074 MHz  (FT8, S9)                            ║"
Write-Host "║    14.200 MHz  (SSB, S7)                            ║"
Write-Host "║     7.074 MHz  (40m FT8, S5)                        ║"
Write-Host "╠══════════════════════════════════════════════════════╣"
Write-Host "║  Stop:   .\dev.ps1 stop                             ║"
Write-Host "╚══════════════════════════════════════════════════════╝"
