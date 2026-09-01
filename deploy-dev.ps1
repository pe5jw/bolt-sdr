# Bolt SDR Deploy Script
# Gebruik: .\deploy-dev.ps1

Write-Host "=== Bolt SDR Deploy ===" -ForegroundColor Yellow

# Build frontend
Write-Host "Building bolt-web..." -ForegroundColor Cyan
cd 'C:\dev\bolt-sdr\bolt-web'
npm run build 2>&1 | Select-Object -Last 3

# Build backend
Write-Host "Publishing station-engine..." -ForegroundColor Cyan
cd 'C:\dev\bolt-sdr\station-engine'
dotnet publish 'StationEngine\StationEngine.csproj' -c Release -o 'C:\dev\station-engine-dist' --self-contained true -r win-x64 2>&1 | Select-Object -Last 3

# Kopieer tci-bridge
New-Item -ItemType Directory -Path 'C:\dev\station-engine-dist\tci-bridge' -Force | Out-Null
Copy-Item 'C:\dev\bolt-sdr\tci-bridge\*' 'C:\dev\station-engine-dist\tci-bridge\' -Recurse -Force

# Kopieer web
cd 'C:\dev\bolt-sdr\bolt-web'
New-Item -ItemType Directory -Path 'C:\dev\station-engine-dist\web' -Force | Out-Null
Copy-Item 'dist\*' 'C:\dev\station-engine-dist\web\' -Recurse -Force

# Kopieer scripts
Copy-Item 'C:\dev\bolt-sdr\start-bolt.cmd' 'C:\dev\station-engine-dist\' -Force
Copy-Item 'C:\dev\bolt-sdr\deploy-server.cmd' 'C:\dev\station-engine-dist\' -Force
Copy-Item 'C:\dev\bolt-sdr\setup-bolt.cmd' 'C:\dev\station-engine-dist\' -Force
Copy-Item 'C:\dev\bolt-sdr\clean-install.cmd' 'C:\dev\station-engine-dist\' -Force

# Zip en kopieer naar server
Compress-Archive -Path 'C:\dev\station-engine-dist\*' -DestinationPath 'C:\dev\bolt-sdr-dist.zip' -Force
Copy-Item 'C:\dev\bolt-sdr-dist.zip' 'Y:\bolt-sdr\bolt-sdr-dist.zip' -Force

Write-Host "Klaar!" -ForegroundColor Green
