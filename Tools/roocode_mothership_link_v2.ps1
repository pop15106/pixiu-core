# ============================================================
# RooCode x PixiuCore - Project Link Script v2
# Creates .clinerules + .roomodes in the CURRENT project folder.
# Does NOT touch Claude Code, Cursor, or any global AI configs.
#
# Usage:
#   cd your-project-folder
#   %PIXIU_CORE%\Tools\roocode_mothership_link_v2.ps1
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
Write-Host "  RooCode x PixiuCore - Project Link v2" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Core path    : $PixiuPath" -ForegroundColor Yellow
Write-Host "  Project path : $PWD" -ForegroundColor Yellow
Write-Host ""

# -- Validate mothership exists -------------------------------
$sourceRules = Join-Path $PixiuPath "user_rules.md"
if (-not (Test-Path $sourceRules)) {
    Write-Host "[ERROR] Cannot find: $sourceRules" -ForegroundColor Red
    Write-Host "        Check PixiuCore path or set PIXIU_CORE_PATH env var." -ForegroundColor Red
    pause
    exit 1
}

# -- 1. .clinerules (HardLink -> user_rules.md) ---------------
Write-Host "[1/2] Setting up .clinerules ..." -ForegroundColor Cyan

$clinerulesPath = Join-Path $PWD ".clinerules"

if (Test-Path $clinerulesPath) {
    $existing = Get-Item $clinerulesPath
    if ($existing.LinkType -eq "HardLink") {
        Write-Host "  [SKIP] Already a HardLink, no change needed." -ForegroundColor Gray
    } else {
        Rename-Item $clinerulesPath ".clinerules.bak" -Force
        Write-Host "  [BAK]  Old file backed up as .clinerules.bak" -ForegroundColor Gray
        New-Item -ItemType HardLink -Path $clinerulesPath -Target $sourceRules | Out-Null
        Write-Host "  [OK]   .clinerules -> user_rules.md" -ForegroundColor Green
    }
} else {
    New-Item -ItemType HardLink -Path $clinerulesPath -Target $sourceRules | Out-Null
    Write-Host "  [OK]   .clinerules -> user_rules.md" -ForegroundColor Green
}

# -- 2. .roomodes (generate from agents/) ---------------------
Write-Host "[2/2] Generating .roomodes from PixiuCore agents ..." -ForegroundColor Cyan

$agentsDir = Join-Path $PixiuPath "agents"
if (-not (Test-Path $agentsDir)) {
    Write-Host "  [WARN] agents/ directory not found, skipping .roomodes." -ForegroundColor Yellow
    pause
    exit 0
}

$agentFiles = Get-ChildItem -Path $agentsDir -Filter "*.md" | Sort-Object Name

# Agent display name map
$modeMap = @{
    "architect"             = "Architect"
    "code-reviewer"         = "Code Reviewer"
    "security-reviewer"     = "Security Reviewer"
    "tdd-guide"             = "TDD Guide"
    "planner"               = "Planner"
    "chief-of-staff"        = "Chief of Staff"
    "refactor-cleaner"      = "Refactor Cleaner"
    "database-reviewer"     = "Database Reviewer"
    "java-reviewer"         = "Java Reviewer"
    "java-build-resolver"   = "Java Build Resolver"
    "kotlin-reviewer"       = "Kotlin Reviewer"
    "kotlin-build-resolver" = "Kotlin Build Resolver"
    "python-reviewer"       = "Python Reviewer"
    "go-reviewer"           = "Go Reviewer"
    "go-build-resolver"     = "Go Build Resolver"
    "rust-reviewer"         = "Rust Reviewer"
    "rust-build-resolver"   = "Rust Build Resolver"
    "cpp-reviewer"          = "C++ Reviewer"
    "cpp-build-resolver"    = "C++ Build Resolver"
    "doc-updater"           = "Doc Updater"
    "docs-lookup"           = "Docs Lookup"
    "e2e-runner"            = "E2E Runner"
    "build-error-resolver"  = "Build Error Resolver"
    "verification-agent"    = "Verification Agent"
    "explore-agent"         = "Explore Agent"
    "harness-optimizer"     = "Harness Optimizer"
    "loop-operator"         = "Loop Operator"
}

# Read-only agents (no file write permission)
$readOnlyAgents = @("architect", "docs-lookup", "explore-agent", "planner", "chief-of-staff")

$customModes = [System.Collections.Generic.List[object]]::new()

foreach ($file in $agentFiles) {
    $slug    = $file.BaseName
    $content = Get-Content $file.FullName -Raw -Encoding UTF8

    # Parse name from frontmatter
    $nameMatch = [regex]::Match($content, "(?m)^name:\s*(.+)$")
    $agentName = if ($nameMatch.Success) { $nameMatch.Groups[1].Value.Trim() } else { $slug }

    # Extract body (after frontmatter)
    $body = $content -replace "(?s)^---.*?---\s*\n", ""
    $body = $body.Trim()

    # Display name
    $displayLabel = if ($modeMap.ContainsKey($slug)) { $modeMap[$slug] } else { $agentName }
    $displayName  = "[Pixiu] $displayLabel"

    # Groups
    if ($readOnlyAgents -contains $slug) {
        $groups = @("read")
    } else {
        $groups = @("read", "edit", "command")
    }

    $mode = [ordered]@{
        slug               = "pixiu-$slug"
        name               = $displayName
        roleDefinition     = $body
        customInstructions = "You are operating under PixiuCore mothership mode [$agentName]. Mothership path: $PixiuPath. Strictly follow user_rules.md, respond in Traditional Chinese, and act according to this agent's role."
        groups             = $groups
    }

    $customModes.Add($mode)
    Write-Host "  [+] $displayName" -ForegroundColor DarkGreen
}

# Write .roomodes
$roomodesPath = Join-Path $PWD ".roomodes"
if (Test-Path $roomodesPath) {
    Copy-Item $roomodesPath "$roomodesPath.bak" -Force
    Write-Host "  [BAK] Old .roomodes backed up." -ForegroundColor Gray
}

$output = [ordered]@{ customModes = $customModes.ToArray() }
$json   = $output | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText($roomodesPath, $json, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "  [OK] .roomodes created ($($customModes.Count) modes)" -ForegroundColor Green

# -- Summary --------------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Done!" -ForegroundColor Green
Write-Host ""
Write-Host "  [CREATED in this project]" -ForegroundColor White
Write-Host "    .clinerules  -> user_rules.md (HardLink)" -ForegroundColor White
Write-Host "    .roomodes    -> $($customModes.Count) Pixiu Agent modes" -ForegroundColor White
Write-Host ""
Write-Host "  [NOT TOUCHED]" -ForegroundColor DarkGray
Write-Host "    ~/.claude/     Claude Code global settings" -ForegroundColor DarkGray
Write-Host "    ~/.cursor/     Cursor global settings" -ForegroundColor DarkGray
Write-Host "    user_rules.md  Mothership constitution (read-only)" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Next: Restart VSCode / Antigravity." -ForegroundColor Yellow
Write-Host "  Then check Roo Code Mode selector for [Pixiu] modes." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
pause
