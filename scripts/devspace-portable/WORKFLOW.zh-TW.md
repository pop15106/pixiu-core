# DevSpace Web 專案範圍與跨 Session 工作接力

完成 OneClick 安裝並重新連線 DevSpace 後，ChatGPT Web 會看到七個專案／工作工具：

- `project_resolve`：只在目前不位於專案 workspace，且使用者明確說出專案名稱、alias 或絕對路徑時，解析唯一 canonical project root；無結果或多結果會 fail closed。
- `workflow_create`：建立工作，選擇 `single_session`、`same_project` 或 `cross_project`。
- `workflow_list`：預設只列目前 workspace 的 `executionProjectRef` 任務；明確指定 cross-project task 時才可用 `related_explicit`。
- `workflow_update`：claim、handoff、acknowledge、review、complete 或 block。
- `workflow_takeover`：只處理符合 stale-owner 條件的已指定 task，不會繞過 project affinity。
- `workflow_run`：只有使用者在目前對話明確要求使用 Agent／model 時，才啟動本地 worker/reviewer Agent；未授權會直接拒絕。
- `workflow_sync`：只同步已由使用者明確授權啟動的 Agent run。

## Project Context Resolution

### 位於專案 workspace

當 `open_workspace` 已開啟某一個專案，該 canonical project root 是本 Session 的預設執行綁定。

```text
目前 workspace = Project B
「目前進度」             → 只查 Project B
「繼續完整自動接力」     → 只接 Project B
「看 Project A 的進度」  → 可唯讀查 A，但執行綁定仍是 B
下一句「繼續完整自動接力」→ 仍接 Project B
```

不得因為 Project A 的 task 更新較新、仍 active、存在 pending handoff、屬 cross-project scope，或最近被 Status Pulse／Recovery Supervisor 更新，就把它當成 Project B 的隱式接力候選。

只有以下動作可以改變 execution binding：

- 使用者明確要求切換專案，並開啟新的 canonical workspace。
- owner 建立帶 `targetWorkspaceId` 的 cross-project handoff，接手方在目標 workspace 以 `related_explicit` acknowledge。

單純查看另一個專案、讀 recap、讀 handoff 或列出 visible task，不會改變 `executionProjectRef`。

### 不位於專案 workspace

使用者必須在本次訊息明確指定專案，例如：

```text
「NeedToKnow 現在進度」
「D:\Project\ComfyUI 的進度」
```

固定流程：

```text
project_resolve
→ 唯一 canonical root / projectRef
→ open_workspace
→ 讀該專案 handoff / current-progress / machine state / workflow
```

若使用者只說「目前進度」，且沒有當前專案 workspace 或唯一 Session project binding，系統不得以最近 task、最近 recap、最近 Git commit 或最近監控事件猜測專案。結果必須是 `PROJECT_CONTEXT_REQUIRED` 或列出可辨識候選讓使用者選擇。

多個 project alias 同分時回 `PROJECT_CONTEXT_AMBIGUOUS`，不能任選第一個。

## Durable Workflow 專案欄位

Schema v3 將三個概念分開：

| 欄位 | 唯一用途 |
|---|---|
| `primaryProjectRef` | 建立 task 的主要專案 |
| `executionProjectRef` | 目前真正執行、續跑、取得 writer authority 的專案 |
| `projectRefs` | task 對哪些專案可見；可見不代表可隱式執行 |

另有：

```text
taskRole = execution | reviewer_watch | status_pulse | recovery_supervisor | governance
implicitSelectionAllowed = true | false
```

`reviewer_watch`、`status_pulse`、`recovery_supervisor`、`governance` 固定不是一般「目前進度／繼續完整自動接力」的隱式候選。

## 自然語意觸發

日常使用不需要記 `workflow_create`、`handoff`、`claim`、`acknowledge` 等工具名稱。只要使用者明確表示工作要由另一個 Session、另一個對話或另一個專案接續，就視為 workflow 意圖。

可直接觸發的說法例如：

- 「下一個 session 繼續」
- 「另一個對話接手」
- 「我等等開新聊天繼續」
- 「切換到 AI Workflow 繼續完整自動接力」
- 「把這個 task 明確交給 ComfyUI 專案」

行為規則：

