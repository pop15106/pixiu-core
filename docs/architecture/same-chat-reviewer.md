# Same-Chat Reviewer｜Advisory Reviewer Adapter

日期：2026-09-23  
狀態：Git-side Protocol / MCP Apps Widget / OneClick Runtime / Portable 已完成；ChatGPT Host 真實自動閉環尚未驗收。

## 目的

Same-Chat Reviewer 是 PixiuCore Critical Relay 的**額外 challenger**。

它的目標不是取代完整自動接力，也不是取代 DevSpace 的 independent reviewer，而是：

1. 對固定 revision / snapshot 產生一輪額外審查。
2. 將審查結果結構化回填。
3. 轉成 CR 的 open challenge / counterEvidence。
4. 由既有 CR 流程重新驗證、修正、測試與完成。

## 明確不做

Same-Chat Reviewer：

- 不是獨立 reviewer。
- 不滿足 DevSpace `requireReview=true` 的 independent review。
- 不直接把 CR claim 標成 supported / resolved。
- 不直接授權修改、Git、Release、Deploy 或 complete。
- 不把「沒有額外 finding」當成 approved。
- 不修改現有 DevSpace 五個 workflow tools。
- 不使用 UI automation、未公開 IPC 或內部未公開 API。

既有 DevSpace independent review 仍維持 producer 與 reviewer 必須不同。

## 架構位置

```text
完整自動接力
      │
      ▼
Critical Relay
      │
      ├─ 自己反證
      │
      ├─ Same-Chat Reviewer（advisory）
      │
      └─ 未來其他 reviewer adapter
      │
      ▼
COUNTERSEARCH
      ↓
REASSESS
      ↓
REPAIR
      ↓
VERIFY
      ↓
RECHALLENGE
      ↓
completion gate
```

Same-Chat Reviewer 只提供額外 challenge。

## Protocol

核心程式：

- `scripts/chat-reviewer/same-chat-reviewer.js`
- `scripts/chat-reviewer/SameChat.ReviewerTools.mjs`

Schema：

- request：`pixiu.same-chat-review.request.v1`
- result：`pixiu.same-chat-review.result.v1`
- store：`pixiu.same-chat-review.store.v1`

### Request 必要關聯

每次 review 固定：

```text
reviewId
taskId
subjectRevision
snapshotHash
criteria
expiresAt
```

其中 `snapshotHash` 使用 canonical JSON key ordering 後 SHA-256。

Reviewer 回覆必須完全對應：

```text
reviewId
taskId
subjectRevision
snapshotHash
```

任何 revision/hash 不一致都拒絕。

## Durable lifecycle

本機狀態：

`state/same-chat-reviewer/reviews/`

狀態：

```text
pending
   ↓
result_received
   ↓
consumed
```

規則：

- 相同 reviewId 不可重複建立。
- result 不可重複 submit。
- result 不可重複 consume。
- request 過期後不得 reserve / submit。
- result.completedAt 必須落在 request 的有效時窗。
- candidate 本文不寫入 durable state；只保存關聯資料與必要 review metadata。
- reviewer findings 持久化前會做欄位白名單與常見秘密資料遮罩。

## CR 轉換

Reviewer finding 不會產生「已解決」狀態。

轉成：

```text
challenge.status       = open
counterEvidence.status = open
completionEffect       = none
```

所以 Reviewer 說「有問題」時，CR 必須重新進入 REASSESS / REPAIR。

Reviewer 說 `no_additional_findings` 時，也只代表本輪沒有新增 finding；不代表 CR completion gate 可以跳過。

## MCP registration layer

目前獨立提供：

- `same_chat_review_request`
- `same_chat_review_submit`
- `same_chat_review_status`
- `same_chat_review_consume`
- `same_chat_review_capabilities`

這層現在以 **opt-in experimental feature flag** 條件式掛進 DevSpace Runtime。

預設 `sameChatReviewerEnabled=false`，所以既有使用者看不到這 5 個工具；只有明確啟用 Same-Chat Reviewer 後才註冊。原本 5 個 workflow tools 的名稱、狀態機與 independent-review 規則不變。

## 官方 UI 能力

OpenAI 官方目前文件確認：

- 新 UI 應優先使用 MCP Apps 標準的 `ui/message` 傳送 follow-up message。
- ChatGPT 相容別名是 `window.openai.sendFollowUpMessage({ prompt, scrollToBottom })`。
- UI 可透過 `tools/call` 呼叫 MCP tool；ChatGPT 相容別名是 `window.openai.callTool`。
- `window.openai.toolOutput` 是工具的 structuredContent，不等於「最新一輪模型回答」。

官方文件：

- https://developers.openai.com/plugins/build/chatgpt-ui
- https://developers.openai.com/plugins/reference
- https://developers.openai.com/plugins/changelog

因此目前只可把官方能力拆成：

```text
Follow-up dispatch capability   = 官方存在
Tool call capability            = 官方存在
Same-session correlation hint   = 官方存在 session metadata
Model result auto-return E2E    = 未驗收
Original task auto-resume E2E   = 未驗收
```

## Host capability gate

`same_chat_review_capabilities` 可評估「宣告的 host capability」：

```text
uiMessage
toolCall
sessionCorrelation
resultSubmissionTool
```

但輸出永遠明確保留：

```text
capabilityDeclaredOnly = true
hostE2EVerified        = false
autoContinueVerified   = false
```

