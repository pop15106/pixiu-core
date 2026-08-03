# PixiuCore Workflow Lab Implementation Plan

- 執行狀態：第一版已整合到 master 工作目錄；Offline、Web API 與真實 Codex 角色鏈均通過，尚待 Git commit／push
- 原實作分支：`feature/pixiu-workflow-lab`
- Live Smoke 隔離 Worktree：`C:\Users\pop15\.devspace\worktrees\PixiuCore-70248e41`

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The user requested inline execution for this work; do not dispatch subagents.

**Goal:** 建立獨立的角色型 Workflow Lab，支援自訂需求／商業邏輯、單模組、部分流程、全流程、Need-to-Know、人工 RED／GREEN、Offline Contract 與真實 Codex Live Smoke。

**Architecture:** 保留既有 `scripts/test-console/`，新增 `scripts/workflow-lab/`。Workflow Engine 與 HTTP/UI 分離；Offline Runner 以固定契約回歸，Live Runner 使用 `codex exec --ephemeral` 建立 Fresh Session。PG Live 只在隔離 Git Worktree 使用 `workspace-write`，其餘角色使用 `read-only`。

**Tech Stack:** Node.js 24 內建模組、原生 HTML/CSS/JavaScript、Node test runner、PowerShell 5.1、Git Worktree、Codex CLI。

## Global Constraints

- 不啟用 Agent Team、子代理或平行派工。
- 不新增 npm、NuGet、Python 或其他外部依賴。
- 保留現有 `scripts/test-console/` 行為與測試。
- 新 Server 只監聽 `127.0.0.1`。
- API 不接受 executable、args、cwd、Prompt Template 或任意 shell。
- 原始 requirement、businessLogic、遮罩對照表、Canary 原值與完整 Prompt 不得落地。
- Live 每個角色使用獨立 `codex exec --ephemeral`。
- Live PM／SA／SD／QA／文件使用 `--sandbox read-only`。
- Live PG 只能使用隔離 Worktree 與 `--sandbox workspace-write`。
- Worktree 建立失敗時直接失敗，不退回修改原 checkout。
- 禁止 Push、Merge、Deploy、DB 寫入、刪除來源專案檔案與依賴變更。
- QA／Checker RED 時進入 `paused`，等待使用者核准退回角色。
- 所有程式註解、UI 與錯誤訊息使用繁體中文。
- 每項 Production Code 必須先有可觀察的 failing test。

---

## File Map

### 核心契約

- `scripts/workflow-lab/workflow-catalog.js`：模組定義、固定順序、依賴與權限。
- `scripts/workflow-lab/request-validator.js`：WorkflowRequest 正規化與錯誤碼。
- `scripts/workflow-lab/redaction.js`：敏感詞遮罩、Canary、持久化前掃描。
- `scripts/workflow-lab/task-package.js`：按角色建立 Need-to-Know Task Package。
- `scripts/workflow-lab/artifact-store.js`：只保存遮罩後 Artifact。

### 執行核心

- `scripts/workflow-lab/offline-runner.js`：Offline Contract 模組實作。
- `scripts/workflow-lab/workflow-engine.js`：模組串接、狀態機、RED 與 Approval。
- `scripts/workflow-lab/project-validator.js`：Fleet／手動路徑與 Git 檢查。
- `scripts/workflow-lab/worktree-manager.js`：Live PG 隔離 Worktree。
- `scripts/workflow-lab/codex-live-executor.js`：Fresh Codex Session、Schema 與 sandbox。
- `scripts/workflow-lab/run-manager.js`：單一 active run、取消、等待與 snapshot。

### Web

- `scripts/workflow-lab/server.js`：loopback HTTP API 與靜態資源。
- `scripts/workflow-lab/public/index.html`：需求、流程、模式、核准、結果與 Artifact UI。
- `scripts/workflow-lab/public/app.js`：Client 狀態、排序、API、輪詢與核准。
- `scripts/workflow-lab/public/styles.css`：響應式介面。

