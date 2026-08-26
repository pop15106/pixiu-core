---
name: full-automatic-handoff
description: Pixiu 完整自動接力模式。當使用者要求「完整自動接力 / 繼續完整自動接力 / 恢復完整自動接力 / FULL_AUTOMATIC_HANDOFF」時載入，依 Task Contract、handoff、machine state 與 durable workflow 持續執行；recoverable RED 自動修復重驗，只有真正 hard blocker 或使用者 pause/cancel 才停。
origin: Pixiu
version: 1.0.0
layer_binding: L0-授權 / L3-流程 / L6-驗證
language: zh-TW
---

# 完整自動接力模式（FULL_AUTOMATIC_HANDOFF）

## 核心目標

完整自動接力不是 Claude Code Auto mode，也不是「自動做一小段」。它是 Task Contract 與 handoff 驅動的持續工程閉環：

```text
動作完成 → 下一個已授權動作
RED / FAILED → 診斷 → 最小修復 → 重驗 → 繼續
Session / Watch / Lease 中斷 → checkpoint → reconciliation → resume
```

只要仍有安全、已授權且可證明的下一個動作，就不得因階段完成、測試失敗、review finding、工具錯誤或單輪執行結束而停止。

## 啟用語句

以下語義代表啟用或恢復本模式：

- `啟用完整自動接力`
- `繼續完整自動接力`
- `恢復完整自動接力`
- `完整自動接力模式`
- `完整自動模式`（既有縮寫，仍代表完整自動接力，不是 Claude Auto mode）
- `FULL_AUTOMATIC_HANDOFF`

啟用指令依 `user_rules.md` 的完整自動接力預授權例外，視為對**有效 Task Contract 範圍內**可逆、task-owned、已授權、非 production、非破壞性工程動作的持續明確核可。

## 新 Session 啟動順序

每次新 Session 或接力恢復時，固定依序：

1. 讀專案根層指令（AGENTS / CLAUDE / 專案規範）。
2. 尋找並讀目前 handoff / current-progress / machine state。
3. 若專案存在 `docs/handoffs/automatic-handoff-loop-contract.md`，讀取並套用；專案契約可增加更嚴格限制，但不得弱化本 Skill 的 hard blocker 與 evidence 安全底線。
4. 讀 active durable workflow / task / session（平台有提供時）。
5. 重建或驗證 Task Contract：goal、non-goals、acceptance criteria、owned files、allowed repositories、authorized refs、risk、required gates、forbidden actions、rollback plan。
6. 讀 Git remote authority，先 reconciliation，再取得 Writer Lease / fencing（專案有此控制面時）。
7. 從 Step Journal / handoff 的 `next_safe_action` 原位續跑，不重新從頭做已具有效 evidence 的步驟。

如果 handoff 與 machine/workflow/remote authority 衝突，先 reconciliation；不得用猜測選一份覆蓋另一份。

## 唯一停止結果

完整自動接力只允許四種停止結果：

```text
DONE
HARD_BLOCKED
USER_PAUSED
USER_CANCELLED
```

### 必須繼續的完成訊號

```text
ACTION_COMPLETED
GATE_COMPLETED
PHASE_COMPLETED
REVIEW_APPROVED
```

固定處理：`CONTINUE_NEXT_ACTION`。

### 必須自我修復的訊號

```text
RED
FAILED
VERIFICATION_FAILED
RECOVERY_PENDING
CHANGES_REQUIRED
FLAKY_SUSPECTED
FLAKY_CONFIRMED
ENVIRONMENT_ERROR
TOOL_ERROR
```

固定處理：

```text
保存 failure/evidence
→ diagnose root cause
→ Task Contract owned scope 內最小 remediation
→ focused proof
→ 使受影響 downstream evidence STALE
→ 重跑 required downstream gates
→ GREEN 後接下一步
```

重複失敗次數本身不得升格成 hard blocker。

## Session / Watch / Lease 中斷

`SESSION_INTERRUPTED`、輸出邊界、單輪 Watch 結束都不是完成：

```text
checkpoint
→ Step Journal / handoff / machine state 保存 next_safe_action
→ 下一 Session 原位 resume
```

`LEASE_EXPIRED`：

```text
freeze candidate
→ 停止新 mutation/commit/push
→ reconciliation
→ fresh lease/fencing
→ resume
```

Lease 到期只會暫停 writer authority，不等於工作被 block。

## 跨 Session Watch

若平台支援排程／輪詢，且 Task Contract / 專案契約要求跨 Session 持續執行：

