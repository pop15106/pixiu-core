@echo off
chcp 65001 >nul
setlocal

set "PIXIU_PATH=%~dp0"
if "%PIXIU_PATH:~-1%"=="\" set "PIXIU_PATH=%PIXIU_PATH:~0,-1%"

echo ================================================
echo   Pixiu Core Setup
echo ================================================
echo.
echo Core path: %PIXIU_PATH%
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%PIXIU_PATH%\Tools\pixiu-init.ps1" "%PIXIU_PATH%"
if %errorlevel% neq 0 (
    echo.
    echo Setup failed. See messages above.
    pause
    exit /b 1
)

echo.
echo Setup complete. Restart terminal, VS Code, Claude Code, and Gemini.
echo.
pause