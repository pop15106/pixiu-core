---
name: critical-relay
description: 以「先做，再懷疑；主動推翻，推不翻才往下一棒接力」執行對抗搜尋、反證、交叉驗證與完整自動接力。觸發詞：對抗搜尋、懷疑每個論點、反證、反例、交叉驗證、批判搜尋、Critical Relay、CR 完整自動接力。
origin: Pixiu
version: 0.3.0
language: zh-TW
---

# Critical Relay

Critical Relay 是 PixiuCore 的批判推理接力層。它不取代 Deep Research、程式實作或 Verify Loop；它替這些能力增加一個共同的「可被推翻」流程與完成閘門。

## 快速觸發

- `CR 完整自動接力`：同時啟用 Critical Relay 與完整自動接力。實作任務採 `mode=FULL_AUTOMATIC_RELAY`、`executionContractRequired=true` 與下列交付契約；研究型任務保留既有 general 模式。
- 不使用裸 `CR` 作全域關鍵字，避免短字串誤觸其他英文內容。

## 核心原則

> 先做，再懷疑；主動嘗試推翻，推不翻才往下一棒接力。

每個重要結論先拆成可驗證主張，再蒐集支持證據與反證。不能只找支持原本想法的資料。

## 啟動方式

Critical Relay 可以單獨形成一個模式，也可以疊加在完整自動接力上：

- 單獨模式：`開 Critical Relay`、`用對抗搜尋模式`、`懷疑每個論點並找反證`。
- 疊加模式：`對抗搜尋，開完整自動接力`。Router 會同時載入 `critical-reasoning` 與 `execution-progress`。
- 單獨模式只增加懷疑、反證、交叉驗證與 completion gate；不會自動啟用 Git／Release／Deploy 或 Agent 權限。

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

如果發現新反證，流程回到 CHALLENGE / COUNTERSEARCH。相同失敗累計兩次且沒有新證據時先 REASSESS：建立最小重現、修正假設或改變方法，保留累計次數。時間或工具預算耗盡時保存未完成快照與下一步；這不是通過驗收。

## 搜尋規則

- 每個重要 claim 至少要有可追溯 evidence；可追溯定位使用 URL、citation、provenance，或帶 `git:`／`repo:`／`doi:` 等 scheme 的 source，單純 `source: "xxx"` 不算。
- 每個準備標成 `supported` 的 claim 至少要有一個 `challengeRef`，且 challenge 要反向指回該 claim、記錄 `method` 與 `result`，最後狀態為 `resolved`。
- 主動使用與原假設相反的搜尋詞，例如 failure、criticism、limitation、counterexample、replication、rebuttal。
- 重要資料優先級：官方／原始資料／論文原文 > 高品質二手分析 > 社群討論。
- 單一來源只能形成暫定 evidence；核心結論要做交叉驗證。
- 時效性主張要記錄資料時間範圍。
- 找不到反證，不等於主張為真；只能表示本輪未找到足夠反證。
- evidence 與 counterEvidence 都要保留，不刪掉不利資料。

## Canonical State

跨 ChatGPT、Codex、Gemini、GitHub 或 DevSpace handoff 時，保留下列欄位：

- `phaseHistory`（完成前必須保留 `VERIFY → RECHALLENGE`）
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

handoff 使用 `buildHandoffSnapshot(state)` 建立獨立快照，附 `stateDigest`；接手時用 `verifyHandoffSnapshot(snapshot)` 重新驗證 digest 與 completion gate。既有 DevSpace workflow 另有結構化 `criticalRelay` 欄位，不再只依賴字串 `contextSnapshot`。

## Completion Gate

下列任一條件成立時，不得宣告完成：

- claim 仍是 open / contested。
- supported claim 沒有 evidenceRefs。
- supported claim 沒有 challengeRefs，或 challenge 不存在、未反向指向 claim、未 resolved、缺少 method／result。
- counterEvidence 與 claim 必須雙向互指；任一邊漏接、重複 ID 或 high / critical 反證尚未處理都會阻擋完成。
- claim 有 counterEvidence，但尚未標示 addressed。
- high / critical assumption 未驗證或未界定。
- high / critical challenge 或 unknown 尚未 resolved。
- 必要 test 未 passed。
- completionCriteria 未滿足，或沒有 evidenceRefs。
- high / critical remainingRisk 尚未 accepted、mitigated 或 resolved。
- state 欄位型別錯誤、`status=blocked`、缺少 `VERIFY → RECHALLENGE` phaseHistory 都會 fail closed。

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

## 單一 Agent 交付契約

目的：減少反覆讀檔、重做規劃與無效重試；以實際驗收衡量效果，不宣稱複製其他模型的訓練或保證效能提升。

