# Phase 1 Core Extraction

**日期：** 2026-08-19
**狀態：** VERIFIED

## 完成內容

- 新增 `packages/session-workflow/core/index.mjs`。
- 將 workflow controller、state machine、file ledger、snapshot、lock、revision CAS、idempotency、scope validation、credential filtering 搬入 Core。
- `scripts/devspace-portable/DevSpace.WorkflowStore.mjs` 改為 compatibility / DevSpace integration layer。
- 舊模組仍 re-export：
  - `createWorkflowController`
  - `resolveLocalAgentPolicy`
- DevSpace MCP tool 名稱與 schema 維持：
  - `workflow_create`
  - `workflow_list`
  - `workflow_update`
  - `workflow_run`
  - `workflow_sync`
- 新增 Core direct-import 測試，證明 Core create/list 不需要載入 DevSpace runtime。

## TDD 證據

先加入 `packages/session-workflow/core/index.mjs` direct import 測試。
實作前測試因 `ERR_MODULE_NOT_FOUND` 失敗，完成 Core 後轉綠。

## 驗證結果

- `node scripts/devspace-portable/tests/workflow-store.test.mjs`
  - 16 passed
  - 0 failed
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/devspace-portable/tests/run-tests.ps1`
  - 107 passed
  - 0 failed
- V1 fixture 由新 Core replay：
  - task count = 1
  - revision = 3
  - status = `handoff_pending`

## 依賴邊界

Core 已不 import：

- DevSpace workspace registry
- DevSpace server registration
- DevSpace local-agent store
- `node:child_process`
- PixiuCore vault
- PixiuCore memory
- Hermes

目前 Core 仍保留部分 DevSpace-compatible Agent 語意：

- `DEVSPACE_WORKFLOW_STATE_DIR` compatibility fallback
- `runTask` / `syncTask` 的 generic injected `agentAdapter`
- `resolveLocalAgentPolicy` 的 DevSpace local Agent policy 字串
- Agent prompt 的 DevSpace 相容文字

這些不是 runtime import；Phase 5 會再把 `workflow_run/sync` 與 DevSpace-specific policy 完整移到 optional adapter。

## Phase 1 結論

Domain + persistence 已有獨立 public module，且現有 DevSpace interface 與 V1 ledger 行為維持相容。
可進入 Phase 2 Project Identity Abstraction。
