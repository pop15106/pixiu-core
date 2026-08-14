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
$oneClick = Join-Path $portableRoot 'devspace-oneclick.ps1'
$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("devspace-portable-package-test-" + [guid]::NewGuid().ToString('N'))
$outputRoot = Join-Path $testRoot 'out'
$extractRoot = Join-Path $testRoot 'extract'

try {
    New-Item -ItemType Directory -Path $outputRoot, $extractRoot -Force | Out-Null

    Assert-True (Test-Path -LiteralPath $launcher -PathType Leaf) 'ships the setup-or-update launcher'
    $builderText = [System.IO.File]::ReadAllText($builder)
    Assert-True ($builderText.Contains("[string]`$OutputDirectory") -and $builderText.Contains("Join-Path `$PSScriptRoot 'dist'")) 'portable builder resolves its default output after PSScriptRoot is available'
    $launcherText = [System.IO.File]::ReadAllText($launcher)
    Assert-True ($launcherText.Contains('PORTABLE-MANIFEST.json') -and $launcherText.Contains('setup-or-update')) 'launcher verifies release packages and calls the unified setup/update action'

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

        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
        Assert-True ($manifest.includesCrossSessionWorkflow -eq $true) 'manifest explicitly declares cross-session workflow support'
        $manifestPaths = @($manifest.files | ForEach-Object { [string]$_.path })
        Assert-True ($manifestPaths -contains 'DevSpace.WorkflowStore.mjs') 'manifest hashes the workflow module'
        Assert-True (-not ($manifestPaths -match '(^|/)(auth|config|settings|runtime)\.json$')) 'manifest excludes local identity and runtime state files'
        Assert-True (-not ($manifestPaths -match '^tests/')) 'release ZIP excludes repository test fixtures'

        & powershell -NoProfile -ExecutionPolicy Bypass -File $verifier -PackageRoot $packageRoot | Out-Null
        Assert-True ($LASTEXITCODE -eq 0) 'extracted release passes SHA-256 verification'

        Add-Content -LiteralPath (Join-Path $packageRoot 'DevSpace.WorkflowStore.mjs') -Value '// tamper-test'
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
finally {
    if (Test-Path -LiteralPath $testRoot) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}

Write-Host "Tests: $($script:Passed) passed, $($script:Failed) failed"
if ($script:Failed -gt 0) {
    exit 1
}
