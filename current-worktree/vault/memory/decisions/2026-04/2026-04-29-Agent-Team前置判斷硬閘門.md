---
type: decision
date: 2026-04-29
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: Agent-Team前置判斷硬閘門
status: accepted
decision: Agent Team 前置判斷硬閘門
alternative: 無條件預設開啟 agent team：成本與延遲較高，小任務不划算。 放在 AI 行為約束區：強度較低，可能偶爾漏問。
summary: Agent Team 前置判斷硬閘門
tags: [decision, pixiucore, agent-team]
---

# 決策：Agent Team 前置判斷硬閘門

## 決策內容

在 %PIXIU_CORE%\user_rules.md 的硬閘門區新增 Agent Team 前置判斷規則：每次需求在提出方案或執行前，必須先判斷是否建議啟用 agent team，說明原因，並等待使用者決定；不得自動啟用。

## 選擇原因

使用者希望保留 agent team 的彈性，但不想讓它無條件預設開啟，以免浪費 token 或增加協作衝突。放入硬閘門可避免模型在任務繁忙時漏問。

## 棄選方案

- 無條件預設開啟 agent team：成本與延遲較高，小任務不划算。
- 放在 AI 行為約束區：強度較低，可能偶爾漏問。

## 後續要求

後續每個需求都要先做 agent team 判斷，並由使用者決定是否啟用。