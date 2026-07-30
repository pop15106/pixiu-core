[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('install', 'run', 'status', 'remove', 'notify-connector-failure', 'test-telegram')]
    [string]$Action = 'status'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot 'DevSpace.OneClick.Core.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'DevSpace.OneClick.Platform.psm1') -Force -DisableNameChecking

function Get-WatchdogPaths {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$StateRoot)

    return [pscustomobject]@{
        Root = $StateRoot
        ConfigPath = Join-Path $StateRoot 'config.json'
        StatePath = Join-Path $StateRoot 'state.json'
        LogPath = Join-Path $StateRoot 'watchdog.log'
    }
}

function Read-WatchdogJson {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$FilePath)

    if (-not (Test-Path -LiteralPath $FilePath)) {
        return $null
    }
    return Get-Content -LiteralPath $FilePath -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Write-WatchdogJsonAtomic {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)]$Value
    )

    $directory = Split-Path -Parent $FilePath
    if (-not (Test-Path -LiteralPath $directory)) {
        New-Item -ItemType Directory -Path $directory -Force | Out-Null
    }

    $temporaryPath = "$FilePath.$([guid]::NewGuid().ToString('N')).tmp"
    try {
        [System.IO.File]::WriteAllText(
            $temporaryPath,
            ($Value | ConvertTo-Json -Depth 12),
            [System.Text.UTF8Encoding]::new($false)
        )
        Move-Item -LiteralPath $temporaryPath -Destination $FilePath -Force
    }
    finally {
        if (Test-Path -LiteralPath $temporaryPath) {
            Remove-Item -LiteralPath $temporaryPath -Force
        }
    }
}

function Assert-WatchdogPublicOrigin {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$PublicBaseUrl,
        [Parameter(Mandatory = $true)][ValidateRange(1, 65535)][int]$Port
    )

    $uri = $null
    if (-not [uri]::TryCreate($PublicBaseUrl, [System.UriKind]::Absolute, [ref]$uri)) {
        throw 'The public Dev Tunnel origin is not a valid absolute URI.'
    }
    if ($uri.Scheme -ne 'https' -or -not [string]::IsNullOrEmpty($uri.UserInfo)) {
        throw 'The public Dev Tunnel origin must use HTTPS without user information.'
    }
    if (-not $uri.IsDefaultPort -or $uri.AbsolutePath -ne '/' -or
        -not [string]::IsNullOrEmpty($uri.Query) -or
        -not [string]::IsNullOrEmpty($uri.Fragment)) {
        throw 'The public Dev Tunnel origin must not include a custom port, path, query, or fragment.'
    }

    $hostMatch = [regex]::Match(
        $uri.DnsSafeHost,
        '^(?<name>[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)-(?<port>[0-9]{1,5})\.(?<region>[a-z0-9]+)\.devtunnels\.ms$',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )
    if (-not $hostMatch.Success -or [int]$hostMatch.Groups['port'].Value -ne $Port) {
        throw 'The public Dev Tunnel origin host or port does not match OneClick settings.'
    }

    return $uri.GetLeftPart([System.UriPartial]::Authority).TrimEnd('/')
}

function Get-ValidatedOneClickSettings {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$SettingsPath,
        [Parameter(Mandatory = $true)][string]$MachineName
    )

    if (-not (Test-Path -LiteralPath $SettingsPath)) {
        throw 'OneClick settings are missing.'
    }

    try {
        $settings = Read-WatchdogJson -FilePath $SettingsPath
    }
    catch {
        throw 'OneClick settings are not valid JSON.'
    }
    if (-not $settings -or [int]$settings.schemaVersion -ne 1) {
        throw 'OneClick settings have an unsupported schema.'
    }
    if (-not [string]::Equals(
        [string]$settings.machineName,
        $MachineName,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw 'OneClick settings belong to another machine.'
    }

    $port = [int]$settings.port
    if ($port -lt 1 -or $port -gt 65535) {
        throw 'OneClick settings contain an invalid port.'
    }
    $tunnelId = [string]$settings.tunnelId
    if ($tunnelId -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$') {
        throw 'OneClick settings contain an invalid tunnel ID.'
    }

    [void](Assert-WatchdogPublicOrigin -PublicBaseUrl ([string]$settings.publicBaseUrl) -Port $port)
    return $settings
}

function Test-WatchdogHealth {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][scriptblock]$InvokeHttp
    )

    try {
        $response = & $InvokeHttp $Url 8
        $statusCode = if ($response.PSObject.Properties['StatusCode']) {
            [int]$response.StatusCode
        }
        else {
            200
        }
        $healthy = $response.Body.ok -eq $true -and [string]$response.Body.name -eq 'devspace'
        return [pscustomobject]@{
            Healthy = $healthy
            Category = if ($healthy) { $null } else { 'HealthFailed' }
            StatusCode = $statusCode
            Detail = $null
        }
    }
    catch {
        return [pscustomobject]@{
            Healthy = $false
            Category = 'HealthFailed'
            StatusCode = $null
            Detail = $null
        }
    }
}

function Get-ValidatedPublicOrigin {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$Settings,
        [Parameter(Mandatory = $true)]$TunnelDocument
    )

    $configuredOrigin = Assert-WatchdogPublicOrigin `
        -PublicBaseUrl ([string]$Settings.publicBaseUrl) `
        -Port ([int]$Settings.port)
    $authoritativeOrigin = Get-TunnelPublicBaseUrl `
        -TunnelDocument $TunnelDocument `
        -Port ([int]$Settings.port)
    $authoritativeOrigin = Assert-WatchdogPublicOrigin `
        -PublicBaseUrl $authoritativeOrigin `
        -Port ([int]$Settings.port)

    if (-not [string]::Equals(
        $configuredOrigin,
        $authoritativeOrigin,
        [System.StringComparison]::OrdinalIgnoreCase
    )) {
        throw 'OneClick publicBaseUrl does not match the configured Dev Tunnel.'
    }
    return $authoritativeOrigin
}

function Test-WatchdogDevTunnelLogin {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$DevTunnel,
        [Parameter(Mandatory = $true)][scriptblock]$InvokeNativeJson
    )

    try {
        $result = & $InvokeNativeJson $DevTunnel ([string[]]@('user', 'show', '-j'))
        return [string]$result.status -eq 'Logged in'
    }
    catch {
        return $false
    }
}

function Get-MatchingDevTunnelProcesses {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$TunnelId,
        [Parameter(Mandatory = $true)][object[]]$ProcessRecords
    )

    $matches = @()
    foreach ($record in @($ProcessRecords)) {
        try {
            $identity = Get-DevTunnelHostProcessIdentity -ProcessRecord $record
        }
        catch {
            continue
        }
        if (-not [string]::Equals(
            [string]$identity.TunnelId,
            $TunnelId,
            [System.StringComparison]::OrdinalIgnoreCase
        )) {
            continue
        }
        $matches += [pscustomobject]@{
            ProcessId = [int]$identity.ProcessId
            ParentProcessId = [int]$identity.ParentProcessId
            StartedAtUtc = [string]$identity.StartedAtUtc
            TunnelId = [string]$identity.TunnelId
            CommandLine = [string]$record.CommandLine
        }
    }
    return $matches
}

function New-TunnelCleanupPlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$TunnelId,
        [Parameter(Mandatory = $true)][object[]]$ProcessRecords,
        [Nullable[int]]$KeepProcessId
    )

    $matches = @(Get-MatchingDevTunnelProcesses -TunnelId $TunnelId -ProcessRecords $ProcessRecords)
    $hasKeepProcess = $PSBoundParameters.ContainsKey('KeepProcessId') -and $null -ne $KeepProcessId
    return @($matches | Where-Object {
        -not $hasKeepProcess -or $_.ProcessId -ne [int]$KeepProcessId
    })
}

function Invoke-TunnelCleanupPlan {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][object[]]$Plan,
        [Parameter(Mandatory = $true)][scriptblock]$GetProcessRecord,
        [Parameter(Mandatory = $true)][scriptblock]$StopProcess
    )

    foreach ($planned in @($Plan)) {
        $current = & $GetProcessRecord ([int]$planned.ProcessId)
        if (-not $current) {
            throw "Refusing cleanup because PID $($planned.ProcessId) no longer exists."
        }

        try {
            $currentIdentity = Get-DevTunnelHostProcessIdentity -ProcessRecord $current
        }
        catch {
            throw "Refusing cleanup because PID $($planned.ProcessId) no longer matches a Dev Tunnel host."
        }

        $plannedStartedAt = [DateTime]::Parse([string]$planned.StartedAtUtc).ToUniversalTime()
        $currentStartedAt = [DateTime]::Parse([string]$currentIdentity.StartedAtUtc).ToUniversalTime()
        $sameIdentity = (
            [int]$currentIdentity.ProcessId -eq [int]$planned.ProcessId -and
            $currentStartedAt.Ticks -eq $plannedStartedAt.Ticks -and
            [string]::Equals(
                [string]$currentIdentity.TunnelId,
                [string]$planned.TunnelId,
                [System.StringComparison]::OrdinalIgnoreCase
            )
        )
        if (-not $sameIdentity) {
            throw "Refusing cleanup because PID $($planned.ProcessId) identity changed."
        }

        & $StopProcess ([int]$planned.ProcessId) | Out-Null
    }
}

