---
type: session-recap
date: 2026-06-05
project: PCLMS_AP / PCLMS_BK
system: PCLMS
repo: PCLMS_AP, PCLMS_BK_new
topic: decltype-T-balance-多加-沒扣-完整分析
status: root-cause-identified, fix-options-documented, fix-pending
tags: [recap, pclms, pclms-ap, pclms-bk, decltype-T, balance, 移倉, back-table, bug, 多加, 沒扣, SPINSDETAIL_178, SPINSDETAIL_9_L4, partialflg, OS10]
related:
  - 2026-06-04-pclms-decltype-T-balance-多加-bug分析.md
source_paths:
  - PCLMS_BK_new/JAVA/pclms_bp/.../ClmsL4Execute.java
  - PCLMS_BK_new/JAVA/pclms_bp/.../ClmsL4FetchVMsgFunc1.java
  - PCLMS_BK_new/JAVA/pclms_bp/.../ClmsL4FetchVMsgFunc9.java
  - PCLMS_BK_new/JAVA/pclms_bp/.../ClmsL4Model.java
  - PCLMS_BK_new/JAVA/pclms_bp/.../GrntServiceImpl.java
  - PCLMS_AP/JAVA/pclms_mvn/.../CalBalanceServiceImpl.java
  - PCLMS_AP/JAVA/pclms_mvn/.../GoodsBalanceServiceImpl.java
  - PCLMS_AP/JAVA/pclms_mvn/.../GrntServiceImpl.java
  - PCLMS_AP/JAVA/pclms_mvn/.../OutNMonthsServiceImpl.java
  - Oracle SP：SPINSDETAIL_9_L4、SPINSDETAIL_178（未入 repo）
output_doc: PCLMS_AP/docs/pclms-decltype-T-balance-analysis.md
summary: |
  完整分析 decltype=T 的「多加」與「沒扣」兩類 balance 異常。
  多加根因：SPINSDETAIL_178 MsgFun=8 移倉後 UPDATE INDETAIL 用 +backqty，
  移倉量被加回舊儲位，同時新儲位也有 balance=移倉量 → 雙重計算。
  沒扣根因：①partialflg=1 時 v_rstrqty=0，等 OS10 才扣；
  ②BACK 殘留讓 v_sumbackqty 抵消出倉扣減，極端情況出倉後 balance 反升；
  ③OUTDETAIL 長期卡 OS01，v_sumoutqty 永遠算不到。
  AP 端：GoodsBalance 直接讀 INDETAIL.BALANCE 無修正；CalBalance BACK 扣除日期過濾當期失效。
  修法 A（根本）：SPINSDETAIL_178 MsgFun=8 改 -backqty；修法 B（快速）：AP 顯示查詢補 BACK 扣除。
  已產出完整分析文件：PCLMS_AP/docs/pclms-decltype-T-balance-analysis.md
---

# PCLMS decltype=T 庫存 balance 多加 / 沒扣 完整分析 Recap

## 延伸自

[[2026-06-04-pclms-decltype-T-balance-多加-bug分析]]

前次 recap 已鎖定「多加」根因（SPINSDETAIL_178 MsgFun=8 `+backqty` 公式）。  
本次補齊「沒扣」的三條路徑，並完整記錄 AP 端顯示層問題與修法選項。

---

## 多加根因（複習）

MsgFun=8 移倉後，Oracle SP 對舊儲位 INDETAIL 做：

```sql
UPDATE INDETAIL SET balance = rinqty - toutqty + backqty
-- backqty = SUM(BACK.rinqty) ← 包含剛插入的移倉量
```

移倉量（backqty）被「加回」舊儲位，同時新儲位又新建了 INDETAIL(balance=移倉量)。  
**同一批貨雙重計算 → balance 虛高。**

數值示範：RINQTY=100，移倉 50 units：
- 舊儲位：balance = 100 - 0 + 50 = **150（應為 50）**
- 新儲位：balance = 50（正確）
- 合計顯示 **200，實際只有 100**

---

## 沒扣三條路徑

