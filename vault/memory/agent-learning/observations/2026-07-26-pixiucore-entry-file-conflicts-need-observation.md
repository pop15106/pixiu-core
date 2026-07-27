---
type: agent-observation
date: 2026-07-26
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: entry-file-conflicts-need-observation
status: candidate
scope: project
source_session: retrospective-from-vault
summary: Governance explicitly requires entry-file conflicts to be captured as observations instead of being silently normalized.
tags: [agent-learning, observation, governance, entry-files]
source_paths:
  - vault/governance/entry-files-alignment.md
  - vault/governance/INDEX.md
  - vault/context/ai-mothership-loading-policy.md
related_notes:
  - vault/context/agent-metacognition-memory-system-plan.md
confidence: 0.47
verified: false
---

# Observation - Entry File Conflicts Need Observation

## Context

PixiuCore 同時存在多個入口檔與治理檔。2026-07 的 alignment 文件不只定義優先序，也明講衝突發生時不能默默擇一吞掉。

## Action

治理層要求先依高位階規則執行，再把衝突本身記成 observation，保留來源與後續追蹤空間。

## Result

入口衝突從「臨場自行解讀」改成「可回查的候選經驗」，未來可以再評估是否升級成更穩定的 decision 或 SOP。

## Why It Happened

- 可驗證事實：`vault/governance/entry-files-alignment.md` 明確寫出衝突時的處理順序，並指定要寫入 `vault/memory/agent-learning/observations/`；`vault/governance/INDEX.md` 與 `vault/context/ai-mothership-loading-policy.md` 都把 governance routing 放在高優先層。
- 推論：如果不把衝突留下來，後續 session 容易重複遇到同一個判斷分歧，卻無法累積成可驗證經驗。

## Recommendation

只要發現 README、AGENTS、CODEX 或其他入口檔互相牴觸，先依治理優先序行動，再新增候選 observation，避免在當下把一次判斷誤升格成永久規則。Promotion destination: keep as candidate until at least one more independently sourced conflict is captured.

## Evidence

- `vault/governance/entry-files-alignment.md`：直接指定衝突要寫 observation。
- `vault/governance/INDEX.md`：把 entry-file alignment 列為治理路由核心。
- `vault/context/ai-mothership-loading-policy.md`：要求 L1-L6 以 routing summary 方式延遲載入，支持先記錄再升級的做法。

## Verification

- verifier: manual checklist pending
- result: needs-review
- notes: 還需要更多跨入口、可回查的實例，才能決定是否升級成 instinct 或 decision。