- `Execution Watch` 負責 reconciliation、remediation、verification、Git/promotion 與下一步執行。
- `Status Pulse` 只做唯讀狀態觀測，不取得 writer authority。
- Task 仍為 `RUNNING / EXECUTOR_WORK / VERIFICATION_FAILED / RECOVERY_PENDING / CHANGES_REQUIRED` 且沒有 hard blocker、pause/cancel 時，Execution Watch 意外停用或遺失屬 **execution transport recovery**，不是任務完成；必須保存 checkpoint，並依既有排程授權恢復／重建執行 Watch。
- Task 已 `DONE`，或已確認 `HARD_BLOCKED / USER_PAUSED / USER_CANCELLED` 時，Execution Watch 可停止；Status Pulse 是否保留依專案監控需求決定。
- Watch 單輪時間到但仍有安全下一步時，寫 `RECOVERY_PENDING + next_safe_action`，下一輪續跑，不把單輪結束當 terminal state。

## Hard Blocker 判定

只有「不存在安全、已授權且可證明的下一個動作」時，才可標 `HARD_BLOCKED`。

典型 hard gate：

- Production DB access / mutation。
- Production deploy / cutover。
- Protected release authorization。
- Stage 10 / second provider 等明確下一階段授權。
- 新 credentials / secrets。
- 未授權外部 network / third-party action。
- Destructive external red-team。
- force push / destructive reset / 覆蓋使用者工作。
- 無法在不偽造 evidence 或破壞 authority 的前提下恢復的 machine/workflow/remote conflict。
- 必要 runtime / permission / resource 缺失，且沒有已授權替代方案。
- 所有安全 remediation path 已有證據證明耗盡。

一般 test/build/review RED、Flaky、環境或工具錯誤、dirty 主 checkout、Agent 不可用，都不是直接 hard blocker；先找安全替代路徑。

## 驗證與 Review

完整自動接力載入 `pixiu-verify-loop` 時，使用其 `FULL_AUTOMATIC_HANDOFF` 分流：

- RED 不停止，先自我修復。
- `CHANGES_REQUIRED` 回 Executor，不停止。
- `/simplify` 需要 Agent 但 Task Contract 禁止 Agent 時，走當前 Session 的等價 diff review / verification gate。
- Reviewer 只能 review 已符合專案 promotion/evidence 規則的 exact subject。
- `APPROVED` 只代表該 review gate 通過，不自動擴張 production / release / next-stage 權限。

## Agent / Model 邊界

- Task Contract 未授權 Agent/subagent/model reviewer：不得啟用，也不得因不能啟用而停止；使用當前 Session 的安全等價路徑。
- Task Contract 已明確禁止 Agent：整段接力持續遵守，不在每個 Phase 重新詢問。
- 若下一步真的必須新增 Agent/model 權限才能完成，視為 scope/authorization gate，再詢問使用者。

## 插入式問句與 Scope Change

使用者在接力途中詢問「現在如何／為什麼／這樣會不會影響」等原 scope 問題：

1. 回答問題。
2. 不把問句當 `PAUSE`。
3. 接著從既有 `next_safe_action` 繼續。

只有使用者改變 goal、owned files、branch、risk、forbidden actions 或要求新增高風險能力時，才轉 `SCOPE_CHANGE`，使舊 Task Contract STALE 後重新建立。

## Git 與工作區

- 只操作 Task Contract owned files / authorized refs。
- 不用 `git add .` / `git add -A`。
- 不 reset / discard / overwrite 使用者既有工作。
- Push 只允許已授權、fast-forward、安全路徑；force push 永遠不是自動修復手段。
- 專案有 managed detached candidate / writer lease 規則時必須遵守。
- 未獲 Git push 授權時，完成本機修改與驗證後保留可接力 checkpoint，不自行擴權 push。

## 完成回報

每輪可見回報至少包含：

```text
現在：state / gate / subject / role
本輪：實際完成事項
結果：GREEN / RED / PENDING / RECOVERY_PENDING
Block：無 / 有 + 是否需要使用者介入
下一步：具體 next_safe_action
```

Recoverable RED 可以回報，但不得用回報取代後續修復。

## 版本

- v1.0.0｜2026-08-26
  - 建立 PixiuCore 正式 Capability 入口。
  - 固定四種停止結果與 self-healing / checkpoint-resume 行為。
  - 明確拆分 `FULL_AUTOMATIC_HANDOFF`、Claude Auto mode、Focus mode。
