@echo off
setlocal
title DevSpace - Disconnect

echo Disconnecting the recorded DevSpace connection...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" disconnect
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Connection stopped. Watchdog auto-recovery is suspended until START-CONNECTION.cmd succeeds.
) else (
  echo Disconnect failed. Run QA-CHECK.cmd and follow the troubleshooting steps.
)

pause
exit /b %EXIT_CODE%
