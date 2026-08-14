Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Test-PathEquals {
    param(
        [Parameter(Mandatory = $true)][string]$Left,
        [Parameter(Mandatory = $true)][string]$Right
    )

    return [string]::Equals(
        $Left.TrimEnd('\', '/'),
        $Right.TrimEnd('\', '/'),
        [System.StringComparison]::OrdinalIgnoreCase
    )
}

function Assert-NarrowAllowedRoot {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [string]$UserProfile = $env:USERPROFILE
    )

    if ([string]::IsNullOrWhiteSpace($Root)) {
        throw 'Allowed root cannot be empty.'
    }

    $resolvedItem = Get-Item -LiteralPath (Resolve-Path -LiteralPath $Root -ErrorAction Stop).Path -ErrorAction Stop
    if (-not $resolvedItem.PSIsContainer) {
        throw "Allowed root is not a directory: $($resolvedItem.FullName)"
    }

    $resolved = [System.IO.Path]::GetFullPath($resolvedItem.FullName).TrimEnd('\', '/')
    $driveRoot = [System.IO.Path]::GetPathRoot($resolved).TrimEnd('\', '/')
    $normalizedProfile = [System.IO.Path]::GetFullPath($UserProfile).TrimEnd('\', '/')
    $broadRoots = @(
        $driveRoot,
        $normalizedProfile,
        (Join-Path $normalizedProfile 'Desktop'),
        (Join-Path $normalizedProfile 'Downloads')
    )

    foreach ($broadRoot in $broadRoots) {
        if (Test-PathEquals -Left $resolved -Right $broadRoot) {
            throw "Refusing broad allowed root: $resolved"
        }
    }

    return $resolved
}

function Merge-AllowedRoots {
    [CmdletBinding()]
    param(
        [AllowEmptyCollection()][string[]]$ExistingRoots = @(),
        [AllowEmptyCollection()][string[]]$NewRoots = @(),
        [string]$UserProfile = $env:USERPROFILE
    )

    $seen = [System.Collections.Generic.HashSet[string]]::new(
        [System.StringComparer]::OrdinalIgnoreCase
    )
    $result = [System.Collections.Generic.List[string]]::new()

    foreach ($root in @($ExistingRoots) + @($NewRoots)) {
        if ([string]::IsNullOrWhiteSpace([string]$root)) {
            continue
        }

        $resolved = Assert-NarrowAllowedRoot -Root ([string]$root) -UserProfile $UserProfile
        if ($seen.Add($resolved)) {
            $result.Add($resolved)
        }
    }

    return [string[]]$result.ToArray()
}

function Select-DevSpacePort {
    [CmdletBinding()]
    param(
        [AllowEmptyCollection()][int[]]$UsedAccountPorts = @(),
        [int]$StartPort = 7676,
        [int]$EndPort = 7775,
        [Parameter(Mandatory = $true)][scriptblock]$IsPortAvailable
    )

    if ($StartPort -lt 1 -or $EndPort -gt 65535 -or $StartPort -gt $EndPort) {
        throw 'Invalid port selection range.'
    }

    $used = [System.Collections.Generic.HashSet[int]]::new()
    foreach ($port in @($UsedAccountPorts)) {
        [void]$used.Add([int]$port)
    }

    for ($candidate = $StartPort; $candidate -le $EndPort; $candidate++) {
        if ($used.Contains($candidate)) {
            continue
        }
        if ([bool](& $IsPortAvailable $candidate)) {
            return $candidate
        }
    }

    throw "No unused DevSpace port is available from $StartPort through $EndPort."
}

function Assert-PublicOrigin {
    param([Parameter(Mandatory = $true)][string]$PublicBaseUrl)

    $uri = $null
    if (-not [Uri]::TryCreate($PublicBaseUrl, [UriKind]::Absolute, [ref]$uri)) {
        throw 'publicBaseUrl must be an absolute URL.'
    }
    if ($uri.Scheme -ne 'https') {
        throw 'publicBaseUrl must use HTTPS.'
    }
    if ($uri.AbsolutePath -ne '/' -or $uri.Query -or $uri.Fragment) {
        throw 'publicBaseUrl must be an origin without /mcp, query, or fragment.'
    }

    return $uri.AbsoluteUri.TrimEnd('/')
}

function Merge-DevSpaceConfig {
    [CmdletBinding()]
    param(
        $ExistingConfig,
        [Parameter(Mandatory = $true)][string[]]$AllowedRoots,
        [Parameter(Mandatory = $true)][ValidateRange(1, 65535)][int]$Port,
        [Parameter(Mandatory = $true)][string]$PublicBaseUrl
    )

    $result = [ordered]@{}
    if ($null -ne $ExistingConfig) {
        foreach ($property in $ExistingConfig.PSObject.Properties) {
            $result[$property.Name] = $property.Value
        }
    }

    $result['host'] = '127.0.0.1'
    $result['port'] = $Port
    $result['allowedRoots'] = [string[]]@($AllowedRoots)
    $result['publicBaseUrl'] = Assert-PublicOrigin -PublicBaseUrl $PublicBaseUrl

    return [pscustomobject]$result
}

function Get-TunnelObject {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)]$TunnelDocument)

    if ($TunnelDocument.PSObject.Properties['tunnel']) {
        return $TunnelDocument.tunnel
    }
    return $TunnelDocument
}

function Get-TunnelPublicBaseUrl {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$TunnelDocument,
        [Parameter(Mandatory = $true)][ValidateRange(1, 65535)][int]$Port
    )

    $tunnel = Get-TunnelObject -TunnelDocument $TunnelDocument
    $matchingPort = @($tunnel.ports) |
        Where-Object { [int]$_.portNumber -eq $Port } |
        Select-Object -First 1
    if (-not $matchingPort) {
        throw "Tunnel does not expose port $Port."
    }

    $portUri = ''
    if ($matchingPort.PSObject.Properties['portForwardingUris']) {
        $portUri = [string](@($matchingPort.portForwardingUris) |
            Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
            Select-Object -First 1)
    }
    if ([string]::IsNullOrWhiteSpace($portUri) -and $matchingPort.PSObject.Properties['portUri']) {
        $portUri = [string]$matchingPort.portUri
    }
    if (-not [string]::IsNullOrWhiteSpace($portUri)) {
        return Assert-PublicOrigin -PublicBaseUrl $portUri.TrimEnd('/')
    }

    $tunnelIdProperty = $tunnel.PSObject.Properties['tunnelId']
    $tunnelId = if ($tunnelIdProperty) { [string]$tunnelIdProperty.Value } else { '' }
    if ($tunnelId -notmatch '^(.+)\.([a-z0-9]+)$') {
        throw "Tunnel $tunnelId does not provide a port URI and its region cannot be derived."
    }

    $publicBaseUrl = "https://$($Matches[1])-$Port.$($Matches[2]).devtunnels.ms"
    return Assert-PublicOrigin -PublicBaseUrl $publicBaseUrl
}

