---
name: system-documentation
description: "Use when producing source-backed documentation for an existing system or planned change: 操作手冊、操作流程、受測/測試文件、As-Is 功能規格、To-Be 需求/變更規格、模組解說、系統解說、程式流程、交接文件、API/DB 說明、變更影響文件；尤其適用於需要忠實還原既有 UI，或從 UI/Route 追到 Action/Controller、Service、DAO/SQL、Table/Trigger 的任務。"
version: 1.1.0
origin: Pixiu
---

# System Documentation

把「看現有系統後寫文件」標準化成可驗證流程。目標不是把文件寫得漂亮，而是讓讀者看到的流程、畫面、欄位、狀態、規則與程式實際行為一致。

## Core Contract

1. **Source-backed first**：As-Is 內容必須以原始碼、設定、Schema、正式文件、Runtime 或實際畫面為證據；To-Be 內容必須有使用者明確需求、需求/變更單、核准規格或可追溯決策支持；記憶與推測只能當線索。
2. **Fidelity over beautification**：描述既有系統時，可以改善「文件」排版，但不得重新設計「受描述系統」的 UI。
3. **Evidence gaps stay gaps**：來源無法支持的欄位、流程、狀態、畫面或業務規則，明確標示「資料不足／待確認」，不得自行補完。
4. **Project facts stay outside core**：通路代碼、特殊 URL、特定 Table、Portal 外框、公司內部流程等屬 Project Profile，不寫死在本 Skill。
5. **Verification before delivery**：DOCX/PDF 或其他正式交付物完成後，必須做內容與版面 QA；未驗證部分需明確回報。

詳細規則依需要讀取：

- `references/document-modes.md`：各種文件模式與必要章節。
- `references/evidence-fidelity.md`：證據階層、Evidence Map、不可腦補規則。
- `references/ui-reconstruction.md`：既有 UI 忠實還原流程。
- `references/verification.md`：文件與畫面 QA。
- `references/project-profile-template.md`：專案特例如何外掛，不污染通用 Skill。
- `references/production-workflow.md`：本次已驗證成功的 DOCX/PDF 實際產出流程；需要正式交付文件時優先照此執行。
- `examples/pmsw-new-product-golden-sample.md`：已驗證的忠實介面案例。

## Stage 1 — 判斷文件模式

先從使用者需求判斷一個或多個模式：

- 操作手冊 / SOP
- 受測 / 測試文件
- As-Is 功能規格
- To-Be 需求 / 變更規格
- 現有系統 / 模組解說
- 程式流程 / 資料流文件
- 變更影響文件
- 交接文件
- API / 外部介接規格
- DB / Schema / Trigger 解說
- 教育訓練教材

同一份文件可以組合模式，例如「模組解說 + 功能規格 + 操作流程」。不要為了分類而拆成多份不必要文件。

## Stage 2 — 建立 Evidence Map

在開始撰寫結論前，先確認能回答下列哪些問題：

1. **系統入口**：Menu、Route、URL、Button、Command、Batch entrypoint 在哪裡？
2. **UI / Payload**：使用者看到什麼欄位、按鈕、頁籤？送出什麼資料？
3. **Server path**：Action / Controller / Servlet / Handler 到哪個 Service / Use Case？
4. **Data path**：DAO / Mapper / SQL / Procedure / Table / History / Trigger 如何運作？
5. **Side effect**：最後改了 DB、產檔、寄信、呼叫外部系統、變更狀態或列印什麼？
6. **Runtime evidence**：有實際畫面、Log、測試、查詢結果、正式文件或使用者驗證嗎？

若是 Legacy Java，沿用 `legacy-java-flow-tracing` 的 Evidence chain：

`UI/route -> controller/action -> service -> DAO/SQL -> table/history/trigger/report -> runtime evidence`

不要只看單一 JSP、Action、Service 或 SQL 就宣告完整流程。

## Stage 3 — 建立 Evidence Ledger

至少在內部維持以下欄位；正式文件可視需要呈現：

| Claim / 畫面 | Evidence | Confidence | Status |
|---|---|---:|---|
| 功能入口 | `Menu.jsp` / route config | High | Verified |
| 必填欄位 | JSP + JS validator | High | Verified |
| 狀態名稱 | SQL CASE / enum / actual screen | High | Verified |
| Portal 外框 | 實際截圖 | High | Verified |
| 動態門市清單 | runtime data unavailable | Medium | Example only |

Status 建議使用：`Verified`、`Derived`、`Requested To-Be`、`Approved To-Be`、`Example only`、`Needs runtime verification`、`Unsupported`。

## Stage 4 — UI 忠實還原

當文件需要流程實際畫面或程式碼還原畫面時，依此證據優先序：

1. **實際執行中的系統截圖**。
2. **正式/驗證環境實際 Render**。
3. **依實際程式資源忠實重建**：HTML/JSP、include、CSS、JavaScript、圖片、Frame/Portal shell、server-side 欄位來源。
4. **示意圖**：只有使用者接受時才使用，且必須標示為示意。

第 3 類畫面只能稱為「依程式碼還原畫面」或等義文字，不得稱為正式環境實際截圖。

### UI Fidelity Rule

忠實重建時至少檢查：

