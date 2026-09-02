@echo off
title Bolt SDR Cleanup
echo === Bolt SDR Cleanup ===
echo.

echo Stoppen van alle processen...
taskkill /F /IM StationEngine.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
timeout /t 3 /nobreak >nul

echo Verwijderen installatie...
cd C:\
if exist "C:\bolt-sdr\" rmdir /S /Q "C:\bolt-sdr"

echo Verwijderen data...
if exist "C:\Users\%USERNAME%\AppData\Local\BoltSDR\" rmdir /S /Q "C:\Users\%USERNAME%\AppData\Local\BoltSDR"
if exist "C:\Users\%USERNAME%\AppData\Local\Bolt\" rmdir /S /Q "C:\Users\%USERNAME%\AppData\Local\Bolt"
if exist "C:\Users\%USERNAME%\AppData\Local\Zeus\" rmdir /S /Q "C:\Users\%USERNAME%\AppData\Local\Zeus"

echo.
echo === Cleanup klaar ===
pause
