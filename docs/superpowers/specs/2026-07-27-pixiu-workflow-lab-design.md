# PixiuCore Workflow Lab 設計

- 日期：2026-07-27
- 狀態：approved-by-request
- 範圍：角色型 AI Workflow 測試控制台
- 既有平台：保留 `scripts/test-console/`，不改變既有平台底座測試定位

## 1. 目標

建立獨立的 `Workflow Lab`，讓使用者輸入自然語言需求或商業邏輯後，可以：

1. 單獨測試轉譯器、決策／路由、PM、SA、SD、PG、QA、檢核官、文件、Need-to-Know、人工核准與記憶候選模組。
2. 選擇部分模組，依預設順序或進階自訂順序執行。
3. 執行完整端到端角色工作流。
4. 在 Offline Contract 與 Live Smoke 之間切換。
5. 比較 Need-to-Know 遮罩與原文直通結果。
6. 在 Live PG 階段使用隔離 Git Worktree 修改程式並執行測試。
7. 在 QA／檢核官 RED 時暫停，顯示建議退回角色，等待使用者確認。

現有 `scripts/test-console/` 繼續驗證 PixiuCore 平台底座，包括 Core Evolution、Recap、Lazy Loading、DevSpace 與 Repository Safety；Workflow Lab 不取代它。

## 2. 核准決策

| 項目 | 決策 |
|---|---|
| 執行模式 | 混合模式：預設 Offline Contract，另提供 Live Smoke |
| Live PG | 僅在隔離 Worktree 修改與測試；禁止直接修改原 checkout |
| 部分流程排序 | 預設固定順序，可開啟進階模式自訂；不安全順序需明確開關 |
| 商業邏輯處理 | 預設 Need-to-Know 遮罩，可切換原文直通比較 |
| RED 處理 | 暫停並顯示建議退回角色，由使用者確認後才重跑 |
| 專案選擇 | Fleet 選擇或輸入授權範圍內路徑 |
| 原文保存 | 僅存在本次 Run 記憶體，不寫入 Repo、Vault、Recap 或 Artifact |
| Live Session | 每個角色使用獨立 Fresh Codex Session |
| Push／Merge／Deploy | 全部禁止 |
| 外部依賴 | 不新增 npm 或其他外部依賴，使用 Node.js 內建模組與原生 Web UI |

## 3. 架構

```text
瀏覽器 Workflow Lab
        │
        ▼
Loopback HTTP Server
        │
        ├─ Session Token／Origin／Body Limit
        ├─ Workflow Catalog
        ├─ Workflow Run Manager
        ├─ Approval Manager
        └─ Artifact API
                │
                ▼
Workflow Engine
        ├─ Input Redaction Layer
        ├─ Role Task Package Builder
        ├─ Offline Contract Runner
        ├─ Live Smoke Runner
        ├─ Project Validator
        ├─ Worktree Manager
        ├─ Fresh Session Launcher
        ├─ Gate Evaluator
        └─ Artifact Store
```

### 3.1 元件邊界

#### Workflow Catalog

定義可執行模組、預設順序、輸入需求、輸出 Schema、專案存取權限及 Live 能力。瀏覽器不能提供 executable、args 或任意 shell 命令。

#### Workflow Engine

接收一份 `WorkflowRequest`，依指定模組建立受控步驟。所有步驟只透過明確介面交換 Artifact，不共享隱藏 Session 狀態。

#### Offline Contract Runner

使用本機固定 Fixture 與規則驗證模組契約，不呼叫 Codex、不修改專案。它負責快速、穩定且可重現的日常回歸。

#### Live Smoke Runner

以獨立 Fresh Codex Session 執行角色。第一版 Live Runner 必須透過可注入的 `RoleExecutor` 介面實作；若本機沒有可驗證的 Codex CLI 啟動契約，Live 模式顯示 unavailable，不假裝已執行。

#### Worktree Manager

只在 Live PG 需要寫入時建立隔離 Worktree。工作目錄不可等於來源 checkout，且 Run 結束後不自動刪除，保留給使用者檢查。

#### Approval Manager

管理 `paused` Run。建立 Worktree、啟用原文直通、RED 退回、危險順序與其他高風險行為都需要明確核准。

#### Artifact Store

只保存遮罩後 Task Package、角色產物、測試證據與核准紀錄。原始需求、原始商業邏輯及遮罩對照表只存在記憶體。

