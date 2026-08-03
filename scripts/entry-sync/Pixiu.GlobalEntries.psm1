Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ManagedMarker = 'PIXIU-GLOBAL-ENTRY:1'
$script:Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$script:Utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)

function ConvertTo-PixiuFullPath {
    param([Parameter(Mandatory = $true)][string]$Path)

    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\', '/')
}

function Test-PixiuPathEqual {
    param(
        [Parameter(Mandatory = $true)][string]$Left,
        [Parameter(Mandatory = $true)][string]$Right
    )

    return [string]::Equals(
        (ConvertTo-PixiuFullPath -Path $Left),
        (ConvertTo-PixiuFullPath -Path $Right),
        [System.StringComparison]::OrdinalIgnoreCase
    )
}

function Get-PixiuFileSha256 {
    param([Parameter(Mandatory = $true)][string]$Path)

    $stream = [System.IO.File]::OpenRead($Path)
    try {
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try {
            return ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
        }
        finally {
            $sha.Dispose()
        }
    }
    finally {
        $stream.Dispose()
    }
}

function Get-PixiuTextSha256 {
    param([Parameter(Mandatory = $true)][string]$Text)

    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = $script:Utf8NoBom.GetBytes($Text)
        return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    }
    finally {
        $sha.Dispose()
    }
}

function Resolve-PixiuCorePath {
    [CmdletBinding()]
    param([string]$CorePath)

    $candidates = @()
    if (-not [string]::IsNullOrWhiteSpace($CorePath)) { $candidates += $CorePath }
    if (-not [string]::IsNullOrWhiteSpace($env:PIXIU_CORE)) { $candidates += $env:PIXIU_CORE }
    if (-not [string]::IsNullOrWhiteSpace($env:PIXIU_CORE_PATH)) { $candidates += $env:PIXIU_CORE_PATH }
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $candidates += (Join-Path $env:USERPROFILE '.pixiu-core')
    }
    $candidates += (Join-Path $PSScriptRoot '..\..')

    foreach ($candidate in $candidates) {
        try {
            $resolved = ConvertTo-PixiuFullPath -Path $candidate
            $valid = (Test-Path -LiteralPath (Join-Path $resolved 'user_rules.md') -PathType Leaf) -and
                (Test-Path -LiteralPath (Join-Path $resolved 'AGENTS.md') -PathType Leaf) -and
                (Test-Path -LiteralPath (Join-Path $resolved 'vault\bootstrap\SESSION-BOOTSTRAP.md') -PathType Leaf) -and
                (Test-Path -LiteralPath (Join-Path $resolved 'scripts\router\resolve-capabilities.js') -PathType Leaf)
            if ($valid) { return $resolved }
        }
        catch {
            continue
        }
    }

    throw 'Cannot resolve a valid PixiuCore. Set PIXIU_CORE, PIXIU_CORE_PATH, or pass -CorePath.'
}

function Get-PixiuTemplateContent {
    param([Parameter(Mandatory = $true)][ValidateSet('codex', 'claude', 'gemini')][string]$Name)

    $templatePath = Join-Path $PSScriptRoot (Join-Path 'templates' ($Name + '.md'))
    if (-not (Test-Path -LiteralPath $templatePath -PathType Leaf)) {
        throw "Global entry template is missing: $templatePath"
    }
    return [System.IO.File]::ReadAllText($templatePath, [System.Text.Encoding]::UTF8)
}

