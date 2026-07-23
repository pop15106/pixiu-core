# 核心候選週評估排程契約

## 排程

- 時間：每週日 10:30
- 時區：Asia/Taipei
- 執行入口：ChatGPT Automation → DevSpace-work → PixiuCore CLI

## 目標

使用最近七天的 Candidate Registry，執行可重現的週選擇，產生入選、排除與 Markdown 報告，並整理後續 DevSpace 安全評估任務。

## 執行步驟

1. 確認 `DevSpace-work` 可連線。
2. 確認 PixiuCore 可讀取；不得修改 Git 追蹤中的 `master` 內容。
3. 確認以下檔案存在：

```text
scripts/core-research/cli.js
state/core-research/registry.jsonl
```

4. 執行：

```powershell
node scripts/core-research/cli.js weekly-select `
  --registry state/core-research/registry.jsonl `
  --output artifacts/core-research/weekly/YYYY-Www `
  --now <本次排程的 ISO-8601 時間> `
  --days 7 `
  --minimum-score 70 `
  --limit 5 `
  --per-category 2
```

5. 讀取：

```text
selected.json
rejected.json
weekly-report.md
```

6. 依四個核心分類整理入選項目：
   - `skill-agent-workflow`
   - `ai-sdlc`
   - `security-testing`
   - `tool-integration`
7. 每項保留：
   - 固定來源與版本
   - 分數與 disposition
   - License
   - 主要證據
   - 核心差異與預期改善
   - 主要風險
   - 下一階段建議

## Phase 1～2 邊界

目前週排程只完成候選選擇與報告，不執行以下動作：

- 不 Clone Repo。
- 不建立候選 Worktree。
- 不安裝依賴。
- 不執行外部測試或 Sandbox。
- 不修改正式 PixiuCore。
- 不產生自動核准或自動整合結果。

Repo 缺完整 Commit SHA 時最多為 `Extract`；License 不明時最多為 `Reference`；`SOURCE_BLOCKED` 直接排除。

## 後續 Phase 3 任務包

對入選 Repo 只產生待執行任務描述，內容包含：

- canonical URL
- 完整 Commit SHA
- License
- 預計建立的隔離 Worktree 名稱
- 授權檢查
- Secret Scan
- 靜態分析
- 依賴與供應鏈掃描
- Prompt Injection 檢查
- 受限 Sandbox 測試
- 禁止 Commit／Push／Merge／部署／formal-core-write

任務包狀態標記為 `PENDING_PHASE_3`，不得在 Phase 1～2 自動執行。

## DevSpace 或資料不可用時

- DevSpace 不可用：標記 `PENDING_DEVSPACE`，只回報待執行指令。
- CLI 不存在：標記 `PENDING_IMPLEMENTATION`，不得假裝已跑選擇器。
- Registry 不存在：標記 `NO_REGISTRY`，不得用聊天記憶冒充正式候選池。
- Registry 壞行：回報 `REGISTRY_LINE_INVALID` 與行號，停止本次選擇。

## 人工核准

- `Integrate Proposed` 只能形成整合 Spec 草案。
- 所有整合項目停在 `AWAITING_APPROVAL`。
- 人工核准後必須另開正式實作分支／任務。
- 不 Commit、Push、Merge 或部署。

## 通知條件

- 至少一項候選達到最低分數並入選時才通知。
- 沒有入選項目時不要通知。
