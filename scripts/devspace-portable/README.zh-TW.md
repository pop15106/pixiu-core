# Pixiu DevSpace OneClick for Windows

這是一套給一般使用者使用的 **Windows 可攜式 DevSpace 安裝包**。

它的目標很簡單：讓 ChatGPT 可以透過 MCP 安全連到你自己的 Windows 電腦，操作你明確授權的專案資料夾，而不需要自己架一台長期運作的雲端 Server，也不需要 OpenAI API key。

> 如果你是第一次使用，先看「第一次安裝」與「ChatGPT 設定」。其餘章節遇到問題再回來查即可。

---

## 1. 這套工具可以做什麼

安裝完成後，ChatGPT 可以透過 DevSpace 使用你電腦上的開發環境，例如：

- 讀取你授權的專案檔案。
- 搜尋程式碼。
- 修改程式碼。
- 執行測試、Build、Git 狀態檢查等命令。
- 使用 DevSpace Subagent。
- 使用跨 Session／跨專案 workflow 接力。
- 在 DevSpace 或 Tunnel 發生短暫故障時自動檢查與復原。
- 使用 OAuth refresh token 維持 ChatGPT 與 DevSpace 的授權連線。

每台電腦都有自己的：

- DevSpace 設定。
- Owner password。
- Microsoft Dev Tunnel。
- 公開 MCP URL。
- OAuth 狀態。
- allowedRoots。
- workflow state。

朋友安裝這個 ZIP **不會連到原作者的電腦，也不會取得原作者的密碼或 Token**。

---

## 2. 這套工具不會做什麼

它不會：

- 把整個 C 槽或 D 槽自動開放給 ChatGPT。
- 把整個使用者目錄、Desktop 或 Downloads 自動開放。
- 把 Owner password 放進公開 URL。
- 把原作者的 Owner password、Microsoft Token、ChatGPT OAuth Token 或 Telegram Bot Token 打包進 ZIP。
- 使用 OpenAI API key。
- 自動繞過 Microsoft 或 ChatGPT 要求的人工作者驗證。

如果 Microsoft Dev Tunnel 的登入真正失效，仍需要使用者重新完成 Microsoft 登入。

如果 ChatGPT 端的 App 授權被撤銷，也需要重新完成 OAuth 授權。

---

## 3. 系統需求

### 必要條件

- Windows 10 或 Windows 11。
- Windows Package Manager（`winget`）。
- 可正常連線到網際網路。
- 一個可登入 Microsoft Dev Tunnel 的 Microsoft 帳號。
- 一個可使用 ChatGPT 自訂 MCP App／Developer Mode 的 ChatGPT 帳號或 Workspace。

### ChatGPT 方案注意事項

ChatGPT 的 Developer Mode、MCP App 與寫入權限會依方案及 Workspace 政策改變。

依 OpenAI 於 2026 年 8 月的官方文件：

- Business、Enterprise、Edu 支援完整 MCP，包含寫入／修改能力，但仍可能受管理員設定限制。
- Pro 可使用 Developer Mode 連接自訂 MCP，但完整寫入能力的可用範圍可能不同。
- UI 與方案權限仍在持續調整。

如果在 ChatGPT 裡找不到「Developer Mode」、「Apps → Create」或自訂 MCP App，請先確認帳號方案與 Workspace 管理員設定。

官方說明：

- https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt
- https://help.openai.com/zh-hant/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta

建議先用 ChatGPT Web 完成 App 建立與首次 OAuth。不同平台的 App 顯示方式可能依版本或 rollout 不同。

---

## 4. 安裝器會自動準備哪些工具

第一次執行安裝器時，它會檢查並準備：

- Node.js `>=22.19 <27`
- Git for Windows / Git Bash
- Microsoft Dev Tunnel CLI
- `@waishnav/devspace@1.0.4`

缺少的工具會透過 `winget` 安裝。

DevSpace 使用固定測試版本 `1.0.4`。若版本與相容修補不一致，安裝器會停止，而不是對未知版本直接修改。

---

# 第一次安裝

## 5. 解壓縮 ZIP

將 ZIP 解壓縮到一個你有權限讀寫的位置。

建議使用簡單路徑，例如：

```text
C:\Tools\DevSpace-OneClick\
```

不要直接在 ZIP 壓縮檔內執行 CMD。

解壓縮後，資料夾中應看到：

