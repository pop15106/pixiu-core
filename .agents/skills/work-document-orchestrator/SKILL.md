---
name: work-document-orchestrator
description: "Use whenever the user naturally describes a work item, requirement, SA/PM instruction, follow-up adjustment, repair, data correction, incident, release/change, operation manual, or security finding. Treat leaving a reviewable work record as the default; no fixed command or opening phrase is required. Route the work to the existing requirement-confirmation, repair-review-sheet, change-review-evidence, system-documentation, and security-review skills while preserving source wording, PG interpretation, evidence, decisions, revisions, review fields, and draft-to-final history. Trigger for 現在有個需求、PM/SA說、交辦、追加調整、客戶報修、資料異常、人工修資料、事故、上版、操作手冊、資安排除、自保文件、留紀錄。"
version: 1.0.0
origin: Pixiu
---

# Work Document Orchestrator｜工作文件總控

把「工作開始就留下可追溯文件」變成自然語言工作流。使用者不需要記 Skill 名稱，也不需要固定用「PM 剛交代一件事」開頭；只要正常描述需求、交辦、報修、資料異常、上版或其他工作事項，就先建立工作紀錄，再依情境交給既有專門 Skill。

本 Skill 是**總控與證據鏈入口**，不取代既有專門 Skill。它負責判斷「這件事應留下哪種文件、目前在哪個階段、哪些原話／理解／證據／決策要保存」，再讓專門 Skill 決定詳細內容與輸出格式。

典型流程：

`自然語言交辦 -> 建立 Work Record Draft -> 判斷文件類型 -> 專門 Skill -> 過程追加 Evidence / Decision / Delta -> Review -> Final Record`

---

## Core Contract

1. **No magic phrase**：不得要求使用者先說固定口令、Skill 名稱或標準格式。從自然語言與目前對話判斷工作類型。
2. **Capture before normalize**：先保存交辦／報修／決策的原始意思，再結構化。不要把 SA／PM 原話與 PG 理解混在同一欄。
3. **Source / Interpretation / Fact separated**：至少區分 `Source Statement`、`PG Interpretation`、`Verified Fact`、`Proposal`、`Decision`、`Open Question`。
4. **Draft first, final later**：事情開始先建立 Draft；調查、需求追加、測試、修復、上版過程持續追加；事情結束才轉 Final。不得用最終結果覆蓋歷史過程。
5. **Append-only decision history**：SA／PM 改口、追加、撤回、要求先不上、測試不過暫停上版等，都新增 Decision / Delta，不刪除舊紀錄。
6. **Evidence-backed claims**：程式、DB、Log、畫面、版本、環境、測試等具體事實要有來源。資料不足就標 `Pending / Needs verification`。
7. **Review integrity**：Reviewer、日期、結果只有在使用者明確提供或有可追溯證據時才能填。不得替 SA／PM／維運推定同意。
8. **Scope boundary is explicit**：固定列 `In Scope`、`Out of Scope`、`Pending Scope`，避免後續把未交辦內容算到 PG 身上。
9. **Execution approval remains separate**：建立文件不等於授權修改程式、DB、刪檔、部署或 Git push；所有高風險操作仍遵守 PixiuCore 既有審批規則。
10. **Reuse, do not duplicate**：需求、報修、變更、操作手冊、安全審查已存在專門 Skill 時，直接路由，不另造重複流程。

---

## Stage 0 — Detect a Work Item Naturally

當使用者開始描述以下語意時，視為工作項入口，而不是要求他重新用模板輸入：

- 「現在有個需求……」
- 「PM／SA 說要……」
- 「剛剛又補充一個……」
- 「客戶報修……」
- 「這筆資料怪怪的／要手動修……」
- 「正式機剛剛出問題……」
- 「這次要上版／merge……」
- 「幫我整理操作手冊……」
- 「掃描有弱點，要送資安排除……」

以上只是例子，不是必要字串。若上下文已明確是同一工作項的追加內容，直接更新既有 Work Record，不另開一份互不相干文件。

