---
name: critical-relay
description: 以「先做，再懷疑；主動推翻，推不翻才往下一棒接力」執行對抗搜尋、反證、交叉驗證與完整自動接力。觸發詞：對抗搜尋、懷疑每個論點、反證、反例、交叉驗證、批判搜尋、Critical Relay、開 CR、建立正式 CR、CR 完整自動接力、CR 輕量、輕量 CR、CR 深度、深度 CR。依風險分輕量／標準／深度三級，輕量級不建帳本。
origin: Pixiu
version: 0.6.0-claude.1
language: zh-TW
---

# Critical Relay

> **路徑基準**：本 Skill 提到的 `scripts/`、`vault/`、`commands/`、`.agent/` 相對路徑都以母體根目錄為基準。不在母體目錄內執行時（例如在 PCLMS 專案開 Claude Code），先解析母體路徑（`PIXIU_CORE` → `PIXIU_CORE_PATH` → `%USERPROFILE%\.pixiu-core`），再以絕對路徑呼叫，例如 PowerShell：`node "$env:PIXIU_CORE\scripts\critical-relay\critical-relay.js" check <state.json>`。

Critical Relay 是 PixiuCore 的批判推理接力層。它不取代 Deep Research、程式實作或 Verify Loop；它替這些能力增加一個共同的「可被推翻」流程與完成閘門。

## 快速觸發

- `CR 完整自動接力`：同時啟用 Critical Relay 與完整自動接力。實作任務採 `mode=FULL_AUTOMATIC_RELAY`、`executionContractRequired=true` 與下列交付契約；研究型任務保留既有 general 模式。
- `開CR`／`開 CR`／`建立正式CR`／`建立正式 CR`：建立或續接 CR 案件，依下方「案件與帳本」處理，英文不分大小寫。
- 不使用裸 `CR` 作全域關鍵字，避免短字串誤觸其他英文內容。

## 核心原則

> 先做，再懷疑；主動嘗試推翻，推不翻才往下一棒接力。

每個重要結論先拆成可驗證主張，再蒐集支持證據與反證。不能只找支持原本想法的資料。

## 啟動方式

Critical Relay 可以單獨形成一個模式，也可以疊加在完整自動接力上：

- 單獨模式：`開 Critical Relay`、`用對抗搜尋模式`、`懷疑每個論點並找反證`。
- 疊加模式：`對抗搜尋，開完整自動接力`。Router 會同時載入 `critical-reasoning` 與 `execution-progress`。
- 單獨模式只增加懷疑、反證、交叉驗證與 completion gate；不會自動啟用 Git／Release／Deploy 或 Agent 權限。

## 分級：先選深度再開始

開 CR 後第一步先選級別，並用一行告訴使用者選了哪級、為什麼。使用者指定「CR 輕量」「CR 深度」時照指定；沒指定時依下表自動判斷，拿不準就選高一級。

| 級別 | 什麼時候用 | 帳本 | 反證與覆核 | 完成判定 |
| --- | --- | --- | --- | --- |
| 輕量 | 可逆、範圍小的分析或修改；只讀查詢；文件與說明 | 不建 `.cr/`，主張、證據、反證直接寫在回覆或任務清單 | 每個核心主張至少一次實際反向查找（grep、git 歷史、測試或來源）；驗證後再挑戰一次 | 逐條列「主張 → 證據 → 反證結果」；標明「輕量 CR，未跑完成閘門」 |
| 標準 | 一般程式修改、跨檔或跨層的變更、會影響其他人的結論 | `.cr/state.json` 與 `.cr/handoff.md` | 至少比較兩個方案；每個 supported 主張都有 challenge 紀錄 | `critical-relay.js check` exit 0 |
| 深度 | Production、DB 寫入或 DDL、SP 參數變更、資安、資損、事故根因、不可逆操作、結論會影響決策的研究 | 同標準，並依 `vault/governance/cr-risk-review.md` 完整做風險盤點 | 核心主張用兩個不同來源位置交叉查核；額外做反例測試；完成前建議請 Codex 或使用者本人做獨立審查 | 完成閘門通過；沒有獨立審查時標「僅同模型自我覆核」 |