function Get-PixiuGlobalEntryDefinitions {
    [CmdletBinding()]
    param(
        [string]$CorePath,
        [string]$UserProfile = $env:USERPROFILE
    )

    $resolvedCore = Resolve-PixiuCorePath -CorePath $CorePath
    if ([string]::IsNullOrWhiteSpace($UserProfile)) {
        throw 'UserProfile cannot be empty.'
    }
    $resolvedUser = ConvertTo-PixiuFullPath -Path $UserProfile

    $definitions = @(
        [pscustomobject]@{
            Name = 'codex'
            TargetPath = Join-Path $resolvedUser '.codex\AGENTS.md'
            SourcePaths = @(
                (Join-Path $resolvedCore 'CODEX.md'),
                (Join-Path $resolvedCore '.codex\AGENTS.md'),
                (Join-Path $resolvedCore 'vault\bootstrap\SESSION-BOOTSTRAP.md'),
                (Join-Path $resolvedCore 'scripts\router\resolve-capabilities.js')
            )
            Content = Get-PixiuTemplateContent -Name codex
        },
        [pscustomobject]@{
            Name = 'claude'
            TargetPath = Join-Path $resolvedUser '.claude\CLAUDE.md'
            SourcePaths = @(
                (Join-Path $resolvedCore 'CLAUDE.md'),
                (Join-Path $resolvedCore 'vault\bootstrap\SESSION-BOOTSTRAP.md'),
                (Join-Path $resolvedCore 'scripts\router\resolve-capabilities.js')
            )
            Content = Get-PixiuTemplateContent -Name claude
        },
        [pscustomobject]@{
            Name = 'gemini'
            TargetPath = Join-Path $resolvedUser '.gemini\GEMINI.md'
            SourcePaths = @(
                (Join-Path $resolvedCore 'GEMINI.md'),
                (Join-Path $resolvedCore 'vault\bootstrap\SESSION-BOOTSTRAP.md'),
                (Join-Path $resolvedCore 'scripts\router\resolve-capabilities.js')
            )
            Content = Get-PixiuTemplateContent -Name gemini
        }
    )

    foreach ($definition in $definitions) {
        foreach ($sourcePath in $definition.SourcePaths) {
            if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
                throw "Global entry source is missing: $sourcePath"
            }
        }
    }

    return $definitions
}

function Test-PixiuReparsePoint {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) { return $false }
    $item = Get-Item -LiteralPath $Path -Force
    return ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
}

function Assert-PixiuSafeTarget {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (Test-Path -LiteralPath $Path) {
        if ((Test-PixiuReparsePoint -Path $Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) {
            throw "Refusing a reparse point or non-file target: $Path"
        }
    }

    $parent = Split-Path -Parent $Path
    if ((Test-Path -LiteralPath $parent) -and (Test-PixiuReparsePoint -Path $parent)) {
        throw "Refusing a target below a reparse point directory: $parent"
    }
}

function Read-PixiuUtf8File {
    param([Parameter(Mandatory = $true)][string]$Path)

    $bytes = [System.IO.File]::ReadAllBytes($Path)
    return $script:Utf8Strict.GetString($bytes)
}

function Test-PixiuGlobalEntries {
    [CmdletBinding()]
    param(
        [string]$CorePath,
        [string]$UserProfile = $env:USERPROFILE
    )

    foreach ($definition in @(Get-PixiuGlobalEntryDefinitions -CorePath $CorePath -UserProfile $UserProfile)) {
        $expectedSha = Get-PixiuTextSha256 -Text $definition.Content
        if (-not (Test-Path -LiteralPath $definition.TargetPath)) {
            [pscustomobject]@{
                Name = $definition.Name
                TargetPath = $definition.TargetPath
                Status = 'Missing'
                Issues = @('missing')
                ExpectedSha256 = $expectedSha
                ActualSha256 = $null
            }
            continue
        }

        if ((Test-PixiuReparsePoint -Path $definition.TargetPath) -or -not (Test-Path -LiteralPath $definition.TargetPath -PathType Leaf)) {
            [pscustomobject]@{
                Name = $definition.Name
                TargetPath = $definition.TargetPath
                Status = 'UnsafeReparsePoint'
                Issues = @('reparse-point-or-non-file')
                ExpectedSha256 = $expectedSha
                ActualSha256 = $null
            }
            continue
        }

        $issues = @()
        $content = $null
        try {
            $content = Read-PixiuUtf8File -Path $definition.TargetPath
        }
        catch {
            $issues += 'invalid-utf8'
        }

        if ($null -ne $content) {
            if (-not $content.Contains($script:ManagedMarker)) { $issues += 'unmanaged-marker' }
            if ($content -match '(?i)user_rules\.md|founder-profile|agent-persona|memory-summary') { $issues += 'legacy-full-load' }
            if ($content.Contains([string][char]0xFFFD)) { $issues += 'replacement-character' }
            if (-not [string]::Equals($content, $definition.Content, [System.StringComparison]::Ordinal)) {
                $issues += 'content-mismatch'
            }
        }

        [pscustomobject]@{
            Name = $definition.Name
            TargetPath = $definition.TargetPath
            Status = if ($issues.Count -eq 0) { 'Current' } else { 'Drifted' }
            Issues = @($issues)
            ExpectedSha256 = $expectedSha
            ActualSha256 = if ($null -ne $content) { Get-PixiuFileSha256 -Path $definition.TargetPath } else { $null }
        }
    }
}

function Write-PixiuAtomicTextFile {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Content
    )

    $parent = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }

    $temporaryPath = "$Path.pixiu-entry-sync.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [System.IO.File]::WriteAllText($temporaryPath, $Content, $script:Utf8NoBom)
        Move-Item -LiteralPath $temporaryPath -Destination $Path -Force
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force
        }
    }
}