```text
00-SETUP-OR-UPDATE.cmd
START-CONNECTION.cmd
DISCONNECT.cmd
FORCE-RECONNECT.cmd
QA-CHECK.cmd
README.zh-TW.md
...
```

---

## 6. 執行第一次安裝

雙擊：

```text
00-SETUP-OR-UPDATE.cmd
```

安裝器會先驗證 `PORTABLE-MANIFEST.json` 與 ZIP 內檔案的 SHA-256。

如果檔案被修改、缺少，或多出未納管 payload，安裝會停止。

第一次執行會完成：

1. 檢查 Windows 環境。
2. 安裝或確認 Node.js。
3. 安裝或確認 Git for Windows。
4. 安裝或確認 Microsoft Dev Tunnel。
5. 安裝固定版本 DevSpace。
6. 要求 Microsoft Dev Tunnel 登入。
7. 要求你選擇 ChatGPT 可以存取的專案資料夾。
8. 建立這台電腦專用的 Tunnel。
9. 建立這台電腦專用的 Owner password。
10. 啟動本機 DevSpace。
11. 啟動 Microsoft Dev Tunnel。
12. 驗證本機 `/healthz`。
13. 驗證公開 `/healthz`。
14. 驗證 OAuth refresh continuity。
15. 顯示 MCP URL 與 Owner password。

---

## 7. Microsoft Dev Tunnel 登入

第一次安裝時，瀏覽器可能會開啟 Microsoft 登入頁。

請使用你自己的 Microsoft 帳號登入。

完成後，命令視窗會繼續執行。

Watchdog 不會在背景自動開啟 Microsoft 登入頁。如果 Microsoft 登入日後真正失效，它會停止自動復原並回報 `DevTunnelNotLoggedIn`。

---

## 8. 選擇 allowedRoots

安裝器會要求你輸入允許 ChatGPT 存取的專案資料夾。

例如：

```text
D:\Project\my-java-app
```

多個資料夾可以用分號分隔：

```text
D:\Project\app-a;D:\Project\app-b
```

請只授權真正需要的專案。

安裝器會拒絕過大的權限範圍，例如：

```text
C:\
D:\
C:\Users\你的帳號
Desktop
Downloads
```

之後若要新增資料夾，可以：

- 雙擊 `02-ADD-FOLDER.cmd`。
- 或把專案資料夾拖到 `02-ADD-FOLDER.cmd`。

---

## 9. 記下 MCP URL 與 Owner password

安裝成功後會看到：

```text
READY FOR CHATGPT WEB
MCP URL: https://xxxx-7678.xxx.devtunnels.ms/mcp
Owner password: xxxxxxxxxxxxxxxxx
```

MCP URL 可以貼到 ChatGPT App 設定。

Owner password 只在 OAuth 授權頁輸入。

### 安全規則

不要把 Owner password：

- 傳給其他人。
- 貼到 GitHub issue。
- 放進 README。
- 貼到公開聊天。
- 截圖公開分享。

之後忘記 Owner password 時，可以雙擊：

```text
06-COPY-PASSWORD.cmd
```

它會把這台電腦自己的 Owner password 複製到剪貼簿。

---

# ChatGPT 設定

## 10. 開啟 Developer Mode

建議使用 ChatGPT Web。

依帳號與 Workspace 不同，入口可能位於：

```text
Settings
→ Apps
→ Advanced Settings
→ Developer Mode
```

或由 Workspace 管理員在 Apps / Connected Data 中啟用。

OpenAI 可能調整 UI 名稱。如果找不到入口，請先確認你的方案與 Workspace 權限。

---

## 11. 建立 DevSpace App

建立新的自訂 MCP App。

建議名稱包含電腦名稱，例如：

```text
DevSpace-HOME-PC
```

設定時：

1. 建立新的 App。
2. MCP Server URL 貼上安裝器顯示的完整 URL。

例如：

```text
https://xxxx-7678.xxx.devtunnels.ms/mcp
```

3. Authentication 選 OAuth。
4. 執行 Scan Tools／掃描工具。
5. ChatGPT 會開啟 DevSpace OAuth 授權頁。
6. 輸入這台電腦的 Owner password。
7. 完成授權。
8. 等工具掃描完成。
9. 建立／儲存 App。

第一次建立完成後，建議開一個新的 ChatGPT 對話測試。

---

## 12. OAuth 自動續期

本套件已設定：

```text
scope: devspace, offline_access
access token TTL: 1 小時
refresh token TTL: 180 天
refresh token rotation: 啟用
```

