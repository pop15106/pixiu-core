---
name: change-review-evidence
description: "Use before merge/release/change execution to build a source-backed change review package: exhaustive changed-file inventory, per-change-block diff and rationale, cross-layer/API/DB/Procedure/config dependency checks, UI-scoped automatic DOCX with Before/After evidence, verification evidence, and factual SA/PM review fields. Trigger for 變更內容整理、併版前覆核、改動範圍、變更 diff、SA/PM 覆核、change review。"
version: 1.1.0
origin: Pixiu
---

# Change Review Evidence｜變更內容與覆核證據

把「準備 merge／併版／正式變更前，先把這次到底改了什麼說清楚」標準化成可驗證流程。

本 Skill 的目的不是替任何人核准變更，而是產出一份**可追溯、可覆核、可保存責任邊界**的變更證據包，讓 SA、PM、開發、測試或變更執行人員看到同一份事實。

只要使用者先指定的變更範圍包含可操作 UI／畫面，本 Skill **預設輸出正式 DOCX**，並同時使用 `system-documentation` 完成畫面證據、文件組裝與 Render QA；Legacy Java / Procedure / SQL 流程追蹤可搭配 `legacy-java-flow-tracing`。純後端／無畫面範圍預設可輸出 Markdown，使用者另指定 DOCX/PDF 時依指定格式交付。

## Core Contract

1. **Exact baseline first**：先固定本次比較的 Base 與 Target。優先記錄 immutable commit SHA / tag / release artifact；只有 branch name 不足以作最終證據。
2. **Changed-file completeness**：權威 diff 中每個新增、修改、刪除、改名檔案，都必須出現在變更清單，或明確列為排除並寫原因。不得只挑「看起來重要」的檔案。
3. **Every change block has a reason**：每隻程式的每個改動範圍都要有說明。一個 Change Block 預設對應一個 contiguous diff hunk 或一個語意完整的 symbol-level 變更；同一 hunk 有多個目的時要拆開說明。
4. **Diff is evidence, not explanation**：Diff 必須保留，但不能用 diff 本身代替修改原因、行為影響、相依性與風險說明。
5. **Cross-layer contract must close**：Java / API / Batch / Config / SQL / Procedure / Table / Trigger / Message schema 等只要存在呼叫契約或部署相依，就要一起核對；不能因為某一層不在同一個 Git repo 就忽略。
6. **UI scope defaults to DOCX + Before/After**：只要使用者指定的 review scope 包含 UI／操作畫面，不論本次 diff 是前端視覺變更或畫面背後的 Action／Service／資料處理變更，都預設產出正式 DOCX，並收錄對應 Before / After 畫面。若畫面視覺沒有差異，要明確標示「視覺無差異；本次變更位於後端行為／資料流程」，不得製造不存在的畫面差異。完全沒有 UI 的 scope 才標示 `N/A — 本變更範圍無使用者畫面`。
7. **Approval is factual only**：SA/PM 尚未覆核就寫 `Pending`。只有存在實際覆核證據時才能記錄 `Approved` / `Reviewed`；不得代替任何人簽核、補姓名、補日期或推定同意。
8. **Evidence gaps block claims**：缺 Base、缺 Target、漏 dependency、缺必要 UI/runtime 證據或 reviewer 尚未回覆時，文件可以完成草稿，但不能宣稱「已確認可併版」。

---

## Stage 0 — Lock Change Baseline

先回答：**這份文件到底在比較哪兩個版本？**

至少記錄：

| 欄位 | 必填內容 |
|---|---|
| Project / System | 專案或系統名稱 |
| Change / Ticket | 變更單、需求單、事故修正或工作項識別；沒有就標 `N/A` |
| Base | 目前核准／部署／預計被合併的基準版本 |
| Base SHA / Version | 精確 commit、tag 或 artifact version |
| Target | 本次要審查的變更版本 |
| Target SHA / Version | 精確 commit、tag 或 artifact version |
| Compare semantics | `merge-base...target`、`base -> target`、release artifact compare 等實際比較語意 |
| Working tree | Clean / 有未提交變更；若有，要明確決定是否納入 |
| Generated at | 證據包產生時間 |

### Git Evidence 建議

依實際問題選對比較方式，不機械套一條命令：

- 要看 feature branch 相對共同祖先新增了什麼：`git diff <base>...<target>`。
- 要比較兩個精確 snapshot：`git diff <base> <target>`。
- 先取檔案清單：`git diff --name-status --find-renames <compare>`。
- 再取統計與逐檔 diff：`git diff --stat <compare>`、`git diff --find-renames <compare> -- <file>`。
- 若存在 uncommitted changes，另外記錄 `git status --short` 與 worktree diff；不得靜默混入已 commit 的變更包。