升降級規則：

- 過程中碰到深度級的條件（例如發現要改 DB、找到 high／critical 反證），立刻升級並補上該級要求，不等做完再補。
- 只有使用者明說才降級；已記錄的證據與反證不刪。
- 「CR 完整自動接力」與實作類 CR 至少是標準級，因為交付契約需要 `.cr/` 帳本與完成閘門。
- 下方「標準流程」與「Completion Gate」完整適用於標準與深度級；輕量級照同樣的十個階段思考，但不填 state。
- 三級都保留核心原則：先做、再懷疑、實際找反證、驗證後再挑戰；差別只在記錄方式與檢查強度。

## 案件與帳本

本版沒有 Dev 選項：直接在本機推進，不詢問、不等待 Dev，也不讀 `vault/governance/cr-chat-dev-policy.md`。

- 標準與深度級的案件帳本用目前 repo 的 `.cr/state.json` 與 `.cr/handoff.md`（`.cr/` 不進版控）。新案件以 `relay-evidence.js init`（實作）或 `init-lifecycle`（研究／設計／開發全流程）建立；已有 `.cr/` 時先讀取並續接，不重建、不清除失敗紀錄。
- 進度用任務清單呈現：每個 completionCriterion 一個項目，VERIFY → RECHALLENGE 也各一項。
- 使用者明確要求同步到 Hermes 或其他 workflow 帳本時，才依該系統的授權與 `criticalRelayRequired=true` 契約處理。
- 啟動、帳本建立與完成閘門分別回報；建立案件不要求先通過完成閘門。
- 案件卡、跨輪續接、主張與多輪驗收依 [references/case-and-review.md](references/case-and-review.md)。

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
- COUNTERSEARCH 要實際執行：網路來源用網頁搜尋與讀取原文，程式與資料用 Grep、git 歷史、測試或唯讀查詢；記錄查詢詞或指令、FOUND／NOT_FOUND 與結果位置。沒實際執行的只能寫成查詢計畫。
- 重要資料優先級：官方／原始資料／論文原文 > 高品質二手分析 > 社群討論。
- 單一來源只能形成暫定 evidence；核心結論要做交叉驗證。
- 時效性主張要記錄資料時間範圍。
- 找不到反證，不等於主張為真；只能表示本輪未找到足夠反證。
- evidence 與 counterEvidence 都要保留，不刪掉不利資料。

## Canonical State

交接給下一個 session、其他 AI 或 GitHub 時，保留下列欄位：

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

handoff 使用 `buildHandoffSnapshot(state)` 建立獨立快照，附 `stateDigest`；接手時用 `verifyHandoffSnapshot(snapshot)` 重新驗證 digest 與 completion gate。

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
- remainingRisk 等級／狀態無效、尚未評估，或 accepted／mitigated／resolved 缺少負責人、處置證據、使用者接受依據及當次版本／環境綁定。
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

## CR 全流程：研究／設計／開發／驗證

使用者明確要求 CR 研究、CR 搜尋、CR 設計、CR 開發或 CR 全流程時，Router 額外載入 `skills/critical-relay/references/lifecycle.md` 和 `.agent/workflows/cr-lifecycle.md`。研究查可追溯原始來源、反向搜尋與反證；設計比較取捨；開發執行反例；驗證仍依真實測試與 VERIFY → RECHALLENGE 判斷。

Lifecycle 決策事件沿用 canonical Critical Relay state，不另建第二份任務帳本。新建完整交付可使用 `relay-evidence.js init-lifecycle`；既有任務不強迫遷移。Lifecycle 每輪決策及反證只代表已記錄之查核，不是網路搜尋、UI/API 實測、額外 Agent 或自動取得 Push/Release/Deploy 權限。

## v2 本機證據驗證

