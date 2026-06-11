---
type: session-recap
date: 2026-06-04
project: PCLMS_AP / PCLMS_BK
system: PCLMS
repo: PCLMS_AP, PCLMS_BK_new
topic: decltype-T-balance-over-inflation
status: root-cause-identified, fix-pending
tags: [recap, pclms, pclms-ap, pclms-bk, decltype-T, balance, 移倉, back-table, bug, 多加, SPINSDETAIL_178, SPINSDETAIL_9_L4]
source_paths:
  - C:/Users/7010/Desktop/gravityTest/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/clms/message/fetch/service/ClmsL4Execute.java
  - C:/Users/7010/Desktop/gravityTest/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/clms/message/fetch/service/ClmsL4FetchVMsgFunc1.java
  - C:/Users/7010/Desktop/gravityTest/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/clms/message/fetch/service/ClmsL4FetchVMsgFunc9.java
  - C:/Users/7010/Desktop/gravityTest/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/clms/message/fetch/service/ClmsL4Model.java
  - C:/Users/7010/Desktop/gravityTest/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/clms/message/send/service/GrntServiceImpl.java
  - C:/Users/7010/Desktop/gravityTest/PCLMS_AP/JAVA/pclms_mvn/src/main/java/service/impl/CalBalanceServiceImpl.java
  - C:/Users/7010/Desktop/gravityTest/PCLMS_AP/JAVA/pclms_mvn/src/main/java/service/impl/GoodsBalanceServiceImpl.java
  - C:/Users/7010/Desktop/gravityTest/PCLMS_AP/JAVA/pclms_mvn/src/main/java/service/impl/GrntServiceImpl.java
  - C:/Users/7010/Desktop/gravityTest/PCLMS_AP/JAVA/pclms_mvn/src/main/java/service/impl/GrntServiceImplOld.java
  - C:/Users/7010/Desktop/gravityTest/PCLMS_AP/JAVA/pclms_mvn/src/main/java/service/impl/OutNMonthsServiceImpl.java
  - SPINSDETAIL_178.sql (Oracle SP，未入 repo)
  - Spinsdetail_9_L4.sql (Oracle SP，未入 repo)
summary: |
  decltype=T (移倉/加工) 出現「多加的問題」—— 庫存顯示虛高。
  根因鎖定在 SPINSDETAIL_178 MsgFun=8 移倉後的 INDETAIL balance 更新公式用了 +backqty，
  導致移出量被「加回」舊儲位 balance，與新儲位 INDETAIL 形成雙重計算。
  AP 端 GoodsBalanceServiceImpl 直接讀 i.balance 無修正；CalBalanceServiceImpl 的 BACK 扣除只針對未來日期無法修正當前。
  修法：選項A 修 Oracle SP 改 -backqty；選項B 修 AP 顯示查詢補全 BACK 扣除邏輯。
---

# PCLMS decltype=T 庫存多加 (balance 虛高) Bug 分析 Recap

## 背景

客戶回報：保稅倉 decltype=T（移倉 / 加工單）的貨物在庫存顯示時出現「多加的問題」，即庫存數量高於實際存在倉內的數量。

本次工作為：
1. 追蹤 pclms_bk decltype=T 的進出倉 balance 扣除 / 加回機制（從 Java 到 Oracle SP）
2. 定位「多加」根因

---

## 系統架構簡要

### BK 端 L4 訊息流

```
L4 電文 (海關)
  -> ClmsL4FetchVServiceImpl (V 格式)
  -> ClmsL4Execute.execute()
    -> executeT1() -> SPINSSTRBILL (表頭)
    -> executeT2() -> MsgFun enum dispatch
```

| MsgFun | 作用 | SP |
|--------|------|----|
| 9 | 新增（進倉/出倉） | SPINSDETAIL_9_L4 |
| 1 | 刪除 | SPINSDETAIL_178 |
| 7 | 取消放行 | SPINSDETAIL_178 |
| 8 | 移倉 | SPINSDETAIL_178 |
| 5 | 更正 | SPINSDETAIL_5_L4 |

### 核心資料表

