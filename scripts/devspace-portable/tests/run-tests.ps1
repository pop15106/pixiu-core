[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Passed = 0
$script:Failed = 0

function Assert-Equal {
    param($Actual, $Expected, [string]$Name)
    if (($Actual | ConvertTo-Json -Compress -Depth 10) -ne ($Expected | ConvertTo-Json -Compress -Depth 10)) {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
        Write-Host "  expected: $($Expected | ConvertTo-Json -Compress -Depth 10)"
        Write-Host "  actual:   $($Actual | ConvertTo-Json -Compress -Depth 10)"
        $script:Failed++
        return
    }
    Write-Host "[PASS] $Name" -ForegroundColor Green
    $script:Passed++
}

function Assert-Throws {
    param([scriptblock]$Action, [string]$Name)
    try {
        & $Action
        Write-Host "[FAIL] $Name (no exception)" -ForegroundColor Red
        $script:Failed++
    }
    catch {
        Write-Host "[PASS] $Name" -ForegroundColor Green
        $script:Passed++
    }
}

$modulePath = Join-Path (Split-Path -Parent $PSScriptRoot) 'DevSpace.OneClick.Core.psm1'
Import-Module $modulePath -Force
Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'DevSpace.OneClick.Platform.psm1') -Force -DisableNameChecking
Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'DevSpace.OneClick.Subagents.psm1') -Force

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("devspace-oneclick-tests-" + [guid]::NewGuid().ToString('N'))
$userProfile = Join-Path $testRoot 'user'
$desktop = Join-Path $userProfile 'Desktop'
$downloads = Join-Path $userProfile 'Downloads'
$projectA = Join-Path $desktop 'project-a'
$projectB = Join-Path $userProfile 'work\project-b'

