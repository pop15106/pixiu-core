# Core Research Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PixiuCore 內建立無第三方依賴的候選 Registry、去重、評分、最近七天週選擇與 CLI 報告閉環。

**Architecture:** 使用 CommonJS 與 Node.js 標準庫，將純邏輯與檔案 I/O 分離。Candidate Schema、Dedupe、Scorer、Selector 保持無檔案系統與網路依賴；Registry、Report Builder 與 CLI 負責邊界 I/O。

**Tech Stack:** Node.js 20+、CommonJS、`node:test`、`node:assert/strict`、JSON／JSONL、Markdown。

## Global Constraints

- 只在 `feature/core-research-pipeline` 的 DevSpace 管理 worktree 工作。
- 不修改、Commit、Push 或 Merge 到 `master`。
- 不新增 npm 套件，只使用 Node.js 標準庫。
- 不 Clone、安裝、下載或執行候選外部程式碼。
- 所有程式註解使用繁體中文。
- 外部候選資料一律視為不可信輸入，所有邊界都必須驗證。
- 不碰既有來源 checkout 的未追蹤檔。
- 每個 Task 遵守 RED → GREEN → REFACTOR，並建立獨立 commit。

---

### Task 1: Candidate Schema 與 Canonical Key

**Files:**
- Create: `scripts/core-research/candidate-schema.js`
- Create: `scripts/core-research/candidate-dedupe.js`
- Test: `scripts/core-research/test/candidate-schema.test.js`
- Test: `scripts/core-research/test/candidate-dedupe.test.js`

**Interfaces:**
- Produces: `normalizeCandidate(input, options?) -> frozen candidate`
- Produces: `buildCanonicalKey(candidate) -> string`
- Produces: `isFullCommitSha(value) -> boolean`

- [x] **Step 1: 寫 Candidate Schema 失敗測試**

測試需覆蓋：

```javascript
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCandidate } = require('../candidate-schema');

test('正規化完整 Repo 候選並固定不可變資料', () => {
  const candidate = normalizeCandidate({
    resourceType: 'repository',
    title: 'Example Repo',
    canonicalUri: 'HTTPS://GITHUB.COM/Example/Repo/',
    publisher: 'Example',
    publishedAt: '2026-07-20T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
    discoveredAt: '2026-07-23T02:00:00Z',
    commitSha: 'a'.repeat(40),
    license: 'MIT',
    categories: ['ai-sdlc'],
    summary: '候選摘要',
    evidence: [{ source: 'https://github.com/Example/Repo', note: '最近有更新' }],
    metrics: {
      coreFit: 90,
      expectedValue: 80,
      novelty: 70,
      maturity: 60,
      feasibility: 80,
      evidenceQuality: 75,
      trust: 85,
    },
  });

  assert.equal(candidate.canonicalUri, 'https://github.com/Example/Repo');
  assert.equal(candidate.commitSha, 'a'.repeat(40));
  assert.ok(Object.isFrozen(candidate));
});
```

另測：不合法 URL、缺欄位、空 categories、metrics 超出 0～100、Repo 非 40 字元 SHA。

- [x] **Step 2: 執行測試確認 RED**

Run:

```powershell
node --test scripts/core-research/test/candidate-schema.test.js
```

Expected: FAIL with `MODULE_NOT_FOUND` for `candidate-schema`.

- [x] **Step 3: 實作最小 Candidate Schema**

實作：

- 支援 `repository | paper | article`。
- URL 只允許 HTTP／HTTPS，移除 hash 與尾斜線。
- 日期轉成 ISO-8601。
- metrics 七欄必填且介於 0～100。
- Repo `commitSha` 可省略；存在時必須完整 40 字元 hexadecimal。
- `license` 空值正規化為 `UNKNOWN`。
- 以 SHA-256 根據 canonical key 產生 `candidateId`。
- 回傳深層凍結的新物件，不修改輸入。

- [x] **Step 4: 寫 Canonical Key 失敗測試**

測試：

- Repo 相同 URI + SHA 產生相同 key。
- Repo 新 SHA 產生不同 key。
- 論文 DOI 優先於 URL。
- arXiv v1 與 v2 產生不同 key。
- 文章 URL 相同但發布日期不同產生不同 key。

- [x] **Step 5: 執行 Dedupe 測試確認 RED**

Run:

```powershell
node --test scripts/core-research/test/candidate-dedupe.test.js
```

Expected: FAIL with `MODULE_NOT_FOUND` for `candidate-dedupe`.

- [x] **Step 6: 實作最小 Canonical Key**

建立 `buildCanonicalKey(candidate)`，輸出：

