---
type: governance
date: 2026-08-14
project: PIXIUCORE
system: PIXIUCORE
topic: phase-boundary-policy
status: active
tags: [pixiucore, phase, recap, handoff, compact]
summary: 定義 Continue、Clear、Handoff、Subagent、Compact 的 phase boundary 行為，避免跨 Session 與派工時複製正式來源。
---

# Phase Boundary Policy

## Continue

同一 Session、同一 phase 且 context 足夠時繼續。只攜帶目前 phase 必要來源與 unresolved Decision ID。

## Clear

phase 已完成且後續工作不需要目前細節時清理暫存 context。正式 spec、Decision Ledger、ADR、report 不因 clear 而複製到 recap。

## Handoff

跨 Session、跨對話或跨專案接續時，預設使用 DevSpace durable workflow 作接力；使用者不需要說出 `workflow`、`handoff`、`claim` 或 `acknowledge` 等工具名稱。

### 自然語意觸發

下列語意視為明確接力意圖，工具可直接建立或延續 workflow：

- 「下一個 session 繼續」
- 「另一個對話接手」
- 「我等等開新聊天繼續」
- 「這個交給另一個專案」
- 「從這個 repo 換到另一個 repo 接著做」
- 其他等價、且明確表示工作要由另一個 Session／對話／專案承接的說法

只有下列情況才詢問使用者：

1. 目標 Session／專案無法判斷。
2. 同時存在多個合理可接手 workflow，無法唯一配對。
3. scope 無法由已開啟 workspace 判斷。
4. 使用者只說「先這樣」、「等等再說」等結束語，沒有明確接續意圖。

### Scope 預設

- 同一 repo 的另一個 Session：`same_project`。
- 明確指定另一個已開啟 repo：`cross_project`，並把該 workspace 加入 `relatedWorkspaceIds`。
- `single_session` 不用於跨 Session 接力。

### 接力動作

- 目前 Session 要交棒：建立或取得 workflow → claim（若尚未有 owner）→ handoff。
- 新 Session 表示「接續／接手剛剛工作」：先 `workflow_list`，找到唯一合理的 pending handoff 後再 acknowledge。
- 若使用者同時要求 recap，recap 仍採 pointer-only；workflow 保存執行接力狀態，兩者不互相複製正文。
- 跨 Session 接力本身不代表允許使用 Agent／model；不得因此呼叫 `workflow_run`。模型執行仍需使用者在目前對話另外明確授權。

handoff packet 只保存：

- 正式來源路徑
- 當前 phase 與狀態
- unresolved Decision ID
- 驗證狀態
- 下一個 Skill／命令

## Subagent

只有使用者明確授權後才能派工。Task packet 只含完成子任務所需的最小來源 pointer、Decision ID、AC、scope 與驗證方式；不得要求子 Agent 重讀整個 PixiuCore。

## Compact

只在目前 phase 已有穩定 checkpoint 時 compact。Compact 前確認：

1. 已完成內容有正式來源或可重建證據。
2. unresolved Decision ID 已列出。
3. 下一步入口清楚。
4. 未把 spec、ADR、Decision Ledger 正文複製進摘要。

## Recap Contract

Recap 是 continuity index，不是第二份規格。內容只保留 pointer、狀態、未解決項目與下一步；正式要求、決策與驗證證據仍由 Source of Truth Map 指定來源承載。
