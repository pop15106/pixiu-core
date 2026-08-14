# DevSpace Windows Watchdog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一個以目前 Windows 使用者執行的 DevSpace Watchdog，在登入時與每 4 小時檢查本機及公開 `/healthz`，故障時只針對設定的 tunnel ID 執行一次受控復原，並以 DPAPI 保護既有 Telegram Bot Token，只在異常、錯誤分類改變與恢復時通知。

**Architecture:** 以獨立 `devspace-watchdog.ps1` 管理檢查、狀態、排程與通知，透過受限的相依注入測試所有外部副作用；既有 OneClick 維持唯一的 DevSpace 啟停入口。Watchdog 呼叫 OneClick 時設定非互動環境旗標，讓 Dev Tunnel 登出或登入競態只能安全失敗，不會開啟瀏覽器。Codex heartbeat 另負責 DevSpace Secure 的 OAuth／Connector 端對端檢查。

**Tech Stack:** Windows PowerShell 5.1、Windows Task Scheduler ScheduledTasks module、Windows DPAPI CurrentUser、Windows ACL、Microsoft Dev Tunnel CLI、Telegram Bot API、既有 DevSpace OneClick PowerShell modules、自製無外部套件測試 harness。

## Global Constraints

- 全部使用者可見文字、README 與通知使用繁體中文；固定 error category 使用英文 enum，避免把任意例外文字送入外部系統。
- 不安裝 Pester、npm、NuGet 或其他新依賴；測試沿用現有 `Assert-Equal`／`Assert-Throws` 風格。
- 支援 Windows PowerShell 5.1；不得使用 PowerShell 7 專屬語法。
- Watchdog 只讀 `%LOCALAPPDATA%\DevSpaceOneClick\settings.json` 與必要的 OneClick runtime，不讀任何專案檔案。
- Watchdog 只能管理 `devtunnel.exe host` 後方參數與 `settings.json.tunnelId` 精確相等的程序；`host -p 8791`、其他 tunnel ID、解析失敗或身分重新驗證失敗的程序一律忽略。
- Watchdog 不得代填或保存 Owner password、Microsoft 登入、ChatGPT OAuth、access token 或任何帳號密碼。
- `DEVSPACE_OAUTH_AUTO_APPROVE_CHATGPT=1` 保持不變，但不視為登入自動化授權。
- Bot Token 只以目前 Windows 使用者的 DPAPI 格式保存；不得出現在 repository、Task Scheduler arguments、日誌、狀態、例外輸出或測試輸出。
- OneClick 的排程呼叫必須設定 `DEVSPACE_ONECLICK_NONINTERACTIVE=1`；此模式若未登入 Dev Tunnel，必須在執行 `devtunnel user login` 前失敗。
- 健康檢查或復原單次執行最多 8 分鐘；Task Scheduler `ExecutionTimeLimit` 為 10 分鐘；復原最多一次。
- Task 固定名為 `Pixiu DevSpace Watchdog`，`MultipleInstances=IgnoreNew`、`StartWhenAvailable=true`、目前使用者、Interactive Token、最低權限。
- 日誌為 UTF-8、單檔最多 1 MiB、保留 5 份；只記錄 correlation ID、狀態、分類、時間與無認證的 public origin。
- 所有 JSON 寫入採同目錄暫存檔後原子替換；不得留下半寫入的設定或狀態。
- 自動測試不得連真實 Telegram、不得停止真實程序、不得建立真實 Task Scheduler task。
- 真實 Token 輸入、Telegram 測試通知、PID 整理、DevSpace 重啟、排程註冊及 Codex automation 更新都屬受控實測；執行前需再次顯示目標與取得使用者確認。
- PixiuCore 現有工作樹有其他未完成變更；每一步只 stage 本計畫列出的檔案。未取得明確授權不得 commit、push、merge 或 deploy。
- 不啟用 Agent Team；若使用者之後選擇 subagent-driven execution，必須另取得明確派工批准並遵循 mothership dispatch governance。

---

## File Map

### 修改

- `scripts/devspace-portable/DevSpace.OneClick.Platform.psm1`：為 `Ensure-DevTunnelLogin` 增加非互動拒絕分支，封住 Watchdog 執行期間的登入競態。
- `scripts/devspace-portable/tests/run-tests.ps1`：加入非互動登入護欄的回歸測試。
- `scripts/devspace-portable/README.zh-TW.md`：補上 Watchdog 安裝、狀態、手動執行、移除、安全邊界與故障排除。

### 建立

- `scripts/devspace-portable/devspace-watchdog.ps1`：唯一 Watchdog 入口；支援 `install`、`run`、`status`、`remove`、`notify-connector-failure`、`test-telegram`。
- `scripts/devspace-portable/10-INSTALL-WATCHDOG.cmd`：互動設定 Telegram、顯示指定 tunnel 的整理計畫、確認後安裝 task。
- `scripts/devspace-portable/11-WATCHDOG-STATUS.cmd`：顯示 task、最近狀態與安全摘要。
- `scripts/devspace-portable/12-RUN-WATCHDOG-NOW.cmd`：手動執行一次完整檢查。
- `scripts/devspace-portable/13-REMOVE-WATCHDOG.cmd`：確認後只移除固定 task 與 Watchdog 本機設定。
- `scripts/devspace-portable/tests/run-watchdog-tests.ps1`：純函式、狀態機、復原編排、Task spec、DPAPI 與 redaction 測試。

