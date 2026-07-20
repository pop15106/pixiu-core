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

## Subagent delegation

安裝器會啟用 DevSpace 1.0.4 的 experimental Subagent delegation，並安裝三個 `xhigh` profile：

- `codex-explorer`：唯讀盤點與依賴分析。
- `codex-worker`：實作指定項目。
- `codex-qa-tester`：獨立測試與驗證。

Windows 相容修補會在每次安裝或啟動時檢查並重複安全套用，包括：授權目錄可在未初始化 Git 時使用、Node/npm PATH 傳入 Agent、隱藏背景 CMD 視窗，以及縮短 Agent 狀態查詢等待。修補只支援套件鎖定的 DevSpace 1.0.4；版本不同時會停止並顯示錯誤，不會盲目修改。

`07-SUBAGENT-STATUS.cmd` 只顯示精簡錯誤摘要，完整紀錄仍保留在 DevSpace 的 Agent store。`08-STOP-SUBAGENT.cmd` 只會停止與指定 `agt_XXXXXXXX` 完整匹配的 worker process tree。

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
