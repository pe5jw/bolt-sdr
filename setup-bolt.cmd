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
echo Bolt SDR initialiseren (certificaat + wisdom berekening)...
echo Dit kan 2-5 minuten duren - venster NIET sluiten!
echo.
start /B "" "%~dp0StationEngine.exe" --port 6061 --bind lan --lan-https-port 6443 --webroot "%~dp0web"

set COUNT=0
echo Berekening bezig [
:WAIT_WISDOM
timeout /t 5 /nobreak > nul
set /a COUNT+=5
set /p "=." < nul
tasklist /FI "IMAGENAME eq StationEngine.exe" | find "StationEngine.exe" > nul
if errorlevel 1 goto WISDOM_DONE
findstr /M "wdsp.wisdom ready" "%LOCALAPPDATA%\BoltSDR\logs\*" > nul 2>&1
if not errorlevel 1 goto WISDOM_DONE
if %COUNT% GEQ 300 goto WISDOM_DONE
goto WAIT_WISDOM
:WISDOM_DONE
echo ] Klaar!

echo.
echo Certificaat installeren...
powershell -Command "$pfx = Get-ChildItem '%LOCALAPPDATA%\BoltSDR\certs\*.pfx' | Select-Object -First 1; if ($pfx) { $cert = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2($pfx.FullName, ''); $store = New-Object System.Security.Cryptography.X509Certificates.X509Store('Root', 'LocalMachine'); $store.Open('ReadWrite'); $store.Add($cert); $store.Close(); Write-Host 'Certificaat geinstalleerd' } else { Write-Host 'Certificaat niet gevonden' }"

echo Bolt stoppen...
taskkill /F /IM StationEngine.exe > nul 2>&1
timeout /t 2 /nobreak > nul

echo.
echo ================================================
echo Setup voltooid!
echo Start Bolt SDR met start-bolt.cmd
echo Open daarna Chrome op https://%COMPUTERNAME%:6443
echo ================================================
pause
