Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Passed = 0
$script:Failed = 0

function Assert-True {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )
    if ($Condition) {
        $script:Passed++
        Write-Host "[PASS] $Message"
        return
    }
    $script:Failed++
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

$portableRoot = Split-Path -Parent $PSScriptRoot
$builder = Join-Path $portableRoot 'build-portable-package.ps1'
$verifier = Join-Path $portableRoot 'verify-portable-package.ps1'
$launcher = Join-Path $portableRoot '00-SETUP-OR-UPDATE.cmd'
$startConnection = Join-Path $portableRoot 'START-CONNECTION.cmd'
$disconnect = Join-Path $portableRoot 'DISCONNECT.cmd'
$forceReconnect = Join-Path $portableRoot 'FORCE-RECONNECT.cmd'
$qaCheck = Join-Path $portableRoot 'QA-CHECK.cmd'
$quickGuide = Join-Path $portableRoot 'QUICK-GUIDE.txt'
$qaGuide = Join-Path $portableRoot 'QA-TROUBLESHOOTING.txt'
$oneClick = Join-Path $portableRoot 'devspace-oneclick.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("devspace-portable-package-test-" + [guid]::NewGuid().ToString('N'))
$outputRoot = Join-Path $testRoot 'out'
$extractRoot = Join-Path $testRoot ('extract with spaces ' + [char]0x4E2D + [char]0x6587)

