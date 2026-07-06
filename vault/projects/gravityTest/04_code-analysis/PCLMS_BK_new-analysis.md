# PCLMS_BK_new 程式碼分析

> 專案：`PCLMS_BK_new`
> 路徑：`%GRAVITYTEST_ROOT%\PCLMS_BK_new`
> 階段：Phase 04 Code Analysis
> 狀態：第一輪分析完成
> 更新日期：2026-05-13
> 範圍：唯讀分析；本次未執行 build / test

---

## 摘要

`PCLMS_BK_new` 是保稅稽核系統的後端批次、排程與訊息傳輸專案，不是 Web AP。它的核心職責是透過 SCT shell / scheduler 啟動 Java main class，處理 JMS queue、報單訊息產檔與收檔、L4 / L6 / N1 / TS / W1 / L8 等訊息解析，以及 IOG / 保證金檢核與清檔批次。

這個專案的分析入口不是 controller URL，而是：

```text
JAVA/jks/SCT shell
  -> com.tradevan.sct.* Java main class
  -> message send / download / fetch / process controller
  -> service / XDAO / stored procedure
  -> Oracle tables / logs
```

第一輪結論：BK 是 AP 的批次與訊息側補位。AP 主要處理使用者操作與即時資料異動；BK 則負責定時把資料送往外部系統、接收回傳資料、解析成暫存或正式資料、以及做 IOG / grnt 類對帳檢查。後續查月報、放行、庫存或保證金問題時，必須把 `PCLMS_AP` 與 `PCLMS_BK_new` 放在同一張資料副作用地圖中看。

---

## 分析來源與限制

本輪使用來源：

- 既有 vault / memory 線索：BK 的 JMS 設定面、`_modified` SCT 鏈路、AP/BK 共用資料風險。
- 目前 repository 實查：`pom.xml`、README、`JAVA/pclms_bp`、`JAVA/jks/SCT`、主要 controller / service。
- second brain 查詢有依規則重試，但目前 endpoint 回 404，未取得可用結果。

限制：

- 未執行 Maven build。
- 未連線資料庫或 JMS。
- SCT 檔案中部分中文註解因舊編碼顯示不完整，本輪以可辨識的 shell command 與 Java 呼叫鏈為主。

---

## 專案結構

| 項目 | 結論 |
|---|---|
| 根專案 | `%GRAVITYTEST_ROOT%\PCLMS_BK_new\pom.xml` |
| groupId | `com.tradevan.clms` |
| artifactId | `pclms_bk_parent` |
| version | `140` |
| packaging | `pom` |
| 主要業務 module | `JAVA/pclms_bp` |
| 佈版 / SCT module | `JAVA/jks` |
| 流程監控 module | `JAVA/process_monitor_mvn` |
| README 定位 | 後端批次排程與訊息傳輸模組 |

根 `pom.xml` modules：

```text
JAVA/pclms_bp
JAVA/process_monitor_mvn
JAVA/jks
```

目前檔案規模：

| Module | Java 檔數 | 總檔數 | 說明 |
|---|---:|---:|---|
| `JAVA/pclms_bp` | 571 | 797 | 主業務批次 / JMS / message processing |
| `JAVA/jks` | 0 | 168 | Jenkins 佈版與 SCT shell |
| `JAVA/process_monitor_mvn` | 0 | 5 | 流程監控 package / resource module |

`JAVA/pclms_bp` 另有：

| 指標 | 數量 |
|---|---:|
| `src/main/java` Java 檔 | 571 |
| `src/test/java` Java 檔 | 59 |
| `public static void main` 命中 | 101 |
| module 內 XML 檔 | 24 |

---

## 技術與依賴快照

