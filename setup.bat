@echo off
chcp 65001 >nul
setlocal

echo ================================================
echo   Pixiu Setup - VSCode Copilot / Claude Code / Codex / Gemini
echo ================================================
echo.

set "PIXIU_PATH=%~dp0"
if "%PIXIU_PATH:~-1%"=="\" set "PIXIU_PATH=%PIXIU_PATH:~0,-1%"

echo Path: %PIXIU_PATH%
echo.

:: [1] Set env var
echo [1/7] Setting PIXIU_CORE_PATH...
setx PIXIU_CORE_PATH "%PIXIU_PATH%" >nul
if %errorlevel% neq 0 (
    echo Error: Cannot set env var. Run as Administrator.
    pause
    exit /b 1
)
echo       Done: PIXIU_CORE_PATH = %PIXIU_PATH%

:: [2] Gemini
echo [2/7] Writing ~/.gemini/GEMINI.md...
if not exist "%USERPROFILE%\.gemini" mkdir "%USERPROFILE%\.gemini"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$rules = Get-Content -Raw '%PIXIU_PATH%\user_rules.md' -Encoding UTF8 -ErrorAction SilentlyContinue; " ^
    "$h = '# Pixiu - Gemini`n`nMOTHERSHIP_PATH=%PIXIU_PATH%`n`nRules: %PIXIU_PATH%\user_rules.md`n`n---`n`n'; " ^
    "[IO.File]::WriteAllText('%USERPROFILE%\.gemini\GEMINI.md', $h + $rules, [Text.Encoding]::UTF8)"
echo       Done: %USERPROFILE%\.gemini\GEMINI.md

:: [3] Claude Code
echo [3/7] Writing ~/.claude/CLAUDE.md...
if not exist "%USERPROFILE%\.claude" mkdir "%USERPROFILE%\.claude"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$rules = Get-Content -Raw '%PIXIU_PATH%\user_rules.md' -Encoding UTF8 -ErrorAction SilentlyContinue; " ^
    "$h = '# Pixiu - Claude Code`n`nMOTHERSHIP_PATH=%PIXIU_PATH%`n`nRules: %PIXIU_PATH%\user_rules.md`n`n---`n`n'; " ^
    "[IO.File]::WriteAllText('%USERPROFILE%\.claude\CLAUDE.md', $h + $rules, [Text.Encoding]::UTF8)"
echo       Done: %USERPROFILE%\.claude\CLAUDE.md

:: [4] Codex CLI
echo [4/7] Writing ~/.codex/instructions.md...
if not exist "%USERPROFILE%\.codex" mkdir "%USERPROFILE%\.codex"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$rules = Get-Content -Raw '%PIXIU_PATH%\user_rules.md' -Encoding UTF8 -ErrorAction SilentlyContinue; " ^
    "$h = '# Pixiu - Codex`n`nMOTHERSHIP_PATH=%PIXIU_PATH%`n`nRules: %PIXIU_PATH%\user_rules.md`n`n---`n`n'; " ^
    "[IO.File]::WriteAllText('%USERPROFILE%\.codex\instructions.md', $h + $rules, [Text.Encoding]::UTF8)"
echo       Done: %USERPROFILE%\.codex\instructions.md

:: [5] GitHub Copilot - workspace instructions file
echo [5/7] Writing .github/copilot-instructions.md...
if not exist "%PIXIU_PATH%\.github" mkdir "%PIXIU_PATH%\.github"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$rules = Get-Content -Raw '%PIXIU_PATH%\user_rules.md' -Encoding UTF8 -ErrorAction SilentlyContinue; " ^
    "$h = '# Pixiu - GitHub Copilot`n`nMOTHERSHIP_PATH=%PIXIU_PATH%`n`nRules: %PIXIU_PATH%\user_rules.md`n`n---`n`n'; " ^
    "[IO.File]::WriteAllText('%PIXIU_PATH%\.github\copilot-instructions.md', $h + $rules, [Text.Encoding]::UTF8)"
echo       Done: %PIXIU_PATH%\.github\copilot-instructions.md

:: [6] GitHub Copilot - VS Code user settings (global)
echo [6/7] Updating VS Code settings for Copilot global instructions...
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

:: [7] Deploy Claude Code project hooks
echo [7/7] Deploying hooks to .claude/settings.json...
if not exist "%PIXIU_PATH%\.claude" mkdir "%PIXIU_PATH%\.claude"
copy /Y "%PIXIU_PATH%\hooks\hooks.json" "%PIXIU_PATH%\.claude\settings.json" >nul
echo       Done: %PIXIU_PATH%\.claude\settings.json

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
echo   [Hooks]    %PIXIU_PATH%\.claude\settings.json
echo.
echo   Restart terminal and VS Code for changes to take effect.
echo.
pause
