[CmdletBinding()]
param(
    [string]$OutputDirectory
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $PSScriptRoot 'dist'
}

function Ensure-Directory {
    param([Parameter(Mandatory = $true)][string]$Directory)
    if (-not (Test-Path -LiteralPath $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$FilePath)
    return (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
}

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
Ensure-Directory -Directory $outputRoot

$sourceCommit = 'unknown'
try {
    $candidate = (& git -C $repoRoot rev-parse --short=12 HEAD 2>$null | Out-String).Trim()
    if (-not [string]::IsNullOrWhiteSpace($candidate)) {
        $sourceCommit = $candidate
    }
}
catch {
}

$payloadFiles = @(
    '00-SETUP-OR-UPDATE.cmd',
    '01-INSTALL-AND-START.cmd',
    '02-ADD-FOLDER.cmd',
    '03-START.cmd',
    '04-STOP.cmd',
    '05-STATUS.cmd',
    '06-COPY-PASSWORD.cmd',
    '07-SUBAGENT-STATUS.cmd',
    '08-STOP-SUBAGENT.cmd',
    '09-REPAIR-STATE.cmd',
    '10-INSTALL-WATCHDOG.cmd',
    '11-WATCHDOG-STATUS.cmd',
    '12-RUN-WATCHDOG-NOW.cmd',
    '13-REMOVE-WATCHDOG.cmd',
    '14-RECONNECT-SAFE.cmd',
    '15-FORCE-RECONNECT.cmd',
    'START-CONNECTION.cmd',
    'DISCONNECT.cmd',
    'FORCE-RECONNECT.cmd',
    'QA-CHECK.cmd',
    'QUICK-GUIDE.txt',
    'QA-TROUBLESHOOTING.txt',
    'DevSpace.AgentAdmin.mjs',
    'DevSpace.OneClick.Core.psm1',
    'DevSpace.OneClick.Platform.psm1',
    'DevSpace.OneClick.Subagents.psm1',
    'DevSpace.WorkflowStore.mjs',
    'DevSpace.ProjectResolver.mjs',
    'devspace-oneclick.ps1',
    'devspace-watchdog.ps1',
    'verify-portable-package.ps1',
    'README.zh-TW.md',
    'WORKFLOW.zh-TW.md'
)

$forbiddenNames = @(
    'auth.json',
    'config.json',
    'settings.json',
    'runtime.json',
    'workflow-events.jsonl',
    'workflow-state.json'
)
foreach ($forbidden in $forbiddenNames) {
    if (Test-Path -LiteralPath (Join-Path $PSScriptRoot $forbidden)) {
        throw "Refusing to package local state or credentials: $forbidden"
    }
}

$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("pixiu-devspace-portable-" + [guid]::NewGuid().ToString('N'))
$packageRoot = Join-Path $temporaryRoot 'DevSpace-OneClick'
try {
    Ensure-Directory -Directory $packageRoot
    foreach ($relativePath in $payloadFiles) {
        $source = Join-Path $PSScriptRoot $relativePath
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) {
            throw "Portable payload source is missing: $relativePath"
        }
        Copy-Item -LiteralPath $source -Destination (Join-Path $packageRoot $relativePath) -Force
    }

    $workflowCoreSource = Join-Path $repoRoot 'external\session-workflow\packages\session-workflow\core\index.mjs'
    if (-not (Test-Path -LiteralPath $workflowCoreSource -PathType Leaf)) {
        throw "Portable workflow core source is missing: $workflowCoreSource"
    }
    Copy-Item -LiteralPath $workflowCoreSource -Destination (Join-Path $packageRoot 'SessionWorkflow.Core.mjs') -Force

    $agentTarget = Join-Path $packageRoot 'agents'
    Ensure-Directory -Directory $agentTarget
    foreach ($profile in @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'agents') -Filter '*.md' -File)) {
        Copy-Item -LiteralPath $profile.FullName -Destination (Join-Path $agentTarget $profile.Name) -Force
    }

    $packagePrefix = $packageRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    $manifestFiles = @(Get-ChildItem -LiteralPath $packageRoot -Recurse -File | Sort-Object FullName | ForEach-Object {
        [ordered]@{
            path = $_.FullName.Substring($packagePrefix.Length).Replace('\', '/')
            sha256 = Get-Sha256 -FilePath $_.FullName
            length = [int64]$_.Length
        }
    })

    $manifest = [ordered]@{
        schemaVersion = 1
        packageName = 'Pixiu DevSpace OneClick'
        sourceCommit = $sourceCommit
        builtAtUtc = [DateTime]::UtcNow.ToString('o')
        includesCrossSessionWorkflow = $true
        workflowModule = 'DevSpace.WorkflowStore.mjs'
        files = $manifestFiles
    }
    $manifestPath = Join-Path $packageRoot 'PORTABLE-MANIFEST.json'
    [System.IO.File]::WriteAllText(
        $manifestPath,
        ($manifest | ConvertTo-Json -Depth 6),
        [System.Text.UTF8Encoding]::new($false)
    )

    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $packageRoot 'verify-portable-package.ps1') -PackageRoot $packageRoot
    if ($LASTEXITCODE -ne 0) {
        throw 'Portable package verification failed before compression.'
    }

    $stamp = Get-Date -Format 'yyyyMMdd'
    $zipName = "DevSpace-OneClick-$stamp-$sourceCommit.zip"
    $zipPath = Join-Path $outputRoot $zipName
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    Compress-Archive -Path $packageRoot -DestinationPath $zipPath -CompressionLevel Optimal -Force

    Write-Host "Portable package created: $zipPath" -ForegroundColor Green
    Write-Host 'The ZIP contains cross-session/cross-project workflow support and no local Owner password, tunnel state, or ChatGPT token.'
    return $zipPath
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
