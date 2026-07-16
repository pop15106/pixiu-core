@echo off
setlocal
title Start DevSpace
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" start
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo Startup failed. Review the message above.
pause
exit /b %EXIT_CODE%
