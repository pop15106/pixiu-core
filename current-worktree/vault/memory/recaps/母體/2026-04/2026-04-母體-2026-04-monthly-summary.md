---
type: monthly-summary
date: 2026-04
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: 2026-04-monthly-summary
status: done
tags: [monthly, recap, pixiucore]
summary: 總結 2026 年 4 月的 PixiuCore、PCLMS、DOCX、OpenSpec 與 Auto Research 工作脈絡。
---

# 2026-04 月度整理

## 本月主軸

4 月主要是把 PixiuCore 從零散記憶整理成可持續維護的 Obsidian vault，同時沉澱 PCLMS、DOCX、OpenSpec、Pixiu Auto Research、Spec Improve 等工作流。整體方向是：先把地基整平，再把工具和規則往可重複使用的型態收斂。

## 已完成整理

- 建立 PixiuCore vault 架構與 Dashboard，並訂定 `recaps/`、`decisions/` 月份封存慣例。
- 建立 PCLMS 專案概覽與技術棧脈絡，讓後續調查不用每次重建背景。
- 完成 PCLMS 多個資料流程盤點：彙報單、已申報彙報單、L1/L4/N1C 訊息傳送規則。
- 完成 DOCX 文件產生工具鏈沉澱，確認 Word COM + PDF 文字/頁數檢查比 artifact-tool/Chrome 截圖可靠。
- 完成 Pixiu Auto Research MVP 路徑：無 API 階段採 Manual Codex Scoring Mode。
- 新增並同步 `spec-improve` 技能，讓既有規格審查與翻修流程獨立於新規格建立流程。
- 釐清 PEPIS/CCPS eDDA 3.4 查詢修改的 UI 回饋與修正策略。

## 重要技術判斷

- PCLMS 資料修補仍以最小侵入為原則，不改 schema，先查資料痕跡與流程缺口。
- Obsidian 記憶採「獨立 recap + decision + memory-summary」三層：詳情可追、摘要可讀、決策可檢索。
- Skills 同步需同時考慮 `skills`、`.agent`、`.agents`，Codex 用的 `.agent/.agents/skills` 需補 YAML。
- Agent Team 啟用應先判斷成本與風險，不預設無條件平行化。

## 5 月接續

- 5 月起根層只保留本月新增 recap/decision，4 月資料封存於 `2026-04/`。
- PCLMS `CW  1401371477` 案件需保留為資料流程調查範例，後續若要修程式，重點是補 `listCatMonthSave` 明細檢核與孤兒 `month` 防護。
- eDDA 3.4 查詢修改仍需依測試回饋調整 UI 與欄位鎖定。