try {
    New-Item -ItemType Directory -Path $outputRoot, $extractRoot -Force | Out-Null

    Assert-True (Test-Path -LiteralPath $launcher -PathType Leaf) 'ships the setup-or-update launcher'
    Assert-True ((Test-Path -LiteralPath $startConnection -PathType Leaf) -and (Test-Path -LiteralPath $disconnect -PathType Leaf) -and (Test-Path -LiteralPath $forceReconnect -PathType Leaf)) 'ships friendly start, disconnect, and force-reconnect launchers'
    Assert-True ((Test-Path -LiteralPath $qaCheck -PathType Leaf) -and (Test-Path -LiteralPath $quickGuide -PathType Leaf) -and (Test-Path -LiteralPath $qaGuide -PathType Leaf)) 'ships QA check and beginner troubleshooting guides'
    $forceReconnectText = [System.IO.File]::ReadAllText($forceReconnect)
    Assert-True $forceReconnectText.Contains('15-FORCE-RECONNECT.cmd') 'friendly force-reconnect delegates to the verified reconnect flow'
    $qaCheckText = [System.IO.File]::ReadAllText($qaCheck)
    Assert-True ($qaCheckText.Contains('09-REPAIR-STATE.cmd') -and $qaCheckText.Contains('Refresh the DevSpace App actions')) 'QA check prints the bounded troubleshooting order'
    $qaGuideText = [System.IO.File]::ReadAllText($qaGuide)
    Assert-True ($qaGuideText.Contains('Owner password') -and $qaGuideText.Contains('ChatGPT OAuth token') -and $qaGuideText.Contains('Telegram Bot Token')) 'QA guide warns users not to disclose secrets'
    $builderText = [System.IO.File]::ReadAllText($builder)
    Assert-True ($builderText.Contains("[string]`$OutputDirectory") -and $builderText.Contains("Join-Path `$PSScriptRoot 'dist'")) 'portable builder resolves its default output after PSScriptRoot is available'
    $launcherText = [System.IO.File]::ReadAllText($launcher)
    Assert-True ($launcherText.Contains('PORTABLE-MANIFEST.json') -and $launcherText.Contains('setup-or-update')) 'launcher verifies release packages and calls the unified setup/update action'
    Assert-True ($launcherText.Contains('-IntegrityOnly') -and $launcherText.Contains('if errorlevel 1 goto :failed')) 'bootstrap uses integrity-only verification and preserves a failing exit code'

    $oneClickText = [System.IO.File]::ReadAllText($oneClick)
    Assert-True $oneClickText.Contains("'setup-or-update'") 'OneClick exposes the unified setup/update action'
    Assert-True $oneClickText.Contains('Preserving local identity and updating the portable runtime.') 'update path preserves existing local identity'
    Assert-True $oneClickText.Contains('A partial OneClick setup was detected.') 'partial local setup fails closed'
    Assert-True $oneClickText.Contains('Cross-session and cross-project workflow tools are included.') 'ready output confirms cross-session payload inclusion'

    $zipOutput = @(& powershell -NoProfile -ExecutionPolicy Bypass -File $builder -OutputDirectory $outputRoot 2>&1)
    $buildExitCode = $LASTEXITCODE
    if ($buildExitCode -ne 0) {
        Write-Host ($zipOutput -join [Environment]::NewLine)
    }
    Assert-True ($buildExitCode -eq 0) 'portable builder completes successfully'

    $zip = Get-ChildItem -LiteralPath $outputRoot -Filter 'DevSpace-OneClick-*.zip' -File | Select-Object -First 1
    Assert-True ($null -ne $zip) 'portable builder creates a versioned ZIP'
    if ($zip) {
        Expand-Archive -LiteralPath $zip.FullName -DestinationPath $extractRoot -Force
        $packageRoot = Join-Path $extractRoot 'DevSpace-OneClick'
        $manifestPath = Join-Path $packageRoot 'PORTABLE-MANIFEST.json'
        Assert-True (Test-Path -LiteralPath $manifestPath -PathType Leaf) 'release ZIP contains the integrity manifest'
        Assert-True (Test-Path -LiteralPath (Join-Path $packageRoot 'DevSpace.WorkflowStore.mjs') -PathType Leaf) 'release ZIP contains the cross-session workflow module'
        Assert-True (Test-Path -LiteralPath (Join-Path $packageRoot 'WORKFLOW.zh-TW.md') -PathType Leaf) 'release ZIP contains cross-session usage documentation'
        Assert-True ((Test-Path -LiteralPath (Join-Path $packageRoot 'START-CONNECTION.cmd') -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path $packageRoot 'DISCONNECT.cmd') -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path $packageRoot 'FORCE-RECONNECT.cmd') -PathType Leaf)) 'release ZIP contains friendly connection controls'
        Assert-True ((Test-Path -LiteralPath (Join-Path $packageRoot 'QA-CHECK.cmd') -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path $packageRoot 'QUICK-GUIDE.txt') -PathType Leaf) -and (Test-Path -LiteralPath (Join-Path $packageRoot 'QA-TROUBLESHOOTING.txt') -PathType Leaf)) 'release ZIP contains QA guidance'

        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert-True ($manifest.includesCrossSessionWorkflow -eq $true) 'manifest explicitly declares cross-session workflow support'
        $manifestPaths = @($manifest.files | ForEach-Object { [string]$_.path })
        Assert-True ($manifestPaths -contains 'DevSpace.WorkflowStore.mjs') 'manifest hashes the workflow module'
        Assert-True (-not ($manifestPaths -match '(^|/)(auth|config|settings|runtime)\.json$')) 'manifest excludes local identity and runtime state files'
        Assert-True (-not ($manifestPaths -match '^tests/')) 'release ZIP excludes repository test fixtures'

        & powershell -NoProfile -ExecutionPolicy Bypass -File $verifier -PackageRoot $packageRoot | Out-Null
        Assert-True ($LASTEXITCODE -eq 0) 'extracted release passes SHA-256 verification'

        $extractedVerifier = Join-Path $packageRoot 'verify-portable-package.ps1'
        & powershell -NoProfile -ExecutionPolicy Bypass -File $extractedVerifier | Out-Null
        Assert-True ($LASTEXITCODE -eq 0) 'extracted verifier resolves its own script directory without -PackageRoot'

        $verifyCommand = '"' + (Join-Path $PSHOME 'powershell.exe') + '" -NoProfile -ExecutionPolicy Bypass -File "' + $extractedVerifier + '" -PackageRoot "' + (Join-Path $packageRoot '.') + '" -IntegrityOnly'
        & $env:ComSpec /d /c $verifyCommand | Out-Null
        Assert-True ($LASTEXITCODE -eq 0) 'real CMD forwards an explicit package root containing spaces and Unicode'

        $stubRoot = Join-Path $testRoot 'powershell-shim'
        New-Item -ItemType Directory -Path $stubRoot -Force | Out-Null
        $stubPath = Join-Path $stubRoot 'powershell.exe'
        $stubContent = @'
