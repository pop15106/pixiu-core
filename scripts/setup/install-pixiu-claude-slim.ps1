#Requires -Version 7
<#
.SYNOPSIS
  PixiuCore 精簡版安裝：只把需要的部分接進 Claude Code。

.DESCRIPTION
  與原本的 setup.bat / Tools\pixiu-init.ps1 不同，本腳本：
    - 不動 ~\.codex（Codex 的 AGENTS.md / instructions.md 保持原樣）
    - 不動 VS Code settings.json
    - 不改 settings.json 的 permissions.allow、effortLevel
    - 全域 CLAUDE.md 只寫入低 Token 入口（Bootstrap → Router → 最多 3 個 Capability），
      不整包 @ 載入 user_rules.md 與 ECC rules
    - 只為指定的 Skills 建立 junction
    - 只掛 2 個 hook：change-scope（大範圍修改提醒）、secret-scan（寫入機密掃描）

  預設為「預演模式」，只列出會做什麼；確認後加上 -Apply 才會真的執行。
  每次 -Apply 前都會先備份到 ~\.claude\backups\pixiu-slim-<時間>\。

.EXAMPLE
  pwsh -File .\install-pixiu-claude-slim.ps1
  pwsh -File .\install-pixiu-claude-slim.ps1 -Apply
  pwsh -File .\install-pixiu-claude-slim.ps1 -Uninstall -Apply
#>
[CmdletBinding()]
param(
    # 母體原始位置；未指定時，若腳本位於母體的 scripts\setup\ 就用該母體，否則用工作機預設路徑
    [string]$CorePath = '',

    # 要接進 Claude Code 的 Skills（名稱需存在於 <母體>\skills\）
    [string[]]$Skills = @(
        'legacy-java-flow-tracing',
        'critical-relay',
        'change-review-evidence',
        'requirement-confirmation',
        'system-documentation',      # change-review-evidence / requirement-confirmation 的相依
        'make-docx',                 # system-documentation 產出 DOCX 時使用
        'pixiu-verify-loop',
        'pixiu-session-recap',
        'analyze-style',             # Pro析／X析（兩種模式）
        'java-coding-standards',     # 手動呼叫（disable-model-invocation: true）
        'job-scout'                  # 手動呼叫（disable-model-invocation: true）
    ),

    # 實際執行；未加時只預演
    [switch]$Apply,

    # 移除本腳本建立的項目
    [switch]$Uninstall,

    # 指定的 skill junction 已指向其他位置時，改指向母體
    [switch]$Force,

    # 測試用：覆寫使用者家目錄
    [string]$HomeDir = $HOME
)

$ErrorActionPreference = 'Stop'
if (-not $CorePath) {
    $repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    $CorePath = if (Test-Path (Join-Path $repoRoot 'vault/bootstrap/SESSION-BOOTSTRAP.md')) { $repoRoot }
                else { 'C:\Users\7010\Desktop\gravityTest\pixiu-core' }
}
$MarkerBegin = '<!-- PIXIU-SLIM:BEGIN -->'
$MarkerEnd   = '<!-- PIXIU-SLIM:END -->'
$HookIds     = @('pre:pixiu:change-scope', 'post:pixiu:secret-scan')
$Mode        = if ($Apply) { '執行' } else { '預演' }
$LinkType    = if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }   # 非 Windows 僅供測試

# ── 共用函式 ─────────────────────────────────────────────────────────
function Write-Step([string]$Text) { Write-Host "`n$Text" -ForegroundColor Cyan }
function Write-Plan([string]$Text) {
    $prefix = if ($Apply) { '  [做]' } else { '  [預演]' }
    Write-Host "$prefix $Text"
}
function Write-Skip([string]$Text) { Write-Host "  [略過] $Text" -ForegroundColor Yellow }
function Write-Ok([string]$Text)   { Write-Host "  [OK] $Text" -ForegroundColor Green }