### 測試與文件

- `scripts/workflow-lab/workflow-lab.test.js`：核心單元與契約測試。
- `scripts/workflow-lab/web-api-integration.test.js`：真實 Server API 整合。
- `scripts/workflow-lab/README.md`：啟動、模式、安全邊界與 Live 使用方式。
- `README.md`：加入 Workflow Lab 入口，但保留 Test Console 章節。

---

### Task 1: Workflow Catalog、Request Validation 與 Redaction

**Files:**
- Create: `scripts/workflow-lab/workflow-lab.test.js`
- Create: `scripts/workflow-lab/workflow-catalog.js`
- Create: `scripts/workflow-lab/request-validator.js`
- Create: `scripts/workflow-lab/redaction.js`

**Interfaces:**
- Produces: `createWorkflowCatalog()`、`normalizeWorkflowRequest(input, options)`、`createRedactor(input)`。
- `createWorkflowCatalog()` returns `{ list(), get(id), validateSequence(ids, options), defaultSequence }`。
- `normalizeWorkflowRequest()` returns a frozen normalized request without persistence side effects。
- `createRedactor()` returns `{ redactText(), redactValue(), assertSafeForPersistence(), createCanary() }`。

- [ ] **Step 1: Write failing Catalog tests**

```javascript
const catalog = createWorkflowCatalog();
assert.deepEqual(
  catalog.defaultSequence,
  ['translator', 'router', 'pm', 'checker-pm', 'sa', 'checker-sa', 'sd', 'checker-sd', 'pg', 'qa', 'approval-gate', 'documentation', 'memory-candidate']
);
assert.equal(catalog.get('pg').liveAccess, 'worktree-write');
assert.equal(catalog.get('qa').liveAccess, 'worktree-read');
assert.throws(
  () => catalog.validateSequence(['pg', 'pm'], { advancedOrder: false, allowUnsafeOrder: false }),
  /一般模式只能依固定順序/
);
```

- [ ] **Step 2: Run Catalog tests and verify RED**

Run: `node --test --test-name-pattern="Workflow Catalog" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because `workflow-catalog.js` does not exist.

- [ ] **Step 3: Implement minimal Catalog**

Define exactly these module IDs:

```text
translator, router, pm, checker-pm, sa, checker-sa, sd, checker-sd,
pg, qa, approval-gate, documentation, memory-candidate, need-to-know
```

Each module includes `id`、`name`、`kind`、`requiredArtifacts`、`produces`、`offline`、`liveAccess`、`defaultOrder`。

- [ ] **Step 4: Run Catalog tests and verify GREEN**

Run: same command.
Expected: all matching tests pass.

- [ ] **Step 5: Write failing WorkflowRequest tests**

```javascript
assert.throws(
  () => normalizeWorkflowRequest({ requirement: '', businessLogic: '' }),
  /需求與商業邏輯至少填一項/
);
const request = normalizeWorkflowRequest({
  mode: 'offline',
  selectionMode: 'partial',
  requirement: '新增帳單審核',
  businessLogic: '',
  moduleSequence: ['translator', 'pm']
});
assert.deepEqual(request.moduleSequence, ['translator', 'pm']);
assert.equal(request.inputMode, 'need-to-know');
```

Cover invalid enum、duplicate module、unknown module、overlong input、unsafe order without approval and raw pass-through approval requirement.

- [ ] **Step 6: Run Request tests and verify RED**

Run: `node --test --test-name-pattern="WorkflowRequest" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because validator is missing.

- [ ] **Step 7: Implement minimal Request Validator**

Limits:

```javascript
const LIMITS = Object.freeze({
  requirementChars: 50000,
  businessLogicChars: 100000,
  expectedOutcomeChars: 20000,
  constraintCount: 100,
  sensitiveTermCount: 200,
  acceptanceCriteriaCount: 200
});
```

Return structured errors with `code` and `message`.

