# ==============================================================================
# Pixiu Mothership → Claude Code CLI 一鍵部署腳本
# ------------------------------------------------------------------------------
# 作用：把 %PIXIU_CORE%\ 的 skills / commands / hooks 接進 ~/.claude/，讓 CLI
#       能真的讀到母體的全部治理功能。
# 特性：
#   - 冪等（idempotent）：重複跑不會壞事
#   - 不覆蓋使用者既有 settings：只 merge 需要的欄位
#   - 每次執行先備份 settings.json 到 .claude\backups\
#   - 清掉違反 Pixiu 憲法的 "defaultMode": "auto"（若存在）
#
# 用法：
#   1. 右鍵 → 以 PowerShell 執行
#      或
#   2. PowerShell 開啟後：
#      Set-ExecutionPolicy -Scope Process Bypass
#      %PIXIU_CORE%\scripts\setup\install-to-cli.ps1
#
# 版本：v0.1.0 / 2026-04-17
# ==============================================================================

$ErrorActionPreference = 'Stop'

# --- PowerShell 版本守門（-AsHashtable 需要 PS 7+）---
if ($PSVersionTable.PSVersion.Major -lt 7) {
    Write-Host ""
    Write-Host "[✗] 本腳本需要 PowerShell 7+（目前：$($PSVersionTable.PSVersion)）" -ForegroundColor Red
    Write-Host "    請用以下任一方式解決：" -ForegroundColor Yellow
    Write-Host "    1. 安裝 PowerShell 7：winget install Microsoft.PowerShell" -ForegroundColor Gray
    Write-Host "    2. 改用 pwsh 跑本腳本：pwsh -File `"$PSCommandPath`"" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# --- 路徑常數 ---
function Resolve-PixiuCore {
    if ($env:PIXIU_CORE -and (Test-Path (Join-Path $env:PIXIU_CORE 'user_rules.md'))) {
        return (Resolve-Path $env:PIXIU_CORE).Path
    }
    if ($env:PIXIU_CORE_PATH -and (Test-Path (Join-Path $env:PIXIU_CORE_PATH 'user_rules.md'))) {
        return (Resolve-Path $env:PIXIU_CORE_PATH).Path
    }
    $fromScript = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    if (Test-Path (Join-Path $fromScript 'user_rules.md')) {
        return $fromScript
    }
    throw 'Cannot resolve Pixiu core. Set PIXIU_CORE or run setup.bat first.'
}

$Pixiu = Resolve-PixiuCore
$ClaudeHome = Join-Path $env:USERPROFILE '.claude'
$PixiuCommands = Join-Path $Pixiu 'commands'
$PixiuSkills = Join-Path $Pixiu 'skills'
$PixiuHooks = Join-Path $Pixiu 'hooks\hooks.json'
$PixiuGuardrails = Join-Path $Pixiu 'scripts\hooks\pixiu-guardrails.js'

$CliCommands = Join-Path $ClaudeHome 'commands'
$CliSkills = Join-Path $ClaudeHome 'skills'
$CliSettings = Join-Path $ClaudeHome 'settings.json'
$CliBackups = Join-Path $ClaudeHome 'backups'

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Pixiu 母體 → Claude Code CLI 部署中..." -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# --- 前置檢查 ---
if (-not (Test-Path $Pixiu)) {
    Write-Host "[✗] 找不到 $Pixiu，請確認母體位置。" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $ClaudeHome)) {
    Write-Host "[!] $ClaudeHome 不存在，先幫你建立..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $ClaudeHome | Out-Null
}

# --- Step 1｜備份 settings.json ---
Write-Host "[1/5] 備份 settings.json..." -ForegroundColor White
if (-not (Test-Path $CliBackups)) {
    New-Item -ItemType Directory -Path $CliBackups | Out-Null
}
if (Test-Path $CliSettings) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backup = Join-Path $CliBackups "settings-$stamp.json"
    Copy-Item $CliSettings $backup
    Write-Host "    ✓ 已備份至 $backup" -ForegroundColor Green
} else {
    Write-Host "    ✓ settings.json 尚未建立，這步跳過" -ForegroundColor DarkGray
}

# --- Step 2｜清除 defaultMode: auto（Pixiu 憲法硬閘門）---
Write-Host "[2/5] 清除違反 Pixiu 憲法的 defaultMode=auto（若存在）..." -ForegroundColor White
$settings = @{}
if (Test-Path $CliSettings) {
    try {
        $raw = Get-Content $CliSettings -Raw
        if ($raw.Trim().Length -gt 0) {
            $settings = $raw | ConvertFrom-Json -AsHashtable
        }
    } catch {
        Write-Host "    [!] settings.json 解析失敗，改用空物件重建（舊版已備份）" -ForegroundColor Yellow
        $settings = @{}
    }
}

$cleaned = $false
if ($settings.ContainsKey('defaultMode') -and $settings['defaultMode'] -eq 'auto') {
    $settings.Remove('defaultMode')
    $cleaned = $true
}
if ($cleaned) {
    Write-Host "    ✓ 已移除 `"defaultMode`": `"auto`"" -ForegroundColor Green
} else {
    Write-Host "    ✓ 沒有違規設定，乾淨" -ForegroundColor DarkGray
}