function ConvertTo-DevTunnelLabelArguments {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string[]]$Labels)

    $arguments = @()
    foreach ($label in $Labels) {
        if ([string]::IsNullOrWhiteSpace($label) -or $label -notmatch '^[\w-=]{1,50}$') {
            throw "Invalid Dev Tunnel label: $label"
        }
        $arguments += '--labels'
        $arguments += $label
    }
    return [string[]]$arguments
}

function Get-OneClickRecordValue {
    param(
        [Parameter(Mandatory = $true)]$Record,
        [Parameter(Mandatory = $true)][string]$PropertyName,
        [Parameter(Mandatory = $true)][string]$Label
    )

    $property = $Record.PSObject.Properties[$PropertyName]
    if ($null -eq $property -or $null -eq $property.Value) {
        throw "$Label is missing $PropertyName."
    }
    return $property.Value
}

function ConvertTo-OneClickUtcTimestamp {
    param(
        [Parameter(Mandatory = $true)]$Value,
        [Parameter(Mandatory = $true)][string]$Label
    )

    try {
        $timestamp = if ($Value -is [datetime]) {
            [datetime]$Value
        }
        else {
            [datetime]::Parse(
                [string]$Value,
                [System.Globalization.CultureInfo]::InvariantCulture,
                [System.Globalization.DateTimeStyles]::RoundtripKind
            )
        }
        return $timestamp.ToUniversalTime().ToString('o')
    }
    catch {
        throw "$Label has an invalid start timestamp."
    }
}

