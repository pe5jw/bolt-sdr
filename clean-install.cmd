@echo off
title Bolt SDR Clean Install
echo === Bolt SDR Clean Install ===
echo.

echo Stoppen van alle processen...
taskkill /F /IM StationEngine.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM ngrok.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo Verwijderen oude installatie...
if exist "C:\bolt-sdr\" (
    cd C:\
    rmdir /S /Q "C:\bolt-sdr"
)

echo Verwijderen oude data...
if exist "%LOCALAPPDATA%\BoltSDR\" rmdir /S /Q "%LOCALAPPDATA%\BoltSDR"
if exist "%LOCALAPPDATA%\Bolt\" rmdir /S /Q "%LOCALAPPDATA%\Bolt"
if exist "%LOCALAPPDATA%\Zeus\" rmdir /S /Q "%LOCALAPPDATA%\Zeus"

echo Aanmaken nieuwe installatie map...
mkdir "C:\bolt-sdr"

echo Kopieer installatie zip...
if not exist "Y:\bolt-sdr\bolt-sdr-dist.zip" (
    echo FOUT: bolt-sdr-dist.zip niet gevonden op Y:\bolt-sdr\
    echo Zorg dat de dev PC verbonden is via Y:
    pause
    exit /b 1
)
copy "Y:\bolt-sdr\bolt-sdr-dist.zip" "C:\bolt-sdr\bolt-sdr-dist.zip"

echo Uitpakken...
powershell -Command "Expand-Archive 'C:\bolt-sdr\bolt-sdr-dist.zip' 'C:\bolt-sdr\' -Force"
del "C:\bolt-sdr\bolt-sdr-dist.zip"

echo.
echo === Clean install klaar ===
echo Voer nu setup-bolt.cmd uit als Administrator
pause
