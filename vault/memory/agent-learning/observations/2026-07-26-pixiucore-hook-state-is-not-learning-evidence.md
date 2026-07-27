---
type: agent-observation
date: 2026-07-26
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: hook-state-is-not-learning-evidence
status: candidate
scope: project
source_session: retrospective-from-vault
summary: July 2026 governance notes consistently treat hook-state as machine state to exclude from search, indexing, and agent-learning evidence.
tags: [agent-learning, observation, hook-state, governance]
source_paths:
  - vault/governance/INDEX.md
  - vault/governance/maintenance-protocol.md
  - vault/governance/quick-diagnosis-2026-07-03.md
  - vault/memory/memory-summary.md
related_notes:
  - vault/context/agent-metacognition-memory-system-plan.md
confidence: 0.58
verified: false
---

# Observation - Hook State Is Not Learning Evidence

## Context

2026-07-03 到 2026-07-08 的治理與記憶摘要反覆提到 `hook-state` 曾帶來大量 transcript 與索引噪音，並被制度明確排除。

## Action

治理層把 `vault/memory/hook-state/` 定位為機器狀態，要求搜尋、glob、索引與同步都排除；相關摘要也把它排除在審查來源之外。

## Result

`hook-state` 被從「可直接引用的證據」降級成「需要隔離的原料」，後續 agent-learning 應只引用整理過的 repo 或 vault 證據。

## Why It Happened

- 可驗證事實：`vault/governance/quick-diagnosis-2026-07-03.md` 記錄了 827MB transcripts 與 `.tmp` 噪音；`vault/governance/INDEX.md` 與 `vault/governance/maintenance-protocol.md` 都要求排除 `hook-state`；`vault/memory/memory-summary.md` 也把它記成不納入審查。
- 推論：若 observation 直接依賴 `hook-state`，容易把未整理的機器輸出誤當成可重用知識。

## Recommendation

建立 observation 時，證據優先使用 repo 程式碼、治理文件、after-action、decision 或 recap 成品，不要引用或寫入 `hook-state`。Promotion destination: keep as candidate; promote only if repeated observations show the same boundary is still valuable after the migration.

## Evidence

- `vault/governance/quick-diagnosis-2026-07-03.md`：描述 `hook-state` 的體積、內容與風險。
- `vault/governance/maintenance-protocol.md`：明定所有 vault 搜尋與索引都要排除 `memory/hook-state/`。
- `vault/governance/INDEX.md` 與 `vault/memory/memory-summary.md`：把這個排除規則提升到 session routing 與摘要層。

## Verification

- verifier: manual checklist pending
- result: needs-review
- notes: 需再確認這個候選 observation 是否應被視為專案內規則，或只是治理層的一次性修復結論。
