---
name: repair-review-sheet
description: "Use when an incident, defect, outage, abnormal behavior, or repair ticket must be investigated and reviewed before fixing. Build a source-backed repair review sheet that separates reported symptoms from verified facts and hypotheses, traces the active code/data path, identifies root cause status and repair scope, checks DB/Procedure/config/environment consistency, plans data repair/rollback/tests, defaults to Markdown without UI or DOCX with UI, and provides factual SA/PM review fields. Trigger for 報修覆核單、報修覆核、報修單、事故修復覆核、故障修復覆核、修復方案覆核、bug修復覆核、異常修復覆核。"
version: 1.0.0
origin: Pixiu
---

# Repair Review Sheet｜報修覆核單

把「系統出問題／收到報修後，先確認到底壞在哪、影響什麼、準備怎麼修，再請 SA／PM 覆核」標準化成可追溯流程。

本 Skill 用在**事故／異常發生後、正式修正前**。它不是需求確認文件，也不是開發完成後的變更清單；它要回答：

> **現在發生什麼問題？證據在哪？根因確認到什麼程度？預計修哪些地方？有哪些資料、環境與回歸風險？**

流程定位：

`Incident / Repair Report -> repair-review-sheet -> SA/PM/必要角色覆核 -> 修正實作 -> change-review-evidence -> 併版/變更覆核`

若調查發現「目前行為其實符合既有規格，只是現在想換另一種業務行為」，必須轉回 `requirement-confirmation`，不可把新需求藏在 bug fix。

需要忠實 UI、DOCX 產出與 Render QA 時，同時使用 `system-documentation`；Legacy Java / Struts / Spring / DAO / SQL / Procedure 流程可搭配 `legacy-java-flow-tracing`。

---

## Core Contract

1. **Report is not fact**：客服、SA、PM、使用者或監控描述先標 `Reported Symptom`；只有原始碼、設定、Schema、Log、DB query、Runtime、測試或實際畫面支持時，才升為 `Verified Fact`。
2. **Hypothesis is not root cause**：沒有證據鏈前只能寫 `Root Cause Hypothesis`。不得因為「看起來像」「以前發生過」就寫成 `Confirmed Root Cause`。
3. **Reproduction before repair claim**：可重現時要保存觸發條件、輸入、環境、實際結果與預期結果。無法重現時仍可調查，但文件需標 `Reproduction Pending / Not Reproduced`。
4. **Active path must be traced**：修既有功能時要追 active entrypoint 與實際呼叫／資料鏈，不只搜尋檔名或單一 Java class。
5. **Repair scope is proposed until reviewed**：預計修改程式、DB、Procedure、Config、Batch、API、Report 等先標 `Repair Candidate / Proposed Repair Scope`；SA／PM 尚未覆核前不得寫成正式核准範圍。
6. **Program fix and data repair are separate**：程式修好不代表既有錯誤資料已恢復。漏單、錯狀態、錯金額、漏歷程等資料問題要獨立列 Data Impact 與 Data Repair Proposal。
7. **Cross-layer and environment contracts must close**：App / SQL / Procedure / Schema / Config / Batch / API 等契約與各預定環境版本要一起核對；任一環境 caller/callee 不相容時標 blocker。
8. **Bug fix cannot hide requirement change**：若修復方案改變既有核准業務規則，而不是恢復原本預期行為，標 `REQUIREMENT_CHANGE_REQUIRED` 並轉 `requirement-confirmation`。
9. **UI scope defaults to DOCX**：報修涉及 UI／操作畫面／畫面異常時預設 DOCX；完全無 UI 時預設 Markdown。使用者明確指定格式時以使用者指定為優先。
10. **Pre-fix UI is not After evidence**：修正前只能放 `Incident / As-Is 異常畫面` 與 `Expected Fixed Behavior Annotation`；不得偽造修後實際截圖。真正 Before/After 由修正完成後的 `change-review-evidence` 負責。
11. **Review is factual only**：SA／PM／DBA／Ops reviewer、時間、結果不得猜測。預設 `Pending`；Root Cause、Repair Scope、Data Repair 或 Environment Plan 實質變更後，受影響 review 標 `Review Stale`。
12. **Evidence gaps stay visible**：無法確認的根因、影響筆數、環境版本、資料修復方式或 rollback 都標 Pending，不用推測填滿表格。

---

## Stage 0 — Capture Repair Intake

先保存報修原始內容，再做技術整理。

至少記錄：

