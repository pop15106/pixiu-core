@echo off
setlocal
chcp 65001 >nul

echo ============================================================
echo   PIXIU Mother Ship - Project Registration Tool (EVO)
echo ============================================================
echo.

set "TARGET_DIR=%~1"

if "%TARGET_DIR%"=="" (
    echo [Step 1] Please drag your PROJECT or PARENT folder here and press Enter.
    set /p "TARGET_DIR=Path: "
)

set "TARGET_DIR=%TARGET_DIR:"=%"

echo.
echo [Step 2] Choose Mode:
echo    1. SINGLE - Only register this specific folder
echo    2. SCAN   - Auto-scan all sub-projects (.git/pom.xml)
echo.
set /p "OP_MODE=Choice (1 or 2): "

echo.
echo ------------------------------------------------------------
echo Running...
echo.

if "%OP_MODE%"=="2" goto :RECURSIVE
goto :SINGLE

:RECURSIVE
powershell -ExecutionPolicy Bypass -File "%~dp0deploy-pixiu-core.ps1" -ProjectPath "%TARGET_DIR%" -Recursive
goto :END

:SINGLE
powershell -ExecutionPolicy Bypass -File "%~dp0deploy-pixiu-core.ps1" -ProjectPath "%TARGET_DIR%"
goto :END

:END
echo.
echo ------------------------------------------------------------
echo [DONE] Please restart your IDE (VSCode/Cursor).
pause