### 不打斷自然對話

- 能從對話、程式、Ticket、Log、附件取得的欄位，不要求使用者重複輸入。
- 不完整資訊先標 `Pending`，仍可建立 Draft。
- 只有「選錯會造成實作／資料處理方向不同」的關鍵歧義才停下詢問。

---

## Stage 1 — Create the Common Work Record

每個工作項至少保留以下共通資料：

```text
Work ID：<ticket / redmine / change id / N/A>
System / Project：<known / Pending>
Topic：<short title>
Source Role：<PM / SA / 客戶 / 維運 / PG / monitoring / other>
Captured At：<known time>
Document Status：DRAFT
```

### Source Snapshot

| ID | Type | Source | Raw Meaning / Statement | Captured At | Evidence |
|---|---|---|---|---|---|
| S01 | Source Statement | PM | `<接近原話保存>` | `<time>` | chat / meeting / user note |

### PG Interpretation

| ID | Based On | PG Understanding | Assumption / Gap | Review Needed |
|---|---|---|---|---|
| I01 | S01 | `<工程師目前理解>` | `<若有>` | SA / PM / N/A |

**禁止把 S01 改寫成 I01 後刪掉原始意思。** 日後若發生認知落差，要能看出「當時收到什麼」與「當時怎麼理解」。

---

## Stage 2 — Route to the Right Document Skill

依工作本質選主要文件。使用者明確指定文件類型時，以指定類型優先。

| Work Type | Primary Skill | Default Record |
|---|---|---|
| SA／PM 新需求、模糊口頭需求 | `requirement-confirmation` | 需求確認／覆核文件 |
| 追加、修改、撤回既有需求 | `requirement-confirmation` | Requirement Revision + Delta |
| 客戶報修、Bug、事故、異常 | `repair-review-sheet` | 報修／事故覆核單 |
| 人工 SQL、資料修復、狀態補正 | `repair-review-sheet` | Data Repair 章節／資料修復覆核 |
| 開發完成、merge、上版、正式變更 | `change-review-evidence` | 變更內容覆核證據包 |
| 操作手冊、功能說明、交接、規格 | `system-documentation` | 對應系統文件 |
| 弱點、掃描、資安排除 | `security-review` + `system-documentation` | 資安判斷／排除申請文件 |
| 無法歸類但屬工作交辦 | 本 Skill | 工作交辦紀錄，待後續轉專門 Skill |

### Routing Rules

- 報修調查後發現其實是新業務規則：保留報修證據，轉 `requirement-confirmation`。
- 需求確認完成並開發後：以 Requirement ID / Revision 交給 `change-review-evidence`。
- 報修修正完成後：以 Repair ID / Root Cause / Repair Scope 交給 `change-review-evidence`。
- 同一工作同時有 UI 與後端：文件格式與畫面證據依 `system-documentation`。
- 安全掃描排除不得只寫「誤判」；要保留掃描項目、程式位置、實際資料流、可利用性判斷、補償控制與覆核結果。

---

## Stage 3 — Common Self-Protection Fields

不論最後是哪種文件，至少要能回答下列事項；不適用就寫 `N/A`，未知寫 `Pending`。

1. **原始交辦／回報內容**：誰在什麼情境提出什麼。
2. **PG 理解**：工程師依當下資訊如何理解。
3. **需求／問題背景**：為什麼要處理。
4. **In Scope**：此次明確處理內容。
5. **Out of Scope**：明確不處理內容。
6. **Pending Scope**：尚待 SA／PM／維運確認內容。
7. **程式影響**：實際或預計的 File / Class / Method / Diff。
8. **DB / Procedure / API / Config 影響**：資料或契約範圍。
9. **執行前證據**：Before query、Log、畫面、版本、筆數。
10. **執行內容**：實際修改、SQL、操作、部署或決策。
11. **執行後證據**：After query、測試、Log、畫面、版本、筆數。
12. **風險與回復方式**：Rollback / Recovery / Replay / Recheck。
13. **決策來源**：誰要求追加、暫停、不上版、改規則或接受風險。
14. **覆核紀錄**：PG / SA / PM / QA / DBA / Ops / Security，依實際責任加入。
15. **版本與日期**：文件 revision、需求 revision、程式 SHA / release version（適用時）。

