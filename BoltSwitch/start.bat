@echo off
title Remote Switch
echo.
echo  Remote Switch starten...
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  ERROR: Node.js is niet gevonden!
    echo  Download via https://nodejs.org
    echo.
    pause
    exit /b 1
)

node "%~dp0server.js"
pause