### 不修改

- `scripts/devspace-portable/devspace-oneclick.ps1`：仍是 `start`／`stop` 唯一實作者。
- `%USERPROFILE%\.devspace\auth.json`：Owner password 不在 Watchdog 範圍。
- 任一專案目錄與 DevSpace Secure workspace：Watchdog 不讀取、不修改。

---

## Public Interfaces and Data Contracts

### CLI

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\devspace-portable\devspace-watchdog.ps1 `
  status
```

- 最後一個參數必須是 `install`、`run`、`status`、`remove`、`notify-connector-failure` 或 `test-telegram` 其中之一。
- `install`：互動輸入 Telegram secret、套 ACL、確認指定 tunnel 的程序整理、註冊排程、立即執行一次。
- `run`：取得 mutex，檢查本機與公開 health，必要時最多復原一次，更新 state 與狀態轉換通知。
- `status`：唯讀顯示 task 與最近狀態；永不解密或顯示 Bot Token。
- `remove`：互動確認後移除固定 task 與 `%LOCALAPPDATA%\DevSpaceOneClick\watchdog`；不停止 DevSpace、不刪 OneClick 設定。
- `notify-connector-failure`：固定 `ConnectorFailure` 事件，不接受訊息、URL、命令或 error text 參數。
- `test-telegram`：送固定測試文字，不接受任意文字。

### Watchdog config

```json
{
  "schemaVersion": 1,
  "telegramChatId": "-1001234567890",
  "telegramBotTokenDpapi": "AQAAANCMnd8BFdERjHoAwE_Cl_sBAAAA"
}
```

### Watchdog state

```json
{
  "schemaVersion": 1,
  "status": "healthy",
  "lastErrorCategory": null,
  "lastNotifiedStatus": "healthy",
  "lastNotifiedErrorCategory": null,
  "lastCheckAtUtc": "2026-07-29T00:00:00.0000000Z",
  "lastRecoveryAtUtc": null,
  "lastConnectorFailureNotifiedAtUtc": null,
  "publicBaseUrl": "https://example-7678.jpe1.devtunnels.ms"
}
```

### Fixed error categories

```text
SettingsMissing
SettingsInvalid
LocalHealthFailed
PublicOriginInvalid
PublicHealthFailed
DevTunnelNotLoggedIn
OneClickStopRefused
TunnelProcessMismatch
OneClickStartFailed
PostRecoveryHealthFailed
TelegramConfigInvalid
TelegramDeliveryFailed
ConnectorFailure
MutexBusy
RunTimedOut
```

---

### Task 1: Add the non-interactive Dev Tunnel login safety fence

**Files:**

- Modify: `scripts/devspace-portable/tests/run-tests.ps1`
- Modify: `scripts/devspace-portable/DevSpace.OneClick.Platform.psm1`

**Interface:**

- `Ensure-DevTunnelLogin -DevTunnel [string]` 保持原介面。
- 新環境契約：`DEVSPACE_ONECLICK_NONINTERACTIVE=1` 且 `user show` 不是 `Logged in` 時，拋出固定人工登入錯誤，絕不呼叫 `user login`。

- [ ] **Step 1: Write the failing non-interactive login regression test**

在現有測試暫存目錄建立 fake `devtunnel.cmd`；`user show -j` 回傳 `{"status":"Logged out"}`，若收到 `user login` 則寫 marker file。測試必須使用 `try/finally` 還原環境變數。

```powershell
$previousNonInteractive = $env:DEVSPACE_ONECLICK_NONINTERACTIVE
try {
    $env:DEVSPACE_ONECLICK_NONINTERACTIVE = '1'
    Assert-Throws {
        Ensure-DevTunnelLogin -DevTunnel $fakeLoggedOutDevTunnel
    } 'non-interactive login check refuses browser login'
    Assert-Equal (Test-Path -LiteralPath $loginMarker) $false `
        'non-interactive login check never invokes user login'
}
finally {
    $env:DEVSPACE_ONECLICK_NONINTERACTIVE = $previousNonInteractive
}
```

- [ ] **Step 2: Run the existing test suite and verify RED**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\devspace-portable\tests\run-tests.ps1
```

Expected: FAIL because current `Ensure-DevTunnelLogin` invokes the fake `user login` path.

- [ ] **Step 3: Implement the minimal refusal branch before browser login**

在 `Ensure-DevTunnelLogin` 完成 `user show` 嘗試後、顯示「瀏覽器將開啟」之前加入：

```powershell
if ($env:DEVSPACE_ONECLICK_NONINTERACTIVE -eq '1') {
    throw 'Microsoft Dev Tunnel is not logged in. Interactive login is required.'
}
```

不要改變一般 OneClick 手動安裝的既有互動登入行為。

- [ ] **Step 4: Run the existing test suite and verify GREEN**

Run: 與 Step 2 相同。

Expected: 所有既有測試與新增的非互動護欄測試通過；marker file 不存在。

---

### Task 2: Create the Watchdog test harness, settings validation, and health checks

**Files:**

- Create: `scripts/devspace-portable/tests/run-watchdog-tests.ps1`
- Create: `scripts/devspace-portable/devspace-watchdog.ps1`