若不是 Git，使用該 VCS / artifact system 的等價 immutable evidence。

---

## Stage 1 — Build Exhaustive Change Inventory

先從權威 diff 產生**完整檔案集合**，再開始寫說明。

### 必備欄位

| ID | File / Artifact | Layer | Change Type | Main Symbols / Range | UI | Contract / Deploy Dependency | Diff Evidence | Status |
|---|---|---|---|---|---|---|---|---|
| F01 | `path/to/File.java` | Service | Modified | `methodA()` | No | Procedure `PKG_X.P1` | exact diff / patch ref | Documented |

`Change Type` 至少區分：`Added`、`Modified`、`Deleted`、`Renamed`。

`Layer` 依實際專案填寫，例如：UI、Controller/Action、Service、DAO、SQL、Procedure、DB Schema、Batch、Config、API Contract、Report、Test、Deployment Script、Documentation。

### Completeness Gate

完成清單後必須核對：

```text
Authoritative changed-file count
= Documented file count
+ Explicitly excluded file count
```

任何對不上都標為 `BLOCKED — CHANGE_INVENTORY_MISMATCH`。

自動產生檔、lock file、格式化檔或文件若要排除，也要保留「為何不需要逐段業務說明」的理由，不能直接消失。

---

## Stage 2 — Explain Every File and Every Change Block

每個檔案建立獨立章節，不能只做一張總表。

### 每檔固定結構

```markdown
## F01 — <file path>

### 檔案角色
- 這隻程式原本負責什麼：<source-backed description>
- 本次為什麼需要動到它：<requirement / defect / dependency>

### Change Block F01-C01 — <method / lines / diff hunk>
- Before：<原行為或原程式摘要>
- After：<新行為或新程式摘要>
- Diff：<該區塊實際 diff；大型 diff 可指向 immutable patch，但本文仍保留關鍵 hunk>
- 修改原因：<為什麼一定要改>
- 行為影響：<對流程、資料、輸出、呼叫契約的影響>
- 相依項目：<其他 file / API / Procedure / table / config / job>
- 風險：<可能造成的 regression / deployment mismatch / data risk>
- 驗證：<test / runtime / DB / log / screenshot evidence>
- Evidence status：Verified / Needs verification / Unsupported
```

### Change Block 切分規則

- 一個 diff hunk 只有一個目的：可視為一個 Change Block。
- 一個 hunk 同時包含「修 bug + 改欄位 + 改錯誤處理」：拆成多個 Change Block。
- 大量 rename / format only：可以合併為 mechanical block，但要證明沒有混入行為變更。
- 刪除程式也要說明「為何可刪、誰取代、是否仍有 caller」。
- 新增程式要說明「入口、責任、誰會呼叫、失敗時怎麼處理」。

### Diff 保存規則

使用者要求「每隻程式跟 diff」時：

1. 每檔至少要有可閱讀的相關 diff hunk。
2. Diff 很長時，可把完整 patch 放在附件／獨立 `.patch`，正文逐 Change Block 顯示關鍵 hunk。
3. 外部 patch 必須記錄 Base / Target 與 hash 或其他 immutable identity，避免日後檔案內容被換掉。
4. Binary 檔不能偽造文字 diff；改用檔案 hash、尺寸、來源版本與視覺／runtime evidence。

---

## Stage 3 — Cross-Layer Dependency Gate

這一階段專門避免「程式改了，但 Procedure / DB / 設定 / 其他環境沒有一起改」的事故。

### 必查相依

只要 diff 或 flow trace 命中，下列項目就要加入 Dependency Matrix：

- Procedure / Function / Package signature
- DAO / SQL parameter count、type、順序
- Table / Column / Index / Trigger
- API request / response schema
- Message / queue / file format
- Config key / environment variable
- Batch / scheduler / shell script
- Report template / field binding
- Library / runtime / server config
- Deployment / migration / rollback script

### Contract Matrix

| Contract ID | Caller | Callee / Artifact | Before Contract | After Contract | Deployment Artifact | Verification | Status |
|---|---|---|---|---|---|---|---|
| D01 | `Xdao.java` | `PKG_A.P_SAVE` | 5 params | 6 params | `alter_pkg_a.sql` | compile + runtime call | Verified |

對 Procedure / API / DB contract，不能只寫「有改」。至少核對：

- 名稱
- parameter / field 數量
- 順序
- type / size / nullable / default（適用時）
- caller 與 callee 是否同版本相容
- migration / deployment script 是否存在
- rollback 是否需要成對處理

### Environment Coverage Matrix

若變更需要跨環境部署，使用**專案實際環境名稱**建立矩陣，不預設只有 DEV/SIT/UAT/PROD：

