---
name: requirement-confirmation
description: "Use when SA/PM gives an ambiguous verbal requirement, adds a follow-up adjustment, or the user records their own natural-language understanding. Turn it into a versioned reviewable requirement-confirmation package: preserve original requirement snapshots and Requirement Deltas, separate interpretation from fact, trace existing code for modifications or propose evidence-backed new scope, list ambiguities and acceptance criteria, default to Markdown without UI or DOCX with UI, and provide factual SA/PM review fields. Trigger for 需求確認、需求釐清、口頭需求、我理解的需求、追加需求、追加調整、需求補充、需求變更、SA/PM需求覆核、需求確認文件。"
version: 1.1.0
origin: Pixiu
---

# Requirement Confirmation｜需求確認與覆核

把「SA／PM 先用口語描述需求，但內容不夠精確；工程師先把自己理解的需求寫下來，再請 SA／PM 確認」標準化成可追溯流程。

本 Skill 用在**開發前**。它不替 SA／PM 定義需求，也不把工程師的理解冒充正式規格；它要產出一份可以被 SA／PM 明確說「對／不對／哪裡要改」的需求確認文件。

流程定位：

`SA/PM 口語需求 -> 使用者自然語言理解 -> requirement-confirmation -> SA/PM 覆核 -> 開發 -> change-review-evidence -> 併版/變更覆核`

若需要既有系統文件、忠實 UI、DOCX 產出與 Render QA，同時使用 `system-documentation`；若是 Legacy Java / Struts / Spring / DAO / SQL / Procedure 流程，按需使用 `legacy-java-flow-tracing`。

---

## Core Contract

1. **Interpretation is not approval**：使用者輸入的是 `User Interpretation / 待確認需求`。除非有 SA／PM 實際覆核證據，不得寫成 `Approved Requirement`。
2. **Preserve the user's meaning**：先保留使用者原本自然語言的核心意思，再做結構化；不能為了文件好看而改變需求語意。
3. **Facts and proposals stay separate**：現行程式、畫面、DB、API 等可驗證內容標 `Confirmed As-Is`；使用者理解標 `Requested To-Be`；由程式結構推導的實作範圍標 `Proposed Scope`；無法確認內容標 `Open Question / Pending`。
4. **Ambiguity becomes review material**：口語需求不清楚時，不自行補完，也不因不清楚就停止文件產出；把歧義、假設、缺口轉成 SA／PM 可逐項回答的問題。
5. **Modification requires source-backed tracing**：若需求是修改既有功能，必須找到 active entrypoint 與實際呼叫鏈，不能只憑 class/file 名稱猜修改範圍。
6. **New feature scope is proposed, not factual**：若需求是新增功能，依現有架構與相鄰功能 pattern 提出建議新增範圍；沒有證據支持的 file/module/table/API 不得寫成「一定要新增」。
7. **Cross-layer impact must be visible**：UI、Controller/Action、Service、DAO/SQL、Procedure、Table、API、Config、Batch、Report、Deployment 等有相依時都要列出。
8. **UI scope defaults to DOCX**：整個需求範圍含 UI／操作畫面時預設輸出 DOCX；完全沒有 UI 時預設輸出 Markdown。使用者明確指定格式時，以使用者指定為優先。
9. **Pre-development UI is not After runtime evidence**：開發前只能放 `As-Is 現況畫面` 與 `To-Be 預期調整／標註／需求示意`；不得把尚未實作的 To-Be 畫面稱為「改後實際畫面」。
10. **Review is factual only**：SA／PM Reviewer、日期、結果、意見不得猜測。預設 `Pending`；文件內容變更後，既有 review 必須判斷是否 `Review Stale`。
11. **Requirement history is append-only**：SA／PM 後續追加、修改或撤回需求時，不覆蓋原需求快照；以新的 Requirement Revision + Requirement Delta 保存「原本確認什麼、後來改了什麼」。
12. **Delta review is impact-scoped**：追加需求必須重新計算 Program Scope、Cross-layer dependency、Acceptance Criteria、Test Scope 與 Risk。只讓受 Delta 影響的舊 review 失效；能以 Requirement ID / Review Scope 證明未受影響的覆核可保留。