```text
repository:<normalized-uri>@<commit-or-unpinned>
paper:doi:<lowercase-doi>
paper:arxiv:<lowercase-id>@<version>
paper:url:<normalized-uri>
article:<normalized-uri>@<YYYY-MM-DD>
```

- [x] **Step 7: 執行 Task 1 測試與 syntax check**

Run:

```powershell
node --test scripts/core-research/test/candidate-schema.test.js scripts/core-research/test/candidate-dedupe.test.js
node --check scripts/core-research/candidate-schema.js
node --check scripts/core-research/candidate-dedupe.js
```

Expected: all PASS，syntax checks exit 0。

- [x] **Step 8: Commit Task 1**

```powershell
git add scripts/core-research/candidate-schema.js scripts/core-research/candidate-dedupe.js scripts/core-research/test/candidate-schema.test.js scripts/core-research/test/candidate-dedupe.test.js
git commit -m "feat: add core research candidate schema"
```

---

### Task 2: Append-only Candidate Registry

**Files:**
- Create: `scripts/core-research/candidate-registry.js`
- Test: `scripts/core-research/test/candidate-registry.test.js`

**Interfaces:**
- Consumes: `normalizeCandidate(input)`、`buildCanonicalKey(candidate)`
- Produces: `importCandidates({ registryPath, candidates, importedAt? })`
- Produces: `readRegistry(registryPath)`
- Produces: `listLatestCandidates(events)`

- [x] **Step 1: 寫 Registry 失敗測試**

測試使用 `node:fs/promises.mkdtemp` 與 `node:os.tmpdir()`，覆蓋：

- 首次匯入寫入一個 `CANDIDATE_IMPORTED` JSONL 事件。
- 同批及跨次重複 canonical key 不重複寫入。
- Repo 新 Commit 寫入新事件。
- 壞 JSONL 行回報 `REGISTRY_LINE_INVALID` 與行號。
- `listLatestCandidates` 回傳不可變候選陣列。

- [x] **Step 2: 執行 Registry 測試確認 RED**

Run:

```powershell
node --test scripts/core-research/test/candidate-registry.test.js
```

Expected: FAIL with `MODULE_NOT_FOUND` for `candidate-registry`.

- [x] **Step 3: 實作 Registry**

規則：

- 寫入前先讀現有事件並建立 canonical key Set。
- 每筆事件包含：`schemaVersion`、`eventType`、`eventId`、`eventAt`、`canonicalKey`、`candidate`。
- `eventId` 以 SHA-256 對 canonical key + eventAt 產生。
- 一次 append 一個已組好的 UTF-8 字串，避免半筆事件。
- 回傳 `{ imported, duplicates, eventsWritten }`。
- 不靜默修復壞 Registry。

- [x] **Step 4: 執行 Task 2 測試與回歸**

Run:

```powershell
node --test scripts/core-research/test/candidate-registry.test.js scripts/core-research/test/candidate-schema.test.js scripts/core-research/test/candidate-dedupe.test.js
```

Expected: all PASS。

- [x] **Step 5: Commit Task 2**

```powershell
git add scripts/core-research/candidate-registry.js scripts/core-research/test/candidate-registry.test.js
git commit -m "feat: add append-only candidate registry"
```

---

### Task 3: Candidate Scorer

**Files:**
- Create: `scripts/core-research/candidate-scorer.js`
- Test: `scripts/core-research/test/candidate-scorer.test.js`

**Interfaces:**
- Consumes: normalized candidate
- Produces: `scoreCandidate(candidate, policy?) -> frozen score result`

- [x] **Step 1: 寫 Scorer 失敗測試**

覆蓋：

- 固定權重計算至小數點後兩位。
- 相同輸入結果完全相同。
- 總分 85 以上、License 可用、Repo SHA 完整時為 `Integrate Proposed`。
- Repo 缺 SHA 時最多 `Extract`，reason code 包含 `MISSING_COMMIT_SHA`。
- License `UNKNOWN` 時最多 `Reference`，reason code 包含 `LICENSE_UNKNOWN`。
- `riskFlags` 含 `SOURCE_BLOCKED` 時為 `Reject`。

- [x] **Step 2: 執行 Scorer 測試確認 RED**

Run:

```powershell
node --test scripts/core-research/test/candidate-scorer.test.js
```

Expected: FAIL with `MODULE_NOT_FOUND` for `candidate-scorer`.

- [x] **Step 3: 實作固定權重評分**

預設權重：

```javascript
{
  coreFit: 0.25,
  expectedValue: 0.20,
  novelty: 0.15,
  maturity: 0.10,
  feasibility: 0.10,
  evidenceQuality: 0.10,
  trust: 0.10,
}
```

回傳：

