@echo off
echo Building BoltServer (StationEngine) for distribution...
cd /d C:\dev\bolt-sdr
dotnet publish BoltServer/BoltServer.csproj ^
  --configuration Release ^
  --runtime win-x64 ^
  --self-contained true ^
  -p:PublishSingleFile=false ^
  --output C:\dev\station-engine-dist

echo.
echo Build complete! Output in C:\dev\station-engine-dist
pause