| Environment | App Version | DB / Procedure Version | Config Version | Evidence | Status |
|---|---|---|---|---|---|
| `<env>` | `<version>` | `<version>` | `<version>` | `<query/log/deploy record>` | Verified / Pending / Mismatch |

只要 caller 與 callee contract 在任一預定環境不一致，就標：

`BLOCKED — CROSS_LAYER_CONTRACT_MISMATCH`

沒有該環境的 runtime / deployment evidence 時，寫 `Pending`，不能從「測試環境有改」推定其他環境也有改。

---

## Stage 4 — UI Scope / Before / After / DOCX Gate

先判斷**使用者指定的 review scope 是否包含 UI／操作畫面**。此判斷決定預設交付格式：

- Scope 含 UI／操作畫面 → `Default Output = DOCX`，必須走 `system-documentation` 的正式文件產出與 Render QA。
- Scope 完全不含 UI → `Default Output = Markdown`；使用者另指定 DOCX/PDF 時依指定格式。
- 使用者明確指定輸出格式時，明確指令優先於上述預設。

### UI-scoped change

每個受影響畫面至少記錄：

| Screen ID | Screen / Route | Before Evidence | After Evidence | What Changed | Ref / Environment | Status |
|---|---|---|---|---|---|---|
| UI01 | `<screen>` | screenshot | screenshot | `<difference>` | `<base/target + env>` | Verified |

只要 scope 含 UI，每個受影響功能畫面都要有 Before / After 證據。若本次程式變更不造成視覺差異，Before / After 仍保留並標記 `No Visual Difference — backend behavior/data flow changed`，讓 reviewer 能確認「畫面沒改，但背後邏輯有改」。

Before / After 證據優先順序沿用 `system-documentation`：

1. 實際執行中系統截圖。
2. 對應 Base / Target 的實際 render。
3. 依實際程式碼忠實還原；只能標「依程式碼還原」，不能稱為正式環境截圖。
4. 示意圖只有使用者接受時才可用，且必須明確標示。

截圖要能追溯：至少知道是 Before 還是 After、對應版本／環境、畫面名稱；正式帳密、Token、個資要遮罩。

### Non-UI scope

只有當**整個使用者指定範圍都沒有操作畫面**時，才寫：

`UI Evidence：N/A — 本變更範圍無使用者畫面。`

此時預設不強制 DOCX，可用 Markdown 交付；不要為了填欄位硬做 Before/After。

---

## Stage 5 — Verification Evidence

變更說明完成後，把「為什麼相信它可運作」獨立列出。

| Evidence ID | Scope | Verification | Expected | Actual | Source | Status |
|---|---|---|---|---|---|---|
| V01 | F01-C01 | unit / compile / runtime / query | `<expected>` | `<actual>` | `<log/path>` | PASS |

至少覆蓋本次實際影響的類型：

- Compile / Build
- Unit / Integration / Regression test
- DB / Procedure compile or call
- Runtime log / query
- UI behavior
- API / message contract
- Deployment / rollback dry-run or evidence（適用時）

測試沒有執行就寫 `Not Run`，不得寫 PASS。

---

## Stage 6 — SA / PM Review Record

預設提供 SA 與 PM 欄位；專案若還有 QA、DBA、Ops、Release Manager，可依實際治理追加，不把角色寫死成只有兩個人。

### Review Table

| Role | Reviewer | Review Scope | Result | Reviewed At | Comments / Conditions | Evidence |
|---|---|---|---|---|---|---|
| SA |  | Code scope / design / dependency | Pending |  |  |  |
| PM |  | Requirement / business impact / release scope | Pending |  |  |  |

`Result` 建議值：

- `Pending`
- `Reviewed — No Blocker`
- `Changes Required`
- `Approved` — 僅限 reviewer 實際明確核准且有證據
- `Rejected`

### Review Integrity Rules

- Reviewer 名稱、時間、結果不得由 AI 猜測。
- 口頭說「應該可以」不轉成 `Approved`。
- 若核准有條件，條件必須原樣保留在 Comments / Conditions。
- Email、Ticket、Chat、簽核系統或簽名欄可以作 Evidence；記錄可追溯 reference，不把敏感內容全文複製進文件。
- 文件版本更新後若 diff 已變，舊 review 不能自動沿用；要標記 `Review Stale` 並重新覆核受影響範圍。

---

## Stage 7 — Pre-Merge / Pre-Change Gate

在文件最後產生 Gate Checklist：

