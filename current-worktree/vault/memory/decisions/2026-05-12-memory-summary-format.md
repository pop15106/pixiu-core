---
type: decision
date: 2026-05-12
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: memory-summary-format
status: accepted
decision: Memory Summary 格式規則
choice: 當月展開表格，過去月份用 Dashboard 同款 callout 摺疊
alternative: 長表格塞完整內容、只留少數條目、純條列無表格
reason: memory-summary 是索引型摘要，必須能看到近期每個動作，但細節應回到 recap / decision 檔
summary: Memory Summary 格式規則：當月展開表格，過去月份用 Dashboard 同款 callout 摺疊
tags: [decision, memory-summary, obsidian, dashboard]
---

# Memory Summary 格式規則

## 決策

`memory-summary.md` 之後採用「當月展開表格 + 過去月份摺疊」的摘要格式。

## 規則

- 保留每個近期動作 / 決策 / 踩坑，不可因濃縮而刪掉條目。
- 每個表格欄位只放短句，避免在 summary 裡塞完整 recap。
- 詳細內容用 recap / decision 連結回查。
- 過去月份使用 `🏠 Dashboard.md` 同款 Obsidian callout 摺疊。
- 優先保持表格可讀性；必要時可用 Dataview TABLE 產生表格。

## 後續套用

下次更新 `memory-summary.md` 時，先看 `🏠 Dashboard.md` 的 Dataview / callout 寫法，並沿用同一種視覺結構。