> **English summary:** DevSpace now provides durable, scope-safe cross-session handoff and independent review tools with explicit execution-policy resolution.

# 結案報告

**Spec:** `specs/completed/01-devspace-cross-session-control`
**Status:** completed
**Date:** 2026-08-12

## 完成內容

- 新增 hash-chained workflow ledger、revision CAS、idempotency 與三種 scope 隔離。
- 新增結構化 handoff/acknowledgment 與固定 revision 的 independent review gate。
- 新增 `workflow_create`、`workflow_list`、`workflow_update`、`workflow_run`、`workflow_sync` 五個 Web MCP tools。
- 每個 run 記錄 requested/effective policy，並把 model/reasoning effort 傳給本地 Agent。
- 執行面只喚起已完成訂閱登入的本機 CLI，不建立 AI provider API 或 API key 依賴。
- Deep Research/Pro 不支援時依政策 block 或 explicit degrade，不靜默冒充。
- OneClick 以版本鎖、hash manifest、managed module 與 owner-PID restart 安全部署到 DevSpace 1.0.4。

## 驗證結果

- `scripts/devspace-portable/tests/run-tests.ps1`：105 passed，0 failed。
- `workflow-store.test.mjs`：13 passed，0 failed，含並行 claim、run retry、handoff race、MCP metadata regression、ledger tamper、憑證拒絕與 runtime 輸出遮罩。
- 獨立 GPT-5.6 Sol reviewer：PASS，無 blocking finding。
- Codex 安全收斂：ledger 持久化前拒絕疑似憑證，Agent runtime 輸出寫入前遮罩敏感值。
- 真實 runtime：DevSpace/Tunnel PID verified，MCP session 建立 200、工具呼叫 200，最新 stderr 空白。
- 2026-08-14 再驗證：portable 105/105、workflow 13/13、Watchdog 162/162 全數通過；live managed workflow module 已更新到最終 hardening 版本，local/public health 與 MCP OAuth `resource_metadata` 同源檢查均正常。
- 現有 watchdog、watchdog tests 與既存 README 修改未被本功能覆寫。

## 已知限制

- 新工具需讓 Web GPT/Connector 重新載入 tool catalog；既有已開啟對話可能只看到舊工具清單。
- 任意既有 ChatGPT 對話沒有通用公開 API 可由 DevSpace 自動啟動；下一個 session 透過 list/claim/acknowledge 接手。
- 本地 Agent adapter 不等同 Deep Research/Responses Pro 執行器；這兩個模式目前只可 block 或 explicit degrade。
- 若程序在 `run_start` 後、Agent ID 寫回前整體崩潰，run 可能留在 `starting`，需人工 block 或建立新的 idempotency key 重試。