function Protect-WatchdogToken {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][Security.SecureString]$SecureToken)

    return ConvertFrom-SecureString -SecureString $SecureToken
}

function Unprotect-WatchdogToken {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$CipherText)

    if ([string]::IsNullOrWhiteSpace($CipherText)) {
        throw 'Telegram Bot Token ciphertext is missing.'
    }
    try {
        return ConvertTo-SecureString -String $CipherText -ErrorAction Stop
    }
    catch {
        throw 'Telegram Bot Token cannot be decrypted for the current Windows user.'
    }
}

function New-WatchdogSecurityDescriptor {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][Security.Principal.SecurityIdentifier]$UserSid)

    $descriptor = [Security.AccessControl.DirectorySecurity]::new()
    $descriptor.SetAccessRuleProtection($true, $false)
    $inheritance = (
        [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
        [Security.AccessControl.InheritanceFlags]::ObjectInherit
    )
    foreach ($sid in @(
        $UserSid,
        [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    )) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            $sid,
            [Security.AccessControl.FileSystemRights]::FullControl,
            $inheritance,
            [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        )
        [void]$descriptor.AddAccessRule($rule)
    }
    return $descriptor
}

function Set-WatchdogAcl {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$DirectoryPath,
        [Parameter(Mandatory = $true)][string[]]$FilePaths
    )

    $userSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $systemSid = [Security.Principal.SecurityIdentifier]::new('S-1-5-18')
    $accessSection = [Security.AccessControl.AccessControlSections]::Access

    $directory = Get-Item -LiteralPath $DirectoryPath -ErrorAction Stop
    if (-not $directory.PSIsContainer) {
        throw "Watchdog ACL directory target is invalid: $DirectoryPath"
    }
    $directoryAcl = $directory.GetAccessControl($accessSection)
    $directoryAcl.SetAccessRuleProtection($true, $false)
    $directoryRuleSids = @(
        $directoryAcl.GetAccessRules(
            $true,
            $true,
            [Security.Principal.SecurityIdentifier]
        ) |
            ForEach-Object { $_.IdentityReference } |
            Sort-Object -Property Value -Unique
    )
    foreach ($sid in $directoryRuleSids) {
        $directoryAcl.PurgeAccessRules($sid)
    }
    $inheritance = (
        [Security.AccessControl.InheritanceFlags]::ContainerInherit -bor
        [Security.AccessControl.InheritanceFlags]::ObjectInherit
    )
    foreach ($sid in @($userSid, $systemSid)) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new(
            $sid,
            [Security.AccessControl.FileSystemRights]::FullControl,
            $inheritance,
            [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        )
        [void]$directoryAcl.AddAccessRule($rule)
    }
    $directory.SetAccessControl($directoryAcl)

    foreach ($filePath in @($FilePaths)) {
        if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) {
            throw "Watchdog ACL target is missing: $filePath"
        }
        $file = Get-Item -LiteralPath $filePath -ErrorAction Stop
        $fileAcl = $file.GetAccessControl($accessSection)
        $fileAcl.SetAccessRuleProtection($true, $false)
        $fileRuleSids = @(
            $fileAcl.GetAccessRules(
                $true,
                $true,
                [Security.Principal.SecurityIdentifier]
            ) |
                ForEach-Object { $_.IdentityReference } |
                Sort-Object -Property Value -Unique
        )
        foreach ($sid in $fileRuleSids) {
            $fileAcl.PurgeAccessRules($sid)
        }
        foreach ($sid in @($userSid, $systemSid)) {
            $rule = [Security.AccessControl.FileSystemAccessRule]::new(
                $sid,
                [Security.AccessControl.FileSystemRights]::FullControl,
                [Security.AccessControl.AccessControlType]::Allow
            )
            [void]$fileAcl.AddAccessRule($rule)
        }
        $file.SetAccessControl($fileAcl)
    }
}

function Get-WatchdogDataKeys {
    param([Parameter(Mandatory = $true)]$Data)

    if ($Data -is [System.Collections.IDictionary]) {
        return [string[]]@($Data.Keys)
    }
    return [string[]]@($Data.PSObject.Properties.Name)
}