| 類別 | 結論 |
|---|---|
| Java | Java 8，`maven-compiler-plugin` 使用 `${java.jdk.version}=1.8` |
| 核心型態 | Core Java batch / shell-launched main class |
| JMS / queue | `com.tradevan:jmsClient-eqdq:1.3.1`、`javax.jms:jms:1.1`、WebLogic JMS client、IBM MQ client |
| DB | Oracle `ojdbc8`，搭配 `tv-xdao`、Tradevan common DB helper |
| 共用 domain / DAO | 依賴 `com.tradevan.clms:pclms-lib:0.0.1-SNAPSHOT` |
| Logging | `log4j:1.2.17-fix1`、`tv-logging-core`、`tv-logging-log4j` |
| Env 管理 | Maven profiles `local/test/ver/pro`，會 copy `env/${profile.active}` 到 build output |

重要設定檔：

- `JAVA/pclms_bp/src/main/resources/conf/application.xml`
- `JAVA/pclms_bp/src/main/resources/conf/DispatchQueue.xml`
- `JAVA/pclms_bp/env/{local,test,ver,pro}/conf/application.xml`
- `JAVA/pclms_bp/env/{local,test,ver,pro}/def/TSQUE.properties`
- `JAVA/pclms_bp/env/{local,test,ver,pro}/def/FTZL5QUE.properties`
- `JAVA/jks/SCT/start.sh`
- `JAVA/jks/SCT/PCLMSaimon.sct`

重要判斷：runtime 不一定吃 `src/main/resources/conf/application.xml`，因為 `pclms_bp/pom.xml` 會依 Maven profile 把 `env/${profile.active}` 複製到 output。查環境問題時，必須先確認 build profile。

---

## 主要 Package 地圖

`JAVA/pclms_bp/src/main/java` 主要目錄：

- `Billing`
- `ediobject`
- `com.tradevan.clms`
- `com.tradevan.pclms`
- `com.tradevan.sct`
- `com.tradevan.processmonitor`
- `com.tradevan.pftzb`
- `com.tradevan.common`

`com.tradevan.clms` 下的重要分支：

| Package | 職責 |
|---|---|
| `message.send` | L1 / L4 / N1 / N1C 產檔與 enqueue |
| `message.download` | queue dequeue / 收檔 |
| `message.fetch` | 解析已收檔案，寫入資料表或暫存表 |
| `message.process` | 後處理，例如 L6 移倉資料處理 |
| `iog` | IOG 進出倉與保證金對帳檢查 |
| `grntCheck` | 保證金檢核報表與 mail |
| `job.clean` | 清檔 / 清資料批次 |
| `job.cmd` / `job.task` | 任務啟停與排程狀態管理 |

---

## SCT 與 Java 入口地圖

BK 的實際入口多半在 `JAVA/jks/SCT`，由 shell 呼叫 Java main class。

| SCT / shell | Java 入口 | 第一輪判斷 |
|---|---|---|
| `clsndnet` | `com.tradevan.sct.ClSndnet_modified` | L1 enqueue 傳送線，已接 `_modified` |
| `clsndL1` | `com.tradevan.sct.ClsndL1Sct Y U Z CL040 G V` | L1 訊息產檔線，不是 queue enqueue 線 |
| `clsndL4` | `com.tradevan.sct.ClsndL4_modified` | L4 enqueue 傳送線，已接 `_modified` |
| `clsndN1C` | `com.tradevan.sct.ClsndN1cSct_modified` | N1C enqueue 傳送線，已接 `_modified` |
| `clrecvL4` | `com.tradevan.sct.ClRecvL4 4 L4` | L4 dequeue / 收檔 |
| `clprocL4` | `com.tradevan.sct.ClProcL4` | L4 fetch / 解析 / 寫 DB |
| `clrecvL6` | `com.tradevan.sct.ClRecvL6` | L6 dequeue / 收檔 |
| `clfetchL6` | `com.tradevan.sct.ClFetchL6` | L6 fetch / 解析 / 寫入待處理表 |
| `clprocL6` | `com.tradevan.sct.ClProcL6` | L6 process / 移倉處理 |
| `IOG_check.sct` | `com.tradevan.clms.IOG_check` | 進出倉與保證金對帳檢查 |
| `Grnt_check.sct` | `com.tradevan.clms.grntCheck.GrntCheckController` | 保證金檢核通知 |

