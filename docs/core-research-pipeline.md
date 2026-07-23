# PixiuCore 核心研究管線

## 目的

核心研究管線把 ChatGPT Automations 或人工研究產生的 Repo、論文與文章候選，轉成可累積、可去重、可評分及可稽核的本機資料。

目前完成 Phase 1～2：

```text
公開資源探索
→ 候選 JSON
→ Schema 驗證
→ 版本化去重
→ Append-only Registry
→ 固定權重評分
→ 最近七天週選擇
→ JSON／Markdown 報告
```

目前不會 Clone、安裝或執行外部程式碼，也不會自動修改正式 PixiuCore。

## 執行角色

| 元件 | 責任 |
|---|---|
| ChatGPT Automation | 搜尋公開來源並產生候選 JSON |
| DevSpace-work | 連線公司電腦、確認 PixiuCore、執行 CLI |
| `scripts/core-research/` | 驗證、去重、評分、選擇及產生報告 |
| `state/core-research/` | 保存跨日共用 Registry；此目錄已被 Git 忽略 |
| `artifacts/core-research/` | 保存可供人工閱讀的候選與週評估報告 |

DevSpace 是安全執行入口，不是排程器。實際排程由 ChatGPT Automations 觸發。

## 重要狀態邊界

Registry 必須保存在來源 PixiuCore 的固定路徑：

```text
<PIXIU_CORE>/state/core-research/registry.jsonl
```

不要把唯一 Registry 放在臨時 worktree 內。DevSpace worktree 用於隔離程式碼或後續候選測試；每日匯入與每週選擇必須讀寫同一份持久 Registry。

`state/` 已列入 `.gitignore`，執行 CLI 不會修改 Git 追蹤內容。

## 候選 JSON 格式

`import` 接受單一物件或陣列。Repo 範例：

```json
[
  {
    "profile": "core-resource",
    "resourceType": "repository",
    "title": "Example Agent Workflow",
    "canonicalUri": "https://github.com/example/agent-workflow",
    "publisher": "example",
    "publishedAt": "2026-07-20T00:00:00Z",
    "updatedAt": "2026-07-23T00:00:00Z",
    "discoveredAt": "2026-07-23T02:00:00Z",
    "commitSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "license": "MIT",
    "categories": ["skill-agent-workflow"],
    "summary": "將規格、實作與審查拆成可重現工作流。",
    "evidence": [
      {
        "source": "https://github.com/example/agent-workflow/commits/main",
        "note": "最近 30 天仍有提交"
      }
    ],
    "metrics": {
      "coreFit": 90,
      "expectedValue": 85,
      "novelty": 75,
      "maturity": 70,
      "feasibility": 80,
      "evidenceQuality": 85,
      "trust": 90
    },
    "riskFlags": []
  }
]
```

### 必填規則

- `resourceType`：`repository`、`paper` 或 `article`。
- `canonicalUri`：只允許 HTTP／HTTPS，且不可內嵌帳號或密碼。
- `publishedAt`、`discoveredAt`：有效 ISO-8601 日期。
- `categories`、`evidence`：至少一項。
- `metrics`：七個 0～100 數值均必填。
- Repo 的 `commitSha` 可暫時省略，但存在時必須是完整 40 字元 hexadecimal SHA。
- License 空白會正規化為 `UNKNOWN`。

## 每日候選匯入

建議先把探索結果放在：

```text
<PIXIU_CORE>/artifacts/core-research/inbox/YYYY-MM-DD-core-resource.json
```

執行：

```powershell
node scripts/core-research/cli.js import `
  --input artifacts/core-research/inbox/2026-07-23-core-resource.json `
  --registry state/core-research/registry.jsonl
```

可選擇固定匯入時間，方便測試：

```powershell
node scripts/core-research/cli.js import `
  --input artifacts/core-research/inbox/2026-07-23-core-resource.json `
  --registry state/core-research/registry.jsonl `
  --imported-at 2026-07-23T10:00:00+08:00
```

相同 Canonical Key 不會重複寫入。Repo 新 Commit、arXiv 新版本或文章新發布日期會建立新候選版本。Registry 讀取時會重新驗證事件 Schema 與 Canonical Key；不一致時停止，避免遭竄改的狀態影響去重與週選擇。

## 每週候選選擇

執行：

```powershell
node scripts/core-research/cli.js weekly-select `
  --registry state/core-research/registry.jsonl `
  --output artifacts/core-research/weekly/2026-W30 `
  --now 2026-07-26T10:30:00+08:00
```

可調參數：

```text
--days              預設 7
--minimum-score     預設 70
--limit             預設 5
--per-category      預設 2
```

輸出：

```text
artifacts/core-research/weekly/2026-W30/
├─ selected.json
├─ rejected.json
└─ weekly-report.md
```

週選擇會先以 Resource Key 合併同一資源的不同版本，只保留排序最高的一版進入配額選擇；其餘版本標記 `DUPLICATE_RESOURCE`。

未入選候選會保存明確 reason code：

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

## 評分與處理方式

| 維度 | 權重 |
|---|---:|
| PixiuCore 關聯度 `coreFit` | 25% |
| 預期改善 `expectedValue` | 20% |
| 創新度 `novelty` | 15% |
| 成熟度 `maturity` | 10% |
| 導入可行性 `feasibility` | 10% |
| 證據品質 `evidenceQuality` | 10% |
| 來源可信度 `trust` | 10% |

處理方式：

- 低於 50：`Reject`
- 50～69.99：`Reference`
- 70～84.99：`Extract`
- 85 以上且無阻擋條件：`Integrate Proposed`

額外限制：

- `SOURCE_BLOCKED`、`INTEGRITY_MISMATCH`、`MALICIOUS_CONTENT`：直接 `Reject`，且週選擇器不得入選。
- License `UNKNOWN`：最多 `Reference`。
- Repo 缺完整 Commit SHA：最多 `Extract`。
- `Integrate Proposed` 只代表可提出整合方案，不能直接修改核心。

## 排程

### 每日 10:00：核心資源探索

1. 確認 DevSpace-work 可連線。
2. 搜尋並整理候選 JSON。
3. CLI 存在時匯入固定 Registry。
4. DevSpace 不可用時，只產出 `PENDING_DEVSPACE` 任務包。
5. 沒有足夠價值的新候選時不通知。

### 每週日 10:30：核心候選週評估

1. 確認 DevSpace-work 可連線。
2. 執行 `weekly-select`。
3. 產生報告與後續評估任務。
4. Phase 1～2 不建立候選 Worktree，也不執行外部內容。
5. 後續 Phase 3 才接 Resource Identity Gate、repo-scan 與隔離 Sandbox。

## 錯誤格式

CLI 不輸出完整 Stack Trace，錯誤統一為：

```text
CORE_RESEARCH_ERROR <ERROR_CODE>: <繁體中文訊息>
```

常見錯誤：

```text
INPUT_JSON_INVALID
INPUT_FILE_READ_FAILED
ARGUMENT_REQUIRED
ARGUMENT_INVALID
CANDIDATE_COMMIT_INVALID
REGISTRY_LINE_INVALID
SELECTION_POLICY_INVALID
```

## 驗證

```powershell
node --test scripts/core-research/test/*.test.js
node --test scripts/core-evolution/test/*.test.js
node --check scripts/core-research/*.js
```

## 尚未實作

- GitHub canonical Resolver 與完整來源證據。
- DevSpace Candidate Worktree 自動建立。
- 授權、Secret、供應鏈、Prompt Injection 與 Sandbox 掃描 Orchestrator。
- 人工核准 Ledger。
- 自動整合或自動修改正式核心。
