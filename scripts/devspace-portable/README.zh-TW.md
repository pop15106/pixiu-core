# DevSpace One-Click for Windows

這個資料夾是純 DevSpace + Microsoft Dev Tunnel 的可攜安裝器，不包含 Orchestrator，也不會使用 OpenAI API key。

## 最簡單的使用方式

1. 把整個資料夾解壓縮到新電腦。
2. 雙擊 `01-INSTALL-AND-START.cmd`。
3. 輸入要授權的專案資料夾。多個資料夾用分號分隔。
4. 瀏覽器開啟時，登入 Microsoft Dev Tunnel。可以使用和其他電腦相同的 Microsoft 帳號。
5. 等畫面顯示 `READY FOR CHATGPT WEB`。
6. 複製畫面上的 MCP URL，在 ChatGPT 開發者模式建立自訂 App，驗證方式選 OAuth。
7. OAuth 核准頁出現時，輸入畫面上的 Owner password。

也可以把一個專案資料夾直接拖到 `01-INSTALL-AND-START.cmd` 上。

## 每台電腦如何避免衝突

- 每台電腦會建立自己的 tunnel ID 和公開網址。
- 安裝器會查詢同一 Microsoft 帳號中標記為 DevSpace 的 tunnel。
- 新電腦會避開帳號內已使用的 DevSpace port，從 7676 到 7775 選一個本機也空閒的 port。
- port 與 tunnel ID 會保存在這台電腦的 `%LOCALAPPDATA%\DevSpaceOneClick\settings.json`。
- 之後用 `03-START.cmd` 會重用原 tunnel，不會每次換網址。
- Microsoft Dev Tunnel 目前的 tunnel 到期日最長為 30 天；每次啟動會自動續到 30 天。長期不用超過 30 天時，網址仍可能因 tunnel 過期而需要重建。

不同電腦的 localhost 其實可以使用相同 port；本套件仍額外避開帳號內重複 port，方便辨識與管理。

## 日常操作

- 安裝並首次啟動：`01-INSTALL-AND-START.cmd`
- 新增可存取資料夾：`02-ADD-FOLDER.cmd`
- 啟動後端：`03-START.cmd`
- 停止後端：`04-STOP.cmd`
- 查看 URL、port、tunnel ID、allowedRoots：`05-STATUS.cmd`
- 把 Owner password 複製到剪貼簿：`06-COPY-PASSWORD.cmd`
- 查看全部或指定 Subagent 狀態：`07-SUBAGENT-STATUS.cmd [Agent ID]`
- 停止卡住的 Subagent：`08-STOP-SUBAGENT.cmd [Agent ID]`
- 服務仍正常但 OneClick 狀態失聯時安全接管：`09-REPAIR-STATE.cmd`
- 安裝每 4 小時健康檢查：`10-INSTALL-WATCHDOG.cmd`
- 查看 Watchdog 排程與最近結果：`11-WATCHDOG-STATUS.cmd`
- 立即執行一次健康檢查：`12-RUN-WATCHDOG-NOW.cmd`
- 移除 Watchdog 排程與本機設定：`13-REMOVE-WATCHDOG.cmd`

## Windows Watchdog

Watchdog 是獨立於 DevSpace MCP 的本機保護層。它會在目前使用者登入 Windows 時執行，之後每 4 小時檢查：

1. `http://127.0.0.1:<OneClick port>/healthz`
2. 最新 `settings.json` 對應的公開 Dev Tunnel `/healthz`

只有回應同時包含 `ok=true` 與 `name=devspace` 才算健康。公開網址必須是設定 tunnel 查詢結果所對應的 HTTPS `devtunnels.ms` origin，不接受 `/mcp`、其他 path、query、fragment 或錯誤 port。

### 安裝

