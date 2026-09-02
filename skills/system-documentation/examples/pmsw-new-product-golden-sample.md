# Golden Sample — PMSW 新品提報操作手冊

> 用途：記錄 `system-documentation` 第一個經使用者與實際業務使用者確認可接受的案例規則。此檔不是 PMSW 規格，也不保存正式帳號、路徑、客戶資料或完整文件內容。

## Case

文件類型：

- 操作手冊
- 流程解說
- 程式碼還原畫面

交付格式：

- DOCX
- PDF

## 驗證後保留的關鍵方法

### 1. 先做錯的方式

第一次只依功能欄位與流程自行重畫 UI，雖然流程內容接近正確，但把 Legacy 系統視覺改成現代化卡片/漸層樣式。

這不符合「既有系統操作手冊」的忠實性要求。

### 2. 修正方式

重新追：

- 外層 Portal / Frame 的實際截圖。
- `index.jsp` / `top.jsp` / `Menu.jsp` 等外框來源。
- 功能頁 JSP 與 include。
- Global CSS。
- Channel-specific CSS。
- 原始 GIF / PNG / background image。
- JavaScript 的必填、唯讀、頁籤與連動。
- Action / SQL 中的實際狀態文字。

### 3. Portal 與功能頁分層

案例中，外層 Portal 的完整來源不全在功能 repo，因此：

- 外層 Portal：以使用者提供的實際畫面為最高依據。
- PMSW 功能內頁：以 repo 的 JSP/CSS/JS/asset 為最高依據。

不可把兩層重新設計成新的統一 UI。

### 4. Legacy 視覺要保留

經確認可接受的版本保留：

- 舊式固定寬度版面。
- 左側功能選單。
- 原始 Banner / icon。
- table-based form。
- 原始按鈕色彩與 border。
- 通路專屬 CSS。

文件可以加步驟標記，但 UI 本身不能現代化。

### 5. 範例資料與敏感資料

畫面中的帳號、廠編、條碼、商品名稱、價格與門市數量使用虛構值；不放正式密碼或客戶資料。

### 6. 狀態與流程要從程式取證

狀態文字不是自行整理成「看起來比較漂亮」的名稱，而是直接對回 SQL CASE / Action / JSP 顯示文字。

### 7. 文件 QA

最終交付前完成：

- DOCX render。
- 逐頁檢查圖片與表格。
- 修掉不必要空白頁與孤立注意框。
- PDF 再獨立逐頁 render 檢查。
- 確認 DOCX/PDF 內容一致。

## Golden Rules Extracted

1. 功能正確不代表畫面可以重新設計。
2. 既有系統操作手冊的 UI 以忠實重現為優先。
3. 實際 Screenshot 與 repo source 若屬不同 UI ownership，要分層處理。
4. 找到 JSP 不等於找完整畫面；CSS、JS、asset、include、Frame 都要追。
5. 程式碼還原畫面必須明確標示，不冒充 Runtime screenshot。
6. 文件排版可改善，系統 UI 不可美化。
7. 正式交付物必須 Render QA，不只確認檔案能產出。
