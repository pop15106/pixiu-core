Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-DevSpaceAgentId {
    param([Parameter(Mandatory = $true)][string]$AgentId)

    if ($AgentId -notmatch '^agt_[a-f0-9]{8}$') {
        throw "Invalid DevSpace Agent ID: $AgentId"
    }
    return $AgentId
}

function Format-DevSpaceAgentText {
    param(
        [AllowNull()]$Value,
        [ValidateRange(80, 4000)][int]$MaxLength = 800
    )

    if ($null -eq $Value) {
        return ''
    }
    $text = ([string]$Value -replace '\s+', ' ').Trim()
    if ($text.Length -le $MaxLength) {
        return $text
    }
    return $text.Substring(0, $MaxLength - 3) + '...'
}

function Get-DevSpaceAgentRecordText {
    param(
        [Parameter(Mandatory = $true)]$Record,
        [Parameter(Mandatory = $true)][string]$PropertyName,
        [ValidateRange(80, 4000)][int]$MaxLength = 800
    )

    $property = $Record.PSObject.Properties[$PropertyName]
    if ($null -eq $property) {
        return ''
    }
    return Format-DevSpaceAgentText -Value $property.Value -MaxLength $MaxLength
}

function Set-PatchedTextFile {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)][string]$AlreadyPatchedText,
        [Parameter(Mandatory = $true)][string]$Pattern,
        [Parameter(Mandatory = $true)][string]$Replacement,
        [Parameter(Mandatory = $true)][string]$Description
    )

    if (-not (Test-Path -LiteralPath $FilePath)) {
        throw "DevSpace patch target is missing: $FilePath"
    }

    $content = [System.IO.File]::ReadAllText($FilePath)
    if ($content.Contains($AlreadyPatchedText)) {
        return $false
    }

    $regex = [regex]::new($Pattern, [System.Text.RegularExpressions.RegexOptions]::Multiline)
    if (-not $regex.IsMatch($content)) {
        throw "DevSpace 1.0.4 patch point not found for $Description in $FilePath"
    }

    $backupPath = "$FilePath.devspace-oneclick-original"
    if (-not (Test-Path -LiteralPath $backupPath)) {
        Copy-Item -LiteralPath $FilePath -Destination $backupPath -Force
    }

    $evaluator = [System.Text.RegularExpressions.MatchEvaluator]{
        param($Match)
        return $Replacement
    }
    $updated = $regex.Replace($content, $evaluator, 1)
    [System.IO.File]::WriteAllText($FilePath, $updated, [System.Text.UTF8Encoding]::new($false))
    return $true
}

