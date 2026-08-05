@echo off
setlocal
title DevSpace - Force Reconnect
set "DEVSPACE_ONECLICK_NONINTERACTIVE=1"

echo [1/3] Stopping the recorded DevSpace connection...
call powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" stop
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" goto :failed

echo.
echo [2/3] Starting DevSpace again...
call powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" start
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" goto :failed

echo.
echo [3/3] Verifying DevSpace status...
call powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" status
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" goto :failed

echo.
echo Force reconnect completed.
goto :finish

:failed
echo.
echo Force reconnect failed. Review the message above.

:finish
if not defined DEVSPACE_ONECLICK_NO_PAUSE pause
exit /b %EXIT_CODE%
