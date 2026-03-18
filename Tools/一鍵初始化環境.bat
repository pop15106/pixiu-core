@echo off
setlocal
chcp 65001 >nul

echo ============================================================
echo   PIXIU Mothership - 一鍵初始化環境
echo ============================================================
echo.
echo 本工具將自動設定：
echo   1. ~/.claude/CLAUDE.md  （Claude Code 全域規則指向母艦）
echo   2. PIXIU_CORE_PATH      （環境變數，供 Gemini 使用）
echo   3. ~/.gemini/GEMINI.md  （如果存在，自動更新路徑）
echo.
echo 母艦路徑將自動偵測為此腳本所在的上層資料夾。
echo.
pause

powershell -ExecutionPolicy Bypass -File "%~dp0pixiu-init.ps1"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [錯誤] 初始化失敗，請檢查上方輸出。
    echo.
    pause
    exit /b %ERRORLEVEL%
)
