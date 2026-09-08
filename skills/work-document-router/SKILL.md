---
name: work-document-router
description: "Use when the user starts describing a real work item in natural language and wants every requirement, SA/PM instruction, repair, data fix, incident, release/change, operation guide, or security follow-up to leave a reviewable document trail. No fixed invocation phrase is required. Classify the work item, preserve the original instruction separately from PG interpretation, route to requirement-confirmation / repair-review-sheet / change-review-evidence / system-documentation or security evidence, maintain draft-to-final history, and keep factual review fields. Trigger for 現在有個需求、有個需求、PM剛交代、SA剛交代、PM說、SA說、客戶報修、報修、資料修復、手動修資料、人工修資料、事故處理、異常處理、要上版、準備上版、併版、操作手冊、資安排除、復掃、自保文件、留文件、留紀錄。"
version: 1.0.0
origin: Pixiu
---

# Work Document Router｜工作文件總控

把「工作開始時先留下可追溯文件，過程持續補，完成後轉成最終版」標準化。

本 Skill 是**文件總控與路由層**，不是取代既有專業 Skill。使用者不需要記固定口令；只要自然語言開始描述一個真實工作事項，就依語意判斷該留下哪一種文件。

典型自然語句：

- `現在有個需求，PM 說……`
- `SA 剛又補充一個條件……`
- `客戶報修，現在狀況是……`
- `這筆資料怪怪的，我要手動修……`
- `這次要上版，改了這幾隻……`
- `PM 說這個先不要上。`
- `幫我整理操作手冊。`
- `這次資安復掃要送排除說明。`

不需要把「PM 剛交代一件事」當成固定咒語。

---

## Core Contract

1. **Natural-language trigger**：以工作語意判斷，不要求固定開頭或精確關鍵字。
2. **Real work item only**：只有實際需求、交辦、報修、資料修復、事故、變更／上版、操作文件或資安工作才建立文件；單純問概念、聊天或假設題不強制產生工作文件。
3. **Original instruction is immutable evidence**：SA／PM／客戶／使用者原始交辦與後續追加內容要保留原意，不能被 PG 解讀覆蓋。
4. **Source and interpretation are separate**：固定分開 `原始交辦 / Reported or Requested Source` 與 `PG 理解 / User Interpretation`。
5. **Facts, decisions and hypotheses are separate**：已驗證事實、待確認理解、根因假說、正式決策不得混成同一層。
6. **Draft first, append history**：工作開始先建立草稿；後續補充以 revision / delta / timeline / decision ledger 追加，不覆寫舊紀錄。
7. **One primary document, optional linked documents**：同一工作事項先選一份主文件；跨需求、報修、資料修復、變更時用 linked document / handoff 串接，不無限制複製內容。
8. **Review is factual only**：SA／PM／PG／DBA／Ops／QA／Security 的姓名、日期、結果只在有明確證據時填寫。使用者明確指定自己的 PG 覆核資料可照指示填；不得代替其他角色簽核。
9. **Evidence before claim**：程式、DB、Log、畫面、設定、版本、測試沒有證據時標 Pending，不用合理猜測補齊。
10. **Artifact is the default outcome**：此 Skill 命中真實工作事項時，預設要留下可保存的文件草稿，而不是只在對話中整理幾句；實際落檔仍遵守宿主的寫入與檔案工具規範。
11. **No silent scope expansion**：文件可以列建議與待確認，但不能把未授權的新需求、程式改動或資料修復寫成既定範圍。
12. **Final means evidence-complete**：只有必要驗證、狀態、決策與覆核已具證據時才標 Final；否則保持 Draft / Pending / Ready for Review。

---

## Stage 0 — Detect and Capture the Work Item

只要使用者開始描述真實工作事項，先建立共用 Header：

