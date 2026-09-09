# Production Workflow — 忠實系統文件 DOCX/PDF 產出流程

本流程來自已實際完成並經使用者/業務使用者確認的 PMSW 新品提報操作手冊。用途是把最後成功的「分析 → 還原畫面 → DOCX → PDF → 逐頁 QA」過程固定化。

## Goal

輸出可直接交付的系統文件，且同時滿足：

1. 流程與規則有原始碼/設定/Schema/Runtime 證據。
2. 功能截圖忠實呈現既有系統，不自行美化。
3. 正式資料已遮罩或替換成虛構測試資料。
4. 使用者要求的 DOCX 可編輯。
5. 使用者要求的 PDF 可直接發布。
6. 每個要求格式都完成最低可交付 QA；已驗證格式立即交付，不等待非必要美化。

---

## Phase 0 — 確認文件任務

先確認：

- 文件主題與功能範圍。
- 通路 / 角色 / 模組。
- 要從哪個入口開始（例如登入）。
- 是否需要操作畫面。
- 輸出格式：DOCX、PDF 或兩者。
- 是否已有實際畫面可作 Fidelity reference。

如果使用者已明確提供以上資訊，不重複詢問。

### 0.1 Work mode 雙路徑

先保留同一份 Skill / Capability，再選執行環境：

- Work mode 成功轉入：在 Work mode 依本流程完成產出、驗證與交付。
- Work mode 不可用、轉入失敗、被拒絕或使用者留在目前對話：立即以目前對話可用工具依本流程繼續，不重複要求切換。

兩條路使用相同的 QA Gate、Artifact lifecycle 與交付規則。

---

## Phase 1 — 功能盤點與 Active Path Trace

不要先寫手冊。先把功能跑通在「證據層」。

### 1.1 找入口

依專案實際框架追：

- Menu / Portal / Route。
- Struts XML / Spring Mapping / Servlet Mapping。
- JSP / HTML / Vue / React route。
- Batch main / Scheduler / CLI。

### 1.2 追完整路徑

至少追到：

`UI -> Action/Controller -> Service -> DAO/SQL -> Table/Trigger/Side Effect`

必要時再追：

- Mail。
- PDF/Excel。
- External API。
- File upload/download。
- History table。
- Trigger / Procedure。

### 1.3 收集狀態與業務文字

狀態名稱優先從：

- JSP 顯示文字。
- enum / constant。
- SQL CASE。
- Action/Service message。
- 實際畫面。

取得。

不得把狀態自行改成較好看的名稱。

---

## Phase 2 — UI Source Walk

這是忠實截圖的核心步驟。

### 2.1 先判斷 UI ownership

確認：

- 外層 Portal 是否在同一 repo。
- 功能頁是否在 frame / iframe 裡。
- 登入頁、Menu、Banner 是否由另一個系統提供。

若外框不在 repo，但使用者有提供實際截圖：

- 外框以實際截圖為最高依據。
- 功能內頁以功能 repo 原始碼為依據。

### 2.2 找 JSP/HTML 本體

記錄：

- 頁面檔案。
- include / partial / tag file。
- form action。
- button label。
- field label。
- tab。
- hidden field。

### 2.3 找 CSS

依實際引用順序讀：

- global CSS。
- module CSS。
- channel/theme CSS。
- inline CSS。

特別記錄：

- width / height。
- background。
- border。
- font。
- table header / cell style。
- button style。
- required mark。

### 2.4 找原始圖片資源

包含：

- GIF Banner。
- PNG/JPG。
- background image。
- icon。
- sprite。
- spacer image（Legacy UI 可能影響 layout）。

可直接使用原資產時，不自行重畫。

### 2.5 找 JavaScript 畫面邏輯

確認：

- show / hide。
- readonly / disabled。
- required。
- dependent dropdown。
- tab removal / insertion。
- calculation。
- validation message。

畫面還原必須反映這些邏輯。

---

## Phase 3 — 選擇截圖產生方式

依可信度選：

### A. 實際系統截圖

若可登入並取得實際畫面：直接用實際畫面，遮罩敏感資料。

### B. Runtime Render