try {
    foreach ($directory in @($projectA, $projectB, $downloads)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $resolvedA = Assert-NarrowAllowedRoot -Root $projectA -UserProfile $userProfile
    Assert-Equal $resolvedA ([System.IO.Path]::GetFullPath($projectA).TrimEnd('\')) 'accepts a specific project directory'
    Assert-Throws { Assert-NarrowAllowedRoot -Root $userProfile -UserProfile $userProfile } 'rejects the whole user profile'
    Assert-Throws { Assert-NarrowAllowedRoot -Root $desktop -UserProfile $userProfile } 'rejects the whole Desktop'
    Assert-Throws { Assert-NarrowAllowedRoot -Root $downloads -UserProfile $userProfile } 'rejects the whole Downloads'
    Assert-Throws { Assert-NarrowAllowedRoot -Root ([System.IO.Path]::GetPathRoot($testRoot)) -UserProfile $userProfile } 'rejects a drive root'

    $mergedRoots = Merge-AllowedRoots -ExistingRoots @($projectA) -NewRoots @($projectA.ToUpperInvariant(), $projectB) -UserProfile $userProfile
    Assert-Equal @($mergedRoots) @(
        [System.IO.Path]::GetFullPath($projectA).TrimEnd('\'),
        [System.IO.Path]::GetFullPath($projectB).TrimEnd('\')
    ) 'deduplicates roots without widening access'

    $selectedPort = Select-DevSpacePort -UsedAccountPorts @(7676, 7681) -StartPort 7676 -EndPort 7685 -IsPortAvailable {
        param($Port)
        return $Port -ne 7677
    }
    Assert-Equal $selectedPort 7678 'avoids account and local port conflicts'

    $existingConfig = [pscustomobject]@{
        host = '127.0.0.1'
        port = 7000
        allowedRoots = @($projectA)
        publicBaseUrl = 'https://old.example.com'
        preservedSetting = 'keep-me'
    }
    $mergedConfig = Merge-DevSpaceConfig -ExistingConfig $existingConfig -AllowedRoots @($projectA, $projectB) -Port 7678 -PublicBaseUrl 'https://machine-7678.jpe1.devtunnels.ms'
    Assert-Equal $mergedConfig.preservedSetting 'keep-me' 'preserves unrelated config fields'
    Assert-Equal $mergedConfig.host '127.0.0.1' 'binds DevSpace to loopback'
    Assert-Equal $mergedConfig.port 7678 'persists the selected port'
    Assert-Equal $existingConfig.port 7000 'does not mutate the input config'

    $fakeDevTunnel = Join-Path $testRoot 'fake-devtunnel.cmd'
    $fakeDevTunnelContent = @"
@echo off
if "%1"=="list" echo {"tunnels":[{"tunnelId":"one.jpe1"},{"tunnelId":"two.jpe1"}]}& exit /b 0
if "%1"=="port" if "%2"=="list" if "%3"=="one.jpe1" echo {"ports":[{"portNumber":7676},{"portNumber":7681}]}& exit /b 0
if "%1"=="port" if "%2"=="list" if "%3"=="two.jpe1" echo {"ports":[{"portNumber":7676},{"portNumber":7677}]}& exit /b 0
exit /b 2
"@
    [System.IO.File]::WriteAllText($fakeDevTunnel, $fakeDevTunnelContent, [System.Text.UTF8Encoding]::new($false))
    $accountPorts = @(Get-AccountDevSpacePorts -DevTunnel $fakeDevTunnel | Sort-Object)
    Assert-Equal $accountPorts @(7676, 7677, 7681) 'returns unique account-wide DevSpace ports on Windows PowerShell'
    $tunnel = [pscustomobject]@{
        tunnel = [pscustomobject]@{
            ports = @([pscustomobject]@{ portNumber = 7678; portUri = 'https://machine-7678.jpe1.devtunnels.ms/' })
        }
    }
    Assert-Equal (Get-TunnelPublicBaseUrl -TunnelDocument $tunnel -Port 7678) 'https://machine-7678.jpe1.devtunnels.ms' 'derives an HTTPS origin without /mcp'
    Assert-Equal (New-DevSpaceTunnelName -ComputerName 'OFFICE_PC 01' -Suffix 'A1B2C3D4') 'devspace-office-pc-01-a1b2c3d4' 'creates a machine-specific tunnel name'
    Assert-Equal (Assert-DevSpaceAgentId -AgentId 'agt_1a2b3c4d') 'agt_1a2b3c4d' 'accepts a valid Agent ID'
    Assert-Throws { Assert-DevSpaceAgentId -AgentId 'agt_1a2b3c4d;taskkill' } 'rejects an unsafe Agent ID'
    Assert-Equal (Format-DevSpaceAgentText -Value ('line 1' + [Environment]::NewLine + 'line 2')) 'line 1 line 2' 'flattens multiline Agent output'
    $truncatedAgentText = Format-DevSpaceAgentText -Value ('x' * 100) -MaxLength 80
    Assert-Equal ($truncatedAgentText.Length -eq 80 -and $truncatedAgentText.EndsWith('...')) $true 'truncates oversized Agent output'
    Assert-Equal (Get-DevSpaceAgentRecordText -Record ([pscustomobject]@{ id = 'agt_1a2b3c4d' }) -PropertyName 'latestResponse') '' 'handles sparse Agent records'
    $agentAdminSource = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'DevSpace.AgentAdmin.mjs') -Raw
    Assert-Equal ($agentAdminSource.Contains('Previous status:') -and $agentAdminSource.Contains('Previous error:')) $true 'preserves prior Agent failure details when stopped'
    Assert-Equal $agentAdminSource.Contains('supports DevSpace 1.0.4 only') $true 'version-locks the Agent controller'

    $fakePackageRoot = Join-Path $testRoot 'fake-devspace'
    $fakeDist = Join-Path $fakePackageRoot 'dist'
    $fakeSdkDist = Join-Path $fakePackageRoot 'node_modules\@openai\codex-sdk\dist'
    New-Item -ItemType Directory -Path $fakeDist, $fakeSdkDist -Force | Out-Null
    [System.IO.File]::WriteAllText(
        (Join-Path $fakePackageRoot 'package.json'),
        '{"version":"1.0.4"}',
        [System.Text.UTF8Encoding]::new($false)
    )

    $runtimeSource = @(
        'class Runtime {'
        '    async run(input) {'
        '        const turn = await thread.run(input.prompt);'
        '        return turn;'
        '    }'
        '}'
        'function threadOptionsFor(input) {'
        '    return {'
        '        workingDirectory: input.workspace,'
        '        sandboxMode: sandboxModeFor(input.writeMode),'
        '    };'
        '}'
        'async function defaultCodexFactory() {'
        '    const module = await import("@openai/codex-sdk");'
        '    return (options) => new module.Codex(options);'
        '}'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $fakeDist 'local-agent-runtime.js'), $runtimeSource, [System.Text.UTF8Encoding]::new($false))

    $profileParserSource = @(
        'function profileFromFrontmatter(frontmatter, body, filePath) {'
        '    return {'
        '        thinking: readString(frontmatter, "thinking"),'
        '        filePath,'
        '    };'
        '}'
        'function readString(frontmatter, key) {'
        '    return frontmatter[key];'
        '}'
    ) -join [Environment]::NewLine
    [System.IO.File]::WriteAllText((Join-Path $fakeDist 'local-agent-profiles.js'), $profileParserSource, [System.Text.UTF8Encoding]::new($false))

    $sdkSource = @(
        'const child = spawn(this.executablePath, commandArgs, {'
        '      env,'
        '      signal: args.signal'
        '    });'
    ) -join "`r`n"
    [System.IO.File]::WriteAllText((Join-Path $fakeSdkDist 'index.js'), $sdkSource, [System.Text.UTF8Encoding]::new($false))

    $cliSource = @(
        'const deadline = Date.now() + 15_000;'
        'async function runLocalAgentProfile(profile, record, prompt) {'
        '    return runLocalAgentProvider(profile.provider, {'
        '        writeMode: "allowed",'
        '        model: record.model ?? profile.model,'
        '    });'
        '}'
        'function spawnAgentWorker() {'
        '    const child = spawn("node", [], {'
        '        detached: true,'
        '        stdio: "ignore",'
        '        env: process.env,'
        '    });'
        '}'
        'main(process.argv.slice(2)).catch((error) => {'
        '    process.exitCode = 1;'
        '});'
    ) -join "`r`n"
    $fakeCli = Join-Path $fakeDist 'cli.js'
    [System.IO.File]::WriteAllText($fakeCli, $cliSource, [System.Text.UTF8Encoding]::new($false))

    $serverSource = @(
        'function serverInstructions(config) {'
        '    return `Use DevSpace as a local coding workspace. Prefer ${toolNames.edit} for targeted modifications, then continue.`;'
        '}'
        'if (config.toolMode === "codex") {'
        '    registerCodexProcessTools(server, config, workspaces, processSessions);'
        '}'
    ) -join [Environment]::NewLine
    $fakeServer = Join-Path $fakeDist 'server.js'
    [System.IO.File]::WriteAllText($fakeServer, $serverSource, [System.Text.UTF8Encoding]::new($false))

    Assert-Equal (Install-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli) 12 'applies all DevSpace 1.0.4 Windows patches'
    $patchedRuntime = [System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-runtime.js'))
    $patchedProfiles = [System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-profiles.js'))
    $patchedSdk = [System.IO.File]::ReadAllText((Join-Path $fakeSdkDist 'index.js'))
    $patchedCli = [System.IO.File]::ReadAllText($fakeCli)
    $patchedServer = [System.IO.File]::ReadAllText($fakeServer)
    Assert-Equal $patchedRuntime.Contains('skipGitRepoCheck: true') $true 'allows explicitly authorized non-Git workspaces'
    Assert-Equal $patchedRuntime.Contains('shell_environment_policy:') $true 'injects the Node and npm PATH into Codex'
    Assert-Equal $patchedRuntime.Contains('Subagent timed out after ') $true 'enforces bounded Agent execution'
    Assert-Equal $patchedProfiles.Contains('writeMode: readWriteMode') $true 'loads profile write modes'
    Assert-Equal $patchedProfiles.Contains('timeoutSeconds: readTimeoutSeconds') $true 'loads profile timeouts'
    Assert-Equal $patchedSdk.Contains('windowsHide: process.platform === "win32"') $true 'hides the Codex child window'
    Assert-Equal $patchedCli.Contains('const deadline = Date.now() + 1_000;') $true 'shortens Agent status polling'
    Assert-Equal $patchedCli.Contains('writeMode: profile.writeMode ?? "allowed"') $true 'enforces read-only profiles'
    Assert-Equal $patchedCli.Contains('timeoutMs: profile.timeoutSeconds ?') $true 'passes profile timeouts to the runtime'
    Assert-Equal $patchedCli.Contains('const isShortAgentCommand') $true 'forces short Agent commands to exit'
    Assert-Equal $patchedServer.Contains('Use exec_command for npm, builds, tests, and DevSpace Agent status commands') $true 'guides ChatGPT Web to use process sessions for long commands'
    Assert-Equal $patchedServer.Contains('if (config.toolMode === "codex")') $false 'registers process-session tools outside Codex mode'
    Assert-Equal (Install-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli) 0 'Subagent patch is idempotent'

    $profileConfig = Join-Path $testRoot 'profile-config'
    $profileSource = Join-Path (Split-Path -Parent $PSScriptRoot) 'agents'
    $installedProfiles = @(Install-DevSpaceAgentProfiles -ConfigRoot $profileConfig -SourceDirectory $profileSource)
    Assert-Equal $installedProfiles.Count 3 'installs the three managed Agent profiles'
    $explorerProfile = Get-Content -LiteralPath (Join-Path $profileConfig 'agents\codex-explorer.md') -Raw
    $workerProfile = Get-Content -LiteralPath (Join-Path $profileConfig 'agents\codex-worker.md') -Raw
    $qaProfile = Get-Content -LiteralPath (Join-Path $profileConfig 'agents\codex-qa-tester.md') -Raw
    Assert-Equal $explorerProfile.Contains('thinking: xhigh') $true 'installs xhigh thinking profiles'
    Assert-Equal ($explorerProfile.Contains('writeMode: read_only') -and $explorerProfile.Contains('timeoutSeconds: 720')) $true 'bounds Explorer execution'
    Assert-Equal ($workerProfile.Contains('writeMode: allowed') -and $workerProfile.Contains('timeoutSeconds: 1800')) $true 'allows bounded Worker edits'
    Assert-Equal ($qaProfile.Contains('writeMode: read_only') -and $qaProfile.Contains('timeoutSeconds: 1200')) $true 'keeps QA read-only'

    $shimRoot = Join-Path $testRoot 'shim'
    $adminSource = Join-Path (Split-Path -Parent $PSScriptRoot) 'DevSpace.AgentAdmin.mjs'
    $fakeNodeRoot = Join-Path $testRoot 'node-runtime'
    New-Item -ItemType Directory -Path $fakeNodeRoot -Force | Out-Null
    $fakeNode = Join-Path $fakeNodeRoot 'node.exe'
    foreach ($runtimeFile in @($fakeNode, (Join-Path $fakeNodeRoot 'npm.cmd'), (Join-Path $fakeNodeRoot 'npx.cmd'))) {
        [System.IO.File]::WriteAllText($runtimeFile, '', [System.Text.UTF8Encoding]::new($false))
    }
    $shim = Install-DevSpaceAgentCliShim -NodePath $fakeNode -DevSpaceCli $fakeCli -AdminScript $adminSource -BinDirectory $shimRoot
    $shellShim = Get-Content -LiteralPath $shim.ShellPath -Raw
    $cmdShim = Get-Content -LiteralPath $shim.CmdPath -Raw
    $npmShellShim = Get-Content -LiteralPath $shim.NpmShellPath -Raw
    $npxShellShim = Get-Content -LiteralPath $shim.NpxShellPath -Raw
    Assert-Equal ($shellShim.Contains('cli-list') -and $shellShim.Contains('cli-show')) $true 'installs fast Bash status routing'
    Assert-Equal ($cmdShim.Contains('cli-list') -and $cmdShim.Contains('cli-show')) $true 'installs fast CMD status routing'
    Assert-Equal (Test-Path -LiteralPath $shim.AdminPath) $true 'copies the lightweight Agent admin to a stable path'
    Assert-Equal ($agentAdminSource.Contains('action === "cli-list"') -and $agentAdminSource.Contains('action === "cli-show"')) $true 'supports CLI-compatible fast status output'
    Assert-Equal $npmShellShim.Contains('/npm.cmd" "$@"') $true 'routes Git Bash npm through npm.cmd'
    Assert-Equal $npxShellShim.Contains('/npx.cmd" "$@"') $true 'routes Git Bash npx through npx.cmd'
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
