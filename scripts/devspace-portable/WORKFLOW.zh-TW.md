# DevSpace Web 跨 Session 工作接力

完成 OneClick 安裝並重新連線 DevSpace 後，ChatGPT Web 會看到五個工作工具：

- `workflow_create`：建立工作，選擇 `single_session`、`same_project` 或 `cross_project`。
- `workflow_list`：在新的對話列出可接手工作，或查詢指定 `taskId`。
- `workflow_update`：claim、handoff、acknowledge、review、complete 或 block。
- `workflow_run`：只有使用者在目前對話明確要求使用 Agent／model 時，才啟動本地 worker/reviewer Agent；未授權會直接拒絕。
- `workflow_sync`：只同步已由使用者明確授權啟動的 Agent run。

## 自然語意觸發

日常使用不需要記 `workflow_create`、`handoff`、`claim`、`acknowledge` 等工具名稱。只要使用者明確表示「工作要由另一個 Session、另一個對話或另一個專案接續」，就視為 workflow 意圖。

可直接觸發的說法例如：

- 「下一個 session 繼續」
- 「另一個對話接手」
- 「我等等開新聊天繼續」
- 「這個交給另一個專案處理」
- 「從這個 repo 換到另一個 repo 接著做」

行為規則：

- 目前 Session 要交棒：建立或沿用相符 task，必要時 claim，再 handoff。
- 新 Session 表示接續／接手：先 `workflow_list`；若只有一個明確相符的 pending handoff，直接 acknowledge。
- 同一 repo 的另一個 Session 使用 `same_project`；明確指定另一個已開啟 repo 才使用 `cross_project`。
- 若目標、scope 或候選 task 不唯一，才詢問使用者。
- 「先這樣」、「等等再說」等單純結束語不觸發，除非上下文明確指出之後要由另一個 Session／專案接續。
- 自然語意接力只會使用 `workflow_create`、`workflow_list`、`workflow_update`。它不授權 `workflow_run`，也不代表允許啟動 Agent／model。

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
- `model`／`reasoningEffort`：可選。純 workflow 建立、接手與 handoff 不需要指定；只有使用者明確要求模型覆寫時才填。
- `deepResearch`／`proMode`：可選；只有使用者明確要求對應能力時才填。
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

純 `workflow_create`／`workflow_list`／`workflow_update` 不會啟動任何模型。`workflow_run` 有硬性授權閘門：只有使用者在目前對話明確要求使用 Agent／model 時，呼叫端才可設定 `userAuthorizedModelRun=true`；否則 server 直接拒絕。

`model` 與 `reasoningEffort` 都是可選覆寫。未指定時，`workflow_run` 使用選定 DevSpace Agent profile 的既有預設，不在 workflow 建立階段預先綁定模型。

Deep Research 與 Pro 是獨立政策欄位，但目前本地 Agent adapter 無法替 ChatGPT Web 切換 UI 模式，也不能冒充 Responses API 的 Deep Research/Pro 執行器。因此：

- `block`：選了 Deep Research 或 Pro 就不啟動本地 Agent。
- `explicit_degrade`：本地 Agent 照選定模型／推理強度執行，Deep Research/Pro 的 effective 值記為 `false`。

未來加入官方 Responses/Workspace Agent adapter 後，可以沿用同一個 task/run policy，不必更換 handoff ledger。

## 狀態與安全

- 工作 ledger 位於 OneClick state 目錄的 `workflow/`，不寫進任何專案。
- ledger 是 hash chain，snapshot 只是 cache；偵測到竄改、截斷或 revision 不連續會 fail closed。
- `sessionRef` 與 `actor` 是單一 DevSpace owner 內的協作識別，不是多使用者登入憑證。
- OneClick 更新 workflow module 或 server patch 後，只會自動重啟它自己擁有且 PID 已驗證的 DevSpace stack。