---

## Stage 0 — Capture the User Interpretation

先把使用者自然語言整理成「需求理解原稿」，不要一開始就跳到程式設計。

至少建立：

```text
Requirement ID：<ticket / change id / N/A>
Source：SA / PM / meeting / chat / oral discussion / user notes
User Interpretation：<使用者自己理解的需求，以接近原意的自然語言保存>
Captured At：<時間>
Status：INTERPRETATION_DRAFT
```

### Normalized Requirement Summary

再將自然語言拆成：

| 欄位 | 內容 |
|---|---|
| Background | 為什麼要改／新增 |
| Actor | 誰會使用或觸發 |
| Trigger | 什麼情況開始 |
| Input | 會輸入／接收什麼 |
| Expected Behavior | 預期系統怎麼做 |
| Output / Result | 使用者或外部系統最後看到什麼 |
| Business Rule | 已明確說出的規則 |
| Exception | 已明確說出的例外 |
| Data / Integration | 涉及哪些資料或外部介接 |
| UI | 是否有畫面／操作流程 |

沒有講到的欄位寫 `Not specified`，不要自行補規則。

### Requirement Revision Baseline

每份需求確認文件都要有可追溯版本。第一版通常記為 `R1`（顯示名稱可用 `V1.0`）；後續追加／修改不得直接覆寫，而是建立新的 revision，例如 `R2 / V1.1`。

至少保留：

| 欄位 | 內容 |
|---|---|
| Requirement Revision | `R1 / V1.0`、`R2 / V1.1` 等 |
| Previous Revision | 前一版；首版為 `N/A` |
| Revision Reason | Initial / Added Requirement / Changed Requirement / Removed Requirement / Clarification |
| Source | SA / PM / meeting / chat / oral discussion |
| Captured At | 本版需求被記錄的時間 |
| Review Baseline | 此 revision 要覆核的 Requirement IDs / Scope |

版本號只是顯示；真正的追溯依據是 **Requirement ID + revision + 文件內容／來源 evidence**，不得只靠檔名判斷是否為同一版。

---

## Stage 0B — Requirement Delta（追加／變更需求）

若使用者表示「剛剛又補充」「另外還要調整」「再追加一個」「前面那個要改成」等語意，先把它當成 **Requirement Delta**，不要重新生成一份看不出歷史的新需求。

### 先固定上一版

至少取得或重建：

- Previous Requirement Revision。
- 上一版 Requirement Summary / Requirement IDs。
- 上一版 Confirmed / Pending review scope。
- 上一版 Existing / Proposed Scope。
- 上一版 Acceptance Criteria / Test Scope。

找不到上一版證據時，仍可建立 Delta 草稿，但標 `Previous Baseline：Needs verification`，不得宣稱已精確比對。

### Delta Classification

每一項追加內容至少分類為：

- `ADD`：新增原本沒有的 Requirement。
- `CHANGE`：修改既有 Requirement 的條件、範圍、行為或驗收。
- `REMOVE`：明確取消既有 Requirement。
- `CLARIFY`：只釐清原意，且沒有改變預期行為／Scope；仍需記錄來源。

### Requirement Delta Ledger

| Delta ID | Type | Source / Raw Add-on | Previous Requirement | New Understanding | Requirement IDs | Scope Impact | Review Impact | Status |
|---|---|---|---|---|---|---|---|---|
| RD01 | ADD | `<PM 剛補充內容>` | N/A | `<使用者目前理解>` | RQ-03 | Report/Batch | PM+SA review required | Pending |

追加需求不能只記「PM 又說要改 X」；必須明確回答：

1. **原需求哪一條仍維持不變？**
2. **本次新增／修改／刪除哪一條？**
3. **是否改變原本 In Scope / Out of Scope / Pending Scope？**
4. **是否新增 UI / Program / DB / Procedure / API / Config / Batch / Report 範圍？**
5. **哪些 Acceptance Criteria 要新增或改寫？**
6. **哪些 Test Scope / regression 要新增？**
7. **哪些 SA／PM 舊覆核因受影響而變成 `Review Stale`？**