# --- Step 3｜同步 commands（/go 與其他 slash commands）---
Write-Host "[3/5] 同步 commands（讓 /go 能被 CLI 認得）..." -ForegroundColor White
if (-not (Test-Path $CliCommands)) {
    New-Item -ItemType Directory -Path $CliCommands | Out-Null
}

# 只複製 origin: Pixiu 的 commands（以 go.md 為例，未來擴充）
$pixiuOwnedCommands = @('go.md')
foreach ($cmd in $pixiuOwnedCommands) {
    $src = Join-Path $PixiuCommands $cmd
    $dst = Join-Path $CliCommands $cmd
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "    ✓ $cmd" -ForegroundColor Green
    } else {
        Write-Host "    [!] 找不到 $src，跳過" -ForegroundColor Yellow
    }
}

# --- Step 4｜掛載 Pixiu hooks 到 settings.json ---
Write-Host "[4/5] 掛載 Pixiu hooks..." -ForegroundColor White
if (-not (Test-Path $PixiuGuardrails)) {
    Write-Host "    [✗] 找不到 $PixiuGuardrails，hooks 無法掛載" -ForegroundColor Red
    exit 1
}

# 確保 hooks 欄位存在
if (-not $settings.ContainsKey('hooks')) {
    $settings['hooks'] = @{}
}