function Get-WatchdogDataValue {
    param(
        [Parameter(Mandatory = $true)]$Data,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if ($Data -is [System.Collections.IDictionary]) {
        return $Data[$Name]
    }
    $property = $Data.PSObject.Properties[$Name]
    if ($property) {
        return $property.Value
    }
    return $null
}

function Rotate-WatchdogLog {
    param([Parameter(Mandatory = $true)][string]$LogPath)

    if (-not (Test-Path -LiteralPath $LogPath) -or
        (Get-Item -LiteralPath $LogPath).Length -lt 1048576) {
        return
    }

    if (Test-Path -LiteralPath "$LogPath.5") {
        Remove-Item -LiteralPath "$LogPath.5" -Force
    }
    for ($index = 4; $index -ge 1; $index--) {
        $source = "$LogPath.$index"
        if (Test-Path -LiteralPath $source) {
            Move-Item -LiteralPath $source -Destination "$LogPath.$($index + 1)" -Force
        }
    }
    Move-Item -LiteralPath $LogPath -Destination "$LogPath.1" -Force
}

function Assert-WatchdogErrorCategory {
    param($ErrorCategory)

    if ($null -eq $ErrorCategory -or [string]::IsNullOrWhiteSpace([string]$ErrorCategory)) {
        return
    }
    $allowedCategories = @(
        'SettingsMissing',
        'SettingsInvalid',
        'LocalHealthFailed',
        'PublicOriginInvalid',
        'PublicHealthFailed',
        'DevTunnelNotLoggedIn',
        'OneClickStopRefused',
        'TunnelProcessMismatch',
        'OneClickStartFailed',
        'PostRecoveryHealthFailed',
        'TelegramConfigInvalid',
        'TelegramDeliveryFailed',
        'ConnectorFailure',
        'MutexBusy',
        'RunTimedOut'
    )
    if ($allowedCategories -notcontains [string]$ErrorCategory) {
        throw 'Watchdog error category is invalid.'
    }
}

function Assert-WatchdogLogData {
    param([Parameter(Mandatory = $true)]$Data)

    $keys = @(Get-WatchdogDataKeys -Data $Data)
    if ($keys -contains 'Status' -and
        @('unknown', 'healthy', 'unhealthy', 'skipped') -notcontains
            [string](Get-WatchdogDataValue -Data $Data -Name 'Status')) {
        throw 'Watchdog log status is invalid.'
    }
    if ($keys -contains 'ErrorCategory') {
        Assert-WatchdogErrorCategory `
            -ErrorCategory (Get-WatchdogDataValue -Data $Data -Name 'ErrorCategory')
    }
    if ($keys -contains 'StatusCode') {
        $statusCode = Get-WatchdogDataValue -Data $Data -Name 'StatusCode'
        if ($null -ne $statusCode -and ([int]$statusCode -lt 100 -or [int]$statusCode -gt 599)) {
            throw 'Watchdog log status code is invalid.'
        }
    }
    if ($keys -contains 'PublicBaseUrl') {
        $origin = [string](Get-WatchdogDataValue -Data $Data -Name 'PublicBaseUrl')
        if (-not [string]::IsNullOrWhiteSpace($origin)) {
            $portMatch = [regex]::Match(
                $origin,
                '-(?<port>[0-9]{1,5})\.[a-z0-9]+\.devtunnels\.ms$',
                [Text.RegularExpressions.RegexOptions]::IgnoreCase
            )
            if (-not $portMatch.Success) {
                throw 'Watchdog log public origin is invalid.'
            }
            [void](Assert-WatchdogPublicOrigin `
                -PublicBaseUrl $origin `
                -Port ([int]$portMatch.Groups['port'].Value))
        }
    }
    foreach ($booleanKey in @('RecoveryAttempted', 'RecoverySucceeded')) {
        if ($keys -contains $booleanKey -and
            (Get-WatchdogDataValue -Data $Data -Name $booleanKey) -isnot [bool]) {
            throw "Watchdog log $booleanKey must be Boolean."
        }
    }
}

function Write-WatchdogLog {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$Paths,
        [Parameter(Mandatory = $true)][guid]$CorrelationId,
        [Parameter(Mandatory = $true)]
        [ValidateSet('RunStarted', 'RunCompleted', 'RecoveryStarted', 'RecoveryCompleted', 'NotificationFailed', 'MutexBusy', 'ConnectorFailure')]
        [string]$Event,
        [Parameter(Mandatory = $true)]$Data
    )

    $allowedKeys = @(
        'Status',
        'ErrorCategory',
        'StatusCode',
        'PublicBaseUrl',
        'RecoveryAttempted',
        'RecoverySucceeded'
    )
    $keys = @(Get-WatchdogDataKeys -Data $Data)
    $unexpectedKeys = @($keys | Where-Object { $allowedKeys -notcontains $_ })
    if ($unexpectedKeys.Count -gt 0) {
        throw "Watchdog log data contains unsupported fields: $($unexpectedKeys -join ', ')"
    }
    Assert-WatchdogLogData -Data $Data

    $safeData = [ordered]@{}
    foreach ($key in $allowedKeys) {
        if ($keys -contains $key) {
            $safeData[$key] = Get-WatchdogDataValue -Data $Data -Name $key
        }
    }
    $entry = [ordered]@{
        timestampUtc = [DateTime]::UtcNow.ToString('o')
        correlationId = $CorrelationId.ToString()
        event = $Event
        data = $safeData
    }

    $logDirectory = Split-Path -Parent ([string]$Paths.LogPath)
    if (-not (Test-Path -LiteralPath $logDirectory)) {
        New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    }
    Rotate-WatchdogLog -LogPath ([string]$Paths.LogPath)
    [System.IO.File]::AppendAllText(
        [string]$Paths.LogPath,
        (($entry | ConvertTo-Json -Compress -Depth 8) + [Environment]::NewLine),
        [System.Text.UTF8Encoding]::new($false)
    )
}

function Get-WatchdogRecordValue {
    param(
        [Parameter(Mandatory = $true)]$Record,
        [Parameter(Mandatory = $true)][string]$Name,
        $DefaultValue = $null
    )

    if ($Record -is [System.Collections.IDictionary] -and $Record.Contains($Name)) {
        return $Record[$Name]
    }
    $property = $Record.PSObject.Properties[$Name]
    if ($property) {
        return $property.Value
    }
    return $DefaultValue
}

function Get-WatchdogNotificationDecision {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$PreviousState,
        [Parameter(Mandatory = $true)]$CurrentResult
    )

    $previousStatus = [string](Get-WatchdogRecordValue -Record $PreviousState -Name 'status' -DefaultValue 'unknown')
    $previousCategory = [string](Get-WatchdogRecordValue -Record $PreviousState -Name 'lastErrorCategory')
    $currentStatus = [string](Get-WatchdogRecordValue -Record $CurrentResult -Name 'status')
    $currentCategory = [string](Get-WatchdogRecordValue -Record $CurrentResult -Name 'errorCategory')

    if (@('unknown', 'healthy', 'unhealthy') -notcontains $previousStatus -or
        @('healthy', 'unhealthy') -notcontains $currentStatus) {
        throw 'Watchdog notification state is invalid.'
    }

    $kind = 'None'
    if ($currentStatus -eq 'unhealthy') {
        if ($previousStatus -ne 'unhealthy' -or
            -not [string]::Equals(
                $previousCategory,
                $currentCategory,
                [System.StringComparison]::Ordinal
            )) {
            $kind = 'Anomaly'
        }
    }
    elseif ($previousStatus -eq 'unhealthy') {
        $kind = 'Recovery'
    }

    return [pscustomobject]@{
        Kind = $kind
        ErrorCategory = if ($kind -eq 'Anomaly') { $currentCategory } else { $null }
    }
}

function Register-ConnectorFailure {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$State,
        [Parameter(Mandatory = $true)][datetime]$Now
    )

    $lastText = [string](Get-WatchdogRecordValue `
        -Record $State `
        -Name 'lastConnectorFailureNotifiedAtUtc')
    $shouldNotify = $true
    if (-not [string]::IsNullOrWhiteSpace($lastText)) {
        $last = [DateTime]::Parse($lastText).ToUniversalTime()
        $shouldNotify = ($Now.ToUniversalTime() - $last).TotalHours -ge 4
    }

    $newState = [ordered]@{}
    foreach ($property in $State.PSObject.Properties) {
        $newState[$property.Name] = $property.Value
    }
    if ($shouldNotify) {
        $newState['lastConnectorFailureNotifiedAtUtc'] = $Now.ToUniversalTime().ToString('o')
    }

    return [pscustomobject]@{
        ShouldNotify = $shouldNotify
        State = [pscustomobject]$newState
    }
}

function Assert-WatchdogMessage {
    param([Parameter(Mandatory = $true)]$Message)

    $kind = [string](Get-WatchdogRecordValue -Record $Message -Name 'Kind')
    if (@('Anomaly', 'Recovery', 'ConnectorFailure', 'Test') -notcontains $kind) {
        throw 'Telegram notification kind is invalid.'
    }
    $machineName = [string](Get-WatchdogRecordValue -Record $Message -Name 'MachineName')
    if ($machineName -notmatch '^[A-Za-z0-9._-]{1,64}$') {
        throw 'Telegram notification machine name is invalid.'
    }
    foreach ($statusName in @('LocalStatus', 'PublicStatus', 'ConnectorStatus')) {
        $status = [string](Get-WatchdogRecordValue -Record $Message -Name $statusName)
        if (@('unknown', 'ready', 'down', 'healthy', 'unhealthy') -notcontains $status) {
            throw "Telegram notification $statusName is invalid."
        }
    }
    $checkedAtUtc = [string](Get-WatchdogRecordValue -Record $Message -Name 'CheckedAtUtc')
    $parsedTime = [datetime]::MinValue
    if (-not [datetime]::TryParse(
        $checkedAtUtc,
        [Globalization.CultureInfo]::InvariantCulture,
        [Globalization.DateTimeStyles]::RoundtripKind,
        [ref]$parsedTime
    )) {
        throw 'Telegram notification check time is invalid.'
    }
    foreach ($booleanName in @('RecoveryAttempted', 'RecoverySucceeded')) {
        if ((Get-WatchdogRecordValue -Record $Message -Name $booleanName) -isnot [bool]) {
            throw "Telegram notification $booleanName must be Boolean."
        }
    }
    Assert-WatchdogErrorCategory `
        -ErrorCategory (Get-WatchdogRecordValue -Record $Message -Name 'ErrorCategory')
    $publicBaseUrl = [string](Get-WatchdogRecordValue -Record $Message -Name 'PublicBaseUrl')
    if (-not [string]::IsNullOrWhiteSpace($publicBaseUrl)) {
        $portMatch = [regex]::Match($publicBaseUrl, '-(?<port>[0-9]{1,5})\.[a-z0-9]+\.devtunnels\.ms$', 'IgnoreCase')
        if (-not $portMatch.Success) {
            throw 'Telegram notification public origin is invalid.'
        }
        [void](Assert-WatchdogPublicOrigin -PublicBaseUrl $publicBaseUrl -Port ([int]$portMatch.Groups['port'].Value))
    }
}

function ConvertTo-WatchdogTelegramText {
    param([Parameter(Mandatory = $true)]$Message)

    Assert-WatchdogMessage -Message $Message
    $kind = [string]$Message.Kind
    $title = switch ($kind) {
        'Anomaly' { 'DevSpace 異常' }
        'Recovery' { 'DevSpace 已恢復' }
        'ConnectorFailure' { 'DevSpace Connector 異常' }
        'Test' { 'DevSpace Watchdog 測試' }
    }
    $lines = @(
        $title,
        "電腦：$([string]$Message.MachineName)",
        "檢查時間：$([string]$Message.CheckedAtUtc)",
        "本機：$([string]$Message.LocalStatus)",
        "公開：$([string]$Message.PublicStatus)",
        "Connector：$([string]$Message.ConnectorStatus)",
        "復原嘗試：$([bool]$Message.RecoveryAttempted)",
        "復原成功：$([bool]$Message.RecoverySucceeded)",
        "錯誤分類：$([string]$Message.ErrorCategory)",
        "公開 origin：$([string]$Message.PublicBaseUrl)"
    )
    return $lines -join [Environment]::NewLine
}

function Send-WatchdogTelegram {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$Config,
        [Parameter(Mandatory = $true)]$Message,
        [Parameter(Mandatory = $true)][scriptblock]$InvokeTelegram
    )

    if ([int]$Config.schemaVersion -ne 1 -or
        [string]$Config.telegramChatId -notmatch '^-?[0-9]{1,20}$') {
        throw 'Telegram Watchdog configuration is invalid.'
    }

    $text = ConvertTo-WatchdogTelegramText -Message $Message
    $secureToken = Unprotect-WatchdogToken -CipherText ([string]$Config.telegramBotTokenDpapi)
    $pointer = [IntPtr]::Zero
    try {
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureToken)
        $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        $response = & $InvokeTelegram $plainToken ([string]$Config.telegramChatId) $text
        $delivered = $response.Ok -eq $true -and [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 300
        return [pscustomobject]@{
            Delivered = $delivered
            ErrorCategory = if ($delivered) { $null } else { 'TelegramDeliveryFailed' }
            StatusCode = [int]$response.StatusCode
        }
    }
    catch {
        return [pscustomobject]@{
            Delivered = $false
            ErrorCategory = 'TelegramDeliveryFailed'
            StatusCode = $null
        }
    }
    finally {
        if ($pointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        }
    }
}

function Enter-WatchdogMutex {
    [CmdletBinding()]
    param([string]$Name = 'Local\Pixiu.DevSpace.Watchdog')

    $mutex = [Threading.Mutex]::new($false, $Name)
    $acquired = $false
    try {
        try {
            $acquired = $mutex.WaitOne(0, $false)
        }
        catch [Threading.AbandonedMutexException] {
            $acquired = $true
        }
        if (-not $acquired) {
            $mutex.Dispose()
            return [pscustomobject]@{
                Acquired = $false
                Release = $null
            }
        }

        $release = {
            try {
                $mutex.ReleaseMutex()
            }
            finally {
                $mutex.Dispose()
            }
        }.GetNewClosure()
        return [pscustomobject]@{
            Acquired = $true
            Release = $release
        }
    }
    catch {
        $mutex.Dispose()
        throw
    }
}

function Invoke-OneClickAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('start', 'stop')]
        [string]$Action,
        [Parameter(Mandatory = $true)][hashtable]$Dependencies
    )

    $environment = @{
        DEVSPACE_ONECLICK_NONINTERACTIVE = '1'
    }
    & $Dependencies.InvokeOneClick `
        ([string]$Dependencies.OneClickPath) `
        $Action `
        $environment | Out-Null
}

function Invoke-WatchdogProbe {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$Settings,
        [Parameter(Mandatory = $true)][hashtable]$Dependencies
    )

    $localUrl = "http://127.0.0.1:$([int]$Settings.port)/healthz"
    $local = Test-WatchdogHealth -Url $localUrl -InvokeHttp $Dependencies.InvokeHttp

    $publicOrigin = $null
    try {
        $tunnelDocument = & $Dependencies.GetTunnelDocument ([string]$Settings.tunnelId)
        $publicOrigin = Get-ValidatedPublicOrigin `
            -Settings $Settings `
            -TunnelDocument $tunnelDocument
    }
    catch {
        return [pscustomobject]@{
            Status = 'unhealthy'
            ErrorCategory = 'PublicOriginInvalid'
            LocalStatus = if ($local.Healthy) { 'ready' } else { 'down' }
            PublicStatus = 'down'
            LocalStatusCode = $local.StatusCode
            PublicStatusCode = $null
            PublicBaseUrl = [string]$Settings.publicBaseUrl
            RecoveryAttempted = $false
            RecoverySucceeded = $false
        }
    }

    $public = Test-WatchdogHealth `
        -Url "$publicOrigin/healthz" `
        -InvokeHttp $Dependencies.InvokeHttp
    $errorCategory = if (-not $local.Healthy) {
        'LocalHealthFailed'
    }
    elseif (-not $public.Healthy) {
        'PublicHealthFailed'
    }
    else {
        $null
    }

    return [pscustomobject]@{
        Status = if ($errorCategory) { 'unhealthy' } else { 'healthy' }
        ErrorCategory = $errorCategory
        LocalStatus = if ($local.Healthy) { 'ready' } else { 'down' }
        PublicStatus = if ($public.Healthy) { 'ready' } else { 'down' }
        LocalStatusCode = $local.StatusCode
        PublicStatusCode = $public.StatusCode
        PublicBaseUrl = $publicOrigin
        RecoveryAttempted = $false
        RecoverySucceeded = $false
    }
}

function New-WatchdogRecoveryFailure {
    param(
        [Parameter(Mandatory = $true)]$InitialProbe,
        [Parameter(Mandatory = $true)][string]$ErrorCategory
    )

    return [pscustomobject]@{
        Status = 'unhealthy'
        ErrorCategory = $ErrorCategory
        LocalStatus = [string]$InitialProbe.LocalStatus
        PublicStatus = [string]$InitialProbe.PublicStatus
        LocalStatusCode = Get-WatchdogRecordValue -Record $InitialProbe -Name 'LocalStatusCode'
        PublicStatusCode = Get-WatchdogRecordValue -Record $InitialProbe -Name 'PublicStatusCode'
        PublicBaseUrl = [string]$InitialProbe.PublicBaseUrl
        RecoveryAttempted = $true
        RecoverySucceeded = $false
    }
}

function Test-WatchdogDeadline {
    param(
        [Parameter(Mandatory = $true)][datetime]$StartedAtUtc,
        [Parameter(Mandatory = $true)][scriptblock]$GetNow
    )

    $now = (& $GetNow).ToUniversalTime()
    return ($now - $StartedAtUtc.ToUniversalTime()).TotalMinutes -le 8
}

function Invoke-WatchdogRecovery {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$InitialProbe,
        [Parameter(Mandatory = $true)]$Settings,
        [Parameter(Mandatory = $true)][datetime]$StartedAtUtc,
        [Parameter(Mandatory = $true)][hashtable]$Dependencies
    )

    if (-not (Test-WatchdogDeadline -StartedAtUtc $StartedAtUtc -GetNow $Dependencies.GetNow)) {
        return New-WatchdogRecoveryFailure -InitialProbe $InitialProbe -ErrorCategory 'RunTimedOut'
    }

    $loggedIn = Test-WatchdogDevTunnelLogin `
        -DevTunnel ([string]$Dependencies.DevTunnelPath) `
        -InvokeNativeJson $Dependencies.InvokeNativeJson
    if (-not $loggedIn) {
        return New-WatchdogRecoveryFailure `
            -InitialProbe $InitialProbe `
            -ErrorCategory 'DevTunnelNotLoggedIn'
    }

    try {
        Invoke-OneClickAction -Action 'stop' -Dependencies $Dependencies
    }
    catch {
        return New-WatchdogRecoveryFailure `
            -InitialProbe $InitialProbe `
            -ErrorCategory 'OneClickStopRefused'
    }

    if (-not (Test-WatchdogDeadline -StartedAtUtc $StartedAtUtc -GetNow $Dependencies.GetNow)) {
        return New-WatchdogRecoveryFailure -InitialProbe $InitialProbe -ErrorCategory 'RunTimedOut'
    }

    try {
        $records = @(& $Dependencies.GetProcessRecords)
        $cleanupPlan = @(
            New-TunnelCleanupPlan `
                -TunnelId ([string]$Settings.tunnelId) `
                -ProcessRecords $records
        )
        Invoke-TunnelCleanupPlan `
            -Plan $cleanupPlan `
            -GetProcessRecord $Dependencies.GetProcessRecord `
            -StopProcess $Dependencies.StopProcess
    }
    catch {
        return New-WatchdogRecoveryFailure `
            -InitialProbe $InitialProbe `
            -ErrorCategory 'TunnelProcessMismatch'
    }

    if (-not (Test-WatchdogDeadline -StartedAtUtc $StartedAtUtc -GetNow $Dependencies.GetNow)) {
        return New-WatchdogRecoveryFailure -InitialProbe $InitialProbe -ErrorCategory 'RunTimedOut'
    }

    try {
        Invoke-OneClickAction -Action 'start' -Dependencies $Dependencies
    }
    catch {
        return New-WatchdogRecoveryFailure `
            -InitialProbe $InitialProbe `
            -ErrorCategory 'OneClickStartFailed'
    }

    try {
        $freshSettings = & $Dependencies.ReadSettings
        $postProbe = & $Dependencies.Probe $freshSettings
    }
    catch {
        return New-WatchdogRecoveryFailure `
            -InitialProbe $InitialProbe `
            -ErrorCategory 'PostRecoveryHealthFailed'
    }

    if ([string]$postProbe.Status -ne 'healthy') {
        return [pscustomobject]@{
            Status = 'unhealthy'
            ErrorCategory = 'PostRecoveryHealthFailed'
            LocalStatus = [string]$postProbe.LocalStatus
            PublicStatus = [string]$postProbe.PublicStatus
            LocalStatusCode = Get-WatchdogRecordValue -Record $postProbe -Name 'LocalStatusCode'
            PublicStatusCode = Get-WatchdogRecordValue -Record $postProbe -Name 'PublicStatusCode'
            PublicBaseUrl = [string]$postProbe.PublicBaseUrl
            RecoveryAttempted = $true
            RecoverySucceeded = $false
        }
    }

    return [pscustomobject]@{
        Status = 'healthy'
        ErrorCategory = $null
        LocalStatus = [string]$postProbe.LocalStatus
        PublicStatus = [string]$postProbe.PublicStatus
        LocalStatusCode = Get-WatchdogRecordValue -Record $postProbe -Name 'LocalStatusCode'
        PublicStatusCode = Get-WatchdogRecordValue -Record $postProbe -Name 'PublicStatusCode'
        PublicBaseUrl = [string]$postProbe.PublicBaseUrl
        RecoveryAttempted = $true
        RecoverySucceeded = $true
    }
}

