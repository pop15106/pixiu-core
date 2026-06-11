---
type: session-recap
date: 2026-04-29
project: AUTO_RESEARCH
system: PIXIUCORE
repo: pixiu-auto-research
topic: mvp-implementation
status: done
tags: [recap, session, pixiucore, auto-research, mvp, manual-scoring]
summary: 收斂 Auto Research MVP 的落地實作步驟，聚焦第一條可運作的 vertical slice。
---

# Session Recap：Pixiu Auto Research MVP 實作落地

## 🎯 任務目標與背景

使用者確認 Pixiu Auto Research Core 方案可行，並要求在 `<workspace-root>` 開始實作。因目前尚無 API，本次實作採 Manual Codex Scoring Mode：系統產生 Markdown candidate 與評分 prompt，使用者手動交給 Codex 評分，再用 CLI 回填 score 與 verdict。

本次遵守最小改動原則：`gravityTest` 是既有大型資料夾，內含多個 PCLMS/Pixiu 相關資料夾且不是 git repo，因此只新增獨立子專案 `<workspace-root>\pixiu-auto-research`，未修改其他既有檔案。

## ✅ 本次完成

1. 檢查目標路徑：`<workspace-root>` 已存在，且不是 git repo。
2. 確認 `pixiu-auto-research` 子資料夾原本不存在，避免覆蓋既有內容。
3. 建立 Pixiu Auto Research MVP 專案骨架，先在 workspace 完成，再複製到 Desktop 目標路徑。
4. 實作 Node.js CLI，僅使用 Node 內建模組，不需要 npm install。
5. 實作核心流程：init-run、new-candidate、record-score、report、list、best。
6. 建立 SAST domain plugin 雛形：rubric.yaml、candidate.schema.json、sample dataset、Markdown templates。
7. 建立 Manual Codex Scoring 範本：candidate.md、scorecard.md、codex-eval-prompt.md。
8. 在 workspace 跑 smoke test 成功。
9. 將專案複製到 `<workspace-root>\pixiu-auto-research`。
10. 在 Desktop 目標路徑跑 smoke test 成功，產生：
    - run_id：run-20260429-112429
    - candidate_id：candidate-001
    - score：72
    - verdict：keep
    - report：`<workspace-root>\pixiu-auto-research\experiments\run-20260429-112429\report.md`

## 🔄 進行中

目前步驟：MVP 初版已可跑，等待使用者審閱檔案與決定第一批真實測試資料。

整體進度：1 / 1 Phase 完成。

各 Phase 狀態：
- Phase 1 專案骨架：✅完成
- Phase 2 Manual Codex Scoring CLI：✅完成
- Phase 3 SAST domain 範本：✅完成
- Phase 4 smoke test：✅完成
- Phase 5 recap：✅完成

卡點：無。下一步需要使用者提供或指定去識別化 SAST 範例資料。

## 📐 當前規劃完整內容

專案位置：

```text
<workspace-root>\pixiu-auto-research
```

主要結構：

```text
pixiu-auto-research/
  package.json
  README.md
  configs/default-budget.json
  src/cli.mjs
  src/core/fs.mjs
  src/core/ids.mjs
  src/core/registry.mjs
  src/core/report.mjs
  src/core/templates.mjs
  scripts/smoke.mjs
  domains/sast-analysis/
    rubric.yaml
    candidate.schema.json
    dataset/golden.jsonl
    dataset/samples/sample-report.json
    templates/candidate.md
    templates/scorecard.md
    templates/codex-eval-prompt.md
  experiments/
  docs/architecture.md
  docs/runbook.md
```

可用指令：

```powershell
node src\cli.mjs init-run --domain sast-analysis --goal "SAST 報告分析手動評分測試"
node src\cli.mjs new-candidate --run latest --hypothesis "降低中低風險誤報，保留高風險 issue"
node src\cli.mjs record-score --run latest --candidate candidate-001 --score 72 --verdict keep --note "Codex manual scoring"
node src\cli.mjs report --run latest
node src\cli.mjs best --run latest
node scripts\smoke.mjs
```

若使用 npm script：

```powershell
npm run cli -- init-run --domain sast-analysis --goal "SAST 報告分析手動評分測試"
npm run smoke
```

目前安全邊界：
- 不接外部 API。
- 不需要 API key。
- 不讀 `.env`。
- 不寫入正式專案程式碼。
- 實驗輸出只放 `experiments/run-*`。
- `.gitignore` 已排除 experiments 內容，但保留 experiments/.gitkeep。

## 🎯 重要決策（含棄選方案）

| 決策點 | 選擇 | 棄選方案 | 原因 |
|--------|------|---------|------|
| 專案位置 | `gravityTest\pixiu-auto-research` 獨立子專案 | 直接放在 gravityTest 根目錄 | gravityTest 已有大量既有資料，獨立子專案可避免污染與覆蓋 |
| 技術選型 | Node.js ESM + 內建模組 | TypeScript / npm dependencies | 第一版重點是可跑閉環，不引入安裝成本 |
| 評分模式 | Manual Codex Scoring Mode | API 自動評分 | 使用者目前沒有 API，先用 Markdown 手動評分跑通流程 |
| 實驗輸出 | `experiments/run-*` | 分散在各資料夾 | 便於回放、清理、git ignore 與後續 registry 管理 |

## ⚠️ 發現的問題 / 踩坑

- Windows 下用 `import.meta.url` 轉 path 時，不能直接取 `.pathname`，會產生 `C:\C:\...` 錯誤；已改用 `fileURLToPath(import.meta.url)`。
- sandbox 中 Node 子行程 `spawnSync(process.execPath)` 會 EPERM；smoke test 已改成直接呼叫核心函式，不再 spawn Node。
- `gravityTest` 不是 git repo，後續若要版本管理，應先由使用者決定是否在子專案初始化 git，或納入既有管理方式。

## 📌 下次 session 要做的事

優先執行：
- [ ] 使用者打開 `<workspace-root>\pixiu-auto-research\README.md` 與 `docs/runbook.md` 檢查操作流程。
- [ ] 準備 3 至 5 筆去識別化 SAST 報告樣本，替換 `domains/sast-analysis/dataset/` 的示範資料。
- [ ] 用真實樣本跑第一輪 `new-candidate` → Codex 手動評分 → `record-score`。

可並行：
- [ ] 設計 registry.jsonl 的穩定欄位版本。
- [ ] 補 deterministic evaluator 的最小 metrics，例如格式合規率與必要欄位檢查。

待確認：
- [ ] 是否要在 `pixiu-auto-research` 子專案初始化 git。
- [ ] 是否要把此 MVP 反向同步成 PixiuCore command / skill。

## 💾 關鍵狀態

- 專案：`<workspace-root>\pixiu-auto-research`
- 分支：無，目標資料夾目前不是 git repo
- 改動檔案：新增 `pixiu-auto-research` 子專案；未修改 gravityTest 其他既有檔案
- 尚未 commit 的變更：未檢查，因未初始化 git