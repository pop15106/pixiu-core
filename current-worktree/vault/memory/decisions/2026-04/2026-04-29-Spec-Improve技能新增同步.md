---
type: decision
date: 2026-04-29
project: DOCX_TOOLING
system: PIXIUCORE
repo: Playground
topic: Spec-Improve技能新增同步
status: accepted
decision: Spec Improve 技能新增與同步
choice: 新增獨立技能 `spec-improve`，不修改原 `spec` 技能，且不納入 `make-docx`。
alternative: 
reason: `spec` 原本負責從需求到驗收結案的一條龍流程，直接塞入既有 spec 翻修邏輯會讓入口變混亂。 `make-docx` 是文件輸出工具，不是規格品質審查工具，納入會讓責任邊界變髒。 獨立技能能強制遵守「先評分、再補強、最後詢問 user」的順序，避免 AI 直接改規格。
summary: Spec Improve 技能新增與同步：新增獨立技能 `spec-improve`，不修改原 `spec` 技能，且不納入 `make-docx`。
tags: [decision, skill, spec]
---

# 決策：Spec Improve 技能新增與同步

## 背景

使用者希望基於既有 `spec` 技能延伸出一個新技能，用來優化現有規格。需求明確要求先做評分，指出優缺點，提出建議補足部分，再詢問 user 細節。

## 決策

新增獨立技能 `spec-improve`，不修改原 `spec` 技能，且不納入 `make-docx`。

## 原因

- `spec` 原本負責從需求到驗收結案的一條龍流程，直接塞入既有 spec 翻修邏輯會讓入口變混亂。
- `make-docx` 是文件輸出工具，不是規格品質審查工具，納入會讓責任邊界變髒。
- 獨立技能能強制遵守「先評分、再補強、最後詢問 user」的順序，避免 AI 直接改規格。

## 棄選方案

| 方案 | 棄選原因 |
|------|----------|
| 修改原 `spec` 技能 | 會污染原本建立新 spec 的流程，降低可維護性。 |
| 建立 `spec-review` 但只審不改 | 名稱與目標偏窄，使用者要的是優化流程，不只是 review。 |
| 納入 `make-docx` | make-docx 只是文件輸出，不是 spec 品質門檻。 |

## 影響範圍

- `%PIXIU_CORE%\skills\spec-improve`
- `%PIXIU_CORE%\.agent\skills\spec-improve`
- `%PIXIU_CORE%\.agents\skills\spec-improve`
- `<workspace-root>\pixiu-core\skills\spec-improve`
- `<workspace-root>\pixiu-core\.agent\skills\spec-improve`
- `<workspace-root>\pixiu-core\.agents\skills\spec-improve`

## 驗證

- 六份 `SKILL.md` SHA256 一致。
- `.agents` 兩邊都有 `agents/openai.yaml`。
- 未發現 TODO 殘留。
