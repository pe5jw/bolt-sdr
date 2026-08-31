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
echo ================================================
echo BELANGRIJK: Eerste keer openen in Chrome
echo ================================================
echo.
echo 1. Open Chrome en ga naar https://192.168.8.141:6443
echo 2. Klik op "Geavanceerd"
echo 3. Klik op "Doorgaan naar 192.168.8.141"
echo 4. Dit is eenmalig - Chrome onthoudt het certificaat
echo.
echo Setup voltooid! Start Bolt SDR met start-bolt.cmd
pause
