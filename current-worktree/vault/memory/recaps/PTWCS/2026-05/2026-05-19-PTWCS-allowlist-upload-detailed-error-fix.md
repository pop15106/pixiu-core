---
type: session-recap
date: 2026-05-19
project: PTWCS
system: PTWCS
repo: PTWCS
topic: allowlist-upload-detailed-error-fix
status: done
tags: [recap, ptwcs, ptwcs-ap, upload, allowlist, error-message, spring-boot, react]
source_paths:
  - C:/Users/7010/Desktop/gravityTest/PTWCS/ptwcs_ap/view/ptwcs_react/src/view/upload/UploadFile.js
  - C:/Users/7010/Desktop/gravityTest/PTWCS/ptwcs_ap/view/ptwcs_react/src/components/SingleFileUploader.js
  - C:/Users/7010/Desktop/gravityTest/PTWCS/ptwcs_ap/view/ptwcs_react/src/hook/useAxios.js
  - C:/Users/7010/Desktop/gravityTest/PTWCS/ptwcs_ap/view/ptwcs_react/src/components/MyMessage.js
  - C:/Users/7010/Desktop/gravityTest/PTWCS/ptwcs_ap/src/main/java/com/tradevan/ptwcs/adapter/rest/UploadFileController.java
  - C:/Users/7010/Desktop/gravityTest/PTWCS/ptwcs_ap/src/main/java/com/tradevan/ptwcs/usecase/uploadfile/uploadAllowList/UploadAllowListUseCaseImpl.java
  - C:/Users/7010/Desktop/gravityTest/PTWCS/ptwcs_ap/src/main/java/com/tradevan/ptwcs/adapter/repository/UploadfileRepositoryImpl.java
  - C:/Users/7010/Desktop/gravityTest/PTWCS/ptwcs_ap/src/main/java/com/tradevan/ptwcs/adapter/entity/po/AcData.java
summary: 已修正 PTWCS 白名單上傳詳細錯誤改動造成的 compile failure，並確認 UI 到 repository 的錯誤訊息顯示鏈。
---

# PTWCS 白名單上傳詳細錯誤修正 Recap

## 觸發

使用者指出 `ptwcs_ap/src/main/java/com/tradevan/ptwcs/adapter/repository/UploadfileRepositoryImpl.java` 先前為了讓白名單上傳顯示詳細錯誤訊息而修改，但流程被改壞，需要確認白名單上傳完整流程與應顯示的錯誤訊息。

## 結論

這次實際壞點是後端 compile failure：`UploadfileRepositoryImpl.java` 新增的詳細驗證方法使用 `AcData::getWhCode` / `AcData::getAcId`，但檔案缺少 `com.tradevan.ptwcs.adapter.entity.po.AcData` import。

已修正：

- 在 `UploadfileRepositoryImpl.java` 補上 `import com.tradevan.ptwcs.adapter.entity.po.AcData;`
- 執行 `mvn -q -DskipTests compile` 通過

## 白名單上傳完整流程

前端：

- `ptwcs_ap/view/ptwcs_react/src/view/upload/UploadFile.js`
  - 「上傳白名單EXCEL」使用 `SingleFileUploader`
  - URL: `/upload/v1/excel_allowlist`
- `ptwcs_ap/view/ptwcs_react/src/components/SingleFileUploader.js`
  - 用 `FileReader` 將檔案轉 base64
  - POST payload: `{ base64File, fileName, ...additionalParams }`
- `ptwcs_ap/view/ptwcs_react/src/hook/useAxios.js`
  - API domain: `/APTWCS`
  - response `rtnCode !== "S0001"` 時丟出 `new Error(response.data.rtnMsg)`
  - `doError` 將 `e.message` 送到錯誤訊息顯示
- `ptwcs_ap/view/ptwcs_react/src/components/MyMessage.js`
  - 透過 Snackbar 顯示錯誤訊息

後端：

