@echo off
setlocal
title DevSpace Watchdog - Run
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-watchdog.ps1" run
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