```javascript
{
  candidateId,
  totalScore,
  disposition,
  reasonCodes,
  weightedMetrics,
}
```

- [x] **Step 4: 執行 Task 3 測試與回歸**

Run:

```powershell
node --test scripts/core-research/test/*.test.js
```

Expected: all core-research tests PASS。

- [x] **Step 5: Commit Task 3**

```powershell
git add scripts/core-research/candidate-scorer.js scripts/core-research/test/candidate-scorer.test.js
git commit -m "feat: add deterministic candidate scoring"
```

---

### Task 4: Weekly Selector 與政策設定

**Files:**
- Create: `configs/core-research/discovery-profiles.json`
- Create: `scripts/core-research/weekly-selector.js`
- Test: `scripts/core-research/test/weekly-selector.test.js`

**Interfaces:**
- Consumes: normalized candidates、`scoreCandidate(candidate)`
- Produces: `selectWeeklyCandidates(candidates, policy) -> frozen selection result`

- [x] **Step 1: 寫 Weekly Selector 失敗測試**

建立固定 `now = 2026-07-26T02:30:00.000Z`，覆蓋：

- 八天前候選排除為 `OUTSIDE_TIME_WINDOW`。
- 低於 70 分排除為 `SCORE_BELOW_THRESHOLD`。
- 相同 candidateId／canonical key 只保留一次。
- 同分類最多兩項。
- 全週最多五項。
- 同分依 evidenceQuality、coreFit、時間、candidateId 穩定排序。
- 每個排除項目至少一個 reason code。

- [x] **Step 2: 執行 Selector 測試確認 RED**

Run:

```powershell
node --test scripts/core-research/test/weekly-selector.test.js
```

Expected: FAIL with `MODULE_NOT_FOUND` for `weekly-selector`.

- [x] **Step 3: 實作 Selector**

預設 policy：

```javascript
{
  now: '2026-07-26T02:30:00.000Z',
  days: 7,
  minimumScore: 70,
  totalLimit: 5,
  perCategoryLimit: 2,
}
```

候選以第一個 category 作為配額分類；報告保留完整 categories。

回傳：

```javascript
{
  policy,
  selected: [{ candidate, score }],
  rejected: [{ candidate, score, reasonCodes }],
  statistics: {
    considered,
    selected,
    rejected,
    byCategory,
  },
}
```

- [x] **Step 4: 建立探索設定檔**

`discovery-profiles.json` 固定包含：

- `ai-tech-trends`
- `core-resource`
- 四個核心分類名稱
- 預設週選擇政策 7／70／5／2

- [x] **Step 5: 執行 Task 4 測試與 JSON parse 驗證**

Run:

```powershell
node --test scripts/core-research/test/*.test.js
node -e "JSON.parse(require('node:fs').readFileSync('configs/core-research/discovery-profiles.json','utf8')); console.log('OK')"
```

Expected: tests PASS and output `OK`。

- [x] **Step 6: Commit Task 4**

```powershell
git add configs/core-research/discovery-profiles.json scripts/core-research/weekly-selector.js scripts/core-research/test/weekly-selector.test.js
git commit -m "feat: add weekly candidate selector"
```

---

### Task 5: Report Builder、公開介面與 CLI

**Files:**
- Create: `scripts/core-research/report-builder.js`
- Create: `scripts/core-research/index.js`
- Create: `scripts/core-research/cli.js`
- Test: `scripts/core-research/test/report-builder.test.js`
- Test: `scripts/core-research/test/cli.integration.test.js`

**Interfaces:**
- Consumes: Registry、Scorer、Selector
- Produces: `writeWeeklyReport({ outputDir, selection })`
- Produces CLI commands `import` and `weekly-select`

- [x] **Step 1: 寫 Report Builder 失敗測試**

覆蓋：

- 產生 `selected.json`、`rejected.json`、`weekly-report.md`。
- JSON 使用 UTF-8 與兩格縮排。
- Markdown 包含政策、入選項目、排除原因與統計。
- Markdown 對 `|` 與換行做安全處理，不直接嵌入候選原始 HTML。

- [x] **Step 2: 執行 Report Builder 測試確認 RED**

Run:

```powershell
node --test scripts/core-research/test/report-builder.test.js
```

Expected: FAIL with `MODULE_NOT_FOUND` for `report-builder`.

- [x] **Step 3: 實作 Report Builder 與 index.js**

`index.js` 匯出所有公開函式，不暴露 CLI 內部解析器。

- [x] **Step 4: 寫 CLI 端對端失敗測試**

測試以 temp directory 建立 `input.json`，使用 `spawnSync(process.execPath, [...])`：