function New-WatchdogState {
    param(
        [Parameter(Mandatory = $true)]$PreviousState,
        [Parameter(Mandatory = $true)]$Result,
        [Parameter(Mandatory = $true)][datetime]$Now
    )

    $lastRecoveryAtUtc = Get-WatchdogRecordValue `
        -Record $PreviousState `
        -Name 'lastRecoveryAtUtc'
    if ($Result.RecoverySucceeded -eq $true) {
        $lastRecoveryAtUtc = $Now.ToUniversalTime().ToString('o')
    }
    return [pscustomobject][ordered]@{
        schemaVersion = 1
        status = [string]$Result.Status
        lastErrorCategory = if ($Result.ErrorCategory) { [string]$Result.ErrorCategory } else { $null }
        lastNotifiedStatus = Get-WatchdogRecordValue -Record $PreviousState -Name 'lastNotifiedStatus'
        lastNotifiedErrorCategory = Get-WatchdogRecordValue -Record $PreviousState -Name 'lastNotifiedErrorCategory'
        lastCheckAtUtc = $Now.ToUniversalTime().ToString('o')
        lastRecoveryAtUtc = $lastRecoveryAtUtc
        lastConnectorFailureNotifiedAtUtc = Get-WatchdogRecordValue `
            -Record $PreviousState `
            -Name 'lastConnectorFailureNotifiedAtUtc'
        publicBaseUrl = [string]$Result.PublicBaseUrl
    }
}

