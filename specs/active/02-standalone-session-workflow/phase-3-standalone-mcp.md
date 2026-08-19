# Phase 3 Standalone MCP — Superseded

**日期：** 2026-08-19
**狀態：** SUPERSEDED
**取代文件：** `phase-3a-standalone-service.md`

## 修正原因

這份文件原先把「Node.js 標準庫手刻最小 JSON-RPC MCP transport」標成正式 Phase 3 完成。

後續重新核對目前官方 MCP TypeScript SDK 與 2026-era HTTP transport 後，確認此判定過度宣稱：

- 手刻 `initialize / tools/list / tools/call` 不等於完整官方 MCP HTTP 相容性。
- 不能以回應 client 提供的 protocolVersion 取代正式 protocol negotiation。
- 不能據此宣稱可直接給 ChatGPT Web 長期相容使用。
- 公開 Web transport 與 OAuth 也不能建立在自製 protocol parser 上。

因此已將 `standalone-server.mjs` 收斂為 transport host：

- Standalone workflow domain / owner isolation / tool contract 已完成。
- `/healthz` 可用。
- `/mcp` 沒有正式 transport adapter 時回 `503` fail closed。
- 正式 MCP handler 必須由 Phase 3B 官方 SDK adapter 注入。

## 目前正確狀態

已完成的是 **Phase 3A Standalone Workflow Service**：

- 無 DevSpace runtime。
- workflow_create / list / update。
- principal state isolation。
- projectRef scope。
- cross-session handoff / acknowledge / complete E2E。
- transport-independent MCP tool registration contract。
- loopback HTTP host。

尚未完成的是 **Phase 3B Official MCP Transport**：

- 官方 MCP HTTP handler / transport。
- 官方 MCP client integration test。
- 正式 protocol negotiation。
- production-ready OAuth / protected-resource flow。

完整證據請以：

`specs/active/02-standalone-session-workflow/phase-3a-standalone-service.md`

為準。