- [ ] **Step 8: Write failing Redaction tests**

```javascript
const redactor = createRedactor({ sensitiveTerms: ['太平洋電線'], canaryFactory: () => 'CANARY-ABC' });
assert.equal(redactor.redactText('客戶太平洋電線'), '客戶{{SENSITIVE_1}}');
assert.throws(
  () => redactor.assertSafeForPersistence({ text: '太平洋電線' }),
  /PERSISTENCE_SENSITIVE_CONTENT/
);
assert.throws(
  () => redactor.assertSafeForPersistence({ text: 'CANARY-ABC' }),
  /CANARY_LEAK/
);
```

Also test nested arrays／objects、special regex characters、numeric business conditions preserved and no mutation.

- [ ] **Step 9: Run Redaction tests and verify RED**

Run: `node --test --test-name-pattern="Redaction" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because redaction implementation is missing.

- [ ] **Step 10: Implement minimal Redaction Layer**

Use literal string replacement sorted by descending term length. Never construct unescaped regex from user content. Canary values exist only in closure memory.

- [ ] **Step 11: Run Task 1 tests and full existing Test Console regression**

Run:

```powershell
node --test scripts/workflow-lab/workflow-lab.test.js
node --test scripts/test-console/test-console.test.js
```

Expected: both pass.

- [ ] **Step 12: Commit Task 1**

```bash
git add scripts/workflow-lab/workflow-lab.test.js scripts/workflow-lab/workflow-catalog.js scripts/workflow-lab/request-validator.js scripts/workflow-lab/redaction.js
git commit -m "feat: add workflow lab contracts"
```

---

### Task 2: Need-to-Know Task Packages 與 Artifact Store

**Files:**
- Modify: `scripts/workflow-lab/workflow-lab.test.js`
- Create: `scripts/workflow-lab/task-package.js`
- Create: `scripts/workflow-lab/artifact-store.js`

**Interfaces:**
- Consumes: Catalog module definitions and Redactor.
- Produces: `createTaskPackageBuilder(options)` and `createArtifactStore(options)`。
- Task builder method: `build({ runId, moduleId, request, artifacts, canaryTokens })`。
- Artifact store methods: `save({ runId, moduleId, type, value, persistence })`、`get(id)`、`list(runId)`。

- [ ] **Step 1: Write failing Need-to-Know tests**

Test that:

```javascript
const task = builder.build({ moduleId: 'qa', request, artifacts, canaryTokens: ['CANARY-X'] });
assert.ok(task.allowedInputs.acceptanceCriteria);
assert.ok(task.allowedInputs.designContract);
assert.equal(task.allowedInputs.rawBusinessLogic, undefined);
assert.equal(task.allowedInputs.pgReasoning, undefined);
assert.deepEqual(task.canaryTokens, ['CANARY-X']);
```

PM receives translated requirement only; SA receives approved PM artifact and read-only project info; SD receives PM + SA; PG receives approved design and allowed file scope; documentation receives approved artifacts only.

- [ ] **Step 2: Run Need-to-Know tests and verify RED**

Run: `node --test --test-name-pattern="Need-to-Know" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because builder is missing.

- [ ] **Step 3: Implement Task Package Builder**

Use an explicit allowlist per module. Do not copy the full request then delete fields.

- [ ] **Step 4: Write failing Artifact Store tests**

```javascript
const store = createArtifactStore({ redactor, now: fixedNow, idFactory });
assert.throws(
  () => store.save({ runId: 'run-1', moduleId: 'pm', type: 'pm-artifact-v1', value: { text: '太平洋電線' }, persistence: 'durable' }),
  /PERSISTENCE_SENSITIVE_CONTENT/
);
const saved = store.save({ runId: 'run-1', moduleId: 'pm', type: 'pm-artifact-v1', value: { text: '{{SENSITIVE_1}}' }, persistence: 'durable' });
assert.equal(store.get(saved.id).value.text, '{{SENSITIVE_1}}');
```

