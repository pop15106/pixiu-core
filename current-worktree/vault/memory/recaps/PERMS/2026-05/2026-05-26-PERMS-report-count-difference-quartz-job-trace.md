---
type: session-recap
date: 2026-05-26
project: PERMS
system: PERMS
repo: perms
topic: report-count-difference-quartz-job-trace
status: follow-up
tags: [recap, perms, report-count, quartz, job-service, erms-day-stat]
source_paths:
  - C:/Users/7010/Desktop/gravityTest/perms/AM001_AM002_報表筆數差異分析.md
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/action/am/AM001Action.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/action/am/AM002Action.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/action/am/AM003Action.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/action/am/AM005Action.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/resources/mapper/ApplyMainMapper.xml
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/resources/mapper/ErmsRptMapper.xml
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/resources/mapper/ErmsProcMapper.xml
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/action/mg/MG013Action.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/action/mg/MG016Action.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/action/mg/MG014Action.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/quartz/MyJobDetail.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/jobservice/impl/DoDayStatJobServiceimpl.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/resources/conf/quartz.properties
summary: 釐清 AM001/AM003 與 AM002/AM005 分屬兩組報表筆數口徑，並追到 AM005 的 ERMS_DAY_STAT 來源與 Quartz/job service 執行鏈。
---

# PERMS 報表筆數與排程追查 Recap

## 背景

本輪先追 AM001 與 AM002 報表筆數差異，後續擴到 AM003、AM005。使用者補充目前實際觀察是：

- AM001 與 AM003 筆數一致。
- AM002 與 AM005 筆數一致。
- AM005 使用的統計方式是「消費/退稅金額」，也就是 `SPC_RPT_AM005` 的 `IN_STAT_TYPE = 1`。

因此重點從「哪一支錯」轉成「兩組報表是否用了不同資料口徑」。

## 主要結論

AM001/AM003 與 AM002/AM005 目前看起來是兩組不同口徑：

- AM001/AM003 直接查 `APPLY_MAIN`，目前找到的主要 SQL 沒有排除 `NOW_STATUS = '999'`。
- AM002 查 `APPLY_MAIN` 時有 `NOW_STATUS != '999'`。
- AM005 不直接查 `APPLY_MAIN`，而是透過 `PERMSMGR.SPC_RPT_AM005` 讀 `PERMSMGR.ERMS_DAY_STAT`，再寫入 `ERMS_TMP_RPT` / `ERMS_RPT`。
- AM002 與 AM005 會一致，代表 `ERMS_DAY_STAT` 的上游日統計資料很可能已採用與 AM002 相同的有效資料口徑，但此點還需要取得 DB 端 `PERMSMGR.DO_DAY_STAT` procedure 原始碼才能定案。

另有一個獨立風險：AM003 的 `sel_rpt_004_01` 使用硬編碼期間 `201601` 到 `201609`，不是使用畫面輸入的 `#{begYm}` / `#{endYm}`。

## 報表證據

AM001：

- `AM001Action.query()` 設定 `sellerId = compBan`、日期區間後呼叫 `ApplyMainMapper.sel_mg001_01`。
- `ApplyMainMapper.sel_mg001_01` 來源是 `PERMSMGR.APPLY_MAIN`。
- 條件包含 `TAX_APP_NO`、`PASSPORT_NO`、`SELLER_ID`、`TRADE_DATE >=`、`TRADE_DATE <=`。
- 沒有 `NOW_STATUS != '999'`。

AM002：

- `AM002Action.print()` 設定 `sellerId = compBan`、`begYm`、`endYm` 後呼叫 `ApplyMainMapper.sel_rpt_001`。
- 若為總公司/母公司情境，會透過 `XauthCompanyMapper.selectRecCompany` 取得底下公司，再走 `sel_rpt_001_02`。
- `sel_rpt_001` 有 `COUNT(TAX_APP_NO)`、`SUM(UNV_AMT)`、`SUM(BACK_AMT)`。
- `sel_rpt_001` 條件包含 `NOW_STATUS != '999'`。
- `sel_rpt_001_02` 在 join `APPLY_MAIN` 時也有 `B.NOW_STATUS != '999'`。
- Oracle/DB2 類 SQL 中 `!= '999'` 通常也不會包含 NULL，因此 AM002 實際上排除了 `999` 與 NULL status。

AM003：