`start.sh` 與 `PCLMSaimon.sct` 監控的是 shell 檔名，例如 `clsndnet`、`clsndL1`、`clrecvL4`、`clprocL4`、`clrecvL6`、`clprocL6`、`clsndN1C`。因此不能只看 Java 類別，要把 shell 名稱與 scheduler 註冊一起看。

---

## 主要流程分析

### 1. L1 / L4 / N1C enqueue 傳送線

三條 `_modified` 傳送線已在 SCT 層接上：

```text
clsndnet
  -> ClSndnet_modified
  -> EnqueueL1_modified.execute()

clsndL4
  -> ClsndL4_modified
  -> EnqueueL4_modified.execute()

clsndN1C
  -> ClsndN1cSct_modified
  -> EnqueueN1C_modified.execute()
```

`EnqueueL1_modified` 與 `EnqueueL4_modified` 的共同模式：

- 從 `ApContext` 讀 `m_sysCode_EnqL`、`m_hubType_EnqL`、`m_enqDir_EnqL`、`m_oriDir_EnqL`、`m_errDir_EnqL`、`m_bkDir_EnqL`、`m_sendId_EnqL`。
- L1 使用 `m_docName_EnqL1`，L4 使用 `m_docName_EnqL4`。
- 讀取 `fsip`、`fsport`、`m_lgQueId_EnqL`、`tsJMSIMP`、`VAS_JMS_USERNAME`、`VAS_JMS_PASSWORD`。
- 開一次 DB connection，建立一次 `QueService`，`openTrans(ENQ_MODE, con)` 後重用同一連線處理多個 `.flg`。
- L1 / L4 用 `warehse.bondno -> warehse.sepid` 查 receiver id。
- 成功後搬到 OK folder，失敗搬到 error folder。

`EnqueueN1C_modified` 的差異：

- 來源目錄使用 `m_oriDir_EnqN1`，錯誤與備份目錄使用 `m_errDir_EnqN1`、`m_bkDir_EnqN1`。
- 傳送帳密使用 N1C 專屬設定：`VAS_JMS_USERNAME_N1C`、`VAS_JMS_PASSWORD_N1C`。
- receiver id 不是從 `warehse.sepid` 查，而是從 `syscode` 查 `code_id='SENDID' and code_data3='N1C'` 的 `code_data1`。

重要區分：

```text
clsndL1
  -> ClsndL1Sct
  -> PclmsL1Controller.main(args)
  -> PclmsL1ServiceImpl.process(...)
  -> L1Type enum: CL040 / U / Y / Z / G / V
```

`clsndL1` 是 L1 訊息產生 pipeline，`clsndnet` 才是 L1 queue 傳送 pipeline。後續若再查 `_modified` 是否要套用，不可把這兩條混成同一條。

### 2. L4 收檔與解析

主要鏈路：

```text
clrecvL4
  -> ClRecvL4
  -> L4 dequeue / 收檔

clprocL4
  -> ClProcL4
  -> ClmsL4FetchController.execute()
  -> BaseCLMSFetchController.getBKFiles()
  -> ClmsL4FetchServiceImpl / ClmsL4FetchYServiceImpl 等
```

`BaseCLMSFetchController` 會在 configured dequeue directory 找符合 category 且結尾為 `.flg` 的檔案，再用同名主檔進行處理。處理成功 / 失敗後，透過 `ProStatus.move(...)` 搬檔。

`ClmsL4FetchYServiceImpl` 是重要資料寫入點。本輪確認它會呼叫 stored procedure：

- `PCLMSMGR.SPINSSTRBILL`
- `PCLMSMGR.SPINSDETAIL_9_L4`
- `PCLMSMGR.SPINSDETAIL_5_L4`
- `PCLMSMGR.SPINSDETAIL_178`

這些 procedure 對應 L4 報單主檔與明細寫入。失敗時會寫 `recvlog` 類紀錄。