1. 先確認 `05-STATUS.cmd` 可讀取既有 OneClick 設定。
2. 雙擊 `10-INSTALL-WATCHDOG.cmd`。
3. 在本機視窗以遮蔽輸入既有 Telegram Bot Token，再輸入 Channel／Chat ID。
4. 若同一個設定 tunnel ID 有重複 host，安裝器會列出精確 PID 與命令列；只有輸入 `YES` 才會受控停止 OneClick、整理精確匹配程序並重新啟動。
5. 安裝完成後執行 `11-WATCHDOG-STATUS.cmd` 確認 task 與最近狀態。

Windows Task 名稱固定為 `Pixiu DevSpace Watchdog`。它使用目前使用者的 Interactive Token 與最低權限執行，登入觸發加每 4 小時觸發，`MultipleInstances=IgnoreNew`、`StartWhenAvailable=true`，單次執行上限 10 分鐘。腳本本身另有 mutex 與 8 分鐘復原上限。

### 自癒範圍

本機或公開 health 任一失敗時，Watchdog 最多復原一次：

1. 只執行 `devtunnel user show -j` 檢查登入。
2. 未登入時停止並通知，不執行 `user login`，也不開啟瀏覽器。
3. 以 `DEVSPACE_ONECLICK_NONINTERACTIVE=1` 呼叫既有 OneClick `stop`。
4. OneClick 拒絕 PID／開始時間／listener 身分時立即停止，不強制關閉。
5. 只清理由 `settings.json.tunnelId` 精確識別且在停止前再次驗證 PID、開始時間與命令列的殘留 `devtunnel host`。
6. `host -p 8791`、其他 tunnel ID 或無法驗證的程序不會被處理。
7. 呼叫 OneClick `start`，重讀 settings，再驗證本機與最新公開 `/healthz`。

### Telegram 與資料保存

本機狀態位於：

```text
%LOCALAPPDATA%\DevSpaceOneClick\watchdog\
  config.json
  state.json
  watchdog.log
```

- `config.json` 只保存 Chat ID 與目前 Windows 使用者的 DPAPI ciphertext。
- Watchdog 目錄與檔案 ACL 只允許目前使用者與 `SYSTEM`。
- Bot Token 不會出現在 repository、Task Scheduler arguments、state 或 log。
- 日誌為 UTF-8 JSON Lines，單檔 1 MiB 後輪替，最多保留 5 份。
- 通知只在首次異常、錯誤分類改變與恢復時傳送；相同異常不重複通知。
- `notify-connector-failure` 是固定入口，不接受任意錯誤文字、URL 或命令列參數，4 小時內會去重。

### OAuth 與 Connector 邊界

Watchdog 不會代填 Owner password、Microsoft 登入或 ChatGPT OAuth，也不保存 ChatGPT token。OneClick 既有的 `DEVSPACE_OAUTH_AUTO_APPROVE_CHATGPT=1` 只代表 DevSpace 伺服器端可核准可識別的 ChatGPT 流程，不是密碼或登入自動化。

本機與公開 health 正常但 DevSpace Secure 仍回傳 `400`、`-32603`、`Internal error` 或沒有 `workspaceId` 時，屬於 Connector／OAuth 端對端異常。Codex 每 4 小時 heartbeat 只可對指定專案執行唯讀 `open_workspace(mode=checkout)`，失敗重試一次後呼叫固定 `notify-connector-failure`；重新登入必須由使用者在 UI 人工完成。

### 錯誤分類

