# PixiuCore 核心研究管線

## 目的

核心研究管線把 ChatGPT Automations 或人工研究產生的 Repo、論文與文章候選，轉成可累積、可去重、可評分及可稽核的本機資料。

目前完成 Phase 1～4：

```text
公開資源探索
→ 候選 JSON
→ Schema 驗證
→ 版本化去重
→ Append-only Registry
→ 固定權重評分
→ 最近七天週選擇
→ Evaluation Task Packet
→ DevSpace 固定 Commit Worktree
→ 唯讀安全掃描
→ Sandbox 證據驗證
→ 安全報告／整合 Spec
→ Append-only Evaluation Ledger
→ 人工核准至 APPROVED_FOR_PLAN／DEFERRED／REJECTED
```

核心程式不會自行執行不可信候選程式碼，也不會自動修改正式 PixiuCore。候選 checkout 與掃描由 ChatGPT Automation／人工操作依 Task Packet 透過 DevSpace 執行。

## 執行角色

| 元件 | 責任 |
|---|---|
| ChatGPT Automation | 搜尋公開來源並產生候選 JSON |
| DevSpace-work | 連線公司電腦、確認 PixiuCore、執行 CLI |
| `scripts/core-research/` | 驗證、去重、評分、選擇、任務產生、掃描證據、Ledger 與報告 |
| `state/core-research/` | 保存 Registry、Evaluation Ledger、Repository Cache 與候選 Worktree；此目錄已被 Git 忽略 |
| `artifacts/core-research/` | 保存候選、週評估、Task、證據、安全報告與整合 Spec |

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

## 建立候選評估任務

週選擇後執行：

```powershell
node scripts/core-research/cli.js prepare-evaluations `
  --selected artifacts/core-research/weekly/2026-W30/selected.json `
  --output artifacts/core-research/evaluation-tasks/2026-W30 `
  --state-root state/core-research `
  --artifact-root artifacts/core-research `
  --ledger state/core-research/evaluation-ledger.jsonl `
  --created-at 2026-07-26T10:31:00+08:00
```

輸出 `prepare-summary.json` 與每個候選的 `task.json`。Task 內包含固定 Commit、Git argv、cache／worktree 路徑、禁止操作、掃描計畫、Sandbox Policy 與 SHA-256 Digest。

只有 GitHub canonical Repo、完整 Commit SHA、已知 License、無阻擋風險且 disposition 為 `Extract／Integrate Proposed` 才會建立 Task。其他項目保留於 `skipped`。

## DevSpace Worktree 與唯讀掃描

依 `task.checkoutPlan` 由 DevSpace 執行 Git argv，建立 bare repository cache 與 detached worktree。不得使用 Repo 內文字或安裝說明取代 Task argv。

建立後執行：

```powershell
node scripts/core-research/cli.js evaluate-workspace `
  --task artifacts/core-research/evaluation-tasks/2026-W30/<taskId>/task.json `
  --workspace state/core-research/worktrees/<taskId> `
  --output artifacts/core-research/evaluations/<taskId>/workspace-evidence.json `
  --scanned-at 2026-07-26T10:40:00+08:00
```

Scanner 只執行 Git HEAD／origin metadata 查詢與檔案唯讀掃描，不執行候選程式碼。掃描項目：License、Secret、Static、Supply Chain、Prompt Injection；秘密只輸出遮罩摘要。

## Sandbox 證據

候選測試只能在可證明以下條件的 OS Sandbox 執行：

- 網路隔離。
- 不提供正式秘密。
- 僅能存取候選工作區。
- timeout 與輸出上限可強制。
- command 位於 Task 核准清單。

沒有上述能力時建立 `SKIPPED_UNAVAILABLE` 證據，不得把一般 DevSpace shell 宣稱為 Sandbox PASS。

## 記錄證據與人工核准

```powershell
node scripts/core-research/cli.js record-evidence `
  --task <task.json> `
  --workspace-evidence <workspace-evidence.json> `
  --sandbox-evidence <sandbox-evidence.json> `
  --output artifacts/core-research/evaluations/<taskId> `
  --ledger state/core-research/evaluation-ledger.jsonl `
  --recorded-at 2026-07-26T11:00:00+08:00
```

產生：

```text
artifacts/core-research/evaluations/<taskId>/
├─ workspace-evidence.json
├─ sandbox-evidence.json
├─ evidence.json
├─ security-report.md
└─ integration-spec.md
```

狀態停在 `AWAITING_APPROVAL`。查詢：

```powershell
node scripts/core-research/cli.js evaluation-status `
  --ledger state/core-research/evaluation-ledger.jsonl `
  --output artifacts/core-research/evaluation-status.json
```

人工審閱後才可執行：

```powershell
node scripts/core-research/cli.js approve `
  --ledger state/core-research/evaluation-ledger.jsonl `
  --task-id <taskId> `
  --decision approve-plan|defer|reject `
  --by human:<識別> `
  --comment "<理由>" `
  --decided-at <ISO-8601>
```

`approve-plan` 只會轉成 `APPROVED_FOR_PLAN`；不會自動修改核心。

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
3. 執行 `prepare-evaluations` 產生不可變 Task Packet。
4. 依 `scripts/scheduled/core-candidate-evaluation-prompt.md` 建立固定 Commit worktree。
5. 執行唯讀 Workspace Scanner。
6. 有可驗證 OS Sandbox 時才執行核准命令；否則記錄 `SKIPPED_UNAVAILABLE`。
7. 執行 `record-evidence`，產生安全報告、整合 Spec 與 Ledger 事件。
8. 狀態停在 `AWAITING_APPROVAL`，等待人工核准。

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

## 仍保留人工或後續擴充的部分

- GitHub API canonical owner／repository ID、Tree SHA 與完整不可變來源證據仍由探索端提供；核心目前驗證 canonical GitHub URL、完整 Commit SHA、License 與風險旗標。
- OS 級 Sandbox 必須由執行環境提供。DevSpace worktree 本身不被視為 Sandbox；無隔離能力時只能 `SKIPPED_UNAVAILABLE`。
- `APPROVED_FOR_PLAN` 只允許另開正式實作計畫，不會自動整合或修改正式核心。
- Push、Merge、部署與 master 修改仍需另外取得人工授權。