**Interfaces:**

```powershell
Get-WatchdogPaths -StateRoot [string]
Read-WatchdogJson -FilePath [string]
Write-WatchdogJsonAtomic -FilePath [string] -Value [object]
Get-ValidatedOneClickSettings -SettingsPath [string] -MachineName [string]
Test-WatchdogHealth -Url [uri] -InvokeHttp [scriptblock]
Get-ValidatedPublicOrigin -Settings [object] -TunnelDocument [object]
```

- `Test-WatchdogHealth` 回傳 `{ Healthy, Category, StatusCode }`，只有 HTTP 成功且 JSON `ok == true`、`name == "devspace"` 時為 healthy。
- `Get-ValidatedPublicOrigin` 使用既有 `Get-TunnelPublicBaseUrl` 取得指定 tunnel/port 的權威 origin，再與 settings 的 origin 做 ordinal-ignore-case 精確比較。

- [ ] **Step 1: Create the harness and write failing health/settings tests**

測試檔先實作本地 `Assert-Equal`、`Assert-Throws`、pass/fail 計數及安全 temp cleanup，然後 dot-source 尚未存在的 Watchdog：

```powershell
$watchdogPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'devspace-watchdog.ps1'
. $watchdogPath
```

涵蓋：

```powershell
Assert-Equal (Test-WatchdogHealth -Url 'http://127.0.0.1:7678/healthz' -InvokeHttp {
    [pscustomobject]@{ Body = [pscustomobject]@{ ok = $true; name = 'devspace' }; StatusCode = 200 }
}).Healthy $true 'accepts exact DevSpace health payload'

Assert-Equal (Test-WatchdogHealth -Url 'http://127.0.0.1:7678/healthz' -InvokeHttp {
    [pscustomobject]@{ Body = [pscustomobject]@{ ok = $true; name = 'other' }; StatusCode = 200 }
}).Healthy $false 'rejects wrong service name'

Assert-Throws {
    Get-ValidatedOneClickSettings -SettingsPath $missingPath -MachineName $env:COMPUTERNAME
} 'rejects missing OneClick settings'
```

另測錯誤 JSON、HTTP exception、錯誤 machine、port 範圍、非 HTTPS、非 `*.devtunnels.ms`、含 `/mcp` path、query/fragment、settings origin 與 tunnel query origin 不一致。

- [ ] **Step 2: Run Watchdog tests and verify RED**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\devspace-portable\tests\run-watchdog-tests.ps1
```

Expected: FAIL because `devspace-watchdog.ps1` does not exist.

- [ ] **Step 3: Implement the entrypoint skeleton and pure validation functions**

入口參數固定：

```powershell
[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet('install', 'run', 'status', 'remove', 'notify-connector-failure', 'test-telegram')]
    [string]$Action = 'status'
)
```

匯入既有 modules：

```powershell
Import-Module (Join-Path $PSScriptRoot 'DevSpace.OneClick.Core.psm1') -Force
Import-Module (Join-Path $PSScriptRoot 'DevSpace.OneClick.Platform.psm1') -Force -DisableNameChecking
```

測試以 dot-source 載入函式；只有直接執行時 dispatch：

```powershell
if ($MyInvocation.InvocationName -ne '.') {
    Invoke-WatchdogMain -Action $Action
}
```

預設 HTTP adapter 必須將 URI 與例外留在記憶體，不把完整 exception 或 Telegram URI交給 logger：

```powershell
$response = Invoke-RestMethod -UseBasicParsing -Uri $Url -TimeoutSec 8
[pscustomobject]@{ Body = $response; StatusCode = 200 }
```

- [ ] **Step 4: Run Watchdog tests and verify GREEN**

Run: 與 Step 2 相同。

Expected: settings、origin 與 health 測試全部通過。

---

### Task 3: Implement exact tunnel identity, login checks, and cleanup planning

**Files:**

- Modify: `scripts/devspace-portable/tests/run-watchdog-tests.ps1`
- Modify: `scripts/devspace-portable/devspace-watchdog.ps1`

**Interfaces:**

```powershell
Test-WatchdogDevTunnelLogin -DevTunnel [string] -InvokeNativeJson [scriptblock]
Get-MatchingDevTunnelProcesses -TunnelId [string] -ProcessRecords [object[]]
New-TunnelCleanupPlan -TunnelId [string] -ProcessRecords [object[]] -KeepProcessId [Nullable[int]]
Invoke-TunnelCleanupPlan -Plan [object[]] -GetProcessRecord [scriptblock] -StopProcess [scriptblock]
```

- `Get-MatchingDevTunnelProcesses` 對每個 CIM record 呼叫既有 `Get-DevTunnelHostProcessIdentity`，只回傳 `TunnelId` ordinal-ignore-case 精確相等者。
- Cleanup plan 每筆保存 PID、CreationDate/StartedAtUtc、TunnelId 與原命令列摘要；實際停止前必須重新取得同 PID 並再次解析、比對開始時間與 tunnel ID，防止 PID reuse。
- `KeepProcessId` 若存在且身分仍匹配則保留；其餘精確重複項才列入 Stop。

- [ ] **Step 1: Write failing tunnel identity and login tests**

使用這三筆 fixture：

```powershell
$records = @(
    [pscustomobject]@{
        Name='devtunnel.exe'; ProcessId=18636; ParentProcessId=1
        CommandLine='devtunnel.exe host devspace-mcp-pop15.jpe1'
        StartedAtUtc='2026-07-29T00:00:00Z'
    },
    [pscustomobject]@{
        Name='devtunnel.exe'; ProcessId=26016; ParentProcessId=1
        CommandLine='"C:\Tools\devtunnel.exe" host "devspace-mcp-pop15.jpe1"'
        StartedAtUtc='2026-07-29T00:01:00Z'
    },
    [pscustomobject]@{
        Name='devtunnel.exe'; ProcessId=3716; ParentProcessId=1
        CommandLine='devtunnel.exe host -p 8791 -a -e 1h'
        StartedAtUtc='2026-07-29T00:02:00Z'
    }
)
```

斷言只有 18636、26016 命中；3716 不命中。另測相似 tunnel ID、空 command line、非 devtunnel process、PID reuse、開始時間漂移、重新驗證時命令列改變均不得停止。

登入測試：

```powershell
Assert-Equal (Test-WatchdogDevTunnelLogin -DevTunnel 'fake' -InvokeNativeJson {
    [pscustomobject]@{ status = 'Logged in' }
}) $true 'accepts logged-in Dev Tunnel'