Verify deep clone、bounded artifact size、memory-only artifacts excluded from `listDurable()` and snapshots never expose internal references.

- [ ] **Step 5: Run Artifact tests and verify RED**

Run: `node --test --test-name-pattern="Artifact Store" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because store is missing.

- [ ] **Step 6: Implement Artifact Store**

Maximum durable artifact serialized size: `500000` bytes. Reject functions、symbols、cyclic objects and dangerous prototype keys.

- [ ] **Step 7: Run Task 2 tests**

Run: `node --test scripts/workflow-lab/workflow-lab.test.js`
Expected: all tests pass.

- [ ] **Step 8: Commit Task 2**

```bash
git add scripts/workflow-lab
git commit -m "feat: isolate workflow role artifacts"
```

---

### Task 3: Offline Contract Runner、Workflow Engine 與 Approval State

**Files:**
- Modify: `scripts/workflow-lab/workflow-lab.test.js`
- Create: `scripts/workflow-lab/offline-runner.js`
- Create: `scripts/workflow-lab/workflow-engine.js`
- Create: `scripts/workflow-lab/run-manager.js`

**Interfaces:**
- Produces: `createOfflineRunner(options)`、`createWorkflowEngine(options)`、`createWorkflowRunManager(options)`。
- Offline runner: `execute({ moduleId, taskPackage, context }) -> Promise<ModuleResult>`。
- Engine: `start(request)`、`resume(runId, decision)`、`cancel(runId)`、`getSnapshot(runId)`。
- Run manager enforces one active run and bounded redacted log.

- [ ] **Step 1: Write failing Offline module tests**

Create one test per module family:

- Translator masks sensitive terms and preserves logic conditions.
- Router returns validated sequence and approval points.
- PM returns `pm-artifact-v1` with acceptance criteria.
- Checker returns GREEN for valid artifact and RED for missing fields.
- SA／SD produce schema-complete synthetic contract artifacts.
- PG Offline verifies Worktree requirement and forbidden operations.
- QA returns GREEN or RED from Fixture flags.
- Documentation includes only approved artifact IDs.
- Memory Candidate returns candidates without writing Vault.

- [ ] **Step 2: Run Offline tests and verify RED**

Run: `node --test --test-name-pattern="Offline Runner" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because runner is missing.

- [ ] **Step 3: Implement Offline Runner**

Offline artifacts are deterministic from normalized inputs. They are contract fixtures, not claims about real project behavior. Every synthetic output includes `synthetic: true`.

- [ ] **Step 4: Write failing Workflow Engine tests**

Test:

```javascript
const run = await engine.start(partialRequest);
assert.equal(run.status, 'green');
assert.deepEqual(run.steps.map((step) => step.moduleId), ['translator', 'pm', 'sa']);
```

Test full GREEN flow, module failure stop, cancel, single active run, bounded log, and no original requirement in snapshot.

- [ ] **Step 5: Write RED／Approval failing tests**

```javascript
const run = await engine.start(requestThatMakesQaRed);
assert.equal(run.status, 'paused');
assert.equal(run.pendingApproval.kind, 'red-return');
assert.equal(run.pendingApproval.recommendedModuleId, 'pg');
const resumed = await engine.resume(run.id, { action: 'return', moduleId: 'pg' });
assert.equal(resumed.status, 'green');
```

Also test reject terminates as red; unsafe order and raw pass-through create approval before execution.

- [ ] **Step 6: Run Engine tests and verify RED**

