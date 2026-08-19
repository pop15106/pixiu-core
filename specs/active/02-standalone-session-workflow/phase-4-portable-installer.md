# Phase 4 — Portable Installer

**日期：** 2026-08-19
**狀態：** COMPLETE

## 目標

讓朋友可以只取得 Standalone Session Workflow release，在 Windows 上使用 remote MCP，而不需要 PixiuCore 或 DevSpace。

## 完成內容

### 1. Windows lifecycle

`scripts/session-workflow-portable/` 現在提供：

1. `01-INSTALL-AND-START.cmd`
2. `02-START.cmd`
3. `03-STOP.cmd`
4. `04-STATUS.cmd`
5. `05-COPY-MCP-URL.cmd`
6. `06-COPY-OWNER-PASSWORD.cmd`
7. `07-REPAIR.cmd`
8. `08-REMOVE.cmd`

主程式：

- `session-workflow-oneclick.ps1`
- `SessionWorkflow.Portable.psm1`

### 2. Local owner identity

預設 state root：

```text
%LOCALAPPDATA%\SessionWorkflowOneClick
```

owner password：

- 192-bit cryptographic random value。
- 使用 Windows DPAPI `CurrentUser` 保護。
- 不印到 console。
- copy-password 只寫 clipboard。
- Windows PowerShell 5.1 會先顯式載入 `System.Security`，避免 `ProtectedData` assembly 未預載。

### 3. Secure remote entry

Runtime：

```text
Internet / ChatGPT
→ HTTPS Microsoft Dev Tunnel
→ 127.0.0.1 Session Workflow
→ OAuth bearer gate
→ official MCP transport
```

Session Workflow process 本身只允許 loopback bind。

Dev Tunnel 可匿名轉發到 HTTP endpoint，但 MCP `/mcp` 本身不是 anonymous：

- OAuth 2.1 style authorization-code flow。
- PKCE S256。
- Dynamic Client Registration public client。
- RFC 9728 path-aware protected resource metadata。
- `WWW-Authenticate: Bearer ... resource_metadata=...`。
- Access token expiration。
- Refresh token rotation。
- `offline_access` 相容宣告。
- token persistent state 只保存 hash。
- Host / Origin allowlist 支援 localhost + 本次 Dev Tunnel hostname。

### 4. Official MCP auth integration

新增：

- `packages/session-workflow/mcp/owner-oauth-http.mjs`

強化：

- `owner-oauth.mjs`
- `official-transport.mjs`
- `standalone-server.mjs`
- `standalone-service.mjs`

`oauth_owner` mode 現在不是 prototype flag：

- OAuth metadata / DCR / authorize / token endpoints 已接 HTTP server。
- official MCP resource server 以 SDK `verifyBearerToken()` 驗 Bearer token。
- 401 challenge 使用 SDK `bearerAuthChallengeResponse()`。
- injected custom MCP handler 在 `oauth_owner` mode 被拒絕，避免 bypass auth gate。

### 5. OAuth restart persistence

persistent OAuth state 保存：

- dynamic client registrations。
- access token hash records。
- refresh token hash records。

不保存：

- raw owner password。
- raw access token。
- raw refresh token。
- authorization request / authorization code temporary state。

因此 server restart 後既有 client/token 可在有效期限內繼續驗證。

### 6. Portable repair/remove

Repair：

- 驗證 package server 可 import。
- 驗證 DPAPI owner identity。
- dependency 損壞時用 `package-lock.json` + `npm ci --omit=dev --ignore-scripts` 修復。

Remove：

- 必須手動輸入 `REMOVE`。
- 先停止已驗證 PID identity 的 process。
- 先刪除本安裝自己的 Dev Tunnel。
- Dev Tunnel delete 失敗時保留 local state，避免外部資源與 local identity 失聯。
- 成功後才刪 workflow state / owner identity。

### 7. Release builder

新增：

- `scripts/session-workflow-portable/build-portable.ps1`
- `scripts/session-workflow-portable/tests/smoke-bundle.ps1`
- `scripts/session-workflow-portable/README.md`

Release 只包含：

- Core。
- Standalone project resolver。
- MCP runtime。
- production dependencies。
- Windows OneClick lifecycle。

Release 不包含：

- DevSpace project resolver。
- DevSpace runtime。
- PixiuCore vault / memory。
- package tests。
- test-only `@modelcontextprotocol/client` dependency。

本次產物：

```text
artifacts/session-workflow-portable/SessionWorkflowOneClick-0.1.0.zip
size ≈ 3.33 MB
```

### 8. Windows PowerShell 5.1 compatibility fixes

portable tests 實際抓到並修復：

- `RandomNumberGenerator.Fill()` 在舊 .NET 不可用 → 改 `RandomNumberGenerator.Create().GetBytes()`。
- `ProtectedData` assembly 未預載 → 顯式 `Add-Type -AssemblyName System.Security`。
- Dev Tunnel JSON optional properties + `Set-StrictMode` → 改透過 `PSObject.Properties` 安全讀取。
- build script parameter / array parsing 的 Windows PowerShell 5.1 差異。

## 驗證

### Standalone package

```text
12 passed
0 failed
0 skipped
```

包含：

- official MCP legacy / modern。
- two-client cross-session handoff。
- OAuth discovery / DCR / PKCE / owner approval。
- 401 resource metadata challenge。
- official MCP Client Bearer access。
- refresh token rotation。
- hashed auth state persistence。

### Standalone portable

```text
12 passed
0 failed
```

### Release ZIP smoke

從 ZIP 解壓到 `%TEMP%`，不使用 repository path：

```text
PASS
```

驗證：

- server import。
- local server start。
- `/healthz`。
- configured official MCP transport。
- no DevSpace resolver。
- no tests。
- no test-only MCP client dependency。

### DevSpace regression

```text
workflow: 21 passed / 0 failed
OneClick: 110 passed / 0 failed
```

### Dependency audit

Portable production install：

```text
0 vulnerabilities
```

### Dev Tunnel CLI contract

只執行 `--help` / `--version`，沒有建立或刪除真實 Microsoft Dev Tunnel。

已確認 installer 使用的：

- `create --allow-anonymous --expiration`
- `port create --port-number --protocol http`
- `host`
- `delete`

皆存在於本機 CLI command surface。

## 未執行的外部 mutation

本 Phase 沒有為了測試而：

- 建立真實 Dev Tunnel。
- 刪除真實 Dev Tunnel。
- 修改 Microsoft account resources。

這是刻意避免測試對使用者外部帳號造成持久 mutation；remote security contract 已由 local OAuth E2E、CLI contract check 與 bundle smoke 驗證。

## ChatGPT Web 注意事項

ChatGPT Web custom MCP / Apps 的可用功能取決於帳號方案、workspace admin 設定與 Developer mode。這是產品層能力，不由 portable installer 決定。

## Phase 4 結論

Phase 4 完成。

Standalone release 已具備：

- Windows portable lifecycle。
- independent release bundle。
- secure OAuth-protected remote MCP design。
- durable local workflow state。
- owner identity persistence。
- repair/remove。
- restart/reboot 後 state 保留。

下一步：Phase 5 DevSpace Optional Integration 收斂。