```text
Repair / Incident ID：<ticket / incident / N/A>
System / Project：<system>
Source：<客服 / SA / PM / user / monitoring / developer observation>
Reported At：<有證據才填>
Reported Symptom：<保留原始意思>
User Notes：<使用者自己補充的理解或觀察>
Environment：<known env / unknown>
Status：REPAIR_INTAKE_DRAFT
```

### Incident Summary

| 欄位 | 內容 |
|---|---|
| What happened | 發生什麼異常 |
| Expected behavior | 原本應該怎麼運作；需有來源或標 Pending |
| Actual behavior | 實際看到什麼 |
| Trigger / condition | 什麼條件會發生 |
| First known time | 有 evidence 才填 |
| Frequency | Always / Intermittent / Once / Unknown |
| Affected actor | 哪些角色／系統／批次 |
| Affected data | 報單／訂單／狀態／檔案／訊息等 |
| UI | 是否涉及操作畫面 |
| Business impact | 已確認的業務影響；未知就標 Pending |

不要因為報修人說「全部都壞了」就直接寫成全系統影響；要用 evidence 確認實際範圍。

---

## Stage 1 — Evidence Classification

所有資訊至少分成以下類型：

| Type | 定義 | 可否直接當結論 |
|---|---|---|
| Reported Symptom | 人員／系統回報的現象 | 否 |
| Verified Fact | source-backed 可確認事實 | 是 |
| Reproduction Evidence | 可重現步驟與實際結果 | 是 |
| Root Cause Hypothesis | 尚在驗證的原因假說 | 否 |
| Confirmed Root Cause | 有完整 evidence chain 支持的根因 | 是 |
| Open Question | 尚缺資料才能判斷 | 否 |

### Evidence Ledger

| ID | Claim | Type | Evidence | Environment / Version | Confidence | Status |
|---|---|---|---|---|---|---|
| E01 | `<claim>` | Verified Fact | `<log/query/code/screenshot>` | `<env/version>` | High | Verified |

### 禁止升級根因的情況

以下只能維持 `Hypothesis`：

- 只看到 Exception message，沒追 caller / input / data state。
- 只看到一筆 DB 異常，沒確認是原因還是結果。
- 只因最近改過某支程式就認定是它造成。
- 測試環境可重現，但營運／驗證環境版本不一致且尚未比對。
- Procedure signature / Config / Schema 尚未確認。

---

## Stage 2 — Reproduction and Timeline

### Reproduction Record

| 欄位 | 內容 |
|---|---|
| Environment | `<env>` |
| Version / SHA | `<exact version if known>` |
| Preconditions | `<data/config/state>` |
| Input | `<request/message/order/etc.>` |
| Steps | `<minimal repeatable steps>` |
| Expected | `<expected behavior>` |
| Actual | `<actual behavior>` |
| Evidence | `<log/query/screenshot/test>` |
| Result | Reproduced / Not Reproduced / Pending |

無法安全重現正式環境事故時，不要求在正式環境硬做；可以使用既有 Log、DB、message record、測試環境或可控 fixture 取證。

### Incident Timeline

只有存在可靠時間證據時才列：

| Time | Event | Evidence | Status |
|---|---|---|---|
| `<time>` | `<deploy/error/report/recovery>` | `<source>` | Verified |

沒有證據的時間不要補成「大約」。

---

## Stage 3 — Active Path and Blast Radius Trace

若是既有系統報修，依實際技術棧追：

`UI / Route / Message / Batch Entry`
`-> Action / Controller / Handler`
`-> Service / Business Rule`
`-> DAO / Mapper / SQL / Procedure`
`-> Table / History / Trigger`
`-> API / Queue / File / Report / Side Effect`
`-> Runtime Evidence`

### Repair Impact Map

| ID | File / Artifact | Layer | Current Responsibility | Incident Relevance | Evidence | Status |
|---|---|---|---|---|---|---|
| P01 | `<path>` | Service | `<role>` | Direct / Dependency / Regression | `<source>` | Confirmed / Proposed / Pending |

### Blast Radius

至少確認：

- 同一 Service / DAO / Procedure 是否有其他 caller。
- 共用 Table / Trigger / Config 是否影響其他流程。
- 相同 message type / batch / scheduler 是否共用處理。
- Report / mail / downstream API 是否依賴同一欄位或狀態。
- 歷史資料是否會被新修正邏輯重新讀取／重算。

若無法確認完整 blast radius，標 `BLAST_RADIUS_PENDING`，不要只寫「影響很小」。

---

## Stage 4 — Root Cause Analysis Gate

### Root Cause Status

使用以下狀態：