### Delta Impact Matrix

| Impact Type | Previous | Delta | New Baseline | Evidence | Status |
|---|---|---|---|---|---|
| Program Scope | `<before>` | `<added/changed>` | `<after>` | code trace | Confirmed / Proposed / Pending |
| DB / Procedure | `<before>` | `<added/changed>` | `<after>` | schema/trace | Confirmed / Proposed / Pending |
| UI | `<before>` | `<added/changed>` | `<after>` | UI trace | UI_SCOPED / NON_UI / Pending |
| Acceptance Criteria | `<before>` | `<added/changed>` | `<after>` | requirement | Ready / Pending |
| Test Scope | `<before>` | `<added/changed>` | `<after>` | impact trace | Ready / Pending |
| Review | `<previous review>` | `<affected IDs>` | `<new review state>` | review mapping | Valid / Review Stale |

**Review Stale 不等於否定舊 reviewer。** 它只表示 reviewer 當時確認的是舊 revision，而本次 Delta 已改變其覆核範圍。

若 Delta 發生在開發中：先更新 Requirement Confirmation 到新 revision，標出受影響實作範圍並完成必要覆核，再以新 revision 作後續實作與 `change-review-evidence` 的需求基準。

---

## Stage 1 — Classify the Requirement

先判斷需求屬於：

- `MODIFY_EXISTING`：修改既有功能。
- `ADD_NEW`：新增功能／流程／介接。
- `MIXED`：既有功能修改 + 新增範圍。
- `UNKNOWN`：資料不足以分類；仍可產出需求確認草稿。

同時判斷 UI scope：

- `UI_SCOPED`：需求範圍包含任何使用者操作畫面。
- `NON_UI`：整個需求範圍都是後端、DB、Batch、API、報表後台處理等，沒有操作畫面。
- `UI_UNKNOWN`：目前無法確認，文件標 Pending。

---

## Stage 2 — Ambiguity Ledger

口語需求最重要的不是把句子修順，而是把「現在其實還不知道什麼」列出來。

### 四類資訊

| Type | 定義 | 文件標記 |
|---|---|---|
| Explicit | SA/PM 或使用者明確說出的要求 | `Explicit Requirement` |
| Interpretation | 使用者根據口語內容理解出的意思 | `User Interpretation` |
| Derived | 從現行程式／架構可確定推導 | `Derived from As-Is` |
| Unknown | 沒有證據可以確認 | `Open Question` |

### Ambiguity / Assumption / Open Question

| ID | Topic | Current Understanding | Why Unclear | Impact if Wrong | Need Review From | Status |
|---|---|---|---|---|---|---|
| Q01 | `<topic>` | `<目前理解>` | `<哪句話有歧義>` | `<可能改錯哪裡>` | SA / PM | Pending |

常見必查問題：

- 「全部」「特定」「某些」到底是哪個範圍？
- 新規則只影響新資料，還是歷史資料也要處理？
- 失敗時要阻擋、警告、略過還是重試？
- 權限／角色是否有差異？
- 狀態轉換、日期、金額、代碼等邊界條件是否明確？
- DB / Procedure / API contract 是否同步變更？
- 是否需要 migration / rollback？
- 是否需要回歸既有流程？

**不要用猜測填答案；把問題留給 reviewer。**

---

## Stage 3 — Existing Function Trace（MODIFY_EXISTING / MIXED）

若是修改既有功能，先證明「現在到底是哪段程式在做這件事」。

### Evidence Chain

依專案技術棧追 active path：

`UI / Menu / Route / Job / API`
`-> Action / Controller / Handler`
`-> Service / Use Case`
`-> DAO / Mapper / SQL / Procedure`
`-> Table / History / Trigger / External API / File / Report`
`-> Observable Result`

不得只找到一個相似檔名就說「要改這支」。

### Confirmed Existing Scope

| ID | File / Artifact | Layer | Current Responsibility | Evidence | Confidence | Requirement Relevance |
|---|---|---|---|---|---|---|
| E01 | `<path>` | Service | `<目前責任>` | `<route/caller/test/runtime>` | High | Direct |

