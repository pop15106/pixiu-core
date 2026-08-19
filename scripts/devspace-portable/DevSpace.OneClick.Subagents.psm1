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

function Get-DevSpacePatchFileSha256 {
    param([Parameter(Mandatory = $true)][string]$FilePath)

    $stream = [System.IO.File]::OpenRead($FilePath)
    try {
        $sha256 = [System.Security.Cryptography.SHA256]::Create()
        try {
            return ([System.BitConverter]::ToString($sha256.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
        }
        finally {
            $sha256.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Get-DevSpacePatchTargets {
    param([Parameter(Mandatory = $true)][string]$PackageRoot)

    return @(
        'dist\local-agent-runtime.js',
        'dist\local-agent-profiles.js',
        'node_modules\@openai\codex-sdk\dist\index.js',
        'dist\cli.js',
        'dist\server.js',
        'dist\skills.js'
    ) | ForEach-Object {
        $target = Join-Path $PackageRoot $_
        [pscustomobject]@{
            RelativePath = $_
            Target = $target
            Backup = "$target.devspace-oneclick-original"
        }
    }
}

function Write-DevSpacePatchManifest {
    param([Parameter(Mandatory = $true)][string]$PackageRoot)

    $files = @(
        foreach ($entry in @(Get-DevSpacePatchTargets -PackageRoot $PackageRoot)) {
            if (-not (Test-Path -LiteralPath $entry.Target) -or -not (Test-Path -LiteralPath $entry.Backup)) {
                throw "Cannot record DevSpace patch state because a target or backup is missing: $($entry.RelativePath)"
            }
            [ordered]@{
                path = $entry.RelativePath
                backupSha256 = Get-DevSpacePatchFileSha256 -FilePath $entry.Backup
                patchedSha256 = Get-DevSpacePatchFileSha256 -FilePath $entry.Target
            }
        }
    )
    $manifest = [ordered]@{
        schemaVersion = 1
        devSpaceVersion = '1.0.4'
        files = $files
    }
    $manifestPath = Join-Path $PackageRoot '.devspace-oneclick-patch-manifest.json'
    $temporaryPath = "$manifestPath.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [System.IO.File]::WriteAllText(
            $temporaryPath,
            ($manifest | ConvertTo-Json -Depth 5),
            [System.Text.UTF8Encoding]::new($false)
        )
        Move-Item -LiteralPath $temporaryPath -Destination $manifestPath -Force
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force
        }
    }
}

function Assert-DevSpacePatchInstallState {
    param([Parameter(Mandatory = $true)][string]$PackageRoot)

    $targets = @(Get-DevSpacePatchTargets -PackageRoot $PackageRoot)
    $manifestPath = Join-Path $PackageRoot '.devspace-oneclick-patch-manifest.json'
    $existingBackups = @($targets | Where-Object { Test-Path -LiteralPath $_.Backup })

    if (-not (Test-Path -LiteralPath $manifestPath)) {
        if ($existingBackups.Count -gt 0) {
            throw "DevSpace patch manifest is missing; refusing to upgrade unverified backups: $manifestPath"
        }
        return
    }

    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "DevSpace patch manifest is unreadable; refusing to upgrade: $manifestPath"
    }
    if ([int]$manifest.schemaVersion -ne 1 -or [string]$manifest.devSpaceVersion -ne '1.0.4') {
        throw "DevSpace patch manifest is unsupported; refusing to upgrade: $manifestPath"
    }

    $manifestFiles = @($manifest.files)
    if ($manifestFiles.Count -ne $targets.Count) {
        throw "DevSpace patch manifest file set is incomplete; refusing to upgrade: $manifestPath"
    }
    $manifestByPath = @{}
    foreach ($file in $manifestFiles) {
        $relativePath = [string]$file.path
        if ([string]::IsNullOrWhiteSpace($relativePath) -or $manifestByPath.ContainsKey($relativePath)) {
            throw "DevSpace patch manifest contains an invalid file entry; refusing to upgrade: $manifestPath"
        }
        $manifestByPath[$relativePath] = $file
    }

    foreach ($entry in $targets) {
        if (-not $manifestByPath.ContainsKey($entry.RelativePath)) {
            throw "DevSpace patch manifest is missing $($entry.RelativePath); refusing to upgrade."
        }
        if (-not (Test-Path -LiteralPath $entry.Target) -or -not (Test-Path -LiteralPath $entry.Backup)) {
            throw "DevSpace patch target or backup is missing for $($entry.RelativePath); refusing to upgrade."
        }

        $record = $manifestByPath[$entry.RelativePath]
        $backupHash = Get-DevSpacePatchFileSha256 -FilePath $entry.Backup
        $targetHash = Get-DevSpacePatchFileSha256 -FilePath $entry.Target
        if (-not [string]::Equals($backupHash, [string]$record.backupSha256, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "DevSpace patch backup drift detected for $($entry.RelativePath); refusing to upgrade."
        }
        $knownPatched = [string]::Equals($targetHash, [string]$record.patchedSha256, [System.StringComparison]::OrdinalIgnoreCase)
        $alreadyRestored = [string]::Equals($targetHash, $backupHash, [System.StringComparison]::OrdinalIgnoreCase)
        if (-not $knownPatched -and -not $alreadyRestored) {
            throw "Unknown DevSpace 1.0.4 target drift detected for $($entry.RelativePath); refusing to upgrade."
        }
    }
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
    $serverPath = Join-Path $packageRoot 'dist\server.js'
    $skillsPath = Join-Path $packageRoot 'dist\skills.js'
    Assert-DevSpacePatchInstallState -PackageRoot $packageRoot
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

    $webProcessGuidanceReplacement = 'Use exec_command for npm, builds, tests, and DevSpace Agent status commands, or any command likely to take more than 20 seconds. If exec_command returns running with a sessionId, call write_stdin with the same workspaceId and sessionId until running is false; do not report success before exitCode is 0. Use ${toolNames.shell} only for short commands. Prefer ${toolNames.edit} for targeted modifications,'
    if (Set-PatchedTextFile -FilePath $serverPath -AlreadyPatchedText 'Use exec_command for npm, builds, tests, and DevSpace Agent status commands' -Pattern 'Prefer \$\{toolNames\.edit\} for targeted modifications,' -Replacement $webProcessGuidanceReplacement -Description 'ChatGPT Web long-command guidance') {
        $changed++
    }

    $webProcessRegistrationReplacement = @(
        '    // DevSpace OneClick: expose resumable process sessions to ChatGPT Web.'
        '    registerCodexProcessTools(server, config, workspaces, processSessions);'
    ) -join [Environment]::NewLine
    if (Set-PatchedTextFile -FilePath $serverPath -AlreadyPatchedText 'DevSpace OneClick: expose resumable process sessions to ChatGPT Web.' -Pattern 'if \(config\.toolMode === "codex"\) \{\r?\n\s*registerCodexProcessTools\(server, config, workspaces, processSessions\);\r?\n\s*\}' -Replacement $webProcessRegistrationReplacement -Description 'ChatGPT Web process-session tools') {
        $changed++
    }

    $workflowLoaderReplacement = @(
        'import { formatLocalAgentProviderAvailabilitySummary, getLocalAgentProviderAvailabilitySnapshot, } from "./local-agent-availability.js";'
        'import { pathToFileURL } from "node:url";'
        'const devSpaceWorkflowModule = process.env.DEVSPACE_WORKFLOW_MODULE'
        '    ? await import(pathToFileURL(process.env.DEVSPACE_WORKFLOW_MODULE).href)'
        '    : undefined;'
    ) -join [Environment]::NewLine
    if (Set-PatchedTextFile -FilePath $serverPath -AlreadyPatchedText 'const devSpaceWorkflowModule = process.env.DEVSPACE_WORKFLOW_MODULE' -Pattern 'import \{ formatLocalAgentProviderAvailabilitySummary, getLocalAgentProviderAvailabilitySnapshot, \} from "\.\/local-agent-availability\.js";' -Replacement $workflowLoaderReplacement -Description 'cross-session workflow module loading') {
        $changed++
    }

    $workflowRegistrationReplacement = @(
        '    // DevSpace OneClick: expose resumable process sessions to ChatGPT Web.'
        '    registerCodexProcessTools(server, config, workspaces, processSessions);'
        '    // DevSpace OneClick: expose durable cross-session handoff and review tools.'
        '    devSpaceWorkflowModule?.registerDevSpaceWorkflowTools({'
        '        server, config, workspaces, registerAppTool, z,'
        '    });'
    ) -join [Environment]::NewLine
    if (Set-PatchedTextFile -FilePath $serverPath -AlreadyPatchedText 'DevSpace OneClick: expose durable cross-session handoff and review tools.' -Pattern '\s*\/\/ DevSpace OneClick: expose resumable process sessions to ChatGPT Web\.\r?\n\s*registerCodexProcessTools\(server, config, workspaces, processSessions\);' -Replacement ([Environment]::NewLine + $workflowRegistrationReplacement) -Description 'ChatGPT Web workflow tools') {
        $changed++
    }

    $workflowGuidanceReplacement = 'Use workflow_create, workflow_list, and workflow_update for durable cross-session coordination. Treat clear natural-language continuation intent such as "continue in the next session", "another chat should take over", "I will open a new chat and continue", or an explicitly named other project taking over as a workflow request; do not require the user to say workflow, handoff, claim, or acknowledge. When the current session is handing work off, create or reuse the matching task, claim it if needed, then hand it off. When a new session says it is resuming or taking over, call workflow_list first and acknowledge the single clearly matching pending handoff. Use same_project for another session in the same workspace root and cross_project only when the target project workspace is explicitly known and opened. Ask only when the target, scope, or matching task is ambiguous or when multiple plausible tasks remain. Do not create a workflow from vague closure such as "先這樣" without clear continuation intent. Never call workflow_run because of continuation intent alone; workflow_run requires separate explicit user authorization in the current conversation to use an Agent/model. Use workflow_sync only for a run that the user already authorized. Use exec_command for npm, builds, tests, and DevSpace Agent status commands'
    $serverContentForWorkflowGuidance = [System.IO.File]::ReadAllText($serverPath)
    $workflowGuidanceCandidates = @(
        'Use workflow_create, workflow_list, workflow_update, workflow_run, and workflow_sync for durable cross-session handoff or independent review. Use exec_command for npm, builds, tests, and DevSpace Agent status commands',
        'Use workflow_create, workflow_list, and workflow_update for durable cross-session coordination. Do not call workflow_run unless the user explicitly asks in the current conversation to use an Agent/model; workflow_run enforces this authorization gate. Use workflow_sync only for a run that the user already authorized. Use exec_command for npm, builds, tests, and DevSpace Agent status commands'
    )
    foreach ($candidate in $workflowGuidanceCandidates) {
        if ($serverContentForWorkflowGuidance.Contains($candidate)) {
            if (Set-PatchedTextFile -FilePath $serverPath -AlreadyPatchedText 'Treat clear natural-language continuation intent' -Pattern ([regex]::Escape($candidate)) -Replacement $workflowGuidanceReplacement -Description 'upgrade ChatGPT Web workflow semantic guidance') {
                $changed++
                $serverContentForWorkflowGuidance = [System.IO.File]::ReadAllText($serverPath)
            }
        }
    }
    if (Set-PatchedTextFile -FilePath $serverPath -AlreadyPatchedText 'Treat clear natural-language continuation intent' -Pattern 'Use exec_command for npm, builds, tests, and DevSpace Agent status commands' -Replacement $workflowGuidanceReplacement -Description 'ChatGPT Web workflow guidance') {
        $changed++
    }

    if (Set-PatchedTextFile -FilePath $skillsPath -AlreadyPatchedText 'projectSkillMirrorSha256' -Pattern 'import \{ existsSync(?:, readdirSync)? \} from "node:fs";' -Replacement ('import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from "node:fs";' + [Environment]::NewLine + 'import { createHash } from "node:crypto";') -Description 'safe skill mirror inspection') {
        $changed++
    }

    $skillMirrorReplacement = @(
        '    function canonicalSkillRoot(path) {'
        '        try {'
        '            if (path === undefined || !existsSync(path) || !statSync(path).isDirectory()) return undefined;'
        '            return realpathSync.native ? realpathSync.native(path) : realpathSync(path);'
        '        } catch {'
        '            return undefined;'
        '        }'
        '    }'
        '    function skillEntries(root) {'
        '        try {'
        '            const entries = new Map();'
        '            for (const entry of readdirSync(root, { withFileTypes: true })) {'
        '                if (!entry.isDirectory()) continue;'
        '                const skillFile = join(root, entry.name, "SKILL.md");'
        '                if (!existsSync(skillFile) || !statSync(skillFile).isFile()) continue;'
        '                entries.set(entry.name, createHash("sha256").update(readFileSync(skillFile)).digest("hex"));'
        '            }'
        '            return entries;'
        '        } catch {'
        '            return undefined;'
        '        }'
        '    }'
        '    function projectSkillMirrorSha256(candidate, earlierPaths) {'
        '        const candidateEntries = skillEntries(candidate);'
        '        if (candidateEntries === undefined || candidateEntries.size === 0) return false;'
        '        const earlierEntries = earlierPaths.map(skillEntries);'
        '        if (earlierEntries.some((entries) => entries === undefined)) return false;'
        '        const hashesByName = new Map();'
        '        for (const entries of earlierEntries) for (const [name, hash] of entries) {'
        '            const hashes = hashesByName.get(name) ?? new Set();'
        '            hashes.add(hash);'
        '            hashesByName.set(name, hashes);'
        '        }'
        '        return [...candidateEntries].every(([name, hash]) => {'
        '            const hashes = hashesByName.get(name);'
        '            return hashes !== undefined && hashes.size === 1 && hashes.has(hash);'
        '        });'
        '    }'
        '    function pixiuCanonicalSkillMirror(candidate, earlierPaths) {'
        '        const bootstrap = resolve(cwd, "vault", "bootstrap", "SESSION-BOOTSTRAP.md");'
        '        const canonical = canonicalSkillRoot(resolve(cwd, "skills"));'
        '        if (!existsSync(bootstrap) || canonical === undefined || !earlierPaths.includes(canonical)) return false;'
        '        const candidateEntries = skillEntries(candidate);'
        '        const canonicalEntries = skillEntries(canonical);'
        '        if (candidateEntries === undefined || canonicalEntries === undefined || candidateEntries.size === 0) return false;'
        '        return [...candidateEntries.keys()].every((name) => canonicalEntries.has(name));'
        '    }'
        '    function resolvedSkillRoot(path) {'
        '        try { return canonicalSkillRoot(resolveSkillPath(path, cwd)); } catch { return undefined; }'
        '    }'
        '    const defaultPaths = defaultPathCandidates.map(canonicalSkillRoot).filter((path) => path !== undefined);'
        '    const projectSkillPath = canonicalSkillRoot(resolve(cwd, ".agents", "skills"));'
        '    const earlierPaths = projectSkillPath === undefined ? [] : defaultPaths.slice(0, defaultPaths.findIndex((path) => path === projectSkillPath));'
        '    const skipProjectSkillPath = projectSkillPath !== undefined && ('
        '        projectSkillMirrorSha256(projectSkillPath, earlierPaths) ||'
        '        pixiuCanonicalSkillMirror(projectSkillPath, earlierPaths)'
        '    );'
        '    const orderedPaths = ['
        '        ...(projectSkillPath !== undefined && !skipProjectSkillPath ? [projectSkillPath] : []),'
        '        ...defaultPaths.filter((path) => path !== projectSkillPath),'
        '        ...(config.skillPaths ?? []).map(resolvedSkillRoot).filter((path) => path !== undefined && (!skipProjectSkillPath || path !== projectSkillPath)),'
        '    ];'
        '    const seen = new Set();'
        '    return orderedPaths'
        '        .filter((path) => {'
        '            const key = process.platform === "win32" ? path.toLowerCase() : path;'
        '            if (seen.has(key)) return false;'
        '            seen.add(key);'
        '            return true;'
        '        })'
    ) -join [Environment]::NewLine
    if (Set-PatchedTextFile -FilePath $skillsPath -AlreadyPatchedText 'projectSkillMirrorSha256' -Pattern 'const defaultPaths = defaultPathCandidates\.filter\(\(path\) => path !== undefined && existsSync\(path\)\);\r?\n[\s\S]*?return \[\.\.\.(?:defaultPaths|filteredDefaultPaths), \.\.\.config\.skillPaths\]' -Replacement $skillMirrorReplacement -Description 'content-aware project skill mirror suppression') {
        $changed++
    }

    $skillEntryUpgradeReplacement = @(
        '                const skillFile = join(root, entry.name, "SKILL.md");'
        '                if (!existsSync(skillFile) || !statSync(skillFile).isFile()) continue;'
        '                entries.set(entry.name, createHash("sha256").update(readFileSync(skillFile)).digest("hex"));'
    ) -join [Environment]::NewLine
    if (Set-PatchedTextFile -FilePath $skillsPath -AlreadyPatchedText 'if (!existsSync(skillFile) || !statSync(skillFile).isFile()) continue;' -Pattern 'const skillFile = join\(root, entry\.name, "SKILL\.md"\);\r?\n\s*entries\.set\(entry\.name, createHash\("sha256"\)\.update\(readFileSync\(skillFile\)\)\.digest\("hex"\)\);' -Replacement $skillEntryUpgradeReplacement -Description 'ignore non-Skill directories during mirror inspection') {
        $changed++
    }

    if ($changed -gt 0) {
        Write-DevSpacePatchManifest -PackageRoot $packageRoot
    }
    return $changed
}

function Restore-DevSpaceSubagentWindowsPatch {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$DevSpaceCli)

    $packageRoot = Split-Path -Parent (Split-Path -Parent $DevSpaceCli)
    $packageJsonPath = Join-Path $packageRoot 'package.json'
    if (-not (Test-Path -LiteralPath $packageJsonPath)) {
        throw "DevSpace package metadata is missing: $packageJsonPath"
    }

    $package = Get-Content -LiteralPath $packageJsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ([string]$package.version -ne '1.0.4') {
        throw "The bundled Windows subagent restore supports DevSpace 1.0.4 only; found $($package.version)."
    }

    $targets = @(Get-DevSpacePatchTargets -PackageRoot $packageRoot)
    $manifestPath = Join-Path $packageRoot '.devspace-oneclick-patch-manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath)) {
        if (@($targets | Where-Object { Test-Path -LiteralPath $_.Backup }).Count -eq 0) {
            return 0
        }
        throw "DevSpace patch manifest is missing; refusing to restore from unverified backups: $manifestPath"
    }

    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    }
    catch {
        throw "DevSpace patch manifest is unreadable; refusing to restore: $manifestPath"
    }
    if ([int]$manifest.schemaVersion -ne 1 -or [string]$manifest.devSpaceVersion -ne '1.0.4') {
        throw "DevSpace patch manifest is unsupported; refusing to restore: $manifestPath"
    }
    $manifestFiles = @($manifest.files)
    if ($manifestFiles.Count -ne $targets.Count) {
        throw "DevSpace patch manifest file set is incomplete; refusing to restore: $manifestPath"
    }
    $manifestByPath = @{}
    foreach ($file in $manifestFiles) {
        $relativePath = [string]$file.path
        if ([string]::IsNullOrWhiteSpace($relativePath) -or $manifestByPath.ContainsKey($relativePath)) {
            throw "DevSpace patch manifest contains an invalid file entry; refusing to restore: $manifestPath"
        }
        $manifestByPath[$relativePath] = $file
    }

    $restoreTargets = @()
    foreach ($entry in $targets) {
        if (-not $manifestByPath.ContainsKey($entry.RelativePath)) {
            throw "DevSpace patch manifest is missing $($entry.RelativePath); refusing to restore."
        }
        if (-not (Test-Path -LiteralPath $entry.Target) -or -not (Test-Path -LiteralPath $entry.Backup)) {
            throw "DevSpace patch target or backup is missing for $($entry.RelativePath); refusing to restore."
        }

        $record = $manifestByPath[$entry.RelativePath]
        $backupHash = Get-DevSpacePatchFileSha256 -FilePath $entry.Backup
        $targetHash = Get-DevSpacePatchFileSha256 -FilePath $entry.Target
        if (-not [string]::Equals($backupHash, [string]$record.backupSha256, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "DevSpace patch backup drift detected for $($entry.RelativePath); refusing to restore."
        }
        if ([string]::Equals($targetHash, [string]$record.patchedSha256, [System.StringComparison]::OrdinalIgnoreCase)) {
            $restoreTargets += $entry
            continue
        }
        if (-not [string]::Equals($targetHash, $backupHash, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Unknown DevSpace 1.0.4 target drift detected for $($entry.RelativePath); refusing to restore."
        }
    }

    foreach ($entry in $restoreTargets) {
        Copy-Item -LiteralPath $entry.Backup -Destination $entry.Target -Force
    }
    return $restoreTargets.Count
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

function Install-DevSpaceWorkflowModule {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$SourceFile,
        [Parameter(Mandatory = $true)][string]$BinDirectory,
        [string]$CoreSourceFile,
        [string]$ProjectResolverSourceFile
    )

    if (-not (Test-Path -LiteralPath $SourceFile -PathType Leaf)) {
        throw "DevSpace workflow module source is missing: $SourceFile"
    }
    if (-not (Test-Path -LiteralPath $BinDirectory)) {
        New-Item -ItemType Directory -Path $BinDirectory -Force | Out-Null
    }

    $entries = @(
        [pscustomobject]@{ Source = $SourceFile; Target = (Join-Path $BinDirectory 'DevSpace.WorkflowStore.mjs') }
    )
    if ($CoreSourceFile) {
        if (-not (Test-Path -LiteralPath $CoreSourceFile -PathType Leaf)) {
            throw "Session Workflow core source is missing: $CoreSourceFile"
        }
        $entries += [pscustomobject]@{ Source = $CoreSourceFile; Target = (Join-Path $BinDirectory 'SessionWorkflow.Core.mjs') }
    }
    if ($ProjectResolverSourceFile) {
        if (-not (Test-Path -LiteralPath $ProjectResolverSourceFile -PathType Leaf)) {
            throw "Session Workflow DevSpace project resolver source is missing: $ProjectResolverSourceFile"
        }
        $entries += [pscustomobject]@{ Source = $ProjectResolverSourceFile; Target = (Join-Path $BinDirectory 'SessionWorkflow.DevSpaceProjectResolver.mjs') }
    }

    $changed = $false
    foreach ($entry in $entries) {
        $sourceHash = Get-DevSpacePatchFileSha256 -FilePath $entry.Source
        $needsCopy = $true
        if (Test-Path -LiteralPath $entry.Target -PathType Leaf) {
            $targetHash = Get-DevSpacePatchFileSha256 -FilePath $entry.Target
            if ([string]::Equals($sourceHash, $targetHash, [System.StringComparison]::OrdinalIgnoreCase)) {
                $needsCopy = $false
            }
            else {
                Copy-Item -LiteralPath $entry.Target -Destination "$($entry.Target).devspace-oneclick.bak" -Force
            }
        }
        if (-not $needsCopy) {
            continue
        }

        $temporary = "$($entry.Target).$([guid]::NewGuid().ToString('N')).tmp"
        try {
            Copy-Item -LiteralPath $entry.Source -Destination $temporary -Force
            Move-Item -LiteralPath $temporary -Destination $entry.Target -Force
            $changed = $true
        }
        finally {
            if (Test-Path -LiteralPath $temporary) {
                Remove-Item -LiteralPath $temporary -Force
            }
        }
    }

    return [pscustomobject]@{
        Path = Join-Path $BinDirectory 'DevSpace.WorkflowStore.mjs'
        CorePath = if ($CoreSourceFile) { Join-Path $BinDirectory 'SessionWorkflow.Core.mjs' } else { $null }
        ProjectResolverPath = if ($ProjectResolverSourceFile) { Join-Path $BinDirectory 'SessionWorkflow.DevSpaceProjectResolver.mjs' } else { $null }
        Changed = $changed
    }
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

    $nodeDirectory = Split-Path -Parent $NodePath
    $npmCmdPath = Join-Path $nodeDirectory 'npm.cmd'
    $npxCmdPath = Join-Path $nodeDirectory 'npx.cmd'
    foreach ($packageCommand in @($npmCmdPath, $npxCmdPath)) {
        if (-not (Test-Path -LiteralPath $packageCommand -PathType Leaf)) {
            throw "Node package command is missing: $packageCommand"
        }
    }

    $npmShellPath = Join-Path $BinDirectory 'npm'
    $npmShellContent = '#!/usr/bin/env bash' + [Environment]::NewLine +
        'exec "' + (ConvertTo-DevSpaceBashPath -FilePath $npmCmdPath) + '" "$@"' + [Environment]::NewLine
    [System.IO.File]::WriteAllText($npmShellPath, $npmShellContent, [System.Text.UTF8Encoding]::new($false))

    $npxShellPath = Join-Path $BinDirectory 'npx'
    $npxShellContent = '#!/usr/bin/env bash' + [Environment]::NewLine +
        'exec "' + (ConvertTo-DevSpaceBashPath -FilePath $npxCmdPath) + '" "$@"' + [Environment]::NewLine
    [System.IO.File]::WriteAllText($npxShellPath, $npxShellContent, [System.Text.UTF8Encoding]::new($false))

    return [pscustomobject]@{
        BinDirectory = $BinDirectory
        ShellPath = $shellPath
        CmdPath = $cmdPath
        AdminPath = $stableAdmin
        NpmShellPath = $npmShellPath
        NpxShellPath = $npxShellPath
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
    'Restore-DevSpaceSubagentWindowsPatch',
    'Install-DevSpaceAgentProfiles',
    'Install-DevSpaceWorkflowModule',
    'Install-DevSpaceAgentCliShim',
    'Get-DevSpaceAgentStatus',
    'Stop-DevSpaceAgent'
)
