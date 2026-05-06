# Pixiu Mothership - Environment Uninstall Script
# 對稱撤銷 pixiu-init.ps1 的所有設定。
# 母體原始目錄不會被刪除。

param(
    [string]$CorePath = ""
)

$ErrorActionPreference = 'Stop'
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Resolve-FullPath {
    param([string]$Path)
    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Resolve-PixiuCore {
    param([string]$InputPath)
    if ($InputPath) { return Resolve-FullPath $InputPath }
    return Resolve-FullPath (Split-Path -Parent $PSScriptRoot)
}

function Remove-Junction {
    param([string]$Path)
    $Path = Resolve-FullPath $Path
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Host "  [SKIP] 不存在：$Path" -ForegroundColor DarkGray
        return
    }
    $item = Get-Item -LiteralPath $Path -Force
    if ($item.LinkType -eq 'Junction') {
        try {
            [System.IO.Directory]::Delete($Path, $false)
            Write-Host "  [OK] 已移除 junction：$Path" -ForegroundColor Green
        } catch {
            Write-Host "  [WARN] 無法移除 junction $Path：$_" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  [SKIP] 非 junction，保留：$Path" -ForegroundColor Yellow
    }
}

$SourceCorePath = Resolve-PixiuCore $CorePath
$StableCorePath = Resolve-FullPath (Join-Path $env:USERPROFILE '.pixiu-core')
$ClaudeDir      = Join-Path $env:USERPROFILE '.claude'
$GeminiDir      = Join-Path $env:USERPROFILE '.gemini'
$CodexDir       = Join-Path $env:USERPROFILE '.codex'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   PIXIU Mothership - Uninstall" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Stable link : $StableCorePath" -ForegroundColor Yellow
Write-Host "Source core : $SourceCorePath" -ForegroundColor Yellow
Write-Host ""

# [1/9] Remove ~/.claude/ junctions (agents, commands, hooks, rules, scripts)
Write-Host "[1/9] 移除 ~/.claude/ 目錄 junctions..." -ForegroundColor White
foreach ($name in @('agents', 'commands', 'hooks', 'rules', 'scripts')) {
    Remove-Junction -Path (Join-Path $ClaudeDir $name)
}

# [2/9] Clean ~/.claude/settings.json
Write-Host "[2/9] 清理 ~/.claude/settings.json..." -ForegroundColor White
$settingsPath = Join-Path $ClaudeDir 'settings.json'
if (Test-Path $settingsPath) {
    try {
        $settings = Get-Content $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $changed = $false

        if ($settings.PSObject.Properties['hooks']) {
            $settings.PSObject.Properties.Remove('hooks')
            $changed = $true
            Write-Host "  [OK] 移除 hooks" -ForegroundColor Green
        }

        if ($settings.PSObject.Properties['effortLevel']) {
            $settings.PSObject.Properties.Remove('effortLevel')
            $changed = $true
            Write-Host "  [OK] 移除 effortLevel" -ForegroundColor Green
        }

        if ($settings.PSObject.Properties['permissions'] -and
            $settings.permissions.PSObject.Properties['additionalDirectories']) {
            $dirs = @($settings.permissions.additionalDirectories | Where-Object { $_ -ne $StableCorePath })
            if ($dirs.Count -eq 0) {
                $settings.permissions.PSObject.Properties.Remove('additionalDirectories')
                $changed = $true
                Write-Host "  [OK] 移除 permissions.additionalDirectories" -ForegroundColor Green
            } elseif ($dirs.Count -lt @($settings.permissions.additionalDirectories).Count) {
                $settings.permissions.additionalDirectories = $dirs
                $changed = $true
                Write-Host "  [OK] 從 permissions.additionalDirectories 移除 Pixiu 路徑" -ForegroundColor Green
            }
        }

        if ($changed) {
            [System.IO.File]::WriteAllText($settingsPath, ($settings | ConvertTo-Json -Depth 20), $Utf8NoBom)
            Write-Host "  [OK] settings.json 已更新" -ForegroundColor Green
        } else {
            Write-Host "  [SKIP] 無 Pixiu 項目需清理" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "  [WARN] settings.json 處理失敗：$_" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [SKIP] settings.json 不存在" -ForegroundColor DarkGray
}

# [3/9] Remove ~/.claude/CLAUDE.md
Write-Host "[3/9] 移除 ~/.claude/CLAUDE.md..." -ForegroundColor White
$claudeMd = Join-Path $ClaudeDir 'CLAUDE.md'
if (Test-Path $claudeMd) {
    Remove-Item $claudeMd -Force
    Write-Host "  [OK] 已刪除 $claudeMd" -ForegroundColor Green
} else {
    Write-Host "  [SKIP] 不存在" -ForegroundColor DarkGray
}

# [4/9] Remove ~/.gemini/GEMINI.md
Write-Host "[4/9] 移除 ~/.gemini/GEMINI.md..." -ForegroundColor White
$geminiMd = Join-Path $GeminiDir 'GEMINI.md'
if (Test-Path $geminiMd) {
    Remove-Item $geminiMd -Force
    Write-Host "  [OK] 已刪除 $geminiMd" -ForegroundColor Green
} else {
    Write-Host "  [SKIP] 不存在" -ForegroundColor DarkGray
}

# [5/9] Remove ~/.codex/AGENTS.md and instructions.md
Write-Host "[5/9] 移除 ~/.codex/ 設定檔..." -ForegroundColor White
foreach ($file in @('AGENTS.md', 'instructions.md')) {
    $path = Join-Path $CodexDir $file
    if (Test-Path $path) {
        Remove-Item $path -Force
        Write-Host "  [OK] 已刪除 $path" -ForegroundColor Green
    } else {
        Write-Host "  [SKIP] $file 不存在" -ForegroundColor DarkGray
    }
}

# [6/9] Remove .github/copilot-instructions.md from source repo
Write-Host "[6/9] 移除 .github/copilot-instructions.md..." -ForegroundColor White
$copilotFile = Join-Path $SourceCorePath '.github\copilot-instructions.md'
if (Test-Path $copilotFile) {
    Remove-Item $copilotFile -Force
    Write-Host "  [OK] 已刪除 $copilotFile" -ForegroundColor Green
} else {
    Write-Host "  [SKIP] 不存在" -ForegroundColor DarkGray
}

# [7/9] Remove Copilot entry from VS Code settings.json
# 注意：setup 寫入的路徑是 $StableCorePath（~/.pixiu-core），不是 source 路徑
Write-Host "[7/9] 清理 VS Code settings.json (Copilot 指令)..." -ForegroundColor White
$vsCodeSettingsPath = Join-Path $env:APPDATA 'Code\User\settings.json'
if (Test-Path $vsCodeSettingsPath) {
    try {
        $vsSettings = Get-Content $vsCodeSettingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $copilotKey = 'github.copilot.chat.codeGeneration.instructions'
        $targetFile = "$StableCorePath\user_rules.md"
        if ($vsSettings.PSObject.Properties[$copilotKey]) {
            $filtered = @($vsSettings.$copilotKey | Where-Object { $_.file -ne $targetFile })
            if ($filtered.Count -eq 0) {
                $vsSettings.PSObject.Properties.Remove($copilotKey)
            } else {
                $vsSettings.$copilotKey = $filtered
            }
            [System.IO.File]::WriteAllText($vsCodeSettingsPath, ($vsSettings | ConvertTo-Json -Depth 10), $Utf8NoBom)
            Write-Host "  [OK] VS Code settings.json 已更新" -ForegroundColor Green
        } else {
            Write-Host "  [SKIP] 無 Pixiu Copilot 指令" -ForegroundColor DarkGray
        }
    } catch {
        Write-Host "  [WARN] 無法更新 VS Code settings.json：$_" -ForegroundColor Yellow
    }
} else {
    Write-Host "  [SKIP] VS Code settings.json 不存在" -ForegroundColor DarkGray
}

# [8/9] Remove PIXIU_CORE and PIXIU_CORE_PATH env vars
Write-Host "[8/9] 移除環境變數..." -ForegroundColor White
foreach ($varName in @('PIXIU_CORE', 'PIXIU_CORE_PATH')) {
    try {
        [Environment]::SetEnvironmentVariable($varName, $null, 'User')
        Write-Host "  [OK] 已移除 $varName" -ForegroundColor Green
    } catch {
        Write-Host "  [WARN] 移除 $varName 失敗：$_" -ForegroundColor Yellow
    }
}

# [9/9] Remove ~/.pixiu-core junction (最後執行，確保前面步驟能用到 StableCorePath 字串)
Write-Host "[9/9] 移除 ~/.pixiu-core junction..." -ForegroundColor White
Remove-Junction -Path $StableCorePath

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Uninstall 完成。請重新開啟終端機與 AI 工具。" -ForegroundColor Green
Write-Host "  母體原始目錄（$SourceCorePath）未動。" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