Run: `node --test --test-name-pattern="Workflow Engine|Approval" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because engine is missing.

- [ ] **Step 7: Implement Engine and Run Manager**

States must follow:

```text
queued → running → green
queued → running → paused → running → green
queued → running → paused → red
queued → running → failed
queued/running/paused → cancelled
```

Invalid transitions throw `INVALID_RUN_TRANSITION`.

- [ ] **Step 8: Run Task 3 tests**

Run: `node --test scripts/workflow-lab/workflow-lab.test.js`
Expected: all pass.

- [ ] **Step 9: Commit Task 3**

```bash
git add scripts/workflow-lab
git commit -m "feat: run offline role workflows"
```

---

### Task 4: Project Validation、Worktree Manager 與 Codex Live Executor

**Files:**
- Modify: `scripts/workflow-lab/workflow-lab.test.js`
- Create: `scripts/workflow-lab/project-validator.js`
- Create: `scripts/workflow-lab/worktree-manager.js`
- Create: `scripts/workflow-lab/codex-live-executor.js`
- Create: `scripts/workflow-lab/schemas/role-result.schema.json`

**Interfaces:**
- Produces: `createProjectValidator(options)`、`createWorktreeManager(options)`、`createCodexLiveExecutor(options)`。
- Project validator: `validate(projectInput) -> ProjectDescriptor`。
- Worktree manager: `create({ sourcePath, runId }) -> WorktreeDescriptor`。
- Live executor: `isAvailable()`、`execute({ moduleId, taskPackage, project, worktree, onOutput, signal })`。

- [ ] **Step 1: Write failing Project Validator tests**

Use temporary directories to verify:

- `C:\PixiuCore` or configured allowed root accepted.
- Drive root、user profile root and paths outside allowed roots rejected.
- Missing `.git` rejected for PG Live.
- Fleet entries parsed only when `fleet.json` is an array of strings.
- Returned descriptor contains `sourcePath`、`isGitRepo`、`branch` and detected entry files.

- [ ] **Step 2: Run validator tests and verify RED**

Run: `node --test --test-name-pattern="Project Validator" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because validator is missing.

- [ ] **Step 3: Implement Project Validator**

Use `fs.realpathSync.native` and path containment checks. Never trust lexical prefix alone.

- [ ] **Step 4: Write failing Worktree tests**

Inject a fake Git runner and assert exact command shape:

```text
git -C <source> worktree add --detach <managedPath> HEAD
```

Test managed path cannot equal source path; failure never returns source checkout; no delete／prune action exists in the public API.

- [ ] **Step 5: Run Worktree tests and verify RED**

Run: `node --test --test-name-pattern="Worktree Manager" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because manager is missing.

- [ ] **Step 6: Implement Worktree Manager**

Default managed root:

```text
%LOCALAPPDATA%\PixiuCore\workflow-lab\worktrees\<runId>
```

Create with detached HEAD. Return the path and base SHA. Do not remove it automatically.

- [ ] **Step 7: Write failing Codex Executor tests**

Inject fake spawn and verify:

For PM／SA／SD／QA／Documentation:

```text
codex exec --ephemeral --color never --output-schema <schema> --sandbox read-only -C <project> -
```

For PG:

```text
codex exec --ephemeral --color never --output-schema <schema> --sandbox workspace-write -C <worktree> -
```

Prompt must contain explicit禁止 Push／Merge／Deploy／依賴變更／DB 寫入 and only the serialized RoleTaskPackage. It must not contain original request fields absent from Task Package.

- [ ] **Step 8: Run Executor tests and verify RED**

Run: `node --test --test-name-pattern="Codex Live Executor" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because executor is missing.

- [ ] **Step 9: Implement Codex Live Executor**

Use stdin for Prompt. Parse final JSON output against local shape checks after Codex Schema enforcement. Capture stdout／stderr through Redactor before adding to log. Nonzero exit returns `LIVE_EXECUTION_FAILED`.

- [ ] **Step 10: Add Live runner integration to Workflow Engine**

Engine creates one Fresh Executor call per role. PG requests an approval, then creates Worktree. Checker／Approval modules remain local deterministic gates.

- [ ] **Step 11: Run Task 4 and existing regression**

Run:

```powershell
node --test scripts/workflow-lab/workflow-lab.test.js
node --test scripts/test-console/test-console.test.js
```

