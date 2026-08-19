# Phase 3A Standalone Workflow Service

**日期：** 2026-08-19
**狀態：** VERIFIED
**限制：** 正式 MCP HTTP transport 尚未接官方 SDK。

## 目標

先完成完全不依賴 DevSpace 的 standalone coordination service，將正式 MCP protocol transport 保留為獨立 adapter。

本 Phase 不新增 npm dependency，也不手刻正式 MCP protocol 相容層。

## 完成內容

### Standalone service

新增：

- `packages/session-workflow/mcp/standalone-service.mjs`

能力：

- 只暴露：
  - `workflow_create`
  - `workflow_list`
  - `workflow_update`
- 不暴露：
  - `workflow_run`
  - `workflow_sync`
- `principalRef` 只由 server 建構時注入，不出現在 tool input。
- 每個 principal 使用獨立 state directory：
  - `<stateRoot>/principals/<sha256(principalRef)>`
- model/tool caller 無法透過 input 指定另一個 principal。
- tool input 採 allowlist，未知欄位直接拒絕。
- project identity 由 `StandaloneProjectResolver` 產生。

### Tool registration contract

收斂：

- `packages/session-workflow/mcp/register-tools.mjs`

現在 `createStandaloneWorkflowToolSet()` 與 `registerStandaloneWorkflowTools()` 都共用 Standalone service，不再各自複製 controller mapping 邏輯。

Tool definition 提供 JSON Schema contract：

- `additionalProperties: false`
- 欄位長度 / enum / array item limits
- 無 `principalRef`
- 無 model / Agent run 欄位

### HTTP host

`createStandaloneWorkflowHttpHost()`：

- 預設只 bind `127.0.0.1`。
- 非 loopback host 需要明確 `allowRemote=true`。
- `/healthz` 回傳最小健康狀態，不暴露 principal。
- `/mcp` 未配置 transport adapter 時回 `503`，明確 fail closed。
- MCP adapter 發生例外時對外只回 generic error。
- JSON response 加：
  - `Cache-Control: no-store`
  - `Referrer-Policy: no-referrer`
  - `X-Content-Type-Options: nosniff`
- URL parsing 使用固定 local base，不信任 Host header 作為 routing identity。

### Standalone server host

`packages/session-workflow/mcp/standalone-server.mjs` 已從手刻 JSON-RPC/MCP parser 收斂成 transport host：

- local auth mode 只允許 loopback。
- 建立固定 owner principal。
- 建立 standalone service。
- MCP handler 必須由正式 transport adapter 注入。
- 沒有 adapter 時不宣稱 MCP ready，`/mcp` 回 503。

這避免把自製 2025-era JSON-RPC handler 誤當成正式、可對 ChatGPT Web 長期相容的 MCP server。

## Security context

Standalone 第一版的 identity boundary：

```text
server config principalRef
        ↓
principal state directory
        ↓
projectKey → projectRef
        ↓
sessionRef / actor
```

其中：

- `principalRef`：owner isolation boundary。
- `projectRef`：project scope identity。
- `sessionRef`：協作 session key。
- `actor`：workflow role name。

`actor` 與 `sessionRef` 皆不是 authentication credential。

## TDD 證據

1. 先建立 `standalone-service.test.mjs`。
2. 初始因 `standalone-service.mjs` 不存在，`ERR_MODULE_NOT_FOUND` 紅燈。
3. 實作 service 後 5/5 綠燈。
4. 再新增 standalone registration test。
5. 初始因 `registerStandaloneWorkflowTools` export 不存在而紅燈。
6. 收斂 `register-tools.mjs` 後轉綠。

## E2E

無 DevSpace runtime 的流程已實跑：

```text
Session A
→ workflow_create
→ claim
→ handoff planner-b

Session B
→ workflow_list
→ acknowledge
→ become currentOwner
→ complete
```

結果：PASS。

另驗證：

- owner-a 建 task 後 owner-b list 為空。
- tool input 嘗試傳 `principalRef=owner-b` 被拒絕。
- standalone tool catalog 只有 3 個 coordination tools。

## 測試結果

### Standalone package

```text
node --test packages/session-workflow/tests/*.test.mjs
8 passed
0 failed
1 skipped
```

Skipped：

- OAuth owner mode，等待正式 MCP auth adapter，不實作自製 OAuth。

### Existing DevSpace workflow regression

```text
node scripts/devspace-portable/tests/workflow-store.test.mjs
21 passed
0 failed
```

### Portable regression

```text
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/devspace-portable/tests/run-tests.ps1
110 passed
0 failed
```

### Dependency boundary

目前環境檢查：

```text
@modelcontextprotocol/server = NOT_FOUND
@modelcontextprotocol/node   = NOT_FOUND
zod/v4                       = NOT_FOUND
```

Standalone `mcp/` 與 `StandaloneProjectResolver` 沒有 DevSpace runtime import。

## 官方 MCP transport gate

目前官方 TypeScript SDK 的 remote HTTP 路線需要 MCP server/runtime package；正式 2026-era HTTP transport 不應以手刻 JSON-RPC parser 取代。

因此 Phase 3B 需要新增並鎖定至少：

- `@modelcontextprotocol/server`
- `@modelcontextprotocol/node`
- Standard Schema validator，例如 `zod`

這屬 dependency mutation，需依 Pixiu governance 取得明確授權後才執行。

## Phase 3A 結論

Standalone workflow 的 domain、owner isolation、project identity、tool contracts、HTTP host 與無 DevSpace E2E 已完成。

尚未宣稱：

- 可直接貼 URL 到 ChatGPT Web。
- 正式 MCP 2026 protocol compatibility。
- OAuth production readiness。

這三項必須由 Phase 3B 官方 MCP SDK adapter 完成後才能成立。