function Install-DevSpaceSubagentWindowsPatch {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$DevSpaceCli)

    $packageRoot = Split-Path -Parent (Split-Path -Parent $DevSpaceCli)
    $packageJsonPath = Join-Path $packageRoot 'package.json'
    if (-not (Test-Path -LiteralPath $packageJsonPath)) {
        throw "DevSpace package metadata is missing: $packageJsonPath"
    }

    $package = Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]$package.version -ne '1.0.4') {
        throw "The bundled Windows subagent patch supports DevSpace 1.0.4 only; found $($package.version)."
    }

    $runtimePath = Join-Path $packageRoot 'dist\local-agent-runtime.js'
    $sdkPath = Join-Path $packageRoot 'node_modules\@openai\codex-sdk\dist\index.js'
    $cliPath = Join-Path $packageRoot 'dist\cli.js'
    $changed = 0

    $runtimeGitReplacement = @(
        'workingDirectory: input.workspace,'
        '        skipGitRepoCheck: true,'
        '        sandboxMode:'
    ) -join "`r`n"
    if (Set-PatchedTextFile -FilePath $runtimePath -AlreadyPatchedText 'skipGitRepoCheck: true,' -Pattern 'workingDirectory: input\.workspace,\r?\n\s*sandboxMode:' -Replacement $runtimeGitReplacement -Description 'non-Git allowed workspace support') {
        $changed++
    }

    $runtimePathReplacement = @(
        'const inheritedPath = process.env.Path ?? process.env.PATH ?? "";'
        '    return (options) => new module.Codex({'
        '        ...options,'
        '        config: {'
        '            ...options?.config,'
        '            shell_environment_policy: {'
        '                inherit: "all",'
        '                set: { Path: inheritedPath },'
        '            },'
        '        },'
        '    });'
    ) -join "`r`n"
    if (Set-PatchedTextFile -FilePath $runtimePath -AlreadyPatchedText 'shell_environment_policy:' -Pattern 'return \(options\) => new module\.Codex\(options\);' -Replacement $runtimePathReplacement -Description 'Node and npm PATH inheritance') {
        $changed++
    }

    $sdkReplacement = @(
        'const child = spawn(this.executablePath, commandArgs, {'
        '      env,'
        '      signal: args.signal,'
        '      windowsHide: process.platform === "win32"'
        '    });'
    ) -join "`r`n"
    if (Set-PatchedTextFile -FilePath $sdkPath -AlreadyPatchedText 'windowsHide: process.platform === "win32"' -Pattern 'const child = spawn\(this\.executablePath, commandArgs, \{\r?\n\s*env,\r?\n\s*signal: args\.signal\r?\n\s*\}\);' -Replacement $sdkReplacement -Description 'hidden Codex child process') {
        $changed++
    }

    if (Set-PatchedTextFile -FilePath $cliPath -AlreadyPatchedText 'const deadline = Date.now() + 1_000;' -Pattern 'const deadline = Date\.now\(\) \+ 15_000;' -Replacement 'const deadline = Date.now() + 1_000;' -Description 'fast agent status polling') {
        $changed++
    }

    $workerReplacement = @(
        'detached: true,'
        '        stdio: "ignore",'
        '        env: process.env,'
        '        windowsHide: process.platform === "win32",'
    ) -join "`r`n"
    if (Set-PatchedTextFile -FilePath $cliPath -AlreadyPatchedText 'windowsHide: process.platform === "win32",' -Pattern 'detached: true,\r?\n\s*stdio: "ignore",\r?\n\s*env: process\.env,' -Replacement $workerReplacement -Description 'hidden DevSpace worker process') {
        $changed++
    }

    $exitReplacement = @(
        'main(process.argv.slice(2)).then(() => {'
        '    const isShortAgentCommand = process.argv[2] === "agents" && process.argv[3] !== "__worker";'
        '    if (isShortAgentCommand) process.exit(0);'
        '}).catch((error) => {'
    ) -join "`r`n"
    if (Set-PatchedTextFile -FilePath $cliPath -AlreadyPatchedText 'const isShortAgentCommand = process.argv[2] === "agents"' -Pattern 'main\(process\.argv\.slice\(2\)\)\.catch\(\(error\) => \{' -Replacement $exitReplacement -Description 'prompt completion of agent CLI commands') {
        $changed++
    }

    return $changed
}

function Install-DevSpaceAgentProfiles {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$ConfigRoot,
        [Parameter(Mandatory = $true)][string]$SourceDirectory
    )

    $targetDirectory = Join-Path $ConfigRoot 'agents'
    if (-not (Test-Path -LiteralPath $targetDirectory)) {
        New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
    }

    $installed = @()
    foreach ($source in @(Get-ChildItem -LiteralPath $SourceDirectory -Filter '*.md' -File)) {
        $target = Join-Path $targetDirectory $source.Name
        $sourceContent = [System.IO.File]::ReadAllText($source.FullName)
        $targetContent = if (Test-Path -LiteralPath $target) { [System.IO.File]::ReadAllText($target) } else { $null }
        if ($targetContent -eq $sourceContent) {
            continue
        }
        if ($null -ne $targetContent) {
            Copy-Item -LiteralPath $target -Destination "$target.devspace-oneclick.bak" -Force
        }
        [System.IO.File]::WriteAllText($target, $sourceContent, [System.Text.UTF8Encoding]::new($false))
        $installed += $target
    }
    return [string[]]$installed
}