```text
[ ] Base / Target 已固定且可追溯
[ ] 權威 changed-file count 與文件清單一致
[ ] 每個 changed file 已說明
[ ] 每個 Change Block 已說明原因、影響、相依、驗證
[ ] Cross-layer contract 已核對
[ ] 所有預定環境的必要 deployment / DB / config evidence 已確認
[ ] UI 變更已有 Before / After；非 UI 已標 N/A
[ ] 必要測試與 runtime evidence 已完成或明確列 Pending
[ ] SA 覆核狀態已記錄
[ ] PM 覆核狀態已記錄
[ ] 未解 blocker / condition 已列出
```

### 文件狀態

Skill 可以判斷文件狀態，但**不能替組織做核准決策**：

- `DRAFT`：證據尚未齊。
- `READY_FOR_REVIEW`：文件證據完整，等待 reviewer。
- `CHANGES_REQUIRED`：reviewer 要求修改，或存在已確認 mismatch。
- `REVIEWED_NO_BLOCKER`：必要 reviewer 均完成且沒有 blocker；只描述事實，不等同組織正式變更核准。
- `BLOCKED`：存在 contract mismatch、變更清單不完整、必要 runtime/deployment evidence 缺失等硬問題。

若公司流程另有正式 `APPROVED_FOR_MERGE` / 變更單核准狀態，只有讀到該正式證據時才能引用。

---

## Standard Deliverable Structure

### Default Output Policy

| Scope | 預設輸出 | UI Evidence |
|---|---|---|
| 含 UI／操作畫面 | **DOCX** | Before + After 必備；視覺無差異也要保留並說明 |
| 純後端／無畫面 | Markdown | `N/A` |
| 使用者明確指定格式 | 依使用者指定 | 仍依 scope 保留必要 Evidence |

DOCX 產出時必須沿用 `system-documentation` 的 production workflow：內容組裝後實際 Render，檢查圖片、表格、空白頁、中文字型與敏感資料；不能只產生檔案就宣告完成。

正式變更覆核文件建議固定使用：

```text
1. 文件資訊與 Base / Target
2. 本次變更摘要
3. 完整 Changed File Inventory
4. 逐檔、逐 Change Block Diff 與修改原因
5. Cross-Layer / DB / Procedure / API / Config 相依矩陣
6. UI Before / After（適用時）
7. 測試與 Runtime Evidence
8. 風險、Rollback、待確認事項
9. SA / PM Review Record
10. Pre-Merge / Pre-Change Gate
Appendix A. Full Diff / Patch Evidence
Appendix B. Screenshot Evidence
Appendix C. Deployment / DB Script Evidence
```

同一份文件若使用 DOCX/PDF，沿用 `system-documentation` 的 Evidence、Fidelity、Render、Redaction QA。

---

## Anti-Patterns

以下情況視為不合格：

- 只貼 `git diff`，沒有逐段修改原因。
- 只列 Java / frontend 檔，漏掉 Procedure、SQL、DDL、config、batch 或 deployment artifact。
- 只看測試環境狀態，就寫其他環境「已完成」。
- UI 有改卻只放 After，沒有 Before 或缺版本來源。
- 沒有 UI 改動卻硬塞示意圖當證據。
- SA / PM 尚未回覆，文件先寫「已確認沒問題」。
- Reviewer 核過 v1，但 target commit 已變成 v2，仍沿用舊核准。
- Branch name 相同就假設內容沒變，不記 exact SHA。
- 大型 diff 只寫「優化邏輯」「調整參數」等無法追責的模糊理由。

---

## Stop / Block Conditions

遇到以下狀況可以產出部分文件，但不能宣稱 review package 完整：

- 無法確認 Base 或 Target。
- 權威 changed-file inventory 無法取得。
- 某個 Change Block 無法從需求、issue、程式流程或使用者決策確認修改原因。
- Caller / Procedure / API / schema contract 無法對上。
- UI 確實有改，但必要 Before / After 證據尚未取得。
- 預定部署環境的 DB / config / migration 狀態無法確認。
- SA / PM 尚未實際覆核。

此時明確列出缺口與下一個可驗證動作，不補猜測。

---

## Delivery Report

完成時短回報：

```text
Change Review：<DRAFT / READY_FOR_REVIEW / CHANGES_REQUIRED / REVIEWED_NO_BLOCKER / BLOCKED>
Compare：<Base SHA/version> -> <Target SHA/version>
Files：<documented>/<authoritative total>
Change Blocks：<documented>/<total>
Cross-layer：<Verified / Pending / Mismatch>
UI：<Before+After / N/A / Pending>
Verification：<PASS / Partial / Not Run>
SA：<Pending / Reviewed / ...>
PM：<Pending / Reviewed / ...>
Output：<UI scope 預設 DOCX；Non-UI scope 預設 MD；或使用者指定格式>
Open Items：<若無則寫無>
```