function Restore-PixiuFileFromBackup {
    param(
        [Parameter(Mandatory = $true)][string]$BackupPath,
        [Parameter(Mandatory = $true)][string]$TargetPath
    )

    $parent = Split-Path -Parent $TargetPath
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    $temporaryPath = "$TargetPath.pixiu-entry-restore.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        Copy-Item -LiteralPath $BackupPath -Destination $temporaryPath -Force
        Move-Item -LiteralPath $temporaryPath -Destination $TargetPath -Force
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force
        }
    }
}

function Install-PixiuGlobalEntries {
    [CmdletBinding()]
    param(
        [string]$CorePath,
        [string]$UserProfile = $env:USERPROFILE,
        [string]$BackupRoot
    )

    $resolvedCore = Resolve-PixiuCorePath -CorePath $CorePath
    $definitions = @(Get-PixiuGlobalEntryDefinitions -CorePath $resolvedCore -UserProfile $UserProfile)
    $statusByName = @{}
    foreach ($status in @(Test-PixiuGlobalEntries -CorePath $resolvedCore -UserProfile $UserProfile)) {
        $statusByName[$status.Name] = $status
    }

    foreach ($definition in $definitions) {
        Assert-PixiuSafeTarget -Path $definition.TargetPath
    }

    $changed = @($definitions | Where-Object { $statusByName[$_.Name].Status -ne 'Current' })
    if ($changed.Count -eq 0) {
        return [pscustomobject]@{ ChangedCount = 0; BackupSetPath = $null; Entries = @() }
    }

    if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
        $BackupRoot = Join-Path (ConvertTo-PixiuFullPath -Path $UserProfile) '.pixiu-entry-backups'
    }
    $resolvedBackupRoot = ConvertTo-PixiuFullPath -Path $BackupRoot
    $backupSetPath = Join-Path $resolvedBackupRoot ((Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $backupSetPath -Force | Out-Null

    $manifestEntries = @()
    foreach ($definition in $changed) {
        $existed = Test-Path -LiteralPath $definition.TargetPath -PathType Leaf
        $backupFile = $null
        $originalSha = $null
        if ($existed) {
            $backupFile = "$($definition.Name).original"
            $backupPath = Join-Path $backupSetPath $backupFile
            Copy-Item -LiteralPath $definition.TargetPath -Destination $backupPath -Force
            $originalSha = Get-PixiuFileSha256 -Path $backupPath
        }

        $manifestEntries += [ordered]@{
            name = $definition.Name
            targetPath = $definition.TargetPath
            existed = [bool]$existed
            backupFile = $backupFile
            originalSha256 = $originalSha
            appliedSha256 = Get-PixiuTextSha256 -Text $definition.Content
        }
    }

    $manifest = [ordered]@{
        schemaVersion = 1
        createdAtUtc = [DateTime]::UtcNow.ToString('o')
        corePath = $resolvedCore
        entries = $manifestEntries
    }
    Write-PixiuAtomicTextFile -Path (Join-Path $backupSetPath 'manifest.json') -Content ($manifest | ConvertTo-Json -Depth 6)

    $written = @()
    try {
        foreach ($definition in $changed) {
            Write-PixiuAtomicTextFile -Path $definition.TargetPath -Content $definition.Content
            $written += $definition.Name
            $readBack = Read-PixiuUtf8File -Path $definition.TargetPath
            if (-not [string]::Equals($readBack, $definition.Content, [System.StringComparison]::Ordinal)) {
                throw "Read-back mismatch after writing: $($definition.TargetPath)"
            }
        }
    }
    catch {
        foreach ($entry in $manifestEntries) {
            if ($written -notcontains [string]$entry.name) { continue }
            if ([bool]$entry.existed) {
                Restore-PixiuFileFromBackup -BackupPath (Join-Path $backupSetPath $entry.backupFile) -TargetPath $entry.targetPath
            }
            elseif (Test-Path -LiteralPath $entry.targetPath -PathType Leaf) {
                Remove-Item -LiteralPath $entry.targetPath -Force
            }
        }
        throw
    }

    return [pscustomobject]@{
        ChangedCount = $changed.Count
        BackupSetPath = $backupSetPath
        Entries = @($changed.Name)
    }
}

function Restore-PixiuGlobalEntries {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$BackupSetPath)

    $resolvedBackupSet = ConvertTo-PixiuFullPath -Path $BackupSetPath
    $manifestPath = Join-Path $resolvedBackupSet 'manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
        throw "Entry backup manifest is missing: $manifestPath"
    }

    try {
        $manifest = Read-PixiuUtf8File -Path $manifestPath | ConvertFrom-Json
    }
    catch {
        throw "Entry backup manifest is unreadable: $manifestPath"
    }
    if ([int]$manifest.schemaVersion -ne 1) {
        throw "Unsupported entry backup manifest version: $($manifest.schemaVersion)"
    }

    $entries = @($manifest.entries)
    foreach ($entry in $entries) {
        $target = [string]$entry.targetPath
        Assert-PixiuSafeTarget -Path $target
        if (Test-Path -LiteralPath $target -PathType Leaf) {
            $currentSha = Get-PixiuFileSha256 -Path $target
            $allowed = [string]::Equals($currentSha, [string]$entry.appliedSha256, [System.StringComparison]::OrdinalIgnoreCase)
            if ([bool]$entry.existed) {
                $allowed = $allowed -or [string]::Equals($currentSha, [string]$entry.originalSha256, [System.StringComparison]::OrdinalIgnoreCase)
            }
            if (-not $allowed) {
                throw "Entry changed after apply; restore refused: $target"
            }
        }
        elseif ([bool]$entry.existed) {
            throw "Originally existing entry is missing; restore refused: $target"
        }

        if ([bool]$entry.existed) {
            $backupPath = Join-Path $resolvedBackupSet ([string]$entry.backupFile)
            if (-not (Test-Path -LiteralPath $backupPath -PathType Leaf)) {
                throw "Original entry backup is missing: $backupPath"
            }
            $backupSha = Get-PixiuFileSha256 -Path $backupPath
            if (-not [string]::Equals($backupSha, [string]$entry.originalSha256, [System.StringComparison]::OrdinalIgnoreCase)) {
                throw "Original entry backup hash mismatch: $backupPath"
            }
        }
    }

    $restoredCount = 0
    foreach ($entry in $entries) {
        $target = [string]$entry.targetPath
        if ([bool]$entry.existed) {
            $alreadyOriginal = (Test-Path -LiteralPath $target -PathType Leaf) -and
                [string]::Equals((Get-PixiuFileSha256 -Path $target), [string]$entry.originalSha256, [System.StringComparison]::OrdinalIgnoreCase)
            if (-not $alreadyOriginal) {
                Restore-PixiuFileFromBackup -BackupPath (Join-Path $resolvedBackupSet ([string]$entry.backupFile)) -TargetPath $target
                $restoredCount++
            }
        }
        elseif (Test-Path -LiteralPath $target -PathType Leaf) {
            Remove-Item -LiteralPath $target -Force
            $restoredCount++
        }
    }

    return [pscustomobject]@{ RestoredCount = $restoredCount; BackupSetPath = $resolvedBackupSet }
}