| 分類 | 意義 | 處理方式 |
|---|---|---|
| `SettingsMissing` | OneClick settings 不存在 | 先完成 OneClick 安裝 |
| `SettingsInvalid` | settings 格式、machine、port 或 origin 不合法 | 使用 `05-STATUS.cmd`／`09-REPAIR-STATE.cmd` 檢查 |
| `LocalHealthFailed` | 本機 DevSpace 未 ready | Watchdog 嘗試一次受控復原 |
| `PublicOriginInvalid` | 公開 origin 與 tunnel 查詢結果不一致 | 檢查舊 App URL 與 OneClick settings |
| `PublicHealthFailed` | 公開 tunnel health 失敗 | Watchdog 嘗試一次受控復原 |
| `DevTunnelNotLoggedIn` | Microsoft Dev Tunnel 已登出 | 使用者人工執行 OneClick 並完成登入 |
| `OneClickStopRefused` | runtime 程序身分驗證不符 | 不強制停止；先人工檢查 |
| `TunnelProcessMismatch` | 殘留程序重新驗證失敗 | 不停止該程序；先人工檢查 |
| `OneClickStartFailed` | OneClick 啟動失敗 | 查看 OneClick log |
| `PostRecoveryHealthFailed` | 復原後 health 仍未通過 | 不進行第二次復原 |
| `ConnectorFailure` | DevSpace Secure／OAuth 端對端失敗 | 人工重新連線與 OAuth |
| `MutexBusy` | 另一個 Watchdog 正在執行 | 本次直接略過 |
| `RunTimedOut` | 復原超過 8 分鐘 | 停止後續副作用 |

### 移除

雙擊 `13-REMOVE-WATCHDOG.cmd`，輸入 `REMOVE` 後，只會移除固定 task `Pixiu DevSpace Watchdog` 與 `%LOCALAPPDATA%\DevSpaceOneClick\watchdog`。它不會停止 DevSpace、不會刪除 OneClick settings、Owner password、allowed roots 或其他 Dev Tunnel。

## Subagent delegation

安裝器會啟用 DevSpace 1.0.4 的 experimental Subagent delegation，並安裝三個 `xhigh` profile：

- `codex-explorer`：唯讀盤點與依賴分析。
- `codex-worker`：實作指定項目。
- `codex-qa-tester`：獨立測試與驗證。

Windows 相容修補會在每次安裝或啟動時檢查並重複安全套用，包括：授權目錄可在未初始化 Git 時使用、Node/npm PATH 傳入 Agent、隱藏背景 CMD 視窗，以及縮短 Agent 狀態查詢等待。修補只支援套件鎖定的 DevSpace 1.0.4；版本不同時會停止並顯示錯誤，不會盲目修改。若需回復官方檔案，可執行 `powershell -ExecutionPolicy Bypass -File .\devspace-oneclick.ps1 restore-subagent-patch`。還原前會用修補時記錄的 SHA-256 manifest 一次檢查全部六個 target 與備份；遇到同版 hotfix、target／備份漂移、缺少部分備份或版本不同時，會在寫入任何檔案前整批拒絕。全部備份都不存在時安全地不做事；已還原狀態可重複執行。舊版安裝器留下的備份若沒有 manifest，會拒絕未驗證還原。

Skill root 判斷是時間點檢查：掃描時只把實際存在的 `SKILL.md` 視為 Skill，資料庫、參考文件等非 Skill 子目錄不會讓整個 root 誤判失敗。一般專案只有名稱與 SHA-256 內容都被較早來源完整涵蓋時，才略過 project-local root；檔案缺失、讀取失敗、獨有 Skill 或同名不同內容都 fail-open 保留專案能力。PixiuCore 本體另有 canonical 特例：workspace 必須有 `vault/bootstrap/SESSION-BOOTSTRAP.md`，較早的全域 root 實體路徑必須正是該 workspace 的 `skills/`，且 canonical 名稱全集涵蓋 `.agents/skills`，才把後者視為 portable 發佈層並略過。root-only API 無法把判斷與後續載入包成原子快照，因此仍保留極小競態窗口。

`07-SUBAGENT-STATUS.cmd` 只顯示精簡錯誤摘要，完整紀錄仍保留在 DevSpace 的 Agent store。`08-STOP-SUBAGENT.cmd` 只會停止與指定 `agt_XXXXXXXX` 完整匹配的 worker process tree。

### OneClick 狀態失聯修復

