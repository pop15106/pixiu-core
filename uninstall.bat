@echo off
chcp 65001 >nul
setlocal

echo ================================================
echo   Pixiu Uninstall
echo ================================================
echo.
echo   This will remove all Pixiu integrations:
echo     - PIXIU_CORE_PATH environment variable
echo     - ~/.gemini/GEMINI.md
echo     - ~/.claude/CLAUDE.md
echo     - ~/.codex/instructions.md
echo     - .github/copilot-instructions.md
echo     - VS Code Copilot instruction setting
echo     - ~/.claude/settings.json (global hooks)
echo.
set /p CONFIRM="Continue? (Y/N): "
if /i not "%CONFIRM%"=="Y" (
    echo Cancelled.
    pause
    exit /b 0
)
echo.

set "PIXIU_PATH=%~dp0"
if "%PIXIU_PATH:~-1%"=="\" set "PIXIU_PATH=%PIXIU_PATH:~0,-1%"

:: [1] Remove PIXIU_CORE_PATH env var
echo [1/7] Removing PIXIU_CORE_PATH...
REG DELETE "HKCU\Environment" /V "PIXIU_CORE_PATH" /F >nul 2>&1
if %errorlevel% equ 0 (
    echo       Done: PIXIU_CORE_PATH removed
) else (
    echo       Skip: PIXIU_CORE_PATH not found
)

:: [2] Remove Gemini GEMINI.md
echo [2/7] Removing ~/.gemini/GEMINI.md...
if exist "%USERPROFILE%\.gemini\GEMINI.md" (
    del /f /q "%USERPROFILE%\.gemini\GEMINI.md"
    echo       Done: %USERPROFILE%\.gemini\GEMINI.md deleted
) else (
    echo       Skip: file not found
)

:: [3] Remove Claude Code CLAUDE.md
echo [3/7] Removing ~/.claude/CLAUDE.md...
if exist "%USERPROFILE%\.claude\CLAUDE.md" (
    del /f /q "%USERPROFILE%\.claude\CLAUDE.md"
    echo       Done: %USERPROFILE%\.claude\CLAUDE.md deleted
) else (
    echo       Skip: file not found
)

:: [4] Remove Codex instructions.md
echo [4/7] Removing ~/.codex/instructions.md...
if exist "%USERPROFILE%\.codex\instructions.md" (
    del /f /q "%USERPROFILE%\.codex\instructions.md"
    echo       Done: %USERPROFILE%\.codex\instructions.md deleted
) else (
    echo       Skip: file not found
)

:: [5] Remove GitHub Copilot workspace instructions file
echo [5/7] Removing .github/copilot-instructions.md...
if exist "%PIXIU_PATH%\.github\copilot-instructions.md" (
    del /f /q "%PIXIU_PATH%\.github\copilot-instructions.md"
    echo       Done: %PIXIU_PATH%\.github\copilot-instructions.md deleted
) else (
    echo       Skip: file not found
)

:: [6] Remove Copilot instruction entry from VS Code settings.json
echo [6/7] Removing Copilot instruction from VS Code settings.json...
set "VSCODE_SETTINGS=%APPDATA%\Code\User\settings.json"
if exist "%VSCODE_SETTINGS%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$s = '%VSCODE_SETTINGS:\=\\%'; " ^
        "$p = '%PIXIU_PATH%'; " ^
        "$json = Get-Content $s -Raw -Encoding UTF8 | ConvertFrom-Json; " ^
        "$key = 'github.copilot.chat.codeGeneration.instructions'; " ^
        "if ($json.PSObject.Properties[$key]) { " ^
        "  $filtered = @($json.$key | Where-Object { $_.file -ne ($p + '\user_rules.md') }); " ^
        "  if ($filtered.Count -eq 0) { $json.PSObject.Properties.Remove($key) } " ^
        "  else { $json.$key = $filtered }; " ^
        "  [IO.File]::WriteAllText($s, ($json | ConvertTo-Json -Depth 10), [Text.Encoding]::UTF8); " ^
        "  Write-Host 'removed' " ^
        "} else { Write-Host 'not found' }"
    echo       Done: VS Code settings.json updated
) else (
    echo       Skip: settings.json not found
)

:: [7] Remove global Claude Code hooks from ~/.claude/settings.json
echo [7/7] Removing hooks from ~/.claude/settings.json...
set "CLAUDE_SETTINGS=%USERPROFILE%\.claude\settings.json"
if exist "%CLAUDE_SETTINGS%" (
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$s = '%CLAUDE_SETTINGS:\=\\%'; " ^
        "$json = Get-Content $s -Raw -Encoding UTF8 | ConvertFrom-Json; " ^
        "if ($json.PSObject.Properties['hooks']) { " ^
        "  $json.PSObject.Properties.Remove('hooks'); " ^
        "  [IO.File]::WriteAllText($s, ($json | ConvertTo-Json -Depth 20), [Text.Encoding]::UTF8); " ^
        "  Write-Host 'removed' " ^
        "} else { Write-Host 'not found' }"
    echo       Done: %CLAUDE_SETTINGS% hooks removed
) else (
    echo       Skip: settings.json not found
)

echo.
echo ================================================
echo   Uninstall Complete!
echo ================================================
echo.
echo   Restart terminal and VS Code for changes to take effect.
echo   The Pixiu source directory (%PIXIU_PATH%) was NOT deleted.
echo.
pause
