---
type: code-analysis
date: 2026-05-27
project: perms
system: gravityTest
topic: NOW_STATUS 欄位完整分析
phase: 04
tags: [perms, now-status, apply-main, data-flow, 口徑不一致]
---

# perms — NOW_STATUS 欄位完整分析

> 關聯 Recap：[[memory/recaps/2026-05-27-perms-NOW_STATUS-使用全覽與資料來源流程]]

---

## 欄位語意

| 資料表 | 值域 | 語意 |
|--------|------|------|
| `APPLY_MAIN` | `'999'` = 作廢，其他值 = 有效 | 退稅申請單目前狀態 |
| `APPLY_MAIN_TMP` | 同上 | 排程同步暫存表（鏡像） |
| `APPLY_DTL_FIA` | 同上 | 退換貨明細（FIA） |
| `SERV_COMPANY` | `'Y'` = 啟用 | 特店服務介接啟用狀態 |

---

## SQL 查詢使用位置

### 有排除作廢單（口徑正確）

```xml
<!-- ApplyMainMapper.xml — sel_rpt_001 (AM002) -->
AND NOW_STATUS != '999'

<!-- ApplyMainMapper.xml — sel_rpt_001_02 (AM002 多公司) -->
AND A.NOW_STATUS != '999'
AND B.NOW_STATUS != '999'  -- JOIN 條件

<!-- ApplyMainMapper.xml — sel_mg004 (AM004 銷情報表) -->
AND A.NOW_STATUS != '999'
```

### 未排除作廢單（口徑有問題）

```xml
<!-- ApplyMainMapper.xml — sel_mg001_01 (AM001 明細查詢) -->
-- 無 NOW_STATUS 篩選

<!-- ApplyMainMapper.xml — sel_rpt_002/003/004 系列 (AM003) -->
-- 無 NOW_STATUS 篩選
-- 且 sel_rpt_004_01 日期寫死 201601~201609（bug）
```

---

## 資料來源路徑

### Path A — 排程同步（ptrs_appquery）

- 觸發：`PtrsAppQueryServiceImpl.queryTax()` @JobMethod
- 外部系統：`ptrs_appquery`（外籍平台退換貨查詢 API）
- URL 設定：`application.properties` → `ptrsAppQuery.queryTax`
- 寫入：`createApplyMainTmp()` → `APPLY_MAIN_TMP`，`createApplyMain()` → `APPLY_MAIN`
- 關鍵程式碼：
  ```java
  // PtrsAppQueryServiceImpl.java:411
  applyMain.setNowStatus(MapUtils.getString(map, "nowStatus"));

  // PtrsAppQueryServiceImpl.java:562
  applyMainTmp.setNowStatus(MapUtils.getString(map, "nowStatus"));
  ```

### Path B — POS 現場開立（ptrs_pos）

- 觸發：前端 REST API → `RestServiceImpl.saveApply()`
- 外部系統：`ptrs_pos`（POS 退稅系統）
- 流程：POST 開立 → GET 查回完整資料 → `getApplyMainModel()` 解析
- 寫入：`APPLY_MAIN`
- 關鍵程式碼：
  ```java
  // RestServiceImpl.java:86
  model.setNowStatus(MapUtils.getString(map, "nowStatus",""));

  // RestServiceImpl.java:78
  model.setNowStatusDate(DateUtils.getStringDateForTimestamp(nowStatusDate));
  ```

---

## 本地寫入點（非外部來源）

| 位置 | 值 | 情境 |
|------|----|------|
| `MG001Action.java:174` | `"Y"` | 新增退換貨資料介接服務 |
| `MG001Action.java:205` | `"Y"` | 新增日結檔資料介接服務 |
| `MG001Action.java:264` | `"Y"` | 更新退換貨服務 |
| `MG001Action.java:289` | `"Y"` | 更新日結檔服務 |

這些只寫入 `SERV_COMPANY.NOW_STATUS`，與 `APPLY_MAIN.NOW_STATUS` 是不同語意的欄位。

---

## 已知問題與建議修正

### 問題 1：AM001 / AM003 未排除作廢單

**影響**：AM001 與 AM003 的筆數與金額包含 `NOW_STATUS = '999'` 的作廢單，與 AM002 / AM004 口徑不同。

**修正**：在以下 SQL ID 加入篩選條件：

```xml
<!-- sel_mg001_01 -->
AND NOW_STATUS != '999'

<!-- sel_rpt_002, sel_rpt_003, sel_rpt_004 -->
AND A.NOW_STATUS != '999'

<!-- sel_rpt_002_02, sel_rpt_003_01, sel_rpt_004_01 -->
AND A.NOW_STATUS != '999'
```

### 問題 2：AM003 Sheet2 日期寫死

`sel_rpt_004_01` 內 `TRADE_DATE` 過濾條件寫死為 `201601` 到 `201609`，應改為動態參數 `#{begYm}` / `#{endYm}`。

### 問題 3：Oracle NULL 語意

在 Oracle 中 `NULL != '999'` 不成立（NULL 比較永遠不真），故若存在 `NOW_STATUS IS NULL` 的資料，現行 `!= '999'` 條件會把 NULL 一起排除。

若業務上需保留 NULL 狀態，應改為：

```sql
AND (NOW_STATUS != '999' OR NOW_STATUS IS NULL)
```

### 問題 4：AM005 上游待確認

AM005 資料來自 `ERMS_DAY_STAT`（由 `DO_DAY_STAT` procedure 產生），未直接操作 `APPLY_MAIN`。目前 AM005 數字與 AM002 一致，但需確認 `DO_DAY_STAT` 是否套用相同的 `NOW_STATUS != '999'` 條件。

---

## 輸出文件

| 路徑 | 說明 |
|------|------|
| `perms/NOW_STATUS_分析文件.md` | Markdown 分析文件 |
| `perms/NOW_STATUS_分析文件.docx` | Word 版（含封面、格式化表格） |
