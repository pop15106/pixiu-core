# DevSpace Web 跨 Session 工作接力

完成 OneClick 安裝並重新連線 DevSpace 後，ChatGPT Web 會看到五個工作工具：

- `workflow_create`：建立工作，選擇 `single_session`、`same_project` 或 `cross_project`。
- `workflow_list`：在新的對話列出可接手工作，或查詢指定 `taskId`。
- `workflow_update`：claim、handoff、acknowledge、review、complete 或 block。
- `workflow_run`：啟動本地 worker/reviewer Agent；可為這次 run 覆寫模型與推理強度。
- `workflow_sync`：把 Agent 的最新狀態與輸出同步回工作 ledger。

## 最短流程

### 1. 建立工作

先用 `open_workspace` 開啟專案，再呼叫 `workflow_create`：

- `sessionRef`：這個 Web 對話的穩定名稱，例如 `billing-refactor-chat-a`。
- `actor`：目前執行者名稱，例如 `planner-a`。
- `scope`：
  - `single_session`：只讓相同 `sessionRef` 操作。
  - `same_project`：同一 project root 的其他對話可以接手。
  - `cross_project`：先分別 `open_workspace`，再把其他 `workspaceId` 放入 `relatedWorkspaceIds`。
- `idempotencyKey`：每個操作一個唯一值；重試同一操作時沿用原值。
- `model`／`reasoningEffort`：預設執行政策。
- `deepResearch`／`proMode`：是否要求該能力。
- `unsupportedBehavior`：
  - `block`：執行器不支援就拒絕啟動。
  - `explicit_degrade`：允許降級，但 run 會同時保存 requested/effective policy 與警告。

### 2. 換對話接手

新 Web 對話用同一專案的 `open_workspace` 取得新的 `workspaceId`，再用自己的 `sessionRef` 呼叫 `workflow_list`。

- 尚未有人處理：`workflow_update(action="claim")`。
- 前一位已 handoff：handoff 指定的 `actor` 呼叫 `workflow_update(action="acknowledge")`。
- 每次 mutation 都使用目前 task 的 `revision` 作為 `expectedRevision`。遇 stale revision 時先重新 `workflow_list`，不要覆寫新狀態。

### 3. 交棒

owner 呼叫 `workflow_update(action="handoff")`，必須填：

- `toActor`
- `contextSnapshot`
- `deliverables`
- `openItems`（可以是空陣列，但不能省略）
- `requiredNextAction`

接手方 acknowledge 前，工作維持 `handoff_pending`。

### 4. 互相監督

owner 呼叫 `workflow_update(action="request_review")`，指定不同的 `reviewerActor`、固定 `subjectRef` 與 `criteria`。reviewer 可以：

1. 用 `workflow_run(role="reviewer")` 啟動 `codex-qa-tester`。
2. 用 `workflow_sync` 取得輸出。
3. 用 `workflow_update(action="submit_review")` 提交 `approved`、`changes_required` 或 `blocked`。

`requireReview=true` 的工作只有在 review 通過後才能 complete；producer 與 reviewer 不得相同。

## 模型、Deep Research 與 Pro

DevSpace 本地 Codex Agent adapter 目前可以實際傳入 `model` 與 `reasoningEffort`。每次 `workflow_run` 也可以覆寫這兩項。

Deep Research 與 Pro 是獨立政策欄位，但目前本地 Agent adapter 無法替 ChatGPT Web 切換 UI 模式，也不能冒充 Responses API 的 Deep Research/Pro 執行器。因此：

- `block`：選了 Deep Research 或 Pro 就不啟動本地 Agent。
- `explicit_degrade`：本地 Agent 照選定模型／推理強度執行，Deep Research/Pro 的 effective 值記為 `false`。

未來加入官方 Responses/Workspace Agent adapter 後，可以沿用同一個 task/run policy，不必更換 handoff ledger。

## 狀態與安全

- 工作 ledger 位於 OneClick state 目錄的 `workflow/`，不寫進任何專案。
- ledger 是 hash chain，snapshot 只是 cache；偵測到竄改、截斷或 revision 不連續會 fail closed。
- `sessionRef` 與 `actor` 是單一 DevSpace owner 內的協作識別，不是多使用者登入憑證。
- OneClick 更新 workflow module 或 server patch 後，只會自動重啟它自己擁有且 PID 已驗證的 DevSpace stack。