- 實際 URL: `/APTWCS/upload/v1/excel_allowlist`
- `ptwcs_ap/src/main/java/com/tradevan/ptwcs/adapter/rest/RestPath.java`
  - `UPLOAD = "/upload"`
  - `UPLOAD_PATH.EXCEL_ALLOWLIST = "/v1/excel_allowlist"`
- `ptwcs_ap/src/main/java/com/tradevan/ptwcs/adapter/rest/UploadFileController.java`
  - `uploadAllowListExcel(@RequestBody UploadAllowListInputDTO inputDTO)`
  - 先跑 `UnrestrictedFileUploadUtils.validateFileFromDTO(inputDTO)`
  - valid 時進 `restBoundary.presenter(() -> uploadService.uploadAllowListExcel(inputDTO))`
  - invalid 時回 HTTP 400 body `"Invalid file."`
- `ptwcs_ap/src/main/java/com/tradevan/ptwcs/adapter/service/uploadfile/UploadServiceImpl.java`
  - delegating 到 `uploadAllowListUseCase.uploadAllowListExcel(input)`
- `ptwcs_ap/src/main/java/com/tradevan/ptwcs/usecase/uploadfile/uploadAllowList/UploadAllowListUseCaseImpl.java`
  - sanitize filename
  - base64 decode
  - 寫入 temp Excel
  - `load(tempFile, fileName)` 解析 Excel
  - `checkService.handleError(input)` 做欄位檢核
  - 查 invalid IC / warehouse / access control point
  - `uploadfileRepository.insertIcAcSets(input.getIcAcSets())`
- `ptwcs_ap/src/main/java/com/tradevan/ptwcs/adapter/repository/UploadfileRepositoryImpl.java`
  - 查詢與 insert 白名單資料

資料表對應：

- `PTWCSMGR.IC_AC_SET`
  - 白名單寫入表
  - 欄位：`IC_NO`, `WH_CODE`, `AC_ID`, `UPDATE_USER`, `UPDATE_DATE`
- `PTWCSMGR.DOC_IC_SET`
  - IC 卡號來源
  - 欄位：`IC_NO`
- `PTWCSMGR.AC_DATA`
  - 貨棧與管制點來源
  - 欄位：`WH_CODE`, `AC_ID`, `CANCEL_MARK`

## 應顯示的錯誤訊息

業務例外會被 `RestBoundaryImpl` 捕捉，再由 `RestPresenterConfig` / `RestPresenterImpl` 放進 response `rtnMsg`。前端 `useAxios` 會把 `rtnMsg` 顯示在 Snackbar。

目前白名單上傳可顯示的主要錯誤：

- Excel 解析失敗：
  - `白名單excel解析失敗 ...`
- 必填欄位未填：
  - `必填欄位未填,Ic卡號`
  - `必填欄位未填,貨棧`
  - `必填欄位未填,管制點`
- IC 卡號不存在：
  - `以下 IC卡號 不存在於系統，共 N 筆：...`
- 貨棧代碼不存在或已註銷：
  - `以下 貨棧代碼 不存在或已註銷，共 N 筆：...`
- 管制點不存在或已註銷：
  - `以下 管制點 不存在或已註銷，共 N 筆：...`
- insert 失敗：
  - `白名單匯入失敗:...`

注意：controller 前段 `validateFileFromDTO` 失敗時目前回 HTTP 400 body `"Invalid file."`，這條不是 standard `rtnCode/rtnMsg` 格式；依現有 `useAxios` 行為，前端可能顯示 axios generic message，例如 `Request failed with status code 400`，而不是 body 文字。

## 修正檔案

- `ptwcs_ap/src/main/java/com/tradevan/ptwcs/adapter/repository/UploadfileRepositoryImpl.java`

## 驗證

已執行：

```powershell
mvn -q -DskipTests compile
```

結果：通過。

## 後續可追

- 若要讓 HTTP 400 的 `"Invalid file."` 也穩定顯示在 Snackbar，可調整前端 `useAxios` 的 axios error body handling，或讓後端 invalid file path 也回標準 `rtnCode/rtnMsg`。
- 可再補一個空 Excel / 空資料列防呆，避免解析成功但無資料時的使用者提示不清楚。