## 4. 執行模式

### 4.1 單模組

可選：

- translator
- router
- pm
- checker
- sa
- sd
- pg
- qa
- documentation
- need-to-know
- approval-gate
- memory-candidate

單模組可使用：

1. `strict`：使用者提供必要上游產物。
2. `assisted-fixture`：系統建立合成 Fixture；Fixture 必須標記 `synthetic: true`，不列入被測模組品質判定。

### 4.2 部分流程

預設順序：

```text
translator → router → pm → checker → sa → checker → sd → checker → pg → qa → approval-gate → documentation → memory-candidate
```

一般模式只能跳過模組，不改變順序。進階模式可自訂順序；若依賴不成立，預設阻擋。只有開啟 `allowUnsafeOrder` 並核准後才允許刻意測試異常流程。

### 4.3 全模組整合

使用上列完整順序。任一模組 ERROR 或 RED 時停止後續執行；RED 進入 `paused`，等待退回決策。

### 4.4 A/B 比較

同一份輸入可建立兩條執行分支：

- `need-to-know`
- `raw-pass-through`

比較：

- 角色可見欄位
- 敏感資訊暴露數
- Artifact Schema 完整度
- QA／檢核結果
- 執行時間
- Live 模式可取得時的 Token 使用量

原文分支的內容及輸出不持久化。

## 5. 共用資料契約

### 5.1 WorkflowRequest

```json
{
  "mode": "offline",
  "inputMode": "need-to-know",
  "selectionMode": "partial",
  "fixtureMode": "strict",
  "requirement": "使用者輸入需求",
  "businessLogic": "使用者輸入商業邏輯",
  "expectedOutcome": "預期結果",
  "constraints": ["限制"],
  "sensitiveTerms": ["客戶名稱"],
  "acceptanceCriteria": ["可驗證條件"],
  "project": {
    "source": "fleet",
    "path": "C:\\PixiuCore"
  },
  "moduleSequence": ["translator", "pm", "sa"],
  "advancedOrder": false,
  "allowUnsafeOrder": false
}
```

`requirement` 與 `businessLogic` 至少一項非空。Server 不將兩欄寫入 JSON Artifact 或 Log。

### 5.2 RoleTaskPackage

```json
{
  "runId": "uuid",
  "moduleId": "sa",
  "objective": "分析需求對現行系統的影響",
  "allowedInputs": {},
  "projectAccess": "read-only",
  "constraints": [],
  "expectedOutputSchema": "sa-artifact-v1",
  "canaryTokens": []
}
```

### 5.3 ModuleResult

```json
{
  "moduleId": "sa",
  "status": "GREEN",
  "artifact": {},
  "evidence": [],
  "warnings": [],
  "exposureReport": {
    "sensitiveMatches": [],
    "canaryLeaks": []
  },
  "startedAt": "ISO-8601",
  "finishedAt": "ISO-8601"
}
```

### 5.4 WorkflowRun

狀態：

- queued
- running
- paused
- green
- red
- failed
- cancelled

Run Snapshot 不回傳原文需求、原始商業邏輯、遮罩對照表、executable 或完整內部 Prompt。

## 6. 模組契約

### 6.1 Translator

輸入原文與敏感詞；輸出正規化需求、遮罩後商業規則、名詞代碼與暴露報告。

Offline 驗證：

- 敏感詞不出現在遮罩 Artifact。
- 邏輯運算符、順序、數值與條件關係保留。
- Canary Secret 不得出現在後續未授權 Artifact。
- 空輸入、超長輸入與特殊字元 fail closed。
- 原文不進入 Run Log 或 Artifact Store。

### 6.2 Router

輸出實際流程、角色資料權限、Worktree 需求、人工核准點與退回規則。

Offline 驗證：

- 一般模式保持固定順序。
- 模組依賴不成立時阻擋。
- PG Live 一律要求 Worktree。
- QA 不取得 PG 思考過程。
- 原文直通與危險順序插入核准點。

### 6.3 PM

輸出問題陳述、目標、Scope、Out of Scope、需求、非功能需求、驗收條件、未知事項、依賴與風險。

檢核條件：必填欄位完整；需求可追溯至驗收條件；不越權產生程式設計；未知事項不得當成事實。

### 6.4 Checker

可插入任意角色後。只輸出 GREEN／RED、原因、證據及建議退回角色，不修改產物。

### 6.5 SA