Assert-Equal (Test-WatchdogDevTunnelLogin -DevTunnel 'fake' -InvokeNativeJson {
    [pscustomobject]@{ status = 'Logged out' }
}) $false 'refuses logged-out Dev Tunnel without login side effect'
```

- [ ] **Step 2: Run matching tests and verify RED**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\devspace-portable\tests\run-watchdog-tests.ps1
```

Expected: FAIL because tunnel/login functions do not exist.

- [ ] **Step 3: Implement exact matching and revalidation**

禁止自行以寬鬆 regex 停程序；重用 exported parser：

```powershell
try {
    $identity = Get-DevTunnelHostProcessIdentity -ProcessRecord $record
}
catch {
    continue
}
if ([string]::Equals(
    [string]$identity.TunnelId,
    $TunnelId,
    [System.StringComparison]::OrdinalIgnoreCase
)) {
    $matches += $identity
}
```

`Test-WatchdogDevTunnelLogin` 只能執行 `user show -j`，不得呼叫 `Ensure-DevTunnelLogin` 或 `user login`。

- [ ] **Step 4: Run Watchdog tests and verify GREEN**

Expected: 精確 tunnel、PID reuse、login side-effect-free 測試全部通過。

---

### Task 4: Implement DPAPI config, ACL, safe logging, and notification state

**Files:**

- Modify: `scripts/devspace-portable/tests/run-watchdog-tests.ps1`
- Modify: `scripts/devspace-portable/devspace-watchdog.ps1`

**Interfaces:**

```powershell
Protect-WatchdogToken -SecureToken [SecureString]
Unprotect-WatchdogToken -CipherText [string]
Set-WatchdogAcl -DirectoryPath [string] -FilePaths [string[]]
Write-WatchdogLog -Paths [object] -CorrelationId [guid] -Event [string] -Data [object]
Get-WatchdogNotificationDecision -PreviousState [object] -CurrentResult [object]
Send-WatchdogTelegram -Config [object] -Message [object] -InvokeTelegram [scriptblock]
Register-ConnectorFailure -State [object] -Now [datetime]
```

**Notification rules:**

```text
unknown -> healthy                           no send
unknown/healthy -> unhealthy                 send anomaly
unhealthy -> unhealthy, same category        no send
unhealthy -> unhealthy, changed category     send anomaly
unhealthy -> healthy                         send recovery
ConnectorFailure within 4-hour cooldown      no duplicate
ConnectorFailure after cooldown              send fixed connector anomaly
```

- [ ] **Step 1: Write failing DPAPI, ACL, redaction, and transition tests**

測試：

- DPAPI round-trip 在目前測試使用者下還原同一 token。
- `config.json`、state、log、Task spec 與 console capture 均不含明文 token。
- 缺少 config 或 DPAPI 解密失敗時不覆寫原檔。
- ACL builder 只包含目前 user SID 與 `S-1-5-18` (`SYSTEM`)，並關閉 inheritance。
- log rotation 在 1 MiB 前不動作，達門檻後最多保留 5 份。
- 所有狀態轉換符合上表。
- `Register-ConnectorFailure` 不接受 error text；第二次 4 小時內不通知。

代表性斷言：

```powershell
$decision = Get-WatchdogNotificationDecision `
    -PreviousState ([pscustomobject]@{ status='healthy'; lastErrorCategory=$null }) `
    -CurrentResult ([pscustomobject]@{ status='unhealthy'; errorCategory='PublicHealthFailed' })
Assert-Equal $decision.Kind 'Anomaly' 'notifies healthy to unhealthy'

$duplicate = Get-WatchdogNotificationDecision `
    -PreviousState ([pscustomobject]@{ status='unhealthy'; lastErrorCategory='PublicHealthFailed' }) `
    -CurrentResult ([pscustomobject]@{ status='unhealthy'; errorCategory='PublicHealthFailed' })
Assert-Equal $duplicate.Kind 'None' 'deduplicates same unhealthy category'
```

- [ ] **Step 2: Run Watchdog tests and verify RED**

Expected: FAIL because secret/state/log functions do not exist.