分類：

- `Direct Change Candidate`：需求直接命中。
- `Dependency Candidate`：caller/callee/schema/config 等相依。
- `Regression Only`：不一定修改，但必須回歸。
- `Not In Scope`：已確認不受影響，寫理由。

### Cross-Layer Contract Check

若現有程式有以下 contract，必須一起列：

- Procedure / Function / Package parameters
- SQL field / type / nullability
- Table / Trigger / history behavior
- API request / response
- Message / file format
- Config / environment key
- Batch / scheduler
- Report field binding

此階段只是在確認**需求可能影響的契約**，不是宣告一定要修改；真正修改內容等開發後由 `change-review-evidence` 驗證。

---

## Stage 4 — Proposed New Scope（ADD_NEW / MIXED）

新增功能通常還沒有對應程式，因此不能硬找一隻不存在的程式。

先找：

1. 最接近的既有功能／模組。
2. 專案現有 package / module / folder pattern。
3. 既有 route / controller / service / DAO / API / DB 慣例。
4. 共用元件與可重用能力。
5. 新功能合理的 insertion point。

再產生：

### Proposed Implementation Scope

| ID | Proposed Artifact / Area | Type | Why Needed | Evidence / Existing Pattern | Confidence | Status |
|---|---|---|---|---|---|---|
| P01 | `<module/path or responsibility>` | New / Modify | `<原因>` | `<相鄰功能/架構證據>` | Medium | Proposed |

`Type` 可包含：

- New UI / page / component
- New route / Action / Controller
- New Service / Use Case
- New DAO / SQL / Procedure
- New Table / Column / migration
- New API / message contract
- Config
- Batch / job
- Test / fixture
- Deployment artifact

### Proposal Discipline

- 能確認檔名／class 名時才寫精確名稱。
- 只能確認責任範圍時，寫「建議新增 `<responsibility>`」，不要虛構 class 名。
- 架構選擇若有 2–3 個合理方案，列方案與代價，標記 `Decision Required`。
- 尚未經 SA/PM 同意的 technical proposal 不算 requirement approval。

---

## Stage 5 — As-Is / To-Be Requirement Map

把 SA／PM 最容易確認的內容放在一起。

| Requirement ID | As-Is | User-understood To-Be | Program / Scope Mapping | Open Question | Review Status |
|---|---|---|---|---|---|
| R01 | `<現在>` | `<我理解要改成>` | `<E/P ids>` | `<Q ids>` | Pending |

### Scope / Out of Scope

一定要分開：

```text
In Scope
- <本次確定／暫定要處理的內容>

Out of Scope
- <已明確不處理的內容>

Pending Scope
- <需要 SA/PM 回覆後才能決定是否納入>
```

這三類不能混在同一張「影響範圍」表裡。

---

## Stage 6 — UI Scope and Output Format

### NON_UI

預設輸出：**Markdown (`.md`)**。

內容仍需包含完整 Requirement / Scope / Code Trace / Review Record。

### UI_SCOPED

預設輸出：**DOCX**，並使用 `system-documentation` 的 DOCX production workflow 與 Render QA。

開發前畫面證據固定分為：

1. `As-Is Current Screen`：實際現況截圖、Runtime render，或依現有程式忠實還原。
2. `To-Be Requirement Annotation`：在現況畫面上標出「預期新增／刪除／調整」的位置與需求文字；或使用明確標示的 `To-Be Requirement Mockup`。

### Critical UI Label Rule

開發尚未完成前，禁止使用：

- `After Screenshot`
- `改後實際畫面`
- `新系統實際畫面`

除非該版本真的已實作並可 Runtime 驗證。

允許使用：

- `To-Be 預期畫面`
- `需求標註圖`
- `To-Be Requirement Mockup — 尚未實作`

若 UI 需求只改後端行為、畫面外觀預期不變，DOCX 仍放現況畫面並註明：

`預期視覺無差異；本需求調整畫面背後行為／資料處理。`

---

## Stage 7 — Acceptance Criteria and Test Scope

