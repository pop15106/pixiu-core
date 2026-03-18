# Pixiu Mothership - Environment Init Script
# Sets up a new machine with the complete Pixiu + ECC environment.
#
# What this installs to ~/.claude/:
#   1. CLAUDE.md           -- global rules pointing to PixiuCore
#   2. commands/           -- 57 ECC slash commands (/tdd, /code-review, etc.)
#   3. agents/             -- 28 ECC agents
#   4. hooks/              -- ECC automation hooks
#   5. scripts/            -- hook runtime scripts (required by hooks)
#   6. mcp-configs/        -- MCP server configs
#   7. plugin.json         -- ECC plugin manifest
#   8. AGENTS.md           -- agents index
#   9. settings.json       -- additionalDirectories + effortLevel
#  10. PIXIU_CORE_PATH     -- User environment variable (for Gemini)
#
# Usage:
#   1. Double-click [一鍵初始化環境.bat]
#   2. Drag-and-drop the PixiuCore folder onto this script
#   3. CLI: .\pixiu-init.ps1 "D:\MyPixiuCore"

param(
    [string]$CorePath = ""
)

# Auto-detect: Tools\ -> PixiuCore\
if (-not $CorePath) {
    $CorePath = Split-Path -Parent $PSScriptRoot
}
$CorePath = $CorePath.TrimEnd('\')

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   PIXIU Mothership - Environment Init" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Core path : $CorePath" -ForegroundColor Yellow
Write-Host ""

if (-not (Test-Path (Join-Path $CorePath "user_rules.md"))) {
    Write-Host "[ERROR] user_rules.md not found in: $CorePath" -ForegroundColor Red
    Write-Host "        Make sure you are pointing to the correct PixiuCore folder." -ForegroundColor Red
    pause; exit 1
}

$ClaudeDir = Join-Path $env:USERPROFILE ".claude"
if (-not (Test-Path $ClaudeDir)) {
    New-Item -Path $ClaudeDir -ItemType Directory -Force | Out-Null
}
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)

function Copy-Dir {
    param([string]$Src, [string]$Dst, [string]$Label)
    if (Test-Path $Src) {
        if (-not (Test-Path $Dst)) { New-Item -Path $Dst -ItemType Directory -Force | Out-Null }
        Copy-Item -Path "$Src\*" -Destination $Dst -Recurse -Force
        $count = (Get-ChildItem $Dst -Recurse -File).Count
        Write-Host "  [OK] $Label ($count files)" -ForegroundColor Green
    } else {
        Write-Host "  [SKIP] $Label not found in PixiuCore" -ForegroundColor Gray
    }
}

# ── 1. ~/.claude/CLAUDE.md ──────────────────────────────────────────
Write-Host "[1/9] Writing ~/.claude/CLAUDE.md ..." -ForegroundColor Cyan

$ruleFiles = @(
    "rules\README.md",
    "rules\common\agents.md",
    "rules\common\coding-style.md",
    "rules\common\development-workflow.md",
    "rules\common\git-workflow.md",
    "rules\common\hooks.md",
    "rules\common\security.md",
    "rules\common\testing.md",
    "rules\common\performance.md",
    "rules\common\patterns.md",
    "rules\typescript\coding-style.md",
    "rules\typescript\patterns.md",
    "rules\typescript\testing.md",
    "rules\python\coding-style.md",
    "rules\python\patterns.md",
    "rules\python\testing.md",
    "rules\golang\coding-style.md",
    "rules\golang\patterns.md",
    "rules\golang\testing.md",
    "rules\kotlin\coding-style.md",
    "rules\kotlin\patterns.md",
    "rules\kotlin\testing.md",
    "rules\cpp\coding-style.md",
    "rules\cpp\security.md",
    "rules\cpp\testing.md"
)

$lines = @(
    "# Pixiu Global Claude Code Configuration",
    "",
    "> This machine is managed by Pixiu Mothership Core.",
    "> All global rules and skills are sourced from $CorePath.",
    "",
    "## Global Rules -- Pixiu (Highest Priority)",
    "",
    "@$CorePath\user_rules.md",
    "",
    "## ECC Common Rules",
    ""
)
foreach ($rel in $ruleFiles) {
    $full = Join-Path $CorePath $rel
    if (Test-Path $full) { $lines += "@$CorePath\$rel" }
}

$claudeMdPath = Join-Path $ClaudeDir "CLAUDE.md"
[System.IO.File]::WriteAllText($claudeMdPath, ($lines -join "`r`n"), $Utf8NoBom)
Write-Host "  [OK] CLAUDE.md" -ForegroundColor Green

# ── 2. commands/ ────────────────────────────────────────────────────
Write-Host "[2/9] Syncing commands ..." -ForegroundColor Cyan
Copy-Dir (Join-Path $CorePath "commands") (Join-Path $ClaudeDir "commands") "commands"

