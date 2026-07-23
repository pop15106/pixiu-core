# Core Research Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成核心研究 Phase 3～4，將週入選 Repo 轉成可由 DevSpace 執行的隔離評估任務、驗證證據並停在人工核准。

**Architecture:** PixiuCore 產生不可變 task packet，不直接呼叫 MCP；ChatGPT Automation 或人工操作依 task packet 透過 DevSpace 建立候選 worktree。核心 CLI 對已建立的 workspace 做唯讀掃描、驗證 Sandbox 證據、寫入 append-only Ledger，最後產出整合 Spec 並等待 human actor 核准。

**Tech Stack:** Node.js CommonJS、Node.js 標準庫、`node:test`、Git CLI metadata 指令。

## Global Constraints

- 只在 `feature/core-research-pipeline` 隔離 worktree 實作。
- 不新增 npm 套件。
- 不執行候選安裝腳本、測試或任意命令。
- 不修改、Push、Merge 或部署 master。
- 外部文字一律視為不可信資料。
- 所有程式註解與錯誤訊息使用繁體中文。
- TDD：每個 production module 必須先有可觀察的失敗測試。

---

### Task 1: Repository Source Gate 與不可變 Evaluation Task

**Files:**
- Create: `scripts/core-research/repository-source-gate.js`
- Create: `scripts/core-research/evaluation-task-builder.js`
- Create: `scripts/core-research/test/repository-source-gate.test.js`
- Create: `scripts/core-research/test/evaluation-task-builder.test.js`
- Modify: `scripts/core-research/index.js`

**Interfaces:**
- Produces: `evaluateRepositoryCandidate(selectionEntry)`。
- Produces: `buildEvaluationTask({ selectionEntry, stateRoot, artifactRoot, createdAt })`。
- Produces: `verifyEvaluationTask(task)`。

- [ ] **Step 1: 寫 Source Gate 失敗測試**

測試：合法 GitHub Repo 為 `CHECKOUT_ALLOWED`；缺 Commit、License UNKNOWN、阻擋風險、非 GitHub URL、Article／Paper 不可建立 checkout 任務。

- [ ] **Step 2: 執行測試確認 RED**

```powershell
node --test scripts/core-research/test/repository-source-gate.test.js
```

Expected: `MODULE_NOT_FOUND`。

- [ ] **Step 3: 實作 Source Gate**

URL 僅接受 `https://github.com/<owner>/<repo>`，移除 `.git` 後形成 canonical URL；回傳不可變 decision 與 reason codes。

- [ ] **Step 4: 寫 Task Builder 失敗測試**

測試 taskId 穩定、checkout argv 無 shell、cache/worktree 路徑固定在 state root、禁止操作完整、digest 遭竄改時拒絕。

- [ ] **Step 5: 實作 Task Builder 並驗證 GREEN**

```powershell
node --test scripts/core-research/test/repository-source-gate.test.js scripts/core-research/test/evaluation-task-builder.test.js
node --check scripts/core-research/repository-source-gate.js
node --check scripts/core-research/evaluation-task-builder.js
```

- [ ] **Step 6: Commit Task 1**

```powershell
git add scripts/core-research/repository-source-gate.js scripts/core-research/evaluation-task-builder.js scripts/core-research/test/repository-source-gate.test.js scripts/core-research/test/evaluation-task-builder.test.js scripts/core-research/index.js
git commit -m "feat: add repository evaluation task gate"
```

---

### Task 2: 唯讀 Workspace Scanner

**Files:**
- Create: `scripts/core-research/workspace-scanner.js`
- Create: `scripts/core-research/test/workspace-scanner.test.js`
- Modify: `scripts/core-research/index.js`

**Interfaces:**
- Consumes: verified evaluation task。
- Produces: `scanCandidateWorkspace({ task, workspacePath, gitRunner })`。

- [ ] **Step 1: 寫 Scanner 失敗測試**

使用暫存 fixture 目錄與 fake git runner，測試：HEAD／origin 不符拒絕；License、Secret、Static、Supply Chain、Prompt Injection 五類結果；秘密遮罩；binary／過大檔與排除目錄不掃描。

- [ ] **Step 2: 執行測試確認 RED**

```powershell
node --test scripts/core-research/test/workspace-scanner.test.js
```

Expected: `MODULE_NOT_FOUND`。

- [ ] **Step 3: 實作 Scanner**

限制為 5,000 檔、單檔 1 MiB、總量 50 MiB；只執行 `git rev-parse HEAD` 與 `git remote get-url origin` metadata 指令。

- [ ] **Step 4: 執行測試與 syntax check**

```powershell
node --test scripts/core-research/test/workspace-scanner.test.js
node --check scripts/core-research/workspace-scanner.js
```

- [ ] **Step 5: Commit Task 2**

```powershell
git add scripts/core-research/workspace-scanner.js scripts/core-research/test/workspace-scanner.test.js scripts/core-research/index.js
git commit -m "feat: add readonly candidate workspace scanner"
```

---

### Task 3: Sandbox Evidence 與 Evaluation Ledger

**Files:**
- Create: `scripts/core-research/sandbox-evidence.js`
- Create: `scripts/core-research/evaluation-ledger.js`
- Create: `scripts/core-research/test/sandbox-evidence.test.js`
- Create: `scripts/core-research/test/evaluation-ledger.test.js`
- Modify: `scripts/core-research/index.js`