公開 OAuth discovery metadata 會宣告：

```text
authorization_code
refresh_token
devspace
offline_access
```

這符合 ChatGPT 維持 OAuth 連線所需的 refresh-token continuity 模式。

正常情況下，DevSpace process 或 Tunnel 重新啟動不需要再次輸入 Owner password。

但以下情況仍可能需要人工重新授權：

- 使用者主動撤銷 ChatGPT App 授權。
- OAuth refresh token 被撤銷或清除。
- 本機 DevSpace OAuth state 被刪除。
- ChatGPT Workspace 政策改變。
- Microsoft Dev Tunnel 登入真正失效。

---

# 第一次驗證

## 13. 先看本機狀態

雙擊：

```text
05-STATUS.cmd
```

正常狀態應包含：

```text
local health: ready
OAuth refresh continuity: ready
DevSpace PID ...: verified
Dev Tunnel PID ...: verified
```

也會看到：

```text
local MCP
public MCP
tunnel ID
machine
allowed roots
```

---

## 14. 在 ChatGPT 測試

在新的 ChatGPT 對話選擇或提及你的 DevSpace App。

可以先做唯讀測試，例如：

```text
請透過 DevSpace 查看我授權的專案工作區。
```

接著再測試：

```text
請列出專案根目錄的檔案。
```

若這兩個操作成功，代表：

```text
ChatGPT
→ OAuth
→ Microsoft Dev Tunnel
→ DevSpace MCP
→ 本機 allowedRoot
```

整條鏈路已經可用。

---

# Watchdog 自癒

## 15. Watchdog 是什麼

Watchdog 是獨立於 DevSpace MCP 的 Windows 背景保護層。

安裝後，它會建立固定 Windows Task：

```text
Pixiu DevSpace Watchdog
```

預設：

```text
每 2 分鐘檢查一次
WindowStyle Hidden
MultipleInstances = IgnoreNew
StartWhenAvailable = true
單次執行上限 = 10 分鐘
復原流程上限 = 8 分鐘
```

一般健康檢查只做很輕量的 HTTP / 狀態檢查。

---

## 16. 安裝 Watchdog

Watchdog 目前使用 Telegram 作為異常通知管道。

你需要準備自己的：

- Telegram Bot Token。
- Telegram Chat ID 或 Channel ID。

這些資料不會放進 portable ZIP。

安裝時執行：

```text
10-INSTALL-WATCHDOG.cmd
```

依提示輸入：

1. Telegram Bot Token。
2. Telegram Chat ID／Channel ID。

Bot Token 會以 Windows CurrentUser DPAPI 加密保存。

Watchdog 設定位於：

```text
%LOCALAPPDATA%\DevSpaceOneClick\watchdog\
```

ACL 只允許：

- 目前 Windows 使用者。
- SYSTEM。

---

## 17. Watchdog 自癒流程

正常流程：

```text
每 2 分鐘
   ↓
Local /healthz
   ↓
Public /healthz
   ↓
正常 → 結束，不通知
```

第一次異常時：

```text
第一次失敗
   ↓
等待 5 秒
   ↓
再檢查一次
   ├─ 已恢復 → 不重啟
   └─ 仍失敗 → 進入復原
```

復原前會先檢查 Microsoft Dev Tunnel 登入。

如果登入仍有效：

```text
Force Reconnect
→ 重新讀 settings
→ Local health
→ Public health
→ MCP OAuth Bearer challenge
→ 成功才標記恢復
```

如果 Microsoft Dev Tunnel 已登出：

```text
DevTunnelNotLoggedIn
→ 不開瀏覽器
→ 不嘗試自動輸入帳密
→ 停止自動復原
→ 通知使用者
```

---

## 18. Watchdog 不會被短暫網路抖動誤觸發

Watchdog 不會看到一次錯誤就立刻重啟整組服務。

它會先等待 5 秒，再做第二次 Probe。

只有兩次都失敗才會復原。

這可以降低：

- 短暫 Wi-Fi 抖動。
- Dev Tunnel 一次性延遲。
- HTTP 短暫 timeout。
- 瞬間 502。

造成不必要重啟的機率。

---

## 19. Force Reconnect 與 Watchdog 不會互相打架

`FORCE-RECONNECT.cmd` 執行時會建立短效 maintenance lock。

Watchdog 看到 maintenance lock 後會略過該次巡檢。

lock 超過 10 分鐘就視為失效，因此意外殘留不會永久關閉健康檢查。

