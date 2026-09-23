Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$portableRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $portableRoot '..\..'))
Import-Module (Join-Path $portableRoot 'DevSpace.OneClick.Subagents.psm1') -Force

$script:Passed = 0
$script:Failed = 0

function Pass {
    param([string]$Name)
    $script:Passed++
    Write-Host "[PASS] $Name" -ForegroundColor Green
}

function Fail {
    param([string]$Name, [string]$Message)
    $script:Failed++
    Write-Host "[FAIL] $Name :: $Message" -ForegroundColor Red
}

function Check {
    param([scriptblock]$Action, [string]$Name)
    try {
        & $Action
        Pass $Name
    }
    catch {
        Fail $Name $_.Exception.Message
    }
}

function Assert-True {
    param([bool]$Value, [string]$Message)
    if (-not $Value) { throw $Message }
}

function Assert-Equal {
    param($Actual, $Expected, [string]$Message)
    if ($Actual -ne $Expected) {
        throw "$Message Expected=[$Expected] Actual=[$Actual]"
    }
}

function Get-Sha256 {
    param([string]$FilePath)
    return (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
}

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("same-chat-reviewer-runtime-" + [guid]::NewGuid().ToString('N'))
$binRoot = Join-Path $testRoot 'bin'
$sourceRoot = Join-Path $testRoot 'source'
New-Item -ItemType Directory -Path $binRoot, $sourceRoot -Force | Out-Null

try {
    $reviewerSourceRoot = Join-Path $repoRoot 'scripts\chat-reviewer'
    $toolsSource = Join-Path $sourceRoot 'SameChat.ReviewerTools.mjs'
    $coreSource = Join-Path $sourceRoot 'same-chat-reviewer.js'
    Copy-Item -LiteralPath (Join-Path $reviewerSourceRoot 'SameChat.ReviewerTools.mjs') -Destination $toolsSource
    Copy-Item -LiteralPath (Join-Path $reviewerSourceRoot 'same-chat-reviewer.js') -Destination $coreSource

    Check {
        $result = Install-DevSpaceSameChatReviewerBundle -ToolsSourceFile $toolsSource -CoreSourceFile $coreSource -BinDirectory $binRoot
        Assert-Equal $result.Changed $true 'first bundle install must report changed'
        Assert-True (Test-Path -LiteralPath $result.Path -PathType Leaf) 'tools module was not deployed'
        Assert-True (Test-Path -LiteralPath $result.CorePath -PathType Leaf) 'core module was not deployed'
        Assert-Equal (Get-Sha256 $result.Path) (Get-Sha256 $toolsSource) 'tools hash mismatch'
        Assert-Equal (Get-Sha256 $result.CorePath) (Get-Sha256 $coreSource) 'core hash mismatch'
    } 'installs the Same-Chat Reviewer bundle with matching hashes'

    Check {
        $result = Install-DevSpaceSameChatReviewerBundle -ToolsSourceFile $toolsSource -CoreSourceFile $coreSource -BinDirectory $binRoot
        Assert-Equal $result.Changed $false 'identical reinstall must be idempotent'
    } 'reinstall is idempotent'

    Check {
        [System.IO.File]::AppendAllText($coreSource, [Environment]::NewLine + '// runtime test upgrade', [System.Text.UTF8Encoding]::new($false))
        $result = Install-DevSpaceSameChatReviewerBundle -ToolsSourceFile $toolsSource -CoreSourceFile $coreSource -BinDirectory $binRoot
        Assert-Equal $result.Changed $true 'changed core source must trigger bundle replacement'
        Assert-Equal (Get-Sha256 $result.CorePath) (Get-Sha256 $coreSource) 'upgraded core hash mismatch'
    } 'bundle update replaces the pair safely'

    Check {
        $missing = Join-Path $sourceRoot 'missing.js'
        $caught = $false
        try {
            [void](Install-DevSpaceSameChatReviewerBundle -ToolsSourceFile $toolsSource -CoreSourceFile $missing -BinDirectory $binRoot)
        }
        catch {
            $caught = $_.Exception.Message -match 'SAME_CHAT_REVIEWER_SOURCE_MISSING'
        }
        Assert-True $caught 'missing dependency was not rejected'
    } 'missing reviewer dependency fails closed'

    Check {
        $invalidTools = Join-Path $sourceRoot 'invalid-tools.mjs'
        [System.IO.File]::WriteAllText($invalidTools, 'export const invalid = true;', [System.Text.UTF8Encoding]::new($false))
        $caught = $false
        try {
            [void](Install-DevSpaceSameChatReviewerBundle -ToolsSourceFile $invalidTools -CoreSourceFile $coreSource -BinDirectory $binRoot)
        }
        catch {
            $caught = $_.Exception.Message -match 'SAME_CHAT_REVIEWER_DEPENDENCY_INVALID'
        }
        Assert-True $caught 'invalid relative dependency was not rejected'
    } 'reviewer tools must declare the expected core dependency'

    Check {
        $packageRoot = Join-Path $testRoot 'devspace-108'
        $dist = Join-Path $packageRoot 'dist'
        New-Item -ItemType Directory -Path $dist -Force | Out-Null
        [System.IO.File]::WriteAllText(
            (Join-Path $packageRoot 'package.json'),
            '{"version":"1.0.8","type":"module"}',
            [System.Text.UTF8Encoding]::new($false)
        )
        $cliPath = Join-Path $dist 'cli.js'
        [System.IO.File]::WriteAllText($cliPath, '// fake cli', [System.Text.UTF8Encoding]::new($false))

        $baseServer = @(
            'import { fileURLToPath } from "node:url";'
            'import { buildLocalAgentCatalog, buildLocalAgentProviderStatuses, formatLocalAgentProviderStatusSummary, } from "./local-agent-catalog.js";'
            'function registerAll() {'
            '    if (config.toolMode === "codex") {'
            '        registerCodexProcessTools(server, config, workspaces, processSessions);'
            '    }'
            '}'
        ) -join [Environment]::NewLine

        $oldPatchedServer = @(
            'import { fileURLToPath, pathToFileURL } from "node:url";'
            'import { buildLocalAgentCatalog, buildLocalAgentProviderStatuses, formatLocalAgentProviderStatusSummary, } from "./local-agent-catalog.js";'
            'const devSpaceWorkflowModule = process.env.DEVSPACE_WORKFLOW_MODULE'
            '    ? await import(pathToFileURL(process.env.DEVSPACE_WORKFLOW_MODULE).href)'
            '    : undefined;'
            'function registerAll() {'
            '    // DevSpace OneClick: expose resumable process sessions to ChatGPT Web.'
            '    registerCodexProcessTools(server, config, workspaces, processSessions);'
            '    // DevSpace OneClick: expose durable cross-session handoff and review tools.'
            '    devSpaceWorkflowModule?.registerDevSpaceWorkflowTools({'
            '        server, config, workspaces, registerAppTool, z,'
            '    });'
            '}'
        ) -join [Environment]::NewLine

        $serverPath = Join-Path $dist 'server.js'
        $backupPath = "$serverPath.devspace-oneclick-1.0.8-original"
        [System.IO.File]::WriteAllText($backupPath, $baseServer, [System.Text.UTF8Encoding]::new($false))
        [System.IO.File]::WriteAllText($serverPath, $oldPatchedServer, [System.Text.UTF8Encoding]::new($false))
        $manifestPath = Join-Path $packageRoot '.devspace-oneclick-patch-1.0.8.json'
        $manifest = [ordered]@{
            schemaVersion = 1
            devSpaceVersion = '1.0.8'
            file = 'dist\server.js'
            backupSha256 = Get-Sha256 $backupPath
            patchedSha256 = Get-Sha256 $serverPath
        }
        [System.IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4), [System.Text.UTF8Encoding]::new($false))

        $changed = Install-DevSpaceSubagentWindowsPatch -DevSpaceCli $cliPath
        Assert-True ($changed -ge 2) 'old 1.0.8 patch was not upgraded'
        $updated = [System.IO.File]::ReadAllText($serverPath)
        Assert-True $updated.Contains('const sameChatReviewerEnabled = process.env.DEVSPACE_SAME_CHAT_REVIEWER_ENABLED === "1";') '1.0.8 loader missing'
        Assert-True $updated.Contains('Pixiu experimental: register Same-Chat advisory reviewer tools only when explicitly enabled.') '1.0.8 registration missing'
        $updatedManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert-Equal ([string]$updatedManifest.backupSha256) (Get-Sha256 $backupPath) 'backup hash changed during upgrade'
        Assert-Equal ([string]$updatedManifest.patchedSha256) (Get-Sha256 $serverPath) 'manifest did not track upgraded patch'
    } 'upgrades a known DevSpace 1.0.8 patch to Same-Chat registration'

    Check {
        $launcher = [System.IO.File]::ReadAllText((Join-Path $portableRoot 'devspace-oneclick.ps1'))
        foreach ($needle in @(
            'Install-DevSpaceSameChatReviewerBundle',
            'DEVSPACE_SAME_CHAT_REVIEWER_ENABLED',
            'DEVSPACE_SAME_CHAT_REVIEWER_MODULE',
            'DEVSPACE_SAME_CHAT_REVIEWER_STATE_DIR',
            "SetEnvironmentVariable('DEVSPACE_WIDGETS', $(if ($Spec.SameChatReviewerEnabled) { 'on' } else { 'off' }), 'Process')",
            'enable-same-chat-reviewer',
            'disable-same-chat-reviewer',
            'sameChatReviewerEnabled'
        )) {
            Assert-True $launcher.Contains($needle) "OneClick launcher missing $needle"
        }
    } 'OneClick wires the feature flag, module, state directory, and toggle actions'

    Check {
        $patchModule = [System.IO.File]::ReadAllText((Join-Path $portableRoot 'DevSpace.OneClick.Subagents.psm1'))
        Assert-True $patchModule.Contains('const sameChatReviewerEnabled = process.env.DEVSPACE_SAME_CHAT_REVIEWER_ENABLED === "1";') 'server loader patch missing'
        Assert-True $patchModule.Contains('registerSameChatReviewerTools') 'server registration patch missing'
    } 'server patch contains conditional Same-Chat loader and registration'
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host ""
Write-Host "Same-Chat Reviewer runtime tests: $script:Passed passed, $script:Failed failed."
if ($script:Failed -gt 0) {
    exit 1
}
exit 0
