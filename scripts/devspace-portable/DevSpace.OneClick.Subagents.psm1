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
    $profilePath = Join-Path $packageRoot 'dist\local-agent-profiles.js'
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

    $runtimeTimeoutReplacement = @(
        'const timeoutMs = input.timeoutMs;'
        '        const controller = timeoutMs ? new AbortController() : undefined;'
        '        const timeoutHandle = controller ? setTimeout(() => controller.abort(), timeoutMs) : undefined;'
        '        let turn;'
        '        try {'
        '            turn = await thread.run(input.prompt, { signal: controller?.signal });'
        '        }'
        '        catch (error) {'
        '            if (controller?.signal.aborted) {'
        '                throw new Error("Subagent timed out after " + Math.round(timeoutMs / 1000) + " seconds.");'
        '            }'
        '            throw error;'
        '        }'
        '        finally {'
        '            if (timeoutHandle) clearTimeout(timeoutHandle);'
        '        }'
    ) -join [Environment]::NewLine
    if (Set-PatchedTextFile -FilePath $runtimePath -AlreadyPatchedText 'Subagent timed out after ' -Pattern 'const turn = await thread\.run\(input\.prompt\);' -Replacement $runtimeTimeoutReplacement -Description 'bounded subagent execution time') {
        $changed++
    }

    $profileFieldsReplacement = @(
        'thinking: readString(frontmatter, "thinking"),'
        '        writeMode: readWriteMode(frontmatter, filePath),'
        '        timeoutSeconds: readTimeoutSeconds(frontmatter, filePath),'
        '        filePath,'
    ) -join [Environment]::NewLine
    if (Set-PatchedTextFile -FilePath $profilePath -AlreadyPatchedText 'timeoutSeconds: readTimeoutSeconds' -Pattern 'thinking: readString\(frontmatter, "thinking"\),\r?\n\s*filePath,' -Replacement $profileFieldsReplacement -Description 'profile execution controls') {
        $changed++
    }

    $profileReadersReplacement = @(
        'function readWriteMode(frontmatter, filePath) {'
        '    const value = readString(frontmatter, "writeMode");'
        '    if (value === undefined || value === "read_only" || value === "allowed" || value === "full_access") return value;'
        '    throw new Error("Subagent profile writeMode must be read_only, allowed, or full_access: " + filePath);'
        '}'
        'function readTimeoutSeconds(frontmatter, filePath) {'
        '    const value = frontmatter.timeoutSeconds;'
        '    if (value === undefined) return undefined;'
        '    if (!Number.isInteger(value) || value < 60 || value > 3600) {'
        '        throw new Error("Subagent profile timeoutSeconds must be an integer from 60 to 3600: " + filePath);'
        '    }'
        '    return value;'
        '}'
        'function readString(frontmatter, key) {'
    ) -join [Environment]::NewLine
    if (Set-PatchedTextFile -FilePath $profilePath -AlreadyPatchedText 'function readWriteMode(frontmatter, filePath)' -Pattern 'function readString\(frontmatter, key\) \{' -Replacement $profileReadersReplacement -Description 'profile execution-control validation') {
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

    $profileExecutionReplacement = @(
        'writeMode: profile.writeMode ?? "allowed",'
        '        timeoutMs: profile.timeoutSeconds ? profile.timeoutSeconds * 1000 : undefined,'
        '        model: record.model ?? profile.model,'
    ) -join [Environment]::NewLine
    if (Set-PatchedTextFile -FilePath $cliPath -AlreadyPatchedText 'timeoutMs: profile.timeoutSeconds ?' -Pattern 'writeMode: "allowed",\r?\n\s*model: record\.model \?\? profile\.model,' -Replacement $profileExecutionReplacement -Description 'profile write mode and timeout enforcement') {
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

function ConvertTo-DevSpaceBashPath {
    param([Parameter(Mandatory = $true)][string]$FilePath)

    $fullPath = [System.IO.Path]::GetFullPath($FilePath)
    if ($fullPath -match '^([A-Za-z]):\\(.*)$') {
        return '/' + $Matches[1].ToLowerInvariant() + '/' + $Matches[2].Replace('\', '/')
    }
    return $fullPath.Replace('\', '/')
}

function Install-DevSpaceAgentCliShim {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$NodePath,
        [Parameter(Mandatory = $true)][string]$DevSpaceCli,
        [Parameter(Mandatory = $true)][string]$AdminScript,
        [Parameter(Mandatory = $true)][string]$BinDirectory
    )

    foreach ($requiredPath in @($NodePath, $DevSpaceCli, $AdminScript)) {
        if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
            throw "DevSpace Agent CLI shim dependency is missing: $requiredPath"
        }
    }
    if (-not (Test-Path -LiteralPath $BinDirectory)) {
        New-Item -ItemType Directory -Path $BinDirectory -Force | Out-Null
    }

    $stableAdmin = Join-Path $BinDirectory 'DevSpace.AgentAdmin.mjs'
    Copy-Item -LiteralPath $AdminScript -Destination $stableAdmin -Force

    $shellTemplate = @(
        '#!/usr/bin/env bash'
        'if [ "$1" = "agents" ]; then'
        '  case "$2" in'
        '    ls|list)'
        '      exec "__NODE__" "__ADMIN__" "__CLI__" cli-list'
        '      ;;'
        '    show)'
        '      agent_id="$3"'
        '      exec "__NODE__" "__ADMIN__" "__CLI__" cli-show "$agent_id"'
        '      ;;'
        '  esac'
        'fi'
        'exec "__NODE__" "__CLI__" "$@"'
    ) -join [Environment]::NewLine
    $shellContent = $shellTemplate.
        Replace('__NODE__', (ConvertTo-DevSpaceBashPath -FilePath $NodePath)).
        Replace('__ADMIN__', (ConvertTo-DevSpaceBashPath -FilePath $stableAdmin)).
        Replace('__CLI__', (ConvertTo-DevSpaceBashPath -FilePath $DevSpaceCli))
    $shellPath = Join-Path $BinDirectory 'devspace'
    [System.IO.File]::WriteAllText($shellPath, $shellContent, [System.Text.UTF8Encoding]::new($false))

    $cmdTemplate = @(
        '@echo off'
        'if /I "%~1"=="agents" if /I "%~2"=="ls" goto agent_list'
        'if /I "%~1"=="agents" if /I "%~2"=="list" goto agent_list'
        'if /I "%~1"=="agents" if /I "%~2"=="show" goto agent_show'
        'goto passthrough'
        ':agent_list'
        '"__NODE__" "__ADMIN__" "__CLI__" cli-list'
        'exit /b %ERRORLEVEL%'
        ':agent_show'
        '"__NODE__" "__ADMIN__" "__CLI__" cli-show "%~3"'
        'exit /b %ERRORLEVEL%'
        ':passthrough'
        '"__NODE__" "__CLI__" %*'
        'exit /b %ERRORLEVEL%'
    ) -join [Environment]::NewLine
    $cmdContent = $cmdTemplate.
        Replace('__NODE__', $NodePath).
        Replace('__ADMIN__', $stableAdmin).
        Replace('__CLI__', $DevSpaceCli)
    $cmdPath = Join-Path $BinDirectory 'devspace.cmd'
    [System.IO.File]::WriteAllText($cmdPath, $cmdContent, [System.Text.UTF8Encoding]::new($false))

    return [pscustomobject]@{
        BinDirectory = $BinDirectory
        ShellPath = $shellPath
        CmdPath = $cmdPath
        AdminPath = $stableAdmin
    }
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
    'Install-DevSpaceAgentCliShim',
    'Get-DevSpaceAgentStatus',
    'Stop-DevSpaceAgent'
)
