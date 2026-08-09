# DevSpace Watchdog 持續重試設計

日期：2026-08-09  
狀態：已選定方案 A，待使用者確認書面規格

## 問題與證據

DevSpace Watchdog 能偵測異常、嘗試一次復原並發送通知，但復原失敗後不會在四小時週期內繼續嘗試。

2026-08-09 的現場證據如下：

- `watchdog.log` 在 2026-08-08 20:32、2026-08-09 00:32、04:32 各記錄一次 `TunnelProcessMismatch`，三次之間沒有額外執行。
- `state.json` 記錄 `status=unhealthy`、`RecoveryAttempted=true`、`RecoverySucceeded=false`。
- Windows 排程設定為 `RestartCount=0`，沒有失敗重啟政策。
- 排程最近結果為 `0`；目前的 `run` 動作即使回傳 `unhealthy`，PowerShell 程序仍以成功退出碼結束。

根因是「Watchdog 結果」沒有轉換成「程序退出碼」，而且 Task Scheduler 沒有失敗重啟設定。Windows 因此將重連失敗視為成功，僅等待下一次四小時觸發。

## 目標

- 健康狀態仍維持每四小時檢查。
- Watchdog 偵測異常且本次復原失敗時，每 15 分鐘重新執行。
- 一旦恢復健康，立即停止該次失敗重試鏈。
- 若長時間未恢復，重試可由下一個四小時觸發無縫接續。
- 不改變現有 Telegram 通知與去重規則。
- 不放寬程序辨識、停止程序或檔案 ACL 等安全限制。

## 選定方案

採用 Windows Task Scheduler 的失敗重啟能力：

- 一般觸發維持每四小時一次及登入時一次。
- `run` 結果為健康時，程序退出碼為 `0`。
- `run` 結果為不健康時，程序退出碼為 `2`。
- 排程設定 `RestartInterval=15 分鐘`、`RestartCount=15`。
- 單次執行的 `ExecutionTimeLimit=10 分鐘` 維持不變。
- `MultipleInstances=IgnoreNew` 維持不變，避免重疊復原。

十五次重啟涵蓋 3 小時 45 分鐘；原本四小時觸發會在其後 15 分鐘接續。因此持續異常時，正常情況下每 15 分鐘會有一次新的受控復原嘗試。

未採用的方案：

- PowerShell 內部長迴圈：會與單次 10 分鐘上限衝突，也讓程序長期占用資源。
- 將所有健康檢查改成每 15 分鐘：雖然簡單，但改變使用者已指定的健康狀態四小時週期。

## 行為與退出碼

只有 `run` 動作需要將結果映射為程序退出碼：

| Watchdog 結果 | 退出碼 | 排程行為 |
|---|---:|---|
| `healthy` | `0` | 本次完成，不再重試 |
| `skipped / MutexBusy` | `0` | 已有執行中的實例，不建立多餘重試 |
| `unhealthy` | `2` | 15 分鐘後重新執行 |
| 未處理例外 | 非零 | 交由排程重試並保留錯誤資訊 |

`install`、`status`、`remove`、`notify-connector-failure`、`test-telegram` 的既有退出行為不變。

## 元件變更

### Watchdog CLI 邊界

新增一個可獨立測試的結果轉退出碼函式。主程式只有在直接執行且動作為 `run` 時套用該退出碼；dot-source 測試不會終止測試程序。

核心 `Invoke-WatchdogRun` 仍回傳結構化結果，通知、寫入狀態與日誌的順序不變。

### Task Scheduler 規格

Watchdog task spec 新增：

- `RestartCount = 15`
- `RestartInterval = 00:15:00`

建立排程時將兩項設定傳給 `New-ScheduledTaskSettingsSet`。排程註冊後的 read-back 驗證也必須比較這兩項；不符時沿用現有 fail-closed 回滾行為。

### 現有安裝升級

程式碼部署後，更新既有固定排程 `Pixiu DevSpace Watchdog` 的 settings，保留：

- 相同 action、trigger、使用者與 InteractiveToken。
- 既有 DPAPI Telegram 設定與 ACL。
- 四小時週期、登入觸發、10 分鐘上限與 `IgnoreNew`。

更新後必須從 Task Scheduler 讀回並確認 `RestartCount=15`、`RestartInterval=PT15M`。

## 錯誤處理與安全性

- 復原仍只停止經 PID、啟動時間、程序名稱與命令列重新驗證的 DevSpace／Tunnel 程序。
- `MutexBusy` 不視為失敗，避免另一實例尚未結束時製造重試風暴。
- Telegram 傳送失敗不覆蓋實際服務狀態；服務不健康仍須回傳 `2`。
- 通知去重保持現況，15 分鐘重試不會每次發送相同異常通知。
- OAuth 或 Dev Tunnel 登入失效仍採非互動式失敗；排程持續重試並等待使用者重新登入，不自動操作瀏覽器。

## 測試與驗收

先寫失敗測試，再實作：

1. `healthy` 映射到退出碼 `0`。
2. `MutexBusy` 映射到退出碼 `0`。
3. `unhealthy` 映射到退出碼 `2`。
4. task spec 包含 15 分鐘與 15 次重啟。
5. Task Scheduler adapter 將重啟設定傳入 Windows API。
6. task read-back 缺少或篡改任一重啟設定時驗證失敗並回滾。
7. Telegram 去重、復原上限、程序安全辨識等既有測試全部通過。
8. 現場排程讀回為 `RestartCount=15`、`RestartInterval=PT15M`。
9. 現場健康檢查及公開 tunnel 驗證維持正常。

不以真的破壞 DevSpace 連線作為驗收方式；重試決策由退出碼測試與 Windows 排程設定讀回共同驗證。

## 非目標

- 不修改 DevSpace OneClick 的停止或啟動策略。
- 不變更四小時正常檢查頻率。
- 不新增 Telegram 訊息種類。
- 不自動代替使用者完成 Microsoft 或 ChatGPT OAuth 登入。