若 DevSpace MCP 仍可使用，但 `05-STATUS.cmd` 顯示舊 PID、舊 tunnel URL 或設定不一致，執行 `09-REPAIR-STATE.cmd`。修復流程不停止也不重啟服務；它只在以下條件全部通過時接管現行程序：本機與公開 `/healthz` 都回傳 DevSpace ready、listener 確實是 `@waishnav/devspace` 的 `serve` CLI、同一 launcher parent 下只有一個 `devtunnel host`、tunnel ID 與公開 URL region 一致。寫回前會備份既有 `settings.json` 與 `runtime.json`，寫回或 read-back 任一步失敗就恢復舊內容。

Explorer 與 QA 會在真正的 Codex sandbox 層強制唯讀；Worker 才能修改檔案。預設上限分別為 Explorer 12 分鐘、Worker 30 分鐘、QA 20 分鐘。Explorer 另限制為 20 個 repository commands 與最多 10 個優先發現，達到時間上限時必須回傳部分結果。

安裝器會在自己的 `bin` 目錄建立輕量 `devspace` shim。`devspace agents ls` 與 `devspace agents show <id>` 直接讀 Agent store；`agents run` 與其他命令仍交回官方 DevSpace CLI。Web 輪詢建議每 60 到 90 秒一次，不要連續快速查詢。

### Web 長時間命令與 Connector 502

安裝器會把 DevSpace 內建的 `exec_command` 與 `write_stdin` process-session 工具開放給 ChatGPT Web。`npm run build`、測試、Android build、`devspace agents show`，或任何可能超過 20 秒的命令，都應先用 `exec_command`；若回傳 `running=true` 與 `sessionId`，再用相同 `workspaceId`、`sessionId` 呼叫 `write_stdin`，直到 `running=false`。只有 `exitCode=0` 才算成功。

Git Bash 的 `npm`/`npx` 也會透過輕量 shim 直接轉給 `npm.cmd`/`npx.cmd`，避免 Windows npm Bash 包裝器重複啟動 Node。安裝或更新後，請重新整理 ChatGPT Web 或重新連接 DevSpace App，讓工具清單載入新工具。

新增資料夾時，也可以直接把資料夾拖到 `02-ADD-FOLDER.cmd`。若後端正在執行，腳本會自動重啟套用設定。

## 權限與安全

- DevSpace 只監聽 `127.0.0.1`。
- 只把你輸入的具體專案目錄加入 `allowedRoots`。
- 安裝器拒絕整個磁碟、整個使用者目錄、整個 Desktop 和整個 Downloads。
- 既有 `config.json` 的其他欄位會保留，更新前會建立時間戳備份。
- Tunnel 必須允許匿名網路傳輸，ChatGPT 才能進入 DevSpace 的 OAuth 流程；MCP 本身仍由 DevSpace OAuth 保護。
- Owner password 保存在 `%USERPROFILE%\.devspace\auth.json`，不會寫進 ZIP 或公開網址。
- 每台電腦都會產生自己的 Owner password 與本機狀態。

## ChatGPT Web 設定

1. 開啟 ChatGPT 的開發者模式。
2. 建立新的自訂 App。
3. 連線方式選伺服器 URL。
4. URL 貼上狀態畫面顯示的完整 `https://...devtunnels.ms/mcp`。
5. 驗證選 OAuth。
6. 按連線，於 DevSpace 核准頁輸入 Owner password。

同一個 ChatGPT 帳號可以建立多個 DevSpace App。建議 App 名稱加上電腦名稱，例如 `DevSpace-OFFICE-PC`。

## 系統需求

安裝器支援 Windows，並使用 winget 安裝或更新：

- Node.js `>=22.19 <27`
- Git for Windows（DevSpace 在 Windows 需要 Git Bash）
- Microsoft Dev Tunnel CLI
- `@waishnav/devspace@1.0.4`

首次安裝可能出現 Windows 權限提示與 Microsoft 登入頁，這是正常流程。
