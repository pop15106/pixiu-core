@echo off
setlocal
title DevSpace Subagent Status
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" agent-status
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" agent-status "%~1"
)
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