1. 執行 `import`，確認 exit 0、Registry 建立。
2. 再執行 `weekly-select --now 2026-07-26T02:30:00.000Z`，確認三個報告檔存在。
3. 不合法 JSON 或未知命令 exit 非 0，stderr 只含簡短錯誤碼，不含 stack trace。

- [x] **Step 5: 執行 CLI 測試確認 RED**

Run:

```powershell
node --test scripts/core-research/test/cli.integration.test.js
```

Expected: FAIL because `cli.js` does not exist。

- [x] **Step 6: 實作 CLI**

支援：

```text
import --input --registry
weekly-select --registry --output [--now] [--days] [--minimum-score] [--limit] [--per-category]
```

建議固定路徑（CLI 仍要求顯式傳入）：

```text
state/core-research/registry.jsonl
artifacts/core-research/weekly/<YYYY-Www>/
```

CLI 錯誤輸出格式：

```text
CORE_RESEARCH_ERROR <ERROR_CODE>: <繁體中文訊息>
```

- [x] **Step 7: 執行 Task 5 測試與 syntax check**

Run:

```powershell
node --test scripts/core-research/test/*.test.js
node --check scripts/core-research/report-builder.js
node --check scripts/core-research/index.js
node --check scripts/core-research/cli.js
```

Expected: all PASS。

- [x] **Step 8: Commit Task 5**

```powershell
git add scripts/core-research/report-builder.js scripts/core-research/index.js scripts/core-research/cli.js scripts/core-research/test/report-builder.test.js scripts/core-research/test/cli.integration.test.js
git commit -m "feat: add core research CLI reports"
```

---

### Task 6: 文件、排程契約與完整驗證

**Files:**
- Create: `docs/core-research-pipeline.md`
- Create: `scripts/scheduled/core-resource-discovery-prompt.md`
- Create: `scripts/scheduled/core-candidate-weekly-review-prompt.md`
- Modify: `docs/superpowers/specs/2026-07-23-core-research-pipeline-design.md`
- Modify: `docs/superpowers/plans/2026-07-23-core-research-pipeline.md`

**Interfaces:**
- Documents CLI contract for ChatGPT Automations and DevSpace execution.

- [x] **Step 1: 撰寫操作文件**

內容必須包含：

- 每日探索只負責產候選 JSON。
- DevSpace 可用且 CLI 存在時執行 import。
- 每週執行 weekly-select。
- DevSpace 不可用時標記 `PENDING_DEVSPACE`。
- 本階段不建立 Worktree、不執行外部內容。
- 範例 JSON 與 PowerShell 指令。

- [x] **Step 2: 建立兩份排程契約**

契約內容對齊已更新的 ChatGPT Automations：

- 每日 10:00 核心資源探索。
- 每週日 10:30 核心候選週評估。
- `master` 禁止修改。
- CLI 不存在時不得假裝已匯入。
- 週評估中的 Worktree／掃描屬 Phase 3，現階段只產選擇結果與待執行任務。

- [x] **Step 3: 執行完整驗證**

Run:

```powershell
node --test scripts/core-research/test/*.test.js scripts/core-evolution/test/*.test.js
node --check scripts/core-research/*.js
node --check scripts/core-evolution/*.js
git diff --check
```

Expected:

- 所有 core-research 與 core-evolution tests PASS。
- 所有 syntax checks exit 0。
- `git diff --check` 無輸出。

- [x] **Step 4: 執行手動 CLI smoke test**

在 worktree 外的暫存目錄準備一份合法候選 JSON，執行 import 與 weekly-select，確認三個報告檔可讀；不得在 repo 內留下 runtime state。

- [x] **Step 5: 更新計畫勾選狀態與設計狀態**

將所有完成步驟改為 `[x]`，設計狀態改為「Phase 1～2 已實作，待使用者審閱」。

- [ ] **Step 6: Commit Task 6**

```powershell
git add docs/core-research-pipeline.md scripts/scheduled/core-resource-discovery-prompt.md scripts/scheduled/core-candidate-weekly-review-prompt.md docs/superpowers/specs/2026-07-23-core-research-pipeline-design.md docs/superpowers/plans/2026-07-23-core-research-pipeline.md
git commit -m "docs: document core research pipeline"
```

## Plan Self-Review

- Spec coverage：Candidate Schema、Registry、Dedupe、Scorer、Selector、Reports、CLI 與排程契約皆有對應 Task。
- Placeholder scan：無 `TBD`、`TODO`、模糊的「補測試」或未定介面。
- Type consistency：所有 Task 統一使用 normalized candidate、canonical key、score result 與 selection result。
- Scope check：只實作 Phase 1～2；Worktree 安全評估與 Approval Ledger 明確排除。
