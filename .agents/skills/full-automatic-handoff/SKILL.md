---
name: full-automatic-handoff
description: Pixiu 完整自動接力模式。當使用者要求「完整自動接力 / 繼續完整自動接力 / 恢復完整自動接力 / FULL_AUTOMATIC_HANDOFF」時載入，依 Task Contract、handoff、machine state 與 durable workflow 持續執行；recoverable RED 自動修復重驗，只有真正 hard blocker 或使用者 pause/cancel 才停。
origin: Pixiu
version: 1.4.0
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

## Project Context Resolution／Project Scope Isolation

完整自動接力與進度查詢都必須先解析唯一專案身分。`projectRefs` 只代表 task visibility；真正的執行綁定由 `executionProjectRef` 決定。

### 已在專案 workspace 內

目前 `open_workspace` 的 canonical project root 是本 Session 的預設 execution binding。

使用者只說以下語句時：

```text
目前進度
現在到哪了
繼續完整自動接力
恢復完整自動接力
```

固定行為：

```text
current canonical workspace project
→ workflow_list(projectAccessMode="execution_only")
→ 只接受 executionProjectRef=currentProjectRef
→ 只接受 implicitSelectionAllowed=true 的 execution task
```

不得因其他專案的 task 更新較新、仍 active、有 pending handoff、屬 cross-project scope、最近被 Status Pulse／Recovery Supervisor 更新，或全域 recap 較新，就切換專案。

使用者在 Project B workspace 內詢問「看 Project A 的進度」時，可唯讀解析並查看 A，但這不會改變 B 的 execution binding。下一句未指定專案的「繼續完整自動接力」仍接 Project B。

只有以下任一明確成立時才可改綁：

- 使用者明確說「切換到 Project A」並開啟 A 的 canonical workspace。
- owner 建立含目標專案的 cross-project handoff，目標專案以 `related_explicit` acknowledge 後更新 `executionProjectRef`。

### 不在專案 workspace 內

使用者必須在本次訊息明確提供專案名稱、alias 或絕對路徑，例如「NeedToKnow 進度」。固定流程：

```text
project_resolve
→ 唯一 canonical root / projectRef
→ open_workspace
→ 讀該專案 handoff / current-progress / machine state / workflow
```

沒有明確專案時回 `PROJECT_CONTEXT_REQUIRED`；多個候選同分時回 `PROJECT_CONTEXT_AMBIGUOUS`。不得用最近 task、最近 recap、最近 Git commit 或最近監控事件猜測。

### Durable workflow 專案欄位

```text
primaryProjectRef   = 建立 task 的主要專案
executionProjectRef = 目前真正允許續跑／writer authority 的專案
projectRefs         = 可見範圍，不等於執行範圍
taskRole            = execution | reviewer_watch | status_pulse | recovery_supervisor | governance
```

`reviewer_watch`、`status_pulse`、`recovery_supervisor`、`governance` 必須 `implicitSelectionAllowed=false`，不得被一般進度或接力語句選中。

跨專案 task 只有在本次訊息明確指定該 task／project 時，才可使用：

```text
projectAccessMode="related_explicit"
```

一般「進度」與「繼續完整自動接力」不得自動使用此模式。

### Mutation 前硬閘門

Mutation、Agent run/sync、takeover、commit、push、promotion 前必須重新確認：

```text
resolved canonical root = current workspace root
current projectRef = workflow executionProjectRef
Task Contract allowedRepositories 包含目前專案
handoff / machine state 屬於目前專案
Git authorized ref 屬於目前專案
```

任一不符：

```text
PROJECT_SCOPE_MISMATCH
→ 停止該 mutation
→ 保留 checkpoint
→ 重新解析專案並 reconciliation
```

不得用全域最近 task 或 visibility-only cross-project task 繞過。

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

## 自動監控拓樸（v1.4.0）

只要平台支援排程／輪詢，`FULL_AUTOMATIC_HANDOFF` 啟用或恢復後就必須**自動確保監控拓樸**；不再要求每個專案另外記得建立 Watch／Pulse。

標準拓樸固定為：

```text
Global Full-Auto Monitor          1 個，全域唯讀
Global Recovery Supervisor       1 個，全域救援控制面
Execution Watch                  每個 active execution task 恰好 1 個
Status Pulse                     每個 active execution task 恰好 1 個，永遠唯讀
```

