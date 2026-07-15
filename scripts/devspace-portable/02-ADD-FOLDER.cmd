@echo off
setlocal
title Add DevSpace Allowed Folder
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" add-root
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" add-root "%~1"
)
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo Folder update failed. Review the message above.
pause
exit /b %EXIT_CODE%