### 3. L6 收檔、待處理與移倉 process

L6 分成三段看比較安全：

```text
clrecvL6
  -> ClRecvL6
  -> ClmsL6DequeueController.doDownload()
  -> BaseDequeueServiceImpl.download(...)
  -> DeqQueService.execute(...)

clfetchL6
  -> ClFetchL6
  -> ClmsL6FetchController.execute()
  -> AbstactClmsL6BaseServiceImpl.proFiles(...)
  -> insert CLMS_L6_T1 or recvlog fail

clprocL6
  -> ClProcL6
  -> ClmsL6ProcessController.doProcess()
  -> ClmsL6ProcessServiceImpl.process(...)
```

`AbstactClmsL6BaseServiceImpl` 會解析 L6 檔案，檢核失敗寫 `recvlog`，檢核成功則新增 `CLMS_L6_T1`，狀態為 `N` 待執行。

`ClmsL6ProcessServiceImpl` 是高風險資料異動點，已確認它會：

- 讀取待處理的 `ClmsL6T1Po`。
- 查舊儲位 `indetail`、目的儲位 `indetail`、以及 `decldetail`。
- 視數量與目的儲位是否存在，新增 / 更新 / 刪除 `indetail`。
- 更新 `indetail.balance`、`rinqty`、`declqty`、`valueamt`、`nwght`。
- 寫入 `modlog` 與 L6 log。
- 成功 / 失敗寫 `recvlog`。
- 在部分條件下刪除並重建 `grntitem`，並寫保證金 send log。
- 每筆處理後 commit；異常時寫失敗紀錄，並把 T1 狀態改成 `E` 或保留重試狀態。

這條線會直接碰 AP 也在使用的庫存與保證金資料，因此後續查庫存漂移時，除了 AP `clearStore`，也要查 BK L6 process。

### 4. IOG 對帳檢查

入口：

```text
IOG_check.sct
  -> com.tradevan.clms.IOG_check
  -> IOGController.main(...)
  -> IOGServiceImpl.execute()
```

`IOGServiceImpl` 的主線：

- 取得 `DoXdaoSession`。
- 刪除暫存 IOG 檢查資料，分 I / O 類型。
- 查有權限的 `warehse`。
- 對每個倉別做入倉面與出倉面的 count / mismatch 檢查。
- 寫入 `TmpIogCheckPo`，也就是 TMP IOG 檢查結果。

入倉面會比對：

- `indetail` 非 P 類數量。
- `back` 非 T 類數量。
- `grntitem` strtype = `1`。
- `indetail/back` 有但 `grntitem` 無。
- `grntitem` 有但 `indetail/back` 無。

出倉面會比對：

- `outdetail` 非 P 類數量。
- `grntitem` strtype = `2`。
- `outdetail` 有但 `grntitem` 無。
- `grntitem` 有但 `outdetail` 無。

這不是修復流程，而是對帳檢查與暫存結果產生流程。若要知道是否有資料漂移，要看 IOG 產出的 TMP 結果，再回查 AP / BK 的來源異動。

### 5. 保證金檢核通知

入口：

```text
Grnt_check.sct
  -> com.tradevan.clms.grntCheck.GrntCheckController
  -> GrntCheckServiceImpl.sendMail()
```

`GrntCheckServiceImpl` 會：

- 查倉別清單。
- 建立每家業者的 `GrntCheckReportVo`。
- 計算 total / in / out / last amount。
- 判斷是否足夠、是否異常。
- 依 `syscode` 中 `GrntMail` 相關設定組 mail receiver。
- 發送檢核通知。

這條偏報表 / 通知，不是直接修資料。

### 6. Clean job / 清資料批次

`com.tradevan.clms.job.clean` 是另一個風險面。第一輪已確認存在多個清檔 / 清資料 service，例如：

- `CleanDeclarServiceImpl`
- `CleanDeclarT1ServiceImpl`
- `CleanGrntitemServiceImpl`
- `CleanInOutDataServiceImpl`
- `CleanL6T1ServiceImpl`
- 多個 log clean service

