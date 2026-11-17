---
type: governance
date: 2026-11-17
project: PIXIUCORE
system: PIXIUCORE
topic: legacy-opus-4-7-runtime-params
status: archived
tags: [pixiucore, governance, claude-api, archived]
summary: 2026-07 針對 Claude Opus 4.7 驗證的 API 參數規則，自 user_rules.md 移出存檔；新版模型一律以官方文件為準。
---

# 舊版：Opus 4.7 運行參數政策（存檔）

> 2026-11-17 自 `user_rules.md` 移出。這些數值只在 Opus 4.7 驗證過；目前模型已換代，呼叫 API 前請先查官方文件。本檔只供對照，不是硬閘門。

- **🧮 Opus 4.7 運行參數政策 (Runtime Parameter Policy) [NEW][HARD]**：使用 Claude Opus 4.7 時，**必須**遵守以下原生參數規則，違反會直接 400 錯誤或造成預期外行為。
  **版本適用註記（2026-07-03）**：本節僅針對 Opus 4.7 驗證；對 Opus 4.8、Sonnet 5、Fable 5 的適用性【未確認】——使用新版模型時，先查官方文件確認 tokenizer 與參數行為，再決定是否沿用本節數值，不得直接照搬：
  - **Tokenizer 膨脹補償**：Opus 4.7 新 tokenizer 在相同文字上多用 1×–1.35× token（最多 +35%）。所有 `max_tokens` 估算**必須加 35% headroom**；`task_budget` 下限 20k，成本估算同比例上修；compaction 觸發點一併同步。
  - **Adaptive Thinking 顯式開啟**：預設 off。Pixiu「深度思考觸發條件」存在時，**必須顯式**設 `thinking: {"type": "adaptive"}`，並在需要觀察推理時加 `display: "summarized"`。
  - **Effort Level 預設**：Code Review / Debug 根因 / 架構審閱 用 `xhigh`；一般撰寫用 `high`；文件摘要用 `medium`；簡問簡答用 `low`；跨領域多方案辯證臨時切 `max`（僅當前 session 生效）。
  - **禁用參數清單**：`temperature`、`top_p`、`top_k`、`thinking.budget_tokens` 一律不得設定非預設值，否則 Opus 4.7 會回 400。以 prompting 取代 sampling 調校。
  - **行為原生對齊**：Opus 4.7 已內建「更直接、少 emoji、少 sub-agent、更頻繁回進度」傾向，舊 prompt 中重複要求這些的 scaffolding 可移除。
