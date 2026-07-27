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

    node scripts/skills/validate-skill-metadata.js .agents/skills
    if ($LASTEXITCODE -ne 0) { throw 'Skill metadata validation failed.' }

    $report = node scripts/performance/measure-core-startup.js | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Startup measurement failed.' }

    if ($report.startupFilesBytes -gt 8192) {
        throw "Startup payload exceeds 8 KB: $($report.startupFilesBytes) bytes"
    }

    if ($report.yamlWarnings -ne 0) {
        throw "Skill YAML warnings remain: $($report.yamlWarnings)"
    }

    Write-Host 'PixiuCore lazy-loading verification passed.' -ForegroundColor Green
    Write-Host "Startup payload: $($report.startupFilesBytes) bytes / $($report.startupFilesLines) lines"
    Write-Host "Raw Skill package collisions: $($report.skillNameCollisions)"
    Write-Host "Effective Skill collisions: $($report.effectiveSkillNameCollisions)"
    Write-Host "Pixiu canonical suppression eligible: $($report.pixiuCanonicalSuppressionEligible)"
}
finally {
    Pop-Location
}