- `UNKNOWN`：還沒有可靠假說。
- `HYPOTHESIS`：有合理原因，但證據不足。
- `EVIDENCE_SUPPORTED`：多個證據支持，但尚缺關鍵驗證。
- `CONFIRMED_ROOT_CAUSE`：已能用 evidence chain 解釋現象、觸發條件與失敗結果。

### Root Cause Record

```text
Root Cause Status：<status>
Cause：<root cause or hypothesis>
Trigger：<why this input/state/environment exposes it>
Failure Mechanism：<how it causes the observed symptom>
Evidence Chain：<code/config/db/log/test references>
Counter Evidence：<if any>
Remaining Gaps：<if any>
```

### Cross-layer Contract Check

若根因或 repair 涉及契約，至少核對：

- Procedure / Function / Package：名稱、參數數量、順序、type、size/default。
- DAO / SQL：bind / parameter / result mapping。
- DB：Table / Column / Trigger / Index / history behavior。
- API / Message：request/response/schema/version。
- Config：key / value / environment override。
- Batch：scheduler / command / file format / dependency。
- Report：field binding / query / template。

契約不一致時，不得只修 caller 或只修 callee 就宣稱完成。

---

## Stage 5 — Environment Consistency Matrix

只要問題可能與部署版本、Procedure、Config、Schema 有關，就建立實際環境矩陣。

| Environment | App Version | DB / Procedure | Schema | Config | Evidence | Status |
|---|---|---|---|---|---|---|
| `<env>` | `<version>` | `<version>` | `<version>` | `<version/value>` | `<source>` | Verified / Pending / Mismatch |

### Blocker

任一預定修復／部署環境存在 caller / callee / schema / config 不相容，標：

`BLOCKED — ENVIRONMENT_CONTRACT_MISMATCH`

某環境沒有 evidence 時只能寫 `Pending`，不能由另一個環境推定。

---

## Stage 6 — Repair Scope

根因調查後建立修復範圍，不要直接把所有相關檔案都列成「要改」。

### Scope Classification

| Category | 意義 |
|---|---|
| Direct Fix Candidate | 直接修復根因的程式／設定／SQL |
| Dependency Fix Candidate | 為保持契約一致必須一起處理 |
| Data Repair / Backfill | 修復事故已造成的既有資料 |
| Regression Only | 不改，但修復後必須回歸 |
| Out of Scope | 已確認與本事故無關 |
| Pending Scope | 尚缺證據才能決定 |

### Proposed Repair Scope

| ID | Artifact | Category | Proposed Change | Why Needed | Risk | Evidence | Review Status |
|---|---|---|---|---|---|---|---|
| R01 | `<file/procedure/config>` | Direct Fix Candidate | `<repair>` | `<root cause mapping>` | `<risk>` | `<evidence>` | Pending |

Repair Scope 必須能對回 Root Cause / Blast Radius。無法說明「為什麼這個改動能修根因」的項目，不應直接列成 Direct Fix。

---

## Stage 7 — Data Impact and Data Repair

若事故已造成資料異常，獨立處理。

### Data Impact

| Data ID | Table / Business Object | Impact Type | Known Count | Detection Query / Evidence | Status |
|---|---|---|---:|---|---|
| D01 | `<object>` | Missing / Wrong State / Duplicate / Wrong Value | `<count or unknown>` | `<query>` | Verified / Pending |

### Data Repair Proposal

| Repair ID | Target | Method | Preconditions | Validation | Reversible | Rollback / Backup | Reviewer | Status |
|---|---|---|---|---|---|---|---|---|
| DR01 | `<data>` | `<script/manual/replay>` | `<condition>` | `<query/check>` | Yes/No/Unknown | `<plan>` | DBA/SA/PM | Pending |

規則：

- 程式修正與資料修復是兩個獨立 Gate。
- 不自行執行 UPDATE/DELETE/replay；實際資料異動仍依當前授權與變更流程。
- 若只能辨識受影響資料、還沒有安全修復法，寫 `Data Repair：Pending`。
- 若修復需要重送訊息／報單，必須確認 idempotency、重複資料與 downstream side effect。

---

## Stage 8 — Requirement Change Boundary

報修的預設目標是：**恢復已存在、可證明的預期行為**。

若出現以下情況，標 `REQUIREMENT_CHANGE_REQUIRED`：

- 現行系統符合已核准規格，但 PM 想改成另一種規則。
- 修復方案新增原本不存在的業務條件／欄位／狀態／權限。
- 為了「順便改善」而擴張到事故根因以外功能。
- 無法證明「預期行為」原本就存在，且需要業務決策才能選擇新行為。