---

## Stage 4 — Data Repair Evidence Contract

只要工作包含手動資料修正、SQL UPDATE／DELETE、補資料、回復庫存／金額／狀態，就強制保留以下證據。這些要求是文件規格，不代表自動授權執行 SQL。

### Before

```text
- Target table / business object
- 唯一識別條件
- SELECT 與後續 UPDATE/DELETE 使用相同核心 WHERE
- 預期影響筆數
- 實際查得筆數
- 重要欄位 Before 值
- 下游／關聯資料檢查
```

### Repair

```text
- 實際 SQL 或系統操作
- 為何這樣修，而不是直接覆蓋成另一個總值
- Transaction / SAVEPOINT / rollback plan
- 每一步預期 affected rows
- 若筆數不符時的停止條件
```

### After

```text
- 實際 affected rows
- 重要欄位 After 值
- 關聯 Table / Log / 狀態確認
- 重送／重確認結果（適用時）
- 最終一致性檢查
```

例如庫存、金額或累積值修復，要保存「本次交易實際增減量」的來源，不可只因總量看起來合理就直接以原始總量覆蓋目前餘額。

---

## Stage 5 — Document Lifecycle

同一工作項使用同一條文件生命週期，不要每次追加就另開一份沒有關聯的最終文件。

### DRAFT

事情剛開始：
- 保存 Source Snapshot 與 PG Interpretation。
- 建立初始 Scope、Open Questions、Evidence 待辦。
- 若需求／報修資訊不足，照樣可存在 Draft。

### IN_PROGRESS

處理中：
- 每次 SA／PM 追加／改口，以 Revision / Delta / Decision 新增。
- 每次程式調查、DB 查詢、Log、測試結果更新 Evidence Ledger。
- 若決策改變原 Scope，標示舊 review 是否 `Review Stale`。

### READY_FOR_REVIEW

內容足以覆核：
- 已確認的事實與 Pending 清楚分離。
- Scope、驗收／修復方式、風險與未解項目齊全。
- Reviewer 欄位保留實際責任角色。

### FINAL

工作完成且已有足夠驗證：
- 記錄實際完成內容，不用原本「預計」內容取代。
- 附最終驗證與版本。
- Reviewer 結果只填實際取得的內容。
- 未完成或未驗證事項仍保留，不因結案而隱藏。

---

## Stage 6 — Decision / Delta Ledger

對「後來又改了」特別敏感。所有會改變 Scope、規則、上版決策、資料修復方式的內容都要留一筆。

| ID | Time | Source | Type | Previous | New Decision / Requirement | Impact | Review Impact | Evidence |
|---|---|---|---|---|---|---|---|---|
| D01 | `<time>` | PM | CHANGE | `<before>` | `<after>` | Scope/Test | PM/SA review stale | chat |

`Type` 建議：`ADD`、`CHANGE`、`REMOVE`、`CLARIFY`、`HOLD`、`RESUME`、`APPROVE`、`REJECT`、`RISK_ACCEPTANCE`。

「SA 說測試沒過不要上」「PM 說這段先拿掉」「後來又要求加回」都應各自保存，不只保留最後一句。

---

## Stage 7 — Review Integrity

預設角色依文件類型調整：

- Requirement：PG / SA / PM
- Repair / Data Repair：PG / SA / PM；需要時加 DBA / Ops
- Change / Release：PG / SA / PM / QA / Release 或實際組織角色
- Security：PG / Security / SA / PM（依流程）

### Review Record

