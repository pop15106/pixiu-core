# Production Workflow — 忠實系統文件 DOCX/PDF 產出流程

本流程來自已實際完成並經使用者/業務使用者確認的 PMSW 新品提報操作手冊。用途是把最後成功的「分析 → 還原畫面 → DOCX → PDF → 逐頁 QA」過程固定化。

## Goal

輸出可直接交付的系統文件，且同時滿足：

1. 流程與規則有原始碼/設定/Schema/Runtime 證據。
2. 功能截圖忠實呈現既有系統，不自行美化。
3. 正式資料已遮罩或替換成虛構測試資料。
4. DOCX 可編輯。
5. PDF 可直接發布。
6. 兩種格式都經實際 Render QA。

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

## Phase 7 — DOCX 第一次 Render QA

**不能只確認 DOCX 已生成。**

實際把 DOCX Render 成 PDF/PNG 頁面，再逐頁看。

檢查：

- 圖片是否太小。
- 截圖字是否可讀。
- 表格是否超出頁面。
- heading 是否孤立在頁尾。
- 注意框是否被拆成兩頁。
- 是否出現一頁只剩 1~3 行文字。
- 是否有不必要空白頁。
- 流程圖是否被裁切。
- 中文字型是否正常。

### 實際成功案例的修正方式

PMSW 案例中曾出現：

- 章節強制換頁造成整頁留白。
- 黃色注意框被推到獨立頁。
- 步驟編號跨章節延續。

修正策略：

- 移除非必要 `page_break`。
- 注意框 table row 設 `cantSplit`。
- 每小節用明確數字文字重新從 1 編號，不依賴 Word 自動 List Number 延續狀態。
- 保留合理留白，不為了塞滿頁面破壞閱讀性。

Render 後再重新檢查。

---

## Phase 8 — 產 PDF

DOCX QA 通過後，再由**最終 DOCX**輸出 PDF。

禁止：

- 用舊版 DOCX 產 PDF。
- DOCX 修過後忘記重產 PDF。
- PDF 與 DOCX 使用不同內容來源。

---

## Phase 9 — PDF 獨立逐頁 QA

PDF 需要再 Render 成圖片，逐頁檢查。

原因：DOCX Render 正常，不代表最終 PDF 一定正常。

逐頁檢查：

- 頁數。
- 空白頁。
- 字型替換。
- 中文缺字。
- 圖片縮放。
- 表格線。
- page break。
- 截圖清晰度。
- 圖說與圖片是否分離。

若任何一頁有問題：回 DOCX/產生腳本修正，再重走 Phase 7~9。

---

## Phase 10 — Redaction QA

最後檢查：

- 密碼。
- Token。
- API Key。
- 個資。
- 真實供應商/客戶敏感資料。
- 正式交易資料。

範例資料應清楚是虛構值。

---

## Phase 11 — Delivery

交付時至少提供：

- DOCX。
- PDF。
- 文件模式。
- UI 證據類型。
- QA 狀態。
- 未驗證項目。

建議短格式：

```text
文件模式：操作手冊
UI：依 JSP/CSS/JS/原始圖片忠實還原
輸出：DOCX + PDF
QA：Evidence PASS / Fidelity PASS / DOCX Render PASS / PDF Render PASS / Redaction PASS
未驗證：無
```

---

## Anti-Pattern Checklist

遇到以下行為立即停止並修正：

- 看到欄位名稱後自己設計一個更漂亮的頁面。
- 只讀 JSP，不讀 CSS/JS/asset。
- 把檔案存在誤判成現行功能已啟用。
- 把程式碼還原畫面叫「實際系統截圖」。
- 只產 DOCX/PDF，不 Render QA。
- 為了減頁數把操作畫面縮到看不清楚。
- 正式畫面直接帶真實密碼或敏感資料。

---

## Definition of Done

只有以下全部成立才算完成：

- [ ] Active path 已追。
- [ ] UI source walk 已完成。
- [ ] 截圖 Fidelity 已驗證。
- [ ] 流程文字與狀態有 Evidence。
- [ ] DOCX 已產出。
- [ ] DOCX 已 Render 並逐頁 QA。
- [ ] PDF 由最終 DOCX 產出。
- [ ] PDF 已獨立 Render 並逐頁 QA。
- [ ] 敏感資料已檢查。
- [ ] 未驗證事項已揭露。