---

## 20. 主動斷線不會被 Watchdog 自動連回來

如果你是真的要關掉 DevSpace，請使用：

```text
DISCONNECT.cmd
```

它會：

1. 建立「使用者主動暫停」狀態。
2. 停止 Watchdog Task。
3. 安全停止 DevSpace。
4. 安全停止 Dev Tunnel host。
5. 保留設定與 workflow state。

因此 Watchdog 不會兩分鐘後又把它啟動回來。

要重新使用時，執行：

```text
START-CONNECTION.cmd
```

啟動成功後會：

1. 清除主動暫停狀態。
2. 重新啟用 Watchdog。
3. 恢復正常 2 分鐘自癒巡檢。

> `04-STOP.cmd` 是低階原始停止入口。若已安裝 Watchdog，不建議把它當日常斷線按鈕，因為 Watchdog 可能把服務停止視為故障。一般使用請用 `DISCONNECT.cmd`。

---

## 21. 查看 Watchdog 狀態

執行：

```text
11-WATCHDOG-STATUS.cmd
```

會看到：

- Task 名稱。
- Task 狀態。
- 最近健康狀態。
- 最近檢查時間。
- 最近錯誤分類。
- 自動復原是否暫停。
- Public origin。

立即手動跑一次 Watchdog：

```text
12-RUN-WATCHDOG-NOW.cmd
```

移除 Watchdog：

```text
13-REMOVE-WATCHDOG.cmd
```

輸入：

```text
REMOVE
```

只會移除 Watchdog Task 與 Watchdog 本機設定。

它不會刪除：

- DevSpace 設定。
- Owner password。
- Tunnel identity。
- allowedRoots。
- workflow state。

---

# 日常使用

## 22. 一般使用者只需要記住這幾個檔案

| 檔案 | 用途 |
|---|---|
| `00-SETUP-OR-UPDATE.cmd` | 第一次安裝或更新 |
| `START-CONNECTION.cmd` | 啟動 DevSpace，並恢復 Watchdog |
| `DISCONNECT.cmd` | 主動斷線，並暫停 Watchdog 自癒 |
| `FORCE-RECONNECT.cmd` | ChatGPT 連不上、502、工具怪異時強制安全重連 |
| `QA-CHECK.cmd` | 不知道哪裡壞掉時先跑 |
| `05-STATUS.cmd` | 查看 DevSpace、Tunnel、OAuth 狀態 |
| `11-WATCHDOG-STATUS.cmd` | 查看 Watchdog 狀態 |

---

## 23. 進階入口

| 檔案 | 用途 |
|---|---|
| `01-INSTALL-AND-START.cmd` | 原始首次安裝流程 |
| `02-ADD-FOLDER.cmd` | 新增 allowedRoot |
| `03-START.cmd` | 原始啟動入口 |
| `04-STOP.cmd` | 原始停止入口，不暫停 Watchdog |
| `06-COPY-PASSWORD.cmd` | 複製 Owner password |
| `07-SUBAGENT-STATUS.cmd` | 查看 Subagent |
| `08-STOP-SUBAGENT.cmd` | 停止指定 Subagent |
| `09-REPAIR-STATE.cmd` | 修復 OneClick runtime state |
| `10-INSTALL-WATCHDOG.cmd` | 安裝 Watchdog |
| `12-RUN-WATCHDOG-NOW.cmd` | 立即執行一次 Watchdog |
| `13-REMOVE-WATCHDOG.cmd` | 移除 Watchdog |
| `14-RECONNECT-SAFE.cmd` | 補啟動缺少的元件並驗證 |
| `15-FORCE-RECONNECT.cmd` | 底層強制重連入口 |

---

# 更新版本

## 24. 收到新版 ZIP 時怎麼更新

新版 ZIP 可以解壓到新的資料夾。

再執行：

```text
00-SETUP-OR-UPDATE.cmd
```

安裝器會辨識這台電腦既有的 OneClick state，並保留：

- Tunnel identity。
- Owner password。
- allowedRoots。
- workflow state。
- 本機設定。

它只更新：

- DevSpace 套件。
- Windows compatibility patch。
- workflow module。
- workflow core。
- project resolver。
- Agent profiles。
- OneClick scripts。

如果更新後 ChatGPT 還看到舊工具 schema：

1. 執行 `FORCE-RECONNECT.cmd`。
2. 到 ChatGPT Apps 重新 Scan／Refresh tools。
3. 開新聊天再測試。

