> **English summary:** Extract the durable cross-session workflow engine from DevSpace into a standalone Core, preserve V1 ledger integrity, provide a standalone MCP server, and keep DevSpace as an optional execution adapter.

# Standalone Session Workflow 實作計畫

**日期：** 2026-08-19
**狀態：** IMPLEMENTING
**基線：** `specs/completed/01-devspace-cross-session-control/`

## 1. 目標

將目前 DevSpace 內的跨 Session workflow 拆成獨立能力，使使用者可以：

1. 不安裝 PixiuCore。
2. 不安裝 DevSpace。
3. 仍能使用 durable cross-session handoff。
4. 保留 claim / handoff / acknowledge / review / complete。
5. 保留 revision CAS、idempotency、hash-chain ledger 與 credential filtering。
6. 有需要本機 Agent 執行時，再選配 DevSpace adapter。

最終架構：

```text
                 Session Workflow Core
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
     Standalone MCP    DevSpace     Web/REST
                         │
                         ▼
                  Local Agent（選配）
```

## 2. 非目標

第一版不做：

- 公開 SaaS 多租戶服務。
- 雲端 DB。
- 任意 ChatGPT UI 自動控制。
- 自動啟動模型。
- 以 actor / sessionRef 取代 authentication。
- Chrome extension 作為主要 workflow source of truth。

## 3. 核心安全不變條件

任何 Phase 都不得移除：

- append-only event ledger。
- SHA-256 hash chain。
- revision compare-and-swap。
- idempotency key。
- stale revision rejection。
- project / session scope isolation。
- handoff target acknowledgment。
- reviewer 與 producer 分離。
- fixed-revision review。
- credential-like data rejection / redaction。
- tampered / truncated ledger fail closed。

## 4. 模組邊界

```text
packages/session-workflow/
├─ core/
│  └─ index.mjs
├─ adapters/
│  ├─ devspace-project-resolver.mjs
│  └─ standalone-project-resolver.mjs
├─ mcp/
│  ├─ register-tools.mjs
│  └─ standalone-server.mjs
└─ tests/
```

DevSpace 既有整合保留在：

```text
scripts/devspace-portable/
├─ DevSpace.WorkflowStore.mjs
├─ DevSpace.OneClick.Subagents.psm1
├─ devspace-oneclick.ps1
└─ tests/
```

## 5. 資料模型

### V1

```text
schemaVersion: 1
projectRoots: [...]
```

V1 ledger 是既有 source of truth，不直接改寫。

### V2

```text
schemaVersion: 2
projectRefs: [...]
```

`projectRef` 是 scope identity，不是 authentication credential。

### V1 → V2 規則

1. V1 event 原文與 hash 不修改。
2. V1 task runtime 可由 projectRoots 推導 projectRef。
3. 第一次使用 V2 identity mutation 時，新 revision 寫 V2 task snapshot。
4. 新 event `previousHash` 指向最後 V1 event hash。
5. parser 同時接受 V1 / V2。
6. 完整 mixed ledger 可 replay。
7. tamper / truncation 一律 fail closed。

## 6. MCP 第一版範圍

Standalone MCP 只提供：

```text
workflow_create
workflow_list
workflow_update
```

`workflow_update` 支援：

```text
claim
handoff
acknowledge
request_review
submit_review
resume
complete
block
```

Standalone 第一版不提供：

```text
workflow_run
workflow_sync
```

兩者留在 DevSpace optional adapter。

## 7. Security Context

Standalone 對外入口需要區分：

```text
principalRef  = 誰在存取
projectRef    = 哪個 project scope
sessionRef    = 哪個協作 session
actor         = workflow 角色名稱
```

原則：

- `principalRef` 才能作 owner/security boundary 的一部分。
- `actor` 不等於 user identity。
- `sessionRef` 不等於 login session。
- Hosted 多使用者模式需要另外加入真正的 OAuth / tenant / ACL。

## 8. Phase 實作順序

### Phase 0 — Baseline Lock ✅

完成：

- workflow baseline tests。
- portable baseline tests。
- V1 valid / tampered / truncated fixtures。
- current behavior checklist。

證據：`phase-0-baseline.md`。

### Phase 1 — Core Extraction ✅

完成：

- 建立 Core public module。
- 抽出 controller / state machine / ledger / snapshot / lock。
- DevSpace wrapper 維持 compatibility exports。
- Core 可在沒有 DevSpace runtime 的測試中執行。

證據：`phase-1-core-extraction.md`。

### Phase 2 — Project Identity Abstraction ✅

完成：

- projectRef。
- schemaVersion 2。
- V1 compatibility read / mutation path。
- DevSpaceProjectResolver。
- StandaloneProjectResolver。
- V1 → V2 mixed ledger。
- OneClick managed Core dependency deployment。

證據：`phase-2-project-identity.md`。

### Phase 3A — Standalone Service / Transport Boundary ✅

已完成：

1. Standalone service，只提供 create/list/update。
2. principal owner isolation 與獨立 state directory。
3. StandaloneProjectResolver。
4. transport-independent tool registration contract。
5. loopback HTTP host 與 `/healthz`。
6. MCP transport 未配置時 `/mcp` 503 fail closed。
7. Session A → handoff → Session B acknowledge → complete E2E。
8. standalone package 不載入 DevSpace runtime。

證據：`phase-3a-standalone-service.md`。

### Phase 3B — Official MCP Transport ✅

已完成：