- 頁面外框 ownership：Portal / E-HUB / parent frame 是否屬於另一個系統。
- `JSP/HTML` 本體與所有 include。
- 實際引用的 `CSS`，包含 channel/theme 專屬樣式。
- `JavaScript` 動態 show/hide、必填、唯讀、連動、頁籤。
- 原始 GIF/PNG/JPG、背景圖、Banner、Icon。
- Frame / iframe / table-based layout / legacy fixed width。
- Server-side 動態清單與 Session 權限造成的差異。

**禁止用現代卡片、漸層、圓角、重排版等自行美化來替代原介面。**

若實際 Portal 截圖與 repo 內頁來源不同，外框以實際畫面為準，功能內頁以該 repo 的實際 JSP/CSS/JS 為準，並在文件註明證據來源差異。

## Stage 5 — 測試資料與敏感資料

文件畫面需要可讀資料時：

- 帳號、廠編、統編、條碼、價格、姓名、門市數量等使用虛構測試值。
- 不得把秘密、正式密碼、Token、客戶個資或未遮罩正式資料放入交付文件。
- 測試資料不得改變欄位語意；例如數字欄仍用合法數字格式。
- 動態資料來源無法確認時，標示「範例資料／實際以系統為準」。

## Stage 6 — 依文件模式組裝內容

依 `references/document-modes.md` 選擇必要章節。常見組合：

### 操作手冊

`目的 -> 登入/入口 -> 前置條件 -> 逐步操作 -> 每步畫面 -> 狀態/結果 -> 退回/例外 -> 常見問題`

### 受測文件

`範圍 -> 前置資料 -> Test Case -> 操作步驟 -> 預期結果 -> DB/Log/畫面驗證 -> 回歸範圍`

### As-Is 功能規格 / 模組解說

`業務目的 -> 角色/入口 -> 主流程 -> 規則 -> 欄位 -> 狀態 -> 程式 Trace -> DB/Trigger -> 外部介接 -> 例外 -> 維運注意`

### To-Be 需求 / 變更規格

`需求背景 -> 現況基準(As-Is) -> 變更目標 -> Scope/Out of Scope -> Before/After -> 新增或調整規則 -> 畫面/欄位/狀態差異 -> 程式/DB/API 影響 -> 驗收條件 -> 受測對應 -> 風險/待確認`

To-Be 規格必須把「現況事實」與「預期變更」分開標示；使用者需求、正式變更單或核准規格可以定義預期行為，但不得把尚未實作的 To-Be 行為寫成目前系統已存在。

不要把程式架構與使用者操作硬塞在同一層；同一文件內可分「使用者視角」與「技術視角」。

## Stage 7 — 文件輸出

使用者要求正式 DOCX/PDF 時，**先讀 `references/production-workflow.md`，照已驗證成功的端到端產出順序執行**。

同時優先重用 PixiuCore 已有能力，不另建重複產生器：

- DOCX：`skills/make-docx/SKILL.md`
- Markdown -> PDF：`skills/md2pdf/SKILL.md`
- 執行環境若有平台原生 DOCX/PDF 工具，依當前 Host 的文件產生規範執行。

文件排版本身可以採一致的專業樣式；**被嵌入的系統截圖不能因文件風格而被重新設計。**

## Stage 8 — QA Gate

交付前至少完成：

1. **Evidence QA**：每個關鍵流程、狀態、欄位與畫面有來源。
2. **Fidelity QA**：還原畫面沒有自行現代化或漏掉關鍵 CSS/asset。
3. **Flow QA**：入口到結果可連續操作，退回/失敗分支沒有被省略。
4. **Document QA**：標題、圖號、表格、頁碼、章節順序一致。
5. **Render QA**：DOCX 實際 Render；PDF 逐頁檢查裁切、空白頁、字型、圖片、表格。
6. **Redaction QA**：沒有正式密碼、Token、個資或敏感資料。

詳細 checklist 見 `references/verification.md`。

## Project Profile Contract

專案特例應由 repo 文件、Context 或一次性 Profile 提供。本 Skill 只定義欄位，不保存專案秘密。

建議 Profile 至少含：

- `systemName`
- `repoRoots`
- `entrypoints`
- `frameworks`
- `uiShellOwner`
- `uiAssetRoots`
- `schemaSources`
- `runtimeEvidenceSources`
- `knownAliases`
- `documentConstraints`

範本見 `references/project-profile-template.md`。

## Stop Conditions

遇到以下情況不要假裝完成：

- 只有 Action 名稱，找不到實際 JSP/Route，卻要寫完整操作手冊。
- 找到 JSP，但缺 CSS/JS/圖片，且使用者要求忠實截圖。
- 只有 Java Code，卻無法確認 Runtime 使用的是哪一分支/版本。
- DB 狀態語意無法從 SQL、enum、正式文件或畫面確認。
- Portal 外框不在 repo 內，且沒有實際畫面可對照。
- 要寫 To-Be 需求/變更規格，但沒有可追溯的需求來源或明確使用者決策。

此時輸出已確認部分，列出「缺什麼證據才能完成」，不要補畫。

## Delivery Report

完成時簡短回報：

```text
文件模式：<operation-manual / test-spec / functional-spec / ...>
Evidence：<主要來源>
UI：<實際截圖 / runtime render / 程式碼還原 / 無>
輸出：<DOCX/PDF/MD 路徑>
QA：<Evidence / Fidelity / Render / Redaction>
未驗證：<若無則寫無>
```