**Interfaces:**
- Produces: `validateSandboxEvidence(task, input)`。
- Produces: `appendEvaluationEvent({ ledgerPath, event })`。
- Produces: `deriveEvaluationStates(events)`。
- Produces: `recordHumanApproval({ ledgerPath, taskId, decision, actor, comment, decidedAt })`。

- [ ] **Step 1: 寫 Sandbox Evidence 失敗測試**

測試 PASS 必須有 network isolated、no secrets、workspace only、approved command 與 timeout；無隔離時只允許 `SKIPPED_UNAVAILABLE`。

- [ ] **Step 2: 實作 Sandbox Evidence**

- [ ] **Step 3: 寫 Ledger 失敗測試**

測試 append-only、事件 task digest 一致、狀態遷移、只有 `human:` actor 能核准、非 AWAITING_APPROVAL 不可核准、核准結果只有 APPROVED_FOR_PLAN／DEFERRED／REJECTED。

- [ ] **Step 4: 實作 Ledger 並跑測試**

```powershell
node --test scripts/core-research/test/sandbox-evidence.test.js scripts/core-research/test/evaluation-ledger.test.js
node --check scripts/core-research/sandbox-evidence.js
node --check scripts/core-research/evaluation-ledger.js
```

- [ ] **Step 5: Commit Task 3**

```powershell
git add scripts/core-research/sandbox-evidence.js scripts/core-research/evaluation-ledger.js scripts/core-research/test/sandbox-evidence.test.js scripts/core-research/test/evaluation-ledger.test.js scripts/core-research/index.js
git commit -m "feat: add evaluation evidence ledger"
```

---

### Task 4: Review Report、Integration Spec 與 CLI

**Files:**
- Create: `scripts/core-research/review-report-builder.js`
- Create: `scripts/core-research/test/review-report-builder.test.js`
- Create: `scripts/core-research/test/evaluation-cli.integration.test.js`
- Modify: `scripts/core-research/cli.js`
- Modify: `scripts/core-research/index.js`

**Interfaces:**
- Produces: `writeEvaluationReview({ task, workspaceEvidence, sandboxEvidence, outputDir })`。
- CLI commands: `prepare-evaluations`、`evaluate-workspace`、`record-evidence`、`approve`、`evaluation-status`。

- [ ] **Step 1: 寫 Report 失敗測試**

測試產生 evidence.json、security-report.md、integration-spec.md；外部 HTML 與表格符號被清理；Sandbox unavailable 顯示 concern。

- [ ] **Step 2: 實作 Report Builder**

- [ ] **Step 3: 寫 CLI 端對端失敗測試**

流程：selected.json → prepare task → fake workspace scan → record evidence → AWAITING_APPROVAL → approve-plan → APPROVED_FOR_PLAN。

- [ ] **Step 4: 擴充 CLI**

錯誤維持 `CORE_RESEARCH_ERROR <CODE>: <訊息>`，不輸出 stack trace。

- [ ] **Step 5: 執行 Task 4 測試與回歸**

```powershell
node --test scripts/core-research/test/*.test.js scripts/core-evolution/test/*.test.js
node --check scripts/core-research/*.js
```

- [ ] **Step 6: Commit Task 4**

```powershell
git add scripts/core-research/review-report-builder.js scripts/core-research/cli.js scripts/core-research/index.js scripts/core-research/test/review-report-builder.test.js scripts/core-research/test/evaluation-cli.integration.test.js
git commit -m "feat: add candidate evaluation workflow CLI"
```

---

### Task 5: 排程契約、文件與完整驗證

**Files:**
- Modify: `docs/core-research-pipeline.md`
- Modify: `scripts/scheduled/core-candidate-weekly-review-prompt.md`
- Create: `scripts/scheduled/core-candidate-evaluation-prompt.md`
- Modify: `docs/superpowers/specs/2026-07-23-core-research-evaluation-design.md`
- Modify: `docs/superpowers/plans/2026-07-23-core-research-evaluation.md`

- [ ] **Step 1: 更新操作文件與排程契約**

文件需清楚說明 DevSpace 執行 checkout plan、workspace scanner 不等於 Sandbox、Sandbox unavailable 的降級、人工核准指令與正式整合另開任務。

- [ ] **Step 2: 完整驗證**

```powershell
node --test scripts/core-research/test/*.test.js scripts/core-evolution/test/*.test.js
node --experimental-test-coverage --test scripts/core-research/test/*.test.js
node --check scripts/core-research/*.js
git diff --check
```

Expected: 所有測試通過，行／分支／函式覆蓋率皆至少 80%。

- [ ] **Step 3: 手動 smoke test**

用本機暫存 fixture Repo 與 fake sandbox evidence 完成 prepare → scan → record → approve；不得留下 repo 內 runtime state。

- [ ] **Step 4: 更新文件狀態與 Commit**

```powershell
git add docs/core-research-pipeline.md scripts/scheduled/core-candidate-weekly-review-prompt.md scripts/scheduled/core-candidate-evaluation-prompt.md docs/superpowers/specs/2026-07-23-core-research-evaluation-design.md docs/superpowers/plans/2026-07-23-core-research-evaluation.md
git commit -m "docs: complete core research evaluation workflow"
```