function Get-LinkInfo([string]$Path) {
    # 回傳 $null（不存在）、或 @{ IsLink; Target }
    if (-not (Test-Path -LiteralPath $Path)) {
        $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
        if (-not $item) { return $null }
    } else {
        $item = Get-Item -LiteralPath $Path -Force
    }
    $isLink = [bool]$item.LinkType
    $target = if ($isLink) { @($item.Target)[0] } else { $null }
    return @{ IsLink = $isLink; Target = $target }
}

function Test-SamePath([string]$A, [string]$B) {
    if (-not $A -or -not $B) { return $false }
    $na = [IO.Path]::GetFullPath($A).TrimEnd('\', '/')
    $nb = [IO.Path]::GetFullPath($B).TrimEnd('\', '/')
    return [string]::Equals($na, $nb, [StringComparison]::OrdinalIgnoreCase)
}

function Set-Link([string]$Path, [string]$Target, [switch]$AllowRetarget) {
    $info = Get-LinkInfo $Path
    if ($null -eq $info) {
        Write-Plan "建立連結 $Path → $Target"
        if ($Apply) {
            $parent = Split-Path -Parent $Path
            if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
            New-Item -ItemType $LinkType -Path $Path -Target $Target | Out-Null
        }
        return
    }
    if (-not $info.IsLink) { Write-Skip "$Path 是一般資料夾，保留不動"; return }
    if (Test-SamePath $info.Target $Target) { Write-Ok "已連結：$Path"; return }
    if (-not $AllowRetarget) { Write-Skip "$Path 目前指向 $($info.Target)，加 -Force 才會改指向母體"; return }
    Write-Plan "改指向 $Path → $Target（原本 $($info.Target)）"
    if ($Apply) {
        Remove-LinkOnly $Path
        New-Item -ItemType $LinkType -Path $Path -Target $Target | Out-Null
    }
}

function Remove-LinkOnly([string]$Path) {
    # 只刪除連結本身，不碰目標內容
    if ($IsWindows) { [IO.Directory]::Delete($Path, $false) } else { Remove-Item -LiteralPath $Path -Force }
}

function Read-JsonHashtable([string]$Path) {
    if (-not (Test-Path $Path)) { return [ordered]@{} }
    $raw = Get-Content -LiteralPath $Path -Raw -Encoding utf8
    if ([string]::IsNullOrWhiteSpace($raw)) { return [ordered]@{} }
    try { return $raw | ConvertFrom-Json -AsHashtable -Depth 64 }
    catch { throw "settings.json 無法解析，請先手動修正：$Path`n$($_.Exception.Message)" }
}

function Write-Utf8([string]$Path, [string]$Text) {
    [IO.File]::WriteAllText($Path, $Text, [Text.UTF8Encoding]::new($false))
}

function Test-PixiuHookEntry($Entry) {
    # 判斷 hooks 陣列中的一筆是否為本腳本管理的 Pixiu hook
    foreach ($h in @($Entry.hooks)) {
        $cmd = [string]$h.command
        if ($cmd -match 'pixiu-guardrails\.js' -and ($HookIds | Where-Object { $cmd -like "*$_*" })) { return $true }
    }
    return $false
}

# ── 路徑 ─────────────────────────────────────────────────────────────
$ClaudeDir    = Join-Path $HomeDir '.claude'
$StableCore   = Join-Path $HomeDir '.pixiu-core'
$ClaudeMd     = Join-Path $ClaudeDir 'CLAUDE.md'
$SettingsPath = Join-Path $ClaudeDir 'settings.json'
$SkillsDir    = Join-Path $ClaudeDir 'skills'
$Guardrails   = Join-Path $StableCore (Join-Path 'scripts' (Join-Path 'hooks' 'pixiu-guardrails.js'))

Write-Host "PixiuCore 精簡安裝（$Mode 模式）" -ForegroundColor Cyan
Write-Host "  母體原始位置：$CorePath"
Write-Host "  穩定路徑：    $StableCore"
Write-Host "  Claude 設定： $ClaudeDir"
if (-not $Apply) { Write-Host '  ※ 目前只預演，不會修改任何檔案；確認後加 -Apply 執行。' -ForegroundColor Yellow }

# ── 移除模式 ─────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Step '[移除] Skills 連結'
    $coreSkills = Join-Path $CorePath 'skills'
    if (Test-Path $SkillsDir) {
        foreach ($d in Get-ChildItem -LiteralPath $SkillsDir -Force) {
            $info = Get-LinkInfo $d.FullName
            if ($info.IsLink -and ($info.Target -like "$coreSkills*" -or $info.Target -like "$StableCore*")) {
                Write-Plan "刪除連結 $($d.FullName)"
                if ($Apply) { Remove-LinkOnly $d.FullName }
            }
        }
    }
    Write-Step '[移除] CLAUDE.md 的 Pixiu 區塊'
    if (Test-Path $ClaudeMd) {
        $text = Get-Content -LiteralPath $ClaudeMd -Raw -Encoding utf8
        $pattern = "(?s)\r?\n?$([regex]::Escape($MarkerBegin)).*?$([regex]::Escape($MarkerEnd))\r?\n?"
        if ($text -match $pattern) {
            Write-Plan '移除標記區塊'
            if ($Apply) { Write-Utf8 $ClaudeMd ([regex]::Replace($text, $pattern, "`r`n").Trim() + "`r`n") }
        } else { Write-Skip '找不到 Pixiu 區塊' }
    }
    Write-Step '[移除] settings.json 的 Pixiu hooks'
    $s = Read-JsonHashtable $SettingsPath
    $changed = $false
    if ($s.Contains('hooks')) {
        foreach ($ev in @($s.hooks.Keys)) {
            $kept = @($s.hooks[$ev] | Where-Object { -not (Test-PixiuHookEntry $_) })
            if ($kept.Count -ne @($s.hooks[$ev]).Count) { Write-Plan "移除 $ev 的 Pixiu hook"; $s.hooks[$ev] = $kept; $changed = $true }
        }
    }
    if ($changed -and $Apply) { Write-Utf8 $SettingsPath ($s | ConvertTo-Json -Depth 64) }
    Write-Host "`n完成（$Mode）。環境變數 PIXIU_CORE 與 ~\.pixiu-core 連結保留，其他工具可能還在用。" -ForegroundColor Green
    return
}

# ── [0] 前置檢查 ─────────────────────────────────────────────────────
Write-Step '[0/5] 前置檢查'
foreach ($rel in @('CLAUDE.md', 'vault/bootstrap/SESSION-BOOTSTRAP.md', 'scripts/router/resolve-capabilities.js', 'scripts/hooks/pixiu-guardrails.js')) {
    $p = Join-Path $CorePath $rel
    if (-not (Test-Path $p)) { throw "母體缺少必要檔案：$p" }
}
Write-Ok '母體必要檔案齊全'
if (Get-Command node -ErrorAction SilentlyContinue) { Write-Ok "Node.js $(node -v)" }
else { throw '找不到 node，Router 與 hooks 都需要 Node.js' }

# Claude 專屬版本（.claude/skills/<名稱>）優先，其次是共用的 skills/<名稱>
function Get-SkillSource([string]$Root, [string]$Name) {
    foreach ($rel in @(@('.claude', 'skills', $Name), @('skills', $Name))) {
        $dir = $Root
        foreach ($part in $rel) { $dir = Join-Path $dir $part }
        if (Test-Path (Join-Path $dir 'SKILL.md')) { return ($rel -join '/') }
    }
    return $null
}
$missing = @($Skills | Where-Object { -not (Get-SkillSource $CorePath $_) })
if ($missing) { throw "母體找不到這些 Skills：$($missing -join ', ')" }
Write-Ok "$($Skills.Count) 個 Skills 都存在"

foreach ($old in @('agents', 'commands', 'hooks', 'rules', 'scripts')) {
    $info = Get-LinkInfo (Join-Path $ClaudeDir $old)
    if ($info -and $info.IsLink) { Write-Skip "偵測到舊版 setup 留下的 ~\.claude\$old 連結（指向 $($info.Target)），本腳本不處理，需要時再手動移除" }
}

# ── [1] 備份 ─────────────────────────────────────────────────────────
Write-Step '[1/5] 備份'
$stamp     = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $ClaudeDir (Join-Path 'backups' "pixiu-slim-$stamp")
Write-Plan "備份 CLAUDE.md、settings.json 與 skills 清單到 $backupDir"
if ($Apply) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    foreach ($f in @($ClaudeMd, $SettingsPath)) { if (Test-Path $f) { Copy-Item -LiteralPath $f -Destination $backupDir } }
    if (Test-Path $SkillsDir) {
        Get-ChildItem -LiteralPath $SkillsDir -Force | ForEach-Object {
            $i = Get-LinkInfo $_.FullName
            "{0}`t{1}" -f $_.Name, ($(if ($i.IsLink) { $i.Target } else { '(一般資料夾)' }))
        } | Set-Content -LiteralPath (Join-Path $backupDir 'skills-list.txt') -Encoding utf8
    }
}