其中 `CleanInOutDataServiceImpl` 會依條件刪除 `indetail`、`back`、`outdetail`、`declar`、`decldetail`、`strbill`、`realse` 等資料並 commit / rollback。這類流程後續應單獨細查，不能只當一般 log cleanup。

---

## 與 PCLMS_AP 的關聯

| AP 關注點 | BK 關聯 |
|---|---|
| `outdetail` / `indetail.balance` 庫存核銷 | BK L6 process 也會更新 `indetail.balance`、`rinqty`、`valueamt`、`nwght` |
| 月報 / 放行後資料狀態 | BK L4 / L6 / N1 類訊息可能新增、解析或回寫同一批報單資料 |
| `recvlog` / `sendlog` | BK 是主要寫入與追蹤訊息收送狀態的地方 |
| `grntitem` 保證金 | BK IOG / L6 process / Grnt check 都會讀或寫相關資料 |
| `declar` / `decldetail` / `strbill` | L4 procedure 與 clean jobs 會處理同一批核心資料表 |

重要判斷：

- AP 的 `clearStore` 風險與 BK 的 L6 process / IOG check 是同一張資料一致性地圖的兩側。
- AP 是使用者操作與 servlet SQL；BK 是批次訊息與排程 SQL。查資料問題時不能只看其中一邊。

---

## 主要風險與後續追查點

### P1：SCT shell 是真入口，不能只看 Java class

`PCLMS_BK_new` 有 101 個 main method。實際會跑哪一個，通常由 `JAVA/jks/SCT`、`start.sh`、`PCLMSaimon.sct` 決定。後續查任何 batch，都應先定位 shell，再回 Java。

### P1：env profile 會改變 runtime 設定來源

`pclms_bp/pom.xml` 會 copy `env/${profile.active}`。所以改 `src/main/resources` 不一定影響 test/ver/pro runtime。查 JMS、queue、目錄、帳密、DB 設定時，必須明確指認 profile。

### P1：L6 process 會直接改庫存與保證金資料

`ClmsL6ProcessServiceImpl` 會更新 / 刪除 / 新增 `indetail`，並可能重建 `grntitem`。這是與 AP `clearStore` 並列的庫存資料漂移追查點。

### P1：clean jobs 可能刪核心業務資料

部分 clean service 不是單純刪 log，而是刪 `declar`、`decldetail`、`indetail`、`outdetail`、`strbill`、`realse` 等資料。後續若分析清檔或歷史資料消失，這一區要優先看。

### P2：`_modified` 傳送鏈路已接上，但不能泛化到所有 SCT

`clsndnet`、`clsndL4`、`clsndN1C` 已接 `_modified`。但 `clsndL1` 是產檔線，不是 enqueue 線；其他例如 `clsndFTZL5` 仍可能走 properties 傳參模式。不可 blanket rename。

### P2：source resources 與 env resources 可能不一致

`src/main/resources/conf/application.xml` 與 `env/*/conf/application.xml` 可能不同步。正式判斷 runtime 設定時，以 build profile 對應 env 目錄為優先。

---

## 後續建議

建議接續分析順序：

1. `PCLMS_FD`：確認前端 / client 是否呼叫 AP 或觸發哪些批次結果查詢。
2. `PCLMS_LIBS_new`：在 AP/BK call site 都看過後，再回頭整理 PO / DAO / shared service 的實際表格 mapping。
3. 若要深入 BK，建議先挑兩條 vertical slice：
   - `clrecvL6 -> clfetchL6 -> clprocL6 -> indetail/grntitem/recvlog`
   - `clrecvL4 -> clprocL4 -> PCLMSMGR.SPINS* -> declar/decldetail/strbill/recvlog`

---

## 驗證備註

本文件根據目前 repository 直接讀檔與既有 memory / vault 線索整理而成。分析期間沒有修改 `PCLMS_BK_new` 原始碼，也沒有執行 Maven build、測試、JMS 連線或 DB 連線。