把口語需求轉成可驗收條件，但不能替 SA/PM 發明業務規則。

### Acceptance Criteria

優先使用：

```text
Given <已知前置條件>
When <使用者/系統動作>
Then <可觀察結果>
Evidence <畫面 / DB / Log / API / File / Report>
```

若 Then 無法從需求確認，寫：

`Then：Pending — 需 SA/PM 確認預期結果。`

### Test Scope

至少列：

- 正向主流程
- 負向／錯誤流程（需求有定義時）
- 邊界值（需求有定義或現行規則可證明時）
- 回歸既有功能
- DB / Procedure / API contract
- UI behavior（適用時）
- 權限／角色（適用時）

此處是「建議受測範圍」，不是測試已通過證據。

---

## Stage 8 — Requirement Risk

至少檢查：

| Risk | Why It Matters | Evidence | Mitigation / Question | Status |
|---|---|---|---|---|
| Scope ambiguity | 可能改錯模組 | user notes | Q01 | Pending |
| Contract mismatch | App/Procedure 不一致 | code/schema | SA/DBA review | Pending |
| Historical data | 新規則可能影響舊資料 | requirement gap | PM decision | Pending |

需求文件的 Risk 重點是「如果我們現在理解錯，會造成什麼開發／資料／部署後果」。

---

## Stage 9 — SA / PM Review Record

預設兩列，必要時追加 QA / DBA / Ops。

| Role | Reviewer | Review Scope | Result | Reviewed At | Comments / Corrections | Evidence |
|---|---|---|---|---|---|---|
| SA |  | Technical scope / system behavior / dependency | Pending |  |  |  |
| PM |  | Business intent / business rule / scope / acceptance | Pending |  |  |  |

建議結果：

- `Pending`
- `Confirmed — Requirement Understanding Correct`
- `Confirmed with Corrections`
- `Changes Required`
- `Rejected`

### Review Integrity

- reviewer 名稱、時間、結果不得猜。
- 口頭「差不多」「應該可以」不自動轉成 Confirmed。
- SA 確認技術範圍不代表 PM 已確認業務規則，反之亦然。
- reviewer 修正內容要回寫 Requirement Map / Scope / Open Questions，而不是只留在 comment。
- 需求文字、Scope、Acceptance Criteria 或 Proposed Scope 有實質變更時，受影響的舊 review 標 `Review Stale`，重新覆核。
- Requirement Delta 必須以 Requirement ID / Review Scope 對照哪些 review 受影響；不得因追加一個完全無關項目就把所有既有覆核一律作廢。
- reviewer 對舊 revision 的原始覆核紀錄保留，只在新 revision 上標示 Valid / Review Stale，不覆寫歷史。

---

## Stage 10 — Review Gate

文件最後產生：

```text
[ ] 使用者自然語言需求理解已保存
[ ] Requirement Revision / Previous Revision 已記錄
[ ] 若為追加／變更需求，Requirement Delta Ledger 已完成
[ ] Delta 對 Program / DB / UI / Acceptance / Test / Review 的影響已重算
[ ] Explicit / Interpretation / Derived / Unknown 已分開
[ ] MODIFY_EXISTING 已完成 active-path trace（適用時）
[ ] ADD_NEW 已建立 evidence-backed Proposed Scope（適用時）
[ ] Cross-layer dependency 已盤點
[ ] In Scope / Out of Scope / Pending Scope 已分開
[ ] UI scope 已判斷
[ ] UI scope 有 As-Is + To-Be Requirement Annotation（適用時）
[ ] Acceptance Criteria 已寫到可測；未知部分標 Pending
[ ] Test Scope 已列
[ ] Open Questions 已列出 reviewer
[ ] SA Review 已記錄
[ ] PM Review 已記錄
```

### Document Status

- `INTERPRETATION_DRAFT`：剛整理完成，尚未具備完整 scope evidence。
- `READY_FOR_REQUIREMENT_REVIEW`：程式／範圍與 open questions 已整理，可交 SA/PM。
- `CHANGES_REQUIRED`：reviewer 指出理解或範圍需要修正。
- `CONFIRMED_REQUIREMENT`：必要 SA/PM 均已明確確認且有 evidence。
- `BLOCKED`：連目標系統／功能入口都無法辨識，或存在不能合理產生 scope 的硬缺口。

