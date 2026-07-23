# Core Research Pipeline Design

## 文件狀態

- 日期：2026-07-23
- 分支：`feature/core-research-pipeline`
- 基底：`master@b0bb5af84ea8d1f70e977f40b11ea5916052deb6`
- 狀態：Phase 1～2 已實作，待使用者審閱

## 目標

在 PixiuCore 內建立檔案式核心研究閉環，接收 ChatGPT Automations 或人工整理的 Repo、論文與文章候選，完成格式驗證、版本化去重、可重現評分、最近七天週選擇與報告輸出。

本階段只處理候選資料與選擇，不 Clone、不安裝、不執行外部內容，也不建立候選 Worktree。外部 Repo 的隔離安全評估屬後續 Phase 3。

## 使用情境

```text
ChatGPT Automation／人工研究
          ↓
候選 JSON
          ↓
core-research CLI import
          ↓
Candidate Registry（JSONL）
          ↓
core-research CLI weekly-select
          ↓
selected.json／rejected.json／weekly-report.md
          ↓
後續 DevSpace 隔離評估（本階段不實作）
```

## 架構

```text
scripts/core-research/
├─ candidate-schema.js       候選輸入驗證與正規化
├─ candidate-dedupe.js       Canonical Key 與版本化去重
├─ candidate-registry.js     Append-only JSONL Registry
├─ candidate-scorer.js       固定權重評分與處理方式限制
├─ weekly-selector.js        七天視窗、門檻、排序與分類配額
├─ report-builder.js         JSON 與 Markdown 報告
├─ cli.js                    import／weekly-select 命令
├─ index.js                  公開介面
└─ test/                     node:test 測試

configs/core-research/
└─ discovery-profiles.json   探索分類與預設選擇政策
```

## 設計邊界

### Candidate Schema

候選輸入必須包含：

- `resourceType`：`repository | paper | article`
- `title`
- `canonicalUri`：只允許 HTTP／HTTPS，且不可內嵌帳號或密碼
- `publisher`
- `publishedAt`
- `discoveredAt`
- `categories`：至少一項
- `summary`
- `evidence`：至少一項具來源的證據
- `metrics`：七個 0～100 評分維度

Repo 額外規則：

- `commitSha` 若存在，必須是完整 40 字元 hexadecimal SHA。
- 沒有完整 Commit SHA 的 Repo 可以進 Registry，但不得成為 `Integrate Proposed`，週選擇結果需標示 `MISSING_COMMIT_SHA`。
- `license` 不明時最多只能 `Reference`。

論文版本鍵：

- 優先使用 `doi`。
- 沒有 DOI 時使用 `arxivId + arxivVersion`。
- 都沒有時退回 canonical URL。

文章版本鍵：

- 使用正規化 canonical URL 與 `publishedAt` 日期。

### Candidate Registry

Registry 為 append-only JSONL：

- 每次成功匯入產生 `CANDIDATE_IMPORTED` 事件。
- 重複匯入產生結果但不重複寫入事件。
- 每行都是完整事件，不依賴跨行可變狀態。
- Registry 讀取遇到壞行時必須回報行號，不得靜默跳過。
- `CANDIDATE_IMPORTED` 事件必須使用支援的 Schema，且保存的 `canonicalKey` 必須與候選重新計算結果一致；不一致時視為狀態遭竄改並停止。

候選狀態第一版只使用：

```text
DISCOVERED
SHORTLISTED
REFERENCE_ONLY
REJECTED
```

`EVALUATING` 之後的 Worktree／Approval 狀態留給 Phase 3～4。

### 評分

固定權重：

| 維度 | 權重 |
|---|---:|
| coreFit | 25 |
| expectedValue | 20 |
| novelty | 15 |
| maturity | 10 |
| feasibility | 10 |
| evidenceQuality | 10 |
| trust | 10 |

總分四捨五入至小數點後兩位。

處理方式：

- 阻擋風險：`Reject`
- License 不明：最多 `Reference`
- Repo 缺完整 Commit SHA：最多 `Extract`
- 總分低於 50：`Reject`
- 50～69.99：`Reference`
- 70～84.99：`Extract`
- 85 以上且無版本／授權阻擋：`Integrate Proposed`

### 週選擇器

預設政策：

- `days = 7`
- `minimumScore = 70`
- `totalLimit = 5`
- `perCategoryLimit = 2`

同一資源的不同版本先以 Resource Key 分組，只保留排序最高的一個版本進入配額選擇；其他版本標記 `DUPLICATE_RESOURCE`。Repo 的 Resource Key 不含 Commit SHA，論文不含 arXiv version，文章不含發布日期。

候選先依以下順序排序：

1. 總分高
2. `evidenceQuality` 高
3. `coreFit` 高
4. `updatedAt` 或 `publishedAt` 新
5. `candidateId` 字典序

排除原因必須可機器判讀：

```text
OUTSIDE_TIME_WINDOW
SCORE_BELOW_THRESHOLD
CATEGORY_QUOTA_REACHED
TOTAL_LIMIT_REACHED
SOURCE_BLOCKED
INTEGRITY_MISMATCH
MALICIOUS_CONTENT
DUPLICATE_RESOURCE
```

缺 Commit SHA 或 License 不明不一定排除，但會限制 disposition。

### CLI

```powershell
node scripts/core-research/cli.js import --input <candidates.json> --registry <registry.jsonl>
node scripts/core-research/cli.js weekly-select --registry <registry.jsonl> --output <directory> --now <ISO-8601>
```

`import` 接受單一候選物件或候選陣列。

`weekly-select` 產生：

```text
selected.json
rejected.json
weekly-report.md
```

CLI 必須以非零 exit code 回報不合法輸入，且不得輸出秘密或完整 stack trace。

## 安全限制

- 不執行候選內容中的任何指令。
- 不 Clone、不安裝、不下載候選程式碼。
- 不讀 `.env`、Token、SSH Key 或正式資料。
- 只解析 JSON 與寫入指定 Registry／Output 路徑。
- 不修改 `master`，不 Push、不 Merge。
- 所有程式註解使用繁體中文。
- 不新增 npm 套件，僅使用 Node.js 標準庫。

## 驗收條件

1. Repo、論文與文章可被驗證並正規化，URL 內嵌帳密會被拒絕。
2. 相同版本候選重複匯入時 Registry 不增加事件。
3. Repo 新 Commit 或論文新版本會產生新候選版本。
4. Registry 事件 Schema 或 Canonical Key 遭竄改時停止處理。
5. 評分結果在相同輸入下可重現。
6. License 不明不能得到 `Extract` 以上處理方式。
7. Repo 缺完整 Commit SHA 不能得到 `Integrate Proposed`。
8. 週選擇只使用最近七天候選、同一資源只保留一個版本、總數最多五項、同分類最多兩項。
9. 每個未入選候選都有明確 reason code，阻擋型風險不得入選。
10. CLI 可完成 import → weekly-select 的端對端流程。
11. 既有 `scripts/core-evolution/test/*.test.js` 全數維持通過。

## 本階段不做

- GitHub API Resolver。
- 自動搜尋網路。
- DevSpace Candidate Worktree 建立。
- Repo 安全掃描與 Sandbox 執行。
- 人工核准 Ledger。
- 自動產生或修改 Skill／Rule／Hook。
- 自動 Commit、Push、Merge 或部署。
- PostgreSQL、SQLite 或第三方套件。