- [ ] **Step 3: Implement CurrentUser DPAPI and ACL fail-closed behavior**

使用 PowerShell 5.1 內建的 SecureString DPAPI：

```powershell
$cipherText = ConvertFrom-SecureString -SecureString $SecureToken
$secureToken = ConvertTo-SecureString -String $CipherText
```

僅在傳送 adapter 內短暫轉為 plaintext，並在 `finally` 呼叫 `ZeroFreeBSTR`。ACL 套用失敗時，`install` 必須在排程註冊前停止。

Telegram adapter 只接收固定結構訊息，在 catch 中回傳：

```powershell
[pscustomobject]@{
    Delivered = $false
    ErrorCategory = 'TelegramDeliveryFailed'
    StatusCode = $safeStatusCode
}
```

不得回傳或記錄 exception URI、response body 或 token。

- [ ] **Step 4: Run Watchdog tests and verify GREEN**

Expected: DPAPI、ACL spec、log rotation、secret scan、狀態轉換與 Connector cooldown 測試全部通過。

---

### Task 5: Implement one-shot recovery orchestration, mutex, and timeout

**Files:**

- Modify: `scripts/devspace-portable/tests/run-watchdog-tests.ps1`
- Modify: `scripts/devspace-portable/devspace-watchdog.ps1`

**Interfaces:**

```powershell
New-WatchdogDependencies
Invoke-OneClickAction -Action [ValidateSet('start','stop')] -Dependencies [hashtable]
Invoke-WatchdogProbe -Settings [object] -Dependencies [hashtable]
Invoke-WatchdogRecovery -InitialProbe [object] -Dependencies [hashtable]
Invoke-WatchdogRun -Dependencies [hashtable]
Enter-WatchdogMutex -Name 'Local\Pixiu.DevSpace.Watchdog'
```

`New-WatchdogDependencies` 是唯一接觸 HTTP、CIM、process stop、OneClick subprocess、clock、sleep、Telegram 與 Task Scheduler 的位置。測試全部注入 fake scriptblocks。

**Recovery sequence:**

```text
probe local + authoritative public origin + public health
if healthy -> persist healthy -> transition notification
if unhealthy:
  verify devtunnel user show == Logged in
  invoke OneClick stop with DEVSPACE_ONECLICK_NONINTERACTIVE=1
  if stop fails -> stop recovery
  enumerate exact configured tunnel hosts
  revalidate each exact residual and stop it
  invoke OneClick start with DEVSPACE_ONECLICK_NONINTERACTIVE=1
  reread settings.json
  probe local + new authoritative public origin + public health once
  persist result -> transition notification
```

- [ ] **Step 1: Write failing orchestration tests**

以事件陣列記錄 fake dependencies 呼叫順序，涵蓋：

- 健康時不呼叫 stop/start。
- local down 或 public down 時只復原一次。
- 未登入時不呼叫 stop/start，結果為 `DevTunnelNotLoggedIn`。
- OneClick stop 拒絕後不清程序、不 start，結果為 `OneClickStopRefused`。
- cleanup 只停止精確 tunnel ID，忽略 PID 3716 的 `host -p 8791`。
- start 前環境包含 `DEVSPACE_ONECLICK_NONINTERACTIVE=1`。
- start 後重讀 settings 並使用新 `publicBaseUrl`。
- post-recovery 失敗不做第二次 recovery。
- mutex 未取得時退出且不送異常通知。
- fake clock 超過 8 分鐘時分類為 `RunTimedOut`，不再做副作用。
- Telegram 失敗不把已成功的服務復原改判為失敗。

代表性順序：

```powershell
Assert-Equal @($events) @(
    'probe:initial',
    'login:show',
    'oneclick:stop:noninteractive',
    'processes:list',
    'process:revalidate:26016',
    'process:stop:26016',
    'oneclick:start:noninteractive',
    'settings:reread',
    'probe:post-recovery'
) 'performs one bounded recovery in safe order'
```

- [ ] **Step 2: Run Watchdog tests and verify RED**

Expected: FAIL because recovery orchestration does not exist.

- [ ] **Step 3: Implement the minimal orchestration**

呼叫 OneClick 時不得組合 shell command string；以 executable + argument array 執行：

