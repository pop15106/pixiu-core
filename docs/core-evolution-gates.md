# PixiuCore 核心演進閘門

本模組依序提供三個安全邊界，並固定對應 PixiuCore Safety Hardening Gate A～C：

1. `Gate A — Resource Identity Gate`：正規化資源身分、驗證來源與 SHA-256 完整性，阻止不存在、冒名或遭竄改的資源進入安裝與執行階段。
2. `Gate B — MCP Compatibility Gateway`：協商 MCP 版本，將外部 Tool 轉換成 Pixiu Canonical Tool；Release Candidate 必須透過明確 Feature Flag 啟用。
3. `Gate C — Pixiu Extension Package`：驗證 Extension Manifest、Host 與 MCP 相容性，計算四方權限交集並建立可重現 Lock Digest。

Canonical machine-readable closure：`docs/architecture/pixiucore-safety-hardening-gates.v1.json`。該檔由 `scripts/core-evolution/safety-hardening-gate-closure.js` fail closed 驗證 Gate ID、名稱、implementation/test/evidence path 與 PASS 狀態，避免只靠文件名稱外推 closure。

## 位置

```text
scripts/core-evolution/
├─ resource-identity-gate.js
├─ mcp-compatibility-gateway.js
├─ pixiu-extension-package.js
├─ index.js
└─ test/
```

## 核心規則

- `VERIFIED`：來源存在、發布者可信，且宣告的 SHA-256 Digest 與實際內容一致；可進入安裝與執行判斷。
- `KNOWN`：來源與發布者已確認，但未鎖定內容 Digest；只允許讀取。
- `UNVERIFIED`：證據不足；禁止安裝與執行。
- `BLOCKED`：資源不存在、疑似冒名或 Digest 不符；直接拒絕。

## MCP 支援

- `2025-11-25`：穩定版，預設可協商。
- `2026-07-28-rc`：候選版，僅在 `allowReleaseCandidate: true` 時可協商。

正式版 Schema 發布後，應以新增 Adapter 的方式支援，不將版本分支散落至 Extension Runtime。

## Extension 驗證範例

```javascript
const { validateExtensionCandidate } = require('../scripts/core-evolution');

const result = validateExtensionCandidate(candidate, {
  host: 'chatgpt',
  clientMcpVersions: ['2025-11-25'],
  identityEvidence: {
    exists: true,
    publisherVerified: true,
    content: candidateSource,
  },
  hostPermissions: candidate.manifest.permissions,
  userPermissions: candidate.manifest.permissions,
  policyPermissions: candidate.manifest.permissions,
});

if (!result.valid) {
  throw new Error(result.errors.join(','));
}
```

## 權限模型

有效權限是以下四組權限的交集：

- Extension Manifest 宣告權限
- Host 可提供權限
- 使用者核准權限
- Pixiu L0 政策允許權限

任一層未授權，最終有效權限即不包含該項能力。

## 驗證指令

```powershell
node --test scripts/core-evolution/test/*.test.js
node --check scripts/core-evolution/resource-identity-gate.js
node --check scripts/core-evolution/mcp-compatibility-gateway.js
node --check scripts/core-evolution/pixiu-extension-package.js
node --check scripts/core-evolution/index.js
```
