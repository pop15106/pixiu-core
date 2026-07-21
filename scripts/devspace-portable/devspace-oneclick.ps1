[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('install', 'start', 'stop', 'status', 'add-root', 'copy-password', 'agent-status', 'agent-stop')]
    [string]$Action = 'status',

    [Parameter(Position = 1)]
    [string]$Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'DevSpace.OneClick.Core.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'DevSpace.OneClick.Platform.psm1') -Force -DisableNameChecking
Import-Module (Join-Path $PSScriptRoot 'DevSpace.OneClick.Subagents.psm1') -Force

$DevSpacePackage = '@waishnav/devspace@1.0.4'
$ConfigRoot = if ($env:DEVSPACE_ONECLICK_CONFIG_DIR) {
    $env:DEVSPACE_ONECLICK_CONFIG_DIR
}
else {
    Join-Path $env:USERPROFILE '.devspace'
}
$StateRoot = if ($env:DEVSPACE_ONECLICK_STATE_DIR) {
    $env:DEVSPACE_ONECLICK_STATE_DIR
}
elseif ($env:LOCALAPPDATA) {
    Join-Path $env:LOCALAPPDATA 'DevSpaceOneClick'
}
else {
    Join-Path $env:USERPROFILE '.devspace-oneclick'
}
$ConfigPath = Join-Path $ConfigRoot 'config.json'
$AuthPath = Join-Path $ConfigRoot 'auth.json'
$SettingsPath = Join-Path $StateRoot 'settings.json'
$RuntimePath = Join-Path $StateRoot 'runtime.json'
$LogRoot = Join-Path $StateRoot 'logs'
$ShimRoot = Join-Path $StateRoot 'bin'
$AgentAdminScript = Join-Path $PSScriptRoot 'DevSpace.AgentAdmin.mjs'
$AgentProfilesSource = Join-Path $PSScriptRoot 'agents'

function Write-Info {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[DevSpace] $Message"
}

function Ensure-Directory {
    param([Parameter(Mandatory = $true)][string]$Directory)
    if (-not (Test-Path -LiteralPath $Directory)) {
        New-Item -ItemType Directory -Path $Directory -Force | Out-Null
    }
}

function Read-JsonFile {
    param([Parameter(Mandatory = $true)][string]$FilePath)
    if (-not (Test-Path -LiteralPath $FilePath)) {
        return $null
    }
    return Get-Content -LiteralPath $FilePath -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)]$Value
    )

    Ensure-Directory -Directory (Split-Path -Parent $FilePath)
    $temporaryPath = "$FilePath.$([guid]::NewGuid().ToString('N')).tmp"
    $json = $Value | ConvertTo-Json -Depth 12
    [System.IO.File]::WriteAllText(
        $temporaryPath,
        $json,
        [System.Text.UTF8Encoding]::new($false)
    )
    Move-Item -LiteralPath $temporaryPath -Destination $FilePath -Force
}

function Backup-File {
    param([Parameter(Mandatory = $true)][string]$FilePath)
    if (Test-Path -LiteralPath $FilePath) {
        $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        Copy-Item -LiteralPath $FilePath -Destination "$FilePath.$stamp.bak" -Force
    }
}

function Get-SafeMachineLabel {
    $label = $env:COMPUTERNAME.ToLowerInvariant() -replace '[^a-z0-9]+', '-'
    $label = $label.Trim('-')
    if ([string]::IsNullOrWhiteSpace($label)) {
        return 'windows'
    }
    if ($label.Length -gt 24) {
        return $label.Substring(0, 24).TrimEnd('-')
    }
    return $label
}