- 目前 Session 要交棒：建立或沿用相符 task，必要時 claim，再 handoff。
- 新 Session 表示接續／接手：先以目前 workspace 呼叫 `workflow_list`；只處理 execution-affine task。
- 同一 canonical repo 的另一個 Session 使用 `same_project`。
- 只有明確指定且已開啟所有相關 repo 時使用 `cross_project`。
- 跨專案 handoff 必須填 `targetWorkspaceId`；接手方用 `related_explicit` acknowledge 後，`executionProjectRef` 才轉移。
- 若專案、scope 或候選 task 不唯一，先 fail closed，不依更新時間排序猜測。
- 「先這樣」、「等等再說」等單純結束語不觸發，除非上下文明確指出之後要由另一個 Session／專案接續。
- 自然語意接力只授權 coordination，不授權 `workflow_run` 或新的 Agent／model。

## 最短流程

### 1. 建立工作

先用 `open_workspace` 開啟主要專案，再呼叫 `workflow_create`：

- `sessionRef`：Web 對話的穩定名稱。
- `actor`：目前執行者名稱。
- `scope`：`single_session`、`same_project` 或 `cross_project`。
- `relatedWorkspaceIds`：只在 `cross_project` 使用。
- `taskRole`：一般 product work 使用 `execution`；監控／治理角色使用對應 non-implicit role。
- `implicitSelectionAllowed`：一般 execution 預設 `true`；監控／治理角色固定 `false`。
- `executionWorkspaceId`：通常省略，預設等於主要 workspace；只在明確初始化跨專案執行位置時填入。
- `idempotencyKey`：每個操作一個唯一值；重試同一操作沿用原值。

### 2. 換對話接手

新 Web 對話開啟同一專案，呼叫：

```text
workflow_list(projectAccessMode="execution_only")
```

- 尚未有人處理：`workflow_update(action="claim")`。
- 同專案 handoff：handoff 指定 actor 呼叫 `acknowledge`。
- 每次 mutation 使用目前 task 的 `revision` 作為 `expectedRevision`。
- 遇 stale revision 時重新讀 task，不覆蓋新狀態。

### 3. 跨專案交棒

owner 在目前 execution project 呼叫：

```text
workflow_update(
  action="handoff",
  targetWorkspaceId="<目標 workspaceId>",
  ...
)
```

並填：`toActor`、`contextSnapshot`、`deliverables`、`openItems`、`requiredNextAction`。

目標專案接手方呼叫：

```text
workflow_update(
  action="acknowledge",
  projectAccessMode="related_explicit"
)
```

只有 acknowledge 成功後，`executionProjectRef` 才轉移。唯讀查詢不會轉移。

### 4. 明確監控／救援

需要查看 Status Pulse、Recovery Supervisor、reviewer-watch 或 governance task 時，必須明確使用：

```text
workflow_list(
  projectAccessMode="related_explicit",
  includeNonImplicit=true
)
```

這些 task 不會被一般接力指令選中。`workflow_takeover` 還必須同時滿足 stale owner、missing heartbeat、無 active runner 與 missing/stale Execution Watch 等條件。

## 模型、Deep Research 與 Pro

純 `project_resolve`／`workflow_create`／`workflow_list`／`workflow_update`／`workflow_takeover` 不會啟動模型。`workflow_run` 有硬性授權閘門：只有使用者在目前對話明確要求使用 Agent／model，呼叫端才可設定 `userAuthorizedModelRun=true`。

`model` 與 `reasoningEffort` 是可選覆寫。Deep Research／Pro 若本地 adapter 不支援，依 `unsupportedBehavior=block | explicit_degrade` 處理，不得冒充已啟用。

## 狀態與安全

- Workflow ledger 位於 OneClick state 目錄的 `workflow/`，不寫進產品 repo。
- Ledger 是 hash chain；snapshot 只是 cache。偵測竄改、截斷或 revision 不連續會 fail closed。
- Schema v1/v2 ledger 保留可讀；下一次 mutation 會升級成 schema v3，不重寫歷史 hash。
- `PROJECT_SCOPE_MISMATCH` 會阻擋錯誤專案的 mutation、run、sync、takeover 與接力。
- `sessionRef` 與 `actor` 是單一 DevSpace owner 內的協作識別，不是多使用者登入憑證。
- OneClick 更新 workflow module 或 server patch 後，只會重啟它自己擁有且 PID 已驗證的 DevSpace stack。
