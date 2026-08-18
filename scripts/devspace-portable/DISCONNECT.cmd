@echo off
setlocal
title DevSpace - Disconnect

echo Disconnecting the recorded DevSpace connection...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" stop
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Connection stopped. Local settings, tunnel identity, allowed folders, and workflow state were kept.
) else (
  echo Disconnect failed. Run QA-CHECK.cmd and follow the troubleshooting steps.
)

pause
exit /b %EXIT_CODE%
