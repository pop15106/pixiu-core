# DevSpace Windows Watchdog 設計

- 日期：2026-07-29
- 狀態：approved-by-request
- 範圍：PixiuCore `scripts/devspace-portable` 的本機健康監控、自癒、Telegram 通知與 Codex 端對端檢查

## 背景

DevSpace Secure 連線失敗時，觀察到以下兩層症狀：

1. ChatGPT／Codex 連接器無法取得 `workspaceId`，曾回傳帳號連線 `400` 與 MCP `-32603 Internal error`。
2. 公開 Dev Tunnel 回傳 HTTP 502；本機 `127.0.0.1:7678` 沒有 DevSpace listener，但持久 tunnel host 仍在執行。

此外，OneClick 設定保存的公開網址與瀏覽器錯誤頁顯示的網址字母順序不同，表示外部 App 可能仍引用舊或錯誤的 tunnel origin。現行 runtime 記錄也曾與實際程序漂移，且同一個 `devspace-mcp-pop15.jpe1` 出現重複 host。

## 目標

建立一套不依賴 DevSpace MCP 本身的本機 Windows Watchdog：

1. 使用者登入 Windows 時立即檢查，之後每 4 小時檢查一次。
2. 驗證本機與公開 `/healthz`。
3. 故障時重用既有 OneClick 安全停止與啟動流程，復原固定 port 與持久 tunnel。
4. 只管理設定檔指定的 tunnel ID，不影響其他 Dev Tunnel。
5. 透過既有 Telegram Bot，只在異常與恢復時通知。
6. 使用 Codex heartbeat 另做 DevSpace Secure／ChatGPT OAuth 的端對端檢查。

## 非目標

- 不代填 Owner password、Microsoft 登入、ChatGPT OAuth 或任何密碼。
- 不儲存 ChatGPT access token。
- 不把 Bot Token、Owner password 或其他 secret 寫進 repository、Task Scheduler arguments 或日誌。
- 不修改 DevSpace 的 OAuth 協定或移除既有驗證。
- 不清理與設定 tunnel ID 無關的 `devtunnel` 程序。
- 不使用 Codex heartbeat 取代本機自癒；連接器故障時 heartbeat 無法可靠操作 DevSpace。

## 設計選擇

採用獨立 Windows Watchdog，重用現有 `devspace-oneclick.ps1`，避免把排程、Telegram 與狀態機塞進 OneClick 主流程。

未採用方案：

1. 直接擴充 `devspace-oneclick.ps1`：入口集中，但會擴大既有大型腳本的回歸範圍。
2. 只使用 Codex heartbeat：不需本機腳本，但 DevSpace 後端或 tunnel 已故障時無法真正自癒。
3. 自動操作登入頁：需要保存或代填認證資料，違反安全邊界。

## 架構

```text
Windows Task Scheduler
  ├─ 使用者登入觸發
  └─ 每 4 小時觸發
       |
       v
devspace-watchdog.ps1 run
  ├─ process mutex / IgnoreNew
  ├─ 讀取 OneClick 非敏感設定
  ├─ 檢查 local /healthz
  ├─ 檢查 public /healthz
  ├─ 必要時受控 stop -> 精確清理 -> start
  ├─ 重讀最新 publicBaseUrl
  ├─ 更新狀態與日誌
  └─ 狀態轉換時送 Telegram

Codex heartbeat（每 4 小時）
  └─ DevSpace Secure open_workspace
       ├─ 成功：端對端健康
       └─ 失敗：呼叫固定 ConnectorFailure 通知入口
```

## 預計檔案

| 檔案 | 用途 |
|---|---|
| `scripts/devspace-portable/devspace-watchdog.ps1` | 健康檢查、受控復原、Telegram、狀態與排程管理 |
| `scripts/devspace-portable/10-INSTALL-WATCHDOG.cmd` | 本機設定 Telegram 並安裝排程 |
| `scripts/devspace-portable/11-WATCHDOG-STATUS.cmd` | 顯示排程與最近檢查結果 |
| `scripts/devspace-portable/12-RUN-WATCHDOG-NOW.cmd` | 手動執行一次 |
| `scripts/devspace-portable/13-REMOVE-WATCHDOG.cmd` | 經確認後移除排程與 Watchdog 設定 |
| `scripts/devspace-portable/tests/run-watchdog-tests.ps1` | Watchdog 單元與狀態機測試 |
| `scripts/devspace-portable/README.zh-TW.md` | 安裝、操作、安全邊界與故障排除 |

## 儲存位置

Watchdog 執行狀態放在：

```text
%LOCALAPPDATA%\DevSpaceOneClick\watchdog\
  config.json
  state.json
  watchdog.log
```

