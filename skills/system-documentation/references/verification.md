# Verification Checklist

正式交付文件前使用。若 Host 有 DOCX/PDF render 工具，以實際 Render 結果為準，不只檢查檔案是否存在。

## A. Evidence QA

- [ ] 每個主流程步驟可對回入口、畫面或程式來源。
- [ ] 關鍵狀態名稱有 enum / SQL CASE / 畫面 / 正式文件支持。
- [ ] 必填、唯讀、show/hide 有 JSP/JS/validator/server condition 支持。
- [ ] DB side effect 有 DAO/SQL/Procedure/Trigger 支持。
- [ ] 「現行啟用」功能有 route/include/config/runtime evidence，不只因檔案存在。
- [ ] 來源衝突已揭露。
- [ ] 若文件含 To-Be，As-Is 事實與 To-Be 目標已分開標示，未把尚未實作內容寫成現況。

## B. UI Fidelity QA

- [ ] 使用的是實際 CSS / asset，而不是自行配色。
- [ ] Portal shell 與內頁 ownership 沒有混淆。
- [ ] 原本 Legacy layout 沒被現代化。
- [ ] 按鈕、欄位、Tab、狀態文字與來源一致。
- [ ] Dynamic data 使用假資料時已標示。
- [ ] 程式碼還原畫面沒有被寫成「正式實際截圖」。

## C. Flow QA

- [ ] 從登入/入口可一路走到主流程結果。
- [ ] 暫存 / 送出 / 核准 / 退回 / 重送 / 取消等適用分支已覆蓋。
- [ ] 每一步都有「使用者動作」和「預期結果」。
- [ ] 角色不同造成的畫面/權限差異有說明。
- [ ] 狀態轉換前後一致。

## D. Document QA

- [ ] 文件標題與版本正確。
- [ ] 圖號與圖說連續。
- [ ] 表格沒有不必要斷列。
- [ ] 章節順序符合讀者視角。
- [ ] 專有名詞首次出現有必要說明。
- [ ] 程式路徑、Table、Action 名稱拼字正確。
- [ ] 文件內沒有把待確認事項寫成既定事實。
- [ ] To-Be 需求/變更規格有可追溯需求來源、Before/After 與可測試驗收條件。

## E. DOCX Render QA

- [ ] DOCX 可正常開啟。
- [ ] 實際 render 全頁。
- [ ] 圖片沒有拉伸、裁切、模糊到無法閱讀。
- [ ] 表格沒有超出頁面。
- [ ] 沒有孤立一兩行造成不必要空白頁。
- [ ] 中文字型正常。
- [ ] TOC / page number（若有）可使用。

## F. PDF QA

逐頁檢查：

- [ ] Page count 合理。
- [ ] 無全白/近乎全白頁。
- [ ] 圖片與文字沒有被切掉。
- [ ] 表格線與欄位對齊。
- [ ] 中文沒有方框或缺字。
- [ ] Screenshot 字仍可讀。
- [ ] DOCX 與 PDF 內容一致。

## G. Redaction QA

- [ ] 無正式密碼。
- [ ] 無 Token / API key / secret。
- [ ] 無未遮罩個資。
- [ ] 無不必要的正式客戶資料。
- [ ] 測試帳號與測試資料看得出是示例。

## H. Delivery Gate

只有以下條件成立才可說「完成」：

1. 使用者要求的文件格式已產出。
2. Evidence QA 沒有未揭露的重大缺口。
3. 若需要 UI，Fidelity QA 通過。
4. DOCX/PDF 已實際 Render 或 Host 明確無法 Render 且已回報。
5. 已列出所有未驗證項目。

建議回報：

```text
QA：Evidence PASS / Fidelity PASS / DOCX Render PASS / PDF Render PASS / Redaction PASS
未驗證：無
```
