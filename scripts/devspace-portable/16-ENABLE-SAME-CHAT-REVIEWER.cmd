@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-oneclick.ps1" enable-same-chat-reviewer
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" goto :failed
echo.
echo Same-Chat Reviewer enabled.
echo Refresh the DevSpace App actions in ChatGPT before the host E2E test.
exit /b 0
:failed
echo.
echo Failed to enable Same-Chat Reviewer. Exit code: %EXIT_CODE%
exit /b %EXIT_CODE%
