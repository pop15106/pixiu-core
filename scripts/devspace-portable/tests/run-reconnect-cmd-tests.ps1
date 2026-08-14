[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Passed = 0
$script:Failed = 0

function Assert-Equal {
    param($Actual, $Expected, [string]$Name)

    $actualItems = @($Actual)
    $expectedItems = @($Expected)
    $equal = $actualItems.Count -eq $expectedItems.Count
    if ($equal) {
        for ($index = 0; $index -lt $actualItems.Count; $index++) {
            if ($actualItems[$index] -ne $expectedItems[$index]) {
                $equal = $false
                break
            }
        }
    }

    if (-not $equal) {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
        Write-Host "  expected: $($expectedItems -join ', ')"
        Write-Host "  actual:   $($actualItems -join ', ')"
        $script:Failed++
        return
    }

    Write-Host "[PASS] $Name" -ForegroundColor Green
    $script:Passed++
}

function Invoke-ReconnectWrapper {
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)][string]$FakeBin,
        [Parameter(Mandatory = $true)][string]$LogPath,
        [int]$StopExit = 0,
        [int]$StartExit = 0,
        [int]$StatusExit = 0
    )

    if (Test-Path -LiteralPath $LogPath) {
        Remove-Item -LiteralPath $LogPath -Force
    }

    $previousPath = $env:PATH
    $previousNoPause = $env:DEVSPACE_ONECLICK_NO_PAUSE
    $previousNonInteractive = $env:DEVSPACE_ONECLICK_NONINTERACTIVE
    try {
        $env:PATH = $FakeBin + [System.IO.Path]::PathSeparator + $previousPath
        $env:DEVSPACE_ONECLICK_NO_PAUSE = '1'
        $env:DEVSPACE_ONECLICK_NONINTERACTIVE = $null
        $env:FAKE_POWERSHELL_LOG = $LogPath
        $env:FAKE_STOP_EXIT = [string]$StopExit
        $env:FAKE_START_EXIT = [string]$StartExit
        $env:FAKE_STATUS_EXIT = [string]$StatusExit

        $commandLine = 'call "{0}"' -f $ScriptPath
        $output = & $env:ComSpec /d /c $commandLine 2>&1
        $exitCode = $LASTEXITCODE
        $actions = if (Test-Path -LiteralPath $LogPath) {
            @(Get-Content -LiteralPath $LogPath | Where-Object { $_ })
        }
        else {
            @()
        }

        return [pscustomobject]@{
            ExitCode = $exitCode
            Actions = @($actions)
            Output = @($output)
        }
    }
    finally {
        $env:PATH = $previousPath
        $env:DEVSPACE_ONECLICK_NO_PAUSE = $previousNoPause
        $env:DEVSPACE_ONECLICK_NONINTERACTIVE = $previousNonInteractive
        Remove-Item Env:FAKE_POWERSHELL_LOG -ErrorAction SilentlyContinue
        Remove-Item Env:FAKE_STOP_EXIT -ErrorAction SilentlyContinue
        Remove-Item Env:FAKE_START_EXIT -ErrorAction SilentlyContinue
        Remove-Item Env:FAKE_STATUS_EXIT -ErrorAction SilentlyContinue
    }
}

$portableRoot = Split-Path -Parent $PSScriptRoot
$safeScript = Join-Path $portableRoot '14-RECONNECT-SAFE.cmd'
$forceScript = Join-Path $portableRoot '15-FORCE-RECONNECT.cmd'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("devspace-reconnect-tests-" + [guid]::NewGuid().ToString('N'))
$fakeBin = Join-Path $testRoot 'bin'
$logPath = Join-Path $testRoot 'powershell.log'

try {
    New-Item -ItemType Directory -Path $fakeBin -Force | Out-Null
    $fakePowerShell = @'
@echo off
>>"%FAKE_POWERSHELL_LOG%" echo %DEVSPACE_ONECLICK_NONINTERACTIVE%:%6
if /I "%6"=="stop" exit /b %FAKE_STOP_EXIT%
if /I "%6"=="start" exit /b %FAKE_START_EXIT%
if /I "%6"=="status" exit /b %FAKE_STATUS_EXIT%
exit /b 97
'@
    [System.IO.File]::WriteAllText(
        (Join-Path $fakeBin 'powershell.cmd'),
        $fakePowerShell,
        [System.Text.ASCIIEncoding]::new()
    )

    Assert-Equal (Test-Path -LiteralPath $safeScript) $true 'ships a safe reconnect CMD'
    Assert-Equal (Test-Path -LiteralPath $forceScript) $true 'ships a force reconnect CMD'

    if ((Test-Path -LiteralPath $safeScript) -and (Test-Path -LiteralPath $forceScript)) {
        $safeSuccess = Invoke-ReconnectWrapper -ScriptPath $safeScript -FakeBin $fakeBin -LogPath $logPath
        Assert-Equal $safeSuccess.Actions @('1:start', '1:status') 'safe reconnect starts missing components and verifies status'
        Assert-Equal $safeSuccess.ExitCode 0 'safe reconnect succeeds only after status succeeds'

        $safeStartFailure = Invoke-ReconnectWrapper -ScriptPath $safeScript -FakeBin $fakeBin -LogPath $logPath -StartExit 23
        Assert-Equal $safeStartFailure.Actions @('1:start') 'safe reconnect stops immediately when start fails'
        Assert-Equal $safeStartFailure.ExitCode 23 'safe reconnect preserves the start failure code'

        $safeStatusFailure = Invoke-ReconnectWrapper -ScriptPath $safeScript -FakeBin $fakeBin -LogPath $logPath -StatusExit 24
        Assert-Equal $safeStatusFailure.Actions @('1:start', '1:status') 'safe reconnect always verifies a successful start'
        Assert-Equal $safeStatusFailure.ExitCode 24 'safe reconnect preserves the status failure code'

        $forceSuccess = Invoke-ReconnectWrapper -ScriptPath $forceScript -FakeBin $fakeBin -LogPath $logPath
        Assert-Equal $forceSuccess.Actions @('1:stop', '1:start', '1:status') 'force reconnect stops, starts, and verifies in order'
        Assert-Equal $forceSuccess.ExitCode 0 'force reconnect succeeds only after status succeeds'

        $forceStopFailure = Invoke-ReconnectWrapper -ScriptPath $forceScript -FakeBin $fakeBin -LogPath $logPath -StopExit 31
        Assert-Equal $forceStopFailure.Actions @('1:stop') 'force reconnect does not start after an unsafe stop failure'
        Assert-Equal $forceStopFailure.ExitCode 31 'force reconnect preserves the stop failure code'

        $forceStartFailure = Invoke-ReconnectWrapper -ScriptPath $forceScript -FakeBin $fakeBin -LogPath $logPath -StartExit 32
        Assert-Equal $forceStartFailure.Actions @('1:stop', '1:start') 'force reconnect stops immediately when restart fails'
        Assert-Equal $forceStartFailure.ExitCode 32 'force reconnect preserves the restart failure code'
    }
}
finally {
    $resolvedTestRoot = [System.IO.Path]::GetFullPath($testRoot)
    $tempRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    if ($resolvedTestRoot.StartsWith($tempRoot, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $resolvedTestRoot)) {
        Remove-Item -LiteralPath $resolvedTestRoot -Recurse -Force
    }
}

Write-Host "Tests: $($script:Passed) passed, $($script:Failed) failed"
if ($script:Failed -gt 0) { exit 1 }