# 定義 Pixiu 必裝 hooks
$pixiuHookEntries = @{
    'PreToolUse' = @(
        @{
            matcher = 'Edit|Write|MultiEdit'
            hooks = @(@{ type = 'command'; command = "node `"$PixiuGuardrails`" `"pre:pixiu:change-scope`"" })
            description = '母體治理：大規模變更警告 + .agent/ 變更偵測'
        },
        @{
            matcher = 'Edit|Write|MultiEdit|Bash'
            hooks = @(@{ type = 'command'; command = "node `"$PixiuGuardrails`" `"pre:pixiu:auto-mode-guard`"" })
            description = '母體安全：Auto mode 授權閘門'
        }
    )
    'PostToolUse' = @(
        @{
            matcher = 'Edit|Write'
            hooks = @(@{ type = 'command'; command = "node `"$PixiuGuardrails`" `"post:pixiu:secret-scan`"" })
            description = '母體安全：API Key / 機密洩露自動掃描'
        }
    )
    'Stop' = @(
        @{
            matcher = '*'
            hooks = @(@{ type = 'command'; command = "node `"$PixiuGuardrails`" `"stop:pixiu:mothership-sync`""; async = $true; timeout = 5 })
            description = '母體同步：偵測 .agent/ 框架級變更'
        }
    )
}

# Merge：對每個 lifecycle，用「description dedup + rebuild」策略
# （避免 IndexOf 反射相等性問題，簡單可靠）
foreach ($lifecycle in $pixiuHookEntries.Keys) {
    if (-not $settings['hooks'].ContainsKey($lifecycle)) {
        $settings['hooks'][$lifecycle] = @()
    }
    foreach ($entry in $pixiuHookEntries[$lifecycle]) {
        $current = @($settings['hooks'][$lifecycle])
        $isUpdate = @($current | Where-Object { $_.description -eq $entry.description }).Count -gt 0
        # 過濾掉舊條目 + 附加新條目
        $rebuilt = @($current | Where-Object { $_.description -ne $entry.description })
        $rebuilt += $entry
        $settings['hooks'][$lifecycle] = @($rebuilt)
        if ($isUpdate) {
            Write-Host "    ↻ $lifecycle｜$($entry.description)" -ForegroundColor DarkCyan
        } else {
            Write-Host "    ✓ $lifecycle｜$($entry.description)" -ForegroundColor Green
        }
    }
}

# 寫回 settings.json
$settingsJson = $settings | ConvertTo-Json -Depth 20
Set-Content -Path $CliSettings -Value $settingsJson -Encoding UTF8
Write-Host "    ✓ settings.json 已更新" -ForegroundColor Green

# --- Step 5｜Skills 連結 ---
Write-Host "[5/5] 接通 Skills..." -ForegroundColor White

# Claude Code CLI 讀 ~/.claude/skills/ 作為全域 skill 搜尋路徑
# 策略：在 ~/.claude/skills/ 下為每個 Pixiu skill 建立 junction（類 symlink），
#       指向 %PIXIU_CORE%\skills\<name>\。好處：母體 skill 更新即時反映，不用重跑腳本。
if (-not (Test-Path $CliSkills)) {
    New-Item -ItemType Directory -Path $CliSkills | Out-Null
}

$pixiuSkillDirs = Get-ChildItem -Path $PixiuSkills -Directory -ErrorAction SilentlyContinue | Where-Object {
    $skillMd = Join-Path $_.FullName 'SKILL.md'
    if (Test-Path $skillMd) {
        $content = Get-Content $skillMd -Raw
        return $content -match '(?m)^origin:\s*Pixiu\b'
    }
    return $false
}

$linked = 0
foreach ($dir in $pixiuSkillDirs) {
    $linkPath = Join-Path $CliSkills $dir.Name
    if (Test-Path $linkPath) {
        # 已存在 → 檢查是否為指向母體的 junction
        $item = Get-Item $linkPath -Force
        if ($item.LinkType -eq 'Junction' -and $item.Target -contains $dir.FullName) {
            Write-Host "    ↻ $($dir.Name)（連結已存在）" -ForegroundColor DarkCyan
            continue
        } else {
            Write-Host "    [!] $($dir.Name) 已有非 Pixiu 版本，略過（請手動合併）" -ForegroundColor Yellow
            continue
        }
    }
    try {
        New-Item -ItemType Junction -Path $linkPath -Target $dir.FullName | Out-Null
        Write-Host "    ✓ $($dir.Name) → $($dir.FullName)" -ForegroundColor Green
        $linked++
    } catch {
        Write-Host "    [✗] $($dir.Name) 建立 junction 失敗：$_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " 部署完成" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步驗收（請在新 Claude Code session 跑）：" -ForegroundColor White
Write-Host "  1. 打 /go      → 應該不再 Unknown command" -ForegroundColor Gray
Write-Host "  2. 打 auto mode → 應該觸發 Pixiu 三步驟授權流程" -ForegroundColor Gray
Write-Host "  3. 打 'recap' → 應該載入 pixiu-session-recap skill" -ForegroundColor Gray
Write-Host ""
Write-Host "回滾：%PIXIU_CORE%\scripts\setup\uninstall-from-cli.ps1" -ForegroundColor DarkGray
Write-Host "備份：$CliBackups" -ForegroundColor DarkGray
Write-Host ""