# ── 3. agents/ ──────────────────────────────────────────────────────
Write-Host "[3/9] Syncing agents ..." -ForegroundColor Cyan
Copy-Dir (Join-Path $CorePath "agents") (Join-Path $ClaudeDir "agents") "agents"

# ── 4. hooks/ ───────────────────────────────────────────────────────
Write-Host "[4/9] Syncing hooks ..." -ForegroundColor Cyan
Copy-Dir (Join-Path $CorePath "hooks") (Join-Path $ClaudeDir "hooks") "hooks"

# ── 5. scripts/ (required by hooks at runtime) ──────────────────────
Write-Host "[5/9] Syncing hook runtime scripts ..." -ForegroundColor Cyan
Copy-Dir (Join-Path $CorePath "scripts") (Join-Path $ClaudeDir "scripts") "scripts"

# ── 6. mcp-configs/ ─────────────────────────────────────────────────
Write-Host "[6/9] Syncing MCP configs ..." -ForegroundColor Cyan
Copy-Dir (Join-Path $CorePath "mcp-configs") (Join-Path $ClaudeDir "mcp-configs") "mcp-configs"

# ── 7. plugin.json ──────────────────────────────────────────────────
Write-Host "[7/9] Syncing plugin.json ..." -ForegroundColor Cyan
$srcPlugin = Join-Path $CorePath "plugin.json"
if (Test-Path $srcPlugin) {
    Copy-Item -Path $srcPlugin -Destination (Join-Path $ClaudeDir "plugin.json") -Force
    Write-Host "  [OK] plugin.json" -ForegroundColor Green
} else {
    Write-Host "  [SKIP] plugin.json not found" -ForegroundColor Gray
}

# ── 8. AGENTS.md + single files ─────────────────────────────────────
Write-Host "[8/9] Syncing doc files ..." -ForegroundColor Cyan
foreach ($f in @("AGENTS.md", "README.md", "marketplace.json", "PLUGIN_SCHEMA_NOTES.md")) {
    $s = Join-Path $CorePath $f
    if (Test-Path $s) {
        Copy-Item -Path $s -Destination (Join-Path $ClaudeDir $f) -Force
        Write-Host "  [OK] $f" -ForegroundColor Green
    }
}

# ── 8b. Dot-folders (.agents .codex .cursor .opencode) ──────────────
foreach ($d in @(".agents", ".codex", ".cursor", ".opencode", "plugins")) {
    Copy-Dir (Join-Path $CorePath $d) (Join-Path $ClaudeDir $d) $d
}

# ── 9. settings.json ────────────────────────────────────────────────
Write-Host "[9/9] Writing settings.json ..." -ForegroundColor Cyan
$settingsPath = Join-Path $ClaudeDir "settings.json"

# Read existing settings if present, otherwise start fresh
if (Test-Path $settingsPath) {
    $existing = Get-Content $settingsPath -Raw | ConvertFrom-Json
} else {
    $existing = [PSCustomObject]@{ permissions = [PSCustomObject]@{ allow = @(); additionalDirectories = @() } }
}

# Ensure permissions object exists
if (-not $existing.PSObject.Properties["permissions"]) {
    $existing | Add-Member -MemberType NoteProperty -Name "permissions" -Value ([PSCustomObject]@{})
}

# Set additionalDirectories to include CorePath
$existing.permissions | Add-Member -MemberType NoteProperty -Name "additionalDirectories" -Value @($CorePath) -Force

# Set effortLevel
$existing | Add-Member -MemberType NoteProperty -Name "effortLevel" -Value "medium" -Force

$settingsJson = $existing | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($settingsPath, $settingsJson, $Utf8NoBom)
Write-Host "  [OK] settings.json (additionalDirectories: $CorePath)" -ForegroundColor Green

# ── 10. PIXIU_CORE_PATH env var ─────────────────────────────────────
Write-Host "[10/10] Setting PIXIU_CORE_PATH environment variable ..." -ForegroundColor Cyan
[System.Environment]::SetEnvironmentVariable("PIXIU_CORE_PATH", $CorePath, "User")
Write-Host "  [OK] PIXIU_CORE_PATH = $CorePath" -ForegroundColor Green

# ── Summary ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Init complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Core              : $CorePath" -ForegroundColor White
Write-Host "  ~/.claude/CLAUDE.md  set" -ForegroundColor White
Write-Host "  ~/.claude/commands/  set (slash commands)" -ForegroundColor White
Write-Host "  ~/.claude/agents/    set" -ForegroundColor White
Write-Host "  ~/.claude/hooks/     set" -ForegroundColor White
Write-Host "  ~/.claude/scripts/   set (hook runtime)" -ForegroundColor White
Write-Host "  ~/.claude/mcp-configs/ set" -ForegroundColor White
Write-Host "  ~/.claude/settings.json  additionalDirectories + effortLevel" -ForegroundColor White
Write-Host "  PIXIU_CORE_PATH      = $CorePath" -ForegroundColor White
Write-Host ""
Write-Host "  Next: restart VSCode / Antigravity" -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
pause
