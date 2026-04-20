# ==============================================================================
# Pixiu Mothership → Claude Code CLI 回滾腳本
# ------------------------------------------------------------------------------
# 作用：把 install-to-cli.ps1 的部署成果從 ~/.claude/ 撤掉。
# 保留：使用者原本的 settings.json 內容（除了 Pixiu 加進去的 hooks）
#
# 用法：
#   PowerShell 開啟後：
#      Set-ExecutionPolicy -Scope Process Bypass
#      C:\PixiuCore\scripts\setup\uninstall-from-cli.ps1
#
# 版本：v0.1.0 / 2026-04-17
# ==============================================================================

$ErrorActionPreference = 'Stop'

# --- PowerShell 版本守門 ---
if ($PSVersionTable.PSVersion.Major -lt 7) {
    Write-Host ""
    Write-Host "[✗] 本腳本需要 PowerShell 7+（目前：$($PSVersionTable.PSVersion)）" -ForegroundColor Red
    Write-Host "    請用 pwsh -File `"$PSCommandPath`" 重跑" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$ClaudeHome = Join-Path $env:USERPROFILE '.claude'
$CliCommands = Join-Path $ClaudeHome 'commands'
$CliSkills = Join-Path $ClaudeHome 'skills'
$CliSettings = Join-Path $ClaudeHome 'settings.json'
$CliBackups = Join-Path $ClaudeHome 'backups'

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host " Pixiu 母體 → Claude Code CLI 回滾中..." -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""

# --- Step 1｜備份當前 settings.json ---
Write-Host "[1/4] 備份當前 settings.json..." -ForegroundColor White
if (-not (Test-Path $CliBackups)) { New-Item -ItemType Directory -Path $CliBackups | Out-Null }
if (Test-Path $CliSettings) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backup = Join-Path $CliBackups "settings-pre-uninstall-$stamp.json"
    Copy-Item $CliSettings $backup
    Write-Host "    ✓ 已備份至 $backup" -ForegroundColor Green
}

# --- Step 2｜從 settings.json 的 hooks 區段移除「母體」條目 ---
Write-Host "[2/4] 移除 Pixiu hooks..." -ForegroundColor White
if (Test-Path $CliSettings) {
    try {
        $settings = Get-Content $CliSettings -Raw | ConvertFrom-Json -AsHashtable
    } catch {
        Write-Host "    [!] settings.json 解析失敗，跳過 hooks 清理" -ForegroundColor Yellow
        $settings = $null
    }

    if ($settings -and $settings.ContainsKey('hooks')) {
        $removed = 0
        foreach ($lifecycle in @($settings['hooks'].Keys)) {
            $before = @($settings['hooks'][$lifecycle])
            $after = $before | Where-Object { $_.description -notmatch '^母體' }
            $removed += ($before.Count - @($after).Count)
            if (@($after).Count -eq 0) {
                $settings['hooks'].Remove($lifecycle)
            } else {
                $settings['hooks'][$lifecycle] = @($after)
            }
        }
        if ($settings['hooks'].Count -eq 0) {
            $settings.Remove('hooks')
        }
        $json = $settings | ConvertTo-Json -Depth 20
        Set-Content -Path $CliSettings -Value $json -Encoding UTF8
        Write-Host "    ✓ 移除 $removed 條 Pixiu hook" -ForegroundColor Green
    }
} else {
    Write-Host "    ✓ settings.json 不存在，跳過" -ForegroundColor DarkGray
}

# --- Step 3｜移除 Pixiu commands ---
Write-Host "[3/4] 移除 Pixiu commands..." -ForegroundColor White
$pixiuOwnedCommands = @('go.md')
foreach ($cmd in $pixiuOwnedCommands) {
    $path = Join-Path $CliCommands $cmd
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "    ✓ 已刪除 $cmd" -ForegroundColor Green
    }
}

# --- Step 4｜移除 Pixiu skills junctions ---
Write-Host "[4/4] 移除 Pixiu skills junctions..." -ForegroundColor White
if (Test-Path $CliSkills) {
    $items = Get-ChildItem -Path $CliSkills -Force
    foreach ($item in $items) {
        if ($item.LinkType -eq 'Junction' -and $item.Target -match '\\PixiuCore\\skills\\') {
            # PowerShell 5.x 刪 junction 用 [System.IO.Directory]::Delete
            try {
                [System.IO.Directory]::Delete($item.FullName, $false)
                Write-Host "    ✓ 已移除 junction: $($item.Name)" -ForegroundColor Green
            } catch {
                Write-Host "    [✗] 移除 $($item.Name) 失敗：$_" -ForegroundColor Red
            }
        }
    }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host " 回滾完成。母體原始檔未動（C:\PixiuCore\ 不受影響）" -ForegroundColor Yellow
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Yellow
Write-Host ""
