@echo off
chcp 65001 >nul
setlocal

echo ================================================
echo   Pixiu 母體安裝程式
echo ================================================
echo.

:: 取得 bat 所在目錄作為母體路徑
set "PIXIU_PATH=%~dp0"
:: 移除尾部反斜線
if "%PIXIU_PATH:~-1%"=="\" set "PIXIU_PATH=%PIXIU_PATH:~0,-1%"

echo 偵測到母體路徑：%PIXIU_PATH%
echo.

:: 設定使用者層級環境變數
echo [1/4] 設定 PIXIU_CORE_PATH 環境變數...
setx PIXIU_CORE_PATH "%PIXIU_PATH%" >nul
if %errorlevel% neq 0 (
    echo 錯誤：無法設定環境變數，請用系統管理員執行
    pause
    exit /b 1
)
echo       完成：PIXIU_CORE_PATH = %PIXIU_PATH%

:: 建立 .gemini 目錄
echo [2/4] 建立 ~/.gemini 目錄...
if not exist "%USERPROFILE%\.gemini" mkdir "%USERPROFILE%\.gemini"
echo       完成

:: 寫入 GEMINI.md
echo [3/4] 寫入 ~/.gemini/GEMINI.md...
(
echo # Pixiu 強化母體 — Gemini 全域指令
echo.
echo ## 🚀 啟動協議 [HARD]
echo.
echo 每次對話開始時，必須主動輸出以下訊息（繁體中文）：
echo.
echo ```
echo ⚡ Pixiu 強化母體已連線
echo 母體路徑：%PIXIU_PATH%
echo 載入：Pixiu 7 層憲法 + ECC 全集（176 skills · 76 workflows · 50 rules）
echo.
echo 請問你要我做什麼？
echo ```
echo.
echo 此協議不得跳過、不得縮短、不得延後。
echo.
echo ## 母體路徑
echo.
echo PIXIU_CORE_PATH=%PIXIU_PATH%
echo.
echo 規則來源：%PIXIU_PATH%\user_rules.md
echo 技能庫：%PIXIU_PATH%\.agent\skills\
echo 工作流：%PIXIU_PATH%\.agent\workflows\
) > "%USERPROFILE%\.gemini\GEMINI.md"
echo       完成：%USERPROFILE%\.gemini\GEMINI.md

:: 附加 user_rules.md 內容進 GEMINI.md
echo [4/4] 嵌入母體規則...
echo. >> "%USERPROFILE%\.gemini\GEMINI.md"
echo ---  >> "%USERPROFILE%\.gemini\GEMINI.md"
echo. >> "%USERPROFILE%\.gemini\GEMINI.md"
type "%PIXIU_PATH%\user_rules.md" >> "%USERPROFILE%\.gemini\GEMINI.md"
echo       完成

echo.
echo ================================================
echo   安裝完成！
echo ================================================
echo.
echo   母體路徑：%PIXIU_PATH%
echo   GEMINI.md：%USERPROFILE%\.gemini\GEMINI.md
echo.
echo   請重新啟動終端機讓環境變數生效。
echo   然後開啟 Antigravity + Gemini 即可使用母體。
echo.
pause