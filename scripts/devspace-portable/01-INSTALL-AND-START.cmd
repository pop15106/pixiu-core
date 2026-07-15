@echo off
setlocal
title DevSpace One-Click Setup
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" install
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" install "%~1"
)
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo Setup failed. Review the message above.
pause
exit /b %EXIT_CODE%