function Get-PixiuLinkTarget {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $item = Get-Item -LiteralPath $Path -Force
    if (($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -eq 0) { return $null }
    $targets = @($item.Target)
    if ($targets.Count -eq 0 -or [string]::IsNullOrWhiteSpace([string]$targets[0])) { return $null }
    return ConvertTo-PixiuFullPath -Path ([string]$targets[0])
}

function Get-PixiuJsonCommandValues {
    param($InputObject)

    if ($null -eq $InputObject) { return @() }
    $result = @()
    if ($InputObject -is [System.Array]) {
        foreach ($item in $InputObject) {
            $result += @(Get-PixiuJsonCommandValues -InputObject $item)
        }
        return $result
    }
    if ($InputObject -is [pscustomobject]) {
        foreach ($property in $InputObject.PSObject.Properties) {
            if (($property.Name -eq 'command' -or $property.Name -eq 'commandWindows') -and $property.Value -is [string]) {
                $result += [string]$property.Value
            }
            else {
                $result += @(Get-PixiuJsonCommandValues -InputObject $property.Value)
            }
        }
    }
    return $result
}

function Get-PixiuJsonNamedCommandValues {
    param(
        $InputObject,
        [Parameter(Mandatory = $true)][ValidateSet('command', 'commandWindows')][string]$PropertyName
    )

    if ($null -eq $InputObject) { return @() }
    $result = @()
    if ($InputObject -is [System.Array]) {
        foreach ($item in $InputObject) {
            $result += @(Get-PixiuJsonNamedCommandValues -InputObject $item -PropertyName $PropertyName)
        }
        return $result
    }
    if ($InputObject -is [pscustomobject]) {
        foreach ($property in $InputObject.PSObject.Properties) {
            if ($property.Name -eq $PropertyName -and $property.Value -is [string]) {
                $result += [string]$property.Value
            }
            else {
                $result += @(Get-PixiuJsonNamedCommandValues -InputObject $property.Value -PropertyName $PropertyName)
            }
        }
    }
    return $result
}

function New-PixiuBindingResult {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][ValidateSet('Pass', 'Fail', 'Warn')][string]$Status,
        [string]$Expected,
        [string]$Actual,
        [string]$Detail
    )

    return [pscustomobject]@{
        Name = $Name
        Status = $Status
        Expected = $Expected
        Actual = $Actual
        Detail = $Detail
    }
}

