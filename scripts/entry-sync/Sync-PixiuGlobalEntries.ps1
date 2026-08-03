[CmdletBinding()]
param(
    [ValidateSet('Check', 'Apply', 'Restore')]
    [string]$Action = 'Check',
    [string]$CorePath,
    [string]$UserProfile = $env:USERPROFILE,
    [string]$BackupRoot,
    [string]$BackupSetPath,
    [switch]$ConfirmApply,
    [switch]$ConfirmRestore,
    [switch]$AsJson
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'Pixiu.GlobalEntries.psm1') -Force

try {
    switch ($Action) {
        'Check' {
            $result = @(Test-PixiuGlobalEntries -CorePath $CorePath -UserProfile $UserProfile)
            if ($AsJson) {
                $result | ConvertTo-Json -Depth 8
            }
            else {
                $result | Select-Object Name, Status, TargetPath, @{ Name = 'Issues'; Expression = { $_.Issues -join ',' } } | Format-Table -AutoSize
            }
            if (@($result | Where-Object Status -ne 'Current').Count -gt 0) { exit 1 }
        }
        'Apply' {
            if (-not $ConfirmApply) {
                throw 'Apply requires -ConfirmApply because it writes user-level entry files.'
            }
            $result = Install-PixiuGlobalEntries -CorePath $CorePath -UserProfile $UserProfile -BackupRoot $BackupRoot
            if ($AsJson) { $result | ConvertTo-Json -Depth 8 } else { $result | Format-List }
        }
        'Restore' {
            if (-not $ConfirmRestore) {
                throw 'Restore requires -ConfirmRestore because it changes user-level entry files.'
            }
            if ([string]::IsNullOrWhiteSpace($BackupSetPath)) {
                throw 'Restore requires -BackupSetPath.'
            }
            $result = Restore-PixiuGlobalEntries -BackupSetPath $BackupSetPath
            if ($AsJson) { $result | ConvertTo-Json -Depth 8 } else { $result | Format-List }
        }
    }
}
finally {
    Remove-Module Pixiu.GlobalEntries -ErrorAction SilentlyContinue
}