```powershell
$previousMode = $env:DEVSPACE_ONECLICK_NONINTERACTIVE
try {
    $env:DEVSPACE_ONECLICK_NONINTERACTIVE = '1'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass `
        -File $OneClickPath $Action
    if ($LASTEXITCODE -ne 0) {
        throw "OneClick $Action failed with exit code $LASTEXITCODE."
    }
}
finally {
    $env:DEVSPACE_ONECLICK_NONINTERACTIVE = $previousMode
}
```

錯誤轉換只能映射到固定 enum；原始例外僅可在記憶體中用於本次分類，不進 Telegram、state 或 log。

- [ ] **Step 4: Run Watchdog tests and verify GREEN**

Expected: 全部 recovery、mutex、timeout 與副作用順序測試通過。

---

### Task 6: Implement Task Scheduler lifecycle and CMD wrappers

**Files:**

- Modify: `scripts/devspace-portable/tests/run-watchdog-tests.ps1`
- Modify: `scripts/devspace-portable/devspace-watchdog.ps1`
- Create: `scripts/devspace-portable/10-INSTALL-WATCHDOG.cmd`
- Create: `scripts/devspace-portable/11-WATCHDOG-STATUS.cmd`
- Create: `scripts/devspace-portable/12-RUN-WATCHDOG-NOW.cmd`
- Create: `scripts/devspace-portable/13-REMOVE-WATCHDOG.cmd`

**Interfaces:**

```powershell
New-WatchdogTaskSpec -ScriptPath [string] -UserId [string] -StartAt [datetime]
Install-WatchdogTask -TaskSpec [object] -RegisterTask [scriptblock]
Get-WatchdogStatus -GetTask [scriptblock]
Remove-WatchdogInstallation -Confirm [scriptblock] -UnregisterTask [scriptblock]
Install-Watchdog -Dependencies [hashtable]
```

Task action arguments固定：

```text
-NoProfile -ExecutionPolicy Bypass -File "C:\PixiuCore\scripts\devspace-portable\devspace-watchdog.ps1" run
```

不含 Bot Token、Chat ID、Owner password、public URL 或任意錯誤文字。

- [ ] **Step 1: Write failing task spec and lifecycle tests**

驗證：

```powershell
$spec = New-WatchdogTaskSpec `
    -ScriptPath 'C:\PixiuCore\scripts\devspace-portable\devspace-watchdog.ps1' `
    -UserId 'MACHINE\user' `
    -StartAt ([datetime]'2026-07-29T10:00:00')

Assert-Equal $spec.TaskName 'Pixiu DevSpace Watchdog' 'uses fixed task name'
Assert-Equal $spec.RepetitionInterval.TotalHours 4 'runs every four hours'
Assert-Equal $spec.AtLogOn $true 'runs at current user logon'
Assert-Equal $spec.MultipleInstances 'IgnoreNew' 'ignores overlapping task runs'
Assert-Equal $spec.RunLevel 'Limited' 'uses least privilege'
Assert-Equal $spec.LogonType 'Interactive' 'uses current interactive token'
Assert-Equal $spec.ExecutionTimeLimit.TotalMinutes 10 'bounds task execution'
```

另測：

- install 先寫 config、套 ACL、通過 read-back，才註冊 task。
- ACL 失敗、secret read-back 失敗或使用者拒絕 PID 整理時不註冊 task。
- remove 只對固定 task name 與固定 watchdog directory 操作。
- remove 取消時不做任何變更。
- wrappers 都以 `%~dp0` 定位腳本並保留 exit code。

- [ ] **Step 2: Run Watchdog tests and verify RED**

Expected: FAIL because task lifecycle functions and wrappers do not exist.

- [ ] **Step 3: Implement Task Scheduler adapters**

ScheduledTasks 實作使用：

```powershell
$action = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument $TaskSpec.Arguments

$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $TaskSpec.UserId
$repeatTrigger = New-ScheduledTaskTrigger `
    -Once `
    -At $TaskSpec.StartAt `
    -RepetitionInterval (New-TimeSpan -Hours 4)

$principal = New-ScheduledTaskPrincipal `
    -UserId $TaskSpec.UserId `
    -LogonType Interactive `
    -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
```

註冊後立即 `Get-ScheduledTask` read-back，逐項驗證 action、兩個 trigger、4 小時間隔、principal 與 settings；不一致則解除剛建立的固定 task 並失敗。

- [ ] **Step 4: Create the four CMD wrappers**

`11-WATCHDOG-STATUS.cmd` 的完整模式：

```batch
@echo off
setlocal
title DevSpace Watchdog
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0devspace-watchdog.ps1" status
set "EXIT_CODE=%ERRORLEVEL%"
echo.
pause
exit /b %EXIT_CODE%
```

其餘三個 wrapper 只將最後的固定 action 分別改為 `install`、`run`、`remove`；不得透傳 `%*` 到 `notify-connector-failure` 或 Telegram。

- [ ] **Step 5: Run Watchdog tests and verify GREEN**

Expected: Task spec、安裝 fail-closed、移除範圍與 wrapper tests 全部通過，未建立真實 task。

---

### Task 7: Complete documentation, source audits, and full automated regression

**Files:**

- Modify: `scripts/devspace-portable/README.zh-TW.md`
- Modify only if a failing test demonstrates a defect:
  - `scripts/devspace-portable/devspace-watchdog.ps1`
  - `scripts/devspace-portable/tests/run-watchdog-tests.ps1`
  - `scripts/devspace-portable/DevSpace.OneClick.Platform.psm1`
  - `scripts/devspace-portable/tests/run-tests.ps1`

- [ ] **Step 1: Document daily operations and safety boundaries**

README 必須新增：

- `10-INSTALL-WATCHDOG.cmd` 安裝與本機 masked Token 輸入。
- `11-WATCHDOG-STATUS.cmd` 查看最近檢查、錯誤分類與 task。
- `12-RUN-WATCHDOG-NOW.cmd` 手動檢查。
- `13-REMOVE-WATCHDOG.cmd` 的精確移除範圍。
- `%LOCALAPPDATA%\DevSpaceOneClick\watchdog` 的 config/state/log 說明。
- Telegram 只在異常、分類改變與恢復時通知。
- Dev Tunnel／ChatGPT OAuth 失效時只通知，必須由使用者人工登入。
- `DEVSPACE_OAUTH_AUTO_APPROVE_CHATGPT=1` 的真正邊界。
- 如何辨識 `LocalHealthFailed`、`PublicHealthFailed`、`DevTunnelNotLoggedIn`、`ConnectorFailure`。
- Codex heartbeat 與本機 Watchdog 的責任分界。

