---
type: implementation-plan
date: 2026-05-15
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: decision-normalization-status
status: done
summary: 記錄 decision 區 canonical frontmatter 一致化的完成狀態與後續建議。
tags: [pixiucore, vault, decisions, normalization]
---

# Decision 欄位一致化狀態

## 本輪完成

- `vault/memory/decisions/` 29 份 Markdown decision 已統一為 canonical frontmatter。
- 所有 decision 現在都具備：
  - `type`
  - `date`
  - `project`
  - `system`
  - `repo`
  - `topic`
  - `status`
  - `decision`
  - `summary`
- 多數 decision 也補回了：
  - `choice`
  - `alternative`
  - `reason`

## 一致化原則

- decision 正文不重寫，只整理 frontmatter。
- 舊式中文 frontmatter 主鍵不再作為主要格式，改統一到英文化 canonical 欄位。
- `project / system / repo` 盡量與 recap 區的專案代碼保持一致。
- 若原 decision 缺少日期，允許以檔名日期回填。

## 後續建議

1. Obsidian 若有針對 decision properties 的舊視圖，可逐步改讀 canonical 欄位。
2. second-brain 在本輪後應重產 manifest 並重建索引，讓新的 decision metadata 被納入向量檢索。
3. 若未來要做 Dashboard 決策區優化，可優先利用 `project / summary / status` 這組欄位。