Expected: all pass; no actual Codex quota consumed because tests inject fake spawn.

- [ ] **Step 12: Commit Task 4**

```bash
git add scripts/workflow-lab
git commit -m "feat: add safe Codex live workflow runner"
```

---

### Task 5: Secure HTTP API

**Files:**
- Modify: `scripts/workflow-lab/workflow-lab.test.js`
- Create: `scripts/workflow-lab/server.js`

**Interfaces:**
- Produces: `createWorkflowLabServer(options)` and CLI entry.
- API routes match the design spec.

- [ ] **Step 1: Write failing HTTP tests**

Test:

- `GET /healthz`
- `GET /api/session`
- `GET /api/modules`
- `GET /api/projects`
- `POST /api/runs`
- `GET /api/runs/:id`
- `POST /api/runs/:id/cancel`
- `POST /api/runs/:id/approve`
- `POST /api/runs/:id/reject`
- `GET /api/runs/:id/artifacts/:artifactId`

Verify token、Origin、Content-Type、body size、404、409 and redacted snapshots.

- [ ] **Step 2: Run HTTP tests and verify RED**

Run: `node --test --test-name-pattern="Workflow HTTP" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because server is missing.

- [ ] **Step 3: Implement loopback Server**

CLI:

```powershell
node scripts/workflow-lab/server.js --open
node scripts/workflow-lab/server.js --port=8792
```

Header name: `X-Pixiu-Workflow-Token`。Default body limit: `262144` bytes。Static CSP must block external script、style、object and framing.

- [ ] **Step 4: Verify HTTP tests GREEN**

Run: same test command.
Expected: pass.

- [ ] **Step 5: Commit Task 5**

```bash
git add scripts/workflow-lab
git commit -m "feat: expose workflow lab API"
```

---

### Task 6: Workflow Lab Web UI

**Files:**
- Modify: `scripts/workflow-lab/workflow-lab.test.js`
- Create: `scripts/workflow-lab/public/index.html`
- Create: `scripts/workflow-lab/public/app.js`
- Create: `scripts/workflow-lab/public/styles.css`

**Interfaces:**
- Consumes Workflow API.
- Produces requirement editor、module selection、advanced reordering、run view、approval panel and artifact viewer.

- [ ] **Step 1: Write failing static UI contract tests**

Assert IDs／data attributes exist:

```text
requirement-input
business-logic-input
expected-outcome-input
sensitive-terms-input
mode-offline
mode-live
input-need-to-know
input-raw
selection-single
selection-partial
selection-full
module-list
advanced-order-toggle
unsafe-order-toggle
project-source
project-path
run-workflow
cancel-run
approval-panel
approve-run
reject-run
run-step-list
artifact-list
run-log
```

Assert client sets `X-Pixiu-Workflow-Token` and never stores requirement／businessLogic in `localStorage` or `sessionStorage`.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --test --test-name-pattern="Workflow UI" scripts/workflow-lab/workflow-lab.test.js`
Expected: FAIL because static files are missing.

- [ ] **Step 3: Implement HTML structure**

Use semantic sections、labels、buttons and accessible status text. No external CDN.

- [ ] **Step 4: Implement Client State**

- Fetch Session／Modules／Projects.
- Keep raw input only in in-memory DOM state.
- Build request body only when Run is submitted.
- Clear raw input object after successful submission while leaving visible textarea under user control.
- Poll active Run every 900 ms.
- Render paused Approval with recommended return module.
- General mode uses checkboxes in fixed order.
- Advanced mode uses Up／Down buttons, not drag-and-drop dependency.
- Raw pass-through and unsafe order require client confirmation; Server remains source of truth.

- [ ] **Step 5: Implement responsive CSS**

Desktop-first, usable at 1024 px and 390 px. Status colors must also include text and icon, not color only.

- [ ] **Step 6: Run UI and full unit tests**

Run: `node --test scripts/workflow-lab/workflow-lab.test.js`
Expected: pass.