- [ ] **Step 2: Run both automated suites**

Run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\devspace-portable\tests\run-tests.ps1

powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File .\scripts\devspace-portable\tests\run-watchdog-tests.ps1
```

Expected: 兩個 suite 都以 exit code 0 結束，0 failed。

- [ ] **Step 3: Run syntax and strict source audits**

Run:

```powershell
$errors = $null
[void][System.Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path '.\scripts\devspace-portable\devspace-watchdog.ps1'),
    [ref]$null,
    [ref]$errors
)
if ($errors.Count -gt 0) { $errors | Format-List; exit 1 }

rg -n --hidden --glob '!*.md' `
  '(bot[0-9]+:|ownerToken|access[_-]?token|DEVSPACE_OAUTH_AUTO_APPROVE_CHATGPT=0)' `
  .\scripts\devspace-portable
```

Expected:

- PowerShell parser 0 errors。
- secret scan 不出現任何真實 Bot Token 或 access token。
- `ownerToken` 只可存在既有 OneClick 程式與既有測試，不得出現在 Watchdog config/state/log/task argument 實作。
- Watchdog source 不包含 `devtunnel user login`、瀏覽器 automation 或 credential autofill。

- [ ] **Step 4: Inspect the scoped diff**

Run:

```powershell
git -c safe.directory=C:/PixiuCore -C C:\PixiuCore diff -- `
  scripts/devspace-portable/DevSpace.OneClick.Platform.psm1 `
  scripts/devspace-portable/tests/run-tests.ps1 `
  scripts/devspace-portable/devspace-watchdog.ps1 `
  scripts/devspace-portable/tests/run-watchdog-tests.ps1 `
  scripts/devspace-portable/10-INSTALL-WATCHDOG.cmd `
  scripts/devspace-portable/11-WATCHDOG-STATUS.cmd `
  scripts/devspace-portable/12-RUN-WATCHDOG-NOW.cmd `
  scripts/devspace-portable/13-REMOVE-WATCHDOG.cmd `
  scripts/devspace-portable/README.zh-TW.md
```

Expected: 只有本計畫列出的變更，沒有 Telegram secret、Owner password、專案內容、無關 refactor 或 debug code。

- [ ] **Step 5: Do not commit without explicit approval**

將測試結果與 scoped diff 摘要交給使用者。只有使用者明確要求 commit 時，才以精確檔案清單 stage；不得使用 `git add .`。

---

### Task 8: Perform the controlled local installation and live recovery test

**Files / external state:**

- Create after interactive input: `%LOCALAPPDATA%\DevSpaceOneClick\watchdog\config.json`
- Create after first run: `%LOCALAPPDATA%\DevSpaceOneClick\watchdog\state.json`
- Create/update: Windows Task Scheduler task `Pixiu DevSpace Watchdog`
- May stop/restart only the configured DevSpace stack and exact matching tunnel host PIDs

**Gate:** 本 Task 會保存本機加密 secret、送外部 Telegram 訊息、停止程序、重啟服務與建立排程。開始前再次向使用者顯示將進行的動作，並取得明確批准。Bot Token 由使用者在本機視窗輸入，Codex 不讀取、不回顯。

- [ ] **Step 1: Capture the pre-change evidence**

唯讀記錄：

```powershell
Get-Content -LiteralPath "$env:LOCALAPPDATA\DevSpaceOneClick\settings.json" -Raw
Get-ScheduledTask -TaskName 'Pixiu DevSpace Watchdog' -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='devtunnel.exe'" |
  Select-Object ProcessId, ParentProcessId, CreationDate, CommandLine
```

確認 settings 的 `tunnelId`、port 與 public origin；列出精確命中的 PIDs 與命令列，另列出但標示不會處理的 `host -p 8791`。

- [ ] **Step 2: Obtain explicit approval for installation and PID cleanup**

批准內容必須包含：

- 安裝固定 task。
- 使用者自行輸入並 DPAPI 保存既有 Telegram Bot Token／Chat ID。
- 停止列出的精確 tunnel ID 重複 PIDs。
- 受控 stop/start DevSpace。
- 發送固定 Telegram 測試、異常與恢復通知。

- [ ] **Step 3: Run the interactive installer**

由使用者在本機執行：

```text
C:\PixiuCore\scripts\devspace-portable\10-INSTALL-WATCHDOG.cmd
```

Expected:

- Token 遮蔽輸入。
- ACL read-back 成功。
- 顯示精確 cleanup plan 並再次確認。
- task read-back 顯示登入 trigger + 每 4 小時 trigger、IgnoreNew、Limited、Interactive。
- 明文 Token 不出現在 task、console、config、state 或 log。

- [ ] **Step 4: Verify live health and isolation**

Run:

```powershell
Invoke-RestMethod -UseBasicParsing `
  -Uri 'http://127.0.0.1:7678/healthz' `
  -TimeoutSec 8
```

從最新 `settings.json` 讀 `publicBaseUrl`，再驗證 `$settings.publicBaseUrl + '/healthz'`。重新列出 `devtunnel.exe`：

