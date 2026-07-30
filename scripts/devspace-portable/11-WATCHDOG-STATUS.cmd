@echo off
setlocal
title DevSpace Watchdog - Status
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-watchdog.ps1" status
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
