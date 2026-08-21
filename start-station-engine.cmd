@echo off
setlocal

set SCRIPT_DIR=%~dp0

:: Check of firewall regels al bestaan
netsh advfirewall firewall show rule name="Station Engine TCI 40001" > nul 2>&1
set TCI_EXISTS=%errorlevel%
netsh advfirewall firewall show rule name="Station Engine HTTPS 6443" > nul 2>&1
set HTTPS_EXISTS=%errorlevel%

:: Alleen admin vragen als firewall regels ontbreken
if %TCI_EXISTS%==1 goto NEED_ADMIN
if %HTTPS_EXISTS%==1 goto NEED_ADMIN
goto START_ENGINE

:NEED_ADMIN
net session > nul 2>&1
if errorlevel 1 (
    echo Requesting administrator privileges for firewall...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

if %TCI_EXISTS%==1 (
    echo Opening firewall port 40001 for TCI...
    netsh advfirewall firewall add rule name="Station Engine TCI 40001" dir=in action=allow protocol=TCP localport=40001
)
if %HTTPS_EXISTS%==1 (
    echo Opening firewall port 6443 for HTTPS...
    netsh advfirewall firewall add rule name="Station Engine HTTPS 6443" dir=in action=allow protocol=TCP localport=6443
)

:START_ENGINE
echo Stopping any running station-engine...
taskkill /F /IM StationEngine.exe > nul 2>&1
timeout /t 2 /nobreak > nul

echo Starting station-engine...
start "Station Engine" "%SCRIPT_DIR%StationEngine.exe" ^
    --port 6061 ^
    --bind lan ^
    --lan-https-port 6443 ^
    --product-lan-https-port 6444 ^
    --webroot "%SCRIPT_DIR%web"

echo Waiting for engine to start...
timeout /t 8 /nobreak > nul

echo Enabling TCI...
curl -s -X POST http://localhost:6061/api/tci/config ^
  -H "Content-Type: application/json" ^
  -d "{\"enabled\": true, \"bindAddress\": \"0.0.0.0\", \"port\": 40001}"

echo.
echo Starting tci-bridge (DVK + CAT voor N1MM+)...
start "TCI Bridge" /min "%SCRIPT_DIR%tci-bridge\start.bat"
echo ================================
echo Station engine HTTP  : http://192.168.8.141:6061
echo Station engine HTTPS : https://192.168.8.141:6443
echo TCI                  : port 40001
echo Open browser op: https://192.168.8.141:6443
pause
