---
type: agent-observation
date: 2026-07-26
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: hook-config-needs-readback
status: candidate
scope: project
source_session: retrospective-from-vault
summary: Repo hook files alone were not enough to explain live Claude hook behavior during the 2026-07 governance repair cycle.
tags: [agent-learning, observation, hooks, governance]
source_paths:
  - vault/governance/entry-files-alignment.md
  - vault/memory/memory-summary.md
related_notes:
  - vault/context/agent-metacognition-memory-system-plan.md
confidence: 0.55
verified: false
---

# Observation - Hook Config Needs Readback

## Context

2026-07-05 的治理覆核與 hook 修復回顧顯示，只看 repo 內的 hook 定義，無法單獨證明 Claude 端實際生效的設定。

## Action

治理文件補上雙邊對照：保留 repo 內 hook 檔作為本體，同時要求對實際生效的使用者層設定做 read-back 檢查。

## Result

問題被重新定義成「repo 模板 + 實際生效設定」的雙來源檢查，而不是只讀 repo 後直接下結論。

## Why It Happened

- 可驗證事實：`vault/memory/memory-summary.md` 把 2026-07-05 的斷點記成 `settings.json` 副本漂移，且 `vault/governance/entry-files-alignment.md` 明寫 Claude hooks 需要做雙邊對照。
- 推論：當 hook 行為依賴 repo 外的生效設定時，只審 repo 會漏掉實際 runtime 狀態。

## Recommendation

遇到 hook、guardrail 或 auto-mode 行為異常時，先把「repo 本體」與「實際生效設定」分開核對，再決定要不要寫成更高層級規則。Promotion destination: keep as candidate until another independently verified case appears.

## Evidence

- `vault/memory/memory-summary.md`：2026-07-05 條目明確記錄 hook 修復與 `settings.json` 副本漂移。
- `vault/governance/entry-files-alignment.md`：第 5 節把 hook 副本對照列為明確檢查步驟。
- `vault/context/agent-metacognition-memory-system-plan.md`：Phase 1 要求 observation 先保持低信心、未驗證狀態。

## Verification

- verifier: manual checklist pending
- result: needs-review
- notes: 還需要下一筆可獨立驗證案例，才能判斷這是否該升格為 instinct。
