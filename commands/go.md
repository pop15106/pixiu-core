---
name: go
description: 啟動 Pixiu 端對端自我驗證迴圈（E2E Test → /simplify/equivalent → PR 草稿）。一般模式紅燈等待修復授權；FULL_AUTOMATIC_HANDOFF 把 RED 視為可恢復訊號並持續修復重驗。
origin: Pixiu
version: 0.2.0
---

# /go — Pixiu 驗證迴圈啟動指令

> 本指令即 `pixiu-verify-loop` skill 的入口 slash command。
> 對應 Boris Cherny 公開分享的 `/go` 驗證主張，Pixiu 版加三道硬閘門。

## 行為合約

收到 `/go`（可帶參數）時，**立即**：

1. 讀取 `%PIXIU_CORE%\skills\pixiu-verify-loop\SKILL.md` 取得完整三步驟。
2. 依當前任務棧自動選驗證路徑（Java / Node / Python / React / CLI / DB / GUI）。
3. 按順序跑：
   - **步驟 1｜E2E Verification**：啟動服務 → 跑 criteria → 產紅綠燈報告。
   - **步驟 2｜/simplify**（前一步全綠才跑）：呼叫 Claude Code built-in `/simplify`。
   - **步驟 3｜產 PR 草稿**（不推送）：輸出 `git push` / `gh pr create` 指令供使用者手動執行。
4. 全程輸出繁體中文。

## 模式分流與硬閘門

### 一般模式

- 步驟 1 紅燈 → 出紅燈報告並停在修復授權。
- 步驟 2 改動 > 30% → 退回手動審核。
- 步驟 3 遇到非 git repo → 只輸出摘要，不建分支。
- 任何階段觸發未授權母體寫入 → 呼叫「絕對用戶審批閘門」。

### `FULL_AUTOMATIC_HANDOFF`

- RED / FAILED / `CHANGES_REQUIRED` / Flaky → 保存證據 → diagnose → Task Contract owned scope 內最小修復 → focused/downstream 重驗。
- `ACTION_COMPLETED` / `GATE_COMPLETED` / `PHASE_COMPLETED` / `REVIEW_APPROVED` → 直接接下一個已授權動作。
- Session/Watch 中斷 → checkpoint + handoff；下一棒原位 resume。
- Lease 到期 → freeze candidate → reconciliation → fresh lease/fencing → resume。
- 只有 `DONE`、`HARD_BLOCKED`、`USER_PAUSED`、`USER_CANCELLED` 可以停止。
- `/simplify` 若需要 Agent 但 Task Contract 禁止 Agent，改走無 Agent equivalent gate，不得因此中止接力。
- Production/release/new secrets/destructive external action/未授權母體或 scope 仍是人工 hard gate。

## 參數

`$ARGUMENTS` 可為：

- `quick` — 只跑步驟 1（E2E 驗證），不跑 /simplify、不產 PR。
- `full` — 完整三步驟（預設）。
- `pr-only` — 跳過驗證直接產 PR 草稿（僅適用於已手動驗證過的情況）。
- `dry-run` — 只列出會跑的 criteria 與指令，不實際執行。

## Criteria 宣告

一般模式若任務未明確宣告 acceptance criteria，先詢問使用者；取得後再動手。`FULL_AUTOMATIC_HANDOFF` 必須先從 Task Contract / handoff 取得可驗證 criteria；若確實不存在，標記 `TASK_CONTRACT_STALE` 或 scope blocker，不得自己捏造 criteria。

## 審計

每次完整跑完寫入 `%PIXIU_CORE%\vault\memory\verify-loop.log`，格式：

```
[時間]｜taskId｜技術棧｜步驟1結果｜步驟2改動行數｜PR狀態｜總耗時
```

## 與 Recap 銜接

步驟 3 結束後自動觸發 `pixiu-session-recap` 模式 B（Phase Recap），把驗證結果併入當前階段摘要並寫入 `vault/memory/recaps/<專案或母體>/<YYYY-MM>/YYYY-MM-DD-專案-內容.md`。

## 版本

- v0.2.0｜2026-08-26｜新增 `FULL_AUTOMATIC_HANDOFF` self-healing / continue / checkpoint-resume 分流，停止狀態固定為四種。
- v0.1.0｜2026-04-17｜初版。同步 `pixiu-verify-loop` SKILL.md。