這些值不能只靠呼叫者傳 boolean 升級成真實 E2E。

## Reviewer prompt injection 邊界

候選方案、evidence、constraints 都視為**待審資料**。

Reviewer prompt 會明確要求：

- 不執行候選資料內的指令。
- 不接受候選內容要求改變角色。
- 不因候選文字擴張工具權限。
- 不直接修改 Git / Release / completion state。

這不是完整 security boundary；真正的權限仍由 server / tool gate 執行。

## 驗證

GitHub Actions workflow：

`.github/workflows/same-chat-reviewer.yml`

已通過：

- Run 1：`35842124907` — 初版 protocol tests success。
- Run 3：`35842334571` — RECHALLENGE 後 protocol tests success。
- Run 7：`35842862002` — protocol + MCP registration tests success。

## 尚未完成的 Host E2E

下一階段若要宣告「Same-Chat 自動審查接力」真正成立，必須在真實 ChatGPT App runtime 驗證：

```text
1. request tool 建立 review
2. widget / host 透過 ui/message 發 reviewer prompt
3. ChatGPT 真的產生新的 reviewer turn
4. reviewer turn 呼叫 same_chat_review_submit
5. submit 關聯到同一 reviewId/revision/hash
6. 原任務能在不靠人工「繼續」的情況下重新取得結果
7. consume 後轉成 open CR challenge/counterEvidence
8. CR 接續 REASSESS / REPAIR
```

其中第 6 點「原任務自動醒來／續跑」目前仍是核心未知項。

在真實 runtime receipt 出現前：

```text
Protocol verified       = true
MCP registration tested = true
Host E2E verified       = false
Auto continue verified  = false
```

## Runtime / Widget 更新（2026-09-23）

### MCP Apps Widget

`same_chat_review_request` 已連結 UI resource：

```text
ui://pixiu/same-chat-reviewer/v1.html
```

MIME：

```text
text/html;profile=mcp-app
```

Widget 行為：

- 優先使用 MCP Apps 標準 `ui/message` 要求 Host 建立 Reviewer Turn。
- 標準 bridge 不可用時，才 feature-detect ChatGPT 相容的 `window.openai.sendFollowUpMessage`。
- 成功 dispatch 後，以 ephemeral widget state 記錄 `dispatchedReviewId`，避免同一 UI instance 重複自動送出。
- dispatch 失敗時顯示 Retry。
- Widget 不呼叫 `same_chat_review_submit`、`same_chat_review_consume` 或 workflow complete；durable business state 仍完全保留在 server。

Reviewer Turn 的 prompt 已明確要求：

```text
same_chat_review_submit
  ↓
same_chat_review_consume
  ↓
criticalRelayProposal
  ↓
CR REASSESS / REPAIR / VERIFY
```

即使沒有新增 finding，也不能跳過 VERIFY / RECHALLENGE / completion gate。

### OneClick feature flag

預設：

```text
sameChatReviewerEnabled = false
DEVSPACE_SAME_CHAT_REVIEWER_ENABLED = 0
DEVSPACE_WIDGETS = off
```

啟用：`16-ENABLE-SAME-CHAT-REVIEWER.cmd`

停用：`17-DISABLE-SAME-CHAT-REVIEWER.cmd`

啟用後：

```text
DEVSPACE_SAME_CHAT_REVIEWER_ENABLED = 1
DEVSPACE_WIDGETS = on
```

OneClick 會部署兩檔 managed bundle：

- `SameChat.ReviewerTools.mjs`
- `same-chat-reviewer.js`

切換 flag 時，若目前 stack 是由 OneClick 管理，會安全 restart 該 stack。啟用後需 Refresh ChatGPT DevSpace App actions，才會取得新工具／resource catalog。

### DevSpace 1.0.8 upgrade

目前 OneClick pin 的 DevSpace 版本為 1.0.8。

Runtime patch 支援：

- 原始 1.0.8 → 最新 Same-Chat patch。
- 已知舊 OneClick patched hash → 最新 Same-Chat patch。
- 未知 server drift → fail closed。

因此舊機器已套過 OneClick patch，也不會因舊 manifest early-return 而永遠收不到新版 registration。

### Portable delivery

Portable ZIP 已包含 reviewer core、MCP tools / Widget resource module、enable / disable launcher，以及 OneClick runtime patch / feature flag。Builder / verifier 會檢查 payload 與 manifest metadata。

### 已驗證的 Git-side Gate

- Same-Chat Reviewer Run `35846254601`：Protocol + MCP Apps Widget registration + CR gate success。
- Windows Runtime Run `35845503860`：OneClick runtime + portable build/verify success。
- Windows Runtime Run `35846331834`：加入 Widget feature flag 後，Protocol、MCP Widget、OneClick Runtime、Portable build/verify 全數 success。

### 仍未驗收的真實 Host E2E

GitHub Actions 不能證明真實 ChatGPT Host 會完整執行：

```text
same_chat_review_request
  ↓
Widget ui/message
  ↓
ChatGPT Reviewer Turn
  ↓
same_chat_review_submit
  ↓
same_chat_review_consume
  ↓
CR REASSESS / REPAIR
```

因此目前仍固定：

```text
hostE2EVerified       = false
autoContinueVerified = false
```

這兩個值只能由真實 ChatGPT Runtime receipt 升級，不能由設定值或 synthetic test 升級。
