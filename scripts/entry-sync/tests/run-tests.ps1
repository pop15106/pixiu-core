[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Passed = 0
$script:Failed = 0

function Assert-Equal {
    param($Actual, $Expected, [string]$Name)

    $actualJson = $Actual | ConvertTo-Json -Compress -Depth 10
    $expectedJson = $Expected | ConvertTo-Json -Compress -Depth 10
    if ($actualJson -ne $expectedJson) {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
        Write-Host "  expected: $expectedJson"
        Write-Host "  actual:   $actualJson"
        $script:Failed++
        return
    }

    Write-Host "[PASS] $Name" -ForegroundColor Green
    $script:Passed++
}

function Assert-True {
    param([bool]$Condition, [string]$Name)

    Assert-Equal -Actual $Condition -Expected $true -Name $Name
}

function Assert-Throws {
    param([scriptblock]$Action, [string]$Name)

    try {
        & $Action
        Write-Host "[FAIL] $Name (no exception)" -ForegroundColor Red
        $script:Failed++
    }
    catch {
        Write-Host "[PASS] $Name" -ForegroundColor Green
        $script:Passed++
    }
}

function New-TestCore {
    param([Parameter(Mandatory = $true)][string]$Root)

    foreach ($directory in @(
        'vault\bootstrap',
        'scripts\router',
        'scripts\codex-bridge',
        'skills',
        '.agent\workflows'
    )) {
        New-Item -ItemType Directory -Path (Join-Path $Root $directory) -Force | Out-Null
    }

    $files = @{
        'user_rules.md' = '# L0'
        'AGENTS.md' = '# Agent entry'
        'CODEX.md' = '# Codex entry'
        'CLAUDE.md' = '# Claude entry'
        'GEMINI.md' = '# Gemini entry'
        '.codex\AGENTS.md' = '# Codex project entry'
        'vault\bootstrap\SESSION-BOOTSTRAP.md' = '# Bootstrap'
        'scripts\router\resolve-capabilities.js' = 'console.log("ok");'
        'scripts\codex-bridge\pixiu-global-hook-bridge.js' = 'console.log("bridge");'
    }

    foreach ($relativePath in $files.Keys) {
        $target = Join-Path $Root $relativePath
        $parent = Split-Path -Parent $target
        if (-not (Test-Path -LiteralPath $parent)) {
            New-Item -ItemType Directory -Path $parent -Force | Out-Null
        }
        [System.IO.File]::WriteAllText($target, $files[$relativePath], [System.Text.UTF8Encoding]::new($false))
    }
}

function New-TestDevSpacePackage {
    param([Parameter(Mandatory = $true)][string]$Root)

    New-Item -ItemType Directory -Path (Join-Path $Root 'dist') -Force | Out-Null
    [System.IO.File]::WriteAllText(
        (Join-Path $Root 'package.json'),
        '{"version":"1.0.4"}',
        [System.Text.UTF8Encoding]::new($false)
    )
    [System.IO.File]::WriteAllText(
        (Join-Path $Root 'dist\skills.js'),
        'projectSkillMirrorSha256 SESSION-BOOTSTRAP.md canonicalEntries',
        [System.Text.UTF8Encoding]::new($false)
    )
    $manifest = [ordered]@{
        schemaVersion = 1
        devSpaceVersion = '1.0.4'
        files = @(
            @{ path = 'one' }, @{ path = 'two' }, @{ path = 'three' },
            @{ path = 'four' }, @{ path = 'five' }, @{ path = 'six' }
        )
    }
    [System.IO.File]::WriteAllText(
        (Join-Path $Root '.devspace-oneclick-patch-manifest.json'),
        ($manifest | ConvertTo-Json -Depth 5),
        [System.Text.UTF8Encoding]::new($false)
    )
}

$entrySyncRoot = Split-Path -Parent $PSScriptRoot
$modulePath = Join-Path $entrySyncRoot 'Pixiu.GlobalEntries.psm1'
Import-Module $modulePath -Force

foreach ($scriptName in @('Sync-PixiuGlobalEntries.ps1', 'Test-PixiuGlobalEntries.ps1', 'Test-PixiuLiveBindings.ps1')) {
    $scriptPath = Join-Path $entrySyncRoot $scriptName
    [void][scriptblock]::Create([System.IO.File]::ReadAllText($scriptPath))
    Assert-True (Test-Path -LiteralPath $scriptPath -PathType Leaf) "parses $scriptName under Windows PowerShell"
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("pixiu-entry-sync-tests-" + [guid]::NewGuid().ToString('N'))
$core = Join-Path $testRoot 'core'
$userProfile = Join-Path $testRoot 'user'
$backupRoot = Join-Path $testRoot 'backups'

try {
    New-Item -ItemType Directory -Path $core, $userProfile -Force | Out-Null
    New-TestCore -Root $core

    $definitions = @(Get-PixiuGlobalEntryDefinitions -CorePath $core -UserProfile $userProfile)
    Assert-Equal $definitions.Count 3 'defines exactly three managed global entries'
    Assert-Equal @($definitions.Name) @('codex', 'claude', 'gemini') 'defines Codex, Claude, and Gemini entries'

    foreach ($definition in $definitions) {
        Assert-True ($definition.Content.Contains('PIXIU-GLOBAL-ENTRY:1')) "adds managed marker for $($definition.Name)"
        Assert-True ($definition.Content.Contains('resolve-capabilities.js')) "routes $($definition.Name) through the capability router"
        Assert-Equal ($definition.Content -match 'founder-profile|agent-persona|memory-summary') $false "does not embed legacy full-load rules for $($definition.Name)"
    }

    $missingStatus = @(Test-PixiuGlobalEntries -CorePath $core -UserProfile $userProfile)
    Assert-Equal @($missingStatus.Status) @('Missing', 'Missing', 'Missing') 'reports missing global entries without modifying them'

    $legacyCodex = Join-Path $userProfile '.codex\AGENTS.md'
    New-Item -ItemType Directory -Path (Split-Path -Parent $legacyCodex) -Force | Out-Null
    [System.IO.File]::WriteAllText(
        $legacyCodex,
        'Read user_rules.md founder-profile.md agent-persona.md memory-summary.md ' + [char]0xFFFD,
        [System.Text.UTF8Encoding]::new($false)
    )
    $legacyStatus = @(Test-PixiuGlobalEntries -CorePath $core -UserProfile $userProfile | Where-Object Name -eq 'codex')
    Assert-Equal $legacyStatus[0].Status 'Drifted' 'detects a legacy Codex entry as drifted'
    Assert-True ($legacyStatus[0].Issues -contains 'legacy-full-load') 'flags legacy full-load instructions'
    Assert-True ($legacyStatus[0].Issues -contains 'replacement-character') 'flags visible encoding corruption'

    $applyResult = Install-PixiuGlobalEntries -CorePath $core -UserProfile $userProfile -BackupRoot $backupRoot
    Assert-Equal $applyResult.ChangedCount 3 'applies all three managed entries'
    Assert-True (Test-Path -LiteralPath $applyResult.BackupSetPath) 'creates a backup set'
    Assert-True (Test-Path -LiteralPath (Join-Path $applyResult.BackupSetPath 'manifest.json')) 'records a restore manifest'

    $currentStatus = @(Test-PixiuGlobalEntries -CorePath $core -UserProfile $userProfile)
    Assert-Equal @($currentStatus.Status) @('Current', 'Current', 'Current') 'reports applied entries as current'

    foreach ($definition in $definitions) {
        $bytes = [System.IO.File]::ReadAllBytes($definition.TargetPath)
        $hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
        Assert-Equal $hasBom $false "writes $($definition.Name) entry as UTF-8 without BOM"
        Assert-Equal ([System.IO.File]::ReadAllText($definition.TargetPath)) $definition.Content "reads back exact $($definition.Name) content"
    }

    $secondApply = Install-PixiuGlobalEntries -CorePath $core -UserProfile $userProfile -BackupRoot $backupRoot
    Assert-Equal $secondApply.ChangedCount 0 'is idempotent when all entries are current'
    Assert-Equal $secondApply.BackupSetPath $null 'does not create a backup set for an idempotent apply'

    $claudeTarget = ($definitions | Where-Object Name -eq 'claude').TargetPath
    [System.IO.File]::WriteAllText($claudeTarget, 'external drift', [System.Text.UTF8Encoding]::new($false))
    Assert-Throws {
        Restore-PixiuGlobalEntries -BackupSetPath $applyResult.BackupSetPath
    } 'restore refuses post-apply target drift before writing'
    Assert-Equal ([System.IO.File]::ReadAllText($claudeTarget)) 'external drift' 'drift refusal preserves the external change'

    [System.IO.File]::WriteAllText(
        $claudeTarget,
        ($definitions | Where-Object Name -eq 'claude').Content,
        [System.Text.UTF8Encoding]::new($false)
    )
    $restoreResult = Restore-PixiuGlobalEntries -BackupSetPath $applyResult.BackupSetPath
    Assert-Equal $restoreResult.RestoredCount 3 'restores the complete backup set'
    Assert-Equal ([System.IO.File]::ReadAllText($legacyCodex)) ('Read user_rules.md founder-profile.md agent-persona.md memory-summary.md ' + [char]0xFFFD) 'restores the original Codex entry'
    Assert-Equal (Test-Path -LiteralPath (Join-Path $userProfile '.claude\CLAUDE.md')) $false 'removes a generated Claude entry when no original existed'
    Assert-Equal (Test-Path -LiteralPath (Join-Path $userProfile '.gemini\GEMINI.md')) $false 'removes a generated Gemini entry when no original existed'

    $unsafeUser = Join-Path $testRoot 'unsafe-user'
    New-Item -ItemType Directory -Path (Join-Path $unsafeUser '.codex'), (Join-Path $unsafeUser 'junction-target') -Force | Out-Null
    New-Item -ItemType Junction -Path (Join-Path $unsafeUser '.codex\AGENTS.md') -Target (Join-Path $unsafeUser 'junction-target') | Out-Null
    Assert-Throws {
        Install-PixiuGlobalEntries -CorePath $core -UserProfile $unsafeUser -BackupRoot (Join-Path $testRoot 'unsafe-backups')
    } 'apply refuses a managed target that is a reparse point'
    Assert-Equal (Test-Path -LiteralPath (Join-Path $unsafeUser '.claude\CLAUDE.md')) $false 'reparse-point refusal happens before any other entry write'

    $bindingUser = Join-Path $testRoot 'binding-user'
    New-Item -ItemType Directory -Path $bindingUser, (Join-Path $bindingUser '.agents'), (Join-Path $bindingUser '.claude'), (Join-Path $bindingUser '.codex') -Force | Out-Null
    New-Item -ItemType Junction -Path (Join-Path $bindingUser '.pixiu-core') -Target $core | Out-Null
    New-Item -ItemType Junction -Path (Join-Path $bindingUser '.agents\skills') -Target (Join-Path $core 'skills') | Out-Null
    New-Item -ItemType Junction -Path (Join-Path $bindingUser '.claude\commands') -Target (Join-Path $core '.agent\workflows') | Out-Null

    $bridgeFixturePath = Join-Path $core 'scripts\codex-bridge\pixiu-global-hook-bridge.js'
    $hookCommand = 'node "' + $bridgeFixturePath + '" "session:start"'
    $hookCommandWindows = '"C:\Program Files\nodejs\node.exe" "' + $bridgeFixturePath + '" "session:start"'
    $hooks = [ordered]@{
        hooks = [ordered]@{
            SessionStart = @(@{ hooks = @(@{
                command = $hookCommand
                commandWindows = $hookCommandWindows
            }) })
        }
    }
    [System.IO.File]::WriteAllText(
        (Join-Path $bindingUser '.codex\hooks.json'),
        ($hooks | ConvertTo-Json -Depth 10),
        [System.Text.UTF8Encoding]::new($false)
    )

    $devSpaceRoot = Join-Path $testRoot 'devspace-package'
    New-TestDevSpacePackage -Root $devSpaceRoot
    $bindingStatus = @(Test-PixiuLiveBindings -CorePath $core -UserProfile $bindingUser -DevSpacePackageRoot $devSpaceRoot -PixiuCoreEnvironment $core -PixiuCorePathEnvironment $core)
    Assert-Equal @($bindingStatus.Status | Select-Object -Unique) @('Pass') 'passes a healthy junction, Hook, and DevSpace binding fixture'

    $hooks.hooks.SessionStart[0].hooks[0].commandWindows = 'C:\Program Files\nodejs\node.exe "' + $bridgeFixturePath + '" "session:start"'
    [System.IO.File]::WriteAllText(
        (Join-Path $bindingUser '.codex\hooks.json'),
        ($hooks | ConvertTo-Json -Depth 10),
        [System.Text.UTF8Encoding]::new($false)
    )
    $unquotedHookBinding = @(Test-PixiuLiveBindings -CorePath $core -UserProfile $bindingUser -DevSpacePackageRoot $devSpaceRoot -PixiuCoreEnvironment $core -PixiuCorePathEnvironment $core | Where-Object Name -eq 'codex-hook-bindings')
    Assert-Equal $unquotedHookBinding[0].Status 'Fail' 'reports an unquoted Windows Hook executable'

    $hooks.hooks.SessionStart[0].hooks[0].commandWindows = $hookCommandWindows
    [System.IO.File]::WriteAllText(
        (Join-Path $bindingUser '.codex\hooks.json'),
        ($hooks | ConvertTo-Json -Depth 10),
        [System.Text.UTF8Encoding]::new($false)
    )

    Remove-Item -LiteralPath (Join-Path $bindingUser '.agents\skills') -Force
    New-Item -ItemType Directory -Path (Join-Path $bindingUser 'wrong-skills') -Force | Out-Null
    New-Item -ItemType Junction -Path (Join-Path $bindingUser '.agents\skills') -Target (Join-Path $bindingUser 'wrong-skills') | Out-Null
    $brokenBinding = @(Test-PixiuLiveBindings -CorePath $core -UserProfile $bindingUser -DevSpacePackageRoot $devSpaceRoot -PixiuCoreEnvironment $core -PixiuCorePathEnvironment $core | Where-Object Name -eq 'agents-skills-junction')
    Assert-Equal $brokenBinding[0].Status 'Fail' 'reports an incorrect Skill junction without repairing it'
}
finally {
    Remove-Module Pixiu.GlobalEntries -ErrorAction SilentlyContinue
    $resolvedTestRoot = [System.IO.Path]::GetFullPath($testRoot)
    $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if ($resolvedTestRoot.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTestRoot)) {
        Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
    }
}

Write-Host "Tests: $($script:Passed) passed, $($script:Failed) failed"
if ($script:Failed -gt 0) { exit 1 }
