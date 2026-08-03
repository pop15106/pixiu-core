[CmdletBinding()]
param(
    [string]$CorePath,
    [string]$UserProfile = $env:USERPROFILE,
    [string]$DevSpacePackageRoot,
    [switch]$AsJson,
    [switch]$FailOnWarning
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'Pixiu.GlobalEntries.psm1') -Force

try {
    if ([string]::IsNullOrWhiteSpace($DevSpacePackageRoot) -and -not [string]::IsNullOrWhiteSpace($env:APPDATA)) {
        $candidate = Join-Path $env:APPDATA 'npm\node_modules\@waishnav\devspace'
        if (Test-Path -LiteralPath $candidate -PathType Container) {
            $DevSpacePackageRoot = $candidate
        }
    }

    $result = @(Test-PixiuLiveBindings -CorePath $CorePath -UserProfile $UserProfile -DevSpacePackageRoot $DevSpacePackageRoot)
    if ($AsJson) {
        $result | ConvertTo-Json -Depth 8
    }
    else {
        $result | Select-Object Name, Status, Expected, Actual, Detail | Format-Table -AutoSize -Wrap
    }

    if (@($result | Where-Object Status -eq 'Fail').Count -gt 0) { exit 1 }
    if ($FailOnWarning -and @($result | Where-Object Status -eq 'Warn').Count -gt 0) { exit 2 }
}
finally {
    Remove-Module Pixiu.GlobalEntries -ErrorAction SilentlyContinue
}
