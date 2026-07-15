Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-PlatformInfo {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "[DevSpace] $Message"
}
function Refresh-ProcessPath {
    $parts = @(
        [Environment]::GetEnvironmentVariable('Path', 'Machine'),
        [Environment]::GetEnvironmentVariable('Path', 'User'),
        $env:Path
    ) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

    $env:Path = (($parts -join ';') -split ';' |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Select-Object -Unique) -join ';'
}

function Resolve-CommandPath {
    param([Parameter(Mandatory = $true)][string[]]$Names)

    foreach ($name in $Names) {
        $command = Get-Command $name -ErrorAction SilentlyContinue
        if ($command) {
            return $command.Source
        }
    }
    return $null
}

function Get-CompatibleNode {
    $candidates = [System.Collections.Generic.List[string]]::new()
    foreach ($command in @(Get-Command node.exe -All -ErrorAction SilentlyContinue)) {
        if ($command.Source -and -not $candidates.Contains($command.Source)) {
            $candidates.Add($command.Source)
        }
    }

    $knownPath = Join-Path $env:ProgramFiles 'nodejs\node.exe'
    if ((Test-Path -LiteralPath $knownPath) -and -not $candidates.Contains($knownPath)) {
        $candidates.Add($knownPath)
    }

    foreach ($candidate in $candidates) {
        try {
            $version = [version]((& $candidate --version).Trim().TrimStart('v'))
            if ($version -ge [version]'22.19.0' -and $version -lt [version]'27.0.0') {
                return [pscustomobject]@{
                    Path = $candidate
                    Version = $version
                }
            }
        }
        catch {
        }
    }

    throw 'DevSpace requires Node.js >=22.19 and <27, but no compatible Node.js was found.'
}

function Resolve-Npm {
    param([Parameter(Mandatory = $true)][string]$NodePath)

    $nextToNode = Join-Path (Split-Path -Parent $NodePath) 'npm.cmd'
    if (Test-Path -LiteralPath $nextToNode) {
        return $nextToNode
    }

    $npm = Resolve-CommandPath -Names @('npm.cmd', 'npm')
    if (-not $npm) {
        throw 'npm was not found.'
    }
    return $npm
}

function Resolve-Bash {
    $bash = Resolve-CommandPath -Names @('bash.exe', 'bash')
    if ($bash) {
        return $bash
    }

    foreach ($candidate in @(
        (Join-Path $env:ProgramFiles 'Git\bin\bash.exe'),
        (Join-Path $env:ProgramFiles 'Git\usr\bin\bash.exe')
    )) {
        if (Test-Path -LiteralPath $candidate) {
            return $candidate
        }
    }
    throw 'Git Bash was not found.'
}

function Resolve-DevTunnel {
    $devTunnel = Resolve-CommandPath -Names @('devtunnel.exe', 'devtunnel')
    if ($devTunnel) {
        return $devTunnel
    }

    $wingetLink = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\devtunnel.exe'
    if (Test-Path -LiteralPath $wingetLink) {
        return $wingetLink
    }

    $wingetPackages = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
    $candidate = Get-ChildItem -Path $wingetPackages -Filter devtunnel.exe -File -Recurse -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($candidate) {
        return $candidate.FullName
    }

    throw 'Microsoft Dev Tunnel CLI was not found.'
}

function Install-WingetPackage {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$DisplayName
    )

    $winget = Resolve-CommandPath -Names @('winget.exe', 'winget')
    if (-not $winget) {
        throw "Windows Package Manager (winget) is required to install $DisplayName."
    }

    Write-PlatformInfo "Installing or updating $DisplayName..."
    & $winget install --id $Id --exact --silent --accept-package-agreements --accept-source-agreements | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "winget could not install $DisplayName (exit code $LASTEXITCODE)."
    }
    Refresh-ProcessPath
}

function Resolve-DevSpaceCli {
    param([Parameter(Mandatory = $true)][string]$NpmPath)

    $globalRoot = (& $NpmPath root -g).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($globalRoot)) {
        throw 'Unable to resolve the global npm package directory.'
    }

    $cli = Join-Path $globalRoot '@waishnav\devspace\dist\cli.js'
    if (-not (Test-Path -LiteralPath $cli)) {
        throw "DevSpace is not installed. Run 01-INSTALL-AND-START.cmd."
    }
    return $cli
}