function New-TunnelSettings {
    param([Parameter(Mandatory = $true)][string]$DevTunnel)

    $usedPorts = Get-AccountDevSpacePorts -DevTunnel $DevTunnel
    $port = Select-DevSpacePort -UsedAccountPorts $usedPorts -StartPort 7676 -EndPort 7775 -IsPortAvailable {
        param($CandidatePort)
        Test-LocalPortAvailable -Port $CandidatePort
    }

    $suffix = [guid]::NewGuid().ToString('N').Substring(0, 8)
    $requestedId = New-DevSpaceTunnelName -ComputerName $env:COMPUTERNAME -Suffix $suffix
    $machineLabel = Get-SafeMachineLabel
    Write-Info "Creating a dedicated persistent tunnel for $env:COMPUTERNAME on port $port..."

    $createArguments = @(
        'create', $requestedId,
        '--allow-anonymous',
        '--expiration', '30d',
        '--description', "DevSpace OneClick on $env:COMPUTERNAME port $port"
    )
    $createArguments += @(ConvertTo-DevTunnelLabelArguments -Labels @(
        'devspace',
        'oneclick',
        "machine-$machineLabel"
    ))
    $createArguments += '-j'

    $created = ConvertFrom-NativeJson -Executable $DevTunnel -Arguments $createArguments -Operation 'Dev Tunnel create'

    $tunnelId = [string]$created.tunnel.tunnelId
    if ([string]::IsNullOrWhiteSpace($tunnelId)) {
        throw 'Dev Tunnel create returned no tunnel ID.'
    }

    [void](ConvertFrom-NativeJson -Executable $DevTunnel -Arguments @(
        'port', 'create', $tunnelId,
        '--port-number', [string]$port,
        '--protocol', 'http',
        '--description', 'DevSpace MCP',
        '-j'
    ) -Operation 'Dev Tunnel port create')

    $shown = ConvertFrom-NativeJson -Executable $DevTunnel -Arguments @('show', $tunnelId, '-j') -Operation 'Dev Tunnel show'
    $publicBaseUrl = Get-TunnelPublicBaseUrl -TunnelDocument $shown -Port $port

    $settings = [ordered]@{
        schemaVersion = 1
        machineName = $env:COMPUTERNAME
        tunnelId = $tunnelId
        port = $port
        publicBaseUrl = $publicBaseUrl
        createdAtUtc = [DateTime]::UtcNow.ToString('o')
    }
    Write-JsonFile -FilePath $SettingsPath -Value $settings
    return [pscustomobject]$settings
}