- [ ] **Step 7: Commit Task 6**

```bash
git add scripts/workflow-lab/public scripts/workflow-lab/workflow-lab.test.js
git commit -m "feat: add workflow lab interface"
```

---

### Task 7: Real Web API Integration and Security Regression

**Files:**
- Create: `scripts/workflow-lab/web-api-integration.test.js`
- Modify: `scripts/workflow-lab/workflow-lab.test.js`

**Interfaces:**
- Runs a true HTTP Server on random loopback port.

- [ ] **Step 1: Write failing integration test**

The test must:

1. Start real Server on port `0`.
2. Fetch Session token.
3. Submit Translator single module.
4. Submit partial `translator → pm → sa` flow.
5. Submit full Offline GREEN flow.
6. Submit QA RED fixture and verify paused.
7. Approve return to PG and verify completion.
8. Verify Run JSON and durable Artifact files contain none of the unique original secret string.
9. Cancel a delayed injected run.
10. Stop Server.

- [ ] **Step 2: Run integration test and verify RED**

Run: `node --test scripts/workflow-lab/web-api-integration.test.js`
Expected: FAIL until any missing wiring is completed.

- [ ] **Step 3: Complete minimal wiring**

Fix production code only for failing specified behaviors. Do not loosen tests or persist original inputs.

- [ ] **Step 4: Run integration test GREEN**

Run: same command.
Expected: pass.

- [ ] **Step 5: Run adversarial probes**

Test request values containing:

```text
<script>alert(1)</script>
'; DROP TABLE workflow;
../../outside
CANARY-WORKFLOW-LAB
100000-character business logic
```

Expected: text rendered with `textContent`; path rejected; Canary red; oversize 413 or validator error.

- [ ] **Step 6: Run all Workflow and Test Console tests**

```powershell
node --test scripts/workflow-lab/workflow-lab.test.js scripts/workflow-lab/web-api-integration.test.js
node --test scripts/test-console/test-console.test.js scripts/test-console/web-api-integration.test.js
```

Expected: all pass.

- [ ] **Step 7: Commit Task 7**

```bash
git add scripts/workflow-lab
git commit -m "test: verify workflow lab end to end"
```

---

### Task 8: Documentation、Browser Smoke and Delivery Verification

