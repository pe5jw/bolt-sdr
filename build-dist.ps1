# Bolt SDR — Build & Distribute
# Gebruik: .\build-dist.ps1
# Output: C:\dev\BoltSDRv2\distro\{win-x64, win-arm64, linux-x64, linux-arm64}\
# Deploy: kopieert win-arm64 als zip naar X:\BoltSDR\ (TX2 = Windows on ARM64)

param(
    [string]$RepoRoot  = "",
    [string]$DistRoot  = "",
    [string]$DeployDst = ""
)

if (-not $RepoRoot)  { $RepoRoot  = "C:\dev\BoltSDRv2" }
if (-not $DistRoot)  { $DistRoot  = "C:\dev\BoltSDRv2\distro" }
if (-not $DeployDst) { $DeployDst = "X:\BoltSDR" }

$ErrorActionPreference = "Stop"
$targets = @("win-x64", "win-arm64", "linux-x64", "linux-arm64")

Write-Host "=== Bolt SDR Build ===" -ForegroundColor Yellow

# --- Frontend ---
Write-Host "`nBuilding bolt-web..." -ForegroundColor Cyan
Push-Location (Join-Path $RepoRoot "bolt-web")
npm run build 2>&1 | Select-Object -Last 5
if ($LASTEXITCODE -ne 0) { throw "npm build failed" }
Pop-Location

# --- Backend: drie targets ---
foreach ($rid in $targets) {
    Write-Host "`nPublishing BoltServer [$rid]..." -ForegroundColor Cyan
    $out = Join-Path $DistRoot $rid
    $csproj = Join-Path $RepoRoot "BoltServer\BoltServer.csproj"
    dotnet publish $csproj -c Release -r $rid --self-contained true -o $out 2>&1 | Select-Object -Last 5
    if ($LASTEXITCODE -ne 0) { throw "dotnet publish failed for $rid" }

    # Web assets
    $webDst = Join-Path $out "web"
    New-Item -ItemType Directory -Path $webDst -Force | Out-Null
    Copy-Item (Join-Path $RepoRoot "bolt-web\dist\*") $webDst -Recurse -Force

    # tci-bridge
    $tciBridge = Join-Path $out "tci-bridge"
    New-Item -ItemType Directory -Path $tciBridge -Force | Out-Null
    Copy-Item (Join-Path $RepoRoot "tci-bridge\*") $tciBridge -Recurse -Force
}

# --- Kopieer scripts naar win-x64 en win-arm64 ---
Write-Host "`nKopieer scripts naar win builds..." -ForegroundColor Cyan
foreach ($winRid in @("win-x64", "win-arm64")) {
    $winDir = Join-Path $DistRoot $winRid
    Copy-Item (Join-Path $RepoRoot "start-bolt.cmd")    $winDir -Force
    Copy-Item (Join-Path $RepoRoot "deploy-server.cmd") $winDir -Force
    Copy-Item (Join-Path $RepoRoot "setup-bolt.cmd")    $winDir -Force
}

# --- Zip win-arm64 en kopieer naar TX2 (Windows on ARM64) ---
Write-Host "`nZippen voor TX2 deploy (win-arm64)..." -ForegroundColor Cyan
$zipName = "bolt-sdr-dist.zip"
$tx2Out  = Join-Path $DistRoot "win-arm64"
$zip     = Join-Path $DistRoot $zipName
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $tx2Out "*") -DestinationPath $zip

Write-Host ("Kopieren naar " + $DeployDst + "...") -ForegroundColor Cyan
if (-not (Test-Path $DeployDst)) {
    Write-Host ("WAARSCHUWING: " + $DeployDst + " niet bereikbaar - sla TX2 deploy over.") -ForegroundColor Yellow
} else {
    Copy-Item $zip (Join-Path $DeployDst $zipName) -Force
    Write-Host "bolt-sdr-dist.zip gekopieerd naar TX2." -ForegroundColor Green
}

Write-Host "`n=== Klaar ===" -ForegroundColor Green
Write-Host ("  win-x64    : " + (Join-Path $DistRoot "win-x64"))
Write-Host ("  win-arm64  : " + (Join-Path $DistRoot "win-arm64"))
Write-Host ("  linux-x64  : " + (Join-Path $DistRoot "linux-x64"))
Write-Host ("  linux-arm64: " + (Join-Path $DistRoot "linux-arm64"))
Write-Host ("  TX2 zip    : " + (Join-Path $DeployDst $zipName))