若專案可在測試環境或本機啟動：使用真實 JSP/CSS/asset + 測試資料 Render。

### C. Code-backed Reconstruction

若環境無法啟動：

1. 以實際 JSP/HTML 結構建立可 Render 頁面。
2. 套用實際 CSS 規則。
3. 使用原始圖片資源。
4. 重現 frame / fixed width / table layout。
5. 依 JS 邏輯決定可見欄位與 readonly 狀態。
6. 以合法虛構值填動態欄位。
7. 在文件標註「依程式碼還原畫面」。

### D. 示意圖

只有使用者接受、且無足夠來源時才用。

---

## Phase 4 — 建立功能截圖

每個操作節點至少產一張足以讓讀者定位的圖。

典型操作手冊畫面集合：

1. 登入。
2. 登入後主選單 / 功能入口。
3. 查詢頁。
4. 新增頁上半部。
5. 新增頁下半部 / 價格 / 圖片。
6. 送出 / 暫存位置。
7. 狀態查詢。
8. 退回/重送。
9. 特殊頁籤或通路專屬欄位。
10. 審核歷程 / 進度。

### Screenshot Annotation

可疊加：

- ①②③。
- 箭頭。
- 紅框。
- 說明泡泡。

但不得移動原 UI 元件或重排畫面。

---

## Phase 5 — 建立流程圖

流程圖是「文件輔助圖」，可以採清楚的現代文件樣式；它不是系統 UI，因此可重新排版。

流程圖需包含：

- 起點。
- 主流程。
- 重要狀態。
- 退回 / 重送分支。
- 完成條件。

不要把未驗證分支加入流程圖。

---

## Phase 6 — 組 DOCX

正式 DOCX 建議包含：

### 6.1 封面

- 系統名稱。
- 文件名稱。
- 模組/通路。
- 文件版本。
- 日期。
- 「程式碼還原版」等必要標示。

### 6.2 文件說明

明確區分：

- 哪些是實際畫面。
- 哪些是程式碼還原畫面。
- 哪些資料是虛構測試值。

### 6.3 共通流程

若文件有多通路/角色，先寫：

- 登入。
- 功能入口。
- 權限差異。

### 6.4 各功能章節

每小節建議固定格式：

1. 小節目的。
2. 功能畫面。
3. 編號操作步驟。
4. 欄位/按鈕表。
5. 注意事項。
6. 預期結果。

### 6.5 狀態表

狀態需對回程式來源；如內部代碼可確認，可附：

`internal status -> user-visible status -> allowed action`

### 6.6 程式來源索引

若讀者是工程/維運人員，可在最後列：

- JSP。
- Action/Controller。
- Service。
- DAO/SQL。
- Schema / Trigger。

---

## Phase 7 — DOCX 最低可交付 QA

文件狀態從 `DRAFT` 開始。DOCX 產出後做一次必要 Render QA，不以單純美觀問題延長交付。

### 阻塞交付的重大問題

- 文件無法正常開啟或 Render。
- 文字、圖片或流程圖被截斷。
- 表格超出版面或嚴重錯位。
- 出現真正空白頁。
- 中文字型異常或缺字，影響閱讀。
- 使用者要求的內容、標題或章節缺漏。
- 存在未處理的密碼、Token、個資或敏感資料。

若發現上述問題，修正後只重驗受影響部分。驗證通過後標記 `VALIDATED`。

### 不阻塞第一版交付的項目

- 2 頁或 3 頁的差異。
- 最後一頁只有少量內容，但不是空白頁。
- heading 位置、段距、cell margin 還能更漂亮。
- 圖片大小仍可微調，但目前可閱讀。
- 版面還能進一步壓縮。

### 實際成功案例的必要修正方式

PMSW 案例中曾出現章節強制換頁造成整頁留白、注意框被推到獨立頁、步驟編號跨章節延續。對真正影響閱讀或內容正確性的問題，可採：

- 移除造成空白頁的非必要 `page_break`。
- 注意框 table row 設 `cantSplit`。
- 每小節用明確數字文字重新從 1 編號，不依賴 Word 自動 List Number 延續狀態。

保留合理留白，不為了減頁數破壞閱讀性。

---

