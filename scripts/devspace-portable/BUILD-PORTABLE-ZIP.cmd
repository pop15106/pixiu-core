@echo off
setlocal
title DevSpace - Build Portable ZIP

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-portable-package.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo Portable ZIP build failed. Review the message above.
pause
exit /b %EXIT_CODE%
