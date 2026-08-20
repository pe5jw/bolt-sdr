@echo off
title Bolt SDR TCI Bridge
cd /d "%~dp0"
if not exist "venv\Scripts\activate.bat" (
    echo Installeren...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -q websockets
) else (
    call venv\Scripts\activate.bat
)
echo.
echo === Bolt SDR TCI Bridge ===
echo CAT poort : 4532  (N1MM+: Kenwood TS-2000 / 127.0.0.1:4532)
echo DVK map   : %LOCALAPPDATA%\Bolt\dvk\
echo Stoppen   : Ctrl+C
echo.
python tci_bridge.py
pause