`config.json` 只保存：

- Telegram Channel／Chat ID；
- 由目前 Windows 使用者 DPAPI 加密的 Bot Token；
- schema version。

Watchdog 目錄與設定檔的 ACL 只允許目前 Windows 使用者與 `SYSTEM` 存取；若 ACL 無法安全套用，安裝流程停止且不註冊排程。

`state.json` 只保存：

- `unknown`／`healthy`／`unhealthy`；
- 最近一次檢查與恢復時間；
- 最近錯誤分類；
- 上次通知的狀態。

不得保存 Owner password、Microsoft token、ChatGPT token、完整 HTTP 回應或專案檔案內容。

## 排程

Task 名稱固定為 `Pixiu DevSpace Watchdog`。

觸發：

1. 目前使用者登入 Windows。
2. 建立後立即開始，之後每 4 小時重複。

執行原則：

- 以目前使用者、Interactive Token、最低權限執行。
- 不要求系統管理員權限。
- `MultipleInstances=IgnoreNew`。
- `StartWhenAvailable=true`。
- 腳本另使用具固定名稱的系統 mutex，避免手動與排程重疊。
- 單次執行有總逾時，不形成無限重試。

## 健康檢查

### 本機

呼叫：

```text
http://127.0.0.1:<settings.port>/healthz
```

只有 JSON 同時符合以下條件才算健康：

- `ok == true`
- `name == "devspace"`

### 公開 tunnel

每次都從最新 `settings.json` 重讀 `publicBaseUrl`，再呼叫：

```text
<publicBaseUrl>/healthz
```

`publicBaseUrl` 必須：

- 使用 HTTPS；
- host 為 `*.devtunnels.ms`；
- 不含 `/mcp` 或其他 path；
- 與 tunnel 查詢結果的 region／port 一致。

### ChatGPT／Codex

本機與公開 health 只能證明服務與 tunnel 可用，不能證明特定 ChatGPT 帳號的 OAuth token 有效。

Codex heartbeat 每 4 小時對 `D:\Project\need-to-know-ai` 執行唯讀 `open_workspace(mode=checkout)`：

- 成功取得 `workspaceId`：端對端健康。
- 回傳 `400`、`-32603`、`Internal error` 或沒有 `workspaceId`：端對端異常。

heartbeat 不讀專案檔案、不使用 shell 繞過 DevSpace，只能在失敗時呼叫 Watchdog 固定的 `ConnectorFailure` Telegram 通知入口。

## 受控復原

只要本機或公開 health 任一失敗，執行一次復原：

1. 檢查 `devtunnel user show -j`。
2. 若未登入，停止復原並通知，不能啟動瀏覽器或操作登入。
3. 呼叫既有 OneClick `stop`，沿用 PID、開始時間、程序名稱與 listener 身分驗證。
4. 若 OneClick 拒絕停止，立即停止，不以強制關閉繞過。
5. 對殘留程序讀取命令列，只處理精確匹配 `host <settings.tunnelId>` 的 `devtunnel.exe`。
6. 不處理 `host -p ...`、其他 tunnel ID 或命令列無法驗證的程序。
7. 呼叫既有 OneClick `start`。
8. 重讀 `settings.json`，驗證最新本機與公開 `/healthz`。
9. 成功則標記 recovered；失敗則記錄單一錯誤並停止。

第一次安裝 Watchdog 時，需先做一次受控整理，將目前同一 tunnel ID 的重複 host 收斂成一個；整理前列出精確匹配的 PID 與命令列，且只對已核可的 tunnel ID 操作。

## OAuth 邊界

既有 OneClick 啟動時保留：

```text
DEVSPACE_OAUTH_AUTO_APPROVE_CHATGPT=1
```

此設定只允許 DevSpace 伺服器端對可識別的 ChatGPT 流程自動核准，不代表 Watchdog 可以：

- 代填 Owner password；
- 代登入 Microsoft；
- 代操作 ChatGPT OAuth 頁；
- 保存或重放使用者密碼。

任何需人工認證的狀況都發 Telegram，並停在安全狀態。

## Telegram

安裝時在本機互動視窗輸入既有 Bot Token 與 Channel／Chat ID：

- Bot Token 使用遮蔽輸入。
- Token 用目前 Windows 使用者的 DPAPI 加密。
- Task Scheduler arguments 不包含 Token。
- 傳送時只在記憶體解密。
- Telegram API 例外只記錄分類與狀態碼，不記錄含 Token 的完整 URI。

通知狀態機：

