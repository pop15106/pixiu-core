@echo off
setlocal
title Stop DevSpace Subagent
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" agent-stop
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" agent-stop "%~1"
)
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo Agent stop failed. Review the message above.
pause
exit /b %EXIT_CODE%