| 表 | 用途 |
|----|------|
| INDETAIL | 進倉明細，BALANCE / RINQTY 為庫存核心欄位 |
| OUTDETAIL | 出倉明細，OUTSTATUS: OS01=待清、OS10=已核銷 |
| BACK | 移倉中間表 / 退貨暫存，RINQTY=移倉量，BALANCE=0 |
| GRNTITEM | 保證金記錄，STRTYPE: 1=進倉、2=出倉 |

---

## SPINSDETAIL_9_L4 balance 計算邏輯

### 進倉 (strtype=1)

```sql
-- 新增時
INSERT INTO INDETAIL (RINQTY=i_rstrqty, BALANCE=i_rstrqty, ...)

-- 分批追加時
UPDATE INDETAIL SET
    RINQTY  = RINQTY  + v_strqty,
    BALANCE = BALANCE + v_strqty
```

### 出倉 (strtype=2)，全量重算公式

```sql
v_newbalance := v_rinqty - (v_sumoutqty + v_rstrqty - v_sumbackqty + v_sumtestitem);
-- 展開：
-- = v_rinqty - v_sumoutqty - v_rstrqty + v_sumbackqty - v_sumtestitem
```

| 變數 | 來源 | 說明 |
|------|------|------|
| v_rinqty | INDETAIL.RINQTY | 原進倉總量（不變） |
| v_sumoutqty | SUM(OUTDETAIL.routqty) WHERE outstatus='OS10' | 已清出量 |
| v_rstrqty | 本次出倉量（partialflg='1' 時為 0） | 當次出倉量 |
| v_sumbackqty | SUM(BACK.rinqty) WHERE bondno/declno/itemno/inpost | BACK 中的量，**加回** balance |
| v_sumtestitem | SUM(TESTITEM.uninqty) WHERE uninqty>0 | 檢測中，扣除 |

---

## SPINSDETAIL_178 MsgFun=8 移倉邏輯

gdstype='T'，舊儲位有 INDETAIL 時：

```sql
-- Step 1: 舊儲位記錄存入 BACK，BALANCE=0
INSERT INTO BACK (..., RINQTY = NVL(i_rstrqty, 0), BALANCE = 0, ...)

-- Step 2: 重算舊儲位 INDETAIL balance
-- toutqty = SUM(routqty) FROM OUTDETAIL WHERE outstatus='OS10'
-- backqty = SUM(rinqty) FROM BACK WHERE bondno/declno/itemno/inpost
UPDATE INDETAIL
SET balance = rinqty - toutqty + backqty      -- ← 問題所在
WHERE BondNo=i_bondno AND declno=i_declno AND itemno=i_itemno AND inpost=i_strpost;
```

新儲位建立：

```sql
INSERT INTO INDETAIL (RINQTY = NVL(i_rstrqty, 0), BALANCE = NVL(i_rstrqty, 0), ...)
```

---

## 根因：雙重計算 (多加)

### 問題還原

假設：舊儲位 INDETAIL(A, item1, 儲位X)，RINQTY=100，BALANCE=100，無任何已清出。

移倉 50 units 到新儲位 Y（MsgFun=8）後：

```
Step 1: INSERT INTO BACK(declno=A, itemno=1, inpost=X, RINQTY=50)

Step 2: backqty = 50（剛插入那筆）
        toutqty = 0（無 OS10 outdetail）
        balance = 100 - 0 + 50 = 150   ← 錯誤！應為 50
```

同時新儲位：

```
NEW INDETAIL(A, item1, 儲位Y): RINQTY=50, BALANCE=50   ← 正確
```

**結果：**
| 儲位 | INDETAIL.balance | 預期 |
|------|-----------------|------|
| 舊 X | 150 (虛高) | 50 |
| 新 Y | 50 (正確) | 50 |
| **合計** | **200** | **100** |

→ 多算了 100（移倉量的兩倍加上原本就有的 50）。

### 本質

MsgFun=8 UPDATE 公式中，BACK.rinqty（移倉量）被「加回」到舊儲位 balance，而非扣除。
同時新儲位也建立了相同數量的 INDETAIL。
**同一批貨被計算為兩倍的庫存。**

---

## AP 端顯示問題

### GoodsBalanceServiceImpl（貨物庫存查詢）

