---
type: after-action
date: 2026-04-27
topic: "DOCX 書籍化、目錄更新與版面驗證"
tags: [docx, cover, toc, word-com, artifact-tool, validation, pixiu]
---

# DOCX 書籍化、目錄更新與版面驗證

## 背景

使用者希望 `CCA-F深度教科書.docx` 更像一本正式參考教學書，因此要求補強內容、加封面、加目錄，並在完成後將經驗回寫母體。

## 碰到的問題

1. 原始 DOCX 有重複 Heading 樣式：
   - `Heading1`
   - `Heading2`
   - `Heading3`
2. artifact-tool 對重複樣式會失敗：
   - `Argument_AddingDuplicateWithKey, Heading1`
3. 對 `styles.xml` 直接去重後，Word 可能回報檔案毀損。
4. 本機 artifact-tool 連最小 DOCX 也失敗，不能把所有渲染失敗都歸因於文件內容。
5. `pdf2image` 缺 Poppler，無法直接 PDF→PNG。
6. Chrome headless 在 sandbox 下啟動會 `spawn EPERM`，需 escalated 執行。

## 當次修正

- 改用乾淨 `Document()` 重建文件。
- 抽取原文件段落與表格，重新套入乾淨樣式。
- 在第一頁建立封面。
- 在第二頁建立 Word TOC field。
- 用 Word COM 更新 TOC 欄位、儲存 DOCX、匯出 PDF。
- 用 Chrome headless 開啟 PDF，截取封面與目錄頁做視覺檢查。

## 後續標準

以後遇到「教材型 / 書籍型 DOCX」：

1. 不直接覆蓋原檔，先產出副本。
2. 優先建立封面與目錄。
3. 目錄用 Word TOC field，不用靜態手寫。
4. 必須用 Word 更新欄位後再交付。
5. artifact-tool 失敗時，先用最小 DOCX 測試工具鏈是否正常。
6. 若 artifact-tool 不可用，改用 Word 匯出 PDF + Chrome 截圖作為替代 QA。
7. 不建議直接手修 `styles.xml` 去重，除非已另存備份並能用 Word 開啟驗證。

## 驗證紀錄

- DOCX：`%USERPROFILE%\Documents\Playground\out\CCA-F深度教科書_深度補強版.docx`
- PDF：`%USERPROFILE%\Documents\Playground\out\CCA-F深度教科書_深度補強版.pdf`
- PDF 頁數：82
- 已檢查：
  - 封面頁
  - 目錄頁
  - 前段正文代表頁
  - 深度補充篇代表頁
  - 附錄來源頁