- `AM003Action.print()` 呼叫 `sel_rpt_002`，並在 sheet 產生流程中使用 `sel_rpt_003`、`sel_rpt_004`。
- 總公司/底下公司情境會使用 `sel_rpt_002_02`、`sel_rpt_003_01`、`sel_rpt_004_01`。
- 這批 AM003 SQL 目前未看到 `NOW_STATUS != '999'`。
- `sel_rpt_004_01` 另有硬編碼：

```sql
AND TO_CHAR(A.TRADE_DATE, 'YYYYMM') BETWEEN '201601' AND '201609'
```

AM005：

- `AM005Action.print()` 呼叫 `ErmsRptMapper.spcRptAm005`。
- `ErmsRptMapper.spcRptAm005` 呼叫 `PERMSMGR.SPC_RPT_AM005(...)`。
- `ErmsRptMapper.sel_am005` 依 `BATCH_NO`、`RPT_ID = 'RPT_AM005'` 從 `PERMSMGR.ERMS_RPT` 取報表結果。
- 使用者提供的 `SPC_RPT_AM005` procedure 顯示來源是 `PERMSMGR.ERMS_DAY_STAT`：

```sql
FROM PERMSMGR.ERMS_DAY_STAT A
WHERE A.STAT_CLASS = 'TOURIST'
  AND A.STAT_TYPE IS NULL
  AND A.STAT_DATE BETWEEN V_BGN_DATE AND V_END_DATE
  AND A.BAN = V_ROW.COMP_BAN
```

在 `IN_STAT_TYPE = 1` 消費/退稅金額口徑：

- AM005 的單數 `N01` = `SUM(A.N03)`。
- 消費金額 `N02` = `SUM(A.N01)`。
- 退稅金額 `N03` = `SUM(A.N02)`。
- 這裡的 `A` 是 `ERMS_TMP_RPT`，而 `ERMS_TMP_RPT.N01/N02/N03` 是從 `ERMS_DAY_STAT.N01/N02/N03` 複製而來。

## ERMS_DAY_STAT 來源

Repo 內沒有看到 `DO_DAY_STAT` procedure body，但有呼叫入口：

- `ErmsProcMapper.spcDoDayStat` 呼叫 `PERMSMGR.DO_DAY_STAT(IN_DATE, IN_DEL, IN_USER)`。
- `ErmsProcMapper.spcDoMonthStat` 呼叫 `PERMSMGR.DO_MON_STAT(IN_MONTH, IN_DEL, IN_USER)`。

人工入口：

- `MG013Action` 是統計 procedure 手動執行頁。
- `execute()` 讀取 `SPC_GRP` 系統代碼，提供可執行 procedure 下拉。
- `process()` 依 `spcName` 組參數：
  - `spcDoDayStat` 使用 `IN_DATE`。
  - `spcDoMonthStat` 使用 `IN_MONTH`。
  - 兩者都帶 `IN_DEL = 'Y'`、`IN_USER = current user`。

資料補抓/重算入口：

- `MG016Action` 是資料補抓與統計重跑工具。
- `doRun()` 會先呼叫 `ptrsAppQueryService.queryTax(...)` 補抓外部 tax data。
- 若畫面 day 選 `Y`，呼叫 `ErmsProcMapper.spcDoDayStat`。
- 若畫面 mon 選 `Y`，呼叫 `ErmsProcMapper.spcDoMonthStat`。

目前缺口：

- `PERMSMGR.DO_DAY_STAT` 的 procedure source 不在 repo。
- 要證明 `ERMS_DAY_STAT` 是否排除 `NOW_STATUS = '999'`，下一步要從 DB 匯出 `DO_DAY_STAT`，或直接用 SQL 比對 `ERMS_DAY_STAT` 與 `APPLY_MAIN` 的 status 分布。

## Quartz 與 Job Service

Quartz 是排程觸發層，job service 是實際業務邏輯層。

Spring/Quartz 設定：

- `applicationContext-tx.xml` 建立 `SchedulerFactoryBean`。
- `quartz.properties` 指定：
  - `threadCount = 3`
  - `jobStore.class = org.quartz.impl.jdbcjobstore.JobStoreTX`
  - `tablePrefix = QRTZ_`
  - `isClustered = true`

管理入口：

- `MG014Action` 注入 `SchedulerFactoryBean`。
- `addSchedule()` 建立 Quartz `JobDetail`，job class 固定是 `MyJobDetail`。
- `JobDataMap` 會放入：
  - `jobName`
  - `serviceName`
  - `methodName`
  - `params`
- `runJob()` 呼叫 `scheduler.triggerJob(...)` 立即執行。
- `toggleJob()` 使用 `resumeJob` / `pauseJob`。
- `deleteSchedule()` 使用 `scheduler.deleteJob(...)`。
- `getScheduleList()` 從 scheduler 取目前排程與 trigger。

