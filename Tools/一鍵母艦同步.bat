@echo off
setlocal
chcp 65001 >nul

echo ============================================================
echo   PIXIU Mother Ship - 一鍵母鍵同步 (Fleet Cleanup)
echo ============================================================
echo.
echo 本工具將同步 fleet.json 中所有專案的規則指標檔：
echo   - user_rules.md（各專案副本）
echo   - .cursorrules / .windsurfrules / .clinerules / .antigravity_rules.md / CLAUDE.md
echo.
echo Claude Code 規則與 Skills 已透過 ~/.claude/CLAUDE.md 直讀母艦，無需複製。
echo.
pause

powershell -ExecutionPolicy Bypass -File "C:\PixiuCore\Tools\sync-pixiu-fleet.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [錯誤] 同步過程中發生異常，請檢查上方輸出訊息。
    echo.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo 同步完成！已經確保子專案與母艦核心對齊。
pause
