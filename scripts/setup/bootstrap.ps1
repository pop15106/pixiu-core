<#
.SYNOPSIS
  Pixiu Mothership one-shot deploy. Run after cloning the repo.
  Chains: submodule init -> PIXIU_CORE env -> junctions -> Claude & Codex wiring.
.NOTES
  Requires PowerShell 7+ (install-to-cli.ps1 depends on -AsHashtable). Idempotent; safe to re-run.
  Usage (from inside the mothership repo):  pwsh -File scripts/setup/bootstrap.ps1
#>
param([switch]$SkipSubmodule)

$ErrorActionPreference = 'Stop'

if ($PSVersionTable.PSVersion.Major -lt 7) {
    Write-Host "[X] PowerShell 7+ required (current $($PSVersionTable.PSVersion)). Re-run: pwsh -File `"$PSCommandPath`"" -ForegroundColor Red
    exit 1
}

# 0. Locate mothership (this script lives in scripts/setup/, repo root is two up)
$Core = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not (Test-Path (Join-Path $Core 'user_rules.md'))) {
    Write-Host "[X] Not a mothership repo root (user_rules.md missing): $Core" -ForegroundColor Red
    exit 1
}
Write-Host "[1/6] Mothership: $Core" -ForegroundColor Cyan

# 1. Submodule (cybersecurity library, 754 skills)
if (-not $SkipSubmodule) {
    Write-Host "[2/6] Init submodules (cybersecurity library)..." -ForegroundColor Cyan
    git -C $Core submodule update --init --recursive
} else {
    Write-Host "[2/6] Skipped submodules (-SkipSubmodule)" -ForegroundColor Gray
}

# 2. PIXIU_CORE env var (persistent user-level + current session)
Write-Host "[3/6] Setting PIXIU_CORE..." -ForegroundColor Cyan
setx PIXIU_CORE $Core | Out-Null
$env:PIXIU_CORE = $Core

# 3. ~/.pixiu-core junction (fallback chain bottom layer)
$PixiuLink = Join-Path $env:USERPROFILE '.pixiu-core'
if (-not (Test-Path $PixiuLink)) {
    New-Item -ItemType Junction -Path $PixiuLink -Target $Core | Out-Null
    Write-Host "[4/6] Created ~/.pixiu-core junction" -ForegroundColor Green
} else {
    Write-Host "[4/6] ~/.pixiu-core exists, skipped" -ForegroundColor Gray
}

# 4. ~/.claude governance junctions (agents/hooks/rules/scripts; skills+commands handled by install-to-cli)
$ClaudeHome = Join-Path $env:USERPROFILE '.claude'
New-Item -ItemType Directory -Force $ClaudeHome | Out-Null
foreach ($d in 'agents','hooks','rules','scripts') {
    $link = Join-Path $ClaudeHome $d
    $target = Join-Path $Core $d
    if (-not (Test-Path $target)) { continue }
    if (Test-Path $link) {
        $item = Get-Item $link -Force
        if ($item.LinkType -eq 'Junction') { continue }
        Write-Host "    [!] ~/.claude/$d exists and is not a junction, skipped (resolve manually)" -ForegroundColor Yellow
        continue
    }
    New-Item -ItemType Junction -Path $link -Target $target | Out-Null
    Write-Host "    + ~/.claude/$d -> mothership" -ForegroundColor Green
}
Write-Host "[5/6] ~/.claude governance junctions done" -ForegroundColor Cyan

# 5. Claude Code wiring (skills junctions + commands + settings.json hooks)
Write-Host "[6/6] Wiring Claude Code and Codex..." -ForegroundColor Cyan
& (Join-Path $Core 'scripts\setup\install-to-cli.ps1')

# 6. Codex wiring (generate ~/.codex/hooks.json)
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    node (Join-Path $Core 'scripts\setup\install-to-codex.js')
} else {
    Write-Host "    [!] node not found, skipped Codex. After installing node run: node scripts\setup\install-to-codex.js" -ForegroundColor Yellow
}

Write-Host "`
[DONE] Pixiu mothership deployed. Restart Claude Code / Codex to take effect." -ForegroundColor Green
Write-Host "Verify: Claude Code /hooks shows pixiu series; Codex: echo --dangerously-skip-permissions should be blocked." -ForegroundColor Gray