輸出 As-Is、商業規則、資料流、呼叫鏈、影響範圍、根因或未確認事項、方案與回歸風險。Live Session 使用唯讀專案權限，來源需附檔案與行號。

### 6.6 SD

輸出 To-Be、架構邊界、API／DB／事件契約、交易與錯誤處理、安全設計、ADR、實作計畫、測試策略及回滾方案。

### 6.7 PG

Offline 僅驗證 Task Package、白名單範圍、測試命令、Worktree 與禁止 Push／Merge／Deploy 契約。

Live 流程：

1. 驗證 Git Repo。
2. 建立隔離 Worktree。
3. 建立 Fresh Codex Session。
4. 只允許修改 Worktree。
5. 執行修改與測試。
6. 保存遮罩後 Diff 摘要、完整 Diff 檔案路徑及測試證據。
7. 不 Push、不 Merge、不 Deploy。

### 6.8 QA

取得驗收條件、商業規則、設計契約、PG Diff 與測試證據，不取得 PG 推理。Live QA 使用新的 Fresh Session，可在 Worktree 執行 Build、Test、Lint、API、E2E 與安全掃描，但不可修改正式程式。

### 6.9 Documentation

只取得已核准且遮罩後產物，輸出 PRD、SA／SD 摘要、實作摘要、測試報告、Release Note、部署／回滾說明及最終交付摘要。

### 6.10 Need-to-Know

顯示每個角色允許及拒絕的資料欄位。加入 Canary Secret 驗證隔離；任何未授權產物包含 Canary 即 RED。

### 6.11 Approval Gate

必須在下列事件暫停：

- 啟用原文直通
- 允許不安全順序
- 建立 Live PG Worktree
- QA／Checker RED 後重跑
- DB 寫入、刪檔、依賴變更、Push、Merge、Deploy 請求

最後六項仍受 Pixiu L0 閘門限制；Workflow Lab 不提供 Push、Merge 或 Deploy 實作。

### 6.12 Memory Candidate

只產生遮罩後 Recap、Decision、Observation 候選。第一版不直接寫正式 Vault；使用者確認後才由既有正式記憶流程處理。

## 7. UI 設計

### 7.1 頁面區塊

1. **需求輸入**：需求、商業邏輯、預期結果、限制、敏感詞與驗收條件。
2. **專案與模式**：Offline／Live、Fleet／手動路徑、Need-to-Know／原文直通。
3. **流程編排**：單模組、部分流程、完整流程；一般模式 Checkbox，進階模式提供上下移動排序。
4. **執行摘要**：目前狀態、模組、Worktree、核准點與耗時。
5. **模組結果**：每步 GREEN／RED／FAILED、Schema、警告與暴露報告。
6. **Artifact**：只顯示遮罩後資料；原文只在本次瀏覽器 Session 的受控區塊顯示。
7. **人工核准**：顯示原因、建議退回角色與核准／拒絕按鈕。
8. **Log**：只顯示已遮罩的流程事件，不回顯原始輸入或完整 Prompt。

### 7.2 安全 UI 行為

- 原文直通使用明顯警告樣式並要求二次確認。
- Live Smoke 顯示「會建立隔離 Worktree，但不 Push／Merge／Deploy」。
- Run 執行中停用其他執行按鈕。
- Browser refresh 後無法重新取得原文；只恢復遮罩後 Run Snapshot。
- Copy Artifact 預設只複製遮罩後內容。

## 8. HTTP API

- `GET /healthz`
- `GET /api/session`
- `GET /api/modules`
- `GET /api/projects`
- `POST /api/runs`
- `GET /api/runs/:runId`
- `POST /api/runs/:runId/cancel`
- `POST /api/runs/:runId/approve`
- `POST /api/runs/:runId/reject`
- `GET /api/runs/:runId/artifacts/:artifactId`

所有寫入 API 要求：

- loopback
- 同源 Origin
- `application/json`
- 啟動時隨機 `X-Pixiu-Workflow-Token`
- body size limit

API 不接受 executable、args、cwd、Prompt Template 或任意 shell。

## 9. 錯誤與回復

