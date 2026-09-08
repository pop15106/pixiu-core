[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'DevSpace.OneClick.Subagents.psm1') -Force
$script:Passed = 0
$script:Failed = 0
$script:Skipped = 0
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('pixiu-workflow-deploy-guard-' + [guid]::NewGuid().ToString('N'))
$utf8 = [Text.UTF8Encoding]::new($false)

function Check {
    param([bool]$Condition, [string]$Name)
    if ($Condition) { $script:Passed++; Write-Host "PASS $Name" }
    else { $script:Failed++; Write-Host "FAIL $Name" }
}

function New-Case {
    param([string]$Name, [string]$Content)
    $root = Join-Path $testRoot $Name
    $source = Join-Path $root 'source'
    $bin = Join-Path $root 'bin'
    [void][IO.Directory]::CreateDirectory($source)
    [void][IO.Directory]::CreateDirectory($bin)
    $file = Join-Path $source 'DevSpace.WorkflowStore.mjs'
    $target = Join-Path $bin 'DevSpace.WorkflowStore.mjs'
    [IO.File]::WriteAllText($file, $Content, $utf8)
    [IO.File]::WriteAllText($target, 'export const retained = true;', $utf8)
    return [pscustomobject]@{ Root = $root; Source = $source; File = $file; Bin = $bin; Target = $target }
}

function Check-Rejected {
    param($Case, [string]$ExpectedCode, [string]$Name)
    $before = [IO.File]::ReadAllBytes($Case.Target)
    $message = ''
    try { [void](Install-DevSpaceWorkflowModule -SourceFile $Case.File -BinDirectory $Case.Bin) }
    catch { $message = $_.Exception.Message }
    Check ($message.Contains($ExpectedCode)) "$Name returns $ExpectedCode"
    Check ([Convert]::ToBase64String([IO.File]::ReadAllBytes($Case.Target)) -eq [Convert]::ToBase64String($before)) "$Name retains installed bytes"
    Check (-not (Test-Path -LiteralPath ($Case.Target + '.devspace-oneclick.bak'))) "$Name does not replace rollback evidence"
    Check (@(Get-ChildItem -LiteralPath $Case.Bin -Filter '*.tmp' -File).Count -eq 0) "$Name leaves no temporary deployment file"
}