| Role | Reviewer | Date | Result | Scope | Comment / Condition | Evidence |
|---|---|---|---|---|---|---|
| PG |  |  | Pending |  |  |  |
| SA |  |  | Pending |  |  |  |
| PM |  |  | Pending |  |  |  |

規則：
- 使用者明確說「PG 填 Danny、今天、同意」等，可依該明確指令填寫 PG 欄位。
- 不得自行替 SA／PM／維運填姓名、日期或同意。
- 文件內容在覆核後發生實質變更時，受影響覆核標 `Review Stale`，歷史紀錄不刪除。

---

## Stage 8 — Output and Naming

輸出格式優先遵守被路由 Skill：

- 有 UI／正式畫面證據：通常 DOCX，並執行 Render / Redaction QA。
- 純後端／資料／流程：通常 Markdown；使用者要求 DOCX/PDF 時依指定。
- 不因文件尚未完成就偽造正式 After screenshot 或 Approved 狀態。

建議檔名：

```text
YYYYMMDD_<系統或客戶>_<主題>_<文件類型>[_vN].md
YYYYMMDD_<系統或客戶>_<主題>_<文件類型>[_vN].docx
```

例如：

```text
20260908_PCLMS_AP_BDB30_報單確認異常_報修覆核單.docx
20260908_PCLMS_BK_L6按月彙報_需求確認單.md
```

檔案位置依各專案既有文件慣例，不在本 Skill 寫死單一路徑。

---

## Stage 9 — Ticket / Redmine / Communication Derivatives

若使用者接著要填 Redmine、變更單、Email、Teams 或送 SA／PM 的說法，從同一份 Work Record 產生，不另編一套事實。

至少保持一致：
- 標題／主題。
- 問題或需求摘要。
- 原因／背景。
- 實際處理範圍。
- 驗證結果。
- 待協助／待覆核事項。

簡短溝通可以縮寫，但不可把 `Pending` 縮成「已確認」。

---

## Stop / Escalation Conditions

遇到以下狀況仍可建立 Draft，但不可宣稱文件已完成：

- 原始交辦來源無法確認，且會影響責任或 Scope。
- SA／PM 原話與 PG 理解有兩種以上合理解讀，且會導致不同實作。
- 事故根因、資料影響筆數或環境版本沒有證據。
- 人工資料修復缺少 Before / affected rows / rollback / After verification。
- 已覆核文件後又有實質需求 Delta，但尚未重新覆核受影響範圍。
- 實際 changed files 超出已確認 Scope。

此時明確列 `Pending / Blocker / Review Stale`，不要用模糊文字掩蓋。

---

## Anti-Patterns

以下視為不合格：

- 要求使用者記住一串 Skill 指令才會建文件。
- 把「PM 說的」與「我理解 PM 是這個意思」合併成一段，日後無法區分。
- 每次追加都覆蓋上一版，只留下最後需求。
- 發生事故只寫最後修法，不保存事故前資料、Log 與查核歷程。
- SQL 修完只寫「已處理」，沒有 Before / After / affected rows。
- 只因畫面成功就省略 DB／Log 驗證。
- Reviewer 尚未確認就先幫他打勾。
- 文件寫「不在此次範圍」但實際程式又順便修改。
- Redmine、覆核單、變更文件對同一事件寫出不同根因或處理結果。

---

## Delivery Report

```text
Work Document：<DRAFT / IN_PROGRESS / READY_FOR_REVIEW / FINAL / BLOCKED>
Work Type：<REQUIREMENT / REQUIREMENT_DELTA / REPAIR / DATA_REPAIR / INCIDENT / CHANGE_RELEASE / DOCUMENTATION / SECURITY / GENERAL>
Primary Skill：<skill name>
Source Snapshot：<captured / partial>
PG Interpretation：<captured / pending>
Scope：<ready / partial / pending>
Evidence：<ready / partial / pending>
Review：<PG/SA/PM/... statuses>
Output：<path / chat draft / pending>
Next：<investigate / review / implement / verify / finalize>
```