新實作任務使用 `scripts/critical-relay/relay-evidence.js` 的 `createEvidenceState` 或 `init`，建立 `pixiu.cr-execution.v2`、固定 `verificationBinding` 與必要測試計劃。公共核心統一執行 `node scripts/critical-relay/test-runner.js`，再回填真實 run；完成仍需重新讀 diff、處理反證並進 RECHALLENGE。

CLI check 與 workflow complete 都回讀原始事件、統計、檔案及實際來源。完整交付缺 binding／run、零筆、過期證據或模式降級時阻擋；舊 general 紀錄保留結構相容，舊 v1 實作任務要明確遷移與重驗。下方 v1 helper 範例僅供歷史結構相容，不是新實作任務入口。

操作、信任邊界、CI 與部署限制詳見 `scripts/critical-relay/README.md`。可用 adapter 與條件見 `scripts/critical-relay/adapter-guide.md`，包含 `node-test`、`junit-command`、`playwright-command`、`build-command` 與 `http-json`；必要測試仍須有對應實測證據。雜湊不代表獨立或不可偽造的驗證。

## 單一 Agent 交付契約

目的：減少反覆讀檔、重做規劃與無效重試；以實際驗收衡量效果，不宣稱複製其他模型的訓練或保證效能提升。

1. **先建立 Task Contract**：記錄原始需求、Git repo／branch／完整 baseSha、允許修改範圍、驗收條件與本次授權。保留既有未提交修改；需要隔離時從已確認的遠端版本建立 worktree。
2. **短計畫後實作**：只讀影響範圍、依賴入口及必要規則；已有證據以路徑與摘要引用。先交付一個端到端可驗收單位，再擴充。一般可逆細節採既有專案慣例並記錄假設；權限、業務語意或不可逆操作缺資料時才停下確認。
3. **每次只推進一個工作單位**：每個 unit 對應 completionCriteria 與實際 testRefs；包含正常、錯誤、邊界及回歸情境。新增 UI 行為需瀏覽器操作證據，不能以 build 成功代替。
4. **授權內修復**：已授權實作／修復的紅燈進 REPAIR；相同失敗兩次無新證據轉 REASSESS。只有權限、安全、外部憑證、環境無法恢復、使用者 pause/cancel 或明確資源邊界才保存未完成狀態並停止。唯讀審核保持唯讀。
5. **依序自我覆核**：同一 Agent 重新讀取最新 diff，依需求、實作、測試與風險角度挑戰結果。這是 sequential self-review，不是獨立 reviewer；有獨立覆核要求時照實標記缺口。只有使用者另行授權才使用其他 Agent；本 profile 的 agentPolicy 固定 single。
6. **保留 checkpoint**：用 `.cr/state.json` 與 `.cr/handoff.md` 保存，不額外建立第二套排程。每個里程碑更新目前版本、驗證輸出、錯誤 fingerprint、已排除假設及唯一 nextAction；恢復時先核對 Git，版本改變則重驗。
7. **推理深度由使用者決定**：需求釐清、根因與最後覆核需要更深推理時，向使用者說明理由並由使用者調整，不自行切換模型或推理設定。

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
- **Workflow handoff**（使用 Hermes 等 workflow 時）：CR-enabled task 設 `criticalRelayRequired=true` 並攜帶結構化 `criticalRelay` state；handoff 必須有 state，complete 會重新執行 completion gate，不信任舊 evaluation。仍沿用原本 workflow ledger，不新增另一套 durable store。

## 風險與分析品質

標準與深度級啟動時讀取 `vault/governance/cr-risk-review.md`（深度級完整盤點）；輕量級只在出現風險條件時讀取並升級。使用「CR 風險盤點」或「CR 風險審查」可明確要求此覆核。每項需求連結主張與驗收證據，依原始來源分組核對獨立性，記錄競爭解釋、敏感條件與決策重開條件。盤點未知項及剩餘風險；程式強制風險處置證據與版本綁定，人工核對真實授權、來源品質與盤點完整性。新 run、環境或來源改變後重新驗證。