# ── [2] 穩定路徑與環境變數 ───────────────────────────────────────────
Write-Step '[2/5] 穩定路徑 ~\.pixiu-core 與環境變數'
Set-Link -Path $StableCore -Target $CorePath -AllowRetarget:$Force
foreach ($name in @('PIXIU_CORE', 'PIXIU_CORE_PATH')) {
    $cur = [Environment]::GetEnvironmentVariable($name, 'User')
    if (Test-SamePath $cur $StableCore) { Write-Ok "$name 已設定" }
    else {
        Write-Plan "設定使用者環境變數 $name = $StableCore（原本：$(if ($cur) { $cur } else { '未設定' })）"
        if ($Apply -and $IsWindows) { [Environment]::SetEnvironmentVariable($name, $StableCore, 'User') }
    }
}

# ── [3] 全域 CLAUDE.md（低 Token 入口）──────────────────────────────
Write-Step '[3/5] 全域 CLAUDE.md'
$bootstrap = Join-Path $StableCore 'vault\bootstrap\SESSION-BOOTSTRAP.md'
$router    = Join-Path $StableCore 'scripts\router\resolve-capabilities.js'
$manifest  = Join-Path $StableCore 'vault\capabilities\capability-manifest.json'
$govIndex  = Join-Path $StableCore 'vault\governance\INDEX.md'
$block = @"
$MarkerBegin
# PixiuCore 連結（低 Token 模式）