## Phase 8 — 已驗證版本立即交付

DOCX 進入 `VALIDATED` 後立即轉成 `DELIVERED`，提供可使用的下載入口。不要因頁數、spacing、cell margin 或其他非阻塞美化延後第一版。

長流程在此至少回報：

```text
第一版文件已成功產出，內容完整，最低版面驗證已通過。
文件已可使用；若後續仍有處理，只剩其他指定格式或選擇性版面微調。
```

如果使用者只要求 DOCX，主要交付到此完成。

---

## Phase 9 — PDF 產出（使用者有要求時）

只有使用者要求 PDF 時，才由最新已 `VALIDATED` 的 DOCX 輸出 PDF。

確認：

- PDF 來源是目前已驗證 DOCX。
- DOCX 若因重大問題修正，PDF 隨最新版本重產。
- PDF 與 DOCX 使用同一內容來源。

已交付的 DOCX 不因 PDF 尚在轉檔而撤回或延後。

---

## Phase 10 — PDF 最低可交付 QA 與交付

PDF 做一次必要逐頁 QA：

- 無空白頁。
- 文字、圖片、表格沒有被切掉。
- 中文沒有缺字或異常替換。
- Screenshot 字仍可閱讀。
- PDF 與最新 DOCX 內容一致。

若有重大問題，修正並重驗受影響部分。通過後立即交付 PDF。頁數是否能再壓縮、最後一頁是否偏少，不影響 PDF 第一版交付。

---

## Phase 11 — 選擇性 POLISHING

只有以下條件成立才進入 `POLISHING`：

- 使用者要求調版。
- 發現真正的重大排版錯誤。
- 版面嚴重影響閱讀。
- 格式與使用者指定範本不符。

每一輪 Polish 都要綁定一個明確問題或使用者要求。修正後只重驗受影響格式。單純「3 頁可以壓成 2 頁」不是阻塞條件。

同一文件的 Artifact lifecycle 固定為：

`working draft -> QA render -> final artifact`

QA 用 PDF/PNG 是工作產物，不建立成多個看似正式的下載版本。

### Delivery 回報

交付時提供使用者實際要求的格式、文件模式、UI 證據類型、QA 狀態、未驗證項目與可用下載入口。

建議短格式：

```text
文件模式：操作手冊
UI：依 JSP/CSS/JS/原始圖片忠實還原
狀態：DELIVERED
輸出：DOCX（已提供下載入口）；PDF（若有要求則另行驗證後交付）
QA：Evidence PASS / Fidelity PASS / DOCX Render PASS / Redaction PASS
未驗證：無
```

---

## Anti-Pattern Checklist

遇到以下行為立即停止並修正：

- 看到欄位名稱後自己設計一個更漂亮的頁面。
- 只讀 JSP，不讀 CSS/JS/asset。
- 把檔案存在誤判成現行功能已啟用。
- 把程式碼還原畫面叫「實際系統截圖」。
- 只產 DOCX/PDF，不做最低可交付 Render QA。
- 已達 `VALIDATED`，仍因頁數、最後一頁偏少、spacing 或 cell margin 延後交付。
- 在 QA 過程反覆建立多個看似正式的 Artifact。
- 為了減頁數把操作畫面縮到看不清楚。
- 正式畫面直接帶真實密碼或敏感資料。

---

## Definition of Done

只有以下適用項目全部成立才算完成：

- [ ] Active path 已追。
- [ ] UI source walk 已完成（文件需要 UI 時）。
- [ ] 截圖 Fidelity 已驗證（文件需要 UI 時）。
- [ ] 流程文字與狀態有 Evidence。
- [ ] 使用者要求的文件格式已產出。
- [ ] 每個要求格式都完成最低可交付 QA。
- [ ] 第一個 `VALIDATED` 的可用格式已立即 `DELIVERED`，沒有等待非必要美化。
- [ ] 使用者要求 PDF 時，PDF 由最新已驗證 DOCX 產出並完成最低 QA。
- [ ] 敏感資料已檢查。
- [ ] 未驗證事項已揭露。

`POLISHING` 是完成交付後的選擇性狀態，不是 Definition of Done 的必要條件。