| 前一狀態 | 新狀態 | 行為 |
|---|---|---|
| unknown | healthy | 不通知，只初始化 |
| unknown | unhealthy | 發異常通知 |
| healthy | healthy | 不通知 |
| healthy | unhealthy | 發異常通知 |
| unhealthy | unhealthy，同錯誤 | 不重複通知 |
| unhealthy | unhealthy，錯誤分類改變 | 再通知一次 |
| unhealthy | healthy | 發恢復通知 |

通知只包含：

- 電腦名稱；
- 檢查時間；
- 本機／公開／Connector 狀態；
- 是否嘗試復原及結果；
- 經過清理的錯誤分類；
- 公開 origin（不含認證資料）。

## Codex Heartbeat 整合

既有的「DevSpace Secure 每四小時健康檢查」建議需在 Watchdog 完成後更新：

1. 保持唯讀 `open_workspace`。
2. 成功只在 task 中記錄。
3. 失敗重試一次。
4. 第二次失敗時，僅執行固定的 Watchdog `ConnectorFailure` 通知動作。
5. 不把任意錯誤文字直接插入 shell arguments。
6. 不自動操作登入或 OAuth。

## 日誌

- 使用 UTF-8。
- 單檔達固定大小後輪替，保留有限份數。
- 不記錄 Token、Owner password、OAuth response body、完整 exception URI 或專案內容。
- 每次執行產生 correlation ID，便於對照排程、OneClick 與 Telegram 結果。

## 錯誤處理

- 設定缺失／格式錯誤：不修復、不猜值，記錄並通知。
- DPAPI 解密失敗：不覆寫 Token，通知重新設定 Telegram。
- Dev Tunnel 未登入：不開瀏覽器，通知人工登入。
- local down、public down：最多執行一次受控復原。
- OneClick stop 身分驗證失敗：停止，不強制關閉。
- 找到多個精確匹配的 tunnel host：復原流程可整理；健康狀態下只記錄，不主動中斷。
- 找到不相關 tunnel：忽略。
- Telegram 傳送失敗：寫入不含 secret 的本機日誌，不影響服務復原判定。
- 排程重疊：後到的執行直接退出。

## 測試

### 自動測試

測試使用依賴注入或 mock，不連真實 Telegram、不停止真實服務：

1. local／public health JSON 判定。
2. public origin URL 白名單與 path 驗證。
3. Dev Tunnel 登入／未登入分支。
4. 精確 tunnel ID 程序匹配；確認 `host -p 8791` 不會命中。
5. OneClick stop 拒絕時不繼續。
6. 復原最多一次。
7. mutex 與重疊排程。
8. Telegram 狀態轉換與去重。
9. DPAPI round-trip，且明文 Token 不存在於輸出與日誌。
10. ConnectorFailure 只能接受固定 enum，不接受任意命令或訊息。
11. Task Scheduler 觸發為登入＋每 4 小時，且 `IgnoreNew`。
12. 移除流程只移除固定 task 與 Watchdog 設定。

### 受控實測

自動測試全綠後：

1. 設定 Telegram 並發送一則測試通知。
2. 顯示即將整理的精確 tunnel ID 程序。
3. 受控停止 OneClick。
4. 手動執行 Watchdog，確認只復原指定 DevSpace stack。
5. 驗證本機 `/healthz`。
6. 驗證最新公開 `/healthz`。
7. 確認不相關 `host -p 8791` PID 未被停止。
8. 確認異常與恢復通知各一則，穩定健康不重複通知。
9. 透過 DevSpace Secure 唯讀 `open_workspace` 驗證 `workspaceId`。

## 驗收條件

1. Windows 登入後立即檢查，之後每 4 小時執行。
2. 排程與手動執行不重疊。
3. 本機或公開 health 失敗時最多自癒一次。
4. 恢復後本機與最新公開 `/healthz` 都回傳 DevSpace ready。
5. 只管理設定 tunnel ID，無關 tunnel 保持原狀。
6. Telegram 只在異常、錯誤分類變更與恢復時通知。
7. Bot Token 不出現在 repository、Task Scheduler、日誌或測試輸出。
8. 需要人工登入時只通知，不代填、不自動操作。
9. Codex heartbeat 能區分服務健康與 ChatGPT OAuth／Connector 端對端健康。
10. Watchdog 自動測試、既有 OneClick 測試與受控實測全部通過。
11. README 提供安裝、狀態、手動執行、移除與故障排除步驟。

## 實作閘門

本文件核可後才建立實作計畫。實作計畫另需使用者核可，才可：

- 修改 `scripts/devspace-portable`；
- 註冊 Windows Task Scheduler；
- 輸入或保存 Telegram 設定；
- 停止重複 tunnel host；
- 重啟 DevSpace；
- 執行真實 Telegram 與端對端測試。