1. Exact pin `@modelcontextprotocol/server` / `node` / `client` `2.0.0` 與 `zod` `4.4.3`。
2. `registerStandaloneWorkflowTools()` 以 Zod v4 Standard Schema 接到官方 `McpServer`。
3. 使用官方 `createMcpHandler()` + `toNodeHandler()`，不手刻 MCP protocol parser。
4. Local endpoint 加入官方 localhost Host / Origin validation。
5. 官方 MCP Client legacy initialize path 通過。
6. 官方 MCP Client 2026-07-28 `server/discover` negotiation 通過。
7. 兩個官方 MCP Client 完成 create → claim → handoff → list → acknowledge E2E。
8. 公開 unauthenticated mode 維持關閉；top-level server 只允許 local + loopback。
9. OAuth / protected-resource discovery 保留給正式 public entry gate，不在 local-only Phase 3B 開放遠端入口。

證據：`phase-3b-official-mcp-transport.md`。

### Phase 4 — Portable Installer ✅

已完成：

- 8 個 Windows lifecycle commands：install/start/stop/status/copy-url/copy-password/repair/remove。
- `%LOCALAPPDATA%\SessionWorkflowOneClick` durable state。
- Windows DPAPI CurrentUser owner identity。
- HTTPS Microsoft Dev Tunnel remote entry。
- `oauth_owner` Authorization Code + PKCE + DCR + refresh token gate。
- RFC 9728 protected-resource metadata + official MCP bearer validation。
- health / PID identity / restart persistence。
- locked dependency repair 與 fail-safe remove。
- standalone release builder + ZIP smoke test。
- release 排除 DevSpace resolver/tests/test-only MCP client。
- Windows PowerShell 5.1 compatibility fixes。

驗證：Standalone 12/12、portable 12/12、ZIP independent smoke PASS、DevSpace workflow 21/21、DevSpace OneClick 110/110。

證據：`phase-4-portable-installer.md`。

### Phase 5 — DevSpace Optional Integration ✅

已完成：

- Core 移除 `DEVSPACE_WORKFLOW_STATE_DIR` fallback。
- Core 移除 `resolveLocalAgentPolicy`、Agent prompt、agent adapter、`runTask`、`syncTask` 與 DevSpace-specific wording。
- Core 只保留 generic extension mutation seam，仍共用同一 ledger/hash/lock/CAS/idempotency。
- DevSpace compatibility layer 接回 local Agent policy、run/sync 與 state env config。
- DevSpace OneClick 仍使用同一份 Session Workflow Core，沒有第二套 state machine。
- direct boundary test 證明 Standalone Core 無 run/sync/agentAdapter。
- DevSpace 五工具 schema 與行為維持相容。

```text
Standalone：create/list/update
DevSpace：create/list/update/run/sync
```

驗證：DevSpace workflow 22/22、Standalone 12/12、DevSpace OneClick 110/110、Standalone portable 12/12、ZIP smoke PASS。

證據：`phase-5-devspace-optional-integration.md`。

### Phase 6 — Repo Extraction ✅

已完成：

- 建立獨立 GitHub repository：`pop15106/session-workflow`。
- Standalone source、tests、portable installer 與 README 已搬到獨立 repo。
- 新 repo 初始 commit：`8649345 feat: publish standalone session workflow`。
- 新 repo `main` 已 push 到 origin。
- PixiuCore 已改成透過 `external/session-workflow` Git submodule 消費獨立 repo。
- DevSpace 專屬 resolver 保留在 PixiuCore integration layer：`scripts/devspace-portable/DevSpace.ProjectResolver.mjs`。
- PixiuCore 內重複的 `packages/session-workflow` 與 `scripts/session-workflow-portable` source 已移除。
- Standalone repo 驗證：package 12/12、portable 12/12、ZIP independent smoke PASS、npm audit 0 vulnerabilities。

獨立 repo 目前為 Private；朋友可以取得 release ZIP，或在授權 GitHub access 後 clone source。

## 9. 測試策略

### Unit

- validation。
- scope。
- state transitions。
- policy。
- project resolver。

### Persistence

- replay。
- hash chain。
- snapshot。
- lock。
- idempotency。
- stale revision。

### Migration fixtures

至少保留：

- V1 valid。
- V1 tampered。
- V1 truncated。
- V2 valid。
- V1→V2 valid。
- V1→V2 truncated。

### Integration

- DevSpace MCP compatibility。
- Standalone MCP create/list/update。
- OneClick managed runtime import。

### E2E

```text
Session A create
→ claim
→ handoff Session B
→ Session B list
→ acknowledge
→ complete
```

## 10. 驗收條件

- AC-01：Standalone server 不需要 PixiuCore。
- AC-02：Standalone server 不需要 DevSpace。
- AC-03：Standalone 可 create/list/update。
- AC-04：handoff context 完整保存。
- AC-05：Session B 可 acknowledge 並成為 owner。
- AC-06：同 revision 並行 mutation 只一個成功。
- AC-07：idempotency retry 不新增 event。
- AC-08：tampered / truncated ledger fail closed。
- AC-09：V1 ledger 可由新版 Core replay。
- AC-10：V1→V2 不改寫舊 event hash。
- AC-11：DevSpace 五個既有 tools 維持相容。
- AC-12：Standalone 不含 DevSpace Agent runtime dependency。
- AC-13：actor / sessionRef 不被當 authentication credential。
- AC-14：每完成一個 Phase 都更新 durable workflow handoff。

## 11. Definition of Done

只有以下全部成立才完成：

1. Phase 0–5 驗證通過。
2. Standalone MCP E2E 通過。
3. DevSpace compatibility tests 通過。
4. V1 / V2 / mixed ledger migration tests 通過。
5. portable installer 在乾淨環境驗證。
6. 沒有第二套重複 workflow state machine。
7. 安全邊界文件化。
8. 每個 Phase 都有 handoff checkpoint。
9. 最終 repo extraction 前再做一次完整驗證。