1. **先建立 Task Contract**：記錄原始需求、Git repo／branch／完整 baseSha、允許修改範圍、驗收條件與本次授權。保留既有未提交修改；需要隔離時從已確認的遠端版本建立 worktree。
2. **短計畫後實作**：只讀影響範圍、依賴入口及必要規則；已有證據以路徑與摘要引用。先交付一個端到端可驗收單位，再擴充。一般可逆細節採既有專案慣例並記錄假設；權限、業務語意或不可逆操作缺資料時才停下確認。
3. **每次只推進一個工作單位**：每個 unit 對應 completionCriteria 與實際 testRefs；包含正常、錯誤、邊界及回歸情境。新增 UI 行為需瀏覽器操作證據，不能以 build 成功代替。
4. **授權內修復**：已授權實作／修復的紅燈進 REPAIR；相同失敗兩次無新證據轉 REASSESS。只有權限、安全、外部憑證、環境無法恢復、使用者 pause/cancel 或明確資源邊界才保存未完成狀態並停止。唯讀審核保持唯讀。
5. **依序自我覆核**：同一 Agent 重新讀取最新 diff，依需求、實作、測試與風險角度挑戰結果。這是 sequential self-review，不是獨立 reviewer；有獨立覆核要求時照實標記缺口。只有使用者另行授權才使用其他 Agent；本 profile 的 agentPolicy 固定 single。
6. **保留 checkpoint**：沿用既有 workflow ledger 的 criticalRelay 欄位。沒有 ledger 時，經授權用 `.cr/state.json` 與 `.cr/handoff.md` 保存，不額外建立第二套排程。每個里程碑更新目前版本、驗證輸出、錯誤 fingerprint、已排除假設及唯一 nextAction；恢復時先核對 Git，版本改變則重驗。
7. **依實際介面選推理強度**：需求／根因／最後覆核以較高強度為候選；定位、已決定的修改及收集測試輸出沿用目前設定。只有 adapter 明確支援且取得授權才改設定；記錄 requested 與 actual，未確認填 null。提示詞與 workflow metadata 都不是模型切換證據。保持目前模型，使用單一流程。

執行契約 helper：`scripts/critical-relay/execution-contract.js`。

```javascript
const { createExecutionContract } = require('./scripts/critical-relay/execution-contract');
// baseSha 來自 git rev-parse；完成條件 ID 來自本次 CR state。
const executionContract = createExecutionContract({
  baseSha,
  scope: ['src/'],
  workUnits: [{ id: 'unit-1', criterionRefs: ['criterion-1'] }]
});
```

`createCriticalRelay({ mode: 'FULL_AUTOMATIC_RELAY', executionContract, ... })` 會啟用交付閘門。`source` 記錄 baseSha、headSha、changeDigest；`verification` 與每筆 unit 引用的 test 都必須對應相同 headSha／changeDigest。測試需記錄 command、exitCode=0、outputRef。changeDigest 是受驗收變更內容的 SHA-256，涵蓋新增檔；證據檔與自身 state 的排除範圍必須寫入任務紀錄，避免自我雜湊循環。

每個 criterion 都必須被 unit 覆蓋；所有 unit passed、failure resolved 且保留修復證據，原 CR gate 也通過後才可交付。`buildHandoffSnapshot` 會保留契約並納入 digest。舊 general state 維持相容；完整交付模式缺少契約即 fail closed。

契約驗證的是提交的證據與版本關聯，不會自行執行測試、驗證遠端內容、切換模型或限制作業系統權限。執行者仍須核對實際 Git、工具 exit code 與原始輸出。不得用填寫 passed 代替執行。

## 推送與完成

本次已授權的 push 在所有必要檢查通過後直接執行，無須對同一授權重複詢問。推送前重查遠端 SHA；遠端前進時整合並重驗，使用 fast-forward 保護而非 force push。Release、Deploy、DB 寫入與子 Agent 權限分開判斷。沒有 push 授權時只交付本機變更及 handoff。

推送成功、CI 通過、實際產品功能驗證與模型 A/B 效能比較是不同結果，逐項回報；目前沒有測量的項目保持未驗證。

## 與其他能力的關係

- **Deep Research**：Critical Relay 增加反證搜尋與 claim 級證據帳本。
- **Verify Loop**：Critical Relay 把「驗證成功」後再加一輪 RECHALLENGE。
- **完整自動接力**：Critical Relay 成為完成條件的一部分；尚有 blocker 時不得回報 🟢 全部完成。
- **Workflow handoff**：CR-enabled task 設 `criticalRelayRequired=true` 並攜帶結構化 `criticalRelay` state；handoff 必須有 state，complete 會重新執行 completion gate，不信任舊 evaluation。仍沿用原本 workflow ledger，不新增另一套 durable store。