function Get-DevSpaceServeProcessIdentity {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$ProcessRecord,
        [Parameter(Mandatory = $true)][ValidateRange(1, 65535)][int]$Port
    )

    $name = [string](Get-OneClickRecordValue -Record $ProcessRecord -PropertyName 'Name' -Label 'DevSpace process')
    $commandLine = [string](Get-OneClickRecordValue -Record $ProcessRecord -PropertyName 'CommandLine' -Label 'DevSpace process')
    $processId = [int](Get-OneClickRecordValue -Record $ProcessRecord -PropertyName 'ProcessId' -Label 'DevSpace process')
    $parentProcessId = [int](Get-OneClickRecordValue -Record $ProcessRecord -PropertyName 'ParentProcessId' -Label 'DevSpace process')
    $startedAtUtc = ConvertTo-OneClickUtcTimestamp -Value (Get-OneClickRecordValue -Record $ProcessRecord -PropertyName 'StartedAtUtc' -Label 'DevSpace process') -Label 'DevSpace process'

    if ($name -notmatch '^(?i:node(?:\.exe)?)$') {
        throw "Refusing to adopt non-Node listener PID $processId."
    }
    if ($commandLine -notmatch '(?i)@waishnav[\\/]devspace[\\/]dist[\\/]cli\.js"?\s+serve(?:\s|$)') {
        throw "Refusing to adopt PID $processId because it is not the DevSpace serve CLI."
    }
    if ($processId -le 0 -or $parentProcessId -le 0) {
        throw 'DevSpace process identity is incomplete.'
    }

    return [pscustomobject]@{
        ProcessId = $processId
        ParentProcessId = $parentProcessId
        StartedAtUtc = $startedAtUtc
        Port = $Port
    }
}

function Get-DevTunnelHostProcessIdentity {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)]$ProcessRecord)

    $name = [string](Get-OneClickRecordValue -Record $ProcessRecord -PropertyName 'Name' -Label 'Dev Tunnel process')
    $commandLine = [string](Get-OneClickRecordValue -Record $ProcessRecord -PropertyName 'CommandLine' -Label 'Dev Tunnel process')
    $processId = [int](Get-OneClickRecordValue -Record $ProcessRecord -PropertyName 'ProcessId' -Label 'Dev Tunnel process')
    $parentProcessId = [int](Get-OneClickRecordValue -Record $ProcessRecord -PropertyName 'ParentProcessId' -Label 'Dev Tunnel process')
    $startedAtUtc = ConvertTo-OneClickUtcTimestamp -Value (Get-OneClickRecordValue -Record $ProcessRecord -PropertyName 'StartedAtUtc' -Label 'Dev Tunnel process') -Label 'Dev Tunnel process'

    if ($name -notmatch '^(?i:devtunnel(?:\.exe)?)$') {
        throw "Refusing to adopt non-Dev-Tunnel PID $processId."
    }
    $match = [regex]::Match(
        $commandLine,
        '(?i)(?:^|\s)host\s+(?:"(?<quoted>[A-Za-z0-9._-]+)"|(?<plain>[A-Za-z0-9._-]+))(?:\s|$)'
    )
    if (-not $match.Success) {
        throw "Refusing to adopt PID $processId because it is not a Dev Tunnel host process."
    }
    $tunnelId = if ($match.Groups['quoted'].Success) {
        $match.Groups['quoted'].Value
    }
    else {
        $match.Groups['plain'].Value
    }
    if ($processId -le 0 -or $parentProcessId -le 0 -or [string]::IsNullOrWhiteSpace($tunnelId)) {
        throw 'Dev Tunnel process identity is incomplete.'
    }

    return [pscustomobject]@{
        ProcessId = $processId
        ParentProcessId = $parentProcessId
        StartedAtUtc = $startedAtUtc
        TunnelId = $tunnelId
    }
}

