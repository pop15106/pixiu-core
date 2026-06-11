---
type: recap
date: 2026-05-22
project: PCLMS
system: PCLMS
repo: PCLMS_AP,PCLMS_BK_new,PCLMS_LIBS_new
topic: nx5105-xxxxx-bondno-flow
status: closed
tags: [pclms, nx5105, bondno, xxxxx, spinsdeclar, warehse, recvlog, redodeclar]
summary: 調查 NX5105 進倉報單收檔後 bondno 寫成 XXXXX 的原因，以及後續何時變更為真實監管編號的完整流程。
---

# PCLMS NX5105 進倉報單 — XXXXX bondno 流程分析

## 背景

客戶案例：recvlog 顯示同一份報單（封包號碼不同）在 08:51 寫入 bondno=XXXXX，10:08 再次收到時變為真實監管編號（如 CG129）。需釐清觸發條件與完整資料流。

---

## NX5105 收檔 → XXXXX 的根因

### BK 收檔流程

```
JMS Queue → ProcessStagingDataServiceImpl.excuteMessage()
  → msgType 含 "5105" → doDeclarI(transId)
    → PclmsDataModel.getIm5105MInput(Im5105mNDo)  // 組 41 個輸入參數
    → pModel.insertDeclar(procInputs)              // 呼叫 Spinsdeclar stored proc
    → masterObjs[2] = OUT_BONDNO
```

### Spinsdeclar 回傳 XXXXX 的條件

`Spinsdeclar`（Oracle stored proc）在 WAREHSE 表找不到對應的倉儲業者時，OUT_BONDNO 回傳 `XXXXX`。

**比對邏輯（Java 源碼可見的輸入欄位）：**

| Spinsdeclar 輸入參數 | NX5105 EDI 欄位 | 比對 WAREHSE 欄位 |
|---|---|---|
| `IN_INBONDNO` (objVals[12]) | `getInBondWarehouseNo()` 進倉保稅業者代碼 | **WAREHSE.BONDID** (倉儲業代碼, PK) |
| `IN_STGPLACE` (objVals[6]) | `getStoragePlaceCode()` 倉儲地點代碼 | 可能為 BONDID 前綴 |
| `IN_INBONDBAN` (objVals[22]) | `getInBondWarehouseBan()` 進倉統編 | WAREHSE.BONDBAN |
| `IN_RECVID` (objVals[16]) | `getRecvId()` 受文者 | WAREHSE.RCVID |

**NX5105 是進倉報單**，主要比對欄位為 `IN_INBONDNO → WAREHSE.BONDID`，查不到則 OUT_BONDNO = XXXXX。

> Spinsdeclar 源碼在 Oracle DB 端，可用 `SELECT TEXT FROM USER_SOURCE WHERE NAME = 'SPINSDECLAR' ORDER BY LINE` 確認完整 SQL。

### keepGoing 邏輯

```java
// ProcessStagingDataServiceImpl.java
if (masterObjs[2] != null && (!masterObjs[4].equals("-2"))
    && (!"XXXXX".equals(masterObjs[2].toString())
        || (tmpDecltype.equals("F3") || tmpDecltype.equals("D7") || tmpDecltype.equals("D8")))) {
    keepGoing = true;
}
```

bondno=XXXXX 時 keepGoing=false（F3/D7/D8 例外），**不建立 sendlog，不進 L1 傳送**。

---

## XXXXX → 真實 bondno 的觸發路徑

### 路徑一：新 NX5105 封包重收（recvlog 顯示不同封包號碼）

海關重傳一份新的 NX5105（不同 CONTROLNO），此時 WAREHSE 已建檔 → Spinsdeclar 查得到 BONDID → OUT_BONDNO = 真實監管編號。

### 路徑二：RedoDeclarTask 排程重送

`RedoDeclarTask`（BK 排程）查 DeclarT1 中 PROC_STATUS=M 的記錄，呼叫 `ProcessStagingDataServiceImpl.excuteMessage(t1.getMsgType(), t1.getTransactionId())`，用相同 transactionId 重跑 Spinsdeclar。

**兩條路徑都不寫 modlog**（BK 端純 stored proc 操作，AP 端未介入）。

### 排除的路徑

| 路徑 | 排除原因 |
|---|---|
| `AddDeclSave`（AP 新增報單） | 這是 Web 手動新增路徑，bondno 來自 session，非 XXXXX 更新路徑 |
| `DeclInfoUpdateSave`（AP 修改報單） | 寫 modlog，但本案無修改紀錄，排除 |
| `CustomAuthCl` / `RlsDeclareCancelRelease` | 方向相反：把真實 bondno 改回 XXXXX（取消/回退） |

---

## WAREHSE 表結構重點

```
PK: (BONDNO, BONDID)
BONDNO   — 監管編號（Spinsdeclar 輸出）
BONDID   — 倉儲業代碼（比對 IN_INBONDNO）
BONDBAN  — 倉儲業統一編碼（比對 IN_INBONDBAN）
RCVID    — 收件人代碼（比對 IN_RECVID）
RECV_FLAG — 准單接收註記（L1.v.sql 過濾條件 = 'V'）
AUTHORITY — L1.v.sql 過濾條件 IN ('B','D','W')
```

---

## L1 傳送保護機制

`L1.v.sql`：

```sql
WHERE WAREHSE.RECV_FLAG = 'V'
  AND WAREHSE.BONDNO <> 'XXXXX'    -- 明確排除 XXXXX
  AND WAREHSE.AUTHORITY IN ('B', 'D', 'W')
  AND SENDLOG.BONDNO = WAREHSE.BONDNO
```

XXXXX 的報單永遠不會被 L1 送出海關。

---

## AddDeclSave 呼叫鏈（補充釐清）

```
Menu: 新增報單
  → AddDecl.java
    → AddDeclHeader.java
      → AddDeclDisplay.java (form action='AddDeclSave')
        → AddDeclSave.java  ← Web 手動新增報單 servlet
```

AddDeclSave 在 INSERT 前會清除 XXXXX 舊記錄：
```java
DELETE FROM declar WHERE bondno='XXXXX' AND declno='...' AND msgtype='...'
DELETE FROM decldetail WHERE bondno='XXXXX' AND declno='...' AND msgtype='...'
DELETE FROM sendlog WHERE bondno='XXXXX' AND declno='...' AND msgtype='...'
```

---

## 涉及檔案

| 檔案 | 說明 |
|---|---|
| `PCLMS_BK/ProcessStagingDataServiceImpl.java` | doDeclarI、keepGoing 邏輯 |
| `PCLMS_BK/PclmsDataModel.java` | getIm5105MInput、insertDeclar (Spinsdeclar) |
| `PCLMS_BK/RedoDeclarServiceImpl.java` | 報單重收排程邏輯 |
| `PCLMS_BK/resources/sql/clmsL1/L1.v.sql` | BONDNO <> 'XXXXX' 過濾 |
| `PCLMS_LIBS/WarehseDAOImpl.java` | WAREHSE 表結構與 PK 定義 |
| `PCLMS_AP/AddDeclSave.java` | Web 新增報單（非 XXXXX 更新路徑） |
| `PCLMS_AP/DeclInfoUpdateSave.java` | 報單修改（寫 modlog，排除） |
| `PCLMS_AP/CustomAuthCl.java` | bondno 回退 XXXXX（取消方向） |
| `PCLMS_AP/RlsDeclareCancelRelease.java` | 取消放行，也回退 XXXXX |
