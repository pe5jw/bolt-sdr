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
if exist "%LOCALAPPDATA%\BoltSDR\" rmdir /S /Q "%LOCALAPPDATA%\BoltSDR"
if exist "%LOCALAPPDATA%\Bolt\" rmdir /S /Q "%LOCALAPPDATA%\Bolt"
if exist "%LOCALAPPDATA%\Zeus\" rmdir /S /Q "%LOCALAPPDATA%\Zeus"

echo.
echo === Cleanup klaar ===
echo Installeer nu handmatig via deploy-server.cmd
pause
