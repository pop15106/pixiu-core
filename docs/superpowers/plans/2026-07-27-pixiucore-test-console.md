# PixiuCore Test Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立本機安全的 PixiuCore Web 測試控制台，支援各模組單獨測試與完整整合測試，並完成文件校準、驗證、提交與推送。

**Architecture:** 使用 Node.js 內建 HTTP server 提供靜態 UI 與固定白名單測試 API。Test Registry 定義可執行模組，Run Manager 控制單一 active run、日誌與整合序列；瀏覽器只能以同源 token 呼叫固定模組，不能提供任意 shell 命令。

**Tech Stack:** Node.js 24、原生 HTML/CSS/JavaScript、PowerShell 5.1 相容腳本、Node test runner、Git。

## Global Constraints

- 不啟用 Agent Team 或任何子代理。
- 直接在使用者已授權的 `master` checkout 收尾。
- 不新增 npm、NuGet 或其他外部依賴。
- Web server 只監聽 `127.0.0.1`。
- API 只執行白名單 executable 與 args，不接受任意命令。
- 同時間最多一個測試 run。
- 整合測試依序執行，任一步非零 exit code 即停止。
- 所有程式註解與 UI 文字使用繁體中文。
- 完成前必須重新執行全部現有測試與新的 Web UI 測試。
- Git push 只在測試、文件 read-back 與工作樹檢查全部通過後執行。

---

### Task 1: 建立測試控制台核心契約

**Files:**
- Create: `scripts/test-console/test-console.test.js`
- Create: `scripts/test-console/test-registry.js`
- Create: `scripts/test-console/run-manager.js`

**Interfaces:**
- Produces: `createTestRegistry(rootDir)`、`createRunManager(options)`。

- [x] **Step 1: 先建立 Registry 與 Run Manager 行為測試**
- [x] **Step 2: 執行 `node --test scripts/test-console/test-console.test.js`，確認因模組不存在而失敗**
- [x] **Step 3: 實作固定模組 Registry、整合序列、單一 active run、bounded log 與取消行為**
- [x] **Step 4: 重新執行測試並確認通過**

### Task 2: 建立安全 HTTP API

**Files:**
- Modify: `scripts/test-console/test-console.test.js`
- Create: `scripts/test-console/server.js`

**Interfaces:**
- Consumes: `createTestRegistry(rootDir)`、`createRunManager(options)`。
- Produces: `createTestConsoleServer(options)` 與 CLI 啟動入口。

- [x] **Step 1: 先加入 health、module list、run API、token、Origin、body limit 測試**
- [x] **Step 2: 執行測試確認新案例失敗**
- [x] **Step 3: 實作 loopback server、靜態檔案、session token 與 API 驗證**
- [x] **Step 4: 執行測試確認全綠**

### Task 3: 建立 Web UI

**Files:**
- Modify: `scripts/test-console/test-console.test.js`
- Create: `scripts/test-console/public/index.html`
- Create: `scripts/test-console/public/app.js`
- Create: `scripts/test-console/public/styles.css`

**Interfaces:**
- Consumes: `/api/session`、`/api/modules`、`/api/runs`。
- Produces: 模組卡片、整合測試入口、狀態摘要與日誌檢視。

- [x] **Step 1: 先加入靜態 UI 契約測試，檢查模組容器、整合按鈕、日誌區與 token header 使用**
- [x] **Step 2: 執行測試確認 UI 檔不存在而失敗**
- [x] **Step 3: 實作原生 HTML/CSS/JavaScript UI**
- [x] **Step 4: 執行測試確認全綠**

### Task 4: 補啟動與使用文件

**Files:**
- Create: `scripts/test-console/README.md`
- Modify: `README.md`

**Interfaces:**
- Produces: `node scripts/test-console/server.js --open` 使用入口與手動 CLI 測試命令。

- [x] **Step 1: 記錄啟動、模組、整合測試、限制與故障排除方式**
- [x] **Step 2: read-back 文件，確認 UTF-8 與路徑有效**

### Task 5: 校準 PixiuCore 現況文件

**Files:**
- Modify: `docs/superpowers/plans/2026-07-27-pixiucore-workflow-convergence.md`
- Modify: `docs/architecture/pixiucore-merge-compatibility-assessment.md`
- Modify: `vault/memory/memory-summary.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: 與目前 master、OneClick state、測試數量與待辦一致的文件。

- [x] **Step 1: 修正「尚未 commit／merge」與「OneClick state 未修」的過期敘述**
- [x] **Step 2: 更新 memory summary 至 2026-07-27**
- [x] **Step 3: 修復 `.gitignore` 亂碼註解並保留原規則**
- [x] **Step 4: read-back 所有修改文件**

### Task 6: 單模組與整合驗證

**Files:**
- Modify: `docs/superpowers/plans/2026-07-27-pixiucore-test-console.md`

**Interfaces:**
- Consumes: 所有新舊測試入口。
- Produces: 可重現的驗證結果。

- [x] **Step 1: 執行新的 Test Console 自動測試**
- [x] **Step 2: 執行 Core Evolution、Manual Recap、Auto Recap、Lazy Loading、DevSpace OneClick**
- [x] **Step 3: 啟動 Web server，驗證 `/healthz`、module list 與靜態 UI**
- [x] **Step 4: 透過 Web API 執行至少一個單模組測試與 `integration-all`**
- [x] **Step 5: 執行 `git diff --check`、衝突標記與憑證樣式掃描**
- [x] **Step 6: 將實際結果回填本計畫**

## Verification Result

- Node syntax：`test-registry.js`、`run-manager.js`、`server.js`、`repository-safety.js` 全部通過 `node --check`。
- Test Console 契約：`10 / 10`。
- Core Evolution：`16 / 16`。
- Manual Recap／Deterministic Capture：`41 / 41`。
- Auto Recap：`6 / 6`。
- Lazy Loading／Router／Skill Metadata：`30 / 30`。
- DevSpace OneClick：`77 / 77`。
- Web API 真實整合：先跑 `core-evolution` 單模組，再跑六步驟 `integration-all`，全部通過。
- Startup profile：Codex `6,705 / 8,192 bytes`、Claude `3,939 / 6,144 bytes`、Gemini `3,963 / 6,144 bytes`。
- Skill metadata：canonical `90`、portable `87`，均為 `0` warning；raw/effective collision `87 / 0`。
- Repository Safety、`git diff --check` 與衝突標記掃描：通過。

### Task 7: 提交與推送

**Files:**
- All files from Tasks 1-6.

**Interfaces:**
- Produces: clean `master` 與更新後的 `origin/master`。

- [x] **Step 1: `git fetch --prune origin` 並確認沒有未處理的遠端分歧**
- [x] **Step 2: 檢查最終 diff 與工作樹範圍**
- [ ] **Step 3: 建立收尾 commit**
- [ ] **Step 4: `git push origin master`**
- [ ] **Step 5: 重新確認本機 HEAD、遠端追蹤分支與工作樹乾淨**
