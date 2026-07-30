@echo off
setlocal
title DevSpace Watchdog - Install
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-watchdog.ps1" install
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
