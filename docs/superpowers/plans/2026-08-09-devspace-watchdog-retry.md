# DevSpace Watchdog 持續重試實作計畫

> **規格：** `docs/superpowers/specs/2026-08-09-devspace-watchdog-retry-design.md`

## 目標

讓 Watchdog 在復原失敗時以非零碼結束，交由 Windows Task Scheduler 每 15 分鐘重跑；健康時仍維持四小時週期，不產生多餘重試。

## 修改範圍

- `scripts/devspace-portable/devspace-watchdog.ps1`
- `scripts/devspace-portable/tests/run-watchdog-tests.ps1`
- 既有 Windows 排程 `Pixiu DevSpace Watchdog` 的 settings

不修改 OneClick 啟停策略、Telegram 訊息格式、通知去重、OAuth 或程序安全辨識。

## 實作順序

### 1. 以測試固定退出碼契約

先在 `run-watchdog-tests.ps1` 新增失敗測試：

- `healthy` 結果映射為 `0`。
- `skipped / MutexBusy` 結果映射為 `0`。
- `unhealthy` 結果映射為 `2`。
- 非 `run` 動作不套用不健康退出碼。

執行 Watchdog 測試並確認測試因缺少退出碼映射而失敗。

### 2. 實作 CLI 退出碼邊界

在 `devspace-watchdog.ps1` 新增單一、純函式的結果轉退出碼邏輯。保留 `Invoke-WatchdogRun` 的結構化回傳值與現有副作用順序。

主程式直接執行 `run` 時：

1. 取得 `Invoke-WatchdogMain` 結果。
2. 將結果映射為退出碼。
3. 以該退出碼終止程序。

dot-source 時不得終止測試程序。執行退出碼測試，確認轉為綠燈。

### 3. 以測試固定 Task Scheduler 重試規格

新增失敗測試：

- task spec 為 `RestartCount=15`。
- task spec 為 `RestartInterval=15 分鐘`。
- Windows adapter 將兩項設定傳給 task settings。
- read-back 完全相符時通過。
- RestartCount 或 RestartInterval 任一不符時拒絕並回滾。

執行測試並確認失敗原因是目前排程規格沒有重試欄位。

### 4. 實作排程重試設定與驗證

更新 task spec、`New-ScheduledTaskSettingsSet` adapter、task read-back DTO 與一致性驗證：

- `RestartCount = 15`
- `RestartInterval = [TimeSpan]::FromMinutes(15)`

保留：

- 四小時 trigger
- 登入 trigger
- `ExecutionTimeLimit = 10 分鐘`
- `MultipleInstances = IgnoreNew`
- `StartWhenAvailable = true`
- InteractiveToken 與目前使用者

執行新增測試與完整 Watchdog 測試。

### 5. 回歸驗證與差異稽核

依序執行：

1. `run-watchdog-tests.ps1`
2. `run-tests.ps1`
3. `run-reconnect-cmd-tests.ps1`
4. `git diff --check`
5. 僅檢查本次相關 diff，確認沒有 Token、Chat ID 或其他秘密進入版本庫

### 6. 提交並部署到實際 PixiuCore

在功能工作樹提交程式與測試，將提交 cherry-pick 到 `C:\PixiuCore` 目前整合分支；保留既有未追蹤或不相關變更。

### 7. 升級現有排程並現場驗證

dot-source 新版 Watchdog，使用既有 task registration adapter 重新註冊固定排程；不讀取或重填 Telegram Token，不更動 DPAPI 設定檔。

現場驗證：

- `RestartCount = 15`
- `RestartInterval = PT15M`
- `ExecutionTimeLimit = PT10M`
- 四小時 trigger 與登入 trigger 仍存在
- action 指向正式 Watchdog 腳本
- 本機 `/healthz` 與公開 `/healthz` 皆健康

不故意中斷 DevSpace 來做破壞性驗收；失敗重試由退出碼自動測試與 Windows 排程 read-back 證明。

## 驗收標準

- 所有新增測試先紅後綠。
- Watchdog、OneClick、重連 CMD 回歸測試全部通過。
- 實際 Task Scheduler 讀回新的重試設定。
- 正常執行 Watchdog 時退出碼為 `0`。
- 現場 DevSpace 本機與公開連線維持健康。
