@echo off
chcp 65001 >nul
setlocal

set "PIXIU_PATH=%~dp0"
if "%PIXIU_PATH:~-1%"=="\" set "PIXIU_PATH=%PIXIU_PATH:~0,-1%"

echo ================================================
echo   Pixiu Uninstall
echo ================================================
echo.
echo   This will remove all Pixiu integrations:
echo     - PIXIU_CORE / PIXIU_CORE_PATH environment variables
echo     - ~/.pixiu-core junction
echo     - ~/.claude/CLAUDE.md
echo     - ~/.claude/agents, commands, hooks, rules, scripts junctions
echo     - ~/.claude/settings.json (hooks, additionalDirectories, effortLevel)
echo     - ~/.gemini/GEMINI.md
echo     - ~/.codex/AGENTS.md + instructions.md
echo     - .github/copilot-instructions.md
echo     - VS Code Copilot instruction setting
echo.
set /p CONFIRM="Continue? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Cancelled.
    pause
    exit /b 0
)
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%PIXIU_PATH%\Tools\pixiu-uninstall.ps1" "%PIXIU_PATH%"
if %errorlevel% neq 0 (
    echo.
    echo Uninstall encountered errors. See messages above.
    pause
    exit /b 1
)

echo.
pause