- 指定 tunnel ID 只剩一個 host。
- 無關 `host -p 8791` 的原 PID/開始時間仍存在。
- `state.json.status == healthy`。
- 穩定健康再次執行 `12-RUN-WATCHDOG-NOW.cmd` 不重複通知。

- [ ] **Step 5: Perform one controlled anomaly/recovery test**

在再次取得當下批准後，只使用既有 `04-STOP.cmd` 受控停止 OneClick，接著執行 `12-RUN-WATCHDOG-NOW.cmd`。

Expected:

- 異常通知一則。
- Watchdog 最多執行一次 stop/cleanup/start。
- 本機與最新公開 health 恢復。
- 恢復通知一則。
- 無關 tunnel 未停止。

- [ ] **Step 6: Verify logs and task history contain no secrets**

檢查 Watchdog 目錄、Scheduled Task XML/arguments 與最近日誌；搜尋明文 Bot Token 的動作只能由使用者在本機進行，不能把 Token 傳入 Codex 命令列。確認 log rotation、correlation ID 與固定 error category。

---

### Task 9: Update the four-hour Codex heartbeat and verify DevSpace Secure end to end

**External state:**

- Create or update Codex automation: `DevSpace Secure 每四小時健康檢查`
- Read-only DevSpace Secure call against `D:\Project\need-to-know-ai`

**Gate:** 只有 Task 8 的本機與公開 health 都通過後才執行。更新 automation 前先顯示名稱、4 小時間隔與完整 prompt，取得使用者批准。

- [ ] **Step 1: Define the exact heartbeat behavior**

Automation prompt 固定為：

```text
使用 DevSpace Secure 對 D:\Project\need-to-know-ai 執行唯讀
open_workspace(mode=checkout)。不得讀取專案檔案，不得使用 shell 繞過
DevSpace，不得操作或代填 Microsoft、Owner password 或 ChatGPT OAuth。
成功取得 workspaceId 時只在此 task 記錄健康。失敗時以相同唯讀參數重試
一次；第二次仍失敗時，只執行：
powershell.exe -NoProfile -ExecutionPolicy Bypass -File
C:\PixiuCore\scripts\devspace-portable\devspace-watchdog.ps1
notify-connector-failure
不得把錯誤文字、URL、workspace 路徑或其他資料附加到命令列。
```

排程：啟用、每 4 小時、使用本機時區。

- [ ] **Step 2: Use the Codex automation tool to create or update it**

先搜尋並讀取 `automation_update` schema，再以工具建立或更新；不得手寫 raw automation directive。若同名 automation 已存在則更新，不建立重複項。

- [ ] **Step 3: Perform the read-only DevSpace Secure smoke test**

呼叫：

```text
open_workspace(
  workspaceRoot = "D:\Project\need-to-know-ai",
  mode = "checkout"
)
```

Expected: 取得 `workspaceId`。不要呼叫 read/write project tools。

- [ ] **Step 4: Handle OAuth/Connector failure safely**

若仍回傳 `400`、`-32603`、`Internal error` 或沒有 `workspaceId`：

- 呼叫固定 `notify-connector-failure` 一次。
- 報告本機與公開 health 的實際結果，將故障隔離為 Connector/OAuth。
- 請使用者在 ChatGPT／Codex UI 手動重新連線並完成 OAuth。
- 不開啟登入頁、不代填 Owner password、不保存或重放憑證。
- 使用者完成後再執行同一唯讀 smoke test。

- [ ] **Step 5: Final acceptance verification**

逐項確認：

```text
[ ] Windows 登入 trigger 存在
[ ] 每 4 小時 trigger 存在
[ ] IgnoreNew + mutex 防重疊
[ ] local /healthz ready
[ ] latest public /healthz ready
[ ] one-shot recovery tested
[ ] unrelated tunnel unchanged
[ ] anomaly/recovery notification deduplicated
[ ] Bot Token absent from repo/task/log/output
[ ] non-interactive login fence tested
[ ] DevSpace Secure returned workspaceId
[ ] both automated suites remain green
```

只有所有必要項目都以新鮮證據通過，才能宣告 Watchdog 實作完成。若 Connector 仍需人工 OAuth，應明確標示「本機 Watchdog 已完成，端對端驗收等待人工重新授權」，不得聲稱全部完成。

---

## Plan Self-Review Checklist

- [ ] 設計文件的 11 項驗收條件都映射到至少一個 task 與一個驗證步驟。
- [ ] 所有 code-producing task 都先有 RED，再做最小實作，再驗 GREEN。
- [ ] 所有外部副作用都有 mock 測試與受控實測 gate。
- [ ] OneClick 非互動護欄消除登入檢查與 `start` 之間的瀏覽器競態。
- [ ] tunnel cleanup 同時驗證 process name、完整 host 語意、精確 tunnel ID、PID 與開始時間。
- [ ] ConnectorFailure 入口不接受任意文字或命令。
- [ ] Token 只以 CurrentUser DPAPI 保存，ACL fail closed。
- [ ] task arguments、state、log、README 範例與測試 fixture 都沒有真實 secret。
- [ ] 沒有待辦標記、未定文字、範例佔位值或未定介面。
- [ ] 沒有要求 Agent Team、commit、push、merge 或 deploy 的隱含授權。
