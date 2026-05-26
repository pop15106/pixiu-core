---
type: session-recap
日期: 2026-04-29
主題: "Pixiu Auto Research Manual Codex Scoring Mode"
狀態: 完成
負責AI: Codex
專案: "PixiuCore / Playground"
tags: [recap, session, pixiucore, auto-research, manual-scoring]
---

# Session Recap：Pixiu Auto Research Manual Codex Scoring Mode

## 🎯 任務目標與背景

使用者審閱 Pixiu Auto Research Core 方案後確認方向可行，但目前尚未有可用 API，因此要求所有需要 API 的部分先留空，改成先產生 Markdown 結果，再由使用者用 Codex 手動評分。

本次目標是採方案 B：更新 DOCX 方案，並新增 Markdown 評分範本，讓沒有 API 的狀態下仍可跑半自動研究閉環。

## ✅ 本次完成

1. 不啟用 agent team：本次是單一路徑文件與範本調整。
2. 更新 DOCX 產生器 build_pixiu_auto_research_docx.py，加入 Manual Codex Scoring Mode。
3. 重新產出 DOCX：%USERPROFILE%\Documents\Playground\out\Pixiu_Auto_Research_Core_實作方案.docx。
4. 新增三個 Markdown 範本到 %USERPROFILE%\Documents\Playground\templates\auto-research：
   - candidate.md：候選結果與假設紀錄。
   - scorecard.md：Codex 手動評分回填表。
   - codex-eval-prompt.md：給 Codex 的固定評分提示。
5. 文件明確調整為不接外部 API、不保存 API key、不建立 LLM client；API client 與 agent-dispatcher 僅預留。
6. Word COM 成功匯出 PDF，PDF 共 9 頁，文字抽取確認包含 Manual Codex Scoring Mode、candidate.md、scorecard.md、codex-eval-prompt.md 與不接外部 API。
7. artifact-tool renderer 仍失敗，改用 Word COM + PDF 文字檢查 + PDF.js 頁面結構圖確認無空白頁、表格爆版或明顯重疊。

## 🔄 進行中

目前步驟：文件與範本完成，等待使用者審閱新版 DOCX 與 Markdown 範本。

整體進度：1 / 1 Phase 完成。

各 Phase 狀態：
- Phase 1 文件方案調整：✅完成
- Phase 2 Markdown 範本建立：✅完成
- Phase 3 驗證與 recap：✅完成

卡點：無 API 的限制已轉為手動評分流程；自動 agent-dispatcher 待未來有 API 後再接。

## 📐 當前規劃完整內容

Manual Codex Scoring Mode 流程：

1. runner 產生 candidate.md，記錄候選假設、輸入資料、參數、候選結果與限制。
2. runner 產生或提供 codex-eval-prompt.md，固定評分規則與輸出格式。
3. 使用者將 candidate.md 貼給 Codex 評分。
4. 使用者把 Codex 回覆整理進 scorecard.md。
5. registry 讀取或人工登錄 scorecard 資訊，更新 candidate 狀態。
6. 若分數提升，更新 best；若停滯，產生 research_brief，未來再接 reset protocol。

API 預留策略：
- pi/ 目錄保留 .gitkeep，第一版不實作。
- candidate 參數中以 pi_client: TODO_NO_API 標記。
- agent-dispatcher 只保留架構位置，不要求 API key。

## 🎯 重要決策（含棄選方案）

| 決策點 | 選擇 | 棄選方案 | 原因 |
|--------|------|---------|------|
| API 使用策略 | 暫不接 API，API 欄位留空或 TODO | 現在就實作 LLM client | 使用者目前沒有 API，先避免卡在金鑰與串接問題 |
| MVP 評分方式 | Manual Codex Scoring Mode | 完全自動 agent loop | 先用 Markdown 搬運跑通閉環，成本低且可審閱 |
| 產物格式 | candidate.md + scorecard.md + codex-eval-prompt.md | 直接 eval.json-only | Markdown 對人工操作與 Codex 評分更友善 |

## ⚠️ 發現的問題 / 踩坑

- artifact-tool renderer 仍無 stderr 失敗，持續沿用已記錄的替代驗證流程。
- PDF.js 仍只適合作為頁面結構檢查，中文字視覺內容需以 Word/PDF 實際開啟為準。

## 📌 下次 session 要做的事

優先執行：
- [ ] 使用者審閱新版 DOCX 與三個 Markdown 範本。
- [ ] 決定第一個測試 domain 是否採 SAST 報告分析。
- [ ] 若確認，準備 3 至 5 筆去識別化 SAST 樣本，用手動 Codex 評分先跑第一輪。

可並行：
- [ ] 設計 registry.jsonl 的最小欄位。
- [ ] 設計 best.json 與 report.md 的格式。

待確認：
- [ ] Markdown 範本是否要移入 PixiuCore，或先留在 Playground 試跑。

## 💾 關鍵狀態

- 專案：PixiuCore / Playground
- 分支：未檢查，本次未進行 git 操作
- 改動檔案：%USERPROFILE%\Documents\Playground\out\Pixiu_Auto_Research_Core_實作方案.docx、%USERPROFILE%\Documents\Playground\templates\auto-research\candidate.md、%USERPROFILE%\Documents\Playground\templates\auto-research\scorecard.md、%USERPROFILE%\Documents\Playground\templates\auto-research\codex-eval-prompt.md、本 recap、decision 檔、memory-summary.md
- 尚未 commit 的變更：未檢查