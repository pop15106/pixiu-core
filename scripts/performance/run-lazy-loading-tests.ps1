$ErrorActionPreference = 'Stop'

$CoreRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Push-Location $CoreRoot

try {
    node scripts/router/resolve-capabilities.test.js
    if ($LASTEXITCODE -ne 0) { throw 'Capability router tests failed.' }

    node scripts/performance/measure-core-startup.test.js
    if ($LASTEXITCODE -ne 0) { throw 'Startup measurement tests failed.' }

    node scripts/performance/lazy-loading-integration.test.js
    if ($LASTEXITCODE -ne 0) { throw 'Lazy-loading integration tests failed.' }

    node scripts/skills/validate-skill-metadata.test.js
    if ($LASTEXITCODE -ne 0) { throw 'Skill metadata unit tests failed.' }

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/entry-sync/tests/run-tests.ps1
    if ($LASTEXITCODE -ne 0) { throw 'Global entry sync tests failed.' }

    node --test scripts/agent-learning/agent-learning.test.js
    if ($LASTEXITCODE -ne 0) { throw 'Agent Learning tests failed.' }

    node --test scripts/setup/install-to-codex.test.js
    if ($LASTEXITCODE -ne 0) { throw 'Codex Hook installer tests failed.' }

    node --test scripts/setup/codex-project-config.test.js
    if ($LASTEXITCODE -ne 0) { throw 'Codex project config tests failed.' }

    node scripts/skills/validate-skill-metadata.js skills
    if ($LASTEXITCODE -ne 0) { throw 'Canonical Skill metadata validation failed.' }

    node scripts/skills/validate-skill-metadata.js .agents/skills
    if ($LASTEXITCODE -ne 0) { throw 'Portable Skill metadata validation failed.' }

    $report = node scripts/performance/measure-core-startup.js | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Startup measurement failed.' }

    foreach ($profileName in @('codex', 'claude', 'gemini')) {
        $profile = $report.startupProfiles.$profileName
        if (-not $profile) {
            throw "Startup profile is missing: $profileName"
        }
        if (-not $profile.withinBudget) {
            throw "Startup profile exceeds budget or has missing files: $profileName ($($profile.startupFilesBytes)/$($profile.budgetBytes) bytes)"
        }
    }

    if ($report.yamlWarnings -ne 0) {
        throw "Skill YAML warnings remain: $($report.yamlWarnings)"
    }

    Write-Host 'PixiuCore lazy-loading verification passed.' -ForegroundColor Green
    foreach ($profileName in @('codex', 'claude', 'gemini')) {
        $profile = $report.startupProfiles.$profileName
        Write-Host "Startup profile ${profileName}: $($profile.startupFilesBytes)/$($profile.budgetBytes) bytes / $($profile.startupFilesLines) lines"
    }
    Write-Host "Raw Skill package collisions: $($report.skillNameCollisions)"
    Write-Host "Effective Skill collisions: $($report.effectiveSkillNameCollisions)"
    Write-Host "Pixiu canonical suppression eligible: $($report.pixiuCanonicalSuppressionEligible)"
}
finally {
    Pop-Location
}
