@echo off
title Bolt SDR Deploy
cd /d "C:\bolt-sdr"

echo === Bolt SDR Deploy ===
echo.

echo Stoppen van lopende processen...
taskkill /F /IM python.exe /T > nul 2>&1
taskkill /F /IM python3.exe /T > nul 2>&1
taskkill /F /IM bolt-sdr.exe /T > nul 2>&1
taskkill /F /IM StationEngine.exe /T > nul 2>&1
taskkill /F /IM python.exe /T > nul 2>&1
taskkill /F /IM python3.exe /T > nul 2>&1
timeout /t 2 /nobreak > nul

echo Verwijderen oude web assets...
if exist "C:\bolt-sdr\web\assets\" (
    del /Q "C:\bolt-sdr\web\assets\*.*" > nul 2>&1
)

echo Uitpakken nieuwe versie...
if not exist "C:\bolt-sdr\bolt-sdr-dist.zip" (
    echo FOUT: bolt-sdr-dist.zip niet gevonden in C:\bolt-sdr\
    pause
    exit /b 1
)

powershell -Command "Expand-Archive 'C:\bolt-sdr\bolt-sdr-dist.zip' 'C:\bolt-sdr-new\' -Force"
xcopy /E /Y /Q "C:\bolt-sdr-new\*" "C:\bolt-sdr\" > nul
rmdir /S /Q "C:\bolt-sdr-new"

echo.
echo Deploy klaar - Bolt SDR starten...
timeout /t 1 /nobreak > nul
call "C:\bolt-sdr\start-bolt.cmd"
exit