function Test-PixiuLiveBindings {
    [CmdletBinding()]
    param(
        [string]$CorePath,
        [string]$UserProfile = $env:USERPROFILE,
        [string]$DevSpacePackageRoot,
        [AllowEmptyString()][string]$PixiuCoreEnvironment = $env:PIXIU_CORE,
        [AllowEmptyString()][string]$PixiuCorePathEnvironment = $env:PIXIU_CORE_PATH
    )

    $resolvedCore = Resolve-PixiuCorePath -CorePath $CorePath
    $resolvedUser = ConvertTo-PixiuFullPath -Path $UserProfile

    foreach ($environmentCheck in @(
        @{ Name = 'env-pixiu-core'; Value = $PixiuCoreEnvironment },
        @{ Name = 'env-pixiu-core-path'; Value = $PixiuCorePathEnvironment }
    )) {
        if ([string]::IsNullOrWhiteSpace([string]$environmentCheck.Value)) {
            New-PixiuBindingResult -Name $environmentCheck.Name -Status Warn -Expected $resolvedCore -Actual '' -Detail 'Environment variable is not set.'
        }
        elseif (Test-PixiuPathEqual -Left ([string]$environmentCheck.Value) -Right $resolvedCore) {
            New-PixiuBindingResult -Name $environmentCheck.Name -Status Pass -Expected $resolvedCore -Actual ([string]$environmentCheck.Value) -Detail ''
        }
        else {
            New-PixiuBindingResult -Name $environmentCheck.Name -Status Fail -Expected $resolvedCore -Actual ([string]$environmentCheck.Value) -Detail 'Environment variable points to another core.'
        }
    }

    foreach ($binding in @(
        @{ Name = 'fallback-core-junction'; Path = Join-Path $resolvedUser '.pixiu-core'; Target = $resolvedCore },
        @{ Name = 'agents-skills-junction'; Path = Join-Path $resolvedUser '.agents\skills'; Target = Join-Path $resolvedCore 'skills' },
        @{ Name = 'claude-commands-junction'; Path = Join-Path $resolvedUser '.claude\commands'; Target = Join-Path $resolvedCore '.agent\workflows' }
    )) {
        $actualTarget = Get-PixiuLinkTarget -Path $binding.Path
        if ($null -ne $actualTarget -and (Test-PixiuPathEqual -Left $actualTarget -Right $binding.Target)) {
            New-PixiuBindingResult -Name $binding.Name -Status Pass -Expected $binding.Target -Actual $actualTarget -Detail ''
        }
        else {
            New-PixiuBindingResult -Name $binding.Name -Status Fail -Expected $binding.Target -Actual ([string]$actualTarget) -Detail 'Junction is missing or points to another target.'
        }
    }

    $bridgePath = Join-Path $resolvedCore 'scripts\codex-bridge\pixiu-global-hook-bridge.js'
    if (Test-Path -LiteralPath $bridgePath -PathType Leaf) {
        New-PixiuBindingResult -Name 'codex-hook-bridge-file' -Status Pass -Expected $bridgePath -Actual $bridgePath -Detail ''
    }
    else {
        New-PixiuBindingResult -Name 'codex-hook-bridge-file' -Status Fail -Expected $bridgePath -Actual '' -Detail 'Hook bridge is missing.'
    }

    $hooksPath = Join-Path $resolvedUser '.codex\hooks.json'
    if (-not (Test-Path -LiteralPath $hooksPath -PathType Leaf)) {
        New-PixiuBindingResult -Name 'codex-hook-bindings' -Status Fail -Expected $bridgePath -Actual '' -Detail 'Codex hooks.json is missing.'
    }
    else {
        try {
            $hooks = Read-PixiuUtf8File -Path $hooksPath | ConvertFrom-Json
            $commands = @(Get-PixiuJsonCommandValues -InputObject $hooks | Where-Object { $_ -match 'pixiu-global-hook-bridge\.js' })
            $windowsCommands = @(Get-PixiuJsonNamedCommandValues -InputObject $hooks -PropertyName 'commandWindows' | Where-Object { $_ -match 'pixiu-global-hook-bridge\.js' })
            $expectedNormalized = $bridgePath.Replace('\', '/').ToLowerInvariant()
            $incorrect = @($commands | Where-Object { $_.Replace('\', '/').ToLowerInvariant() -notmatch [regex]::Escape($expectedNormalized) })
            $unquotedWindowsExecutables = @($windowsCommands | Where-Object { $_ -notmatch '^"[A-Za-z]:\\[^\"]+"' })
            if ($commands.Count -gt 0 -and $incorrect.Count -eq 0 -and $unquotedWindowsExecutables.Count -eq 0) {
                New-PixiuBindingResult -Name 'codex-hook-bindings' -Status Pass -Expected $bridgePath -Actual "$($commands.Count) command(s)" -Detail ''
            }
            elseif ($unquotedWindowsExecutables.Count -gt 0) {
                New-PixiuBindingResult -Name 'codex-hook-bindings' -Status Fail -Expected $bridgePath -Actual "$($commands.Count) command(s)" -Detail 'Windows Hook executable path must be quoted.'
            }
            else {
                New-PixiuBindingResult -Name 'codex-hook-bindings' -Status Fail -Expected $bridgePath -Actual "$($commands.Count) command(s)" -Detail 'Hook bridge command is missing or points to another core.'
            }
        }
        catch {
            New-PixiuBindingResult -Name 'codex-hook-bindings' -Status Fail -Expected $bridgePath -Actual '' -Detail ("hooks.json parse failed: " + $_.Exception.Message)
        }
    }

    if ([string]::IsNullOrWhiteSpace($DevSpacePackageRoot)) {
        New-PixiuBindingResult -Name 'devspace-skill-patch' -Status Warn -Expected 'DevSpace 1.0.4 canonical suppression' -Actual '' -Detail 'DevSpace package root was not provided.'
        New-PixiuBindingResult -Name 'devspace-patch-manifest' -Status Warn -Expected '6-file patch manifest' -Actual '' -Detail 'DevSpace package root was not provided.'
    }
    else {
        $resolvedDevSpace = ConvertTo-PixiuFullPath -Path $DevSpacePackageRoot
        $packagePath = Join-Path $resolvedDevSpace 'package.json'
        $skillsPath = Join-Path $resolvedDevSpace 'dist\skills.js'
        try {
            $package = Read-PixiuUtf8File -Path $packagePath | ConvertFrom-Json
            $skillsContent = Read-PixiuUtf8File -Path $skillsPath
            $hasMarkers = [string]$package.version -eq '1.0.4' -and
                $skillsContent.Contains('projectSkillMirrorSha256') -and
                $skillsContent.Contains('SESSION-BOOTSTRAP.md') -and
                $skillsContent.Contains('canonicalEntries')
            if ($hasMarkers) {
                New-PixiuBindingResult -Name 'devspace-skill-patch' -Status Pass -Expected 'DevSpace 1.0.4 canonical suppression' -Actual $resolvedDevSpace -Detail ''
            }
            else {
                New-PixiuBindingResult -Name 'devspace-skill-patch' -Status Fail -Expected 'DevSpace 1.0.4 canonical suppression' -Actual $resolvedDevSpace -Detail 'Version or canonical suppression marker mismatch.'
            }
        }
        catch {
            New-PixiuBindingResult -Name 'devspace-skill-patch' -Status Fail -Expected 'DevSpace 1.0.4 canonical suppression' -Actual $resolvedDevSpace -Detail $_.Exception.Message
        }

        $patchManifestPath = Join-Path $resolvedDevSpace '.devspace-oneclick-patch-manifest.json'
        try {
            $patchManifest = Read-PixiuUtf8File -Path $patchManifestPath | ConvertFrom-Json
            $manifestValid = [int]$patchManifest.schemaVersion -eq 1 -and
                [string]$patchManifest.devSpaceVersion -eq '1.0.4' -and
                @($patchManifest.files).Count -eq 6
            if ($manifestValid) {
                New-PixiuBindingResult -Name 'devspace-patch-manifest' -Status Pass -Expected '6-file patch manifest' -Actual $patchManifestPath -Detail ''
            }
            else {
                New-PixiuBindingResult -Name 'devspace-patch-manifest' -Status Fail -Expected '6-file patch manifest' -Actual $patchManifestPath -Detail 'Patch manifest fields do not match.'
            }
        }
        catch {
            New-PixiuBindingResult -Name 'devspace-patch-manifest' -Status Fail -Expected '6-file patch manifest' -Actual $patchManifestPath -Detail $_.Exception.Message
        }
    }
}

Export-ModuleMember -Function @(
    'Resolve-PixiuCorePath',
    'Get-PixiuGlobalEntryDefinitions',
    'Test-PixiuGlobalEntries',
    'Install-PixiuGlobalEntries',
    'Restore-PixiuGlobalEntries',
    'Test-PixiuLiveBindings'
)
