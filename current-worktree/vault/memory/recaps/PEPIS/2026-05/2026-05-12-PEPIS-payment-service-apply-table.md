---
type: recap
date: 2026-05-12
project: PEPIS
system: PEPIS
repo: pepis_ap
topic: payment-service-apply-table
status: done
tags: [pepis_ap, CCPS, payment-service-apply, table-mapping, db-trace]
summary: 追查 PEPIS 金流線上支付服務申請寫入的主表與明細表，釐清與 eACH 授權流程的差異。
---

# PEPIS 金流線上支付服務申請 table tracing

## 問題

使用者詢問：「金流線上支付服務申請是寫到哪個 table？」

## 結論

「金流線上支付服務申請表」主資料寫入：

- `SERVICE_APPLY_INFO`

這條不是 `EACH_APPLY_INFO`。`EACH_APPLY_INFO` 是 eACH 授權申請流程另一條線。

## Trace

前端送出：

- `view/CCPS/src/views/edda/PaymentServiceApply/PaymentServiceApplyForm.vue`
- 呼叫 `/rest/paymentServiceApplication/create`

後端入口：

- `src/main/java/com/tradevan/pccps/web/restful/PaymentServiceApplyController.java`
- `create(ServiceApplyCreateRequestVo requestVo)` 將 request 轉成 `ServiceApplyDTO`
- 呼叫 `serviceApplyService.Create(serviceApplyDTO)`

主要寫入邏輯：

- `src/main/java/com/tradevan/pccps/service/ServiceApplyServiceImpl.java`
- `Create(ServiceApplyDTO serviceApplyDTO)` 建立 `ServiceApplyInfoPo`
- 設定 `APPLY_DATE`、`APPLY_TYPE`、`BAN`、公司資料、聯絡人資料、`APPLY_PAY_METHOD`、`APPLY_STATUS`、`COOP_INDUSTRY`
- 產生 `applyNo`
- `session.insertPo(serviceApplyInfoPo)` 寫入主表

DAO / table mapping：

- `src/main/java/com/tradevan/pccps/model/impl/ServiceApplyInfoDAOImpl.java`
- `TABLENAME = "SERVICE_APPLY_INFO"`

## Related Tables

- `SERVICE_APPLY_INFO`: 主申請資料。
- `SERVICE_APPLY_COOP_INST`: 勾選順豐 / UPS / DHL / FedEx 等合作業者時寫入合作業者明細。
- `SERVICE_APPLY_INFO_H`: 修改、送審、審查異動時保存主表歷史。
- `SERVICE_APPLY_COOP_INST_H`: 合作業者異動時保存明細歷史。

## Evidence Pointers

- `PaymentServiceApplyForm.vue:81`: 前端 POST `/rest/paymentServiceApplication/create`
- `PaymentServiceApplyController.java:120`: `create(...)`
- `ServiceApplyServiceImpl.java:75`: `Create(...)`
- `ServiceApplyServiceImpl.java:118`: `session.insertPo(serviceApplyInfoPo)`
- `ServiceApplyServiceImpl.java:120-125`: 建立 `SERVICE_APPLY_COOP_INST` 明細
- `ServiceApplyInfoDAOImpl.java:32`: `TABLENAME = "SERVICE_APPLY_INFO"`
- `TableMapper.java:104-110`: `SERVICE_APPLY_INFO`、`SERVICE_APPLY_COOP_INST`、history table 對應

## Reuse Note

下次查「金流線上支付服務申請」要先走 `paymentServiceApplication` 這條線；不要和 eACH 授權申請 `EACH_APPLY_INFO` 混在一起。
