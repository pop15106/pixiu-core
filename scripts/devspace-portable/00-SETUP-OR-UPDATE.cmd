@echo off
setlocal
title DevSpace - Setup or Update

if exist "%~dp0PORTABLE-MANIFEST.json" (
  echo [1/2] Verifying portable package integrity...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-portable-package.ps1"
  set "EXIT_CODE=%ERRORLEVEL%"
  if not "%EXIT_CODE%"=="0" goto :failed
) else (
  echo [1/2] Source checkout detected. Package manifest verification skipped.
)

echo.
echo [2/2] Installing or updating DevSpace OneClick...
if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" setup-or-update
) else (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" setup-or-update "%~1"
)
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" goto :failed

echo.
echo Setup or update completed.
goto :finish

:failed
echo.
echo Setup or update failed. Review the message above.

:finish
pause
exit /b %EXIT_CODE%
