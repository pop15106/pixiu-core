# PixiuCore 測試控制台設計

- 日期：2026-07-27
- 狀態：approved-by-request
- 範圍：PixiuCore 本機測試 UI、收尾文件與交付驗證

## 目標

建立一個不依賴 npm 套件、只監聽本機 loopback 的 Web UI，讓使用者能分別執行 PixiuCore 各功能模組測試，也能依固定順序執行完整整合測試；完成後校準現況文件、驗證 Git 狀態並推送遠端。

## 設計選擇

採用 Node.js 內建 `http`、`child_process`、`crypto`、`fs` 與瀏覽器原生 JavaScript，不新增 package dependency。

未採用方案：

1. React／Vue SPA：介面擴充性較高，但會新增建置鏈、依賴與供應鏈風險，不符合本次收尾需求。
2. 純 PowerShell GUI：Windows 整合直接，但不利於跨工具檢視、測試與日後擴充。
3. 任意命令 Web Terminal：彈性最高，但安全邊界過大，不納入本次範圍。

## 架構

```text
瀏覽器 http://127.0.0.1:8787
  -> Node HTTP server
  -> 同源與 session token 驗證
  -> 固定 Test Registry
  -> Run Manager（單一 active run）
  -> 白名單 executable + args
  -> 即時輪詢狀態與日誌
```

## 測試模組

| ID | 顯示名稱 | 執行內容 |
|---|---|---|
| `core-evolution` | Core Evolution Gates | Node test runner 執行 `scripts/core-evolution/test/*.test.js` |
| `manual-recap` | Manual Recap／Deterministic Capture | 執行 `scripts/hooks/pixiu-deterministic-capture.test.js` |
| `auto-recap` | Auto Recap | 執行 `scripts/hooks/pixiu-auto-recap.test.js` |
| `lazy-loading` | Lazy Loading／Router／Skill Metadata | 執行 `scripts/performance/run-lazy-loading-tests.ps1` |
| `devspace-oneclick` | DevSpace OneClick | 執行 `scripts/devspace-portable/tests/run-tests.ps1` |
| `repository-safety` | Repository Safety | `git diff --check`、衝突標記與變更檔憑證樣式掃描 |
| `integration-all` | 完整整合測試 | 依序執行前六個模組，任一步失敗即停止 |

## 元件邊界

### Test Registry

只描述固定模組、執行檔、參數、工作目錄與整合順序。瀏覽器不能新增或修改命令。

### Run Manager

- 同時間只允許一個 active run。
- 記錄 queued／running／passed／failed／cancelled。
- 日誌保留最近固定字元數，避免長時間執行耗盡記憶體。
- 整合測試逐步執行，保留每個步驟結果。
- Server 關閉時停止仍在執行的 child process。

### HTTP API

- `GET /healthz`
- `GET /api/session`
- `GET /api/modules`
- `POST /api/runs`
- `GET /api/runs/:runId`
- `POST /api/runs/:runId/cancel`

所有寫入型 API 必須同時通過：

- loopback 綁定；
- 同源 `Origin`；
- `application/json`；
- 啟動時隨機產生的 `X-Pixiu-Test-Token`。

## UI

- 頂部顯示服務健康、目前 branch 與 active run。
- 每個模組一張卡片，提供說明、最近結果、單獨執行按鈕。
- 完整整合測試使用主要操作卡片。
- 下方日誌區顯示步驟、開始／結束時間、exit code 與輸出。
- UI 以原生 CSS 做響應式桌面版，不載入外部 CDN。

## 錯誤處理

- 未知 module ID：HTTP 404。
- 已有 active run：HTTP 409。
- 非同源或 token 不符：HTTP 403。
- body 過大或 JSON 無效：HTTP 400／413。
- executable 無法啟動：該 run 標記 failed，保留錯誤摘要。
- 測試非零 exit code：該模組 failed；整合測試停止後續步驟。

## 驗收條件

1. Registry、Run Manager、HTTP API 與 UI 契約都有自動測試。
2. 測試先紅後綠，不依賴外部 npm 套件。
3. 六個單模組可從 UI 分別執行。
4. 完整整合測試可一鍵依序執行並顯示各步驟結果。
5. Server 僅監聽 `127.0.0.1`，拒絕任意命令與跨來源寫入。
6. 現有 PixiuCore 全套測試重新通過。
7. README、整合計畫、相容性評估與 memory summary 更新至 2026-07-27 現況。
8. Git 工作樹乾淨，提交完成並成功 push 到設定的 `origin/master`。