function New-DevSpaceOneClickAdoptionState {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$Config,
        [Parameter(Mandatory = $true)]$DevSpaceProcess,
        [Parameter(Mandatory = $true)]$DevTunnelProcess,
        [Parameter(Mandatory = $true)][string]$MachineName,
        [datetime]$Now = (Get-Date)
    )

    $hostValue = [string](Get-OneClickRecordValue -Record $Config -PropertyName 'host' -Label 'DevSpace config')
    if ($hostValue -ne '127.0.0.1') {
        throw 'Refusing state repair because DevSpace is not bound to 127.0.0.1.'
    }
    $port = [int](Get-OneClickRecordValue -Record $Config -PropertyName 'port' -Label 'DevSpace config')
    if ($port -lt 1 -or $port -gt 65535) {
        throw 'Refusing state repair because the DevSpace port is invalid.'
    }
    $publicBaseUrl = Assert-PublicOrigin -PublicBaseUrl ([string](Get-OneClickRecordValue -Record $Config -PropertyName 'publicBaseUrl' -Label 'DevSpace config'))
    if ([string]::IsNullOrWhiteSpace($MachineName)) {
        throw 'Machine name is required for one-click state repair.'
    }

    $devSpaceIdentity = Get-DevSpaceServeProcessIdentity -ProcessRecord $DevSpaceProcess -Port $port
    $devTunnelIdentity = Get-DevTunnelHostProcessIdentity -ProcessRecord $DevTunnelProcess
    if ($devSpaceIdentity.ParentProcessId -ne $devTunnelIdentity.ParentProcessId) {
        throw 'Refusing state repair because DevSpace and Dev Tunnel do not share the same launcher parent.'
    }

    if ($devTunnelIdentity.TunnelId -notmatch '\.([a-z0-9]+)$') {
        throw 'Refusing state repair because the hosted tunnel region cannot be derived.'
    }
    $region = $Matches[1]
    $publicUri = [Uri]$publicBaseUrl
    if (-not $publicUri.Host.EndsWith(".$region.devtunnels.ms", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Refusing state repair because the public origin region differs from the hosted tunnel.'
    }

    $adoptedAtUtc = $Now.ToUniversalTime().ToString('o')
    $stackStartedAtUtc = @(
        [datetime]::Parse($devSpaceIdentity.StartedAtUtc),
        [datetime]::Parse($devTunnelIdentity.StartedAtUtc)
    ) | Sort-Object | Select-Object -First 1

    $settings = [pscustomobject]([ordered]@{
        schemaVersion = 1
        machineName = $MachineName
        tunnelId = $devTunnelIdentity.TunnelId
        port = $port
        publicBaseUrl = $publicBaseUrl
        createdAtUtc = $stackStartedAtUtc.ToUniversalTime().ToString('o')
        repairedAtUtc = $adoptedAtUtc
    })
    $runtime = [pscustomobject]([ordered]@{
        schemaVersion = 1
        startedAtUtc = $stackStartedAtUtc.ToUniversalTime().ToString('o')
        devSpacePid = $devSpaceIdentity.ProcessId
        devSpaceStartedAtUtc = $devSpaceIdentity.StartedAtUtc
        devSpacePort = $port
        devSpaceLog = ''
        devTunnelPid = $devTunnelIdentity.ProcessId
        devTunnelStartedAtUtc = $devTunnelIdentity.StartedAtUtc
        devTunnelId = $devTunnelIdentity.TunnelId
        devTunnelLog = ''
        publicBaseUrl = $publicBaseUrl
        adoptedAtUtc = $adoptedAtUtc
    })

    return [pscustomobject]@{
        Settings = $settings
        Runtime = $runtime
    }
}

function New-DevSpaceTunnelName {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$ComputerName,
        [Parameter(Mandatory = $true)][string]$Suffix
    )

    $machine = $ComputerName.ToLowerInvariant() -replace '[^a-z0-9]+', '-'
    $machine = $machine.Trim('-')
    if ([string]::IsNullOrWhiteSpace($machine)) {
        $machine = 'windows'
    }
    if ($machine.Length -gt 24) {
        $machine = $machine.Substring(0, 24).TrimEnd('-')
    }

    $safeSuffix = ($Suffix.ToLowerInvariant() -replace '[^a-z0-9]+', '').Trim()
    if ($safeSuffix.Length -lt 8) {
        throw 'Tunnel suffix must contain at least 8 letters or digits.'
    }
    $safeSuffix = $safeSuffix.Substring(0, 8)

    return "devspace-$machine-$safeSuffix"
}

Export-ModuleMember -Function @(
    'Assert-NarrowAllowedRoot',
    'Merge-AllowedRoots',
    'Select-DevSpacePort',
    'Merge-DevSpaceConfig',
    'Get-TunnelObject',
    'Get-TunnelPublicBaseUrl',
    'ConvertTo-DevTunnelLabelArguments',
    'Get-DevSpaceServeProcessIdentity',
    'Get-DevTunnelHostProcessIdentity',
    'New-DevSpaceOneClickAdoptionState',
    'New-DevSpaceTunnelName'
)
