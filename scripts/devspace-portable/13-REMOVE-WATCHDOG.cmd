@echo off
setlocal
title DevSpace Watchdog - Remove
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-watchdog.ps1" remove
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
