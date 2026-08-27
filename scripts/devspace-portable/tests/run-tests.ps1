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

function Assert-ActionEqual {
    param([scriptblock]$Action, $Expected, [string]$Name)
    try {
        $actual = & $Action
        Assert-Equal $actual $Expected $Name
    }
    catch {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
        Write-Host "  error: $($_.Exception.Message)"
        $script:Failed++
    }
}

function New-TestSkill {
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $skillDirectory = Join-Path $Root $Name
    New-Item -ItemType Directory -Path $skillDirectory -Force | Out-Null
    [System.IO.File]::WriteAllText(
        (Join-Path $skillDirectory 'SKILL.md'),
        $Content,
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Invoke-FakeEffectiveSkillPaths {
    param(
        [Parameter(Mandatory = $true)][string]$RunnerPath,
        [Parameter(Mandatory = $true)][string]$SkillsModulePath,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$DevSpaceSkillsDirectory,
        [string[]]$SkillPaths = @(),
        [ValidateSet('normal', 'unreadable', 'missing')][string]$Mode = 'normal'
    )

    $configJson = @{
        devspaceSkillsDir = $DevSpaceSkillsDirectory
        skillPaths = @($SkillPaths)
    } | ConvertTo-Json -Compress
    $configBase64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($configJson))
    $nodeHome = Join-Path (Split-Path -Parent $WorkingDirectory) 'node-home'
    New-Item -ItemType Directory -Path $nodeHome -Force | Out-Null
    $previousUserProfile = $env:USERPROFILE
    try {
        $env:USERPROFILE = $nodeHome
        $output = & node $RunnerPath $SkillsModulePath $WorkingDirectory $configBase64 $Mode 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Fake skill discovery failed: $output"
        }
        return [string]$output
    }
    finally {
        $env:USERPROFILE = $previousUserProfile
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

    $loginMarker = Join-Path $testRoot 'unexpected-devtunnel-login.marker'
    $fakeLoggedOutDevTunnel = Join-Path $testRoot 'fake-logged-out-devtunnel.cmd'
    $fakeLoggedOutDevTunnelContent = @"
@echo off
if "%1"=="user" if "%2"=="show" echo {"status":"Logged out"}& exit /b 0
if "%1"=="user" if "%2"=="login" type nul > "$loginMarker"& exit /b 0
exit /b 2
"@
    [System.IO.File]::WriteAllText(
        $fakeLoggedOutDevTunnel,
        $fakeLoggedOutDevTunnelContent,
        [System.Text.UTF8Encoding]::new($false)
    )
    $previousNonInteractive = $env:DEVSPACE_ONECLICK_NONINTERACTIVE
    try {
        $env:DEVSPACE_ONECLICK_NONINTERACTIVE = '1'
        Assert-Throws {
            Ensure-DevTunnelLogin -DevTunnel $fakeLoggedOutDevTunnel
        } 'non-interactive login check refuses browser login'
        Assert-Equal (Test-Path -LiteralPath $loginMarker) $false 'non-interactive login check never invokes user login'
    }
    finally {
        $env:DEVSPACE_ONECLICK_NONINTERACTIVE = $previousNonInteractive
    }

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

    $modernTunnel = [pscustomobject]@{
        tunnelId = 'machine.jpe1'
        ports = @([pscustomobject]@{
            portNumber = 7678
            protocol = 'http'
            portForwardingUris = @('https://alias-7678.jpe1.devtunnels.ms/')
        })
    }
    Assert-ActionEqual {
        (Get-TunnelObject -TunnelDocument $tunnel).ports[0].portNumber
    } 7678 'unwraps the legacy tunnel response before reading ports'
    Assert-ActionEqual {
        (Get-TunnelObject -TunnelDocument $modernTunnel).ports[0].portNumber
    } 7678 'accepts the current tunnel response before reading ports'
    Assert-ActionEqual {
        Get-TunnelPublicBaseUrl -TunnelDocument $modernTunnel -Port 7678
    } 'https://alias-7678.jpe1.devtunnels.ms' 'derives an HTTPS origin from current portForwardingUris'

    $tunnelWithoutPortUri = [pscustomobject]@{
        tunnel = [pscustomobject]@{
            tunnelId = 'devspace-tv7010nb-a1b2c3d4.jpe1'
            ports = @([pscustomobject]@{ portNumber = 7676; protocol = 'http' })
        }
    }
    Assert-Equal (Get-TunnelPublicBaseUrl -TunnelDocument $tunnelWithoutPortUri -Port 7676) 'https://devspace-tv7010nb-a1b2c3d4-7676.jpe1.devtunnels.ms' 'derives the public origin when current Dev Tunnel JSON omits portUri'

    $verboseHttpOutput = @'
trace line
HTTP: {
  "tunnelId": "machine.jpe1",
  "ports": [
    {
      "portNumber": 7678,
      "portForwardingUris": [
        "https://alias-7678.jpe1.devtunnels.ms/"
      ]
    }
  ]
}
{
  "tunnel": {
    "tunnelId": "machine.jpe1",
    "ports": [
      {
        "portNumber": 7678,
        "protocol": "http"
      }
    ]
  }
}
'@
    Assert-ActionEqual {
        (ConvertFrom-VerboseHttpJson -Output $verboseHttpOutput).ports[0].portForwardingUris[0]
    } 'https://alias-7678.jpe1.devtunnels.ms/' 'extracts the raw service JSON from verbose CLI output'
    Assert-Equal @(ConvertTo-DevTunnelLabelArguments -Labels @('devspace', 'oneclick', 'machine-tv7010nb')) @('--labels', 'devspace', '--labels', 'oneclick', '--labels', 'machine-tv7010nb') 'repeats the labels option for current Dev Tunnel CLI'
    Assert-Throws { ConvertTo-DevTunnelLabelArguments -Labels @('invalid label') } 'rejects invalid Dev Tunnel labels'

    $liveConfig = [pscustomobject]@{
        host = '127.0.0.1'
        port = 7678
        publicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
        allowedRoots = @($projectA)
    }
    $liveDevSpaceProcess = [pscustomobject]@{
        ProcessId = 3596
        ParentProcessId = 3056
        Name = 'node.exe'
        CommandLine = '"C:\Program Files\nodejs\node.exe" C:\Users\tester\AppData\Roaming\npm\node_modules\@waishnav\devspace\dist\cli.js serve'
        StartedAtUtc = '2026-07-25T06:54:04.0000000Z'
    }
    $liveTunnelProcess = [pscustomobject]@{
        ProcessId = 12732
        ParentProcessId = 3056
        Name = 'devtunnel.exe'
        CommandLine = '"C:\Tools\devtunnel.exe" host devspace-mcp-pop15.jpe1'
        StartedAtUtc = '2026-07-25T06:54:12.0000000Z'
    }
    $adoption = New-DevSpaceOneClickAdoptionState -Config $liveConfig -DevSpaceProcess $liveDevSpaceProcess -DevTunnelProcess $liveTunnelProcess -MachineName 'LAPTOP-0965BH7Q' -Now ([datetime]'2026-07-27T03:30:00Z')
    Assert-Equal $adoption.Settings.tunnelId 'devspace-mcp-pop15.jpe1' 'adopts the active Dev Tunnel host ID'
    Assert-Equal $adoption.Settings.publicBaseUrl 'https://dxrpsqgc-7678.jpe1.devtunnels.ms' 'adopts the live public origin from config'
    Assert-Equal $adoption.Runtime.devSpacePid 3596 'records the verified DevSpace listener PID'
    Assert-Equal $adoption.Runtime.devTunnelPid 12732 'records the verified Dev Tunnel PID'
    Assert-Equal $adoption.Runtime.devSpaceStartedAtUtc '2026-07-25T06:54:04.0000000Z' 'preserves the DevSpace process identity timestamp'
    Assert-Throws {
        New-DevSpaceOneClickAdoptionState -Config $liveConfig -DevSpaceProcess ([pscustomobject]@{
            ProcessId = 3596; ParentProcessId = 3056; Name = 'node.exe'; CommandLine = 'node unrelated-server.js'; StartedAtUtc = '2026-07-25T06:54:04Z'
        }) -DevTunnelProcess $liveTunnelProcess -MachineName 'LAPTOP-0965BH7Q'
    } 'refuses to adopt an unrelated Node listener'
    Assert-Throws {
        New-DevSpaceOneClickAdoptionState -Config ([pscustomobject]@{
            host = '127.0.0.1'; port = 7678; publicBaseUrl = 'https://old-7678.asse.devtunnels.ms'; allowedRoots = @($projectA)
        }) -DevSpaceProcess $liveDevSpaceProcess -DevTunnelProcess $liveTunnelProcess -MachineName 'LAPTOP-0965BH7Q'
    } 'refuses a public origin whose region differs from the hosted tunnel'
    Assert-Throws {
        New-DevSpaceOneClickAdoptionState -Config $liveConfig -DevSpaceProcess $liveDevSpaceProcess -DevTunnelProcess ([pscustomobject]@{
            ProcessId = 12732; ParentProcessId = 9999; Name = 'devtunnel.exe'; CommandLine = 'devtunnel.exe host devspace-mcp-pop15.jpe1'; StartedAtUtc = '2026-07-25T06:54:12Z'
        }) -MachineName 'LAPTOP-0965BH7Q'
    } 'refuses processes that do not share the same launcher parent'

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
    $launcherSource = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'devspace-oneclick.ps1') -Raw
    Assert-Equal ($launcherSource.Contains("'restore-subagent-patch'") -and $launcherSource.Contains('Restore-DevSpaceSubagentWindowsPatch')) $true 'exposes the verified patch restore action'
    Assert-Equal ($launcherSource.Contains("'repair-state'") -and $launcherSource.Contains('Repair-OneClickState')) $true 'exposes explicit live-state reconciliation without restart'
    Assert-Equal ($launcherSource.Contains('Install-DevSpaceWorkflowModule') -and $launcherSource.Contains('DEVSPACE_WORKFLOW_MODULE') -and $launcherSource.Contains('DEVSPACE_WORKFLOW_STATE_DIR')) $true 'wires the durable workflow module into OneClick startup'
    Assert-Equal $launcherSource.Contains('Updated DevSpace runtime components; restarting the owned stack.') $true 'restarts an owned stack after a workflow runtime update'
    $repairStateCommand = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) '09-REPAIR-STATE.cmd') -Raw
    Assert-Equal $repairStateCommand.Contains('devspace-oneclick.ps1" repair-state') $true 'ships a dedicated no-restart state repair command'

    $fakePackageRoot = Join-Path $testRoot 'fake-devspace'
    $fakeDist = Join-Path $fakePackageRoot 'dist'
    $fakeSdkDist = Join-Path $fakePackageRoot 'node_modules\@openai\codex-sdk\dist'
    New-Item -ItemType Directory -Path $fakeDist, $fakeSdkDist -Force | Out-Null
    [System.IO.File]::WriteAllText(
        (Join-Path $fakePackageRoot 'package.json'),
        '{"version":"1.0.4","type":"module"}',
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
        'import { formatLocalAgentProviderAvailabilitySummary, getLocalAgentProviderAvailabilitySnapshot, } from "./local-agent-availability.js";'
        'function serverInstructions(config) {'
        '    return `Use DevSpace as a local coding workspace. Prefer ${toolNames.edit} for targeted modifications, then continue.`;'
        '}'
        'if (config.toolMode === "codex") {'
        '    registerCodexProcessTools(server, config, workspaces, processSessions);'
        '}'
    ) -join [Environment]::NewLine
    $fakeServer = Join-Path $fakeDist 'server.js'
    [System.IO.File]::WriteAllText($fakeServer, $serverSource, [System.Text.UTF8Encoding]::new($false))

    $skillsSource = @(
        'import { existsSync } from "node:fs";'
        'import { homedir } from "node:os";'
        'import { join, resolve } from "node:path";'
        'function resolveSkillPath(path) { return path; }'
        'export function effectiveSkillPaths(config, cwd) {'
        '    const defaultPathCandidates = ['
        '        join(homedir(), ".agents", "skills"),'
        '        resolve(cwd, ".agents", "skills"),'
        '        config.devspaceSkillsDir,'
        '    ];'
        '    const defaultPaths = defaultPathCandidates.filter((path) => path !== undefined && existsSync(path));'
        '    const seen = new Set();'
        '    return [...defaultPaths, ...config.skillPaths]'
        '        .map((path) => resolveSkillPath(path, cwd))'
        '        .filter((path) => {'
        '        if (seen.has(path))'
        '            return false;'
        '        seen.add(path);'
        '        return true;'
        '    });'
        '}'
    ) -join [Environment]::NewLine
    $fakeSkills = Join-Path $fakeDist 'skills.js'
    [System.IO.File]::WriteAllText($fakeSkills, $skillsSource, [System.Text.UTF8Encoding]::new($false))

    $skillRunner = Join-Path $fakeDist 'run-effective-skill-paths.mjs'
    $skillRunnerSource = @(
        'import fs from "node:fs";'
        'import { syncBuiltinESMExports } from "node:module";'
        'import { pathToFileURL } from "node:url";'
        'const [modulePath, cwd, configBase64, mode] = process.argv.slice(2);'
        'if (mode !== "normal") {'
        '    const originalReadFileSync = fs.readFileSync;'
        '    fs.readFileSync = (path, ...args) => {'
        '        if (/[\\/]\.agents[\\/]skills[\\/].*SKILL\.md$/i.test(String(path))) {'
        '            const error = new Error("simulated Skill read failure");'
        '            error.code = mode === "missing" ? "ENOENT" : "EACCES";'
        '            throw error;'
        '        }'
        '        return originalReadFileSync(path, ...args);'
        '    };'
        '    syncBuiltinESMExports();'
        '}'
        'const { effectiveSkillPaths } = await import(pathToFileURL(modulePath).href);'
        'const config = JSON.parse(Buffer.from(configBase64, "base64").toString("utf8"));'
        'console.log(effectiveSkillPaths(config, cwd).join("|"));'
    ) -join [Environment]::NewLine
    [System.IO.File]::WriteAllText($skillRunner, $skillRunnerSource, [System.Text.UTF8Encoding]::new($false))

    Assert-Equal (Install-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli) 17 'applies all DevSpace 1.0.4 Windows patches'
    $patchedRuntime = [System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-runtime.js'))
    $patchedProfiles = [System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-profiles.js'))
    $patchedSdk = [System.IO.File]::ReadAllText((Join-Path $fakeSdkDist 'index.js'))
    $patchedCli = [System.IO.File]::ReadAllText($fakeCli)
    $patchedServer = [System.IO.File]::ReadAllText($fakeServer)
    $patchedSkills = [System.IO.File]::ReadAllText($fakeSkills)
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
    Assert-Equal $patchedServer.Contains('const devSpaceWorkflowModule = process.env.DEVSPACE_WORKFLOW_MODULE') $true 'loads the durable workflow module from the managed path'
    Assert-Equal $patchedServer.Contains('registerDevSpaceWorkflowTools') $true 'registers cross-session workflow tools for ChatGPT Web'
    Assert-Equal $patchedServer.Contains('Use project_resolve, workflow_create, workflow_list, workflow_update, and workflow_takeover for durable project-scoped coordination') $true 'guides ChatGPT Web to project-scoped workflow coordination tools'
    Assert-Equal $patchedServer.Contains('Project context is mandatory before progress lookup or continuation') $true 'binds generic progress and continuation to a canonical project context'
    Assert-Equal $patchedServer.Contains('never select another project because its task is newer') $true 'prevents recent cross-project work from becoming an implicit continuation target'
    Assert-Equal $patchedServer.Contains('A read-only lookup of another project never changes the current session execution binding') $true 'keeps read-only cross-project progress lookup from rebinding execution'
    Assert-Equal $patchedServer.Contains('Treat clear natural-language continuation intent') $true 'auto-routes clear cross-session intent without tool-name vocabulary'
    Assert-Equal $patchedServer.Contains('Never call workflow_run because of continuation intent alone') $true 'keeps workflow_run behind separate explicit user model authorization'
    Assert-Equal $patchedSkills.Contains('projectSkillMirrorSha256') $true 'uses SHA-256-aware project skill mirror detection'

    $skillFixture = Join-Path $testRoot 'skill-discovery'
    $globalSkills = Join-Path (Join-Path (Join-Path $skillFixture 'node-home') '.agents') 'skills'
    $projectWorkspace = Join-Path $skillFixture 'project'
    $projectSkills = Join-Path (Join-Path $projectWorkspace '.agents') 'skills'
    New-TestSkill -Root $globalSkills -Name 'shared' -Content 'global content'
    New-TestSkill -Root $projectSkills -Name 'shared' -Content 'global content'
    $canonicalGlobalSkills = [System.IO.Path]::GetFullPath($globalSkills)
    $canonicalProjectSkills = [System.IO.Path]::GetFullPath($projectSkills)

    $exactMirror = Invoke-FakeEffectiveSkillPaths -RunnerPath $skillRunner -SkillsModulePath $fakeSkills -WorkingDirectory $projectWorkspace -DevSpaceSkillsDirectory $globalSkills
    Assert-Equal $exactMirror $canonicalGlobalSkills 'removes project root only when every Skill name and SHA-256 matches an earlier root'

    New-TestSkill -Root $projectSkills -Name 'project-only' -Content 'project customisation'
    $partialOverlap = Invoke-FakeEffectiveSkillPaths -RunnerPath $skillRunner -SkillsModulePath $fakeSkills -WorkingDirectory $projectWorkspace -DevSpaceSkillsDirectory $globalSkills
    Assert-Equal $partialOverlap ($canonicalProjectSkills + '|' + $canonicalGlobalSkills) 'keeps project-local root first for partially overlapping Skills'

    Remove-Item -LiteralPath (Join-Path $projectSkills 'project-only') -Recurse -Force
    [System.IO.File]::WriteAllText((Join-Path (Join-Path $projectSkills 'shared') 'SKILL.md'), 'project override', [System.Text.UTF8Encoding]::new($false))
    $differentContent = Invoke-FakeEffectiveSkillPaths -RunnerPath $skillRunner -SkillsModulePath $fakeSkills -WorkingDirectory $projectWorkspace -DevSpaceSkillsDirectory $globalSkills
    Assert-Equal $differentContent ($canonicalProjectSkills + '|' + $canonicalGlobalSkills) 'keeps same-name project Skills whose SHA-256 differs'

    [System.IO.File]::WriteAllText((Join-Path (Join-Path $projectSkills 'shared') 'SKILL.md'), 'global content', [System.Text.UTF8Encoding]::new($false))
    $explicitProjectRoot = Invoke-FakeEffectiveSkillPaths -RunnerPath $skillRunner -SkillsModulePath $fakeSkills -WorkingDirectory $projectWorkspace -DevSpaceSkillsDirectory $globalSkills -SkillPaths @($projectSkills)
    Assert-Equal $explicitProjectRoot $canonicalGlobalSkills 'explicit config.skillPaths cannot re-add an exact project mirror'

    [System.IO.File]::WriteAllText((Join-Path (Join-Path $projectSkills 'shared') 'SKILL.md'), 'project override', [System.Text.UTF8Encoding]::new($false))
    $caseAlias = $projectSkills.ToUpperInvariant()
    $caseDeduped = Invoke-FakeEffectiveSkillPaths -RunnerPath $skillRunner -SkillsModulePath $fakeSkills -WorkingDirectory $projectWorkspace -DevSpaceSkillsDirectory $globalSkills -SkillPaths @($caseAlias)
    Assert-Equal $caseDeduped ($canonicalProjectSkills + '|' + $canonicalGlobalSkills) 'deduplicates case-only project root aliases'

    $junctionAlias = Join-Path $skillFixture 'project-skills-junction'
    New-Item -ItemType Junction -Path $junctionAlias -Target $projectSkills | Out-Null
    $junctionDeduped = Invoke-FakeEffectiveSkillPaths -RunnerPath $skillRunner -SkillsModulePath $fakeSkills -WorkingDirectory $projectWorkspace -DevSpaceSkillsDirectory $globalSkills -SkillPaths @($junctionAlias)
    Assert-Equal $junctionDeduped ($canonicalProjectSkills + '|' + $canonicalGlobalSkills) 'deduplicates junction aliases without losing project priority'

    $notARoot = Join-Path $skillFixture 'not-a-skill-root'
    [System.IO.File]::WriteAllText($notARoot, 'not a directory', [System.Text.UTF8Encoding]::new($false))
    $fileRoot = Invoke-FakeEffectiveSkillPaths -RunnerPath $skillRunner -SkillsModulePath $fakeSkills -WorkingDirectory $projectWorkspace -DevSpaceSkillsDirectory $globalSkills -SkillPaths @($notARoot)
    Assert-Equal $fileRoot ($canonicalProjectSkills + '|' + $canonicalGlobalSkills) 'ignores a configured file path without interrupting discovery'

    [System.IO.File]::WriteAllText((Join-Path (Join-Path $projectSkills 'shared') 'SKILL.md'), 'global content', [System.Text.UTF8Encoding]::new($false))
    $unreadableSkill = Invoke-FakeEffectiveSkillPaths -RunnerPath $skillRunner -SkillsModulePath $fakeSkills -WorkingDirectory $projectWorkspace -DevSpaceSkillsDirectory $globalSkills -Mode unreadable
    Assert-Equal $unreadableSkill ($canonicalProjectSkills + '|' + $canonicalGlobalSkills) 'fails open when a project Skill cannot be read'

    $missingDuringDiscovery = Invoke-FakeEffectiveSkillPaths -RunnerPath $skillRunner -SkillsModulePath $fakeSkills -WorkingDirectory $projectWorkspace -DevSpaceSkillsDirectory $globalSkills -Mode missing
    Assert-Equal $missingDuringDiscovery ($canonicalProjectSkills + '|' + $canonicalGlobalSkills) 'fails open when a Skill disappears during discovery'

    $pixiuWorkspace = Join-Path $skillFixture 'pixiu-core'
    $pixiuCanonicalSkills = Join-Path $pixiuWorkspace 'skills'
    $pixiuPortableSkills = Join-Path (Join-Path $pixiuWorkspace '.agents') 'skills'
    New-Item -ItemType Directory -Path (Join-Path $pixiuWorkspace 'vault\bootstrap') -Force | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $pixiuWorkspace 'vault\bootstrap\SESSION-BOOTSTRAP.md'), '# bootstrap', [System.Text.UTF8Encoding]::new($false))
    New-TestSkill -Root $pixiuCanonicalSkills -Name 'shared' -Content 'canonical content'
    New-TestSkill -Root $pixiuCanonicalSkills -Name 'canonical-only' -Content 'canonical only'
    New-Item -ItemType Directory -Path (Join-Path $pixiuCanonicalSkills 'reference-library') -Force | Out-Null
    [System.IO.File]::WriteAllText((Join-Path $pixiuCanonicalSkills 'reference-library\README.md'), '# not a Skill', [System.Text.UTF8Encoding]::new($false))
    New-TestSkill -Root $pixiuPortableSkills -Name 'shared' -Content 'portable publish drift'
    Remove-Item -LiteralPath $globalSkills -Recurse -Force
    New-Item -ItemType Junction -Path $globalSkills -Target $pixiuCanonicalSkills | Out-Null
    $pixiuCanonicalResult = Invoke-FakeEffectiveSkillPaths -RunnerPath $skillRunner -SkillsModulePath $fakeSkills -WorkingDirectory $pixiuWorkspace -DevSpaceSkillsDirectory $globalSkills
    Assert-Equal $pixiuCanonicalResult ([System.IO.Path]::GetFullPath($pixiuCanonicalSkills)) 'suppresses the PixiuCore portable publishing layer when canonical names cover it'

    $patchManifest = Join-Path $fakePackageRoot '.devspace-oneclick-patch-manifest.json'
    $v2Line = '                if (!existsSync(skillFile) || !statSync(skillFile).isFile()) continue;'
    $v1Skills = ([System.IO.File]::ReadAllText($fakeSkills)).Replace($v2Line + [Environment]::NewLine, '')
    [System.IO.File]::WriteAllText($fakeSkills, $v1Skills, [System.Text.UTF8Encoding]::new($false))
    $v1Manifest = Get-Content -LiteralPath $patchManifest -Raw -Encoding UTF8 | ConvertFrom-Json
    $v1SkillRecord = @($v1Manifest.files | Where-Object { [string]$_.path -eq 'dist\skills.js' })[0]
    $v1SkillRecord.patchedSha256 = (Get-FileHash -LiteralPath $fakeSkills -Algorithm SHA256).Hash.ToLowerInvariant()
    [System.IO.File]::WriteAllText($patchManifest, ($v1Manifest | ConvertTo-Json -Depth 5), [System.Text.UTF8Encoding]::new($false))
    Assert-Equal (Install-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli) 1 'upgrades a verified v1 Skill mirror patch in place'
    Assert-Equal ([System.IO.File]::ReadAllText($fakeSkills)).Contains($v2Line) $true 'v1 upgrade ignores non-Skill directories'
    $upgradedManifest = Get-Content -LiteralPath $patchManifest -Raw -Encoding UTF8 | ConvertFrom-Json
    $upgradedSkillRecord = @($upgradedManifest.files | Where-Object { [string]$_.path -eq 'dist\skills.js' })[0]
    Assert-Equal ([string]$upgradedSkillRecord.patchedSha256) ((Get-FileHash -LiteralPath $fakeSkills -Algorithm SHA256).Hash.ToLowerInvariant()) 'v1 upgrade refreshes the verified patch manifest'
    Assert-Equal (Install-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli) 0 'Subagent patch is idempotent'

    $knownServer = [System.IO.File]::ReadAllText($fakeServer)
    [System.IO.File]::WriteAllText($fakeServer, ($knownServer + [Environment]::NewLine + '// unknown drift'), [System.Text.UTF8Encoding]::new($false))
    Assert-Throws { Install-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli } 'upgrade refuses unknown target drift before writing'
    [System.IO.File]::WriteAllText($fakeServer, $knownServer, [System.Text.UTF8Encoding]::new($false))
    Assert-Equal (Test-Path -LiteralPath $patchManifest) $true 'records original and patched hashes for safe restore'

    $currentPatchedSkills = [System.IO.File]::ReadAllText($fakeSkills)
    $patchedFiles = [ordered]@{}
    $patchedFiles[(Join-Path $fakeDist 'local-agent-runtime.js')] = $patchedRuntime
    $patchedFiles[(Join-Path $fakeDist 'local-agent-profiles.js')] = $patchedProfiles
    $patchedFiles[(Join-Path $fakeSdkDist 'index.js')] = $patchedSdk
    $patchedFiles[$fakeCli] = $patchedCli
    $patchedFiles[$fakeServer] = $patchedServer
    $patchedFiles[$fakeSkills] = $currentPatchedSkills
    $skillsBackup = "$fakeSkills.devspace-oneclick-original"
    $originalSkillsBackup = [System.IO.File]::ReadAllText($skillsBackup)

    [System.IO.File]::WriteAllText($fakeSkills, ($currentPatchedSkills + [Environment]::NewLine + '// same-version hotfix'), [System.Text.UTF8Encoding]::new($false))
    $runtimeBeforeTargetDriftRestore = [System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-runtime.js'))
    Assert-Throws { Restore-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli } 'restore refuses an unknown same-version target update'
    Assert-Equal ([System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-runtime.js'))) $runtimeBeforeTargetDriftRestore 'target drift refusal writes no earlier file'
    foreach ($entry in $patchedFiles.GetEnumerator()) {
        [System.IO.File]::WriteAllText([string]$entry.Key, [string]$entry.Value, [System.Text.UTF8Encoding]::new($false))
    }

    [System.IO.File]::WriteAllText($skillsBackup, 'unknown backup drift', [System.Text.UTF8Encoding]::new($false))
    $runtimeBeforeBackupDriftRestore = [System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-runtime.js'))
    Assert-Throws { Restore-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli } 'restore refuses backup drift'
    Assert-Equal ([System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-runtime.js'))) $runtimeBeforeBackupDriftRestore 'backup drift refusal writes no earlier file'
    foreach ($entry in $patchedFiles.GetEnumerator()) {
        [System.IO.File]::WriteAllText([string]$entry.Key, [string]$entry.Value, [System.Text.UTF8Encoding]::new($false))
    }
    [System.IO.File]::WriteAllText($skillsBackup, $originalSkillsBackup, [System.Text.UTF8Encoding]::new($false))

    $missingBackup = "$skillsBackup.missing-test"
    Move-Item -LiteralPath $skillsBackup -Destination $missingBackup
    $runtimeBeforeMissingBackupRestore = [System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-runtime.js'))
    Assert-Throws { Restore-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli } 'restore refuses an incomplete backup set'
    Assert-Equal ([System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-runtime.js'))) $runtimeBeforeMissingBackupRestore 'missing backup refusal writes no earlier file'
    foreach ($entry in $patchedFiles.GetEnumerator()) {
        [System.IO.File]::WriteAllText([string]$entry.Key, [string]$entry.Value, [System.Text.UTF8Encoding]::new($false))
    }
    Move-Item -LiteralPath $missingBackup -Destination $skillsBackup

    [System.IO.File]::WriteAllText((Join-Path $fakePackageRoot 'package.json'), '{"version":"1.0.5","type":"module"}', [System.Text.UTF8Encoding]::new($false))
    $runtimeBeforeVersionDriftRestore = [System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-runtime.js'))
    Assert-Throws { Restore-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli } 'restore refuses version drift'
    Assert-Equal ([System.IO.File]::ReadAllText((Join-Path $fakeDist 'local-agent-runtime.js'))) $runtimeBeforeVersionDriftRestore 'version drift refusal writes no file'
    [System.IO.File]::WriteAllText((Join-Path $fakePackageRoot 'package.json'), '{"version":"1.0.4","type":"module"}', [System.Text.UTF8Encoding]::new($false))

    Assert-Equal (Restore-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli) 6 'restores all patched files from retained backups'
    Assert-Equal (Restore-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli) 0 'restore is idempotent when files already match recorded backups'

    $manifestWithoutBackups = "$patchManifest.no-backup-test"
    Move-Item -LiteralPath $patchManifest -Destination $manifestWithoutBackups
    $movedBackups = @()
    foreach ($entry in $patchedFiles.GetEnumerator()) {
        $backup = "$($entry.Key).devspace-oneclick-original"
        $movedBackup = "$backup.no-backup-test"
        Move-Item -LiteralPath $backup -Destination $movedBackup
        $movedBackups += [pscustomobject]@{ Backup = $backup; Moved = $movedBackup }
    }
    Assert-Equal (Restore-DevSpaceSubagentWindowsPatch -DevSpaceCli $fakeCli) 0 'restore safely no-ops when no retained backups exist'
    Move-Item -LiteralPath $manifestWithoutBackups -Destination $patchManifest
    foreach ($entry in $movedBackups) {
        Move-Item -LiteralPath $entry.Moved -Destination $entry.Backup
    }

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

    $workflowSource = Join-Path (Split-Path -Parent $PSScriptRoot) 'DevSpace.WorkflowStore.mjs'
    $repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $workflowCoreSource = Join-Path $repoRoot 'external\session-workflow\packages\session-workflow\core\index.mjs'
    $workflowProjectResolverSource = Join-Path (Split-Path -Parent $PSScriptRoot) 'DevSpace.ProjectResolver.mjs'
    $workflowBin = Join-Path $testRoot 'workflow-bin'
    $firstWorkflowInstall = Install-DevSpaceWorkflowModule -SourceFile $workflowSource -CoreSourceFile $workflowCoreSource -ProjectResolverSourceFile $workflowProjectResolverSource -BinDirectory $workflowBin
    Assert-Equal $firstWorkflowInstall.Changed $true 'installs the durable workflow module'
    Assert-Equal ([System.IO.File]::ReadAllText($firstWorkflowInstall.Path)) ([System.IO.File]::ReadAllText($workflowSource)) 'preserves workflow module content'
    Assert-Equal ([System.IO.File]::ReadAllText($firstWorkflowInstall.CorePath)) ([System.IO.File]::ReadAllText($workflowCoreSource)) 'installs the standalone workflow core dependency'
    Assert-Equal ([System.IO.File]::ReadAllText($firstWorkflowInstall.ProjectResolverPath)) ([System.IO.File]::ReadAllText($workflowProjectResolverSource)) 'installs the DevSpace project resolver dependency'
    $secondWorkflowInstall = Install-DevSpaceWorkflowModule -SourceFile $workflowSource -CoreSourceFile $workflowCoreSource -ProjectResolverSourceFile $workflowProjectResolverSource -BinDirectory $workflowBin
    Assert-Equal $secondWorkflowInstall.Changed $false 'workflow module install is idempotent'
    [System.IO.File]::AppendAllText($firstWorkflowInstall.Path, '// simulated drift', [System.Text.UTF8Encoding]::new($false))
    $repairedWorkflowInstall = Install-DevSpaceWorkflowModule -SourceFile $workflowSource -CoreSourceFile $workflowCoreSource -ProjectResolverSourceFile $workflowProjectResolverSource -BinDirectory $workflowBin
    Assert-Equal $repairedWorkflowInstall.Changed $true 'repairs a drifted managed workflow module'
    Assert-Equal (Test-Path -LiteralPath "$($firstWorkflowInstall.Path).devspace-oneclick.bak") $true 'backs up a drifted workflow module before repair'
    $workflowTestPath = Join-Path $PSScriptRoot 'workflow-store.test.mjs'
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    Assert-Equal ($null -ne $nodeCommand) $true 'finds Node.js for workflow tests'
    if ($nodeCommand) {
        $previousCoreModule = $env:SESSION_WORKFLOW_CORE_MODULE
        $previousResolverModule = $env:SESSION_WORKFLOW_DEVSPACE_PROJECT_RESOLVER_MODULE
        try {
            $env:SESSION_WORKFLOW_CORE_MODULE = $firstWorkflowInstall.CorePath
            $env:SESSION_WORKFLOW_DEVSPACE_PROJECT_RESOLVER_MODULE = $firstWorkflowInstall.ProjectResolverPath
            $managedImportOutput = @(& $nodeCommand.Source --input-type=module -e "import { pathToFileURL } from 'node:url'; await import(pathToFileURL(process.argv[1]).href);" $firstWorkflowInstall.Path 2>&1)
            Assert-Equal $LASTEXITCODE 0 'loads the managed workflow module with installed standalone dependencies'
            $workflowTestOutput = @(& $nodeCommand.Source --test $workflowTestPath 2>&1)
            $workflowTestExitCode = $LASTEXITCODE
            if ($workflowTestExitCode -ne 0) {
                Write-Host ($workflowTestOutput -join [Environment]::NewLine)
            }
            Assert-Equal $workflowTestExitCode 0 'passes durable workflow state and MCP tests against the newly installed modules'
        }
        finally {
            $env:SESSION_WORKFLOW_CORE_MODULE = $previousCoreModule
            $env:SESSION_WORKFLOW_DEVSPACE_PROJECT_RESOLVER_MODULE = $previousResolverModule
        }
    }

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