```text
Work Item ID：<ticket / Redmine / change id / N/A>
System / Project：<known system>
Customer / Business Unit：<known / N/A>
Source：<SA / PM / customer / monitoring / developer / user>
Captured At：<有可靠時間時填>
Raw Instruction / Report：<保留原始意思>
PG Interpretation：<工程師目前理解；未知則 Pending>
Current Phase：<intake / investigation / requirement review / repair / implementation / release / final>
Primary Document：<routing result>
Linked Documents：<if any>
Status：WORK_ITEM_DRAFT
```

### 必留的「自保欄位」

每種文件至少保留：

- 原始交辦／回報內容。
- PG 目前理解。
- 已驗證事實與證據來源。
- In Scope。
- Out of Scope。
- Pending Scope / Open Questions。
- 程式／DB／Procedure／API／Config／Batch／Report 影響。
- 執行前證據。
- 執行後證據。
- 測試／驗證結果。
- 風險、Rollback / Recovery。
- 決策來源與 Decision Ledger。
- SA／PM／PG／必要 specialist 覆核。
- 日期、版本／Revision、文件狀態。

---

## Stage 1 — Semantic Routing

依「現在這件事要回答什麼問題」選主文件。

| Work Intent | Primary Skill / Document | 主要問題 |
|---|---|---|
| 新需求、SA/PM 口頭交辦、使用者整理自己的需求理解 | `requirement-confirmation` | 我們準備做什麼？理解是否正確？ |
| 追加、補充、改口、撤回、`先不要上`、中途變更需求 | `requirement-confirmation` Requirement Delta | 原本確認什麼？現在改了什麼？哪些覆核失效？ |
| 客戶報修、事故、異常、故障、Bug 調查 | `repair-review-sheet` | 發生什麼？根因與修復範圍證據在哪？ |
| 人工 SQL、資料修復、回復狀態、補資料、刪殘值、重送／重跑 | `repair-review-sheet` 的 Data Repair 模式 | 哪些資料被改？前後值、筆數、Rollback 與驗證是什麼？ |
| 已完成程式修改、準備併版／上版／正式變更 | `change-review-evidence` | 最後實際改了什麼？是否符合需求／修復範圍？ |
| 操作手冊、SOP、系統／模組／流程／測試／交接文件 | `system-documentation` | 如何忠實描述現況、操作與證據？ |
| 資安掃描、弱點排除、復掃、風險接受／誤判說明 | `security-review` evidence + `system-documentation` | 弱點事實、實際程式風險、排除依據與復掃證據是什麼？ |

### Mixed Work Item

同一工作事項可能跨階段，依目前 phase 決定主文件：

```text
需求交辦
→ requirement-confirmation
→ 開發
→ change-review-evidence

報修／事故
→ repair-review-sheet
→ 修正實作
→ change-review-evidence

報修調查發現其實要改業務規則
→ repair-review-sheet 保留事故事實
→ requirement-confirmation 建 Requirement Delta
→ 實作
→ change-review-evidence
```

不要把新需求藏在報修，也不要把資料修復混成程式修正已完成。

---

## Stage 2 — Route without a Magic Phrase

### 直接路由，不要求使用者改說法

以下都視為等價語意：

```text
PM 剛交代……
PM 說……
現在有個需求……
有個需求要調……
SA 剛補充……
前面那個再改一下……
```

都先進 `requirement-confirmation`，若是既有 revision 則建立 Requirement Delta。

```text
客戶報修……
這張單有異常……
正式環境出問題……
現在有一筆資料要救……
我要人工把資料修回來……
```

都先進 `repair-review-sheet`；涉及資料異動時強制使用 Data Repair 段落。

```text
這次要上版……
等等要併版……
這次實際改了這幾隻……
```

都進 `change-review-evidence`。

### 模糊但仍可先建草稿

若一開始只知道：

`PM 剛交代一件事……`

但內容還沒說完，不要求使用者重講固定格式。先建立 `WORK_ITEM_DRAFT`，保存 Source=PM；等下一段內容出現後再決定主文件。

只有當兩種分類都合理，而且選錯會改變責任邊界、資料處理或耗費大量工作時，才提出 2–3 個選項要求確認。

---

## Stage 3 — Document Lifecycle

