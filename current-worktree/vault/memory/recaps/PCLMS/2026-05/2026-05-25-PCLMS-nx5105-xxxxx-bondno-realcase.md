---
type: recap
date: 2026-05-25
project: PCLMS
system: PCLMS
repo: PCLMS_AP,PCLMS_BK_new
topic: nx5105-xxxxx-bondno-realcase
status: closed
tags: [pclms, nx5105, bondno, xxxxx, spinsdeclar, warehse, cb1555055470, d8]
summary: 以報單 CB 1555055470 (D8) 為實例，驗證 NX5105 兩封電文造成一筆 XXXXX、一筆 CG129 的根因，確認為 IN_BOND_WAREHOUSE_NO 欄位差異所致。
---

# PCLMS CB1555055470 — XXXXX 實例驗證

> 延伸自 [[2026-05-22-PCLMS-NX5105-XXXXX-bondno-流程分析]]

## 背景

客戶查詢報單 `CB 1555055470`（D8）時，查詢結果出現兩筆：

| No. | 監管編號 | 確認 |
|---|---|---|
| 1 | CG129 | Y |
| 2 | XXXXX | N |

---

## 兩封電文對比

| 欄位                       | 第一封（08:51）           | 第二封（10:08）           |
| ------------------------ | -------------------- | -------------------- |
| TRANSACTION_ID           | 20260504085125254856 | 20260504100805379560 |
| CONTROL_NO               | 26050408512301       | 26050410080102       |
| MSG_FUNC_CODE            | **9**（新增）            | **5**（修改）            |
| **IN_BOND_WAREHOUSE_NO** | **BOND8**            | **CG129**            |
| IN_BOND_WAREHOUSE_BAN    | 54684515             | 54684515             |
| HAWB_NO                  | 871279000666         | 871263512344         |
| TOT_INVOICE_AMT          | 33426                | 13109.32             |
| STORAGE_PLACE_CODE       | 680C2054             | 680C2054             |
| DUTY_PAYER_BF_NO         | CG129                | CG129                |
| 品項                       | 1 項（DUCT ASSY）       | 5 項（CLAMP 等）         |

---

## 根因

**第一封 `IN_BOND_WAREHOUSE_NO = BOND8`**

Spinsdeclar 用此值查 `WAREHSE.BONDID`，找不到對應記錄 → `OUT_BONDNO = XXXXX`。

**第二封 `IN_BOND_WAREHOUSE_NO = CG129`**

WAREHSE 有 BONDID = CG129 → `OUT_BONDNO = CG129`，正常。

> 注意：這兩封並非「同一封重傳」，而是內容不同的兩份電文（MSG_FUNC_CODE 不同、HAWB_NO 不同、品項不同），都對應同一個 DECL_NO。

---

## 影響評估

- XXXXX 那筆：確認 N、不建 sendlog、不進 L1 傳送，**不影響正式報單流程**
- D8 例外：`keepGoing=true`（D8 不受 XXXXX 攔截），需另確認 sendlog 狀態
- 有效記錄：第二封（CG129，確認 Y）為準

---

## 對外說法（客服）

系統於 05/04 收到兩份對應此報單號碼的 NX5105 電文。第一份（08:51）電文所帶進倉保稅業者代碼為 `BOND8`，系統無法對應至已登錄倉儲業者，監管編號暫以 `XXXXX` 寫入，確認狀態為「N」，不對外傳送。第二份（10:08）帶入正確代碼 `CG129`，寫入正確監管編號，確認狀態為「Y」，為有效申報記錄。系統以第二份為準，報單資料正常。