處理方式：

1. 報修覆核單保留事故事實與調查證據。
2. 新業務行為轉 `requirement-confirmation`。
3. Requirement Confirmation 完成覆核後，再回報修單更新 Repair Scope。

不可用「bug fix」名義跳過需求覆核。

---

## Stage 9 — UI Scope and Output Format

### Non-UI

整個報修／修復範圍沒有使用者畫面：

`Default Output = Markdown`

### UI / Screen Incident

只要事故涉及 UI、操作結果、畫面欄位、按鈕、提示、狀態顯示或畫面背後行為：

`Default Output = DOCX`

DOCX 至少加入：

1. `Incident / As-Is 異常畫面`：實際錯誤畫面、runtime render 或依程式忠實還原，依 evidence 類型標示。
2. `Expected Fixed Behavior Annotation`：在現況畫面或規格畫面標出修復後應恢復的行為／狀態。
3. 若視覺本身沒有要變，只是後端處理修復，明確寫：`No Intended Visual Change — backend behavior/data flow repair`。

禁止：

- 修正前產一張 mockup 並稱 `After screenshot`。
- 把測試環境畫面寫成正式環境實際畫面。
- 為了文件美觀重畫 Legacy UI。

DOCX 需沿用 `system-documentation` 的 Evidence / Fidelity / Render / Redaction QA。

---

## Stage 10 — Verification and Regression Plan

修正前先寫「修完要怎麼證明真的好了」。

| Test ID | Scope | Test / Check | Expected | Evidence Required | Status |
|---|---|---|---|---|---|
| T01 | Root Cause | `<reproduction scenario>` | 原事故不再發生 | test/log/query | Planned |

至少考慮：

- 原事故重現案例。
- 正常 happy path。
- 失敗／邊界條件。
- 共用 caller / Regression Only scope。
- DB / Procedure compile / call。
- API / message contract。
- UI behavior（適用時）。
- Data Repair 前後查核（適用時）。
- 各預定環境必要 smoke / consistency check。

不得只寫「測試正常」。每個核心 repair item 要能對到至少一個可觀察驗證點。

---

## Stage 11 — Rollback / Recovery Plan

至少回答：

- 程式修正如何回復？
- Procedure / DB / Config 是否需要成對 rollback？
- Data Repair 是否可逆？若不可逆，如何備份／驗證？
- 若部署後仍失敗，先停哪個流程、怎麼避免持續擴大資料影響？
- 是否需要 replay / reprocess / reconciliation？

沒有可靠方案時寫 `Rollback / Recovery：Pending`，不要補一個看似完整但沒驗證的步驟。

---

## Stage 12 — SA / PM / Specialist Review Record

預設 SA、PM；依實際影響追加 DBA / Ops / QA / Security。

| Role | Reviewer | Review Scope | Result | Reviewed At | Comments / Conditions | Evidence |
|---|---|---|---|---|---|---|
| SA |  | Root cause / repair scope / dependency | Pending |  |  |  |
| PM |  | Business impact / expected behavior / repair boundary | Pending |  |  |  |

建議 Result：

- `Pending`
- `Reviewed — No Blocker`
- `Changes Required`
- `Confirmed Repair Scope`
- `Rejected`

### Review Integrity

- reviewer、日期、結果不得猜測。
- 根因從 Hypothesis 變成另一個 Confirmed Root Cause 時，受影響 review 標 `Review Stale`。
- Repair Scope、Data Repair、Environment plan 有實質變更時，只讓受影響的 review scope 失效。
- 舊 review 紀錄保留，不覆寫歷史。
- PM 確認業務影響不等於 DBA 核准資料修復；不同責任要分開。

---

## Stage 13 — Pre-Repair Gate

文件最後產生：

```text
[ ] Reported Symptom 與 Verified Fact 已分開
[ ] Reproduction 狀態已記錄
[ ] Evidence Ledger 已建立
[ ] Active path / Blast Radius 已追蹤
[ ] Root Cause Status 已明確
[ ] Cross-layer contract 已核對
[ ] Environment Consistency 已核對（適用時）
[ ] Repair Scope 已分類
[ ] Data Impact / Data Repair 已分開（適用時）
[ ] Requirement Change Boundary 已檢查
[ ] UI Evidence / Output 格式已判斷
[ ] Verification / Regression Plan 已列
[ ] Rollback / Recovery 已列
[ ] SA / PM / 必要 specialist review 已記錄
[ ] Open Questions / Blockers 已揭露
```

### Document Status

