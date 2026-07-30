[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:Passed = 0
$script:Failed = 0

function Assert-Equal {
    param($Actual, $Expected, [string]$Name)

    $actualJson = $Actual | ConvertTo-Json -Compress -Depth 12
    $expectedJson = $Expected | ConvertTo-Json -Compress -Depth 12
    if ($actualJson -ne $expectedJson) {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
        Write-Host "  expected: $expectedJson"
        Write-Host "  actual:   $actualJson"
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

function Write-TestJson {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [Parameter(Mandatory = $true)]$Value
    )

    [System.IO.File]::WriteAllText(
        $FilePath,
        ($Value | ConvertTo-Json -Depth 12),
        [System.Text.UTF8Encoding]::new($false)
    )
}

function ConvertFrom-TestSecureString {
    param([Parameter(Mandatory = $true)][Security.SecureString]$Value)

    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

$watchdogPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'devspace-watchdog.ps1'
if (-not (Test-Path -LiteralPath $watchdogPath)) {
    Write-Host '[FAIL] Watchdog production script exists' -ForegroundColor Red
    Write-Host "  missing: $watchdogPath"
    exit 1
}
. $watchdogPath

$testRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("devspace-watchdog-tests-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot -Force | Out-Null

try {
    $paths = Get-WatchdogPaths -StateRoot $testRoot
    Assert-Equal $paths.ConfigPath (Join-Path $testRoot 'config.json') 'derives the Watchdog config path'
    Assert-Equal $paths.StatePath (Join-Path $testRoot 'state.json') 'derives the Watchdog state path'
    Assert-Equal $paths.LogPath (Join-Path $testRoot 'watchdog.log') 'derives the Watchdog log path'

    $atomicPath = Join-Path $testRoot 'atomic.json'
    Write-WatchdogJsonAtomic -FilePath $atomicPath -Value ([ordered]@{ schemaVersion = 1; status = 'healthy' })
    $atomic = Read-WatchdogJson -FilePath $atomicPath
    Assert-Equal ([int]$atomic.schemaVersion) 1 'writes and reads UTF-8 JSON atomically'
    Assert-Equal ([string]$atomic.status) 'healthy' 'preserves JSON values'
    Assert-Equal @(Get-ChildItem -LiteralPath $testRoot -Filter 'atomic.json.*.tmp') @() 'removes the atomic temp file'

    $settingsPath = Join-Path $testRoot 'settings.json'
    $validSettings = [ordered]@{
        schemaVersion = 1
        machineName = 'TEST-MACHINE'
        tunnelId = 'devspace-mcp-pop15.jpe1'
        port = 7678
        publicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
    }
    Write-TestJson -FilePath $settingsPath -Value $validSettings
    $settings = Get-ValidatedOneClickSettings -SettingsPath $settingsPath -MachineName 'TEST-MACHINE'
    Assert-Equal ([int]$settings.port) 7678 'accepts a bounded OneClick port'
    Assert-Equal ([string]$settings.tunnelId) 'devspace-mcp-pop15.jpe1' 'accepts a safe tunnel ID'

    Assert-Throws {
        Get-ValidatedOneClickSettings -SettingsPath (Join-Path $testRoot 'missing-settings.json') -MachineName 'TEST-MACHINE'
    } 'rejects missing OneClick settings'

    Write-TestJson -FilePath $settingsPath -Value ([ordered]@{
        schemaVersion = 1
        machineName = 'OTHER-MACHINE'
        tunnelId = 'devspace-mcp-pop15.jpe1'
        port = 7678
        publicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
    })
    Assert-Throws {
        Get-ValidatedOneClickSettings -SettingsPath $settingsPath -MachineName 'TEST-MACHINE'
    } 'rejects settings from another machine'

    Write-TestJson -FilePath $settingsPath -Value ([ordered]@{
        schemaVersion = 1
        machineName = 'TEST-MACHINE'
        tunnelId = 'devspace-mcp-pop15.jpe1'
        port = 0
        publicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
    })
    Assert-Throws {
        Get-ValidatedOneClickSettings -SettingsPath $settingsPath -MachineName 'TEST-MACHINE'
    } 'rejects an out-of-range port'

    foreach ($invalidOrigin in @(
        'http://dxrpsqgc-7678.jpe1.devtunnels.ms',
        'https://example.com',
        'https://dxrpsqgc-7678.jpe1.devtunnels.ms/mcp',
        'https://dxrpsqgc-7678.jpe1.devtunnels.ms/?query=1',
        'https://user@dxrpsqgc-7678.jpe1.devtunnels.ms'
    )) {
        Assert-Throws {
            Assert-WatchdogPublicOrigin -PublicBaseUrl $invalidOrigin -Port 7678
        } "rejects unsafe public origin: $invalidOrigin"
    }

    $healthy = Test-WatchdogHealth -Url 'http://127.0.0.1:7678/healthz' -InvokeHttp {
        param($Url, $TimeoutSeconds)
        [pscustomobject]@{
            Body = [pscustomobject]@{ ok = $true; name = 'devspace' }
            StatusCode = 200
        }
    }
    Assert-Equal $healthy.Healthy $true 'accepts the exact DevSpace health payload'
    Assert-Equal $healthy.Category $null 'healthy payload has no error category'

    $wrongName = Test-WatchdogHealth -Url 'http://127.0.0.1:7678/healthz' -InvokeHttp {
        param($Url, $TimeoutSeconds)
        [pscustomobject]@{
            Body = [pscustomobject]@{ ok = $true; name = 'other' }
            StatusCode = 200
        }
    }
    Assert-Equal $wrongName.Healthy $false 'rejects a health payload from another service'

    $notReady = Test-WatchdogHealth -Url 'http://127.0.0.1:7678/healthz' -InvokeHttp {
        param($Url, $TimeoutSeconds)
        [pscustomobject]@{
            Body = [pscustomobject]@{ ok = $false; name = 'devspace' }
            StatusCode = 503
        }
    }
    Assert-Equal $notReady.StatusCode 503 'retains a safe health status code'

    $networkFailure = Test-WatchdogHealth -Url 'http://127.0.0.1:7678/healthz' -InvokeHttp {
        param($Url, $TimeoutSeconds)
        throw 'simulated network failure with internal URL'
    }
    Assert-Equal $networkFailure.Healthy $false 'maps an HTTP exception to unhealthy'
    Assert-Equal $networkFailure.Detail $null 'does not expose raw HTTP exception detail'

    $tunnelDocument = [pscustomobject]@{
        tunnelId = 'devspace-mcp-pop15.jpe1'
        ports = @([pscustomobject]@{
            portNumber = 7678
            protocol = 'http'
            portForwardingUris = @('https://dxrpsqgc-7678.jpe1.devtunnels.ms/')
        })
    }
    Write-TestJson -FilePath $settingsPath -Value $validSettings
    $settings = Get-ValidatedOneClickSettings -SettingsPath $settingsPath -MachineName 'TEST-MACHINE'
    $origin = Get-ValidatedPublicOrigin -Settings $settings -TunnelDocument $tunnelDocument
    Assert-Equal $origin 'https://dxrpsqgc-7678.jpe1.devtunnels.ms' 'accepts the authoritative tunnel origin'

    $settings.publicBaseUrl = 'https://stale-7678.jpe1.devtunnels.ms'
    Assert-Throws {
        Get-ValidatedPublicOrigin -Settings $settings -TunnelDocument $tunnelDocument
    } 'rejects a stale public origin'

    $task3Functions = @(
        'Test-WatchdogDevTunnelLogin',
        'Get-MatchingDevTunnelProcesses',
        'New-TunnelCleanupPlan',
        'Invoke-TunnelCleanupPlan'
    )
    $missingTask3Functions = @($task3Functions | Where-Object {
        -not (Get-Command $_ -ErrorAction SilentlyContinue)
    })
    if ($missingTask3Functions.Count -gt 0) {
        Write-Host '[FAIL] tunnel identity functions exist' -ForegroundColor Red
        Write-Host "  missing: $($missingTask3Functions -join ', ')"
        $script:Failed++
    }
    else {
    $nativeCalls = [System.Collections.Generic.List[string]]::new()
    $loggedIn = Test-WatchdogDevTunnelLogin -DevTunnel 'fake-devtunnel.exe' -InvokeNativeJson {
        param($Executable, $Arguments)
        [void]$nativeCalls.Add(($Arguments -join ' '))
        [pscustomobject]@{ status = 'Logged in' }
    }
    Assert-Equal $loggedIn $true 'accepts a logged-in Dev Tunnel session'
    Assert-Equal @($nativeCalls) @('user show -j') 'checks login without invoking user login'

    $loggedOut = Test-WatchdogDevTunnelLogin -DevTunnel 'fake-devtunnel.exe' -InvokeNativeJson {
        param($Executable, $Arguments)
        [pscustomobject]@{ status = 'Logged out' }
    }
    Assert-Equal $loggedOut $false 'refuses a logged-out Dev Tunnel session'

    $loginCheckFailure = Test-WatchdogDevTunnelLogin -DevTunnel 'fake-devtunnel.exe' -InvokeNativeJson {
        param($Executable, $Arguments)
        throw 'simulated CLI failure'
    }
    Assert-Equal $loginCheckFailure $false 'fails closed when the login check errors'

    $processRecords = @(
        [pscustomobject]@{
            Name = 'devtunnel.exe'
            ProcessId = 18636
            ParentProcessId = 1
            CommandLine = 'devtunnel.exe host devspace-mcp-pop15.jpe1'
            StartedAtUtc = '2026-07-29T00:00:00.0000000Z'
        },
        [pscustomobject]@{
            Name = 'devtunnel.exe'
            ProcessId = 26016
            ParentProcessId = 1
            CommandLine = '"C:\Tools\devtunnel.exe" host "devspace-mcp-pop15.jpe1"'
            StartedAtUtc = '2026-07-29T00:01:00.0000000Z'
        },
        [pscustomobject]@{
            Name = 'devtunnel.exe'
            ProcessId = 3716
            ParentProcessId = 1
            CommandLine = 'devtunnel.exe host -p 8791 -a -e 1h'
            StartedAtUtc = '2026-07-29T00:02:00.0000000Z'
        },
        [pscustomobject]@{
            Name = 'devtunnel.exe'
            ProcessId = 9999
            ParentProcessId = 1
            CommandLine = 'devtunnel.exe host devspace-mcp-pop150.jpe1'
            StartedAtUtc = '2026-07-29T00:03:00.0000000Z'
        },
        [pscustomobject]@{
            Name = 'other.exe'
            ProcessId = 7777
            ParentProcessId = 1
            CommandLine = 'other.exe host devspace-mcp-pop15.jpe1'
            StartedAtUtc = '2026-07-29T00:04:00.0000000Z'
        }
    )

    $matchingProcesses = @(
        Get-MatchingDevTunnelProcesses `
            -TunnelId 'devspace-mcp-pop15.jpe1' `
            -ProcessRecords $processRecords
    )
    Assert-Equal @($matchingProcesses.ProcessId) @(18636, 26016) 'matches only the exact configured tunnel host'

    $cleanupPlan = @(
        New-TunnelCleanupPlan `
            -TunnelId 'devspace-mcp-pop15.jpe1' `
            -ProcessRecords $processRecords `
            -KeepProcessId 18636
    )
    Assert-Equal @($cleanupPlan.ProcessId) @(26016) 'keeps the selected verified tunnel host'

    $stoppedProcesses = [System.Collections.Generic.List[int]]::new()
    Invoke-TunnelCleanupPlan -Plan $cleanupPlan -GetProcessRecord {
        param($ProcessId)
        return @($processRecords | Where-Object { $_.ProcessId -eq $ProcessId })[0]
    } -StopProcess {
        param($ProcessId)
        [void]$stoppedProcesses.Add([int]$ProcessId)
    }
    Assert-Equal @($stoppedProcesses) @(26016) 'stops only a revalidated cleanup target'

    $stoppedAfterPidReuse = [System.Collections.Generic.List[int]]::new()
    Assert-Throws {
        Invoke-TunnelCleanupPlan -Plan $cleanupPlan -GetProcessRecord {
            param($ProcessId)
            [pscustomobject]@{
                Name = 'devtunnel.exe'
                ProcessId = $ProcessId
                ParentProcessId = 1
                CommandLine = 'devtunnel.exe host devspace-mcp-pop15.jpe1'
                StartedAtUtc = '2026-07-29T05:00:00.0000000Z'
            }
        } -StopProcess {
            param($ProcessId)
            [void]$stoppedAfterPidReuse.Add([int]$ProcessId)
        }
    } 'rejects a reused PID with a different start time'
    Assert-Equal @($stoppedAfterPidReuse) @() 'does not stop a reused PID'

    $stoppedAfterCommandDrift = [System.Collections.Generic.List[int]]::new()
    Assert-Throws {
        Invoke-TunnelCleanupPlan -Plan $cleanupPlan -GetProcessRecord {
            param($ProcessId)
            [pscustomobject]@{
                Name = 'devtunnel.exe'
                ProcessId = $ProcessId
                ParentProcessId = 1
                CommandLine = 'devtunnel.exe host another-tunnel.jpe1'
                StartedAtUtc = '2026-07-29T00:01:00.0000000Z'
            }
        } -StopProcess {
            param($ProcessId)
            [void]$stoppedAfterCommandDrift.Add([int]$ProcessId)
        }
    } 'rejects command-line drift before stopping a process'
    Assert-Equal @($stoppedAfterCommandDrift) @() 'does not stop a process after command-line drift'
    }

    $task4Functions = @(
        'Protect-WatchdogToken',
        'Unprotect-WatchdogToken',
        'New-WatchdogSecurityDescriptor',
        'Set-WatchdogAcl',
        'Write-WatchdogLog',
        'Get-WatchdogNotificationDecision',
        'Register-ConnectorFailure',
        'Send-WatchdogTelegram'
    )
    $missingTask4Functions = @($task4Functions | Where-Object {
        -not (Get-Command $_ -ErrorAction SilentlyContinue)
    })
    if ($missingTask4Functions.Count -gt 0) {
        Write-Host '[FAIL] secret, ACL, log, and notification functions exist' -ForegroundColor Red
        Write-Host "  missing: $($missingTask4Functions -join ', ')"
        $script:Failed++
    }
    else {
        $plainToken = ([guid]::NewGuid().ToString('N') + ':' + [guid]::NewGuid().ToString('N'))
        $secureToken = ConvertTo-SecureString -String $plainToken -AsPlainText -Force
        $cipherText = Protect-WatchdogToken -SecureToken $secureToken
        Assert-Equal $cipherText.Contains($plainToken) $false 'DPAPI ciphertext does not contain the plaintext token'
        $roundTrip = Unprotect-WatchdogToken -CipherText $cipherText
        Assert-Equal (ConvertFrom-TestSecureString -Value $roundTrip) $plainToken 'round-trips the token with CurrentUser DPAPI'
        Assert-Throws {
            Unprotect-WatchdogToken -CipherText 'not-dpapi-ciphertext'
        } 'rejects invalid DPAPI ciphertext'

        $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $descriptor = New-WatchdogSecurityDescriptor -UserSid $currentSid
        $rules = @($descriptor.GetAccessRules(
            $true,
            $true,
            [Security.Principal.SecurityIdentifier]
        ))
        Assert-Equal $descriptor.AreAccessRulesProtected $true 'disables inherited Watchdog ACL rules'
        Assert-Equal @($rules.IdentityReference.Value | Sort-Object) @(
            'S-1-5-18',
            $currentSid.Value
        ) 'allows only SYSTEM and the current Windows user'

        $aclRoot = Join-Path $testRoot 'acl-root'
        New-Item -ItemType Directory -Path $aclRoot -Force | Out-Null
        $aclFile = Join-Path $aclRoot 'config.json'
        [System.IO.File]::WriteAllText($aclFile, '{}', [System.Text.UTF8Encoding]::new($false))
        Set-WatchdogAcl -DirectoryPath $aclRoot -FilePaths @($aclFile)
        $appliedRules = @((Get-Acl -LiteralPath $aclFile).GetAccessRules(
            $true,
            $true,
            [Security.Principal.SecurityIdentifier]
        ))
        Assert-Equal @($appliedRules.IdentityReference.Value | Sort-Object) @(
            'S-1-5-18',
            $currentSid.Value
        ) 'applies the restricted ACL to Watchdog files'

        $aclNoPrivilegeRoot = Join-Path $testRoot 'acl-no-privilege-root'
        New-Item -ItemType Directory -Path $aclNoPrivilegeRoot -Force | Out-Null
        $aclNoPrivilegeFile = Join-Path $aclNoPrivilegeRoot 'config.json'
        [System.IO.File]::WriteAllText(
            $aclNoPrivilegeFile,
            '{}',
            [System.Text.UTF8Encoding]::new($false)
        )
        Set-Item -LiteralPath 'Function:\Set-Acl' -Value {
            throw [Security.AccessControl.PrivilegeNotHeldException]::new(
                'SeSecurityPrivilege is unavailable.'
            )
        }
        try {
            try {
                Set-WatchdogAcl `
                    -DirectoryPath $aclNoPrivilegeRoot `
                    -FilePaths @($aclNoPrivilegeFile)
                Write-Host '[PASS] applies Watchdog DACL without Set-Acl security privilege' -ForegroundColor Green
                $script:Passed++
            }
            catch {
                Write-Host '[FAIL] applies Watchdog DACL without Set-Acl security privilege' -ForegroundColor Red
                Write-Host "  error type: $($_.Exception.GetType().FullName)"
                $script:Failed++
            }
        }
        finally {
            Remove-Item -LiteralPath 'Function:\Set-Acl' -ErrorAction SilentlyContinue
        }

        $logPath = Join-Path $testRoot 'watchdog.log'
        $logPaths = [pscustomobject]@{ LogPath = $logPath }
        Write-WatchdogLog `
            -Paths $logPaths `
            -CorrelationId ([guid]'11111111-1111-1111-1111-111111111111') `
            -Event 'RunCompleted' `
            -Data ([ordered]@{
                Status = 'healthy'
                ErrorCategory = $null
                StatusCode = 200
                PublicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
                RecoveryAttempted = $false
                RecoverySucceeded = $false
            })
        $safeLog = [System.IO.File]::ReadAllText($logPath)
        Assert-Equal $safeLog.Contains($plainToken) $false 'does not write the Telegram token to the log'
        Assert-Throws {
            Write-WatchdogLog `
                -Paths $logPaths `
                -CorrelationId ([guid]::NewGuid()) `
                -Event 'RunCompleted' `
                -Data ([ordered]@{ Token = $plainToken })
        } 'rejects non-whitelisted log fields'
        Assert-Throws {
            Write-WatchdogLog `
                -Paths $logPaths `
                -CorrelationId ([guid]::NewGuid()) `
                -Event 'RunCompleted' `
                -Data ([ordered]@{ Status = $plainToken })
        } 'rejects untrusted text inside a whitelisted log field'

        [System.IO.File]::WriteAllText(
            $logPath,
            ('x' * 1048576),
            [System.Text.UTF8Encoding]::new($false)
        )
        Write-WatchdogLog `
            -Paths $logPaths `
            -CorrelationId ([guid]'22222222-2222-2222-2222-222222222222') `
            -Event 'RunCompleted' `
            -Data ([ordered]@{ Status = 'healthy' })
        Assert-Equal (Test-Path -LiteralPath "$logPath.1") $true 'rotates a one MiB Watchdog log'
        Assert-Equal ([System.IO.File]::ReadAllText($logPath).Contains('22222222-2222-2222-2222-222222222222')) $true 'writes the new event after rotation'

        $unknownHealthy = Get-WatchdogNotificationDecision `
            -PreviousState ([pscustomobject]@{ status = 'unknown'; lastErrorCategory = $null }) `
            -CurrentResult ([pscustomobject]@{ status = 'healthy'; errorCategory = $null })
        Assert-Equal $unknownHealthy.Kind 'None' 'does not notify on initial healthy state'

        $healthyUnhealthy = Get-WatchdogNotificationDecision `
            -PreviousState ([pscustomobject]@{ status = 'healthy'; lastErrorCategory = $null }) `
            -CurrentResult ([pscustomobject]@{ status = 'unhealthy'; errorCategory = 'PublicHealthFailed' })
        Assert-Equal $healthyUnhealthy.Kind 'Anomaly' 'notifies a healthy to unhealthy transition'

        $sameUnhealthy = Get-WatchdogNotificationDecision `
            -PreviousState ([pscustomobject]@{ status = 'unhealthy'; lastErrorCategory = 'PublicHealthFailed' }) `
            -CurrentResult ([pscustomobject]@{ status = 'unhealthy'; errorCategory = 'PublicHealthFailed' })
        Assert-Equal $sameUnhealthy.Kind 'None' 'deduplicates the same unhealthy category'

        $changedUnhealthy = Get-WatchdogNotificationDecision `
            -PreviousState ([pscustomobject]@{ status = 'unhealthy'; lastErrorCategory = 'PublicHealthFailed' }) `
            -CurrentResult ([pscustomobject]@{ status = 'unhealthy'; errorCategory = 'DevTunnelNotLoggedIn' })
        Assert-Equal $changedUnhealthy.Kind 'Anomaly' 'notifies when the unhealthy category changes'

        $recovered = Get-WatchdogNotificationDecision `
            -PreviousState ([pscustomobject]@{ status = 'unhealthy'; lastErrorCategory = 'PublicHealthFailed' }) `
            -CurrentResult ([pscustomobject]@{ status = 'healthy'; errorCategory = $null })
        Assert-Equal $recovered.Kind 'Recovery' 'notifies an unhealthy to healthy transition'

        $connectorState = [pscustomobject]@{
            lastConnectorFailureNotifiedAtUtc = $null
        }
        $firstConnectorFailure = Register-ConnectorFailure `
            -State $connectorState `
            -Now ([datetime]'2026-07-29T00:00:00Z')
        Assert-Equal $firstConnectorFailure.ShouldNotify $true 'notifies the first Connector failure'
        $duplicateConnectorFailure = Register-ConnectorFailure `
            -State $firstConnectorFailure.State `
            -Now ([datetime]'2026-07-29T03:59:59Z')
        Assert-Equal $duplicateConnectorFailure.ShouldNotify $false 'deduplicates Connector failure within four hours'
        $laterConnectorFailure = Register-ConnectorFailure `
            -State $firstConnectorFailure.State `
            -Now ([datetime]'2026-07-29T04:00:00Z')
        Assert-Equal $laterConnectorFailure.ShouldNotify $true 'allows Connector notification after four hours'
        Assert-Throws {
            Register-ConnectorFailure `
                -State $connectorState `
                -Now ([datetime]'2026-07-29T00:00:00Z') `
                -ErrorText 'untrusted detail'
        } 'ConnectorFailure does not accept arbitrary error text'

        $telegramConfig = [pscustomobject]@{
            schemaVersion = 1
            telegramChatId = '-1001234567890'
            telegramBotTokenDpapi = $cipherText
        }
        $telegramTokens = [System.Collections.Generic.List[string]]::new()
        $telegramResult = Send-WatchdogTelegram `
            -Config $telegramConfig `
            -Message ([pscustomobject]@{
                Kind = 'Anomaly'
                MachineName = 'TEST-MACHINE'
                CheckedAtUtc = '2026-07-29T00:00:00.0000000Z'
                LocalStatus = 'down'
                PublicStatus = 'down'
                ConnectorStatus = 'unknown'
                RecoveryAttempted = $true
                RecoverySucceeded = $false
                ErrorCategory = 'PublicHealthFailed'
                PublicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
            }) `
            -InvokeTelegram {
                param($Token, $ChatId, $Text)
                [void]$telegramTokens.Add($Token)
                [pscustomobject]@{ StatusCode = 200; Ok = $true }
            }
        Assert-Equal $telegramResult.Delivered $true 'delivers a fixed structured Telegram notification'
        Assert-Equal @($telegramTokens) @($plainToken) 'decrypts the token only for the Telegram adapter'
        Assert-Equal (($telegramResult | ConvertTo-Json -Compress).Contains($plainToken)) $false 'does not return the Telegram token'
        Assert-Throws {
            Send-WatchdogTelegram `
                -Config $telegramConfig `
                -Message ([pscustomobject]@{
                    Kind = 'Anomaly'
                    MachineName = 'TEST-MACHINE'
                    CheckedAtUtc = '2026-07-29T00:00:00.0000000Z'
                    LocalStatus = $plainToken
                    PublicStatus = 'down'
                    ConnectorStatus = 'unknown'
                    RecoveryAttempted = $false
                    RecoverySucceeded = $false
                    ErrorCategory = 'PublicHealthFailed'
                    PublicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
                }) `
                -InvokeTelegram {
                    throw 'must not call Telegram for an invalid structured message'
                }
        } 'rejects untrusted text inside a Telegram status field'

        $failedTelegram = Send-WatchdogTelegram `
            -Config $telegramConfig `
            -Message ([pscustomobject]@{
                Kind = 'Recovery'
                MachineName = 'TEST-MACHINE'
                CheckedAtUtc = '2026-07-29T04:00:00.0000000Z'
                LocalStatus = 'ready'
                PublicStatus = 'ready'
                ConnectorStatus = 'unknown'
                RecoveryAttempted = $true
                RecoverySucceeded = $true
                ErrorCategory = $null
                PublicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
            }) `
            -InvokeTelegram {
                param($Token, $ChatId, $Text)
                throw "simulated failure containing $Token"
            }
        Assert-Equal $failedTelegram.Delivered $false 'sanitizes a Telegram delivery exception'
        Assert-Equal (($failedTelegram | ConvertTo-Json -Compress).Contains($plainToken)) $false 'does not return a token from a failed Telegram call'
    }

    $task5Functions = @(
        'New-WatchdogDependencies',
        'Enter-WatchdogMutex',
        'Invoke-OneClickAction',
        'Invoke-WatchdogProbe',
        'Invoke-WatchdogRecovery',
        'Invoke-WatchdogRun'
    )
    $missingTask5Functions = @($task5Functions | Where-Object {
        -not (Get-Command $_ -ErrorAction SilentlyContinue)
    })
    if ($missingTask5Functions.Count -gt 0) {
        Write-Host '[FAIL] Watchdog orchestration functions exist' -ForegroundColor Red
        Write-Host "  missing: $($missingTask5Functions -join ', ')"
        $script:Failed++
    }
    else {
        $probeSettings = [pscustomobject]$validSettings
        $probeCalls = [System.Collections.Generic.List[string]]::new()
        $healthyProbe = Invoke-WatchdogProbe -Settings $probeSettings -Dependencies @{
            GetTunnelDocument = {
                param($TunnelId)
                [void]$probeCalls.Add("tunnel:$TunnelId")
                return $tunnelDocument
            }
            InvokeHttp = {
                param($Url, $TimeoutSeconds)
                [void]$probeCalls.Add("http:$Url")
                [pscustomobject]@{
                    Body = [pscustomobject]@{ ok = $true; name = 'devspace' }
                    StatusCode = 200
                }
            }
        }
        Assert-Equal $healthyProbe.Status 'healthy' 'marks local and public health as healthy'
        Assert-Equal @($probeCalls) @(
            'http:http://127.0.0.1:7678/healthz',
            'tunnel:devspace-mcp-pop15.jpe1',
            'http:https://dxrpsqgc-7678.jpe1.devtunnels.ms/healthz'
        ) 'probes local health before the authoritative public origin'

        $localDownProbe = Invoke-WatchdogProbe -Settings $probeSettings -Dependencies @{
            GetTunnelDocument = { param($TunnelId) $tunnelDocument }
            InvokeHttp = {
                param($Url, $TimeoutSeconds)
                if ($Url -like 'http://127.0.0.1:*') {
                    return [pscustomobject]@{
                        Body = [pscustomobject]@{ ok = $false; name = 'devspace' }
                        StatusCode = 503
                    }
                }
                return [pscustomobject]@{
                    Body = [pscustomobject]@{ ok = $true; name = 'devspace' }
                    StatusCode = 200
                }
            }
        }
        Assert-Equal $localDownProbe.ErrorCategory 'LocalHealthFailed' 'classifies local health failure first'

        $publicDownProbe = Invoke-WatchdogProbe -Settings $probeSettings -Dependencies @{
            GetTunnelDocument = { param($TunnelId) $tunnelDocument }
            InvokeHttp = {
                param($Url, $TimeoutSeconds)
                if ($Url -like 'https://*') {
                    return [pscustomobject]@{
                        Body = [pscustomobject]@{ ok = $false; name = 'devspace' }
                        StatusCode = 502
                    }
                }
                return [pscustomobject]@{
                    Body = [pscustomobject]@{ ok = $true; name = 'devspace' }
                    StatusCode = 200
                }
            }
        }
        Assert-Equal $publicDownProbe.ErrorCategory 'PublicHealthFailed' 'classifies public tunnel health failure'

        $oneClickCalls = [System.Collections.Generic.List[string]]::new()
        Invoke-OneClickAction -Action 'stop' -Dependencies @{
            OneClickPath = 'C:\safe\devspace-oneclick.ps1'
            InvokeOneClick = {
                param($OneClickPath, $OneClickAction, $Environment)
                [void]$oneClickCalls.Add("$OneClickAction`:$($Environment.DEVSPACE_ONECLICK_NONINTERACTIVE)")
            }
        }
        Assert-Equal @($oneClickCalls) @('stop:1') 'forces non-interactive OneClick execution'

        $initialFailure = [pscustomobject]@{
            Status = 'unhealthy'
            ErrorCategory = 'PublicHealthFailed'
            LocalStatus = 'ready'
            PublicStatus = 'down'
            PublicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
        }
        $loggedOutEvents = [System.Collections.Generic.List[string]]::new()
        $loggedOutRecovery = Invoke-WatchdogRecovery `
            -InitialProbe $initialFailure `
            -Settings $probeSettings `
            -StartedAtUtc ([datetime]'2026-07-29T00:00:00Z') `
            -Dependencies @{
                DevTunnelPath = 'fake-devtunnel.exe'
                InvokeNativeJson = {
                    param($Executable, $Arguments)
                    [void]$loggedOutEvents.Add('login:show')
                    [pscustomobject]@{ status = 'Logged out' }
                }
                GetNow = { [datetime]'2026-07-29T00:00:01Z' }
                InvokeOneClick = { throw 'must not run' }
                OneClickPath = 'C:\safe\devspace-oneclick.ps1'
            }
        Assert-Equal $loggedOutRecovery.ErrorCategory 'DevTunnelNotLoggedIn' 'stops recovery when Dev Tunnel is logged out'
        Assert-Equal @($loggedOutEvents) @('login:show') 'does not start OneClick after a logged-out check'

        $stopFailureEvents = [System.Collections.Generic.List[string]]::new()
        $stopFailureRecovery = Invoke-WatchdogRecovery `
            -InitialProbe $initialFailure `
            -Settings $probeSettings `
            -StartedAtUtc ([datetime]'2026-07-29T00:00:00Z') `
            -Dependencies @{
                DevTunnelPath = 'fake-devtunnel.exe'
                InvokeNativeJson = { param($Executable, $Arguments) [pscustomobject]@{ status = 'Logged in' } }
                GetNow = { [datetime]'2026-07-29T00:00:01Z' }
                OneClickPath = 'C:\safe\devspace-oneclick.ps1'
                InvokeOneClick = {
                    param($OneClickPath, $OneClickAction, $Environment)
                    [void]$stopFailureEvents.Add("oneclick:$OneClickAction")
                    throw 'simulated verified stop refusal'
                }
            }
        Assert-Equal $stopFailureRecovery.ErrorCategory 'OneClickStopRefused' 'stops after OneClick refuses a verified stop'
        Assert-Equal @($stopFailureEvents) @('oneclick:stop') 'does not continue after OneClick stop refusal'

        $recoveryEvents = [System.Collections.Generic.List[string]]::new()
        $residualProcesses = @($processRecords | Where-Object { $_.ProcessId -in @(26016, 3716) })
        $recoveryDependencies = @{
            DevTunnelPath = 'fake-devtunnel.exe'
            InvokeNativeJson = {
                param($Executable, $Arguments)
                [void]$recoveryEvents.Add('login:show')
                [pscustomobject]@{ status = 'Logged in' }
            }
            GetNow = { [datetime]'2026-07-29T00:00:01Z' }
            OneClickPath = 'C:\safe\devspace-oneclick.ps1'
            InvokeOneClick = {
                param($OneClickPath, $OneClickAction, $Environment)
                [void]$recoveryEvents.Add("oneclick:$OneClickAction`:$($Environment.DEVSPACE_ONECLICK_NONINTERACTIVE)")
            }
            GetProcessRecords = {
                [void]$recoveryEvents.Add('processes:list')
                return $residualProcesses
            }
            GetProcessRecord = {
                param($ProcessId)
                [void]$recoveryEvents.Add("process:read:$ProcessId")
                return @($residualProcesses | Where-Object { $_.ProcessId -eq $ProcessId })[0]
            }
            StopProcess = {
                param($ProcessId)
                [void]$recoveryEvents.Add("process:stop:$ProcessId")
            }
            ReadSettings = {
                [void]$recoveryEvents.Add('settings:reread')
                return [pscustomobject]$validSettings
            }
            Probe = {
                param($FreshSettings)
                [void]$recoveryEvents.Add("probe:$($FreshSettings.publicBaseUrl)")
                return [pscustomobject]@{
                    Status = 'healthy'
                    ErrorCategory = $null
                    LocalStatus = 'ready'
                    PublicStatus = 'ready'
                    PublicBaseUrl = [string]$FreshSettings.publicBaseUrl
                }
            }
        }
        $successfulRecovery = Invoke-WatchdogRecovery `
            -InitialProbe $initialFailure `
            -Settings $probeSettings `
            -StartedAtUtc ([datetime]'2026-07-29T00:00:00Z') `
            -Dependencies $recoveryDependencies
        Assert-Equal $successfulRecovery.Status 'healthy' 'returns healthy after one successful recovery'
        Assert-Equal $successfulRecovery.RecoverySucceeded $true 'marks a successful recovery'
        Assert-Equal @($recoveryEvents) @(
            'login:show',
            'oneclick:stop:1',
            'processes:list',
            'process:read:26016',
            'process:stop:26016',
            'oneclick:start:1',
            'settings:reread',
            'probe:https://dxrpsqgc-7678.jpe1.devtunnels.ms'
        ) 'performs one bounded recovery in safe order'

        $failedPostProbeCount = 0
        $failedPostDependencies = $recoveryDependencies.Clone()
        $failedPostDependencies.Probe = {
            param($FreshSettings)
            $script:failedPostProbeCount++
            [pscustomobject]@{
                Status = 'unhealthy'
                ErrorCategory = 'PublicHealthFailed'
                LocalStatus = 'ready'
                PublicStatus = 'down'
                PublicBaseUrl = [string]$FreshSettings.publicBaseUrl
            }
        }
        $failedPostRecovery = Invoke-WatchdogRecovery `
            -InitialProbe $initialFailure `
            -Settings $probeSettings `
            -StartedAtUtc ([datetime]'2026-07-29T00:00:00Z') `
            -Dependencies $failedPostDependencies
        Assert-Equal $failedPostRecovery.ErrorCategory 'PostRecoveryHealthFailed' 'does not attempt a second recovery after post-check failure'
        Assert-Equal $script:failedPostProbeCount 1 'runs the post-recovery probe once'

        $timeoutEvents = [System.Collections.Generic.List[string]]::new()
        $timedOutRecovery = Invoke-WatchdogRecovery `
            -InitialProbe $initialFailure `
            -Settings $probeSettings `
            -StartedAtUtc ([datetime]'2026-07-29T00:00:00Z') `
            -Dependencies @{
                GetNow = { [datetime]'2026-07-29T00:08:01Z' }
                DevTunnelPath = 'fake-devtunnel.exe'
                InvokeNativeJson = {
                    [void]$timeoutEvents.Add('unexpected')
                    [pscustomobject]@{ status = 'Logged in' }
                }
            }
        Assert-Equal $timedOutRecovery.ErrorCategory 'RunTimedOut' 'bounds recovery to eight minutes'
        Assert-Equal @($timeoutEvents) @() 'does not perform side effects after timeout'

        $runEvents = [System.Collections.Generic.List[string]]::new()
        $writtenStates = [System.Collections.Generic.List[object]]::new()
        $runResult = Invoke-WatchdogRun -Dependencies @{
            AcquireMutex = {
                [void]$runEvents.Add('mutex:acquire')
                [pscustomobject]@{
                    Acquired = $true
                    Release = { [void]$runEvents.Add('mutex:release') }
                }
            }
            GetNow = { [datetime]'2026-07-29T00:00:00Z' }
            ReadSettings = {
                [void]$runEvents.Add('settings:read')
                [pscustomobject]$validSettings
            }
            Probe = {
                param($Settings)
                [void]$runEvents.Add('probe')
                [pscustomobject]@{
                    Status = 'healthy'
                    ErrorCategory = $null
                    LocalStatus = 'ready'
                    PublicStatus = 'ready'
                    PublicBaseUrl = [string]$Settings.publicBaseUrl
                    RecoveryAttempted = $false
                    RecoverySucceeded = $false
                }
            }
            ReadState = {
                [pscustomobject]@{ status = 'unknown'; lastErrorCategory = $null }
            }
            WriteState = {
                param($State)
                [void]$writtenStates.Add($State)
            }
            Notify = {
                throw 'initial healthy state must not notify'
            }
            WriteLog = {
                param($Event, $Data, $CorrelationId)
                [void]$runEvents.Add("log:$Event")
            }
        }
        Assert-Equal $runResult.Status 'healthy' 'returns healthy without recovery when probes pass'
        Assert-Equal $writtenStates.Count 1 'persists one healthy state snapshot'
        Assert-Equal @($runEvents) @(
            'mutex:acquire',
            'settings:read',
            'probe',
            'log:RunCompleted',
            'mutex:release'
        ) 'releases the mutex after a healthy run'

        $busyEvents = [System.Collections.Generic.List[string]]::new()
        $busyResult = Invoke-WatchdogRun -Dependencies @{
            AcquireMutex = {
                [void]$busyEvents.Add('mutex:busy')
                [pscustomobject]@{ Acquired = $false; Release = $null }
            }
            ReadSettings = { [void]$busyEvents.Add('unexpected') }
            Notify = { [void]$busyEvents.Add('unexpected-notify') }
        }
        Assert-Equal $busyResult.ErrorCategory 'MutexBusy' 'exits when another Watchdog run owns the mutex'
        Assert-Equal @($busyEvents) @('mutex:busy') 'does not notify or probe after mutex contention'

        $missingSettingsNotifications = [System.Collections.Generic.List[string]]::new()
        $missingSettingsResult = Invoke-WatchdogRun -Dependencies @{
            AcquireMutex = {
                [pscustomobject]@{ Acquired = $true; Release = { } }
            }
            GetNow = { [datetime]'2026-07-29T00:00:00Z' }
            ReadSettings = {
                throw 'OneClick settings are missing.'
            }
            Probe = {
                throw 'must not probe without settings'
            }
            ReadState = {
                [pscustomobject]@{ status = 'unknown'; lastErrorCategory = $null }
            }
            WriteState = { param($State) }
            Notify = {
                param($Decision, $Result, $Now)
                [void]$missingSettingsNotifications.Add([string]$Result.ErrorCategory)
                [pscustomobject]@{ Delivered = $true }
            }
            WriteLog = { param($Event, $Data, $CorrelationId) }
        }
        Assert-Equal $missingSettingsResult.ErrorCategory 'SettingsMissing' 'distinguishes missing settings from malformed settings'
        Assert-Equal @($missingSettingsNotifications) @('SettingsMissing') 'notifies the first missing-settings anomaly'

        $notificationFailureLogs = [System.Collections.Generic.List[string]]::new()
        $notificationFailureResult = Invoke-WatchdogRun -Dependencies @{
            AcquireMutex = {
                [pscustomobject]@{ Acquired = $true; Release = { } }
            }
            GetNow = { [datetime]'2026-07-29T00:00:00Z' }
            ReadSettings = {
                throw 'OneClick settings are missing.'
            }
            Probe = {
                throw 'must not probe without settings'
            }
            ReadState = {
                [pscustomobject]@{ status = 'unknown'; lastErrorCategory = $null }
            }
            WriteState = { param($State) }
            Notify = {
                [pscustomobject]@{
                    Delivered = $false
                    ErrorCategory = 'TelegramDeliveryFailed'
                    StatusCode = 502
                }
            }
            WriteLog = {
                param($Event, $Data, $CorrelationId)
                [void]$notificationFailureLogs.Add($Event)
            }
        }
        Assert-Equal $notificationFailureResult.ErrorCategory 'SettingsMissing' 'keeps service failure classification when Telegram delivery fails'
        Assert-Equal @($notificationFailureLogs) @(
            'NotificationFailed',
            'RunCompleted'
        ) 'logs a sanitized Telegram failure without changing service state'
    }

    $task6Functions = @(
        'New-WatchdogTaskSpec',
        'Install-WatchdogTask',
        'Assert-WatchdogTaskMatchesSpec',
        'Install-Watchdog',
        'Get-WatchdogStatus',
        'Remove-WatchdogInstallation'
    )
    $missingTask6Functions = @($task6Functions | Where-Object {
        -not (Get-Command $_ -ErrorAction SilentlyContinue)
    })
    if ($missingTask6Functions.Count -gt 0) {
        Write-Host '[FAIL] Task Scheduler lifecycle functions exist' -ForegroundColor Red
        Write-Host "  missing: $($missingTask6Functions -join ', ')"
        $script:Failed++
    }
    else {
        $taskSpec = New-WatchdogTaskSpec `
            -ScriptPath 'C:\PixiuCore\scripts\devspace-portable\devspace-watchdog.ps1' `
            -UserId 'MACHINE\user' `
            -StartAt ([datetime]'2026-07-29T10:00:00')
        Assert-Equal $taskSpec.TaskName 'Pixiu DevSpace Watchdog' 'uses the fixed Watchdog task name'
        Assert-Equal $taskSpec.RepetitionInterval.TotalHours 4 'runs the Watchdog every four hours'
        Assert-Equal $taskSpec.AtLogOn $true 'runs the Watchdog at current user logon'
        Assert-Equal $taskSpec.MultipleInstances 'IgnoreNew' 'ignores overlapping scheduled runs'
        Assert-Equal $taskSpec.RunLevel 'Limited' 'uses least-privilege task execution'
        Assert-Equal $taskSpec.LogonType 'Interactive' 'uses the current interactive token'
        Assert-Equal $taskSpec.ExecutionTimeLimit.TotalMinutes 10 'bounds Task Scheduler execution'
        Assert-Equal $taskSpec.Arguments.Contains('telegram') $false 'does not place Telegram data in task arguments'

        $taskLifecycleEvents = [System.Collections.Generic.List[string]]::new()
        Install-WatchdogTask `
            -TaskSpec $taskSpec `
            -RegisterTask {
                param($Spec)
                [void]$taskLifecycleEvents.Add('register')
            } `
            -GetTask {
                param($TaskName)
                [void]$taskLifecycleEvents.Add('readback')
                [pscustomobject]@{
                    TaskName = $taskSpec.TaskName
                    Execute = $taskSpec.Execute
                    Arguments = $taskSpec.Arguments
                    AtLogOn = $true
                    RepetitionIntervalHours = 4
                    MultipleInstances = 'IgnoreNew'
                    StartWhenAvailable = $true
                    ExecutionTimeLimitMinutes = 10
                    RunLevel = 'Limited'
                    LogonType = 'Interactive'
                    UserId = $taskSpec.UserId
                }
            } `
            -UnregisterTask {
                param($TaskName)
                [void]$taskLifecycleEvents.Add('unexpected-rollback')
            }
        Assert-Equal @($taskLifecycleEvents) @('register', 'readback') 'registers and verifies the exact task'

        $rollbackEvents = [System.Collections.Generic.List[string]]::new()
        Assert-Throws {
            Install-WatchdogTask `
                -TaskSpec $taskSpec `
                -RegisterTask {
                    param($Spec)
                    [void]$rollbackEvents.Add('register')
                } `
                -GetTask {
                    param($TaskName)
                    [void]$rollbackEvents.Add('readback')
                    [pscustomobject]@{
                        TaskName = $taskSpec.TaskName
                        Execute = $taskSpec.Execute
                        Arguments = $taskSpec.Arguments
                        AtLogOn = $true
                        RepetitionIntervalHours = 1
                        MultipleInstances = 'IgnoreNew'
                        StartWhenAvailable = $true
                        ExecutionTimeLimitMinutes = 10
                        RunLevel = 'Limited'
                        LogonType = 'Interactive'
                        UserId = $taskSpec.UserId
                    }
                } `
                -UnregisterTask {
                    param($TaskName)
                    [void]$rollbackEvents.Add("rollback:$TaskName")
                }
        } 'rolls back a task whose read-back differs from the spec'
        Assert-Equal @($rollbackEvents) @(
            'register',
            'readback',
            'rollback:Pixiu DevSpace Watchdog'
        ) 'removes only the mismatched fixed task'

        $installPaths = Get-WatchdogPaths -StateRoot (Join-Path $testRoot 'install-watchdog')
        $installToken = ConvertTo-SecureString `
            -String ([guid]::NewGuid().ToString('N') + ':' + [guid]::NewGuid().ToString('N')) `
            -AsPlainText `
            -Force
        $installEvents = [System.Collections.Generic.List[string]]::new()
        $capturedConfig = $null
        $duplicateHosts = @($processRecords | Where-Object { $_.ProcessId -in @(18636, 26016) })
        Install-Watchdog -Dependencies @{
            Paths = $installPaths
            ScriptPath = 'C:\PixiuCore\scripts\devspace-portable\devspace-watchdog.ps1'
            UserId = 'MACHINE\user'
            GetNow = { [datetime]'2026-07-29T10:00:00Z' }
            ReadSecureToken = { $installToken }
            ReadChatId = { '-1001234567890' }
            WriteConfig = {
                param($Config)
                $script:capturedConfig = $Config
                [void]$installEvents.Add('config:write')
            }
            ApplyAcl = {
                [void]$installEvents.Add('acl:apply')
            }
            ReadConfig = {
                [void]$installEvents.Add('config:readback')
                return $script:capturedConfig
            }
            ReadSettings = {
                [void]$installEvents.Add('settings:read')
                return [pscustomobject]$validSettings
            }
            GetProcessRecords = {
                [void]$installEvents.Add('processes:list')
                return $duplicateHosts
            }
            ConfirmCleanup = {
                param($Matches)
                [void]$installEvents.Add("cleanup:confirm:$(@($Matches).Count)")
                return $true
            }
            NormalizeHosts = {
                param($Settings)
                [void]$installEvents.Add("cleanup:normalize:$($Settings.tunnelId)")
            }
            InstallTask = {
                param($Spec)
                [void]$installEvents.Add("task:install:$($Spec.TaskName)")
            }
            RunOnce = {
                [void]$installEvents.Add('run:once')
            }
        }
        Assert-Equal @($installEvents) @(
            'config:write',
            'acl:apply',
            'config:readback',
            'settings:read',
            'processes:list',
            'cleanup:confirm:2',
            'cleanup:normalize:devspace-mcp-pop15.jpe1',
            'task:install:Pixiu DevSpace Watchdog',
            'run:once'
        ) 'installs only after secret read-back and confirmed host normalization'

        $aclFailureEvents = [System.Collections.Generic.List[string]]::new()
        Assert-Throws {
            Install-Watchdog -Dependencies @{
                Paths = $installPaths
                ScriptPath = 'C:\PixiuCore\scripts\devspace-portable\devspace-watchdog.ps1'
                UserId = 'MACHINE\user'
                GetNow = { [datetime]'2026-07-29T10:00:00Z' }
                ReadSecureToken = { $installToken }
                ReadChatId = { '-1001234567890' }
                WriteConfig = {
                    param($Config)
                    $script:capturedConfig = $Config
                    [void]$aclFailureEvents.Add('config:write')
                }
                ApplyAcl = {
                    [void]$aclFailureEvents.Add('acl:fail')
                    throw 'simulated ACL failure'
                }
                InstallTask = {
                    [void]$aclFailureEvents.Add('unexpected-task')
                }
            }
        } 'fails closed when the Watchdog ACL cannot be applied'
        Assert-Equal @($aclFailureEvents) @('config:write', 'acl:fail') 'does not register a task after ACL failure'

        $readBackFailureEvents = [System.Collections.Generic.List[string]]::new()
        Assert-Throws {
            Install-Watchdog -Dependencies @{
                Paths = $installPaths
                ScriptPath = 'C:\PixiuCore\scripts\devspace-portable\devspace-watchdog.ps1'
                UserId = 'MACHINE\user'
                GetNow = { [datetime]'2026-07-29T10:00:00Z' }
                ReadSecureToken = { $installToken }
                ReadChatId = { '-1001234567890' }
                WriteConfig = { param($Config) }
                ApplyAcl = { }
                ReadConfig = {
                    [pscustomobject]@{
                        schemaVersion = 1
                        telegramChatId = '-1001234567890'
                        telegramBotTokenDpapi = 'invalid-dpapi'
                    }
                }
                InstallTask = {
                    [void]$readBackFailureEvents.Add('unexpected-task')
                }
            }
        } 'fails closed when DPAPI config read-back fails'
        Assert-Equal @($readBackFailureEvents) @() 'does not register a task after DPAPI read-back failure'

        $declinedEvents = [System.Collections.Generic.List[string]]::new()
        Assert-Throws {
            Install-Watchdog -Dependencies @{
                Paths = $installPaths
                ScriptPath = 'C:\PixiuCore\scripts\devspace-portable\devspace-watchdog.ps1'
                UserId = 'MACHINE\user'
                GetNow = { [datetime]'2026-07-29T10:00:00Z' }
                ReadSecureToken = { $installToken }
                ReadChatId = { '-1001234567890' }
                WriteConfig = { param($Config) $script:capturedConfig = $Config }
                ApplyAcl = { }
                ReadConfig = { $script:capturedConfig }
                ReadSettings = { [pscustomobject]$validSettings }
                GetProcessRecords = { $duplicateHosts }
                ConfirmCleanup = {
                    [void]$declinedEvents.Add('cleanup:declined')
                    return $false
                }
                NormalizeHosts = {
                    [void]$declinedEvents.Add('unexpected-normalize')
                }
                InstallTask = {
                    [void]$declinedEvents.Add('unexpected-task')
                }
            }
        } 'does not install when duplicate-host cleanup is declined'
        Assert-Equal @($declinedEvents) @('cleanup:declined') 'does not normalize or register after cleanup refusal'

        $status = Get-WatchdogStatus -Dependencies @{
            GetTask = {
                [pscustomobject]@{
                    TaskName = 'Pixiu DevSpace Watchdog'
                    State = 'Ready'
                }
            }
            ReadState = {
                [pscustomobject]@{
                    status = 'healthy'
                    lastErrorCategory = $null
                    lastCheckAtUtc = '2026-07-29T10:00:00Z'
                    publicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
                }
            }
        }
        Assert-Equal $status.TaskName 'Pixiu DevSpace Watchdog' 'returns the fixed task in Watchdog status'
        Assert-Equal $status.Status 'healthy' 'returns the last safe Watchdog state'
        Assert-Equal (($status | ConvertTo-Json -Compress).Contains('telegramBotTokenDpapi')) $false 'never exposes Telegram config in status'

        $removeEvents = [System.Collections.Generic.List[string]]::new()
        $cancelledRemoval = Remove-WatchdogInstallation -Paths $installPaths -Confirm {
            return $false
        } -UnregisterTask {
            [void]$removeEvents.Add('unexpected-task-remove')
        } -RemoveDirectory {
            [void]$removeEvents.Add('unexpected-directory-remove')
        }
        Assert-Equal $cancelledRemoval $false 'cancels Watchdog removal without side effects'
        Assert-Equal @($removeEvents) @() 'preserves task and settings after removal cancellation'

        $confirmedRemoval = Remove-WatchdogInstallation -Paths $installPaths -Confirm {
            return $true
        } -UnregisterTask {
            param($TaskName)
            [void]$removeEvents.Add("task:remove:$TaskName")
        } -RemoveDirectory {
            param($DirectoryPath)
            [void]$removeEvents.Add("directory:remove:$DirectoryPath")
        }
        Assert-Equal $confirmedRemoval $true 'confirms Watchdog removal'
        Assert-Equal @($removeEvents) @(
            'task:remove:Pixiu DevSpace Watchdog',
            "directory:remove:$($installPaths.Root)"
        ) 'removes only the fixed task and Watchdog directory'
    }

    $wrapperActions = [ordered]@{
        '10-INSTALL-WATCHDOG.cmd' = 'install'
        '11-WATCHDOG-STATUS.cmd' = 'status'
        '12-RUN-WATCHDOG-NOW.cmd' = 'run'
        '13-REMOVE-WATCHDOG.cmd' = 'remove'
    }
    $portableRoot = Split-Path -Parent $watchdogPath
    $missingWrappers = @($wrapperActions.Keys | Where-Object {
        -not (Test-Path -LiteralPath (Join-Path $portableRoot $_))
    })
    if ($missingWrappers.Count -gt 0) {
        Write-Host '[FAIL] Watchdog CMD wrappers exist' -ForegroundColor Red
        Write-Host "  missing: $($missingWrappers -join ', ')"
        $script:Failed++
    }
    else {
        $fakePowerShellRoot = Join-Path $testRoot 'fake-powershell'
        New-Item -ItemType Directory -Path $fakePowerShellRoot -Force | Out-Null
        $fakePowerShell = Join-Path $fakePowerShellRoot 'powershell.cmd'
        [System.IO.File]::WriteAllText(
            $fakePowerShell,
            @'
@echo off
> "%WATCHDOG_WRAPPER_MARKER%" echo %*
exit /b 23
'@,
            [System.Text.UTF8Encoding]::new($false)
        )

        $previousPath = $env:Path
        $previousMarker = $env:WATCHDOG_WRAPPER_MARKER
        try {
            $env:Path = "$fakePowerShellRoot;$previousPath"
            foreach ($entry in $wrapperActions.GetEnumerator()) {
                $wrapperPath = Join-Path $portableRoot $entry.Key
                $markerPath = Join-Path $testRoot "$($entry.Value)-wrapper.marker"
                $env:WATCHDOG_WRAPPER_MARKER = $markerPath
                $command = "(echo.)|`"$wrapperPath`""
                & $env:ComSpec /d /c $command 2>&1 | Out-Null
                $wrapperExitCode = $LASTEXITCODE
                $arguments = [System.IO.File]::ReadAllText($markerPath)
                Assert-Equal $wrapperExitCode 23 "$($entry.Value) wrapper preserves the PowerShell exit code"
                Assert-Equal $arguments.Contains("-File `"$watchdogPath`" $($entry.Value)") $true "$($entry.Value) wrapper invokes the colocated Watchdog action"
            }
        }
        finally {
            $env:Path = $previousPath
            $env:WATCHDOG_WRAPPER_MARKER = $previousMarker
        }
    }

    $commandFunctions = @(
        'Invoke-WatchdogConnectorFailure',
        'Invoke-WatchdogTestTelegram'
    )
    $missingCommandFunctions = @($commandFunctions | Where-Object {
        -not (Get-Command $_ -ErrorAction SilentlyContinue)
    })
    if ($missingCommandFunctions.Count -gt 0) {
        Write-Host '[FAIL] fixed Connector and Telegram command functions exist' -ForegroundColor Red
        Write-Host "  missing: $($missingCommandFunctions -join ', ')"
        $script:Failed++
    }
    else {
        $connectorMessages = [System.Collections.Generic.List[string]]::new()
        $connectorStates = [System.Collections.Generic.List[object]]::new()
        $connectorDependencies = @{
            AcquireMutex = {
                [pscustomobject]@{ Acquired = $true; Release = { } }
            }
            GetNow = { [datetime]'2026-07-29T00:00:00Z' }
            ReadState = {
                [pscustomobject]@{
                    status = 'healthy'
                    lastErrorCategory = $null
                    lastConnectorFailureNotifiedAtUtc = $null
                    publicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
                }
            }
            WriteState = {
                param($State)
                [void]$connectorStates.Add($State)
            }
            ReadConfig = { $telegramConfig }
            SendMessage = {
                param($Config, $Message)
                [void]$connectorMessages.Add([string]$Message.Kind)
                [pscustomobject]@{ Delivered = $true; ErrorCategory = $null; StatusCode = 200 }
            }
            MachineName = 'TEST-MACHINE'
        }
        $connectorResult = Invoke-WatchdogConnectorFailure -Dependencies $connectorDependencies
        Assert-Equal $connectorResult.Delivered $true 'sends the fixed ConnectorFailure notification'
        Assert-Equal @($connectorMessages) @('ConnectorFailure') 'does not accept arbitrary Connector notification content'
        Assert-Equal $connectorStates.Count 1 'persists the Connector notification cooldown'

        $connectorMessages.Clear()
        $connectorDependencies.ReadState = {
            return $connectorStates[0]
        }
        $connectorDependencies.GetNow = { [datetime]'2026-07-29T03:59:59Z' }
        $deduplicatedConnector = Invoke-WatchdogConnectorFailure -Dependencies $connectorDependencies
        Assert-Equal $deduplicatedConnector.Deduplicated $true 'deduplicates the fixed Connector command within four hours'
        Assert-Equal @($connectorMessages) @() 'does not send a duplicate Connector notification'

        $testMessages = [System.Collections.Generic.List[string]]::new()
        $testTelegramResult = Invoke-WatchdogTestTelegram -Dependencies @{
            ReadConfig = { $telegramConfig }
            ReadState = {
                [pscustomobject]@{
                    status = 'healthy'
                    publicBaseUrl = 'https://dxrpsqgc-7678.jpe1.devtunnels.ms'
                }
            }
            GetNow = { [datetime]'2026-07-29T00:00:00Z' }
            MachineName = 'TEST-MACHINE'
            SendMessage = {
                param($Config, $Message)
                [void]$testMessages.Add([string]$Message.Kind)
                [pscustomobject]@{ Delivered = $true; ErrorCategory = $null; StatusCode = 200 }
            }
        }
        Assert-Equal $testTelegramResult.Delivered $true 'sends a fixed Telegram test notification'
        Assert-Equal @($testMessages) @('Test') 'does not accept arbitrary Telegram test text'

        $dispatchEvents = [System.Collections.Generic.List[string]]::new()
        $handlers = @{
            install = { [void]$dispatchEvents.Add('install') }
            run = { [void]$dispatchEvents.Add('run') }
            status = { [void]$dispatchEvents.Add('status') }
            remove = { [void]$dispatchEvents.Add('remove') }
            'notify-connector-failure' = { [void]$dispatchEvents.Add('notify-connector-failure') }
            'test-telegram' = { [void]$dispatchEvents.Add('test-telegram') }
        }
        foreach ($watchdogAction in @(
            'install',
            'run',
            'status',
            'remove',
            'notify-connector-failure',
            'test-telegram'
        )) {
            Invoke-WatchdogMain -Action $watchdogAction -CommandHandlers $handlers
        }
        Assert-Equal @($dispatchEvents) @(
            'install',
            'run',
            'status',
            'remove',
            'notify-connector-failure',
            'test-telegram'
        ) 'dispatches only the six fixed Watchdog actions'
    }
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
