---
type: session-recap
date: 2026-04-20
project: PCLMS_AP
system: PCLMS
repo: PCLMS_AP
topic: monthly-import-reporting-flow
status: done
tags: [recap, session, 按月彙報, 進倉, listCatMonthSave]
summary: 完整整理 PCLMS_AP 按月彙報進倉主線、置換報單號邏輯與逆向退回流程。
---

# 按月彙報進倉完整流程

## 釐清問題

1. **置換報單號碼是先 DELETE 再 UPDATE？** → 否，全程只有 UPDATE，無 DELETE。
2. **流程涉及哪些 Servlet？** → 見下方流程圖。
3. **置換報單號碼的邏輯在哪？** → `listCatMonthSave.java`。

---

## 完整流程（主線）

```
CatInMonth（條件輸入）
    → CatMonthresult（查詢可彙報進倉明細，WHERE monthno IS NULL）
    → CatMonthSave 或 CatMonthBatchSave（彙整：INSERT month + UPDATE indetail SET monthno）
    → listCatMonth（未申報彙報單列表，WHERE declno 為空）
    → listCatMonthSele（選擇彙報單、輸入報單號碼、選排序）
    ├─ → listCatMonthSave（置換報單號碼，確認申報）★
    │        ↓ 確認後若需退回
    │    → RlsCatMonth → RlsCatMonthresult → RlsCatMonthitem（查詢已報關彙報資料）
    │    → RlsCatMonth_Return（退回未申報狀態）★ 逆向操作
    ├─ → Catprint / CatprintDownload（列印/下載彙整表）
    └─ → CancelMonth（取消彙報：DELETE month + 清空 indetail.monthno）
```

---

## 各 Servlet 說明

### 主流程

| Servlet                | 功能                                 | SQL 操作                                           |
| ---------------------- | ---------------------------------- | ------------------------------------------------ |
| CatInMonth.java        | 輸入彙報條件（客戶、日期、報單類別）                 | 無                                                |
| CatMonthresult.java    | 查詢可彙報進倉明細清單                        | SELECT `indetail` WHERE `monthno` IS NULL        |
| CatMonthSave.java      | 彙整執行：建立彙報單、回填 monthno              | INSERT `month`、UPDATE `indetail` SET `monthno=?` |
| CatMonthBatchSave.java | **批次**彙整（同 CatMonthSave 邏輯，無需逐筆選取） | 同上                                               |
| listCatMonth.java      | 查詢未申報的彙報單列表                        | SELECT `month` WHERE `declno` 為空                 |
| listCatMonthSele.java  | 顯示彙報單詳細、輸入報單號碼                     | SELECT `month`，提供排序選擇                            |
| listCatMonthSave.java  | **置換報單號碼（確認申報）**                   | 見下方詳細                                            |
| CancelMonth.java       | 取消彙報單、還原資料（彙整後、確認前）                | DELETE `month`、UPDATE `indetail` 清空 `monthno`    |

### 已報關查詢 & 退回流程

| Servlet | 功能 | SQL 操作 |
|---------|------|----------|
| RlsCatMonth.java | 查詢已報關彙報資料（條件輸入） | 無 |
| RlsCatMonthresult.java | 顯示已報關彙報單列表 | SELECT `month` WHERE `declno` 有值 |
| RlsCatMonthitem.java | 顯示已報關彙報單明細 | SELECT `indetail`/`outdetail` |
| RlsCatMonthprint.java | 列印已報關彙報表 | SELECT |
| RlsCatMonth_Return.java | **退回未申報狀態**（listCatMonthSave 的逆向） | 見下方詳細 |

### 輔助功能

| Servlet | 功能 |
|---------|------|
| Catprint.java | 列印彙整表（未申報前） |
| CatprintDownload.java | 下載彙整表 |
| showInMonth.java | 查看原彙報進倉資料供挑選（用於 AddInMonth 流程） |
| showMonthInOut.java | 查看原進倉資料 |
| showInMonth_descrip.java | 查看進倉資料貨名 |

---

## 置換報單號碼詳細（listCatMonthSave.java）

