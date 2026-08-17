---
type: governance
date: 2026-08-14
project: PIXIUCORE
system: PIXIUCORE
topic: decision-ledger-standard
status: active
tags: [pixiucore, decisions, traceability, frontier]
summary: 定義 Decision Ledger 的 resolver、狀態、Frontier、reopen 與 trace 規則。
---

# Decision Ledger Standard

## Resolver Type

| Resolver | 用途 | 行為 |
|---|---|---|
| `FACT` | Repo、文件、環境可驗證 | Agent 先查證，不問使用者 |
| `USER_DECISION` | 使用者有權拍板 | 問使用者，推薦答案不得視為批准 |
| `EXPERIENTIAL` | UI、操作感、流程需實際驗證 | 先做已授權 prototype，再決定 |
| `EXTERNAL_EXPERT` | SA、PM、外部單位或 domain expert 才有權威答案 | 轉 `to-questionnaire` |
| `MANUAL_ACTION` | Dashboard、憑證或實體環境需人工操作 | 產明確人工步驟 |

## 狀態

`OPEN`、`BLOCKED_BY_FACT`、`READY_TO_ASK`、`RESOLVED`、`REOPENED`、`DEFERRED`、`OUT_OF_SCOPE`、`INVALIDATED`。

## Frontier

Decision 只有在下列條件同時成立時可進 Frontier：

1. 狀態為 `OPEN` 或 `REOPENED`。
2. 所有 `prerequisites` 已 `RESOLVED`。
3. `blockedByFacts` 為空。
4. resolver 沒有進行中的 research、prototype 或 manual action。
5. 既有正式來源沒有直接回答。
6. 此決策現在會阻塞下游。

排序依序為 P0 blocker、解鎖最多下游、最難逆轉、其他項目。預設一次只問 Frontier 第一題；只有使用者明示 `--batch` 才能同輪提出互不依賴的多題。

## Branch Reopen

下列事件必須 reopen：

- 新回答與既有 Decision 衝突。
- Repo 事實否定既有假設。
- 使用者改變約束。
- Prototype 結果推翻原決策。
- External expert 提供新權威資訊。
- ADR 與目前決策不一致。

Reopen 時保留舊 resolution 與 rationale 到 history，不覆寫歷史；受影響下游回到 `OPEN` 或在已不成立時標為 `INVALIDATED`，再重新計算 Frontier。

## Trace

每個進入實作的 P0/P1 Decision 必須能追到：

- spec
- acceptance criteria
- ticket/task
- test/verification evidence
- ADR（有架構決策時）

Decision Ledger 是 trace 的正式來源，其他文件只引用 Decision ID。

## Shared Understanding Gate

Frontier 清空不等於可直接實作。進下一階段前需確認：

- P0/P1 已 resolved、deferred 或 out-of-scope。
- Fact 有 evidence。
- conflict 已處理。
- 沒有孤立 blocker。
- 使用者明確確認 shared understanding。
- 寫入、派工、implementation、commit 與 push 仍各自遵守既有授權閘門。
