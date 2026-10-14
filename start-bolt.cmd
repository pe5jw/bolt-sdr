@echo off
setlocal
set SCRIPT_DIR=%~dp0

:: Check of firewall regels al bestaan
netsh advfirewall firewall show rule name="Bolt SDR TCI 40001" > nul 2>&1
set TCI_EXISTS=%errorlevel%
netsh advfirewall firewall show rule name="Bolt SDR HTTPS 6443" > nul 2>&1
set HTTPS_EXISTS=%errorlevel%
netsh advfirewall firewall show rule name="Bolt SDR HTTP 6061" > nul 2>&1
set HTTP_EXISTS=%errorlevel%

:: Alleen admin vragen als firewall regels ontbreken
if %TCI_EXISTS%==1 goto NEED_ADMIN
if %HTTPS_EXISTS%==1 goto NEED_ADMIN
if %HTTP_EXISTS%==1 goto NEED_ADMIN
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
    netsh advfirewall firewall add rule name="Bolt SDR TCI 40001" dir=in action=allow protocol=TCP localport=40001
)
if %HTTPS_EXISTS%==1 (
    echo Opening firewall port 6443 for HTTPS...
    netsh advfirewall firewall add rule name="Bolt SDR HTTPS 6443" dir=in action=allow protocol=TCP localport=6443
)
if %HTTP_EXISTS%==1 (
    echo Opening firewall port 6061 for HTTP...
    netsh advfirewall firewall add rule name="Bolt SDR HTTP 6061" dir=in action=allow protocol=TCP localport=6061
)

:START_ENGINE
echo Stopping any running processes...
taskkill /F /IM python.exe /T > nul 2>&1
taskkill /F /IM python3.exe /T > nul 2>&1
taskkill /F /IM bolt-sdr.exe /T > nul 2>&1
timeout /t 2 /nobreak > nul

echo Starting Bolt SDR...
start "Bolt SDR" "%SCRIPT_DIR%bolt-sdr.exe" ^
    --port 6061 ^
    --bind lan ^
    --lan-https-port 6443 ^
    --webroot "%SCRIPT_DIR%web"

echo Waiting for engine to start...
timeout /t 8 /nobreak > nul

echo Starting tci-bridge...
start "TCI Bridge" "%SCRIPT_DIR%tci-bridge\start.bat"

echo ================================
echo Bolt SDR HTTP  : http://192.168.8.156:6061
echo Bolt SDR HTTPS : https://192.168.8.156:6443
echo TCI            : port 40001
echo Open browser   : http://192.168.8.156:6061
