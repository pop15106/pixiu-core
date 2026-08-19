# Phase 3B — Official MCP Transport

**日期：** 2026-08-19
**狀態：** COMPLETE

## 目標

將 Phase 3A 的 transport seam 接到官方 MCP TypeScript SDK v2，讓 Standalone Session Workflow 的 `/mcp` 端點不再依賴手刻 JSON-RPC / MCP parser，並以官方 MCP Client 驗證實際 wire protocol。

## 鎖定版本

本階段使用 exact pin：

- `@modelcontextprotocol/server`：`2.0.0`
- `@modelcontextprotocol/node`：`2.0.0`
- `@modelcontextprotocol/client`：`2.0.0`（integration test）
- `zod`：`4.4.3`
- Node.js：`>=20`

SDK v2 使用 split packages；server 與 client 分離，Node `http` adapter 由 `@modelcontextprotocol/node` 提供。

## 實作內容

### 1. package boundary

新增：

- `packages/session-workflow/package.json`
- `packages/session-workflow/package-lock.json`

Standalone package 現在自己持有 MCP runtime dependencies，不需要 DevSpace 或 PixiuCore 提供 MCP SDK。

### 2. Standard Schema 單一來源

`packages/session-workflow/mcp/register-tools.mjs` 改成以 Zod v4 定義三個工具的 input schema：

- `workflow_create`
- `workflow_list`
- `workflow_update`

同一份 Zod schema：

1. 以 `z.toJSONSchema()` 提供既有 transport-independent contract。
2. 直接以 Standard Schema 形式註冊到官方 `McpServer.registerTool()`。

因此沒有第二份欄位 schema。

### 3. 官方 MCP transport

新增：

- `packages/session-workflow/mcp/official-transport.mjs`

使用：

- `McpServer`
- `createMcpHandler()`
- `toNodeHandler()`
- `localhostHostValidation()`
- `localhostOriginValidation()`

`createMcpHandler()` 保留 `legacy: "stateless"`，同一個 endpoint 同時支援既有 2025-era initialize 流程與 2026-07-28 modern discovery 流程。

### 4. Standalone server 預設接官方 MCP

`packages/session-workflow/mcp/standalone-server.mjs` 現在在 local mode 預設建立官方 MCP transport。

啟動後：

- `/healthz`：HTTP health endpoint。
- `/mcp`：官方 MCP HTTP endpoint。
- `mcpTransport`：`configured`。

仍保留 injected `mcpHandler` seam，供測試或未來其他正式 transport adapter 使用。

### 5. Local security boundary

Local mode 維持：

- 只允許 loopback bind。
- `0.0.0.0` 等 remote bind 仍被拒絕。
- 官方 Node adapter 前再執行 localhost Host validation。
- 官方 Node adapter 前再執行 localhost Origin validation。
- 測試證明惡意 Origin 取得 `403`。

目前沒有公開 unauthenticated mode；正式 public URL 仍必須等後續 auth / OAuth gate。

## MCP wire 驗證

### Legacy / initialize path

官方 `@modelcontextprotocol/client`：

1. 連線 `/mcp`。
2. `initialize` 成功。
3. `getProtocolEra()` = `legacy`。
4. `tools/list` 回傳三個 workflow tools。
5. `tools/call workflow_create` 成功。

### Modern / discovery path

官方 Client 使用：

```text
versionNegotiation.mode = auto
```

驗證：

1. `server/discover` negotiation 成功。
2. `getProtocolEra()` = `modern`。
3. `tools/list` 成功。
4. `tools/call workflow_create` 成功。

### Two-client cross-session E2E

使用兩個獨立官方 MCP Client：

```text
Client A
→ workflow_create
→ workflow_update claim
→ workflow_update handoff

Client B
→ workflow_list
→ 讀到 handoff contextSnapshot
→ workflow_update acknowledge
→ currentOwner = planner-b
```

此測試直接通過官方 MCP wire，不只呼叫 Standalone service function。

## 驗證結果

### Standalone package

```text
10 passed
0 failed
1 skipped
```

Skipped test 是預先保留的 OAuth owner-mode future contract；目前 public mode 尚未開放。

### DevSpace workflow regression

```text
21 passed
0 failed
```

### DevSpace portable regression

```text
110 passed
0 failed
```

### npm audit

```text
0 vulnerabilities
```

## Phase 3B 結論

Phase 3B 完成。

目前可以確定：

- Standalone `/mcp` 使用官方 MCP SDK v2。
- 不再手刻 MCP protocol parser。
- Legacy initialize 與 2026-07-28 discovery 都有官方 client 證據。
- 三個 workflow tools 可透過官方 MCP wire 呼叫。
- 跨 Session handoff / acknowledge 可透過兩個獨立 MCP Client 完成。
- Standalone MCP runtime 不依賴 DevSpace。
- 未認證公開入口仍 fail closed，因 top-level server 只允許 local mode + loopback。

## 下一步

進入 Phase 4 Portable Installer：

- 建立 `scripts/session-workflow-portable` lifecycle。
- install / start / stop / status / copy-url。
- local owner identity / state directory / runtime state。
- restart persistence。
- repair / remove SOP。
- 公開 URL 前加入正式 auth gate；不得直接暴露 local unauthenticated MCP。
