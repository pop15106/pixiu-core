---
type: recap
date: 2026-05-06
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: fedex-provider-adjustment
status: done
tags: [recap, pepis, ccps, fedex, provider-filter, report]
summary: 調整 PEPIS FedEx provider filter 與對應流程，確認條件判斷與資料來源一致。
---

# 2026-05-06 PEPIS 配合業者 FedEx 調整

## 工作範圍

- 專案：`C:\Users\7010\Desktop\Project\pepis_ap`
- 需求主軸：
  - 申請畫面的配合業者順序改成 `FedEx` 第一，並且只保留 `FedEx`、`其他`。
  - 其他業者選項隱藏。
  - 報表若有同類配合業者內容，只保留 `FedEx`。
  - 報表文字只顯示 `FedEx`，不要顯示 `FedEx國際快遞`。
  - `/edda` 下面因為其他人會改，最後已還原，不保留本次變更。

## 實作結果

- `view/CCPS/src/views/AuthApply.vue`
  - 配合業者顯示清單改成只取原始 bit index `3, 4`，也就是 `FedEx`、`其他`。
  - 畫面顯示順序為 `FedEx` 在前、`其他` 在後。
  - 解析既有資料、送出前計算、畫面 decode 都只處理可見的 `FedEx`、`其他`。

- `view/CCPS/src/views/AuthApplyQueryBasic.vue`
  - 查詢/顯示 decode 配合業者時，`順豐`、`UPS`、`DHL` 設為不可見。
  - 保留 `FedEx`、`其他` 的顯示。

- `view/CCPS/src/views/AuthApplyQuery.vue`
  - 同步查詢/顯示 decode 規則。
  - 保留 `FedEx`、`其他`，隱藏 `順豐`、`UPS`、`DHL`。

- `/edda`
  - `view/CCPS/src/views/edda/PaymentServiceApply/PaymentServiceFormFields.vue`
  - `view/CCPS/src/views/edda/PaymentServiceReview/ReviewDialog.vue`
  - 依使用者後續指示已還原，這兩支目前沒有 source diff。
  - 檔內仍保留 `FedEx / DHL / UPS / 順豐 / 其他` 全部選項，留給其他人處理。

## 報表調整

- `src/main/resources/report/jrxml/TradevanPaymentServiceApplicationForm.jrxml`
  - 後續依使用者指示已還原，不保留本次改動，交由其他人處理。

- `src/main/resources/report/jasper/TradevanPaymentServiceApplicationForm.jasper`
  - 已同步還原，避免 JRXML 與 compiled Jasper 不一致。

- `src/main/resources/report/jasper/each_auth.jrxml`
  - 文字改為 `支付給特定快遞業者(FedEx)`。
  - 已確認不是 `FedEx國際快遞`。

- `src/main/resources/report/jasper/each_auth.jasper`
  - 已由 JRXML 重新編譯。

## 驗證

- `view/CCPS` 執行 `npm run lint`：通過。
- `view/CCPS` 執行 `npm run build`：通過。
  - 有既有 bundle size warning 與 Sass deprecation warning。
  - `/edda` 還原後有重新跑一次 build，讓 `src/main/webapp/CCPS` 的打包結果同步。
- 專案根目錄執行 `mvn -q -DskipTests compile`：通過。
- 最後確認：
  - `git diff -- view/CCPS/src/views/edda/...` 為空。
  - `/edda` 原始碼仍可搜尋到 `FedEx / DHL / UPS / 順豐 / 其他`。
  - `TradevanPaymentServiceApplicationForm.jrxml` 與對應 `.jasper` 已還原，狀態乾淨。
  - `each_auth.jrxml` 中只出現 `FedEx`，沒有 `FedEx國際快遞`。

## 後續注意

- 本次不碰 `/edda`，後續如果其他人要在 eDDA 畫面實作同類需求，應另外處理。
- 若部署流程使用已編譯 Jasper，需確認 `.jasper` 一併帶入。
- 前端 build 會更新 `src/main/webapp/CCPS` hash 檔，送版前要一起確認打包檔是否納入版本控制。
