---
name: critical-relay
description: 以「先做，再懷疑；主動推翻，推不翻才往下一棒接力」執行對抗搜尋、反證、交叉驗證與完整自動接力。觸發詞：對抗搜尋、懷疑每個論點、反證、反例、交叉驗證、批判搜尋、Critical Relay。
origin: Pixiu
version: 0.1.0
language: zh-TW
---

# Critical Relay

Critical Relay 是 PixiuCore 的批判推理接力層。它不取代 Deep Research、程式實作或 Verify Loop；它替這些能力增加一個共同的「可被推翻」流程與完成閘門。

## 核心原則

> 先做，再懷疑；主動嘗試推翻，推不翻才往下一棒接力。

每個重要結論先拆成可驗證主張，再蒐集支持證據與反證。不能只找支持原本想法的資料。

## 標準流程

1. **UNDERSTAND**：定義目標、範圍與完成條件。
2. **HYPOTHESIZE**：建立 claims 與 assumptions，不先把假設寫成事實。
3. **EXECUTE**：搜尋資料、閱讀來源、實作或執行測試，建立 evidence。
4. **CHALLENGE**：對每個核心 claim 提出最強合理反方與失敗條件。
5. **COUNTERSEARCH**：主動搜尋 counterEvidence、反例、失敗案例與不同資料集。
6. **REASSESS**：比較 evidence 與 counterEvidence，將 claim 標成 supported、rejected、withdrawn 或 contested。
7. **REPAIR**：修正論點、查詢、實作或測試設計。
8. **VERIFY**：跑必要 tests，逐項滿足 completionCriteria。
9. **RECHALLENGE**：驗證後再做一次反方檢查，避免「測試綠燈就停止懷疑」。
10. **READY_TO_HANDOFF / COMPLETE**：只在 completion gate 通過後交棒或完成。

如果發現新反證，流程回到 CHALLENGE / COUNTERSEARCH，不以固定輪數強制停止。

## 搜尋規則

- 每個重要 claim 至少要有可追溯 evidence。
- 主動使用與原假設相反的搜尋詞，例如 failure、criticism、limitation、counterexample、replication、rebuttal。
- 重要資料優先級：官方／原始資料／論文原文 > 高品質二手分析 > 社群討論。
- 單一來源只能形成暫定 evidence；核心結論要做交叉驗證。
- 時效性主張要記錄資料時間範圍。
- 找不到反證，不等於主張為真；只能表示本輪未找到足夠反證。
- evidence 與 counterEvidence 都要保留，不刪掉不利資料。

## Canonical State

跨 ChatGPT、Codex、Gemini、GitHub 或 DevSpace handoff 時，保留下列欄位：

- `claims`
- `assumptions`
- `evidence`
- `counterEvidence`
- `challenges`
- `unknowns`
- `tests`
- `completionCriteria`
- `remainingRisks`
- `nextAction`

程式契約位於：

`scripts/critical-relay/critical-relay.js`

Schema：

`pixiu.critical-relay.v1`

handoff 可把 `buildHandoffSnapshot(state)` 的結果放進既有 workflow 的 `contextSnapshot`；不需要新增另一套 ledger。

## Completion Gate

下列任一條件成立時，不得宣告完成：

- claim 仍是 open / contested。
- supported claim 沒有 evidenceRefs。
- claim 有 counterEvidence，但尚未標示 addressed。
- high / critical assumption 未驗證或未界定。
- high / critical challenge 或 unknown 尚未 resolved。
- 必要 test 未 passed。
- completionCriteria 未滿足，或沒有 evidenceRefs。
- high / critical remainingRisk 尚未 accepted、mitigated 或 resolved。

可用下列指令檢查 state：

```bash
node scripts/critical-relay/critical-relay.js check <state.json>
```

exit code 0 代表可進入 READY_TO_HANDOFF；exit code 2 代表仍有 blocker。

## 與完整自動接力整合

當 `critical-reasoning` 與 `execution-progress` 同時被 Router 命中：

```text
理解需求
  -> 建立主張/假設
  -> 搜尋/實作
  -> 初步結果
  -> CHALLENGE
  -> COUNTERSEARCH / 反例測試
  -> REASSESS
  -> REPAIR
  -> VERIFY
  -> RECHALLENGE
  -> completion gate
  -> commit / push / release / handoff（依既有授權）
```

紅燈是修復訊號，不是固定停止點；在既有授權範圍內持續修正與重測。只有真正的權限、安全、Production、Release 或外部憑證閘門才進入 BLOCKED。

Critical Relay 本身不授權 Agent/subagent，也不放寬寫入、push、Release 或 Deploy 權限。

## 與其他能力的關係

- **Deep Research**：Critical Relay 增加反證搜尋與 claim 級證據帳本。
- **Verify Loop**：Critical Relay 把「驗證成功」後再加一輪 RECHALLENGE。
- **完整自動接力**：Critical Relay 成為完成條件的一部分；尚有 blocker 時不得回報 🟢 全部完成。
- **Workflow handoff**：使用既有 `contextSnapshot` 傳遞 canonical state，不新增另一套 durable store。