`GoodsBalanceServiceImpl.getSql()` 直接讀 `i.balance`，無任何 BACK 修正：

```java
// 僅過濾 balance != 0
where.add(new SqlPredicate("i.balance", SqlOp.NE.getOp(), "0", false, false));
```

→ 舊儲位 balance=150 直接顯示，**完全無修正**。

### CalBalanceServiceImpl（庫存核銷試算）

`CalBalanceServiceImpl.getSql()` 的顯示 balance 公式：

```java
// select 中：
nvl(i.balance + nvl(t.sumqty, 0), 0) sum

// t.sumqty = outqty + testqty - backqty
// 其中 backqty 的日期過濾：
from.append(" and indate > '" + queryDTO.getInEndDate() + "' ");
```

**設計意圖**：歷史日期查詢時，把「查詢截止日後才發生的 BACK」加回（即扣除）。

**Bug**：當 inEndDate = 今天時，沒有任何 BACK 記錄的 `indate > 今天`，
`b.backqty = 0`，等同 `displayed = i.balance`，**虛高完全沒被修正**。

---

## 修法選項

### 選項 A：修 Oracle SP（根本解）

在 `SPINSDETAIL_178` MsgFun=8 的 INDETAIL UPDATE，改為扣除 BACK 量：

```sql
-- 現況（錯誤）
UPDATE INDETAIL SET balance = rinqty - toutqty + backqty

-- 修正
UPDATE INDETAIL SET balance = rinqty - toutqty - backqty
```

**注意**：須確認 `SPINSDETAIL_9_L4` 出倉公式 `+v_sumbackqty` 的語義是否仍成立：
- 若 BACK 語義統一為「已移出、尚未清帳的暫存」，出倉公式的 `+backqty` 也要重新評估。
- 若 BACK 有多種語義（移倉 vs 退貨），需加 type 欄位區分。

### 選項 B：修 AP 顯示查詢（快速修）

在 `GoodsBalanceServiceImpl.getSql()` 補入 BACK 扣除：

```sql
-- 加入 LEFT JOIN BACK b ON b.bondno=i.bondno AND b.declno=i.declno 
--   AND b.itemno=i.itemno AND b.inpost=i.inpost
-- 顯示 balance 改為：
nvl(i.balance - nvl(b.backqty, 0), 0) sum
```

在 `CalBalanceServiceImpl.getSql()` 移除 `indate > inEndDate` 限制，
改為扣除所有 BACK 記錄（或只扣 indate <= inEndDate 的）：

```java
// 現況（只扣未來的，當前期查詢完全無效）
from.append(" and indate > '" + queryDTO.getInEndDate() + "' ");

// 改為（扣除所有 BACK，不限日期）
// 移除 inEndDate 判斷條件
```

---

## 待確認事項

1. BACK 表在本系統是否有多種語義（移倉中間態 vs 退貨暫放）？若有，需加 type 欄位才能區分，不能統一扣除。
2. `SPINSDETAIL_9_L4` 出倉公式 `+v_sumbackqty`：若 BACK 只剩「退貨暫放」語義，這個加法仍正確；若 BACK 也包含移倉記錄，則此公式也在「多加」。
3. MsgFun=8 後，舊儲位 BACK 記錄何時被清除？是等 OS10 清帳後？還是永遠留著？
4. GrntServiceImpl（AP 保證金計算）中 `getOutGrntitemInventorySQl` 條件 `balance > 0`：若舊儲位 balance 虛高，可能會撈到不該計算的出倉保證金記錄。

---

## 本次工作完成狀態

| 項目 | 狀態 |
|------|------|
| decltype=T BK 端 Java call chain 追蹤 | 完成 |
| SPINSDETAIL_9_L4 balance 公式分析 | 完成 |
| SPINSDETAIL_178 MsgFun=8 移倉邏輯分析 | 完成 |
| AP CalBalanceServiceImpl SQL 分析 | 完成 |
| AP GoodsBalanceServiceImpl SQL 分析 | 完成 |
| AP GrntServiceImpl SQL 分析 | 完成 |
| 多加根因定位 | **完成（SPINSDETAIL_178 +backqty 公式）** |
| 修法決策 | 待 PM / 開發確認 |
| 實際修正 | 未開始 |