### 路徑 1：partialflg='1' 分批出倉

SPINSDETAIL_9_L4 出倉公式：
```
v_newbalance = v_rinqty - v_sumoutqty - v_rstrqty + v_sumbackqty - v_sumtestitem
```

分批出倉時 `v_rstrqty = 0`，本次出倉量不代入。  
Balance 必須等 OUTDETAIL → OS10 後下次重算才扣。  
**OS10 沒到 = balance 一直沒扣。**

### 路徑 2：移倉 BACK 殘留抵消出倉扣減

移倉後對舊儲位做出倉 30：
```
RINQTY=100, toutqty=0, BACK.rinqty=50, v_rstrqty=30
v_newbalance = 100 - (0 + 30 - 50 + 0) = 120
```
出倉 30，balance 從 150 → 120，扣對了數字，但距正確值 20 仍差 100。

極端情況（BACK.rinqty > 出倉量）：
```
BACK.rinqty=80, v_rstrqty=30
v_newbalance = 100 - (0 + 30 - 80 + 0) = 150
```
**出倉 30，balance 反而上升 → 多加兼沒扣。**

### 路徑 3：OUTDETAIL 長期卡 OS01

`v_sumoutqty = SUM(routqty) WHERE outstatus='OS10'`  
OS01 的出倉量永不進入計算 → **該筆視同沒扣。**

---

## AP 端顯示層問題

### GoodsBalanceServiceImpl
直接讀 `i.balance`，無任何 BACK 修正，虛高完全顯示。

### CalBalanceServiceImpl

公式：`displayed = i.balance + outqty_after + testqty_after - backqty_after`

BACK 扣除條件：`and indate > inEndDate`（只扣未來的 BACK）  
→ 當查詢 inEndDate = 今天，沒有 BACK indate > 今天，`backqty = 0`，**修正完全失效**。

### GrntServiceImpl（AP 保證金計算）

`getOutGrntitemInventorySQl()` 用 `balance > 0` 篩 INDETAIL，再 JOIN GRNTITEM 出倉記錄。  
舊儲位 balance 虛高 → 不該被撈的出倉保證金記錄被納入計算 → **保證金餘額也可能虛高**。

---

## 修法選項

### 選項 A：修 Oracle SP（根本解）

```sql
-- SPINSDETAIL_178，MsgFun=8
-- 現況（錯誤）
UPDATE INDETAIL SET balance = rinqty - toutqty + backqty
-- 修正
UPDATE INDETAIL SET balance = rinqty - toutqty - backqty
```

注意：需同步評估 SPINSDETAIL_9_L4 出倉公式的 `+v_sumbackqty` 語義。  
若 BACK table 有「移倉中間態」與「退貨暫放」兩種語義，需加 type 欄位區分。

### 選項 B：修 AP 顯示查詢（快速）

- **GoodsBalanceServiceImpl**：加入 LEFT JOIN BACK，從 `i.balance` 減去 `backqty`
- **CalBalanceServiceImpl**：移除 BACK 的 `indate > inEndDate` 過濾，改扣所有 BACK

---

## 問題嚴重性速覽

| 場景 | 嚴重性 |
|------|--------|
| MsgFun=8 移倉後舊儲位 balance 虛高 | 高 |
| BACK.rinqty > 出倉量，出倉後 balance 反升 | 高 |
| partialflg=1，OS10 未到，balance 不扣 | 中 |
| OUTDETAIL 長期卡 OS01 | 中 |
| CalBalance 歷史查詢 BACK 修正失效 | 中 |
| GrntService 保證金因虛高 balance 計算錯誤 | 中 |

---

## 待確認

1. BACK table 是否有多種語義？影響是否能統一用 `-backqty`
2. MsgFun=8 後 BACK 記錄何時被清除？
3. OUTDETAIL 卡 OS01 的實際規模
4. 修 SP 後，現有虛高 INDETAIL.balance 如何做資料補正

## 產出文件

完整分析已輸出至：  
`PCLMS_AP/docs/pclms-decltype-T-balance-analysis.md`