每個工作事項採 append-only 生命週期：

```text
WORK_ITEM_DRAFT
→ evidence / requirement / repair investigation 持續補充
→ READY_FOR_REVIEW
→ REVIEWED / CHANGES_REQUIRED
→ IMPLEMENTING / REPAIRING（適用時）
→ VERIFYING
→ FINAL
```

### Revision / Delta Rules

- 首版用 `R1 / V1.0`。
- SA／PM 後續追加：建立 `R2 / V1.1` 或下一 revision。
- 不直接改掉舊的原始交辦。
- Decision Ledger 保存「誰在什麼 evidence 下做了什麼決定」。
- `先不要上`、`拿掉這段`、`測試沒過所以不上` 等決策要明列，不只寫在備註。
- reviewer 只對自己看過的 revision 有效；受 Delta 影響時標 `Review Stale`。

---

## Stage 4 — Data Repair Safety Record

只要涉及人工 SQL、資料清理、狀態回復、補資料、刪除殘值或 replay，文件固定追加：

### Pre-change Evidence

| ID | Target | Detection Query / Evidence | Before Value / Count | Expected Impact | Status |
|---|---|---|---|---|---|
| D01 | `<table/key>` | `<SELECT / log>` | `<before>` | `<n rows>` | Verified / Pending |

### Repair Action

| Step | Operation | Exact Scope | Expected Rows | Actual Rows | Transaction / Savepoint | Status |
|---|---|---|---:|---:|---|---|
| 1 | `<UPDATE/DELETE/replay>` | `<keys>` | `<n>` | `<n>` | `<rollback plan>` | Pending / PASS |

### Post-change Validation

至少確認：

- 與修改 WHERE 相同範圍的 read-back。
- 筆數是否等於預期。
- 前後值是否符合業務規則。
- 關聯 Table／狀態／保證金／歷程／Log 是否一致。
- 是否需要重跑／重送／重新確認。
- Rollback / Recovery 是否仍可執行。

### Data Repair Integrity

- 不用 `RINQTY`、總額或其他「看起來完整」的值直接覆蓋現況，除非規則與 evidence 證明應如此。
- 回復數量應依本次實際異動量、交易量或可證明 delta 還原。
- 已成功完成與尚未執行的步驟分開記錄。
- 程式修好不代表事故資料已修復；兩者要有獨立驗證。

---

## Stage 5 — Decision Ledger

遇到 SA／PM／維運決策時追加，不覆寫歷史：

| Decision ID | Source | Raw Decision | Interpreted Effect | Affected Scope / Revision | Evidence | Status |
|---|---|---|---|---|---|---|
| DEC-01 | PM | `這版先不要上` | 本 revision 不進本次 release | Release scope | chat / meeting note | Recorded |

適合記錄：

- `先不要上`。
- `這個拿掉`。
- `先照舊邏輯`。
- `只改 A，不改 B`。
- `測試沒過，SA 說不要上`。
- `資料先人工修，程式另開單`。

這些都是日後責任邊界的重要 evidence。

---

## Stage 6 — Output Mode

### Working Draft

事情剛開始、仍在討論：

- 無 UI：沿用目標 Skill，通常 Markdown。
- 有 UI／需畫面證據：DOCX。
- 若使用者明確說「要送覆核／要填報修／要正式文件」，優先產正式 DOCX 或使用者指定格式。

### Final

事情完成時，至少補：

- 最終實際範圍。
- 最終執行／修改內容。
- 驗證結果與 evidence。
- 未完成／未驗證項目。
- Rollback / Recovery。
- Reviewer factual status。
- Revision / version / date。

### Filename Convention

預設：

```text
YYYYMMDD_<系統或客戶>_<主題>_<文件類型>.<ext>
```

例：

```text
20260908_PCLMS_AP_BDB30_報單確認異常_報修覆核單.docx
20260910_PCLMS_BK_L6月彙報_需求確認單.docx
20260912_PEPIS_D7櫃號調整_變更覆核單.docx
```