function Invoke-WatchdogRun {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][hashtable]$Dependencies)

    $mutex = & $Dependencies.AcquireMutex
    if (-not $mutex.Acquired) {
        return [pscustomobject]@{
            Status = 'skipped'
            ErrorCategory = 'MutexBusy'
            RecoveryAttempted = $false
            RecoverySucceeded = $false
        }
    }

    $correlationId = [guid]::NewGuid()
    try {
        $startedAtUtc = (& $Dependencies.GetNow).ToUniversalTime()
        try {
            $settings = & $Dependencies.ReadSettings
            $result = & $Dependencies.Probe $settings
        }
        catch {
            $settingsErrorCategory = if ($_.Exception.Message -eq 'OneClick settings are missing.') {
                'SettingsMissing'
            }
            else {
                'SettingsInvalid'
            }
            $result = [pscustomobject]@{
                Status = 'unhealthy'
                ErrorCategory = $settingsErrorCategory
                LocalStatus = 'unknown'
                PublicStatus = 'unknown'
                PublicBaseUrl = ''
                RecoveryAttempted = $false
                RecoverySucceeded = $false
            }
        }

        if ([string]$result.Status -eq 'unhealthy' -and
            [string]$result.ErrorCategory -notin @('SettingsMissing', 'SettingsInvalid')) {
            $result = Invoke-WatchdogRecovery `
                -InitialProbe $result `
                -Settings $settings `
                -StartedAtUtc $startedAtUtc `
                -Dependencies $Dependencies
        }

        $previousState = & $Dependencies.ReadState
        if (-not $previousState) {
            $previousState = [pscustomobject]@{
                status = 'unknown'
                lastErrorCategory = $null
            }
        }
        $decision = Get-WatchdogNotificationDecision `
            -PreviousState $previousState `
            -CurrentResult $result
        $now = (& $Dependencies.GetNow).ToUniversalTime()
        $newState = New-WatchdogState `
            -PreviousState $previousState `
            -Result $result `
            -Now $now

        $notificationFailureStatusCode = $null
        $notificationFailed = $false
        if ($decision.Kind -ne 'None') {
            try {
                $notification = & $Dependencies.Notify $decision $result $now
                if ($notification.Delivered -eq $true) {
                    $newState.lastNotifiedStatus = [string]$result.Status
                    $newState.lastNotifiedErrorCategory = if ($result.ErrorCategory) {
                        [string]$result.ErrorCategory
                    }
                    else {
                        $null
                    }
                }
                else {
                    $notificationFailed = $true
                    $notificationFailureStatusCode = Get-WatchdogRecordValue `
                        -Record $notification `
                        -Name 'StatusCode'
                }
            }
            catch {
                $notificationFailed = $true
            }
        }

        & $Dependencies.WriteState $newState | Out-Null
        if ($notificationFailed) {
            & $Dependencies.WriteLog 'NotificationFailed' ([ordered]@{
                Status = [string]$result.Status
                ErrorCategory = 'TelegramDeliveryFailed'
                StatusCode = $notificationFailureStatusCode
                PublicBaseUrl = [string]$result.PublicBaseUrl
                RecoveryAttempted = [bool]$result.RecoveryAttempted
                RecoverySucceeded = [bool]$result.RecoverySucceeded
            }) $correlationId | Out-Null
        }
        & $Dependencies.WriteLog 'RunCompleted' ([ordered]@{
            Status = [string]$result.Status
            ErrorCategory = $result.ErrorCategory
            PublicBaseUrl = [string]$result.PublicBaseUrl
            RecoveryAttempted = [bool]$result.RecoveryAttempted
            RecoverySucceeded = [bool]$result.RecoverySucceeded
        }) $correlationId | Out-Null
        return $result
    }
    finally {
        if ($mutex.Release) {
            & $mutex.Release
        }
    }
}

function ConvertTo-WatchdogProcessRecord {
    param([Parameter(Mandatory = $true)]$Process)

    $startedAtUtc = if ($Process.CreationDate -is [datetime]) {
        $Process.CreationDate.ToUniversalTime()
    }
    else {
        [Management.ManagementDateTimeConverter]::ToDateTime([string]$Process.CreationDate).ToUniversalTime()
    }
    return [pscustomobject]@{
        Name = [string]$Process.Name
        ProcessId = [int]$Process.ProcessId
        ParentProcessId = [int]$Process.ParentProcessId
        CommandLine = [string]$Process.CommandLine
        StartedAtUtc = $startedAtUtc.ToString('o')
    }
}

function Invoke-WatchdogTelegramRequest {
    param(
        [Parameter(Mandatory = $true)][string]$Token,
        [Parameter(Mandatory = $true)][string]$ChatId,
        [Parameter(Mandatory = $true)][string]$Text
    )

    $response = Invoke-WebRequest `
        -UseBasicParsing `
        -Method Post `
        -Uri "https://api.telegram.org/bot$Token/sendMessage" `
        -Body @{ chat_id = $ChatId; text = $Text } `
        -TimeoutSec 10
    $body = $response.Content | ConvertFrom-Json
    return [pscustomobject]@{
        StatusCode = [int]$response.StatusCode
        Ok = $body.ok -eq $true
    }
}