執行橋接：

- `MyJobDetail.execute()` 從 `JobDataMap` 讀 `serviceName`、`methodName`、`params`。
- 透過 `SpringContext.getApplicationContext().getBean(serviceName)` 取 Spring bean。
- 掃描 service method 上的 `@JobMethod`。
- 找到 `@JobMethod.name()` 等於 `methodName` 的 method 後，用 reflection `method.invoke(service, values)` 執行。
- `params` 是 JSON list，並支援 `EL:` 開頭的 Spring EL 參數。

目前找到的 job service：

- `DoDayStatJobServiceimpl`
  - `@JobSerivce`
  - `@JobMethod(name = "MG013自動排程", ...)`
  - method: `doDayStatJob(String specName, String jobDate, String jobName)`
- `DoCompanyBillSPServiceImpl`
  - `@JobMethod(name = "123", ...)`
  - method: `getTableData(...)`
  - `@JobMethod(name = "新東陽(HSIN TUNG YANG)", ...)`
  - method: `runHsinTungYang(...)`
- `PtrsAppQueryServiceImpl`
  - `@JobMethod(name = "queryTax", ...)`
  - method: `queryTax(...)`
- `SysCodeServiceImpl`
  - `@JobMethod(name = "getList")`
  - `@JobMethod(name = "update")`

排程執行鏈可整理為：

```text
MG014 畫面/Action
  -> Quartz SchedulerFactoryBean
  -> QRTZ_* tables 持久化 trigger/job
  -> MyJobDetail.execute()
  -> Spring getBean(serviceName)
  -> 找 @JobMethod(name = methodName)
  -> reflection invoke(...)
  -> 實際 job service business logic
```

## RTSG001 報表產生鏈

RTSG001 的主要報表流程：

- `RTSG001Action.print()` 設定 `rptId = SG01001`。
- 組參數：
  - `IN_BAN`
  - `IN_RPT_ID`
  - `IN_BGN_DATE`
  - `IN_END_DATE`
  - `IN_TYPE`
  - `IN_BGN_AGE`
  - `IN_END_AGE`
  - `IN_SEX`
  - `IN_DEL = 'Y'`
  - `IN_USER`
- 呼叫 `ErmsRptMapper.spcRptSg01`。
- `spcRptSg01` 呼叫 `PERMSMGR.SPC_RPT_SG01(...)`。
- 取得 `OUT_BATCH_NO` 後交給 `RptContext.export(...)`。
- `RptContext` 依設定使用 `RptTmp` / template。
- `AbstractRpt` 查 `ErmsRptMapper.sel_sheets`，再組 Excel workbook。

目前可定案的是：

```text
RTSG001Action
  -> ErmsRptMapper.spcRptSg01
  -> PERMSMGR.SPC_RPT_SG01
  -> ERMS_RPT
  -> RptContext / RptTmp / AbstractRpt
  -> Excel report
```

`SPC_RPT_SG01` procedure body 也不在 repo，若要知道欄位如何進 `ERMS_RPT`，需從 DB 匯出該 procedure。

## 已產出文件

本輪 repo 內已整理：

- `AM001_AM002_報表筆數差異分析.md`

該文件目前是分析文件，非程式碼修正。`git status` 顯示此檔為 untracked；執行 git status 時也曾出現使用者層級 `.config/git/ignore` 權限 denied warning，但不影響本次文件內容。

## 建議下一步

1. 從 DB 匯出 `PERMSMGR.DO_DAY_STAT` procedure source。
2. 檢查 `DO_DAY_STAT` 寫入 `ERMS_DAY_STAT` 時是否排除 `APPLY_MAIN.NOW_STATUS = '999'` 或 NULL。
3. 若業務確認 AM001、AM002、AM003、AM005 筆數應完全一致，應決定共同口徑：
   - 若採有效資料口徑，AM001/AM003 SQL 要補上 `NOW_STATUS` 條件。
   - AM003 的 `sel_rpt_004_01` 硬編碼日期應改成 `#{begYm}` / `#{endYm}`。
4. 用 DB SQL 做驗證：
   - 同一 seller/date range 下，比對 `APPLY_MAIN` 全量、排除 `999`、排除 `999/NULL` 的筆數。
   - 比對 `ERMS_DAY_STAT.N03` 加總是否等於 AM002 的 `COUNT(TAX_APP_NO)`。
5. 若取得 `SPC_RPT_SG01`，可再補 RTSG001 的 procedure 內部資料流。
