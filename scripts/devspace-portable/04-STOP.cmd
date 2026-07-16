@echo off
setlocal
title Stop DevSpace
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" stop
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo Stop failed. Review the message above.
pause
exit /b %EXIT_CODE%
