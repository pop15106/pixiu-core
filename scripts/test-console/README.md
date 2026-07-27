# PixiuCore 測試控制台

這個工具提供本機 Web UI，用來分別執行 PixiuCore 各模組測試，或一次執行完整整合測試。它只使用 Node.js 內建模組，不需要安裝 npm 套件。

## 啟動

在 PixiuCore 根目錄執行：

```powershell
node scripts/test-console/server.js --open
```

預設網址：

```text
http://127.0.0.1:8787
```

不自動開啟瀏覽器：

```powershell
node scripts/test-console/server.js
```

改用其他本機 port：

```powershell
node scripts/test-console/server.js --port=8790 --open
```

按 `Ctrl+C` 關閉服務。Server 固定監聽 `127.0.0.1`，不能改成對外網卡。

## 可執行模組

| 模組 | 內容 |
|---|---|
| Core Evolution Gates | 資源身分、版本協商、權限交集、擴充安全閘門 |
| Manual Recap／Deterministic Capture | 正式 recap、memory summary、observation、安全與併發 |
| Auto Recap | draft-auto 建立、更新、去重與空內容處理 |
| Lazy Loading／Router／Skill Metadata | 啟動預算、Capability Router、Manifest、Skill metadata |
| DevSpace OneClick | tunnel、state repair、Subagent patch、Skill discovery |
| Repository Safety | diff 格式、Git 衝突標記、高可信憑證樣式 |
| 完整整合測試 | 依上列順序執行，任一步失敗即停止 |

## UI 操作

1. 在「單模組測試」選擇要驗證的模組。
2. 按「執行此模組」。
3. 在下方查看各步驟狀態、exit code 與完整日誌。
4. 需要整體驗證時，按「執行完整整合測試」。
5. 長時間測試可按「取消目前測試」。

同時間只允許一個測試工作，避免 PowerShell、Git 與測試暫存目錄互相干擾。

## 自動測試

### 控制台單元與 API 契約

```powershell
node --test scripts/test-console/test-console.test.js
```

涵蓋：

- 固定模組 Registry；
- 整合順序；
- 禁止 shell glob 與任意命令；
- 單一 active run；
- 失敗即停止；
- 日誌上限與取消；
- session token、Origin 與 body size；
- 靜態 UI 契約；
- Repository Safety pattern。

### 真實 Web API 整合測試

```powershell
node --test scripts/test-console/web-api-integration.test.js
```

這支測試會：

1. 以隨機 port 啟動真正的 Web server。
2. 取得本機 session token。
3. 透過 HTTP API 執行 Core Evolution 單模組。
4. 透過 HTTP API 執行 `integration-all`。
5. 驗證六個整合步驟全部通過。
6. 關閉測試 server。

## 手動 CLI 對照

Web UI 背後固定對應以下入口：

```powershell
node --test scripts/core-evolution/test/*.test.js
node scripts/hooks/pixiu-deterministic-capture.test.js
node scripts/hooks/pixiu-auto-recap.test.js
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/performance/run-lazy-loading-tests.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/devspace-portable/tests/run-tests.ps1
node scripts/test-console/repository-safety.js
```

Windows PowerShell 直接輸入第一條命令時不一定展開 `*.test.js`；Web UI 的 Registry 會先列出明確測試檔案，再交給 Node test runner，因此不依賴 shell glob。

## 安全邊界

- 只監聽 `127.0.0.1`。
- Browser API 不能傳入 executable、args、cwd 或任意 shell 內容。
- 寫入型 API 要求同源 `Origin`、`application/json` 與隨機 `X-Pixiu-Test-Token`。
- 回傳的 run snapshot 不包含內部 executable 或 args。
- 同時間最多一個 active run。
- 日誌有固定上限，不會無限累積。
- Repository Safety 只顯示憑證類型與遮罩預覽，不回顯完整值。

## 常見問題

### 8787 已被使用

改用其他 port：

```powershell
node scripts/test-console/server.js --port=8790 --open
```

### PowerShell 模組測試無法啟動

確認 Windows 有 `powershell.exe`，並直接執行對應的 `.ps1` 測試入口查看完整錯誤。

### UI 顯示 409

已有另一個測試工作執行中。等待完成或先按取消，再啟動下一個模組。

### 瀏覽器關閉後測試仍在跑

瀏覽器只是控制介面。回到啟動 server 的終端機按 `Ctrl+C`，Server 會要求取消目前 child process 並關閉。
