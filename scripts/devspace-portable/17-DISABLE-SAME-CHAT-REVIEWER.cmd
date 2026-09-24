@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" disable-same-chat-reviewer
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" goto :failed
echo.
echo Same-Chat Reviewer disabled.
exit /b 0
:failed
echo.
echo Failed to disable Same-Chat Reviewer. Exit code: %EXIT_CODE%
exit /b %EXIT_CODE%
