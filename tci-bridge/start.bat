@echo off
title Bolt SDR TCI Bridge
cd /d "%~dp0"

REM Controleer of websockets beschikbaar is via MSYS2 Python
set PYTHON=C:\msys64\mingw64\bin\python.exe
if not exist "%PYTHON%" set PYTHON=python

REM Installeer websockets via pacman als MSYS2 beschikbaar is
if exist "C:\msys64\usr\bin\pacman.exe" (
    C:\msys64\usr\bin\pacman.exe -S --noconfirm mingw-w64-x86_64-python-websockets >nul 2>&1
) else (
    REM Fallback: venv met pip
    if not exist "venv\Scripts\activate.bat" (
        echo Installeren via pip...
        python -m venv venv
        call venv\Scripts\activate.bat
        pip install -q websockets
    ) else (
        call venv\Scripts\activate.bat
        set PYTHON=venv\Scripts\python.exe
    )
)

echo.
echo === Bolt SDR TCI Bridge ===
echo CAT poort : 4532  (N1MM+: Kenwood TS-2000 / 0.0.0.0:4532)
echo DVK map   : %LOCALAPPDATA%\Bolt\dvk\
echo Stoppen   : Ctrl+C
echo.

"%PYTHON%" tci_bridge.py