function New-WatchdogDependencies {
    [CmdletBinding()]
    param(
        [string]$OneClickStateRoot = $(if ($env:LOCALAPPDATA) {
            Join-Path $env:LOCALAPPDATA 'DevSpaceOneClick'
        }
        else {
            Join-Path $env:USERPROFILE '.devspace-oneclick'
        }),
        [string]$MachineName = $env:COMPUTERNAME
    )

    $watchdogPaths = Get-WatchdogPaths -StateRoot (Join-Path $OneClickStateRoot 'watchdog')
    $settingsPath = Join-Path $OneClickStateRoot 'settings.json'
    $oneClickPath = Join-Path $PSScriptRoot 'devspace-oneclick.ps1'
    $tools = Get-InstalledTools

    $invokeHttp = {
        param($Url, $TimeoutSeconds)
        $body = Invoke-RestMethod `
            -UseBasicParsing `
            -Uri $Url `
            -TimeoutSec $TimeoutSeconds
        return [pscustomobject]@{
            Body = $body
            StatusCode = 200
        }
    }
    $getTunnelDocument = {
        param($TunnelId)
        return ConvertFrom-NativeJson `
            -Executable $tools.DevTunnel `
            -Arguments @('show', $TunnelId, '-j', '-v') `
            -Operation 'Watchdog Dev Tunnel lookup' `
            -UseVerboseHttpJson
    }.GetNewClosure()
    $probeDependencies = @{
        InvokeHttp = $invokeHttp
        GetTunnelDocument = $getTunnelDocument
    }
    $readSettings = {
        return Get-ValidatedOneClickSettings `
            -SettingsPath $settingsPath `
            -MachineName $MachineName
    }.GetNewClosure()
    $probe = {
        param($Settings)
        return Invoke-WatchdogProbe `
            -Settings $Settings `
            -Dependencies $probeDependencies
    }.GetNewClosure()

    return @{
        Paths = $watchdogPaths
        SettingsPath = $settingsPath
        OneClickPath = $oneClickPath
        DevTunnelPath = [string]$tools.DevTunnel
        AcquireMutex = { Enter-WatchdogMutex }
        GetNow = { [DateTime]::UtcNow }
        ReadSettings = $readSettings
        Probe = $probe
        InvokeHttp = $invokeHttp
        GetTunnelDocument = $getTunnelDocument
        InvokeNativeJson = {
            param($Executable, $Arguments)
            return ConvertFrom-NativeJson `
                -Executable $Executable `
                -Arguments $Arguments `
                -Operation 'Watchdog Dev Tunnel login check'
        }
        InvokeOneClick = {
            param($OneClickScript, $OneClickAction, $Environment)
            $previousMode = $env:DEVSPACE_ONECLICK_NONINTERACTIVE
            try {
                $env:DEVSPACE_ONECLICK_NONINTERACTIVE = [string]$Environment.DEVSPACE_ONECLICK_NONINTERACTIVE
                & powershell.exe `
                    -NoProfile `
                    -ExecutionPolicy Bypass `
                    -File $OneClickScript `
                    $OneClickAction
                if ($LASTEXITCODE -ne 0) {
                    throw "OneClick $OneClickAction failed with exit code $LASTEXITCODE."
                }
            }
            finally {
                $env:DEVSPACE_ONECLICK_NONINTERACTIVE = $previousMode
            }
        }
        GetProcessRecords = {
            return @(
                Get-CimInstance Win32_Process -Filter "Name='devtunnel.exe'" |
                    ForEach-Object { ConvertTo-WatchdogProcessRecord -Process $_ }
            )
        }
        GetProcessRecord = {
            param($ProcessId)
            $process = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$ProcessId)" |
                Select-Object -First 1
            if (-not $process) {
                return $null
            }
            return ConvertTo-WatchdogProcessRecord -Process $process
        }
        StopProcess = {
            param($ProcessId)
            Stop-Process -Id ([int]$ProcessId) -ErrorAction Stop
        }
        ReadState = {
            return Read-WatchdogJson -FilePath $watchdogPaths.StatePath
        }.GetNewClosure()
        WriteState = {
            param($State)
            Write-WatchdogJsonAtomic -FilePath $watchdogPaths.StatePath -Value $State
        }.GetNewClosure()
        Notify = {
            param($Decision, $Result, $Now)
            $config = Read-WatchdogJson -FilePath $watchdogPaths.ConfigPath
            if (-not $config) {
                throw 'Telegram Watchdog configuration is missing.'
            }
            $message = [pscustomobject]@{
                Kind = [string]$Decision.Kind
                MachineName = $MachineName
                CheckedAtUtc = $Now.ToUniversalTime().ToString('o')
                LocalStatus = [string]$Result.LocalStatus
                PublicStatus = [string]$Result.PublicStatus
                ConnectorStatus = 'unknown'
                RecoveryAttempted = [bool]$Result.RecoveryAttempted
                RecoverySucceeded = [bool]$Result.RecoverySucceeded
                ErrorCategory = $Result.ErrorCategory
                PublicBaseUrl = [string]$Result.PublicBaseUrl
            }
            return Send-WatchdogTelegram `
                -Config $config `
                -Message $message `
                -InvokeTelegram ${function:Invoke-WatchdogTelegramRequest}
        }.GetNewClosure()
        WriteLog = {
            param($Event, $Data, $CorrelationId)
            Write-WatchdogLog `
                -Paths $watchdogPaths `
                -CorrelationId $CorrelationId `
                -Event $Event `
                -Data $Data
        }.GetNewClosure()
    }
}

function New-WatchdogTaskSpec {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$ScriptPath,
        [Parameter(Mandatory = $true)][string]$UserId,
        [Parameter(Mandatory = $true)][datetime]$StartAt
    )

    if (-not [System.IO.Path]::IsPathRooted($ScriptPath)) {
        throw 'The Watchdog task script path must be absolute.'
    }
    if ([string]::IsNullOrWhiteSpace($UserId)) {
        throw 'The Watchdog task user is missing.'
    }

    return [pscustomobject]@{
        TaskName = 'Pixiu DevSpace Watchdog'
        Execute = 'powershell.exe'
        Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" run"
        ScriptPath = $ScriptPath
        UserId = $UserId
        StartAt = $StartAt
        AtLogOn = $true
        RepetitionInterval = [TimeSpan]::FromHours(4)
        MultipleInstances = 'IgnoreNew'
        StartWhenAvailable = $true
        ExecutionTimeLimit = [TimeSpan]::FromMinutes(10)
        RunLevel = 'Limited'
        LogonType = 'Interactive'
    }
}

function Assert-WatchdogTaskMatchesSpec {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$Task,
        [Parameter(Mandatory = $true)]$TaskSpec
    )

    if (-not $Task) {
        throw 'Watchdog task read-back returned no task.'
    }
    $checks = @(
        ([string]$Task.TaskName -eq [string]$TaskSpec.TaskName),
        ([string]$Task.Execute -eq [string]$TaskSpec.Execute),
        ([string]$Task.Arguments -eq [string]$TaskSpec.Arguments),
        ($Task.AtLogOn -eq $true),
        ([double]$Task.RepetitionIntervalHours -eq 4),
        ([string]$Task.MultipleInstances -eq 'IgnoreNew'),
        ($Task.StartWhenAvailable -eq $true),
        ([double]$Task.ExecutionTimeLimitMinutes -eq 10),
        ([string]$Task.RunLevel -eq 'Limited'),
        ([string]$Task.LogonType -eq 'Interactive'),
        [string]::Equals(
            [string]$Task.UserId,
            [string]$TaskSpec.UserId,
            [System.StringComparison]::OrdinalIgnoreCase
        )
    )
    if ($checks -contains $false) {
        throw 'Watchdog task read-back does not match the required safe specification.'
    }
    return $true
}

function Install-WatchdogTask {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$TaskSpec,
        [Parameter(Mandatory = $true)][scriptblock]$RegisterTask,
        [Parameter(Mandatory = $true)][scriptblock]$GetTask,
        [Parameter(Mandatory = $true)][scriptblock]$UnregisterTask
    )

    $registered = $false
    try {
        & $RegisterTask $TaskSpec | Out-Null
        $registered = $true
        $task = & $GetTask ([string]$TaskSpec.TaskName)
        [void](Assert-WatchdogTaskMatchesSpec -Task $task -TaskSpec $TaskSpec)
    }
    catch {
        if ($registered) {
            & $UnregisterTask ([string]$TaskSpec.TaskName) | Out-Null
        }
        throw
    }
}

function Install-Watchdog {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][hashtable]$Dependencies)

    $secureToken = & $Dependencies.ReadSecureToken
    if (-not $secureToken -or $secureToken.Length -lt 10) {
        throw 'Telegram Bot Token is missing or too short.'
    }
    $chatId = [string](& $Dependencies.ReadChatId)
    if ($chatId -notmatch '^-?[0-9]{1,20}$') {
        throw 'Telegram Chat ID is invalid.'
    }

    $config = [pscustomobject][ordered]@{
        schemaVersion = 1
        telegramChatId = $chatId
        telegramBotTokenDpapi = Protect-WatchdogToken -SecureToken $secureToken
    }
    & $Dependencies.WriteConfig $config | Out-Null
    & $Dependencies.ApplyAcl | Out-Null

    $readBack = & $Dependencies.ReadConfig
    if (-not $readBack -or [int]$readBack.schemaVersion -ne 1 -or
        [string]$readBack.telegramChatId -ne $chatId) {
        throw 'Watchdog configuration read-back failed.'
    }
    $readBackToken = Unprotect-WatchdogToken `
        -CipherText ([string]$readBack.telegramBotTokenDpapi)
    if (-not $readBackToken -or $readBackToken.Length -lt 10) {
        throw 'Watchdog DPAPI read-back failed.'
    }

    $settings = & $Dependencies.ReadSettings
    $records = @(& $Dependencies.GetProcessRecords)
    $matchingHosts = @(
        Get-MatchingDevTunnelProcesses `
            -TunnelId ([string]$settings.tunnelId) `
            -ProcessRecords $records
    )
    if ($matchingHosts.Count -gt 1) {
        $confirmed = & $Dependencies.ConfirmCleanup $matchingHosts
        if (-not $confirmed) {
            throw 'Duplicate Dev Tunnel host cleanup was not approved.'
        }
        & $Dependencies.NormalizeHosts $settings | Out-Null
    }

    $taskSpec = New-WatchdogTaskSpec `
        -ScriptPath ([string]$Dependencies.ScriptPath) `
        -UserId ([string]$Dependencies.UserId) `
        -StartAt ((& $Dependencies.GetNow).AddMinutes(1))
    & $Dependencies.InstallTask $taskSpec | Out-Null
    & $Dependencies.RunOnce | Out-Null
}

function Get-WatchdogStatus {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][hashtable]$Dependencies)

    $task = & $Dependencies.GetTask
    $state = & $Dependencies.ReadState
    return [pscustomobject]@{
        TaskName = if ($task) { [string]$task.TaskName } else { 'Pixiu DevSpace Watchdog' }
        TaskState = if ($task) {
            [string](Get-WatchdogRecordValue -Record $task -Name 'State' -DefaultValue 'Unknown')
        }
        else {
            'NotInstalled'
        }
        Status = if ($state) {
            [string](Get-WatchdogRecordValue -Record $state -Name 'status' -DefaultValue 'unknown')
        }
        else {
            'unknown'
        }
        LastErrorCategory = if ($state) {
            Get-WatchdogRecordValue -Record $state -Name 'lastErrorCategory'
        }
        else {
            $null
        }
        LastCheckAtUtc = if ($state) {
            Get-WatchdogRecordValue -Record $state -Name 'lastCheckAtUtc'
        }
        else {
            $null
        }
        PublicBaseUrl = if ($state) {
            [string](Get-WatchdogRecordValue -Record $state -Name 'publicBaseUrl')
        }
        else {
            ''
        }
    }
}

function Remove-WatchdogInstallation {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$Paths,
        [Parameter(Mandatory = $true)][scriptblock]$Confirm,
        [Parameter(Mandatory = $true)][scriptblock]$UnregisterTask,
        [Parameter(Mandatory = $true)][scriptblock]$RemoveDirectory
    )

    if (-not (& $Confirm)) {
        return $false
    }
    & $UnregisterTask 'Pixiu DevSpace Watchdog' | Out-Null
    & $RemoveDirectory ([string]$Paths.Root) | Out-Null
    return $true
}

function Register-WatchdogScheduledTask {
    param([Parameter(Mandatory = $true)]$TaskSpec)

    Import-Module ScheduledTasks -ErrorAction Stop
    $action = New-ScheduledTaskAction `
        -Execute ([string]$TaskSpec.Execute) `
        -Argument ([string]$TaskSpec.Arguments)
    $logonTrigger = New-ScheduledTaskTrigger `
        -AtLogOn `
        -User ([string]$TaskSpec.UserId)
    $repeatTrigger = New-ScheduledTaskTrigger `
        -Once `
        -At $TaskSpec.StartAt `
        -RepetitionInterval $TaskSpec.RepetitionInterval
    $principal = New-ScheduledTaskPrincipal `
        -UserId ([string]$TaskSpec.UserId) `
        -LogonType Interactive `
        -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet `
        -MultipleInstances IgnoreNew `
        -StartWhenAvailable `
        -ExecutionTimeLimit $TaskSpec.ExecutionTimeLimit

    Register-ScheduledTask `
        -TaskName ([string]$TaskSpec.TaskName) `
        -Action $action `
        -Trigger @($logonTrigger, $repeatTrigger) `
        -Principal $principal `
        -Settings $settings `
        -Description 'Pixiu DevSpace 本機健康檢查與受控復原' `
        -Force | Out-Null
}

function ConvertFrom-WatchdogTaskDuration {
    param($Value)

    if ($Value -is [TimeSpan]) {
        return $Value
    }
    if ([string]::IsNullOrWhiteSpace([string]$Value)) {
        return [TimeSpan]::Zero
    }
    return [Xml.XmlConvert]::ToTimeSpan([string]$Value)
}

function Get-WatchdogScheduledTaskSnapshot {
    param([string]$TaskName = 'Pixiu DevSpace Watchdog')

    Import-Module ScheduledTasks -ErrorAction Stop
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $task) {
        return $null
    }
    $action = @($task.Actions)[0]
    $triggers = @($task.Triggers)
    $repeatTrigger = @($triggers | Where-Object {
        $_.Repetition -and -not [string]::IsNullOrWhiteSpace([string]$_.Repetition.Interval)
    } | Select-Object -First 1)
    $hasLogonTrigger = @($triggers | Where-Object {
        $_.CimClass.CimClassName -eq 'MSFT_TaskLogonTrigger'
    }).Count -gt 0
    $repeatHours = if ($repeatTrigger.Count -gt 0) {
        (ConvertFrom-WatchdogTaskDuration -Value $repeatTrigger[0].Repetition.Interval).TotalHours
    }
    else {
        0
    }
    $executionMinutes = (
        ConvertFrom-WatchdogTaskDuration -Value $task.Settings.ExecutionTimeLimit
    ).TotalMinutes
    $runLevel = if ([string]$task.Principal.RunLevel -in @('Limited', 'LeastPrivilege')) {
        'Limited'
    }
    else {
        [string]$task.Principal.RunLevel
    }
    $logonType = if ([string]$task.Principal.LogonType -in @('Interactive', 'InteractiveToken')) {
        'Interactive'
    }
    else {
        [string]$task.Principal.LogonType
    }

    return [pscustomobject]@{
        TaskName = [string]$task.TaskName
        State = [string]$task.State
        Execute = [string]$action.Execute
        Arguments = [string]$action.Arguments
        AtLogOn = $hasLogonTrigger
        RepetitionIntervalHours = [double]$repeatHours
        MultipleInstances = [string]$task.Settings.MultipleInstances
        StartWhenAvailable = [bool]$task.Settings.StartWhenAvailable
        ExecutionTimeLimitMinutes = [double]$executionMinutes
        RunLevel = $runLevel
        LogonType = $logonType
        UserId = [string]$task.Principal.UserId
    }
}

function Invoke-WatchdogHostNormalization {
    param(
        [Parameter(Mandatory = $true)]$Settings,
        [Parameter(Mandatory = $true)][hashtable]$RunDependencies
    )

    $initial = [pscustomobject]@{
        Status = 'unhealthy'
        ErrorCategory = 'TunnelProcessMismatch'
        LocalStatus = 'unknown'
        PublicStatus = 'unknown'
        PublicBaseUrl = [string]$Settings.publicBaseUrl
    }
    $result = Invoke-WatchdogRecovery `
        -InitialProbe $initial `
        -Settings $Settings `
        -StartedAtUtc ((& $RunDependencies.GetNow).ToUniversalTime()) `
        -Dependencies $RunDependencies
    if ([string]$result.Status -ne 'healthy') {
        throw "Duplicate tunnel host normalization failed: $($result.ErrorCategory)"
    }
}

function New-WatchdogLifecycleDependencies {
    [CmdletBinding()]
    param(
        [string]$OneClickStateRoot = $(if ($env:LOCALAPPDATA) {
            Join-Path $env:LOCALAPPDATA 'DevSpaceOneClick'
        }
        else {
            Join-Path $env:USERPROFILE '.devspace-oneclick'
        }),
        [string]$MachineName = $env:COMPUTERNAME
    )

    $paths = Get-WatchdogPaths -StateRoot (Join-Path $OneClickStateRoot 'watchdog')
    $settingsPath = Join-Path $OneClickStateRoot 'settings.json'
    $scriptPath = Join-Path $PSScriptRoot 'devspace-watchdog.ps1'
    $userId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
    $runDependenciesFactory = {
        return New-WatchdogDependencies `
            -OneClickStateRoot $OneClickStateRoot `
            -MachineName $MachineName
    }.GetNewClosure()

    return @{
        Paths = $paths
        ScriptPath = $scriptPath
        UserId = $userId
        MachineName = $MachineName
        GetNow = { [DateTime]::Now }
        AcquireMutex = { Enter-WatchdogMutex }
        ReadSecureToken = {
            return Read-Host '請輸入既有 Telegram Bot Token' -AsSecureString
        }
        ReadChatId = {
            return Read-Host '請輸入 Telegram Channel／Chat ID'
        }
        WriteConfig = {
            param($Config)
            Write-WatchdogJsonAtomic -FilePath $paths.ConfigPath -Value $Config
        }.GetNewClosure()
        ApplyAcl = {
            Set-WatchdogAcl `
                -DirectoryPath $paths.Root `
                -FilePaths @($paths.ConfigPath)
        }.GetNewClosure()
        ReadConfig = {
            return Read-WatchdogJson -FilePath $paths.ConfigPath
        }.GetNewClosure()
        ReadSettings = {
            return Get-ValidatedOneClickSettings `
                -SettingsPath $settingsPath `
                -MachineName $MachineName
        }.GetNewClosure()
        GetProcessRecords = {
            return @(
                Get-CimInstance Win32_Process -Filter "Name='devtunnel.exe'" |
                    ForEach-Object { ConvertTo-WatchdogProcessRecord -Process $_ }
            )
        }
        ConfirmCleanup = {
            param($Matches)
            Write-Host '將整理以下與設定 tunnel ID 精確匹配的程序：' -ForegroundColor Yellow
            foreach ($match in @($Matches)) {
                Write-Host "  PID $($match.ProcessId): $($match.CommandLine)"
            }
            return (Read-Host '輸入 YES 確認受控停止、整理與重啟') -ceq 'YES'
        }
        NormalizeHosts = {
            param($Settings)
            $runDependencies = & $runDependenciesFactory
            Invoke-WatchdogHostNormalization `
                -Settings $Settings `
                -RunDependencies $runDependencies
        }.GetNewClosure()
        InstallTask = {
            param($TaskSpec)
            Install-WatchdogTask `
                -TaskSpec $TaskSpec `
                -RegisterTask ${function:Register-WatchdogScheduledTask} `
                -GetTask ${function:Get-WatchdogScheduledTaskSnapshot} `
                -UnregisterTask {
                    param($TaskName)
                    Unregister-ScheduledTask `
                        -TaskName $TaskName `
                        -Confirm:$false `
                        -ErrorAction SilentlyContinue
                }
        }
        RunOnce = {
            $runDependencies = & $runDependenciesFactory
            return Invoke-WatchdogRun -Dependencies $runDependencies
        }.GetNewClosure()
        GetTask = {
            return Get-WatchdogScheduledTaskSnapshot
        }
        ReadState = {
            return Read-WatchdogJson -FilePath $paths.StatePath
        }.GetNewClosure()
        WriteState = {
            param($State)
            Write-WatchdogJsonAtomic -FilePath $paths.StatePath -Value $State
        }.GetNewClosure()
        SendMessage = {
            param($Config, $Message)
            return Send-WatchdogTelegram `
                -Config $Config `
                -Message $Message `
                -InvokeTelegram ${function:Invoke-WatchdogTelegramRequest}
        }
        UnregisterTask = {
            param($TaskName)
            Unregister-ScheduledTask `
                -TaskName $TaskName `
                -Confirm:$false `
                -ErrorAction SilentlyContinue
        }
        RemoveDirectory = {
            param($DirectoryPath)
            $expected = [System.IO.Path]::GetFullPath($paths.Root).TrimEnd('\')
            $actual = [System.IO.Path]::GetFullPath($DirectoryPath).TrimEnd('\')
            if (-not [string]::Equals(
                $expected,
                $actual,
                [System.StringComparison]::OrdinalIgnoreCase
            )) {
                throw 'Refusing to remove a directory outside the fixed Watchdog state root.'
            }
            if (Test-Path -LiteralPath $actual) {
                Remove-Item -LiteralPath $actual -Recurse -Force
            }
        }.GetNewClosure()
    }
}