只有實際 review evidence 存在時才能標 `CONFIRMED_REQUIREMENT`。

---

## Standard Deliverable

### 無 UI：Markdown

```text
1. 文件資訊 / Requirement ID / Revision / Source
2. Revision History / Requirement Delta（若有追加／變更）
3. 使用者需求理解原稿
4. Structured Requirement Summary
5. Ambiguity / Assumption / Open Questions
6. As-Is 現況（若為修改）
7. Existing Code Trace / Proposed New Scope
8. In Scope / Out of Scope / Pending Scope
9. To-Be Requirement Map
10. Program / DB / API / Config / Batch Impact
11. Acceptance Criteria
12. Suggested Test Scope
13. Risk
14. SA / PM Review Record
15. Requirement Review Gate
```

### 有 UI：DOCX

沿用上述章節，另外加入：

```text
- As-Is 現況畫面
- To-Be 需求標註圖／需求示意（尚未實作）
- 欄位／按鈕／狀態／權限差異表
```

DOCX 必須依 `system-documentation` 執行 Evidence / Fidelity / Render / Redaction QA。

---

## Handoff to Implementation and Change Review

需求確認完成後：

1. `CONFIRMED_REQUIREMENT` 文件成為開發需求基準。
2. 開發實作時，Requirement ID / document version 應保留，避免 Scope 漂移。
3. 開發完成後啟用 `change-review-evidence`：比較實際 Base / Target，確認「實際改動」是否符合這份已確認需求。
4. 若實作中需求又改，先建立下一個 Requirement Revision + Requirement Delta，重新計算受影響 Scope / Acceptance / Test / Review，完成必要覆核後，再更新 Change Review。

需求確認文件回答：**「我們準備做什麼、為什麼、預計動哪裡？」**

變更覆核文件回答：**「我們最後實際改了什麼、是否符合需求、能不能進下一個變更流程？」**

---

## Anti-Patterns

以下視為不合格：

- SA/PM 口頭講一句，就直接寫成正式核准需求。
- 使用者說「我理解是這樣」，文件卻拿掉「理解／待確認」標記。
- MODIFY_EXISTING 只搜尋 class 名，沒確認 active route/caller。
- ADD_NEW 沒有現有架構證據就發明 class/table/API 名稱。
- 遇到模糊需求直接自行選一個合理答案，不列 Open Question。
- UI 尚未開發就放一張 mockup 並叫「改後實際畫面」。
- SA 只看技術、PM 只看業務，卻把其中一人的確認當成全部核准。
- reviewer 確認後需求內容又改，仍沿用舊 Confirmed。
- SA／PM 追加一句需求時直接改掉原文件，導致看不出上一版曾確認什麼。
- 新增一個局部 Delta 就把所有無關 requirement 的 review 全部標 Stale，沒有做 impact mapping。
- Acceptance Criteria 寫「功能正常」「符合需求」這種不可測敘述。

---

## Delivery Report

```text
Requirement Confirmation：<INTERPRETATION_DRAFT / READY_FOR_REQUIREMENT_REVIEW / CHANGES_REQUIRED / CONFIRMED_REQUIREMENT / BLOCKED>
Revision：<R1/V1.0 -> R2/V1.1；無 Delta 則 current revision>
Requirement Delta：<None / ADD / CHANGE / REMOVE / CLARIFY；可複數>
Type：<MODIFY_EXISTING / ADD_NEW / MIXED / UNKNOWN>
UI：<UI_SCOPED / NON_UI / UI_UNKNOWN>
Output：<DOCX if UI / MD if no UI / user-specified>
Existing Scope：<Confirmed / Partial / N/A>
Proposed Scope：<Prepared / Pending / N/A>
Open Questions：<count>
Acceptance Criteria：<Ready / Partial / Pending>
SA：<Pending / Confirmed / ...>
PM：<Pending / Confirmed / ...>
Next：<send for review / revise / implementation>
```