function Install-Dependencies {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$DevSpacePackage)

    if ($env:OS -ne 'Windows_NT') {
        throw 'This portable package supports Windows only.'
    }

    Refresh-ProcessPath
    try {
        $node = Get-CompatibleNode
    }
    catch {
        Install-WingetPackage -Id 'OpenJS.NodeJS.LTS' -DisplayName 'Node.js LTS'
        $node = Get-CompatibleNode
    }

    try {
        [void](Resolve-Bash)
        if (-not (Resolve-CommandPath -Names @('git.exe', 'git'))) {
            throw 'Git is missing.'
        }
    }
    catch {
        Install-WingetPackage -Id 'Git.Git' -DisplayName 'Git for Windows'
        [void](Resolve-Bash)
    }

    try {
        $devTunnel = Resolve-DevTunnel
    }
    catch {
        Install-WingetPackage -Id 'Microsoft.devtunnel' -DisplayName 'Microsoft Dev Tunnel'
        $devTunnel = Resolve-DevTunnel
    }

    $npm = Resolve-Npm -NodePath $node.Path
    Write-PlatformInfo "Installing tested DevSpace package $DevSpacePackage..."
    & $npm install -g $DevSpacePackage | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "npm could not install $DevSpacePackage."
    }

    $cli = Resolve-DevSpaceCli -NpmPath $npm
    $versionOutput = (& $node.Path $cli --version 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "DevSpace version check failed: $versionOutput"
    }

    Write-PlatformInfo "Node.js: $($node.Version)"
    Write-PlatformInfo "DevSpace: $versionOutput"
    Write-PlatformInfo "Dev Tunnel: $((& $devTunnel --version 2>&1 | Select-Object -First 1))"

    return [pscustomobject]@{
        Node = $node.Path
        Npm = $npm
        DevSpaceCli = $cli
        Bash = Resolve-Bash
        DevTunnel = $devTunnel
    }
}

function Get-InstalledTools {
    Refresh-ProcessPath
    $node = Get-CompatibleNode
    $npm = Resolve-Npm -NodePath $node.Path
    return [pscustomobject]@{
        Node = $node.Path
        Npm = $npm
        DevSpaceCli = Resolve-DevSpaceCli -NpmPath $npm
        Bash = Resolve-Bash
        DevTunnel = Resolve-DevTunnel
    }
}

function ConvertFrom-NativeJson {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$Operation
    )

    $output = (& $Executable @Arguments 2>&1 | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) {
        throw "$Operation failed: $output"
    }

    $jsonStart = $output.IndexOf('{')
    if ($jsonStart -lt 0) {
        throw "$Operation returned no JSON."
    }
    return $output.Substring($jsonStart) | ConvertFrom-Json
}

function Ensure-DevTunnelLogin {
    param([Parameter(Mandatory = $true)][string]$DevTunnel)

    try {
        $user = ConvertFrom-NativeJson -Executable $DevTunnel -Arguments @('user', 'show', '-j') -Operation 'Dev Tunnel login check'
        if ([string]$user.status -eq 'Logged in') {
            Write-PlatformInfo 'Microsoft Dev Tunnel login: ready'
            return
        }
    }
    catch {
    }

    Write-PlatformInfo 'A browser will open for Microsoft Dev Tunnel login.'
    & $DevTunnel user login | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw 'Microsoft Dev Tunnel login failed.'
    }

    $user = ConvertFrom-NativeJson -Executable $DevTunnel -Arguments @('user', 'show', '-j') -Operation 'Dev Tunnel login verification'
    if ([string]$user.status -ne 'Logged in') {
        throw 'Microsoft Dev Tunnel is not logged in.'
    }
}

function Test-LocalPortAvailable {
    param([Parameter(Mandatory = $true)][int]$Port)

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($listener) {
            $listener.Stop()
        }
    }
}

function Get-AccountDevSpacePorts {
    param([Parameter(Mandatory = $true)][string]$DevTunnel)

    $list = ConvertFrom-NativeJson -Executable $DevTunnel -Arguments @('list', '--labels', 'devspace', '--limit', '100', '-j') -Operation 'Dev Tunnel list'
    $ports = [System.Collections.Generic.HashSet[int]]::new()
    foreach ($tunnel in @($list.tunnels)) {
        $portList = ConvertFrom-NativeJson -Executable $DevTunnel -Arguments @('port', 'list', [string]$tunnel.tunnelId, '-j') -Operation "Port list for $($tunnel.tunnelId)"
        foreach ($port in @($portList.ports)) {
            [void]$ports.Add([int]$port.portNumber)
        }
    }
    return [int[]]@($ports)
}
Export-ModuleMember -Function @(
    'Install-Dependencies',
    'Get-InstalledTools',
    'ConvertFrom-NativeJson',
    'Ensure-DevTunnelLogin',
    'Test-LocalPortAvailable',
    'Get-AccountDevSpacePorts'
)