若同一工作事項有 revision：

```text
..._R1.docx
..._R2.docx
..._Final.docx
```

---

## Stage 7 — Review Integrity

預設 review 角色依文件類型帶入，必要時追加：

- PG：執行／技術確認。
- SA：系統行為、技術範圍、相依。
- PM：業務意圖、範圍、驗收、上版決策。
- DBA：DB／資料修復。
- Ops：主機、Pool、服務、部署、環境。
- QA：測試／回歸。
- Security：弱點／風險。

規則：

- 不猜 reviewer 名字、日期、結果。
- 使用者明確說 `PG Danny 今天 同意`，可視為使用者提供的 PG 覆核資料並填入。
- 不因 PG 自我確認推定 SA／PM 同意。
- 文件內容實質變更後，受影響 reviewer 標 `Review Stale`。
- 舊覆核保留，不能刪掉重寫成新版本。

---

## Stage 8 — Completion Gate

文件轉 Final 前至少確認：

```text
[ ] 原始交辦／回報已保存
[ ] PG 理解與原始來源分開
[ ] Verified Fact / Interpretation / Hypothesis 分開
[ ] In Scope / Out of Scope / Pending Scope 已列
[ ] 程式／DB／跨層影響已盤點
[ ] 執行前證據已保存
[ ] 執行後證據已保存
[ ] 測試／驗證結果有 evidence
[ ] 資料修復前後值／筆數已核對（適用時）
[ ] 決策與追加／撤回歷程已保存
[ ] Rollback / Recovery 已記錄
[ ] SA／PM／PG／必要 specialist 覆核為 factual status
[ ] 未完成／未驗證項目已揭露
[ ] 文件 revision / date / status 已更新
```

沒有全部成立時可以交付 Draft / Ready for Review，但不能標 Final。

---

## Child Skill Contract

本 Skill 只做分類、共用 evidence、文件生命週期與 handoff，不重寫 child skill 的細節。

分類完成後，依需要使用：

- `skills/requirement-confirmation/SKILL.md`
- `skills/repair-review-sheet/SKILL.md`
- `skills/change-review-evidence/SKILL.md`
- `skills/system-documentation/SKILL.md`
- `skills/security-review/SKILL.md`（資安 evidence 適用時）

若宿主已由 Capability Router 載入 child skill，直接使用；若尚未載入且任務需要其細節，依 PixiuCore 的按需載入規則取得，不全文掃描其他 Skills。

---

## Anti-Patterns

以下視為不合格：

- 要求使用者背固定觸發口令。
- PM 原話和 PG 理解混成一段，日後無法證明誰說了什麼。
- SA／PM 追加後直接覆寫舊文件，看不出需求歷史。
- 報修調查尚未完成就把假說寫成 Confirmed Root Cause。
- 人工 SQL 只有最終 SQL，沒有執行前 SELECT、影響筆數與 read-back。
- `OS10`、數量、金額、餘額等資料修復直接用總值覆蓋，而不是依 evidence delta 還原。
- 程式修好就把資料修復標完成。
- 只有一張最終文件，沒有記錄中途 `先不要上／拿掉／追加` 等決策。
- reviewer 尚未覆核卻填 Approved。
- 沒有 UI evidence 卻製造假 Before/After。

---

## Delivery Report

```text
Work Document Router：<WORK_ITEM_DRAFT / ROUTED / READY_FOR_REVIEW / VERIFYING / FINAL>
Primary Document：<requirement-confirmation / repair-review-sheet / change-review-evidence / system-documentation / security>
Revision：<R1 / R2 / ...>
Source Snapshot：<Captured / Pending>
PG Interpretation：<Captured / Pending>
Scope：<Confirmed / Partial / Pending>
Evidence：<Ready / Partial / Pending>
Data Repair：<N/A / Prepared / Verified / Pending>
Decision Ledger：<count>
Review：<PG / SA / PM / specialist factual status>
Output：<path / artifact / Pending>
Next：<continue intake / send review / implement / repair / verify / release>
```
