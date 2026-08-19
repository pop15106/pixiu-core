# Phase 0 Baseline Lock

**日期：** 2026-08-19
**狀態：** VERIFIED

## 基準測試

- `node scripts/devspace-portable/tests/workflow-store.test.mjs`
  - 15 passed
  - 0 failed
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/devspace-portable/tests/run-tests.ps1`
  - 107 passed
  - 0 failed

## 目前行為 Checklist

- [x] create 可透過 idempotency key 安全重試。
- [x] credential-like persistent values 會在 ledger 建立前被拒絕。
- [x] 同 revision 的並行 claim 只有一個成功。
- [x] `single_session`、`same_project`、`cross_project` 有 scope boundary。
- [x] handoff 必須包含 contextSnapshot、deliverables、openItems、requiredNextAction。
- [x] handoff 只能由指定 target acknowledge。
- [x] review 綁定固定 revision，producer 與 reviewer 必須不同。
- [x] `requireReview=true` 時，未通過 review 不得 complete。
- [x] Deep Research / Pro unsupported policy 會 block 或 explicit degrade，不會靜默降級。
- [x] `workflow_run` 需要目前對話的明確 model/Agent 授權。
- [x] Agent sync 會遮罩 credential-like runtime output。
- [x] 重試相同 `workflow_run` idempotency key 不會重複啟動 Agent。
- [x] Agent start finalize 不會覆蓋並行 handoff revision。
- [x] ledger hash tampering 會 fail closed。
- [x] MCP 目前註冊五個 workflow tools：create/list/update/run/sync。

## V1 Ledger Fixtures

- `fixtures/v1-valid.jsonl`
  - 3 個事件：create → claim → handoff。
  - schemaVersion=1。
  - 固定 taskId、eventId、時間與 hash，供後續 migration replay 使用。
- `fixtures/v1-tampered.jsonl`
  - 修改第一個 event 的 objective，但保留原 hash。
  - 預期新版 parser / replay 必須 fail closed。
- `fixtures/v1-truncated.jsonl`
  - 第三個 event JSON 被截斷。
  - 預期新版 parser / replay 必須 fail closed。

## Working Tree 邊界

開始本 Phase 前，repository 已存在其他未提交修改與未追蹤檔案。
本專案後續實作只處理 Standalone Session Workflow 必要路徑，不整理、不覆寫其他 dirty files。

本 Phase 新增範圍：

- `specs/active/02-standalone-session-workflow/plan.md`
- `specs/active/02-standalone-session-workflow/phase-0-baseline.md`
- `specs/active/02-standalone-session-workflow/fixtures/`

## Phase 0 結論

目前 DevSpace workflow 行為有可重現的測試證據，並已保存 V1 正常、竄改與截斷 fixture。
Phase 1 可以開始抽出 Core，但不得改變 tool name、task state semantics 或 V1 ledger schema。