function Invoke-WatchdogConnectorFailure {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][hashtable]$Dependencies)

    $mutex = & $Dependencies.AcquireMutex
    if (-not $mutex.Acquired) {
        return [pscustomobject]@{
            Delivered = $false
            Deduplicated = $true
            ErrorCategory = 'MutexBusy'
            StatusCode = $null
        }
    }

    try {
        $now = (& $Dependencies.GetNow).ToUniversalTime()
        $state = & $Dependencies.ReadState
        if (-not $state) {
            $state = [pscustomobject]@{
                schemaVersion = 1
                status = 'unknown'
                lastErrorCategory = $null
                lastConnectorFailureNotifiedAtUtc = $null
                publicBaseUrl = ''
            }
        }
        $registration = Register-ConnectorFailure -State $state -Now $now
        if (-not $registration.ShouldNotify) {
            return [pscustomobject]@{
                Delivered = $false
                Deduplicated = $true
                ErrorCategory = $null
                StatusCode = $null
            }
        }

        $config = & $Dependencies.ReadConfig
        $serviceStatus = [string](Get-WatchdogRecordValue `
            -Record $state `
            -Name 'status' `
            -DefaultValue 'unknown')
        $message = [pscustomobject]@{
            Kind = 'ConnectorFailure'
            MachineName = [string]$Dependencies.MachineName
            CheckedAtUtc = $now.ToString('o')
            LocalStatus = $serviceStatus
            PublicStatus = $serviceStatus
            ConnectorStatus = 'down'
            RecoveryAttempted = $false
            RecoverySucceeded = $false
            ErrorCategory = 'ConnectorFailure'
            PublicBaseUrl = [string](Get-WatchdogRecordValue `
                -Record $state `
                -Name 'publicBaseUrl' `
                -DefaultValue '')
        }
        $delivery = & $Dependencies.SendMessage $config $message
        if ($delivery.Delivered -eq $true) {
            & $Dependencies.WriteState $registration.State | Out-Null
        }
        return [pscustomobject]@{
            Delivered = $delivery.Delivered
            Deduplicated = $false
            ErrorCategory = $delivery.ErrorCategory
            StatusCode = $delivery.StatusCode
        }
    }
    finally {
        if ($mutex.Release) {
            & $mutex.Release
        }
    }
}

