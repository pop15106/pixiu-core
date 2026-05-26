---
type: decision
日期: 2026-04-29
主題: "Pixiu Auto Research Manual Codex Scoring Mode"
狀態: 採納
tags: [decision, pixiucore, auto-research, manual-scoring]
---

# 決策：Pixiu Auto Research Manual Codex Scoring Mode

## 決策內容

在沒有 API 的階段，Pixiu Auto Research Core 暫不接外部 API。所有 API client、agent-dispatcher、LLM 自動評分相關欄位先保留為 TODO 或空白。

MVP 改採 Manual Codex Scoring Mode：系統先產生 candidate.md 與 codex-eval-prompt.md，由使用者手動交給 Codex 評分，再把結果整理為 scorecard.md 回填 registry。

## 選擇原因

使用者目前沒有 API。若先實作 API client，會讓 MVP 卡在金鑰、計費與串接設定；改用 Markdown 人工評分，可以先驗證研究閉環的資料結構、評分欄位與操作手感。

## 棄選方案

- 現在就實作 LLM API client：目前沒有 API，且會增加安全與設定負擔。
- 直接做全自動 agent loop：尚未有穩定 evaluator 與 registry，容易變成不可追蹤的自動化。
- 只產 DOCX 不產範本：無法實際試跑手動閉環。

## 後續要求

下一步先用 3 至 5 筆去識別化 SAST 樣本，測試 candidate.md → Codex 評分 → scorecard.md → registry 的半自動流程。