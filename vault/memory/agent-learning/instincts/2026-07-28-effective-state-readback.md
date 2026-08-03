---
type: agent-instinct
date: 2026-07-28
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: effective-state-readback
status: active
summary: "入口、Hook 或執行狀態異常時，先回讀實際生效狀態與治理來源。"
tags: [agent-learning, instinct]
confidence: 0.63
supporting_observations:
  - vault/memory/agent-learning/observations/2026-07-26-pixiucore-entry-file-conflicts-need-observation.md
  - vault/memory/agent-learning/observations/2026-07-26-pixiucore-hook-config-needs-readback.md
  - vault/memory/agent-learning/observations/2026-07-26-pixiucore-hook-state-is-not-learning-evidence.md
contradicting_observations: []
---

# Instinct - Effective State Readback

## Trigger

入口檔、Hook、runtime state 或 repo 宣告彼此不一致。

## First Move

比較實際生效設定、live binding、repo 宣告與高位階治理文件。

## Rationale

宣告檔、使用者層副本與執行中狀態可能獨立漂移，hook-state 也不等同可重用證據。

## Boundaries

只做讀取與判斷；修改使用者設定、Hook、服務或治理規則仍需明確核准。

## Evidence Base

- vault/memory/agent-learning/observations/2026-07-26-pixiucore-entry-file-conflicts-need-observation.md
- vault/memory/agent-learning/observations/2026-07-26-pixiucore-hook-config-needs-readback.md
- vault/memory/agent-learning/observations/2026-07-26-pixiucore-hook-state-is-not-learning-evidence.md

## Promotion Rule

建立 promote candidate 供人工審核；不得自動修改 user_rules、SOP、Skill 或其他治理檔。建議下一層：sop。