四個關鍵 UPDATE（全部在同一 transaction）：

| 操作                             | 說明                   | 位置        |
| ------------------------------ | -------------------- | --------- |
| UPDATE `indetail.declno`       | 舊 refbillno → 正式報單號碼 | L.548/570 |
| UPDATE `outdetail.odeclno`     | 出倉對應的原進倉報單號一起換掉      | L.374/434 |
| UPDATE `month.declno`          | 彙報主檔回填報單號碼           | L.1133    |
| UPDATE `declar.iconfirmed='Y'` | 標記報單已確認使用            | L.1140    |

同時也會更新：
- `grntitem` — SET `iseval='Y'`, `declno`, `itemno`, `decltype`
- `testitem` — SET `itemno`, `declno`
- `workitem` — SET `itemno`, `odeclno`

---

## 退回未申報狀態詳細（RlsCatMonth_Return.java）

`listCatMonthSave` 的**完全逆向**，所有欄位恢復原值：

| 操作 | 說明 |
|------|------|
| UPDATE `indetail` SET `declno=refbillno`, `itemno=item`, `rlstime=''` | 報單號碼還原回參考單號 |
| UPDATE `outdetail` SET `odeclno=refbillno`, `oitemno=item` | 出倉對應的原進倉還原 |
| UPDATE `grntitem` SET `declno=refbillno`, `itemno=item`, `iseval='N'`, `strdate=''` | 保證金還原未核算 |
| UPDATE `testitem` SET `declno=?`, `itemno=?` | 檢測單還原 |
| UPDATE `workitem` SET `odeclno=?`, `oitemno=?` | 加工單還原 |
| UPDATE `month` SET `declno=''`, `confirmdate=''` | 彙報主檔清空報單號碼 |
| UPDATE `declar` SET `iconfirmed='N'` | 報單改回待確認 |

---

## 核心資料表完整異動時機

| 資料表 | CatMonthSave | listCatMonthSave | RlsCatMonth_Return | CancelMonth |
|--------|-------------|-----------------|-------------------|-------------|
| `month` | INSERT | UPDATE declno | UPDATE 清空 declno | DELETE |
| `indetail` | UPDATE monthno | UPDATE declno/itemno | UPDATE 還原 declno=refbillno | UPDATE 清空 monthno |
| `outdetail` | — | UPDATE odeclno/oitemno | UPDATE 還原 odeclno=refbillno | UPDATE 清空 monthno |
| `declar` | — | UPDATE iconfirmed='Y' | UPDATE iconfirmed='N' | — |
| `grntitem` | — | UPDATE declno/itemno/iseval='Y' | UPDATE 還原 iseval='N' | — |
| `testitem` | — | UPDATE declno/itemno | UPDATE 還原 | — |
| `workitem` | — | UPDATE odeclno/itemno | UPDATE 還原 | — |

---

## 排序方式（rb 參數）

| rb | 排序邏輯 |
|----|---------|
| 1 | 料號 → 進倉日期 → 參考單號 → 項次 |
| 2 | 進倉日期 → 參考單號 → 項次 |
| 4 | 參考單號 → 項次 |
| 5 | 自行排序（不重新計算 itemno） |

---

## 相關檔案路徑

```
JAVA/pclms_mvn/src/main/java/servlet/
├── CatInMonth.java
├── CatMonthresult.java
├── CatMonthSave.java
├── CatMonthBatchSave.java        ← 批次彙整
├── listCatMonth.java
├── listCatMonthSele.java
├── listCatMonthSave.java         ← 置換報單號碼核心
├── CancelMonth.java
├── RlsCatMonth.java              ← 查詢已報關（條件）
├── RlsCatMonthresult.java        ← 查詢已報關（結果）
├── RlsCatMonthitem.java          ← 查詢已報關（明細）
├── RlsCatMonthprint.java         ← 列印已報關
├── RlsCatMonth_Return.java       ← 退回未申報狀態
├── Catprint.java
├── CatprintDownload.java
├── showInMonth.java
├── showInMonth_descrip.java
└── showMonthInOut.java
```