建立／恢復 Durable Task 後固定執行：

```text
Ensure Global Monitor
→ Ensure Recovery Supervisor
→ Ensure Task Execution Watch
→ Ensure Task Status Pulse
→ 綁定 taskId + executionProjectRef + taskRole
→ 開始／恢復 execution
```

### Global Full-Auto Monitor

- 每小時唯讀掃描目前授權範圍內的 FULL_AUTOMATIC_HANDOFF。
- 逐專案使用 canonical root 與 `executionProjectRef`，禁止以全域最近更新 task 作 fallback。
- 驗證每個 current active task 是否存在且只存在一個 Execution Watch 與一個 Status Pulse。
- 檢查 owner/lease/runner/Watch/Pulse/Recovery/authority drift 與 `PROJECT_TASK_CONCURRENCY_CONFLICT`。
- 不取得 writer lease、不修改 product source/test、不 commit/push、不 takeover；需要救援時交給 Recovery Supervisor。

### 每 Task Execution Watch

- 一個 exact durable `taskId` 對應恰好一個 Execution Watch。
- 綁定 exact `executionProjectRef`；不能因 cross-project visibility 切換執行專案。
- 負責 reconciliation、remediation、verification、Git/promotion 與 `next_safe_action`。
- 平台最高頻率若為每小時，使用 hourly `condition_watch`；已有合法 active runner 時只接續／觀察，不重啟 duplicate runner。
- Watch 單輪時間到但仍有安全下一步時，保存 `RECOVERY_PENDING + next_safe_action`，下一輪原位續跑。

### 每 Task Status Pulse

- 一個 exact durable `taskId` 對應恰好一個 Pulse。
- 永遠 read-only：不 workflow mutation、不取得 writer lease、不改檔、不跑會變更狀態的測試、不 commit/push、不 takeover。
- 每小時讀 `taskId / executionProjectRef / state / gate / subject / owner / runner / recovery / blocker / next_safe_action`。
- 即使沒有 milestone，也要能明確辨識「仍正常執行／等待 runner／本輪無新變化」。
- Pulse 不得因查詢其他專案而改變 Session execution binding。

### Global Recovery Supervisor

- 全域只保留一個；負責救援 Execution Watch／session／lease／transport／ledger／runner／authority。
- 只能在 project-scoped reconciliation 後處理對應 task，不得成為第二個 product Executor。
- 必須遵守 stale-owner takeover、ownerEpoch fencing 與所有 production/release/secret hard gate。

### 去重與生命週期

監控 identity 固定以 `taskId + role` 判斷；同一 task/role 已存在但停用時優先更新並重新啟用，不建立 duplicate。若發現多份重複排程，只保留 canonical 一份，其餘停用並由 Global Monitor 報告。

```text
ACTIVE / EXECUTOR_WORK / VERIFICATION_FAILED / RECOVERY_PENDING / CHANGES_REQUIRED
→ Watch ON + Pulse ON

HARD_BLOCKED
→ Pulse ON；若 blocker 可安全唯讀重查，Watch 可保留 condition-watch，否則停止 mutation Watch

USER_PAUSED
→ Watch OFF + Pulse ON（只顯示 paused）

DONE / USER_CANCELLED
→ Watch OFF + Pulse OFF；歷史 workflow/evidence 保留
```

同一專案存在多個真正獨立 sibling task 時，只有在 task-specific actor、owned files、branch/worktree/namespace 已證明互相隔離時，才各自配置 Watch + Pulse；否則先標 `PROJECT_TASK_CONCURRENCY_CONFLICT`，不得自動合併或同時 mutation。

## Recovery Supervisor

Recovery Supervisor 是完整自動接力的控制面救援層，不是第二個 product Executor。

```text
Executor / Execution Watch：做工作
Status Pulse：看工作
Recovery Supervisor：救工作機制
```

可恢復的控制面／transport failure 包含：

- `EXECUTION_WATCH_MISSING`
- `EXECUTION_STALLED`
- `TRANSPORT_ERROR`
- `SESSION_INTERRUPTED`
- `LEASE_EXPIRED`
- `LEDGER_STALE`
- `RUNNER_INTERRUPTED`
- `AUTHORITY_DRIFT`
- `OWNER_STALE`

