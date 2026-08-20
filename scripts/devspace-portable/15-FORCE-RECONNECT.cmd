@echo off
setlocal
title DevSpace - Force Reconnect
set "DEVSPACE_ONECLICK_NONINTERACTIVE=1"

echo [1/1] Restarting and verifying DevSpace inside a maintenance window...
call powershell -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" force-reconnect
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" goto :failed

echo.
echo Force reconnect completed.
goto :finish

:failed
echo.
echo Force reconnect failed. Review the message above.

:finish
if not defined DEVSPACE_ONECLICK_NO_PAUSE pause
exit /b %EXIT_CODE%
