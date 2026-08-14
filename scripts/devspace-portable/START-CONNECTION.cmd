@echo off
setlocal
title DevSpace - Start Connection

echo Starting DevSpace connection...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" start
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Connection started. You can now use DevSpace from ChatGPT.
) else (
  echo Start failed. Run QA-CHECK.cmd and follow the troubleshooting steps.
)

pause
exit /b %EXIT_CODE%
