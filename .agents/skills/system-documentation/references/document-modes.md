# Document Modes

本檔定義 `system-documentation` 的文件模式。使用者可一次要求一種或多種模式；優先合併成一份可讀文件，不機械拆檔。

## 1. 操作手冊 / SOP

適用：教使用者如何完成一個既有系統流程。

必要章節：

1. 文件目的與適用對象。
2. 前置條件、帳號/角色/權限。
3. 登入與功能入口。
4. 主流程圖。
5. 逐步操作：每步包含「做什麼、在哪裡、輸入什麼、按哪個按鈕、預期結果」。
6. 關鍵畫面：實際截圖或明確標示的程式碼還原畫面。
7. 狀態與後續流程。
8. 退回、失敗、重送、取消等例外流程。
9. 常見問題與注意事項。
10. 來源與版本基準。

若是 Legacy UI，保留原畫面樣式；文件可加箭頭、框線、步驟編號，但不得重新設計 UI。

## 2. 受測 / 測試文件

適用：SIT/UAT/複測、修正驗證、回歸測試、交付資安/QA 的受測說明。

必要章節：

1. 受測目的與版本。
2. Scope / Out of Scope。
3. 前置資料與環境。
4. Test Case 編號與對應需求。
5. 操作步驟。
6. 預期畫面/狀態。
7. DB / Log / 檔案 / API 驗證點。
8. 負向與邊界情境。
9. 回歸範圍。
10. 測試結果與 Evidence 欄位。

每個 Test Case 至少要能回答：Given / When / Then / Evidence。

## 3. As-Is 功能規格

適用：沒有完整 Spec 的舊系統，要從程式還原目前實際規格。

必要章節：

1. 業務目的。
2. 使用角色與權限。
3. 功能入口。
4. 主流程與狀態機。
5. 輸入欄位、必填、格式、預設值、唯讀條件。
6. 業務規則與檢核。
7. 輸出 / Side Effect。
8. 例外處理。
9. 程式 Evidence chain。
10. DB / Schema / Trigger。
11. 外部介接與批次。
12. 已知限制與待確認事項。

需明確標示「As-Is 現況規格」，避免被誤認為新需求設計。

## 4. To-Be 需求 / 變更規格

適用：需求訪談、變更單、功能調整、修正案或新版本規格，需要清楚描述「目前怎麼做」與「改完要怎麼做」。

必要章節：

1. 需求背景與目標。
2. 需求來源 / 版本 / 提出者提供的依據。
3. As-Is 現況基準與已確認限制。
4. Scope / Out of Scope。
5. Before / After 流程。
6. 新增、修改、刪除的業務規則。
7. 畫面、欄位、必填、預設值、狀態或權限差異。
8. 程式、DB、API、批次、報表、外部介接影響。
9. 相容性、資料轉換與回滾注意事項。
10. 驗收條件與受測案例對應。
11. 風險、依賴與待確認事項。

### To-Be Source Discipline

- **As-Is**：必須由現行程式、設定、Schema、Runtime 或正式文件支持。
- **To-Be**：必須由使用者明確需求、需求單、變更單、核准規格或可追溯決策支持。
- 尚未實作的 To-Be 行為只能寫成「預期／目標／變更後」，不得寫成「系統目前會」。
- 若需求與現況衝突，保留差異並標示需要決策，不自行替使用者選一邊。
- 驗收條件應能直接轉成受測文件的 Given / When / Then / Evidence。

## 5. 現有系統 / 模組解說

適用：新人交接、架構理解、維運盤點。

必要章節：

1. 系統定位。
2. 模組責任。
3. 角色與入口。
4. 關鍵 Use Case。
5. 技術架構。
6. UI -> Server -> Data 流程。
7. 核心 Table / Queue / File / External System。
8. 排程、批次與維運入口。
9. 常見故障與診斷點。
10. 風險與技術債（若來源支持）。

## 6. 程式流程 / 資料流文件

適用：追一支功能、報表、批次、SQL 或 Exception。

必要章節：

1. 入口。
2. Request / Input。
3. Controller / Action / Servlet。
4. Service / Transaction。
5. DAO / Mapper / SQL / Procedure。
6. Table / History / Trigger。
7. Output / Side Effect。
8. Error path。
9. Runtime Evidence。

優先用 Evidence chain，不要只貼程式碼。

## 7. 變更影響文件

適用：既有功能修改前後的影響分析。

必要章節：

1. 變更摘要。
2. Before / After。
3. Caller / Callee。
4. 共用模組。
5. DB / Report / Batch / API 影響。
6. 權限與安全影響。
7. 回歸測試範圍。
8. Rollback / Recovery 注意事項。

## 8. 交接文件

適用：把一個功能交給下一位工程師或維運人員。

必要章節：

1. 功能目的。
2. 使用者操作摘要。
3. 程式入口與主要檔案。
4. DB / 外部系統。
5. 部署 / 執行 / 排程方式。
6. 已知問題。
7. Debug 順序。
8. 修改注意事項。
9. 待辦與未驗證項目。

## 9. API / 外部介接規格

必要章節：

- Endpoint / Protocol / Direction。
- Authentication / Authorization。
- Request / Response Schema。
- Field mapping。
- Timeout / Retry / Idempotency。
- Error code。
- Data persistence。
- Security / Redaction。
- Example payload（使用假資料）。

## 10. DB / Schema / Trigger 解說

必要章節：

- Table purpose。
- PK / FK / Unique key。
- 重要欄位語意。
- 寫入/查詢來源。
- Trigger / Procedure side effect。
- History / audit behavior。
- Transaction / commit boundary（可確認時）。
- 對應 UI / Use Case。

## 11. 教育訓練教材

適用：讓新人理解，而不是只供工程師查閱。

建議組合：

`白話目的 -> 一張總流程圖 -> 實際操作 -> 角色/狀態 -> 系統怎麼處理 -> 常見錯誤 -> 小測驗/情境題（使用者需要時）`

教育訓練可降低術語密度，但不得改變實際規則。