- `REPAIR_INTAKE_DRAFT`：只有報修內容，證據仍不足。
- `INVESTIGATING`：正在重現／追根因／盤影響。
- `READY_FOR_REPAIR_REVIEW`：根因狀態、修復範圍、驗證與風險已整理，可交 reviewer。
- `CHANGES_REQUIRED`：reviewer 要求調整。
- `REPAIR_SCOPE_CONFIRMED`：必要 reviewer 已確認 Repair Scope 且無 blocker；只描述覆核事實，不等同部署核准。
- `REQUIREMENT_CHANGE_REQUIRED`：問題已跨入新需求，需先走需求確認。
- `BLOCKED`：存在環境契約不一致、根因／範圍重大缺口、必要資料修復無安全方案等硬問題。

---

## Standard Deliverable

### 無 UI：Markdown

```text
1. 文件資訊 / Repair ID / System / Source
2. Reported Symptom / Incident Summary
3. Business Impact
4. Incident Timeline（有 evidence 時）
5. Reproduction Record
6. Evidence Ledger
7. Active Path / Blast Radius
8. Root Cause Status / Evidence Chain
9. Environment Consistency
10. Proposed Repair Scope
11. Data Impact / Data Repair（適用時）
12. Requirement Change Boundary
13. Verification / Regression Plan
14. Rollback / Recovery
15. Risk / Open Questions / Blockers
16. SA / PM / Specialist Review Record
17. Pre-Repair Gate
```

### 有 UI：DOCX

沿用上述章節，另外加入：

```text
- Incident / As-Is 異常畫面
- Expected Fixed Behavior Annotation
- UI / 欄位 / 狀態 / 操作差異說明
```

---

## Handoff to Other Skills

### 轉 Requirement Confirmation

當狀態為 `REQUIREMENT_CHANGE_REQUIRED`：

`repair-review-sheet -> requirement-confirmation -> SA/PM requirement review -> repair-review-sheet update`

### 修正完成後

以本報修覆核單的 Repair ID / Root Cause / Confirmed Repair Scope 作為 `change-review-evidence` 的背景基準：

`repair-review-sheet -> implementation -> change-review-evidence`

Change Review 必須確認：

- 實際 changed files 是否落在 Confirmed Repair Scope。
- 是否出現未覆核的新改動。
- Root Cause 對應的 repair 是否真的存在。
- 原事故與回歸驗證是否有 evidence。
- Data Repair 是否另外完成／Pending，不和 code change 混為一談。

---

## Anti-Patterns

以下視為不合格：

- 報修人說「Procedure 壞掉」就直接寫 Procedure 是根因。
- 只看到最後一個 Exception，不追 active caller / data / config。
- 只修 Java，不檢查 Procedure / Schema / Config 契約。
- 測試環境有改就假設營運／驗證環境也一致。
- 程式修好就宣稱事故資料已全部恢復。
- 沒有 affected-row evidence 就自己填影響筆數。
- 為了快速修復把新業務規則塞進 bug fix，不走需求確認。
- UI 修正前就偽造 After screenshot。
- Repair Scope 改了卻沿用舊 reviewer Confirmed。
- Rollback 寫「還原舊版」但沒有說 App/DB/Procedure/Config 如何保持一致。
- Test Plan 只寫「測試正常」。

---

## Delivery Report

```text
Repair Review：<REPAIR_INTAKE_DRAFT / INVESTIGATING / READY_FOR_REPAIR_REVIEW / CHANGES_REQUIRED / REPAIR_SCOPE_CONFIRMED / REQUIREMENT_CHANGE_REQUIRED / BLOCKED>
Repair ID：<id>
Reproduction：<Reproduced / Not Reproduced / Pending>
Root Cause：<UNKNOWN / HYPOTHESIS / EVIDENCE_SUPPORTED / CONFIRMED_ROOT_CAUSE>
Blast Radius：<Confirmed / Partial / Pending>
Environment：<Verified / Pending / Mismatch>
Repair Scope：<Prepared / Partial / Pending>
Data Impact：<None / Verified / Pending>
Data Repair：<N/A / Prepared / Pending>
UI：<UI_SCOPED / NON_UI / UI_UNKNOWN>
Output：<DOCX if UI / MD if no UI / user-specified>
Verification Plan：<Ready / Partial / Pending>
Rollback / Recovery：<Ready / Partial / Pending>
SA：<Pending / Reviewed / ...>
PM：<Pending / Reviewed / ...>
Open Blockers：<若無則寫無>
Next：<send for review / requirement confirmation / implementation>
```