母體路徑：``$StableCore``（環境變數 ``PIXIU_CORE``）。下面提到的相對路徑都以母體路徑為基準。

## Session 啟動

1. 需要母體規則時，先讀 ``$bootstrap``。
2. 執行 ``node "$router" "<本次需求>"``。
3. 只讀 Router 回傳的 ``filesToLoad``，最多 3 個 Capability；檔案不存在就略過並說明缺少哪個。
4. Router 指向 ``skills/analyze-style/`` 或 ``skills/critical-relay/`` 時，改讀母體 ``.claude/skills/`` 下相同路徑（Pro析／X析 分析時可唯讀取證；CR 帳本放本機 ``.cr/``）。

Router 無法執行時，才改用 ``$manifest`` 降級路由。一般 Session 不全文載入 user_rules.md、identity、memory-summary.md、recap、decisions、全部 Skills、Workflows、Hooks 或 Agents；需要治理原文時，從 ``$govIndex`` 按需路由。

## 邊界

- 啟動 subagent、Agent Team、``/devfleet``、``/multi-plan``、``/orchestrate`` 前，需要使用者這一次的明確同意。
- 子 Agent 只拿精簡任務包，不重讀整個母體。
- 完成前重讀修改過的檔案、檢查差異，並執行最小充分驗證。
$MarkerEnd
"@ -replace "`r?`n", "`r`n"

