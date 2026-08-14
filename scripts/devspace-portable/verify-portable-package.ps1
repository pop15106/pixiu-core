[CmdletBinding()]
param(
    [string]$PackageRoot = $PSScriptRoot
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$FilePath)
    return (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
}

$root = [System.IO.Path]::GetFullPath($PackageRoot)
$manifestPath = Join-Path $root 'PORTABLE-MANIFEST.json'
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    throw "Portable manifest is missing: $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ([int]$manifest.schemaVersion -ne 1) {
    throw 'Unsupported portable manifest schema version.'
}

$requiredPayload = @(
    '00-SETUP-OR-UPDATE.cmd',
    'devspace-oneclick.ps1',
    'DevSpace.WorkflowStore.mjs',
    'DevSpace.OneClick.Subagents.psm1',
    'verify-portable-package.ps1',
    'WORKFLOW.zh-TW.md'
)
$manifestFiles = @($manifest.files)
$byPath = @{}
foreach ($entry in $manifestFiles) {
    $relativePath = [string]$entry.path
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
        throw 'Portable manifest contains an empty path.'
    }
    if ([System.IO.Path]::IsPathRooted($relativePath) -or $relativePath -match '(^|[\\/])\.\.([\\/]|$)') {
        throw "Portable manifest contains an unsafe path: $relativePath"
    }
    if ($byPath.ContainsKey($relativePath)) {
        throw "Portable manifest contains a duplicate path: $relativePath"
    }
    $byPath[$relativePath] = $entry
}

foreach ($required in $requiredPayload) {
    if (-not $byPath.ContainsKey($required)) {
        throw "Portable manifest is missing required cross-session payload: $required"
    }
}

$rootPrefix = $root.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
foreach ($entry in $manifestFiles) {
    $relativePath = [string]$entry.path
    $target = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
    if (-not $target.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Portable payload escapes the package root: $relativePath"
    }
    if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
        throw "Portable payload file is missing: $relativePath"
    }
    $actualHash = Get-Sha256 -FilePath $target
    if (-not [string]::Equals($actualHash, [string]$entry.sha256, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Portable payload hash mismatch: $relativePath"
    }
    if ([int64](Get-Item -LiteralPath $target).Length -ne [int64]$entry.length) {
        throw "Portable payload length mismatch: $relativePath"
    }
}

$actualRelativePaths = @(Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object {
    -not [string]::Equals($_.FullName, $manifestPath, [System.StringComparison]::OrdinalIgnoreCase)
} | ForEach-Object {
    $_.FullName.Substring($rootPrefix.Length).Replace('\', '/')
})
$manifestRelativePaths = @($manifestFiles | ForEach-Object { ([string]$_.path).Replace('\', '/') })
$unexpected = @($actualRelativePaths | Where-Object { $_ -notin $manifestRelativePaths })
$missing = @($manifestRelativePaths | Where-Object { $_ -notin $actualRelativePaths })
if ($unexpected.Count -gt 0 -or $missing.Count -gt 0) {
    throw "Portable payload file set mismatch. Unexpected=$($unexpected -join ', '); Missing=$($missing -join ', ')"
}

Write-Host "Portable package verified: $($manifest.packageName) $($manifest.sourceCommit)" -ForegroundColor Green
