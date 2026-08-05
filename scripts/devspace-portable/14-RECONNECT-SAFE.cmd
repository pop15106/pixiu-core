@echo off
setlocal
title DevSpace - Safe Reconnect
set "DEVSPACE_ONECLICK_NONINTERACTIVE=1"

echo [1/2] Starting any missing DevSpace components...
call powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" start
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" goto :failed

echo.
echo [2/2] Verifying DevSpace status...
call powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" status
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" goto :failed

echo.
echo Safe reconnect completed.
goto :finish

:failed
echo.
echo Safe reconnect failed. Review the message above.

:finish
if not defined DEVSPACE_ONECLICK_NO_PAUSE pause
exit /b %EXIT_CODE%