function Invoke-WatchdogTestTelegram {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][hashtable]$Dependencies)

    $now = (& $Dependencies.GetNow).ToUniversalTime()
    $config = & $Dependencies.ReadConfig
    $state = & $Dependencies.ReadState
    $status = if ($state) {
        [string](Get-WatchdogRecordValue -Record $state -Name 'status' -DefaultValue 'unknown')
    }
    else {
        'unknown'
    }
    $message = [pscustomobject]@{
        Kind = 'Test'
        MachineName = [string]$Dependencies.MachineName
        CheckedAtUtc = $now.ToString('o')
        LocalStatus = $status
        PublicStatus = $status
        ConnectorStatus = 'unknown'
        RecoveryAttempted = $false
        RecoverySucceeded = $false
        ErrorCategory = $null
        PublicBaseUrl = if ($state) {
            [string](Get-WatchdogRecordValue -Record $state -Name 'publicBaseUrl' -DefaultValue '')
        }
        else {
            ''
        }
    }
    return & $Dependencies.SendMessage $config $message
}

function Invoke-WatchdogMain {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('install', 'run', 'status', 'remove', 'notify-connector-failure', 'test-telegram')]
        [string]$Action,
        [hashtable]$CommandHandlers
    )

    if (-not $CommandHandlers) {
        $lifecycle = New-WatchdogLifecycleDependencies
        $CommandHandlers = @{
            install = {
                Install-Watchdog -Dependencies $lifecycle
                Write-Host 'DevSpace Watchdog 已安裝。' -ForegroundColor Green
            }.GetNewClosure()
            run = {
                $result = Invoke-WatchdogRun -Dependencies (New-WatchdogDependencies)
                Write-Host "Watchdog 狀態：$($result.Status)"
                if ($result.ErrorCategory) {
                    Write-Host "錯誤分類：$($result.ErrorCategory)"
                }
                return $result
            }
            status = {
                $status = Get-WatchdogStatus -Dependencies $lifecycle
                Write-Host "排程：$($status.TaskName) [$($status.TaskState)]"
                Write-Host "最近狀態：$($status.Status)"
                Write-Host "最近檢查：$($status.LastCheckAtUtc)"
                Write-Host "錯誤分類：$($status.LastErrorCategory)"
                Write-Host "公開 origin：$($status.PublicBaseUrl)"
                return $status
            }.GetNewClosure()
            remove = {
                $removed = Remove-WatchdogInstallation `
                    -Paths $lifecycle.Paths `
                    -Confirm {
                        return (Read-Host '輸入 REMOVE 確認移除 Watchdog 排程與本機設定') -ceq 'REMOVE'
                    } `
                    -UnregisterTask $lifecycle.UnregisterTask `
                    -RemoveDirectory $lifecycle.RemoveDirectory
                if ($removed) {
                    Write-Host 'DevSpace Watchdog 已移除。' -ForegroundColor Green
                }
                else {
                    Write-Host '已取消移除。'
                }
            }.GetNewClosure()
            'notify-connector-failure' = {
                return Invoke-WatchdogConnectorFailure -Dependencies $lifecycle
            }.GetNewClosure()
            'test-telegram' = {
                return Invoke-WatchdogTestTelegram -Dependencies $lifecycle
            }.GetNewClosure()
        }
    }

    if (-not $CommandHandlers.ContainsKey($Action)) {
        throw "Unsupported Watchdog action: $Action"
    }
    return & $CommandHandlers[$Action]
}

if ($MyInvocation.InvocationName -ne '.') {
    Invoke-WatchdogMain -Action $Action
}
