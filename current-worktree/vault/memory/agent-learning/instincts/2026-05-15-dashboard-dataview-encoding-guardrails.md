---

type: agent-instinct

date: 2026-05-15

project: PIXIUCORE

system: PIXIUCORE

repo: pixiu-core

topic: dashboard-dataview-encoding-guardrails

status: active

summary: 涉及 Obsidian Dashboard、Dataview 與中文 frontmatter 時，先走 UTF-8 明確寫回與 Dataview 保守相容策略，再逐步調整顯示。

tags: [agent-learning, instinct, dataview, dashboard, encoding, obsidian]

confidence: high

supporting_observations:

  - 2026-05-15-dashboard-dataview-encoding-guardrails

contradicting_observations: []

---



# Instinct - Dashboard / Dataview / 編碼防呆



## Trigger



當任務同時碰到：



- Obsidian Dashboard

- Dataview 查詢

- 中文 frontmatter 或中文 markdown

- 批次改寫多份 vault 檔案



## First Move



1. 先用 UTF-8 明確寫回，不用不透明的 PowerShell 管線直接批次覆蓋。

2. Dataview 先用最保守語法，例如直接欄位、`TABLE WITHOUT ID`，不要先假設新版函式可用。

3. 每次只改一小段 Dashboard，立即回 Obsidian 驗證顯示。



## Rationale



這類問題最容易疊出複合錯誤：編碼污染、Dataview 相容性、欄位重複與 callout 語法失效會互相干擾。先收斂技術風險，再談版面美化，整體更快。



## Boundaries



- 若只是單篇純英文筆記的小改動，不一定需要這麼嚴格。

- 若 Dataview 版本已知且有官方相容基線，可再放寬函式使用。



## Evidence Base



- `2026-05-15-dashboard-dataview-encoding-guardrails` after-action

- `2026-04-27-docx-powershell-encoding` after-action



## Promotion Rule



若後續又在 Obsidian / Dataview / 中文編碼整理任務重複驗證到同樣模式，可升格成 decision 或 SOP。