| 情境 | 行為 |
|---|---|
| 輸入缺失 | HTTP 400，Run 不建立 |
| 模組未知 | HTTP 404 |
| 順序依賴錯誤 | HTTP 400；若 allowUnsafeOrder 未核准則阻擋 |
| 已有 active run | HTTP 409 |
| Origin／Token 錯誤 | HTTP 403 |
| body 過大 | HTTP 413 |
| Live Executor 不可用 | Run failed，錯誤碼 `LIVE_EXECUTOR_UNAVAILABLE` |
| Project 不在允許範圍 | Run failed，錯誤碼 `PROJECT_NOT_ALLOWED` |
| Worktree 建立失敗 | Run failed，不退回修改原 checkout |
| 模組 RED | Run paused，等待退回決定 |
| 模組程序非零 | Run failed，停止後續步驟 |
| Canary 洩漏 | Run red，建議退回 Translator／Router |
| 取消 | 終止目前子程序，狀態 cancelled |
| Server 關閉 | 要求取消 active process，不刪 Worktree |

## 10. 持久化政策

允許保存：

- 遮罩後 WorkflowRequest
- 模組順序與設定
- 遮罩後 RoleTaskPackage
- Module Result
- 測試與 Diff 證據
- 核准紀錄
- Worktree 路徑

禁止保存：

- 原始 requirement
- 原始 businessLogic
- 遮罩對照表
- Canary 原值
- 完整內部 Prompt
- Fresh Session transcript
- Secret、Token、密碼與 PII

第一版 Artifact Store 使用 Run 記憶體與可選本機 `artifacts/workflow-lab/<runId>/`。寫檔前經 Redaction Layer；Offline 自動測試使用臨時目錄。

## 11. 第一版範圍

### 必須完成

- 獨立 Workflow Lab Web UI 與安全 API。
- 模組 Catalog。
- 單模組、部分流程、完整流程。
- 一般／進階排序與依賴驗證。
- Offline Contract Runner。
- Translator 遮罩、Canary、原文不落地驗證。
- 模組 Artifact Schema 與 Gate。
- RED 暫停、人工 Approve／Reject。
- Live Executor 介面、Project Validator、Worktree Contract。
- 實際 Codex Live 啟動能力偵測與 unavailable 誠實回報。
- 新舊控制台互不影響。

### 不納入第一版

- 自動 Push、Merge、PR 或 Deploy。
- DB 寫入。
- 真實 Vault 自動寫入。
- 多代理並行。
- 任意 Shell Web Terminal。
- 雲端服務或遠端公開存取。
- 新增 npm 依賴。

## 12. 測試策略

### 單元測試

- Catalog 與依賴。
- WorkflowRequest 驗證。
- Redaction 與 Canary。
- Task Package 權限過濾。
- Run 狀態機。
- Approval 暫停／恢復。
- Artifact Store 禁止原文。
- Project Allowlist。
- Worktree 不能回退原 checkout。

### API 契約

- Health、Session、Modules、Projects。
- Run 建立、查詢、取消、核准、拒絕。
- Token、Origin、Content-Type、Body Limit。
- Snapshot 不含原文與 executable。

### 整合測試

- Translator 單模組。
- PM 單模組 Strict／Synthetic Fixture。
- `translator → pm → sa`。
- `sa → sd → pg` Offline Contract。
- `pg → qa → documentation`。
- 完整流程 GREEN。
- Checker／QA RED 暫停與人工退回。
- Need-to-Know Canary 洩漏。
- 原文直通核准。
- 不安全順序核准。
- Live Executor unavailable。
- 原文不落地掃描。

### E2E／真實 Web API

使用隨機 port 啟動 Server，透過 HTTP 執行單模組、部分流程、完整 Offline Flow 與 RED 核准流程，最後關閉 Server。

## 13. 驗收條件

1. 現有 Test Console 測試保持全綠。
2. Workflow Lab 可自行輸入需求或商業邏輯。
3. 至少十二個模組可獨立執行 Offline Contract。
4. 使用者可勾選任意合法模組子集。
5. 進階模式可調整順序；不安全順序預設阻擋。
6. 完整整合流程可執行並顯示每步結果。
7. RED 時暫停並要求人工決定。
8. Need-to-Know 與原文直通可 A/B 比較。
9. 原始輸入不出現在 Run Snapshot、Artifact、Log 或測試檔。
10. Live PG 契約要求隔離 Worktree，禁止回退原 checkout。
11. Live Codex 不可用時明確失敗，不模擬成功。
12. Server 只監聽 `127.0.0.1`，不接受任意命令。
13. 不新增外部依賴。
14. Node syntax、單元、API、整合、現有控制台回歸與 Repository Safety 全部通過。
