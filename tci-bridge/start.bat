@echo off
title Bolt SDR TCI Bridge
cd /d "%~dp0"
set PYTHON=%LOCALAPPDATA%\Bolt\tci-venv\bin\python.exe
if not exist "%PYTHON%" set PYTHON=C:\msys64\mingw64\bin\python.exe
echo.
echo === Bolt SDR TCI Bridge ===
echo CAT poort : 4532  (N1MM+: Kenwood TS-2000 / 0.0.0.0:4532)
echo DVK map   : %LOCALAPPDATA%\Bolt\dvk\
echo Stoppen   : Ctrl+C
echo.
"%PYTHON%" tci_bridge.py
