param([string]$Action = "start")

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$PidFile = Join-Path $ScriptDir ".dev\pids.txt"
New-Item -ItemType Directory -Force -Path (Join-Path $ScriptDir ".dev") | Out-Null

function Stop-All {
    if (Test-Path $PidFile) {
        Get-Content $PidFile | ForEach-Object {
            $p = [int]$_
            try { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; Write-Host "  gestopt PID $p" } catch {}
        }
        Remove-Item $PidFile -Force
    }
    Write-Host "klaar."
}

function Start-Window([string]$Title, [string]$Cmd) {
    $args = "-NoExit -Command `"`$host.UI.RawUI.WindowTitle = '$Title'; Set-Location '$ScriptDir'; $Cmd`""
    return Start-Process "powershell.exe" -ArgumentList $args -PassThru
}

if ($Action -eq "stop") { Write-Host "-> stoppen..."; Stop-All; exit 0 }

Write-Host "-> bestaande processen stoppen..."
Stop-All 2>$null
Start-Sleep -Seconds 1

$pids = @()

Write-Host "-> virtuele radio starten (zeus-vradio op 127.0.0.1)..."
$vradioCmd = "dotnet run --project Zeus.VirtualRadio.Host -- --board HermesLite2 --protocol P1 --bind 127.0.0.1 --rate 48 --tone 14074000:-73 --tone 14200000:-80 --tone 7074000:-90 --noise -110"
$p1 = Start-Window -Title "vradio" -Cmd $vradioCmd
$pids += $p1.Id

Write-Host "-> bolt-web Vite dev server starten op poort 5173..."
$p2 = Start-Window -Title "bolt-web" -Cmd "npm --prefix bolt-web run dev"
$pids += $p2.Id

$SeDir = "C:\dev\station-engine-dist"
$SeExe = Join-Path $SeDir "StationEngine.exe"
if (Test-Path $SeExe) {
    Write-Host "-> StationEngine backend starten op poort 6061..."
    $seCmd = "Set-Location '$SeDir'; .\StationEngine.exe --port 6061 --bind lan --lan-https-port 6443 --product-lan-https-port 6444 --webroot .\web"
    $p3 = Start-Window -Title "StationEngine" -Cmd $seCmd
    $pids += $p3.Id
} else {
    Write-Host "StationEngine.exe niet gevonden in $SeDir - alleen virtuele radio + Vite gestart."
}

$pids | Set-Content $PidFile
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "bolt-sdr dev stack actief"
Write-Host "  Browser:   http://localhost:5173"
Write-Host "  Discover naar 127.0.0.1 voor virtuele radio"
Write-Host "  Stop:  .\dev.ps1 stop"