---

# 跨 Session／跨專案 workflow

## 25. 這個功能已包含在 ZIP 內

朋友不需要另外下載 PixiuCore repo。

Portable ZIP 已直接包含：

```text
DevSpace.WorkflowStore.mjs
SessionWorkflow.Core.mjs
DevSpace.ProjectResolver.mjs
```

安裝時會把它們部署到本機 OneClick runtime。

因此跨 Session workflow 不依賴原作者的：

```text
C:\PixiuCore\external\session-workflow
```

完整說明請看：

```text
WORKFLOW.zh-TW.md
```

---

## 26. 自然語言就可以接力

可以直接對 ChatGPT 說：

```text
下一個 session 繼續。
```

或：

```text
另一個對話接手。
```

或：

```text
交給另一個專案繼續。
```

純 workflow 接力只使用持久化協調資料，不會因為一句「接手」就自動啟動額外 Agent/model。

`workflow_run` 仍需要目前對話中明確的 model 執行授權。

---

# Subagent

## 27. 內建 Agent profiles

安裝器會提供：

- `codex-explorer`：唯讀探索、架構盤點、風險分析。
- `codex-worker`：指定範圍實作。
- `codex-qa-tester`：獨立 QA 與回歸驗證。

Explorer 與 QA 使用唯讀限制。

Worker 才能修改檔案。

預設執行上限：

```text
Explorer: 12 分鐘
Worker:   30 分鐘
QA:       20 分鐘
```

---

# 長時間命令與 502

## 28. Build／測試不要使用短命令通道硬等

DevSpace 會提供 process-session 工具：

```text
exec_command
write_stdin
```

適合：

- `npm run build`
- Maven / Gradle build
- Android build
- 大型 test suite
- DevSpace Agent 查詢
- 任何可能超過約 20 秒的命令

正確流程：

```text
exec_command
   ↓
running=true + sessionId
   ↓
write_stdin
   ↓
直到 running=false
   ↓
exitCode=0 才算成功
```

這可以降低長命令卡住 Connector 或造成 502 的機率。

---

# 常見問題

## 29. local health = down

先執行：

```text
START-CONNECTION.cmd
```

再執行：

```text
QA-CHECK.cmd
```

---

## 30. ChatGPT 突然 502／Internal error／工具失效

先執行：

```text
FORCE-RECONNECT.cmd
```

它會：

```text
maintenance lock
→ safe stop
→ start
→ local health
→ public health
→ OAuth continuity
```

若已安裝 Watchdog，一般短暫故障會先由 Watchdog自動處理。

---

## 31. DevSpace 正常，但 ChatGPT 仍看不到工具

依序做：

1. `05-STATUS.cmd`
2. 確認 `OAuth refresh continuity: ready`
3. `FORCE-RECONNECT.cmd`
4. ChatGPT Apps → Refresh／Scan Tools
5. 開新聊天
6. 仍失敗時重新連接 OAuth

需要 Owner password 時執行：

```text
06-COPY-PASSWORD.cmd
```

---

## 32. Microsoft Dev Tunnel is not logged in

執行：

```text
00-SETUP-OR-UPDATE.cmd
```

完成 Microsoft 登入。

Watchdog 不會自動輸入 Microsoft 帳密，也不會在背景偷偷開登入視窗。

---

## 33. PID stale 或 OneClick state 不一致

執行：

```text
09-REPAIR-STATE.cmd
```

這個修復只有在：

- Local health 正常。
- Public health 正常。
- Listener 確認是 DevSpace。
- Dev Tunnel process 身分可驗證。

時才會接管 live state。

驗證失敗就停止，不會強制接管未知 process。

---

## 34. Watchdog 顯示 unhealthy

執行：

```text
11-WATCHDOG-STATUS.cmd
```

常見分類：

| 分類 | 意義 |
|---|---|
| `SettingsMissing` | OneClick 尚未完成設定 |
| `SettingsInvalid` | settings 格式或 machine/origin 不正確 |
| `LocalHealthFailed` | 本機 DevSpace 未 ready |
| `PublicOriginInvalid` | 公開 origin 與 Tunnel 不一致 |
| `PublicHealthFailed` | 公開 Tunnel health 失敗 |
| `DevTunnelNotLoggedIn` | Microsoft Dev Tunnel 已登出 |
| `OneClickStopRefused` | Runtime process 身分不符，拒絕強制停止 |
| `TunnelProcessMismatch` | Tunnel process 驗證失敗 |
| `OneClickStartFailed` | OneClick 啟動失敗 |
| `PostRecoveryHealthFailed` | 自動復原後 health 仍失敗 |
| `ForceReconnectFailed` | 強制重連失敗 |
| `PostRecoveryConnectorResponseFailed` | MCP OAuth challenge 驗證失敗 |
| `ConnectorFailure` | ChatGPT Connector 端對端失敗 |
| `MutexBusy` | 另一個 Watchdog instance 正在執行 |
| `RunTimedOut` | 復原超過 8 分鐘 |