try {
    [void][IO.Directory]::CreateDirectory($testRoot)

    # 現場單檔版本維持原有內容與冪等行為。
    $legacy = New-Case 'legacy' "import { readFile } from 'node:fs/promises';`nexport const version = 'legacy';`n"
    $first = Install-DevSpaceWorkflowModule -SourceFile $legacy.File -BinDirectory $legacy.Bin
    Check ($first.Changed -eq $true) 'legacy installation still works'
    Check ([IO.File]::ReadAllText($first.Path) -eq [IO.File]::ReadAllText($legacy.File)) 'legacy bytes are preserved'
    $again = Install-DevSpaceWorkflowModule -SourceFile $legacy.File -BinDirectory $legacy.Bin
    Check ($again.Changed -eq $false) 'legacy installation remains idempotent'
    Check ([IO.File]::ReadAllText($legacy.Target + '.devspace-oneclick.bak') -eq 'export const retained = true;') 'legacy rollback copy is retained'

    $missing = New-Case 'missing-helper' "import { hardenWorkflowController } from './DevSpace.FullAutoController.mjs';`nexport const version = 'candidate';"
    Check-Rejected $missing 'WORKFLOW_DEPENDENCY_MISSING' 'missing helper'

    $sideEffect = New-Case 'side-effect-import' "import './extra-helper.mjs';`nexport const version = 'candidate';"
    Check-Rejected $sideEffect 'WORKFLOW_DEPENDENCY_MISSING' 'side-effect import'

    $dynamic = New-Case 'dynamic-literal' "const helper = await import('./extra-helper.mjs');`nexport const version = 'candidate';"
    Check-Rejected $dynamic 'WORKFLOW_DEPENDENCY_MISSING' 'dynamic literal import'

    $reexport = New-Case 'reexport' "export { version } from './extra-helper.mjs';"
    Check-Rejected $reexport 'WORKFLOW_DEPENDENCY_MISSING' 'local re-export'

    $core = New-Case 'missing-core' "const core = await import(new URL('../../external/session-workflow/packages/session-workflow/core/index.mjs', import.meta.url));`nexport const version = 'candidate';"
    Check-Rejected $core 'WORKFLOW_DEPENDENCY_MISSING' 'missing standalone core'

    # 相依雖存在，舊安裝器仍只能複製單檔，因此不得宣稱整包已安裝。
    $present = New-Case 'complete-local-dependency' "import './extra-helper.mjs';`nexport const version = 'candidate';"
    [IO.File]::WriteAllText((Join-Path $present.Source 'extra-helper.mjs'), 'export const helper = true;', $utf8)
    Check-Rejected $present 'WORKFLOW_MULTI_FILE_DEPLOYMENT_REQUIRED' 'complete local dependency with single-file installer'

    $fullAuto = New-Case 'full-auto-bundle' "import './DevSpace.FullAutoController.mjs';`nimport './DevSpace.FullAutoRuntime.mjs';`nexport const version = 'candidate';"
    foreach ($name in @('DevSpace.FullAutoController.mjs', 'DevSpace.FullAutoPolicy.mjs', 'DevSpace.FullAutoRuntime.mjs', 'DevSpace.LaunchReceipts.mjs')) {
        [IO.File]::WriteAllText((Join-Path $fullAuto.Source $name), 'export const candidate = true;', $utf8)
    }
    Check-Rejected $fullAuto 'WORKFLOW_MULTI_FILE_DEPLOYMENT_REQUIRED' 'full-auto bundle is not partially copied'

    # 使用明確外部核心設定也不能繞過單檔部署檢查。
    $environmentCore = New-Case 'environment-core' "const core = await import(process.env.SESSION_WORKFLOW_CORE_MODULE);`nexport const version = 'candidate';"
    Check-Rejected $environmentCore 'WORKFLOW_EXTERNAL_CORE_DEPLOYMENT_REQUIRED' 'external core deployment contract'

    $newTarget = New-Case 'no-target-created' "import './missing.mjs';"
    $freshBin = Join-Path $newTarget.Root 'uncreated-bin'
    $message = ''
    try { [void](Install-DevSpaceWorkflowModule -SourceFile $newTarget.File -BinDirectory $freshBin) }
    catch { $message = $_.Exception.Message }
    Check ($message.Contains('WORKFLOW_DEPENDENCY_MISSING')) 'new destination fails dependency preflight'
    Check (-not (Test-Path -LiteralPath $freshBin)) 'failed preflight does not create a destination'

    # 只建立本輪暫存目錄的 junction（目錄連結），不碰既有部署目錄。
    $linked = New-Case 'linked-source' 'export const value = 1;'
    $sourceLink = Join-Path $linked.Root 'source-link'
    try {
        [void](New-Item -ItemType Junction -Path $sourceLink -Target $linked.Source)
        $linkedCase = [pscustomobject]@{ File = (Join-Path $sourceLink 'DevSpace.WorkflowStore.mjs'); Bin = $linked.Bin; Target = $linked.Target }
        Check-Rejected $linkedCase 'WORKFLOW_REPARSE_POINT_BLOCKED' 'linked source directory'
    }
    catch {
        $script:Skipped++; Write-Host ('SKIP source junction: ' + $_.Exception.Message)
    }
    finally {
        if (Test-Path -LiteralPath $sourceLink) { [IO.Directory]::Delete($sourceLink) }
    }

    $linkedTarget = New-Case 'linked-target' 'export const value = 1;'
    $binLink = Join-Path $linkedTarget.Root 'bin-link'
    try {
        [void](New-Item -ItemType Junction -Path $binLink -Target $linkedTarget.Bin)
        $linkedCase = [pscustomobject]@{ File = $linkedTarget.File; Bin = $binLink; Target = $linkedTarget.Target }
        Check-Rejected $linkedCase 'WORKFLOW_REPARSE_POINT_BLOCKED' 'linked target directory'
    }
    catch {
        $script:Skipped++; Write-Host ('SKIP target junction: ' + $_.Exception.Message)
    }
    finally {
        if (Test-Path -LiteralPath $binLink) { [IO.Directory]::Delete($binLink) }
    }
}
finally {
    # 只清理由本測試建立且位於系統暫存區內的唯一目錄。
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
    if ([IO.Path]::GetFullPath($testRoot).StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $testRoot)) {
        Remove-Item -LiteralPath $testRoot -Recurse -Force
    }
}
Write-Host "Workflow deployment guard: $($script:Passed) passed, $($script:Failed) failed, $($script:Skipped) skipped"
if ($script:Failed -gt 0) { exit 1 }
exit 0