Recovery Supervisor task 固定 `taskRole=recovery_supervisor`、`implicitSelectionAllowed=false`。它可跨專案監控，但不得成為任一專案一般「進度／繼續完整自動接力」的隱式候選。

### Stale-owner takeover

只有以下全部成立才可 `workflow_takeover`：

```text
status = in_progress / changes_requested / ready_to_complete
currentOwner = expectedOwner
workflow revision = expectedRevision
owner stale >= 600 秒
owner heartbeat missing = true
active task runner observed = false
Execution Watch missing/stale = true
Task Contract 仍允許 next_safe_action
project affinity 已明確解析
```

成功後：

```text
revision CAS + 1
→ currentOwner = recovery actor
→ ownerEpoch + 1
→ append STALE_OWNER_TAKEOVER audit
→ 舊 owner 由 owner mismatch + stale revision fencing
→ reconciliation
→ 從 persisted next_safe_action 繼續
```

不得用 takeover 繞過 project affinity、pending independent review、production/release/secret/destructive gate，也不得在有 active runner 或近期 heartbeat 時搶 owner。

Supervisor 可調整 workflow、lease、execution schedule 等控制面狀態，但不得直接修改 product source/test；真正程式修復仍交給 executionProjectRef 對應專案的 Executor。

救援順序固定為：

```text
checkpoint
→ reconnect（需要時）
→ project-scoped reconciliation
→ 清理 task-owned residue（需要時）
→ stale-owner takeover + ownerEpoch fencing（需要時）
→ resume durable workflow / reacquire lease
→ restore Execution Watch
→ 從 next_safe_action 繼續
```

規則：

- `retryUntilRecoveredOrHardBlocked=true`；不設固定 retry 次數。
- 同一 failure fingerprint 反覆出現時不得 blind retry，必須改做 root-cause-aware recovery。
- Supervisor 不碰 production、不 force push、不 destructive reset、不新增未授權 Agent/model。
- DevSpace 暫時不可用時標 `TRANSPORT_RECOVERY_PENDING`；後續 Supervisor 繼續重試，不把 502／timeout 當 hard blocker。
- 只有不存在安全、已授權且可證明的 recovery path 時才可 `HARD_BLOCKED`。

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

- v1.4.0｜2026-08-28
  - FULL_AUTOMATIC_HANDOFF 啟用／恢復時自動確保完整監控拓樸。
  - 全域固定一個 Full-Auto Monitor 與一個 Recovery Supervisor。
  - 每個 current active execution task 固定一個 Execution Watch + 一個 read-only Status Pulse。
  - 監控以 `taskId + role` 去重，禁止重複 Watch/Pulse；專案與 `executionProjectRef` 綁定不因 visibility 改變。
  - 定義 ACTIVE／HARD_BLOCKED／USER_PAUSED／DONE／USER_CANCELLED 的 Watch/Pulse 生命週期。
- v1.3.0｜2026-08-27
  - 新增 Project Context Resolution／Project Scope Isolation。
  - 專案內的進度與隱式接力固定使用目前 canonical workspace 與 `executionProjectRef`。
  - 專案外明確名稱改由 `project_resolve` 唯一解析；查無或歧義時 fail closed。
  - `projectRefs` 只代表 visibility；跨專案唯讀查詢不會改變 execution binding。
  - Status Pulse、Recovery Supervisor、reviewer-watch、governance task 固定不參與一般隱式接力。
- v1.2.0｜2026-08-26
  - 新增 DevSpace stale-owner takeover 正式恢復路徑。
  - Takeover 綁 expectedRevision/expectedOwner、至少 600 秒 stale、missing heartbeat、無 active runner、Execution Watch missing/stale。
  - 成功後 ownerEpoch 遞增並留下 audit；舊 owner由 revision + owner 雙重 fencing 阻擋。
- v1.1.0｜2026-08-26
  - 新增 Recovery Supervisor 第三層救援機制。
  - Execution Watch／transport／session／lease／ledger／runner／authority failure 可跨 Session 自動 recovery。
  - 固定 root-cause-aware retry，Supervisor 不直接修改 product source/test。
- v1.0.0｜2026-08-26
  - 建立 PixiuCore 正式 Capability 入口。
  - 固定四種停止結果與 self-healing / checkpoint-resume 行為。
  - 明確拆分 `FULL_AUTOMATIC_HANDOFF`、Claude Auto mode、Focus mode。