using System;
using System.IO;

public class PortablePackagePowerShellShim {
    public static int Main(string[] args) {
        string logPath = Environment.GetEnvironmentVariable("ONECLICK_TEST_LOG");
        if (!String.IsNullOrEmpty(logPath)) {
            File.AppendAllText(logPath, String.Join(" ", args) + Environment.NewLine);
        }
        foreach (string arg in args) {
            if (arg != null && arg.EndsWith("verify-portable-package.ps1", StringComparison.OrdinalIgnoreCase)) {
                int code;
                if (Int32.TryParse(Environment.GetEnvironmentVariable("ONECLICK_TEST_VERIFY_EXIT"), out code)) {
                    return code;
                }
                return 1;
            }
        }
        return 0;
    }
}
'@
        Add-Type -TypeDefinition $stubContent -OutputType ConsoleApplication -OutputAssembly $stubPath
        $originalPath = $env:PATH
        $originalLog = [Environment]::GetEnvironmentVariable('ONECLICK_TEST_LOG', 'Process')
        $originalVerifyExit = [Environment]::GetEnvironmentVariable('ONECLICK_TEST_VERIFY_EXIT', 'Process')
        $launchCommand = 'call "' + (Join-Path $packageRoot '00-SETUP-OR-UPDATE.cmd') + '" <NUL'
        try {
            $env:PATH = "$stubRoot;$originalPath"

            $blockedLogPath = Join-Path $testRoot 'launcher-blocked.log'
            $env:ONECLICK_TEST_LOG = $blockedLogPath
            $env:ONECLICK_TEST_VERIFY_EXIT = '27'
            & $env:ComSpec /d /c $launchCommand | Out-Null
            $blockedExit = $LASTEXITCODE
            $blockedLog = if (Test-Path -LiteralPath $blockedLogPath) { @(Get-Content -LiteralPath $blockedLogPath) } else { @() }
            $blockedVerifierCalls = @($blockedLog | Where-Object { $_ -like '*verify-portable-package.ps1*' })
            $blockedInstallCalls = @($blockedLog | Where-Object { $_ -like '*devspace-oneclick.ps1*' })
            Assert-True ($blockedExit -ne 0 -and $blockedVerifierCalls.Count -eq 1 -and $blockedInstallCalls.Count -eq 0) 'CMD refuses to install when package verification fails'
            Assert-True ($blockedVerifierCalls.Count -eq 1 -and $blockedVerifierCalls[0].Contains('-PackageRoot')) 'CMD supplies the package root to the verifier'

            $successLogPath = Join-Path $testRoot 'launcher-success.log'
            $env:ONECLICK_TEST_LOG = $successLogPath
            $env:ONECLICK_TEST_VERIFY_EXIT = '0'
            & $env:ComSpec /d /c $launchCommand | Out-Null
            $successExit = $LASTEXITCODE
            $successLog = if (Test-Path -LiteralPath $successLogPath) { @(Get-Content -LiteralPath $successLogPath) } else { @() }
            $successVerifierCalls = @($successLog | Where-Object { $_ -like '*verify-portable-package.ps1*' })
            $successInstallCalls = @($successLog | Where-Object { $_ -like '*devspace-oneclick.ps1*' })
            Assert-True ($successExit -eq 0 -and $successVerifierCalls.Count -eq 1 -and $successInstallCalls.Count -eq 1) 'CMD installs only after successful verification'
        }
        finally {
            $env:PATH = $originalPath
            [Environment]::SetEnvironmentVariable('ONECLICK_TEST_LOG', $originalLog, 'Process')
            [Environment]::SetEnvironmentVariable('ONECLICK_TEST_VERIFY_EXIT', $originalVerifyExit, 'Process')
        }

        # 在沒有 Node 搜尋路徑的子程序中驗證首次安裝前檢，不修改系統 PATH。
        $originalPath = $env:PATH
        try {
            $env:PATH = "$env:SystemRoot\System32"
            & (Join-Path $PSHOME 'powershell.exe') -NoProfile -ExecutionPolicy Bypass -File $verifier -PackageRoot $packageRoot -IntegrityOnly | Out-Null
            Assert-True ($LASTEXITCODE -eq 0) 'pre-bootstrap integrity works without Node on PATH'
        }
        finally { $env:PATH = $originalPath }

        $fixtureBin = Join-Path $testRoot 'fixture-bin'
        New-Item -ItemType Directory -Path $fixtureBin -Force | Out-Null
        $previousModule = 'export const fixturePrevious = true;'
        [System.IO.File]::WriteAllText((Join-Path $fixtureBin 'DevSpace.WorkflowStore.mjs'), $previousModule)
        [System.IO.File]::WriteAllText((Join-Path $fixtureBin 'workflow-state.json'), 'neutral-ledger-sentinel')
        Import-Module (Join-Path $packageRoot 'DevSpace.OneClick.Subagents.psm1') -Force
        $installed = Install-DevSpaceWorkflowModule -SourceFile (Join-Path $packageRoot 'DevSpace.WorkflowStore.mjs') -BinDirectory $fixtureBin
        Assert-True ($installed.Changed -eq $true -and $installed.executionSchema -eq 'pixiu.cr-execution.v2') 'PowerShell installer deploys the complete verified v2 bundle'
        Assert-True ([System.IO.File]::ReadAllText($installed.Path).Contains('workflow-releases/')) 'installed entry points into the immutable dependency bundle'
        $reinstalled = Install-DevSpaceWorkflowModule -SourceFile (Join-Path $packageRoot 'DevSpace.WorkflowStore.mjs') -BinDirectory $fixtureBin
        Assert-True ($reinstalled.Changed -eq $false) 'PowerShell bundle reinstall is idempotent'
        & node (Join-Path $packageRoot 'workflow-bundle.mjs') rollback $fixtureBin $installed.receiptId | Out-Null
        Assert-True ($LASTEXITCODE -eq 0 -and [System.IO.File]::ReadAllText($installed.Path) -eq $previousModule) 'bundle rollback restores the exact previous entry'
        Assert-True ([System.IO.File]::ReadAllText((Join-Path $fixtureBin 'workflow-state.json')) -eq 'neutral-ledger-sentinel') 'upgrade and rollback preserve the existing ledger'

        [System.IO.File]::AppendAllText(
            (Join-Path $packageRoot 'DevSpace.WorkflowStore.mjs'),
            "// tamper-test`n",
            [System.Text.UTF8Encoding]::new($false)
        )
        $previousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = 'Continue'
            & powershell -NoProfile -ExecutionPolicy Bypass -File $verifier -PackageRoot $packageRoot *> $null
            $tamperExitCode = $LASTEXITCODE
        }
        finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }
        Assert-True ($tamperExitCode -ne 0) 'workflow module tampering is rejected'
    }
}
catch {
    Write-Host ('PRIMARY_TEST_ERROR: ' + $_.Exception.GetType().FullName + ': ' + $_.Exception.Message)
    throw
}
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host "Tests: $($script:Passed) passed, $($script:Failed) failed"
if ($script:Failed -gt 0) {
    exit 1
}
