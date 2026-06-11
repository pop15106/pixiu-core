---
type: decision
date: 2026-04-29
project: AUTO_RESEARCH
system: PIXIUCORE
repo: Playground
topic: Pixiu-Auto-Research-SAST-triage規則
status: accepted
decision: Pixiu Auto Research SAST triage 規則
alternative: 直接刪除資訊級 finding：可能漏掉集中型風險。 直接 AI 判斷真偽陽性：目前無 API 且缺 golden set，不可重現。 所有中風險一律 P2：CSRF、Dynamic SQL 等安全敏感 query 需要更高優先複核。
summary: Pixiu Auto Research SAST triage 規則
tags: [decision, pixiucore, auto-research, sast, triage]
---

# 決策：Pixiu Auto Research SAST triage 規則

## 決策內容

在 Pixiu Auto Research MVP 中加入保守規則型 SAST triage。第一版不使用 API、不依賴 AI 自動判斷誤報，而是根據嚴重性、查詢名稱、原始碼檔名與目的物件產生優先級與 dedupe 群組。

## 選擇原因

目前沒有 golden set 與 API，因此不能讓 AI 直接判定誤報。保守 triage 能先把 P0/P1 風險拉出來，並把資訊級 finding 降權成群組摘要，達成「降低噪音但不刪線索」。

## 棄選方案

- 直接刪除資訊級 finding：可能漏掉集中型風險。
- 直接 AI 判斷真偽陽性：目前無 API 且缺 golden set，不可重現。
- 所有中風險一律 P2：CSRF、Dynamic SQL 等安全敏感 query 需要更高優先複核。

## 後續要求

下一步用 Codex 手動評分 triage candidate，若可接受，再補 deterministic evaluator 檢查 triage 輸出是否穩定。