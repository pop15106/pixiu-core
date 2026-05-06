# ============================================================
# RooCode Global Mothership Link Script
# ============================================================

param(
    [string]$PixiuPath = ""
)

# -- 0. Locate PixiuCore path ---------------------------------
if (-not $PixiuPath) { $PixiuPath = $env:PIXIU_CORE_PATH }
if (-not $PixiuPath) { $PixiuPath = $env:PIXIU_CORE }; if (-not $PixiuPath) { $PixiuPath = $env:PIXIU_CORE_PATH }; if (-not $PixiuPath) { $PixiuPath = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path }
$PixiuPath = $PixiuPath.TrimEnd('\')

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  RooCode x PixiuCore - Global Setup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Core path : $PixiuPath" -ForegroundColor Yellow
Write-Host "  User home : $env:USERPROFILE" -ForegroundColor Yellow
Write-Host ""

# -- Validate mothership exists -------------------------------
$sourceRules = Join-Path $PixiuPath "user_rules.md"
if (-not (Test-Path $sourceRules)) {
    Write-Host "[ERROR] Cannot find: $sourceRules" -ForegroundColor Red
    Write-Host "        Check PixiuCore path or set PIXIU_CORE_PATH env var." -ForegroundColor Red
    pause
    exit 1
}

# -- 1. Global .clinerules (HardLink -> user_rules.md) --------
Write-Host "[1/2] Setting up global .clinerules ..." -ForegroundColor Cyan

$globalClineRules = Join-Path $env:USERPROFILE ".clinerules"

if (Test-Path $globalClineRules) {
    $existing = Get-Item $globalClineRules
    if ($existing.LinkType -eq "HardLink") {
        Write-Host "  [SKIP] Already a HardLink, no change needed." -ForegroundColor Gray
    } else {
        Copy-Item $globalClineRules "$globalClineRules.bak" -Force
        Write-Host "  [BAK]  Old file backed up as .clinerules.bak" -ForegroundColor Gray
        Remove-Item $globalClineRules -Force
        New-Item -ItemType HardLink -Path $globalClineRules -Target $sourceRules | Out-Null
        Write-Host "  [OK]   ~/.clinerules -> user_rules.md" -ForegroundColor Green
    }
} else {
    New-Item -ItemType HardLink -Path $globalClineRules -Target $sourceRules | Out-Null
    Write-Host "  [OK]   ~/.clinerules -> user_rules.md" -ForegroundColor Green
}

# -- 2. Note about .roomodes ----------------------------------
Write-Host "[2/2] Note on .roomodes (project-level only) ..." -ForegroundColor Cyan
Write-Host ""
Write-Host "  NOTE: Roo Code only supports .roomodes at the project level." -ForegroundColor Yellow
Write-Host "  For each new project, run:" -ForegroundColor Yellow
Write-Host ""
Write-Host "    cd your-project-folder" -ForegroundColor White
Write-Host "    $PixiuPath\Tools\roocode_mothership_link_v2.ps1" -ForegroundColor White
Write-Host ""

# -- Summary --------------------------------------------------
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Done!" -ForegroundColor Green
Write-Host ""
Write-Host "  [GLOBAL - auto applied to all projects]" -ForegroundColor White
Write-Host "    ~/.clinerules  -> user_rules.md (HardLink)" -ForegroundColor White
Write-Host ""
Write-Host "  [PER PROJECT - run v2 script once per project]" -ForegroundColor White
Write-Host "    .roomodes      -> 27 PixiuCore Agent modes" -ForegroundColor White
Write-Host ""
Write-Host "  [NOT TOUCHED]" -ForegroundColor DarkGray
Write-Host "    ~/.claude/     Claude Code global settings" -ForegroundColor DarkGray
Write-Host "    ~/.cursor/     Cursor global settings" -ForegroundColor DarkGray
Write-Host "    user_rules.md  Mothership constitution (read-only)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Next: Restart VSCode / Antigravity." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
pause