---

## 35. 查看 Log

OneClick logs：

```text
%LOCALAPPDATA%\DevSpaceOneClick\logs\
```

Watchdog log：

```text
%LOCALAPPDATA%\DevSpaceOneClick\watchdog\watchdog.log
```

Watchdog log 使用 UTF-8 JSON Lines。

單檔超過 1 MiB 後會輪替，最多保留 5 份。

---

# 安全性

## 36. DevSpace 只監聽 localhost

本機 DevSpace 綁定：

```text
127.0.0.1
```

外部 ChatGPT 透過 Microsoft Dev Tunnel 進入。

公開 Tunnel 必須允許匿名網路傳輸，ChatGPT 才能抵達 OAuth 入口。

但 `/mcp` 本身仍由 DevSpace OAuth 保護。

---

## 37. allowedRoots 是主要檔案邊界

只有你明確授權的專案資料夾會加入 allowedRoots。

不要為了方便把整個磁碟或整個 Home 目錄打開。

---

## 38. 本機秘密資料不進 ZIP

Portable builder 有明確 allowlist。

它會拒絕打包：

```text
auth.json
config.json
settings.json
runtime.json
workflow state
Owner password
Microsoft Token
ChatGPT OAuth Token
Telegram Bot Token
logs
```

每次 Build 都會產生：

```text
PORTABLE-MANIFEST.json
```

其中包含：

- source commit。
- payload file list。
- 每個檔案的 SHA-256。
- 檔案大小。

發佈版 `00-SETUP-OR-UPDATE.cmd` 會先驗證 manifest，再執行安裝。

---

# 完整移除

## 39. 只想停用連線

使用：

```text
DISCONNECT.cmd
```

這不會刪任何設定。

---

## 40. 只想移除 Watchdog

使用：

```text
13-REMOVE-WATCHDOG.cmd
```

---

## 41. 要完整清除本機 DevSpace OneClick

本套件刻意沒有提供「一鍵刪光」按鈕，避免誤刪 Owner password、workflow state 或其他本機資料。

如需完整移除，先確認哪些資料需要保留，再人工處理：

```text
%USERPROFILE%\.devspace\
%LOCALAPPDATA%\DevSpaceOneClick\
```

也可另外移除 Microsoft Dev Tunnel 與全域 DevSpace npm package。

不確定時不要直接刪。

---

# QA 回報

## 42. 要請別人協助排查時，提供這些資訊

可以提供：

- `QA-CHECK.cmd` 畫面。
- `05-STATUS.cmd` 畫面。
- `11-WATCHDOG-STATUS.cmd` 畫面。
- error category。
- 是否已執行 `FORCE-RECONNECT.cmd`。
- ChatGPT App 是否已 Refresh／Scan Tools。
- 是否剛完成 Microsoft 登入。

不要提供：

- Owner password。
- Microsoft Token。
- ChatGPT OAuth Token。
- Telegram Bot Token。
- 私人 source code，除非你明確知道要分享什麼。

---

# 給第一次使用者的最短版本

如果上面太長，只照以下流程即可：

```text
1. 解壓 ZIP
2. 雙擊 00-SETUP-OR-UPDATE.cmd
3. 完成 Microsoft 登入
4. 選自己的專案資料夾
5. 記下 MCP URL + Owner password
6. ChatGPT Web 開 Developer Mode
7. 建立自訂 App
8. MCP URL 貼完整 https://.../mcp
9. Authentication 選 OAuth
10. OAuth 頁輸入 Owner password
11. Scan Tools / Create
12. 開新聊天測試 DevSpace
13. 想要自癒再執行 10-INSTALL-WATCHDOG.cmd
```

日常只記：

```text
START-CONNECTION.cmd
DISCONNECT.cmd
FORCE-RECONNECT.cmd
QA-CHECK.cmd
```

這四個就夠了。
