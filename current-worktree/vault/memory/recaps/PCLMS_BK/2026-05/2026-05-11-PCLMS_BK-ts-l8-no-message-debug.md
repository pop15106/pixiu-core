---
type: recap
date: 2026-05-11
project: PCLMS_BK
system: PCLMS
repo: PCLMS_BK_new
topic: ts-l8-no-message-debug
status: done
tags: [pclms, jms, oracle, debug, recap]
summary: 追查 PCLMS_BK TS/L8 無法收訊問題，沿 ClmsTSDequeueController 與 ConnectSupplier.PCLMS 路徑定位。
---

# PCLMS_BK — TS / L8 無法收訊問題調查

## 背景

JMS queue 更改 port 後，測試發現 TS 與 L8 訊息停在平台端「W（等待中）」狀態，
clrecvTS / clrecvL8 程序有在執行但沒有 dequeue。

## 程式架構

所有訊息 dequeue 走同一套框架：

```text
ClRecvTS / ClRecvL8
  └─ DeqQueneMyService.execute()
       ├─ Step 1: ConnectSupplier.PFTZZB → Oracle DB (pftzbmgr)
       ├─ Step 2: queService.openTrans()
       └─ Step 3: 無限迴圈 DeQue(jmsUID, jmsPW, lgQueId, msg)
```

### DB Pool 分組（關鍵差異）

| 訊息                | DB Pool | 帳號       | Controller               |
| ----------------- | ------- | -------- | ------------------------ |
| W1, L4, L6, N1    | PCLMS   | pclmssrv | `ConnectSupplier.PCLMS`  |
| TS, L8, F3, FTZL4 | PFTZZB  | pftzbmgr | `ConnectSupplier.PFTZZB` |

> **Bug 確認：** TS 的 enum 為 `LCM_LCMS01_808_TS`（sysCode=LCM，jmsUID=LCMS01），與 W1/L4/L6/N1 同屬 LCM 系統，應使用 `ConnectSupplier.PCLMS`。
> 但 `ClmsTSDequeueController.java:83` 誤用了 `ConnectSupplier.PFTZZB`（L8 的 pool），這是程式碼 bug。
> 實測：TS 用 FCMS01 識別碼送平台會失敗，必須用 LCMS01，再次確認 TS 屬於 PCLMS pool。

### DownloadMedidata enum（所有 Queue ID 從名稱解析）

| 訊息  | enum              | Queue ID | jmsUID | jmsPW  |
| --- | ----------------- | -------- | ------ | ------ |
| W1  | LCM_LCMS01_801_W1 | 801      | LCMS01 | LCMS01 |
| L4  | LCM_LCMS01_802_L4 | 802      | LCMS01 | LCMS01 |
| L6  | LCM_LCMS01_805_L6 | 805      | LCMS01 | LCMS01 |
| TS  | LCM_LCMS01_808_TS | 808      | LCMS01 | LCMS01 |
| N1  | LCM_LCMS01_809_N1 | 809      | LCMS01 | LCMS01 |
| L8  | FCM_FCMS01_809_L8 | 809      | FCMS01 | FCMS01 |

### JMS 設定來源

- 全部訊息只讀 `application.xml`，不讀 `.properties` 檔
- `TSQUE.properties` / `FTZL5QUE.properties` 是 `jks` 獨立模組用，與 clrecvTS/clrecvL8 無關
- 共用設定：`tsJMSIMP`（port 8237）、`VAS_JMS_USERNAME=jmsCU`、`VAS_JMS_PASSWORD=jmsCU1032`

## 根本原因

Log 明確顯示：

```text
ORA-01017: invalid username/password; logon denied
→ ConnectSupplier.PFTZZB → pftzDS → pftzbmgr
→ /APCLMS/def/orapass（EncryptAuthHandler 加密檔）
```

**問題在 Oracle DB，與 JMS port 無關。**
Step 1 取 DB connection 就失敗，程式根本沒到 DeQue()。
W1/L4 正常因為走 PCLMS pool，不走 PFTZZB。

### Log 中顯示「PFTZC」的原因

`ConnectSupplier.java` 的 `PFTZZB` 與 `PCLMS` 兩個 supplier 都寫死了同一個錯誤訊息字串 `"open PFTZC connect error"`（copy-paste bug）。
`PFTZC` 不是 datasource 名稱，只是錯誤訊息內容，與實際連線的 pool 無關。

## pftzDS xdao.xml 設定

| 項目           | 正式 (pro)              | 測試 (test)                |
|----------------|-------------------------|----------------------------|
| JDBC URL       | `10.88.8.2:1524:P04A`   | `172.31.70.50:1524:T04A`   |
| auth-user      | `pftzbmgr`              | `pftzbmgr`                 |
| auth-file      | `/APCLMS/def/orapass`   | `/APCLMS/def/orapass`      |
| application-id | `P04A`                  | `T04A`                     |

## 修復進度

### TS → ✅ 已修復

- `ClmsTSDequeueController.java:83`：`ConnectSupplier.PFTZZB` → `ConnectSupplier.PCLMS`
- 修後實測：TS 訊息可正常收下

### L8 → ⏳ 待 DBA 確認

**根因（L8）：** `pftzDS` 設定與 orapass 設定均正確，已排除設定層面問題。

**已確認（ver 環境）：**

- `xdao.xml` pftzDS：`application-id=V04A`、`auth-user=pftzbmgr`、`auth-file=/APCLMS/def/orapass` ✅
- `/APCLMS/def/orapass` 內有 `V04A pftzbmgr` entry ✅
- 設定完全吻合，orapass_ftz 假說已排除

**最終根因推論：** orapass 裡 `pftzbmgr` 的加密密碼，與 Oracle DB 上 `pftzbmgr` 的實際密碼不一致（帳號密碼被改過但 orapass 未同步）。

**與 JMS port 無關：** 兩件事完全獨立。L8 在取 DB connection 時就失敗，沒到 JMS 那一步。

**待 DBA 確認：**

1. `sqlplus pftzbmgr@V04A` 能否直接登入（確認帳號密碼是否有效）
2. 若登不進去 → Oracle 帳號密碼被改，需重新加密寫入 orapass
3. 若登得進去 → orapass 加密值有誤，需重新產生

## 副產品：ClmsTSDequeueController 有 12 個 dead fields

類別載入時讀取 `m_sysCode_DeqL` 等 12 個欄位，但 `DeqWithoutPropFile()` 完全不用它們。
`m_lgQueId_DeqTS` 若缺失會爆 `NumberFormatException`。
