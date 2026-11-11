Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'Portable.Cleanup.psm1') -Force
$script:Passed = 0
function Assert-Cleanup {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "CLEANUP_TEST_FAILED: $Message" }
    $script:Passed++
    Write-Host "[PASS] $Message"
}
function New-CleanupFixture {
    $root = Join-Path ([System.IO.Path]::GetTempPath()) ('pixiu-devspace-portable-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $root | Out-Null
    return $root
}

$root = New-CleanupFixture
$result = Remove-PortableTemporaryDirectory -TemporaryRoot $root
Assert-Cleanup ($result.Removed -and $result.Attempts -eq 1) 'removes only the owned temporary directory'
$result = Remove-PortableTemporaryDirectory -TemporaryRoot $root
Assert-Cleanup ($result.Removed -and $result.Attempts -eq 0) 'missing temporary directory is an idempotent no-op'

$root = New-CleanupFixture
$locked = Join-Path $root 'held.txt'
$handle = [System.IO.File]::Open($locked, [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
$payload = [System.Text.Encoding]::UTF8.GetBytes('neutral cleanup fixture')
$handle.Write($payload, 0, $payload.Length)
$handle.Flush($true)
try {
    $result = Remove-PortableTemporaryDirectory -TemporaryRoot $root -MaxAttempts 2 -DelayMilliseconds 10
    Assert-Cleanup (-not $result.Removed -and $result.Attempts -eq 2 -and $result.Reason -eq 'RETAINED') 'locked file causes bounded retries and an explicit retained result'
    Assert-Cleanup (Test-Path -LiteralPath $locked) 'locked fixture is preserved'
    $observed = $null
    try {
        try { throw 'PRIMARY_BUILD_SENTINEL' }
        finally { $cleanup = Remove-PortableTemporaryDirectory -TemporaryRoot $root -MaxAttempts 1 }
    }
    catch { $observed = $_.Exception.Message }
    Assert-Cleanup ($observed -eq 'PRIMARY_BUILD_SENTINEL') 'cleanup error does not replace the primary build error'
}
finally { $handle.Dispose() }
$result = Remove-PortableTemporaryDirectory -TemporaryRoot $root
Assert-Cleanup $result.Removed 'cleanup can succeed after the file is released'

$unowned = Join-Path ([System.IO.Path]::GetTempPath()) ('pixiu-unowned-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $unowned | Out-Null
try {
    $result = Remove-PortableTemporaryDirectory -TemporaryRoot $unowned
    Assert-Cleanup (-not $result.Removed -and $result.Reason -eq 'CLEANUP_PATH_REFUSED') 'unrecognized directory is not deleted'
    Assert-Cleanup (Test-Path -LiteralPath $unowned) 'unrecognized directory remains intact'
}
finally { Remove-Item -LiteralPath $unowned -Force }

$root = New-CleanupFixture
$outside = New-CleanupFixture
$sentinel = Join-Path $outside 'sentinel.txt'
[System.IO.File]::WriteAllText($sentinel, 'neutral outside fixture')
$link = Join-Path $root 'linked'
try {
    New-Item -ItemType Junction -Path $link -Target $outside | Out-Null
    $result = Remove-PortableTemporaryDirectory -TemporaryRoot $root
    Assert-Cleanup (-not $result.Removed -and $result.Reason -eq 'CLEANUP_LINK_OR_LIMIT_REFUSED') 'junction is rejected before recursive cleanup'
    Assert-Cleanup ((Get-Content -LiteralPath $sentinel -Raw) -eq 'neutral outside fixture') 'junction target is unchanged'
}
finally {
    if (Test-Path -LiteralPath $link) { [System.IO.Directory]::Delete($link) }
    Remove-PortableTemporaryDirectory -TemporaryRoot $root | Out-Null
    Remove-PortableTemporaryDirectory -TemporaryRoot $outside | Out-Null
}

$builderText = [System.IO.File]::ReadAllText((Join-Path (Split-Path -Parent $PSScriptRoot) 'build-portable-package.ps1'))
Assert-Cleanup ($builderText.Contains('Remove-PortableTemporaryDirectory') -and $builderText.Contains('PORTABLE_CLEANUP_RETAINED')) 'builder uses bounded cleanup and reports retained paths'
Assert-Cleanup (-not $builderText.Contains('Remove-Item -LiteralPath $zipPath -Force')) 'builder preserves the previous ZIP until the new archive is complete'
Write-Host "Tests: $($script:Passed) passed, 0 failed"