function Invoke-DevSpaceAgentAdmin {
    param(
        [Parameter(Mandatory = $true)][string]$NodePath,
        [Parameter(Mandatory = $true)][string]$DevSpaceCli,
        [Parameter(Mandatory = $true)][string]$AdminScript,
        [Parameter(Mandatory = $true)][ValidateSet('list', 'show', 'mark-stopped')][string]$Action,
        [string]$AgentId
    )

    $arguments = @($AdminScript, $DevSpaceCli, $Action)
    if (-not [string]::IsNullOrWhiteSpace($AgentId)) {
        $arguments += (Assert-DevSpaceAgentId -AgentId $AgentId)
    }
    $output = (& $NodePath @arguments 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "DevSpace Agent admin failed: $output"
    }
    if ([string]::IsNullOrWhiteSpace($output)) {
        return $null
    }
    return $output | ConvertFrom-Json
}

function Get-DevSpaceAgentStatus {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$NodePath,
        [Parameter(Mandatory = $true)][string]$DevSpaceCli,
        [Parameter(Mandatory = $true)][string]$AdminScript,
        [string]$AgentId
    )

    $action = if ([string]::IsNullOrWhiteSpace($AgentId)) { 'list' } else { 'show' }
    return Invoke-DevSpaceAgentAdmin -NodePath $NodePath -DevSpaceCli $DevSpaceCli -AdminScript $AdminScript -Action $action -AgentId $AgentId
}

function Stop-DevSpaceAgent {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$NodePath,
        [Parameter(Mandatory = $true)][string]$DevSpaceCli,
        [Parameter(Mandatory = $true)][string]$AdminScript,
        [Parameter(Mandatory = $true)][string]$AgentId
    )

    $validatedId = Assert-DevSpaceAgentId -AgentId $AgentId
    $record = Invoke-DevSpaceAgentAdmin -NodePath $NodePath -DevSpaceCli $DevSpaceCli -AdminScript $AdminScript -Action show -AgentId $validatedId
    $allProcesses = @(Get-CimInstance Win32_Process)
    $workerPattern = "(?i)agents\s+__worker\s+$([regex]::Escape($validatedId))\s+--prompt-file"
    $workerIds = @($allProcesses | Where-Object {
        $_.Name -ieq 'node.exe' -and
        $_.CommandLine -match $workerPattern -and
        $_.CommandLine -match '(?i)@waishnav[\\/]devspace[\\/]dist[\\/]cli\.js'
    } | ForEach-Object { [int]$_.ProcessId })

    $depthById = @{}
    function Add-ProcessTree {
        param([int]$ProcessId, [int]$Depth)
        if ($depthById.ContainsKey($ProcessId)) {
            return
        }
        $depthById[$ProcessId] = $Depth
        foreach ($child in @($allProcesses | Where-Object { [int]$_.ParentProcessId -eq $ProcessId })) {
            Add-ProcessTree -ProcessId ([int]$child.ProcessId) -Depth ($Depth + 1)
        }
    }

    foreach ($workerId in $workerIds) {
        Add-ProcessTree -ProcessId $workerId -Depth 0
    }

    foreach ($entry in @($depthById.GetEnumerator() | Sort-Object Value -Descending)) {
        Stop-Process -Id ([int]$entry.Key) -Force -ErrorAction SilentlyContinue
    }

    $updated = Invoke-DevSpaceAgentAdmin -NodePath $NodePath -DevSpaceCli $DevSpaceCli -AdminScript $AdminScript -Action mark-stopped -AgentId $validatedId
    return [pscustomobject]@{
        Record = $updated
        StoppedProcessIds = [int[]]@($depthById.Keys)
        PreviousStatus = [string]$record.status
    }
}

Export-ModuleMember -Function @(
    'Assert-DevSpaceAgentId',
    'Format-DevSpaceAgentText',
    'Get-DevSpaceAgentRecordText',
    'Install-DevSpaceSubagentWindowsPatch',
    'Install-DevSpaceAgentProfiles',
    'Get-DevSpaceAgentStatus',
    'Stop-DevSpaceAgent'
)
