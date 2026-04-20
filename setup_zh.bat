@echo off
chcp 65001 >nul
setlocal

echo ================================================
echo   Pixiu Setup - VSCode Copilot / Claude Code / Codex / Gemini
echo ================================================
echo.

rem 取得此 bat 所在目錄作為母體根路徑，並移除尾部反斜線
set "PIXIU_PATH=%~dp0"
if "%PIXIU_PATH:~-1%"=="\" set "PIXIU_PATH=%PIXIU_PATH:~0,-1%"

echo Path: %PIXIU_PATH%
echo.

rem -------------------------------------------------------
rem [1/6] 設定使用者層級環境變數 PIXIU_CORE_PATH
rem        讓其他腳本或工具可透過此變數找到母體根目錄
rem -------------------------------------------------------
echo [1/6] Setting PIXIU_CORE_PATH...
setx PIXIU_CORE_PATH "%PIXIU_PATH%" >nul
if %errorlevel% neq 0 (
    echo Error: Cannot set env var. Run as Administrator.
    pause
    exit /b 1
)
echo       Done: PIXIU_CORE_PATH = %PIXIU_PATH%

rem -------------------------------------------------------
rem [2/6] Gemini CLI 全域指令檔
rem        路徑：~/.gemini/GEMINI.md
rem        Gemini CLI 啟動時會自動載入此檔案作為系統指令
rem -------------------------------------------------------
echo [2/6] Writing ~/.gemini/GEMINI.md...
if not exist "%USERPROFILE%\.gemini" mkdir "%USERPROFILE%\.gemini"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$rules = Get-Content -Raw '%PIXIU_PATH%\user_rules.md' -Encoding UTF8 -ErrorAction SilentlyContinue; " ^
    "$h = '# Pixiu - Gemini`n`nMOTHERSHIP_PATH=%PIXIU_PATH%`n`nRules: %PIXIU_PATH%\user_rules.md`n`n---`n`n'; " ^
    "[IO.File]::WriteAllText('%USERPROFILE%\.gemini\GEMINI.md', $h + $rules, [Text.Encoding]::UTF8)"
echo       Done: %USERPROFILE%\.gemini\GEMINI.md

rem -------------------------------------------------------
rem [3/6] Claude Code 全域指令檔
rem        路徑：~/.claude/CLAUDE.md
rem        Claude Code CLI 每次對話都會載入此檔案
rem -------------------------------------------------------
echo [3/6] Writing ~/.claude/CLAUDE.md...
if not exist "%USERPROFILE%\.claude" mkdir "%USERPROFILE%\.claude"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$rules = Get-Content -Raw '%PIXIU_PATH%\user_rules.md' -Encoding UTF8 -ErrorAction SilentlyContinue; " ^
    "$h = '# Pixiu - Claude Code`n`nMOTHERSHIP_PATH=%PIXIU_PATH%`n`nRules: %PIXIU_PATH%\user_rules.md`n`n---`n`n'; " ^
    "[IO.File]::WriteAllText('%USERPROFILE%\.claude\CLAUDE.md', $h + $rules, [Text.Encoding]::UTF8)"
echo       Done: %USERPROFILE%\.claude\CLAUDE.md

rem -------------------------------------------------------
rem [4/6] OpenAI Codex CLI 全域指令檔
rem        路徑：~/.codex/instructions.md
rem        Codex CLI 啟動時會讀取此檔案作為預設 system prompt
rem -------------------------------------------------------
echo [4/6] Writing ~/.codex/instructions.md...
if not exist "%USERPROFILE%\.codex" mkdir "%USERPROFILE%\.codex"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$rules = Get-Content -Raw '%PIXIU_PATH%\user_rules.md' -Encoding UTF8 -ErrorAction SilentlyContinue; " ^
    "$h = '# Pixiu - Codex`n`nMOTHERSHIP_PATH=%PIXIU_PATH%`n`nRules: %PIXIU_PATH%\user_rules.md`n`n---`n`n'; " ^
    "[IO.File]::WriteAllText('%USERPROFILE%\.codex\instructions.md', $h + $rules, [Text.Encoding]::UTF8)"
echo       Done: %USERPROFILE%\.codex\instructions.md

rem -------------------------------------------------------
rem [5/6] GitHub Copilot 專案層級指令檔
rem        路徑：<母體根>/.github/copilot-instructions.md
rem        VS Code 開啟此資料夾時，Copilot Chat 會自動套用
rem -------------------------------------------------------
echo [5/6] Writing .github/copilot-instructions.md...
if not exist "%PIXIU_PATH%\.github" mkdir "%PIXIU_PATH%\.github"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$rules = Get-Content -Raw '%PIXIU_PATH%\user_rules.md' -Encoding UTF8 -ErrorAction SilentlyContinue; " ^
    "$h = '# Pixiu - GitHub Copilot`n`nMOTHERSHIP_PATH=%PIXIU_PATH%`n`nRules: %PIXIU_PATH%\user_rules.md`n`n---`n`n'; " ^
    "[IO.File]::WriteAllText('%PIXIU_PATH%\.github\copilot-instructions.md', $h + $rules, [Text.Encoding]::UTF8)"
echo       Done: %PIXIU_PATH%\.github\copilot-instructions.md

rem -------------------------------------------------------
rem [6/6] GitHub Copilot VS Code 使用者層級設定
rem        修改 %APPDATA%\Code\User\settings.json
rem        加入 github.copilot.chat.codeGeneration.instructions
rem        讓 Copilot 在所有專案都套用 user_rules.md
rem -------------------------------------------------------
echo [6/6] Updating VS Code settings for Copilot global instructions...
set "VSCODE_SETTINGS=%APPDATA%\Code\User\settings.json"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$s = '%VSCODE_SETTINGS:\=\\%'; " ^
    "$p = '%PIXIU_PATH:\=\\%'; " ^
    "$json = if (Test-Path $s) { Get-Content $s -Raw -Encoding UTF8 | ConvertFrom-Json } else { [pscustomobject]@{} }; " ^
    "$instr = [pscustomobject]@{ file = $p + '\user_rules.md' }; " ^
    "$key = 'github.copilot.chat.codeGeneration.instructions'; " ^
    "if (-not $json.PSObject.Properties[$key]) { $json | Add-Member -NotePropertyName $key -NotePropertyValue @($instr) } " ^
    "else { $json.$key = @($instr) }; " ^
    "$out = $json | ConvertTo-Json -Depth 10; " ^
    "[IO.File]::WriteAllText($s, $out, [Text.Encoding]::UTF8)"
echo       Done: %VSCODE_SETTINGS%

echo.
echo ================================================
echo   Setup Complete!
echo ================================================
echo.
echo   [Gemini]   %USERPROFILE%\.gemini\GEMINI.md
echo   [Claude]   %USERPROFILE%\.claude\CLAUDE.md
echo   [Codex]    %USERPROFILE%\.codex\instructions.md
echo   [Copilot]  %PIXIU_PATH%\.github\copilot-instructions.md
echo   [Copilot]  VS Code settings.json updated
echo.
echo   Restart terminal and VS Code for changes to take effect.
echo.
pause
