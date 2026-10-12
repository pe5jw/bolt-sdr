@echo off
title Bolt SDR Deploy
set INSTALL_DIR=C:\BoltSDR

echo === Bolt SDR Deploy ===
echo.

echo Stoppen van lopende processen...
taskkill /F /IM python.exe /T > nul 2>&1
taskkill /F /IM python3.exe /T > nul 2>&1
taskkill /F /IM bolt-sdr.exe /T > nul 2>&1
timeout /t 2 /nobreak > nul

echo Uitpakken nieuwe versie...
if not exist "%INSTALL_DIR%\bolt-sdr-dist.zip" (
    echo FOUT: bolt-sdr-dist.zip niet gevonden in %INSTALL_DIR%\
    pause
    exit /b 1
)

powershell -Command "Expand-Archive '%INSTALL_DIR%\bolt-sdr-dist.zip' '%INSTALL_DIR%-new\' -Force"
xcopy /E /Y /Q "%INSTALL_DIR%-new\*" "%INSTALL_DIR%\" > nul
rmdir /S /Q "%INSTALL_DIR%-new"
del /Q "%INSTALL_DIR%\bolt-sdr-dist.zip" > nul 2>&1

echo.
echo Deploy klaar - Bolt SDR starten...
timeout /t 1 /nobreak > nul
call "%INSTALL_DIR%\start-bolt.cmd"
exit