if (Test-Path $ClaudeMd) {
    $current = Get-Content -LiteralPath $ClaudeMd -Raw -Encoding utf8
    $pattern = "(?s)$([regex]::Escape($MarkerBegin)).*?$([regex]::Escape($MarkerEnd))"
    if ($current -match $pattern) {
        Write-Plan '更新既有的 Pixiu 區塊，其他內容保留'
        $newText = [regex]::Replace($current, $pattern, [Text.RegularExpressions.MatchEvaluator]{ param($m) $block })
    } elseif ($current -match '^\s*# Pixiu Global Claude Code Configuration') {
        Write-Plan '偵測到舊版 setup 產生的 CLAUDE.md（整包 @ 載入規則），整份換成低 Token 入口（舊版已備份）'
        $newText = $block + "`r`n"
    } else {
        Write-Plan '既有 CLAUDE.md 不是 Pixiu 產生的，保留原內容，在最後附加 Pixiu 區塊'
        $newText = $current.TrimEnd() + "`r`n`r`n" + $block + "`r`n"
    }
} else {
    Write-Plan '建立新的 CLAUDE.md'
    $newText = $block + "`r`n"
}
if ($Apply) {
    if (-not (Test-Path $ClaudeDir)) { New-Item -ItemType Directory -Path $ClaudeDir -Force | Out-Null }
    Write-Utf8 $ClaudeMd $newText
}

# ── [4] Skills 連結 ──────────────────────────────────────────────────
Write-Step "[4/5] Skills 連結（$($Skills.Count) 個）"
foreach ($name in $Skills) {
    $target = $StableCore
    foreach ($part in ((Get-SkillSource $CorePath $name) -split '/')) { $target = Join-Path $target $part }
    Set-Link -Path (Join-Path $SkillsDir $name) -Target $target -AllowRetarget:$Force
}

# ── [5] settings.json：只掛 2 個 hook，追加母體為可讀目錄 ──────────
Write-Step '[5/5] settings.json'
$s = Read-JsonHashtable $SettingsPath
$wanted = [ordered]@{
    'PreToolUse'  = [ordered]@{ matcher = 'Edit|Write|MultiEdit'; hooks = @([ordered]@{ type = 'command'; command = "node `"$Guardrails`" `"pre:pixiu:change-scope`"" }) }
    'PostToolUse' = [ordered]@{ matcher = 'Edit|Write|MultiEdit'; hooks = @([ordered]@{ type = 'command'; command = "node `"$Guardrails`" `"post:pixiu:secret-scan`"" }) }
}
if (-not $s.Contains('hooks')) { $s['hooks'] = [ordered]@{} }
foreach ($ev in $wanted.Keys) {
    $existing = if ($s.hooks.Contains($ev)) { @($s.hooks[$ev]) } else { @() }
    $others   = @($existing | Where-Object { -not (Test-PixiuHookEntry $_) })
    $hadOld   = $others.Count -ne $existing.Count
    Write-Plan ("{0} {1} hook：{2}" -f ($(if ($hadOld) { '更新' } else { '新增' })), $ev, ($wanted[$ev].hooks[0].command -replace '.*"(\w+:pixiu:[\w-]+)".*', '$1'))
    $s.hooks[$ev] = @($others + $wanted[$ev])
}
if (-not $s.Contains('permissions')) { $s['permissions'] = [ordered]@{} }
$dirs = @($s.permissions['additionalDirectories'] | Where-Object { $_ })
if ($dirs | Where-Object { Test-SamePath $_ $StableCore }) { Write-Ok '母體已在 additionalDirectories' }
else {
    Write-Plan "permissions.additionalDirectories 追加 $StableCore（原有項目保留）"
    $s.permissions['additionalDirectories'] = @($dirs + $StableCore)
}
Write-Host '  ※ permissions.allow、effortLevel 與其他設定不會更動' -ForegroundColor DarkGray
if ($Apply) { Write-Utf8 $SettingsPath ($s | ConvertTo-Json -Depth 64) }

# ── 結尾 ─────────────────────────────────────────────────────────────
if ($Apply) {
    Write-Host "`n完成。請重新開啟終端機與 Claude Code。備份在：$backupDir" -ForegroundColor Green
    Write-Host '驗證：在 Claude Code 輸入 /skills 應看到上面的 Skills；/hooks 應看到 2 個 pixiu hook。'
} else {
    Write-Host "`n預演結束，沒有修改任何檔案。確認無誤後執行：" -ForegroundColor Yellow
    Write-Host "  pwsh -File `"$PSCommandPath`" -Apply"
}
