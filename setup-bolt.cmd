@echo off
title Bolt SDR Setup
echo === Bolt SDR Setup ===
echo.

echo Aanmaken TCI bridge Python omgeving...
C:\msys64\mingw64\bin\python.exe -m venv "%LOCALAPPDATA%\Bolt\tci-venv"
"%LOCALAPPDATA%\Bolt\tci-venv\bin\python.exe" -m pip install -q websockets
echo TCI bridge klaar.

echo.
echo Firewall regels aanmaken...
netsh advfirewall firewall add rule name="Bolt SDR HTTPS 6443" dir=in action=allow protocol=TCP localport=6443 > nul 2>&1
netsh advfirewall firewall add rule name="Bolt SDR HTTP 6061" dir=in action=allow protocol=TCP localport=6061 > nul 2>&1
netsh advfirewall firewall add rule name="Bolt SDR TCI 40001" dir=in action=allow protocol=TCP localport=40001 > nul 2>&1
echo Firewall klaar.

echo.
echo Bolt SDR initialiseren (wisdom berekening)...
echo Dit kan 2-5 minuten duren - venster NIET sluiten!
echo.
start /B "" "%~dp0StationEngine.exe" --port 6061 --bind lan --lan-https-port 6443 --product-lan-https-port 6444 --webroot "%~dp0web"

set COUNT=0
echo Berekening bezig [
:WAIT_WISDOM
timeout /t 5 /nobreak > nul
set /a COUNT+=5
set /p "=." < nul
tasklist /FI "IMAGENAME eq StationEngine.exe" | find "StationEngine.exe" > nul
if errorlevel 1 goto WISDOM_DONE
if %COUNT% GEQ 300 goto WISDOM_DONE
goto WAIT_WISDOM
:WISDOM_DONE
echo ] Klaar!

echo Bolt stoppen...
taskkill /F /IM StationEngine.exe > nul 2>&1
timeout /t 2 /nobreak > nul

echo.
echo ================================================
echo Setup voltooid!
echo Start Bolt SDR met start-bolt.cmd
echo Open Chrome op https://%COMPUTERNAME%:6443
echo Klik op Geavanceerd en Doorgaan (eenmalig)
echo Daarna installeer de app via Chrome menu
echo ================================================
pause
