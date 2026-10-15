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
    '16-ENABLE-SAME-CHAT-REVIEWER.cmd',
    '17-DISABLE-SAME-CHAT-REVIEWER.cmd',
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
    'workflow-bundle.mjs',
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

    # 保留 runtime 相對目錄；在乾淨出包位置驗證實際 import。
    & node (Join-Path $PSScriptRoot 'workflow-bundle.mjs') assemble $repoRoot (Join-Path $packageRoot 'workflow-runtime')
    if ($LASTEXITCODE -ne 0) { throw 'WORKFLOW_BUNDLE_BUILD_FAILED' }
    & node (Join-Path $packageRoot 'workflow-bundle.mjs') verify (Join-Path $packageRoot 'workflow-runtime')
    if ($LASTEXITCODE -ne 0) { throw 'WORKFLOW_BUNDLE_IMPORT_FAILED' }

    $sameChatReviewerSourceRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\chat-reviewer'))
    foreach ($reviewerFile in @('SameChat.ReviewerTools.mjs', 'same-chat-reviewer.js')) {
        $reviewerSource = Join-Path $sameChatReviewerSourceRoot $reviewerFile
        if (-not (Test-Path -LiteralPath $reviewerSource -PathType Leaf)) {
            throw "Portable Same-Chat Reviewer source is missing: $reviewerSource"
        }
        Copy-Item -LiteralPath $reviewerSource -Destination (Join-Path $packageRoot $reviewerFile) -Force
    }

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
        workflowBundle = 'workflow-runtime/WORKFLOW-BUNDLE.json'
        workflowExecutionSchema = 'pixiu.cr-execution.v2'
        includesSameChatReviewer = $true
        sameChatReviewerToolsModule = 'SameChat.ReviewerTools.mjs'
        sameChatReviewerCoreModule = 'same-chat-reviewer.js'
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
    # 使用唯讀共享來源串流，避免 Compress-Archive 對剛完成 import 的檔案要求不必要的獨占存取。
    Add-Type -AssemblyName System.IO.Compression
    $archiveTemporary = "$zipPath.$([guid]::NewGuid().ToString('N')).tmp"
    $zipStream = [System.IO.File]::Open($archiveTemporary, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    $archive = [System.IO.Compression.ZipArchive]::new($zipStream, [System.IO.Compression.ZipArchiveMode]::Create, $false)
    try {
        foreach ($file in @(Get-ChildItem -LiteralPath $packageRoot -Recurse -File | Sort-Object FullName)) {
            $entryName = 'DevSpace-OneClick/' + $file.FullName.Substring($packagePrefix.Length).Replace('\', '/')
            $entry = $archive.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
            $destination = $entry.Open()
            $sourceStream = $null
            try {
                for ($attempt = 0; $attempt -lt 3; $attempt++) {
                    try {
                        $sourceStream = [System.IO.File]::Open($file.FullName, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
                        break
                    }
                    catch [System.IO.IOException] {
                        if ($attempt -eq 2) { throw }
                        Start-Sleep -Milliseconds 200
                    }
                }
                $sourceStream.CopyTo($destination)
            }
            finally {
                if ($null -ne $sourceStream) { $sourceStream.Dispose() }
                $destination.Dispose()
            }
        }
    }
    finally { $archive.Dispose(); $zipStream.Dispose() }
    Move-Item -LiteralPath $archiveTemporary -Destination $zipPath -Force

    Write-Host "Portable package created: $zipPath" -ForegroundColor Green
    Write-Host 'The ZIP contains cross-session/cross-project workflow support plus the opt-in Same-Chat Reviewer runtime, and no local Owner password, tunnel state, or ChatGPT token.'
    return $zipPath
}
finally {
    if (Test-Path -LiteralPath $temporaryRoot) {
        Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
    }
}
