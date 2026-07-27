# Core Evolution Gates Implementation Plan

- 執行狀態：已完成，2026-07-27 重新驗證 `16 / 16` 通過

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Resource Identity Gate、MCP Compatibility Gateway 與 Pixiu Extension Package 三個可獨立測試、可串接的核心模組。

**Architecture:** 使用零外部依賴的 CommonJS 模組，將資源身分驗證、MCP 版本協商及擴充套件驗證分離。Extension 驗證流程必須先通過 Resource Identity，再通過 MCP 相容性及權限驗證。

**Tech Stack:** Node.js 內建模組、`node:test`、`node:assert/strict`、`crypto`、CommonJS。

## Global Constraints

- 實作順序固定為 Resource Identity Gate → MCP Compatibility Gateway → Pixiu Extension Package。
- 不新增 npm 套件或 package.json。
- 不修改既有 ECC plugin.json 與 marketplace.json。
- 所有錯誤均回傳可辨識的錯誤碼，不靜默放行。
- 未驗證或完整性不符的資源禁止安裝與執行。
- MCP RC 版本必須透過 Feature Flag 才能協商。
- Extension 實際權限為宣告、Host、使用者與 L0 政策權限的交集。

---

### Task 1: Resource Identity Gate

**Files:**
- Create: `scripts/core-evolution/resource-identity-gate.js`
- Test: `scripts/core-evolution/test/resource-identity-gate.test.js`

**Interfaces:**
- Produces: `normalizeResourceIdentity(input)`、`verifyResourceIdentity(identity, evidence)`、`decideResourceAccess(verification, action)`。

- [x] Step 1: 撰寫正規化、Digest、冒名與動作授權失敗測試。
- [x] Step 2: 執行測試並確認因模組不存在而失敗。
- [x] Step 3: 實作最小身分模型、SHA-256 驗證及信任決策。
- [x] Step 4: 執行測試並確認通過。

### Task 2: MCP Compatibility Gateway

**Files:**
- Create: `scripts/core-evolution/mcp-compatibility-gateway.js`
- Test: `scripts/core-evolution/test/mcp-compatibility-gateway.test.js`

**Interfaces:**
- Produces: `negotiateMcpVersion(clientVersions, serverVersions, options)`、`validateCanonicalTool(tool)`、`toCanonicalTool(version, tool)`、`fromCanonicalTool(version, tool)`。

- [x] Step 1: 撰寫穩定版協商、RC 閘門、無共同版本及工具轉換測試。
- [x] Step 2: 執行測試並確認失敗。
- [x] Step 3: 實作版本排序、Feature Flag 及 Canonical Tool 驗證。
- [x] Step 4: 執行測試並確認通過。

### Task 3: Pixiu Extension Package

**Files:**
- Create: `scripts/core-evolution/pixiu-extension-package.js`
- Test: `scripts/core-evolution/test/pixiu-extension-package.test.js`

**Interfaces:**
- Consumes: Resource Identity Gate 與 MCP Compatibility Gateway。
- Produces: `validateExtensionManifest(manifest, context)`、`calculateEffectivePermissions(requested, host, user, policy)`、`createExtensionLock(manifest, files)`。

- [x] Step 1: 撰寫 Manifest、身分、MCP、權限交集與 Lock Digest 測試。
- [x] Step 2: 執行測試並確認失敗。
- [x] Step 3: 實作最小 Extension 驗證與鎖定檔模型。
- [x] Step 4: 執行測試並確認通過。

### Task 4: 整合入口與文件

**Files:**
- Create: `scripts/core-evolution/index.js`
- Create: `docs/core-evolution-gates.md`
- Test: `scripts/core-evolution/test/integration.test.js`

**Interfaces:**
- Produces: 單一入口匯出三個核心模組；整合流程 `validateExtensionCandidate(candidate, context)`。

- [x] Step 1: 撰寫端到端候選擴充驗證測試。
- [x] Step 2: 執行測試並確認失敗。
- [x] Step 3: 實作整合入口與文件。
- [x] Step 4: 執行全部核心測試。
- [x] Step 5: 執行語法檢查、Git diff 與白名單檢查。

## 最新驗證

```text
node --test scripts/core-evolution/test/*.test.js
16 tests passed, 0 failed
```
