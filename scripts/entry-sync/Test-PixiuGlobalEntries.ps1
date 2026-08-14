[CmdletBinding()]
param(
    [string]$CorePath,
    [string]$UserProfile = $env:USERPROFILE,
    [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'Pixiu.GlobalEntries.psm1') -Force

try {
    $result = @(Test-PixiuGlobalEntries -CorePath $CorePath -UserProfile $UserProfile)
    if ($AsJson) {
        $result | ConvertTo-Json -Depth 8
    }
    else {
        $result | Select-Object Name, Status, TargetPath, @{ Name = 'Issues'; Expression = { $_.Issues -join ',' } } | Format-Table -AutoSize
    }
    if (@($result | Where-Object Status -ne 'Current').Count -gt 0) { exit 1 }
}
finally {
    Remove-Module Pixiu.GlobalEntries -ErrorAction SilentlyContinue
}