**Files:**
- Create: `scripts/workflow-lab/README.md`
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-07-27-pixiu-workflow-lab.md`

**Interfaces:**
- Documents startup、Offline／Live、module modes、Worktree、approval and security limits.

- [ ] **Step 1: Write Workflow Lab README**

Include commands:

```powershell
node scripts/workflow-lab/server.js --open
node --test scripts/workflow-lab/workflow-lab.test.js
node --test scripts/workflow-lab/web-api-integration.test.js
codex doctor
```

Explain that Live execution consumes Codex quota and each role is a Fresh ephemeral session.

- [ ] **Step 2: Update root README**

Add a new `Workflow Lab` section beside, not inside, the existing Test Console section.

- [ ] **Step 3: Read-back documentation and validate UTF-8**

Run `git diff --check` and inspect all links／paths.

- [ ] **Step 4: Run Node syntax checks**

```powershell
node --check scripts/workflow-lab/workflow-catalog.js
node --check scripts/workflow-lab/request-validator.js
node --check scripts/workflow-lab/redaction.js
node --check scripts/workflow-lab/task-package.js
node --check scripts/workflow-lab/artifact-store.js
node --check scripts/workflow-lab/offline-runner.js
node --check scripts/workflow-lab/workflow-engine.js
node --check scripts/workflow-lab/project-validator.js
node --check scripts/workflow-lab/worktree-manager.js
node --check scripts/workflow-lab/codex-live-executor.js
node --check scripts/workflow-lab/run-manager.js
node --check scripts/workflow-lab/server.js
node --check scripts/workflow-lab/public/app.js
```

- [ ] **Step 5: Run complete verification**

```powershell
node --test scripts/workflow-lab/workflow-lab.test.js scripts/workflow-lab/web-api-integration.test.js
node --test scripts/test-console/test-console.test.js scripts/test-console/web-api-integration.test.js
node scripts/test-console/repository-safety.js
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/performance/run-lazy-loading-tests.ps1
git diff --check
git status --short
```

- [ ] **Step 6: Browser smoke and screenshots**

Start Server on a free loopback port, use Edge／Chrome headless or manual browser to:

1. Load page.
2. Execute Translator single module.
3. Execute partial flow.
4. Execute full Offline flow.
5. Capture overview and final result screenshots.

- [ ] **Step 7: Optional controlled Live Smoke**

Only after user explicitly starts a Live Run with their requirement and project. Before invoking Codex, show that quota will be consumed and Worktree will be created. Do not perform this as part of automated regression.

- [ ] **Step 8: Final diff and scope review**

Confirm changes are limited to Workflow Lab、README、spec and plan. Do not include the dirty source checkout's entry-sync work.

- [ ] **Step 9: Commit documentation and delivery state**

```bash
git add README.md scripts/workflow-lab/README.md docs/superpowers/plans/2026-07-27-pixiu-workflow-lab.md
git commit -m "docs: document PixiuCore workflow lab"
```

- [ ] **Step 10: Stop before Push／Merge**

Report branch、worktree path、commits、tests、screenshots and any unverified Live behavior. Do not Push or Merge without new explicit approval.

## Self-Review Result

- Spec coverage: single／partial／full、Offline／Live、Fresh Session、Worktree、Need-to-Know、A/B、RED approval、Fleet/manual path、raw non-persistence、API、UI and existing regression all map to explicit tasks.
- Placeholder scan: no `TBD`、`TODO`、`implement later` or undefined implementation interface.
- Type consistency: Catalog、Request、Task Package、Module Result、Engine、Run Manager and Server interfaces use the names defined in Tasks 1–5.
- Scope: no package install、agent dispatch、Push、Merge、Deploy、DB write or Vault direct write.

## Execution Result

- Workflow Lab 核心、API、UI 與安全契約：`51 / 51`。
- Workflow Lab 真實 Web API 整合：單模組、部分流程、13 步完整流程、QA RED 退回與取消全部通過。
- 既有 Test Console：`11 / 11`，未被 Workflow Lab 變更破壞。
- Repository Safety：通過。
- Lazy Loading／Router／Skill Metadata：通過；隔離 Worktree 不是 canonical checkout，因此 effective Skill collision 量測維持 `87`，符合非 canonical worktree 的既有規則。
- Browser smoke：真實 Server 啟動、完整 Offline Flow `13` 步 GREEN、`13` 份 Artifact，Edge Headless 已產生高解析截圖。
- Codex CLI：本機 `codex-cli 0.144.0` 已真實驗證 `codex exec --ephemeral`、`--output-schema`、`read-only` 與 `workspace-write`。目前版本的 `exec` 不接受 `--ask-for-approval`，命令契約已修正；Strict Structured Output 改用 `artifact.valueJson`，Executor 驗證並解析為角色 Artifact 物件。
- 真實 Live 角色流程：PM、SA、SD、PG、QA Fresh Session 全部 GREEN。PG 在隔離 Worktree 使用 `workspace-write`，回報 `changedFiles: []`；執行前後 `git status --short --branch` 均為乾淨 detached HEAD，QA 驗證通過。
- 使用者層 Hook：真實 Live Session 揭露 `commandWindows` 的 Node 路徑未加引號，導致 SessionStart／Stop Hook exit 1。母體 installer 與 Live Binding 檢查已修正並具備回歸測試；實際 `~/.codex/hooks.json` 尚待套用修正版。
- 尚未執行：Push、Merge、Deploy、DB 寫入與依賴變更。Workflow Lab 已整合到 master 工作目錄，但尚未建立 commit 或推送。
