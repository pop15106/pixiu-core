# ============================================================
# RooCode x PixiuCore - Fleet Deploy Script
# Reads fleet.json and deploys .clinerules + .roomodes
# to ALL registered projects in one shot.
#
# Does NOT touch: ~/.claude/ ~/.cursor/ user_rules.md
#
# Usage:
#   %PIXIU_CORE%\Tools\roocode_fleet_deploy.ps1
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
Write-Host "  RooCode x PixiuCore - Fleet Deploy" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Core path  : $PixiuPath" -ForegroundColor Yellow
Write-Host ""

# -- Validate mothership --------------------------------------
$sourceRules = Join-Path $PixiuPath "user_rules.md"
if (-not (Test-Path $sourceRules)) {
    Write-Host "[ERROR] Cannot find: $sourceRules" -ForegroundColor Red
    pause; exit 1
}

# -- Load fleet.json ------------------------------------------
$fleetFile = Join-Path $PixiuPath "fleet.json"
if (-not (Test-Path $fleetFile)) {
    Write-Host "[ERROR] Cannot find fleet.json at: $fleetFile" -ForegroundColor Red
    pause; exit 1
}

$projects = Get-Content $fleetFile -Raw | ConvertFrom-Json
Write-Host "  Fleet size : $($projects.Count) projects" -ForegroundColor Yellow
Write-Host ""

# -- Pre-build .roomodes payload (done once, reused) ----------
$agentsDir = Join-Path $PixiuPath "agents"
if (-not (Test-Path $agentsDir)) {
    Write-Host "[ERROR] agents/ directory not found." -ForegroundColor Red
    pause; exit 1
}

$agentFiles = Get-ChildItem -Path $agentsDir -Filter "*.md" | Sort-Object Name

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

$readOnlyAgents = @("architect", "docs-lookup", "explore-agent", "planner", "chief-of-staff")

Write-Host "  Building agent modes from $($agentFiles.Count) agents ..." -ForegroundColor Cyan

$customModes = [System.Collections.Generic.List[object]]::new()

foreach ($file in $agentFiles) {
    $slug    = $file.BaseName
    $content = Get-Content $file.FullName -Raw -Encoding UTF8

    $nameMatch = [regex]::Match($content, "(?m)^name:\s*(.+)$")
    $agentName = if ($nameMatch.Success) { $nameMatch.Groups[1].Value.Trim() } else { $slug }

    $body = $content -replace "(?s)^---.*?---\s*\n", ""
    $body = $body.Trim()

    $displayLabel = if ($modeMap.ContainsKey($slug)) { $modeMap[$slug] } else { $agentName }
    $displayName  = "[Pixiu] $displayLabel"

    if ($readOnlyAgents -contains $slug) {
        $groups = @("read")
    } else {
        $groups = @("read", "edit", "command")
    }

    $customModes.Add([ordered]@{
        slug               = "pixiu-$slug"
        name               = $displayName
        roleDefinition     = $body
        customInstructions = "You are operating under PixiuCore mothership mode [$agentName]. Mothership path: $PixiuPath. Strictly follow user_rules.md, respond in Traditional Chinese, and act according to this agent role."
        groups             = $groups
    })
}

$roomodesJson = ([ordered]@{ customModes = $customModes.ToArray() } | ConvertTo-Json -Depth 10)
$utf8NoBom    = [System.Text.UTF8Encoding]::new($false)

Write-Host "  [OK] $($customModes.Count) modes ready." -ForegroundColor Green
Write-Host ""

# -- Deploy to each project -----------------------------------
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Deploying to fleet ..." -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$ok      = 0
$skipped = 0
$failed  = 0

foreach ($proj in $projects) {
    $proj = $proj.TrimEnd('\')

    if (-not (Test-Path $proj)) {
        Write-Host "  [SKIP] Not found : $proj" -ForegroundColor DarkGray
        $skipped++
        continue
    }

    try {
        # .clinerules
        $clinerulesPath = Join-Path $proj ".clinerules"
        if (Test-Path $clinerulesPath) {
            $existing = Get-Item $clinerulesPath
            if ($existing.LinkType -ne "HardLink") {
                Copy-Item $clinerulesPath "$clinerulesPath.bak" -Force
                Remove-Item $clinerulesPath -Force
                New-Item -ItemType HardLink -Path $clinerulesPath -Target $sourceRules | Out-Null
            }
        } else {
            New-Item -ItemType HardLink -Path $clinerulesPath -Target $sourceRules | Out-Null
        }

        # .roomodes
        $roomodesPath = Join-Path $proj ".roomodes"
        if (Test-Path $roomodesPath) {
            Copy-Item $roomodesPath "$roomodesPath.bak" -Force
        }
        [System.IO.File]::WriteAllText($roomodesPath, $roomodesJson, $utf8NoBom)

        Write-Host "  [OK]   $proj" -ForegroundColor Green
        $ok++
    }
    catch {
        Write-Host "  [ERR]  $proj" -ForegroundColor Red
        Write-Host "         $_" -ForegroundColor Red
        $failed++
    }
}

# -- Final summary --------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Fleet Deploy Complete" -ForegroundColor Green
Write-Host ""
Write-Host "  Deployed : $ok projects" -ForegroundColor Green
Write-Host "  Skipped  : $skipped projects (path not found)" -ForegroundColor DarkGray
Write-Host "  Failed   : $failed projects" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "DarkGray" })
Write-Host ""
Write-Host "  Each project now has:" -ForegroundColor White
Write-Host "    .clinerules  -> user_rules.md (mothership constitution)" -ForegroundColor White
Write-Host "    .roomodes    -> $($customModes.Count) Pixiu Agent modes" -ForegroundColor White
Write-Host ""
Write-Host "  NOT TOUCHED:" -ForegroundColor DarkGray
Write-Host "    ~/.claude/  ~/.cursor/  user_rules.md" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Next: Restart VSCode / Antigravity." -ForegroundColor Yellow
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
pause
