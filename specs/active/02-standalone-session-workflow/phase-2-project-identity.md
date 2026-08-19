# Phase 2 Project Identity Abstraction

**日期：** 2026-08-19
**狀態：** VERIFIED

## 完成內容

- Core 新增 `projectRef` / `projectRefs` 作為 V2 scope identity。
- 新增 `projectRefFromPath()`，讓舊 filesystem path 可映射成穩定 project identity。
- 新增 `packages/session-workflow/adapters/devspace-project-resolver.mjs`。
- 新增 `packages/session-workflow/adapters/standalone-project-resolver.mjs`。
- DevSpace MCP registration 改由 resolver 將 `workspaceId` 轉成 `projectRef`。
- schemaVersion 2 task 不再保存 `projectRoots`。
- V1 ledger 仍可原樣 replay；第一次以 `projectRef` mutation 時才升級成 V2 snapshot。
- 舊 V1 event bytes / hash 不重寫，V2 event 直接延續 `previousHash`。

## Fixture 與 Migration Evidence

- `fixtures/v1-valid.jsonl`
- `fixtures/v1-tampered.jsonl`
- `fixtures/v1-truncated.jsonl`
- `fixtures/v2-valid.jsonl`
- `fixtures/v1-to-v2-valid.jsonl`
- `fixtures/v1-to-v2-truncated.jsonl`

固定 fixture 與動態 migration test 分工：

- dynamic migration test 驗證 `projectRefFromPath()`、V1→V2 mutation 與舊 event byte-for-byte 保持。
- static V2 fixture 驗證純 V2 replay。
- static V1→V2 fixture 驗證混合 ledger replay 與 hash chain continuity。
- tampered / truncated fixture 持續 fail closed。

## 驗證結果

- `node --test scripts/devspace-portable/tests/workflow-store.test.mjs`
  - 21 passed
  - 0 failed
- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/devspace-portable/tests/run-tests.ps1`
  - 110 passed
  - 0 failed

## 安全不變量

- same_project / cross_project visibility 以 `projectRef` 比對。
- V1 ledger 不被 rewrite。
- stale revision / idempotency / handoff / review / credential filtering 行為維持。
- DevSpace workspace registry 只存在 adapter，不進入 Core。
- Standalone resolver 不接受 actor/sessionRef 作為 authentication identity。

## 已知限制

- Core 仍保留 generic Agent run/sync 與 DevSpace-compatible policy 字串；依原計畫 Phase 5 再移至 optional adapter。
- `projectRefFromPath()` 產物屬 path adapter identity；Standalone 正式模式應優先使用 StandaloneProjectResolver 產生的 namespaced projectRef。

## Phase 2 結論

Phase 2 已達成 Project Identity 解耦與 V1/V2 ledger compatibility，可進入 Phase 3 Standalone MCP。
