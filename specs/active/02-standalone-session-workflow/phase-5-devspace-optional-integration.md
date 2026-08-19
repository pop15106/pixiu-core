# Phase 5 — DevSpace Optional Integration

**日期：** 2026-08-19
**狀態：** COMPLETE

## 目標

正式把 DevSpace Agent 執行能力移出 Session Workflow Core，讓：

```text
Standalone Core / MCP：create / list / update
DevSpace adapter：create / list / update / run / sync
```

同時維持單一 workflow state machine、單一 ledger、revision CAS、idempotency 與既有 DevSpace 對外 schema。

## 完成內容

### 1. Core 移除 DevSpace state fallback

`packages/session-workflow/core/index.mjs` 不再讀：

```text
DEVSPACE_WORKFLOW_STATE_DIR
```

Core 的 generic fallback 改為：

```text
.session-workflow
```

DevSpace 專屬環境變數解析移回 `scripts/devspace-portable/DevSpace.WorkflowStore.mjs`。

### 2. Core 移除 DevSpace Agent domain

Core 已移除：

- `resolveLocalAgentPolicy()`。
- `buildAgentPrompt()`。
- `agentAdapter` property。
- `runTask()`。
- `syncTask()`。
- DevSpace Agent ID / profile validation。
- DevSpace local-agent unsupported capability wording。
- `workflow_run` / `workflow_sync` 專屬錯誤訊息。

Source boundary scan：

```text
DEVSPACE_
DevSpace
workflow_run
workflow_sync
Agent adapter
agentAdapter
runTask
syncTask
```

在 Core source 皆無 match。

### 3. Core 保留 generic extension mutation seam

Core 新增：

```text
controller.extensions.mutateTask(...)
controller.extensions.mutateLatestTask(...)
```

這兩個 seam 仍使用 Core 原本的：

- 同一條 workflow ledger。
- hash chain。
- file lock。
- project/session visibility。
- revision CAS。
- idempotency map。
- credential persistence gate。
- V1→V2 migration。

因此 DevSpace extension 沒有建立第二套 state machine 或第二套 storage。

### 4. DevSpace optional execution adapter

`scripts/devspace-portable/DevSpace.WorkflowStore.mjs` 現在負責：

- `DEVSPACE_WORKFLOW_STATE_DIR` adapter config。
- `resolveLocalAgentPolicy()`。
- DevSpace Agent prompt。
- Agent profile / ID validation。
- `runTask()` orchestration。
- `syncTask()` orchestration。
- local Agent start/get adapter。
- runtime response credential redaction。

`createWorkflowController()` 在 DevSpace compatibility layer 中：

1. 建立純 Core controller。
2. 掛上 DevSpace execution adapter。
3. 對既有 DevSpace tests / MCP registration 繼續提供相同 `runTask()` / `syncTask()` surface。

### 5. Concurrency / retry 行為保留

DevSpace run lifecycle 仍走 Core extension seam：

```text
run_start
→ external Agent start
→ run_started / run_failed
```

`run_started` / `run_failed` 使用 `mutateLatestTask()`，所以 Agent 啟動期間若同一 task 已發生合法 handoff/revision mutation，finalization 會套用在最新 revision，而不是覆蓋 concurrent mutation。

原本的 retry idempotency 也維持：相同 `workflow_run` idempotency key 不會啟動第二個 Agent。

## 新增 boundary test

新增測試：

```text
standalone core exposes coordination only and has no DevSpace runtime boundary
```

直接驗證 Core controller：

```text
runTask === undefined
syncTask === undefined
agentAdapter === undefined
```

並讀 Core source 確認無 `DEVSPACE_WORKFLOW_STATE_DIR` 與 DevSpace Agent wording。

TDD：

- refactor 前測試因 `runTask` 存在而紅燈。
- refactor 後轉綠。

## 驗證

### DevSpace workflow

```text
22 passed
0 failed
```

包含：

- direct Core boundary。
- V1 / V2 migration。
- hash tamper fail closed。
- revision CAS。
- idempotency。
- handoff / review。
- local Agent policy。
- explicit model authorization gate。
- run/sync。
- credential redaction。
- concurrent handoff during Agent start。
- 五個 DevSpace MCP tools registration。

### Standalone package

```text
12 passed
0 failed
0 skipped
```

Standalone 仍只有：

- `workflow_create`
- `workflow_list`
- `workflow_update`

### DevSpace OneClick

```text
110 passed
0 failed
```

### Standalone portable

```text
12 passed
0 failed
```

### Release rebuild

最新 release：

```text
artifacts/session-workflow-portable/SessionWorkflowOneClick-0.1.0.zip
size ≈ 3.32 MB
```

Production dependency audit：

```text
0 vulnerabilities
```

ZIP 解壓到 `%TEMP%` 後 independent smoke：

```text
PASS
```

## Phase 5 結論

Phase 5 完成。

現在架構已明確收斂為：

```text
Session Workflow Core
├─ durable task/state machine
├─ ledger/hash/lock/CAS/idempotency
├─ create/list/update
└─ generic extension mutation seam

Standalone adapter
├─ StandaloneProjectResolver
├─ official MCP server
├─ OAuth owner resource server
└─ create/list/update only

DevSpace adapter
├─ DevSpaceProjectResolver
├─ DevSpace Agent runtime
├─ local Agent policy
└─ run/sync over the same Core ledger
```

沒有第二套 workflow state machine。

下一步：Closure — 全量 regression、diff/integrity 檢查、文件與 durable workflow closure。