function Get-TunnelSettings {
    param(
        [Parameter(Mandatory = $true)][string]$DevTunnel,
        [switch]$Create
    )

    $settings = Read-JsonFile -FilePath $SettingsPath
    if (-not $settings) {
        if ($Create) {
            return New-TunnelSettings -DevTunnel $DevTunnel
        }
        throw "One-click settings are missing. Run 01-INSTALL-AND-START.cmd first."
    }

    if (-not [string]::Equals([string]$settings.machineName, $env:COMPUTERNAME, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'These one-click settings belong to another computer. Run the installer on this computer.'
    }

    $shown = ConvertFrom-NativeJson -Executable $DevTunnel -Arguments @('show', [string]$settings.tunnelId, '-j') -Operation 'Persistent tunnel lookup'
    $portEntry = @($shown.tunnel.ports) | Where-Object { [int]$_.portNumber -eq [int]$settings.port } | Select-Object -First 1
    if (-not $portEntry) {
        [void](ConvertFrom-NativeJson -Executable $DevTunnel -Arguments @(
            'port', 'create', [string]$settings.tunnelId,
            '--port-number', [string]$settings.port,
            '--protocol', 'http',
            '--description', 'DevSpace MCP',
            '-j'
        ) -Operation 'Persistent tunnel port repair')
        $shown = ConvertFrom-NativeJson -Executable $DevTunnel -Arguments @('show', [string]$settings.tunnelId, '-j') -Operation 'Persistent tunnel refresh'
    }

    $publicBaseUrl = Get-TunnelPublicBaseUrl -TunnelDocument $shown -Port ([int]$settings.port)
    if ([string]$settings.publicBaseUrl -ne $publicBaseUrl) {
        $settings.publicBaseUrl = $publicBaseUrl
        Write-JsonFile -FilePath $SettingsPath -Value $settings
    }

    return $settings
}

function Split-RootInput {
    param([string]$InputText)
    if ([string]::IsNullOrWhiteSpace($InputText)) {
        return @()
    }

    return [string[]]@($InputText -split ';' | ForEach-Object {
        $_.Trim().Trim('"')
    } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Get-InstallRoots {
    $existingConfig = Read-JsonFile -FilePath $ConfigPath
    $existingRoots = if ($existingConfig) { [string[]]@($existingConfig.allowedRoots) } else { @() }
    $newRoots = @(Split-RootInput -InputText $Path)

    if ($newRoots.Count -eq 0) {
        Write-Host ''
        Write-Host 'Enter only project folders that ChatGPT may access.'
        Write-Host 'Use semicolons between multiple folders. Do not enter a drive, user home, Desktop, or Downloads.'
        $inputText = Read-Host 'Project folder(s)'
        $newRoots = @(Split-RootInput -InputText $inputText)
    }

    $roots = @(Merge-AllowedRoots -ExistingRoots $existingRoots -NewRoots $newRoots -UserProfile $env:USERPROFILE)
    if ($roots.Count -eq 0) {
        throw 'At least one specific project folder is required.'
    }
    return [string[]]$roots
}

function Save-DevSpaceConfig {
    param(
        [Parameter(Mandatory = $true)][string[]]$Roots,
        [Parameter(Mandatory = $true)]$Settings
    )

    $existingConfig = Read-JsonFile -FilePath $ConfigPath
    $config = Merge-DevSpaceConfig -ExistingConfig $existingConfig -AllowedRoots $Roots -Port ([int]$Settings.port) -PublicBaseUrl ([string]$Settings.publicBaseUrl)
    Backup-File -FilePath $ConfigPath
    Write-JsonFile -FilePath $ConfigPath -Value $config
}

function New-OwnerToken {
    $bytes = [byte[]]::new(32)
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Ensure-OwnerToken {
    $auth = Read-JsonFile -FilePath $AuthPath
    if ($auth -and ([string]$auth.ownerToken).Length -ge 16) {
        return [string]$auth.ownerToken
    }

    $token = New-OwnerToken
    Backup-File -FilePath $AuthPath
    Write-JsonFile -FilePath $AuthPath -Value ([ordered]@{ ownerToken = $token })
    return $token
}

function Get-ValidatedSpec {
    $settings = Read-JsonFile -FilePath $SettingsPath
    $config = Read-JsonFile -FilePath $ConfigPath
    $auth = Read-JsonFile -FilePath $AuthPath
    if (-not $settings -or -not $config -or -not $auth) {
        throw 'DevSpace one-click setup is incomplete. Run 01-INSTALL-AND-START.cmd.'
    }
    if ([string]$config.host -ne '127.0.0.1') {
        throw 'DevSpace must remain bound to 127.0.0.1.'
    }
    if ([int]$config.port -ne [int]$settings.port) {
        throw 'DevSpace config port does not match the one-click tunnel port.'
    }
    if ([string]$config.publicBaseUrl -ne [string]$settings.publicBaseUrl) {
        throw 'DevSpace publicBaseUrl does not match the persistent tunnel URL.'
    }
    if (([string]$auth.ownerToken).Length -lt 16) {
        throw 'Owner password is missing or too short.'
    }

    $roots = @(Merge-AllowedRoots -ExistingRoots ([string[]]@($config.allowedRoots)) -NewRoots @() -UserProfile $env:USERPROFILE)
    if ($roots.Count -eq 0) {
        throw 'At least one narrow allowed root is required.'
    }

    return [pscustomobject]@{
        Settings = $settings
        Config = $config
        OwnerToken = [string]$auth.ownerToken
        Roots = [string[]]$roots
        Port = [int]$settings.port
        PublicBaseUrl = [string]$settings.publicBaseUrl
        TunnelId = [string]$settings.tunnelId
    }
}

function Test-LocalHealth {
    param([Parameter(Mandatory = $true)][int]$Port)
    try {
        $response = Invoke-RestMethod -UseBasicParsing -Uri "http://127.0.0.1:$Port/healthz" -TimeoutSec 3
        return ($response.ok -eq $true)
    }
    catch {
        return $false
    }
}

function Wait-Health {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutSeconds = 60
    )

    for ($attempt = 0; $attempt -lt $TimeoutSeconds; $attempt++) {
        try {
            $response = Invoke-RestMethod -UseBasicParsing -Uri $Url -TimeoutSec 3
            if ($response.ok -eq $true) {
                return
            }
        }
        catch {
        }
        Start-Sleep -Seconds 1
    }
    throw "Service did not become healthy within $TimeoutSeconds seconds: $Url"
}

function Get-ListenerProcessId {
    param([Parameter(Mandatory = $true)][int]$Port)
    $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$"
    $line = @(& netstat.exe -ano -p TCP | Where-Object { $_ -match $pattern } | Select-Object -First 1)
    if ($line -and $line[0] -match $pattern) {
        return [int]$Matches[1]
    }
    return $null
}

function Test-ProcessOwnsPort {
    param(
        [Parameter(Mandatory = $true)][int]$ProcessId,
        [Parameter(Mandatory = $true)][int]$Port
    )
    $pattern = "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+$ProcessId\s*$"
    return @(& netstat.exe -ano -p TCP | Where-Object { $_ -match $pattern }).Count -gt 0
}

function Test-RecordedProcess {
    param(
        [Parameter(Mandatory = $true)][int]$ProcessId,
        [Parameter(Mandatory = $true)][string]$StartedAtUtc,
        [Parameter(Mandatory = $true)][string]$ProcessName,
        [int]$Port = 0
    )

    try {
        $process = Get-Process -Id $ProcessId -ErrorAction Stop
        if ($process.ProcessName -notmatch ("^" + [regex]::Escape($ProcessName) + "(\.exe)?$")) {
            return $false
        }
        $recorded = [DateTime]::Parse($StartedAtUtc).ToUniversalTime()
        if ([Math]::Abs(($process.StartTime.ToUniversalTime() - $recorded).TotalSeconds) -gt 5) {
            return $false
        }
        return ($Port -eq 0 -or (Test-ProcessOwnsPort -ProcessId $ProcessId -Port $Port))
    }
    catch {
        return $false
    }
}

function Show-Status {
    $spec = Get-ValidatedSpec
    $runtime = Read-JsonFile -FilePath $RuntimePath
    $health = Test-LocalHealth -Port $spec.Port

    Write-Info "local health: $(if ($health) { 'ready' } else { 'down' })"
    Write-Info "local MCP: http://127.0.0.1:$($spec.Port)/mcp"
    Write-Info "public MCP: $($spec.PublicBaseUrl)/mcp"
    Write-Info "tunnel ID: $($spec.TunnelId)"
    Write-Info "machine: $env:COMPUTERNAME"
    Write-Info 'allowed roots:'
    foreach ($root in $spec.Roots) {
        Write-Host "  - $root"
    }

    if ($runtime) {
        $devSpaceOwned = Test-RecordedProcess -ProcessId ([int]$runtime.devSpacePid) -StartedAtUtc ([string]$runtime.devSpaceStartedAtUtc) -ProcessName 'node' -Port $spec.Port
        $tunnelOwned = Test-RecordedProcess -ProcessId ([int]$runtime.devTunnelPid) -StartedAtUtc ([string]$runtime.devTunnelStartedAtUtc) -ProcessName 'devtunnel'
        Write-Info "DevSpace PID $($runtime.devSpacePid): $(if ($devSpaceOwned) { 'verified' } else { 'stale' })"
        Write-Info "Dev Tunnel PID $($runtime.devTunnelPid): $(if ($tunnelOwned) { 'verified' } else { 'stale' })"
    }
}

function Set-DevSpaceEnvironment {
    param(
        [Parameter(Mandatory = $true)]$Spec,
        [Parameter(Mandatory = $true)][string]$BashPath,
        [Parameter(Mandatory = $true)][string]$NodePath,
        [Parameter(Mandatory = $true)][string]$ShimDirectory
    )

    $bashDirectory = Split-Path -Parent $BashPath
    $nodeDirectory = Split-Path -Parent $NodePath
    foreach ($directory in @($nodeDirectory, $bashDirectory, $ShimDirectory)) {
        if (($env:Path -split ';') -notcontains $directory) {
            $env:Path = "$directory;$env:Path"
        }
    }

    [Environment]::SetEnvironmentVariable('DEVSPACE_CONFIG_DIR', $ConfigRoot, 'Process')
    [Environment]::SetEnvironmentVariable('HOST', '127.0.0.1', 'Process')
    [Environment]::SetEnvironmentVariable('PORT', [string]$Spec.Port, 'Process')
    [Environment]::SetEnvironmentVariable('DEVSPACE_ALLOWED_ROOTS', ($Spec.Roots -join ','), 'Process')
    [Environment]::SetEnvironmentVariable('DEVSPACE_PUBLIC_BASE_URL', $Spec.PublicBaseUrl, 'Process')
    [Environment]::SetEnvironmentVariable('DEVSPACE_TOOL_MODE', 'full', 'Process')
    [Environment]::SetEnvironmentVariable('DEVSPACE_WIDGETS', 'off', 'Process')
    [Environment]::SetEnvironmentVariable('DEVSPACE_SUBAGENTS', '1', 'Process')
    [Environment]::SetEnvironmentVariable('DEVSPACE_AGENT_DIR', (Join-Path $ConfigRoot 'agents'), 'Process')
    [Environment]::SetEnvironmentVariable('DEVSPACE_OAUTH_AUTO_APPROVE_CHATGPT', '1', 'Process')
}

function Start-Stack {
    Ensure-Directory -Directory $StateRoot
    Ensure-Directory -Directory $LogRoot
    $spec = Get-ValidatedSpec
    $tools = Get-InstalledTools
    $runtime = Read-JsonFile -FilePath $RuntimePath
    $patchCount = Install-DevSpaceSubagentWindowsPatch -DevSpaceCli $tools.DevSpaceCli
    [void](Install-DevSpaceAgentProfiles -ConfigRoot $ConfigRoot -SourceDirectory $AgentProfilesSource)
    [void](Install-DevSpaceAgentCliShim -NodePath $tools.Node -DevSpaceCli $tools.DevSpaceCli -AdminScript $AgentAdminScript -BinDirectory $ShimRoot)
    if ($patchCount -gt 0) {
        Write-Info "Applied $patchCount DevSpace 1.0.4 Windows subagent compatibility fixes."
    }

    if (Test-LocalHealth -Port $spec.Port) {
        if ($runtime) {
            $devSpaceOwned = Test-RecordedProcess -ProcessId ([int]$runtime.devSpacePid) -StartedAtUtc ([string]$runtime.devSpaceStartedAtUtc) -ProcessName 'node' -Port $spec.Port
            $tunnelOwned = Test-RecordedProcess -ProcessId ([int]$runtime.devTunnelPid) -StartedAtUtc ([string]$runtime.devTunnelStartedAtUtc) -ProcessName 'devtunnel'
            if ($devSpaceOwned -and $tunnelOwned) {
                Write-Info 'DevSpace is already running.'
                Show-Status
                return
            }
        }
        throw "Port $($spec.Port) is already serving DevSpace outside this launcher."
    }

    $listener = Get-ListenerProcessId -Port $spec.Port
    if ($listener) {
        throw "Port $($spec.Port) is occupied by PID $listener."
    }
    if (Test-Path -LiteralPath $RuntimePath) {
        Remove-Item -LiteralPath $RuntimePath -Force
    }

    Ensure-DevTunnelLogin -DevTunnel $tools.DevTunnel
    [void](Get-TunnelSettings -DevTunnel $tools.DevTunnel)
    Set-DevSpaceEnvironment -Spec $spec -BashPath $tools.Bash -NodePath $tools.Node -ShimDirectory $ShimRoot

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $devSpaceOut = Join-Path $LogRoot "devspace-$stamp.out.log"
    $devSpaceErr = Join-Path $LogRoot "devspace-$stamp.err.log"
    $devTunnelOut = Join-Path $LogRoot "devtunnel-$stamp.out.log"
    $devTunnelErr = Join-Path $LogRoot "devtunnel-$stamp.err.log"
    $devSpaceProcess = $null
    $devTunnelProcess = $null

    try {
        $quotedCli = '"' + $tools.DevSpaceCli + '"'
        $devSpaceProcess = Start-Process -FilePath $tools.Node -ArgumentList @($quotedCli, 'serve') -WorkingDirectory $PSScriptRoot -RedirectStandardOutput $devSpaceOut -RedirectStandardError $devSpaceErr -WindowStyle Hidden -PassThru
        Wait-Health -Url "http://127.0.0.1:$($spec.Port)/healthz" -TimeoutSeconds 60

        $updateOutput = @(& $tools.DevTunnel update $spec.TunnelId --expiration 30d 2>&1)
        if ($LASTEXITCODE -ne 0) {
            throw "Unable to refresh persistent tunnel: $($updateOutput -join [Environment]::NewLine)"
        }

        $devTunnelProcess = Start-Process -FilePath $tools.DevTunnel -ArgumentList @('host', $spec.TunnelId) -WorkingDirectory $PSScriptRoot -RedirectStandardOutput $devTunnelOut -RedirectStandardError $devTunnelErr -WindowStyle Hidden -PassThru
        Start-Sleep -Seconds 3
        if ($devTunnelProcess.HasExited) {
            throw "Dev Tunnel exited during startup. Review $devTunnelErr"
        }
        Wait-Health -Url "$($spec.PublicBaseUrl)/healthz" -TimeoutSeconds 60

        $runtimeState = [ordered]@{
            schemaVersion = 1
            startedAtUtc = [DateTime]::UtcNow.ToString('o')
            devSpacePid = $devSpaceProcess.Id
            devSpaceStartedAtUtc = $devSpaceProcess.StartTime.ToUniversalTime().ToString('o')
            devSpacePort = $spec.Port
            devSpaceLog = $devSpaceOut
            devTunnelPid = $devTunnelProcess.Id
            devTunnelStartedAtUtc = $devTunnelProcess.StartTime.ToUniversalTime().ToString('o')
            devTunnelId = $spec.TunnelId
            devTunnelLog = $devTunnelOut
            publicBaseUrl = $spec.PublicBaseUrl
        }
        Write-JsonFile -FilePath $RuntimePath -Value $runtimeState
        Write-Info 'Backend started. This window may be closed.'
        Show-Status
    }
    catch {
        if ($devTunnelProcess -and -not $devTunnelProcess.HasExited) {
            Stop-Process -Id $devTunnelProcess.Id -ErrorAction SilentlyContinue
        }
        if ($devSpaceProcess -and -not $devSpaceProcess.HasExited) {
            Stop-Process -Id $devSpaceProcess.Id -ErrorAction SilentlyContinue
        }
        throw
    }
}

function Stop-Stack {
    $runtime = Read-JsonFile -FilePath $RuntimePath
    if (-not $runtime) {
        Write-Info 'No one-click runtime is recorded.'
        return
    }

    $tunnelProcess = Get-Process -Id ([int]$runtime.devTunnelPid) -ErrorAction SilentlyContinue
    if ($tunnelProcess) {
        if (-not (Test-RecordedProcess -ProcessId ([int]$runtime.devTunnelPid) -StartedAtUtc ([string]$runtime.devTunnelStartedAtUtc) -ProcessName 'devtunnel')) {
            throw 'Refusing to stop: recorded Dev Tunnel process identity does not match.'
        }
        Stop-Process -Id ([int]$runtime.devTunnelPid) -ErrorAction Stop
        Write-Info "Stopped Dev Tunnel PID $($runtime.devTunnelPid)."
    }

    $devSpaceProcess = Get-Process -Id ([int]$runtime.devSpacePid) -ErrorAction SilentlyContinue
    if ($devSpaceProcess) {
        if (-not (Test-RecordedProcess -ProcessId ([int]$runtime.devSpacePid) -StartedAtUtc ([string]$runtime.devSpaceStartedAtUtc) -ProcessName 'node' -Port ([int]$runtime.devSpacePort))) {
            throw 'Refusing to stop: recorded DevSpace process identity or listener does not match.'
        }
        Stop-Process -Id ([int]$runtime.devSpacePid) -ErrorAction Stop
        Write-Info "Stopped DevSpace PID $($runtime.devSpacePid)."
    }

    Remove-Item -LiteralPath $RuntimePath -Force
    Write-Info 'Backend stopped.'
}

function Add-Root {
    $spec = Get-ValidatedSpec
    $inputPaths = @(Split-RootInput -InputText $Path)
    if ($inputPaths.Count -eq 0) {
        Write-Host 'Enter one or more specific project folders, separated by semicolons.'
        $inputPaths = @(Split-RootInput -InputText (Read-Host 'Project folder(s)'))
    }
    if ($inputPaths.Count -eq 0) {
        throw 'No project folder was entered.'
    }

    $roots = @(Merge-AllowedRoots -ExistingRoots $spec.Roots -NewRoots $inputPaths -UserProfile $env:USERPROFILE)
    if ($roots.Count -eq $spec.Roots.Count) {
        Write-Info 'Every selected folder is already allowed.'
        return
    }

    Save-DevSpaceConfig -Roots $roots -Settings $spec.Settings
    Write-Info 'Allowed roots updated.'

    $runtime = Read-JsonFile -FilePath $RuntimePath
    if ($runtime) {
        Write-Info 'Restarting the backend to apply the new folder...'
        Stop-Stack
        Start-Stack
    }
    else {
        Write-Info 'Run 03-START.cmd to apply the new folder.'
    }
}

function Copy-OwnerPassword {
    $spec = Get-ValidatedSpec
    $setClipboard = Get-Command Set-Clipboard -ErrorAction SilentlyContinue
    if (-not $setClipboard) {
        throw "Set-Clipboard is unavailable. Read the Owner password from $AuthPath."
    }
    Set-Clipboard -Value $spec.OwnerToken
    Write-Info 'Owner password copied to the clipboard.'
}

function Write-AgentRecord {
    param([Parameter(Mandatory = $true)]$Record)

    Write-Host "$($Record.id) $($Record.status) $($Record.profileName) $($Record.provider) $($Record.model) thinking=$($Record.thinking)"
    Write-Host "  workspace: $($Record.workspaceRoot)"
    $response = Get-DevSpaceAgentRecordText -Record $Record -PropertyName 'latestResponse'
    if (-not [string]::IsNullOrWhiteSpace($response)) {
        Write-Host "  response: $response"
    }
    $errorDetail = Get-DevSpaceAgentRecordText -Record $Record -PropertyName 'error'
    if (-not [string]::IsNullOrWhiteSpace($errorDetail)) {
        Write-Host "  error: $errorDetail"
    }
}

function Show-AgentStatus {
    $tools = Get-InstalledTools
    $agentId = if ([string]::IsNullOrWhiteSpace($Path)) { $null } else { $Path.Trim() }
    $records = Get-DevSpaceAgentStatus -NodePath $tools.Node -DevSpaceCli $tools.DevSpaceCli -AdminScript $AgentAdminScript -AgentId $agentId
    if ($null -eq $records -or @($records).Count -eq 0) {
        Write-Info 'No Subagent sessions were found.'
        return
    }
    foreach ($record in @($records)) {
        Write-AgentRecord -Record $record
    }
}

function Stop-Agent {
    $agentId = $Path
    if ([string]::IsNullOrWhiteSpace($agentId)) {
        $agentId = Read-Host 'Agent ID to stop'
    }
    if ([string]::IsNullOrWhiteSpace($agentId)) {
        throw 'No Agent ID was entered.'
    }

    $tools = Get-InstalledTools
    $result = Stop-DevSpaceAgent -NodePath $tools.Node -DevSpaceCli $tools.DevSpaceCli -AdminScript $AgentAdminScript -AgentId $agentId.Trim()
    if (@($result.StoppedProcessIds).Count -gt 0) {
        Write-Info "Stopped Agent process tree: $(@($result.StoppedProcessIds) -join ', ')"
    }
    else {
        Write-Info 'No live process remained; the stale Agent record was closed.'
    }
    Write-AgentRecord -Record $result.Record
}

function Invoke-Doctor {
    param([Parameter(Mandatory = $true)]$Tools)

    [Environment]::SetEnvironmentVariable('DEVSPACE_CONFIG_DIR', $ConfigRoot, 'Process')
    $output = (& $Tools.Node $Tools.DevSpaceCli doctor 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "devspace doctor failed: $output"
    }
    Write-Host $output
}

function Install-OneClick {
    Ensure-Directory -Directory $ConfigRoot
    Ensure-Directory -Directory $StateRoot
    Ensure-Directory -Directory $LogRoot

    $tools = Install-Dependencies -DevSpacePackage $DevSpacePackage
    [void](Install-DevSpaceSubagentWindowsPatch -DevSpaceCli $tools.DevSpaceCli)
    [void](Install-DevSpaceAgentProfiles -ConfigRoot $ConfigRoot -SourceDirectory $AgentProfilesSource)
    [void](Install-DevSpaceAgentCliShim -NodePath $tools.Node -DevSpaceCli $tools.DevSpaceCli -AdminScript $AgentAdminScript -BinDirectory $ShimRoot)
    Ensure-DevTunnelLogin -DevTunnel $tools.DevTunnel
    $roots = Get-InstallRoots
    $settings = Get-TunnelSettings -DevTunnel $tools.DevTunnel -Create
    Save-DevSpaceConfig -Roots $roots -Settings $settings
    $ownerToken = Ensure-OwnerToken

    Invoke-Doctor -Tools $tools
    Start-Stack

    $mcpUrl = "$($settings.publicBaseUrl)/mcp"
    if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
        Set-Clipboard -Value $mcpUrl
        Write-Info 'The public MCP URL was copied to the clipboard.'
    }

    Write-Host ''
    Write-Host 'READY FOR CHATGPT WEB' -ForegroundColor Green
    Write-Host "MCP URL: $mcpUrl" -ForegroundColor Cyan
    Write-Host "Owner password: $ownerToken" -ForegroundColor Yellow
    Write-Host 'Keep the Owner password private. Use 06-COPY-PASSWORD.cmd when needed again.'
}

switch ($Action) {
    'install' { Install-OneClick }
    'start' { Start-Stack }
    'stop' { Stop-Stack }
    'status' { Show-Status }
    'add-root' { Add-Root }
    'copy-password' { Copy-OwnerPassword }
    'agent-status' { Show-AgentStatus }
    'agent-stop' { Stop-Agent }
}
