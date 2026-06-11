---
type: session-recap
date: 2026-05-18
project: PCLMS_BK
system: PCLMS
repo: PCLMS_BK_new
topic: l4-t1-procedure-pending
status: data-fix-pending
tags: [recap, pclms, pclms-bk, l4, t1, procedure, message-flow, old-format, legacy-packet, data-fix]
source_paths:
  - C:/Users/7010/Desktop/gravityTest/PCLMS_BK_new/JAVA/jks/SCT/clrecvL4
  - C:/Users/7010/Desktop/gravityTest/PCLMS_BK_new/JAVA/jks/SCT/clprocL4
  - C:/Users/7010/Desktop/gravityTest/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/clms/message/fetch/service/ClmsL4Execute.java
  - C:/Users/7010/Desktop/gravityTest/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/clms/message/fetch/service/ClmsL4Model.java
  - C:/Users/7010/Desktop/SpInsStrBill.sql
  - C:/Users/7010/Desktop/SPINSDETAIL_178.sql
  - C:/Users/7010/Desktop/Spinsdetail_9_L4.sql
summary: 已確認客戶使用舊格式 L4 封包，PM 暫不修 Java/procedure 流程，後續改走受影響資料的人工修正。
---

# PCLMS_BK L4 舊格式封包資料修正 Recap

## 背景

客戶上傳 L4 訊息時，接收端顯示作業成功，但實際資料似乎沒有依 T1 欄位新增或刪除。已知規則為：

- T1 action 欄位值 1：刪除
- T1 action 欄位值 9：新增

本次已完成 Java/BK 程式流程 tracing，並核對 `SpInsStrBill`、`SPINSDETAIL_178`、`Spinsdetail_9_L4` 三支 procedure。後續處理策略已從「修流程」改為「針對受影響資料直接修正」。

## 最新狀態 / PM 決策

- 客戶目前使用的是舊格式 L4 封包，會落到 legacy/舊格式處理路徑與既有 procedure 行為。
- PM 目前沒有要優先修 Java / procedure / flow 上的流程錯誤。
- 後續工作重點改為確認受影響資料現況，準備人工資料修正 SQL。
- 本 recap 保留完整流程與 procedure 分析；若之後 PM 改回要修流程，可直接沿用本份 call chain 與風險點。

## 第二大腦狀態

第二大腦第一次查詢失敗，錯誤為 Unable to connect to the remote server。後續重試成功，localhost:6333 可連，查到既有 PCLMS_BK_new 分析索引，指出 L4 主線為：

```text
clrecvL4 -> ClRecvL4 -> L4 dequeue / 收檔
clprocL4 -> ClProcL4 -> ClmsL4FetchController.execute()
  -> BaseCLMSFetchController.getBKFiles()
  -> ClmsL4FetchServiceImpl / ClmsL4FetchYServiceImpl
```

第二大腦只作為 lead；後續結論已回 repo 原始碼驗證。

## 已確認入口與 Call Chain

### 收訊息 / Dequeue

```text
JAVA/jks/SCT/PCLMSaimon.sct
  -> JAVA/jks/SCT/clrecvL4
  -> com.tradevan.sct.ClRecvL4.main()
  -> ClmsL4DequeueController.main()/DeqWithoutPropFile()
  -> DeqQueneMyService.execute()
  -> QueService.DeQue()
  -> wirteFlgFile()
  -> 產生主檔與 .flg
```

關鍵檔案與 method：

- JAVA/jks/SCT/PCLMSaimon.sct：排程啟動 clrecvL4 / clprocL4。
- JAVA/jks/SCT/clrecvL4：執行 `java com.tradevan.sct.ClRecvL4 4 L4`。
- com.tradevan.sct.ClRecvL4.main：轉呼叫 `ClmsL4DequeueController.main`。
- com.tradevan.clms.message.download.controller.ClmsL4DequeueController.DeqWithoutPropFile：開 queue 並呼叫 service。
- com.tradevan.clms.message.download.base.DeqQueneMyService.execute：dequeue 訊息。
- com.tradevan.clms.message.download.base.DeqQueneMyService.wirteFlgFile：寫 `.flg`。

### 處理檔案 / Fetch

```text
JAVA/jks/SCT/PCLMSaimon.sct
  -> JAVA/jks/SCT/clprocL4
  -> com.tradevan.sct.ClProcL4.main()
  -> ClmsL4FetchController.execute()
  -> BaseCLMSFetchController.getBKFiles()
  -> ClmsL4FetchController.proFiles()
  -> ClmsL4FetchServiceImpl.proFiles()
  -> ClmsL4FetchUServiceImpl / ClmsL4FetchVServiceImpl / ClmsL4FetchYServiceImpl
  -> ClmsL4Execute.execute()
  -> executeT1() / executeT2()
```

關鍵檔案與 method：

- JAVA/jks/SCT/clprocL4：執行 `java com.tradevan.sct.ClProcL4`。
- com.tradevan.sct.ClProcL4.main：呼叫 `new ClmsL4FetchController().execute()`。
- com.tradevan.clms.message.fetch.controller.BaseCLMSFetchController.execute：取得檔案、處理、搬檔。
- com.tradevan.clms.message.fetch.controller.BaseCLMSFetchController.getBKFiles：找 L4 `.flg` 並找同名主檔。
- com.tradevan.clms.message.fetch.controller.ClmsL4FetchController.proFiles：呼叫 L4 service，未拋 exception 即回 FINISH。
- com.tradevan.clms.message.fetch.service.ClmsL4FetchServiceImpl.proFiles：依第一行長度/編碼分派 U/V/Y/ERROR。

## T1 欄位解析

程式中的 `T1=1` / `T1=9` 實際不是 DTO 的 `t1` 欄位；`t1` 只是行首 literal `T1`。實際 action 欄位是 `hszMsgFun`。

- com.tradevan.clms.message.fetch.dto.ClmsL4FetchT1DTO
  - `t1`：size 2，值為 T1。
  - `hszMsgFun`：size 3，必填，數字格式，對應 action code。
  - `hszBondNo`、`hszStrType`、`hszGdsType`、`hszRefBillNo`、`hszCtmCode` 為後續 procedure key/input。
- com.tradevan.clms.message.fetch.service.ClmsL4FetchUServiceImpl.checkT1：U 格式 T1 解析。
- com.tradevan.clms.message.fetch.service.ClmsL4FetchVServiceImpl.checkT1：V 格式 T1 解析。
- com.tradevan.clms.message.fetch.service.ClmsL4FetchYServiceImpl.insertData：legacy Y path 以 byte position 解析 `hszMsgFun`。

## T1=1 刪除流程

T1 action `hszMsgFun=1` 已確認會進刪除流程。

```text
ClmsL4Execute.execute()
  -> executeT1()
    -> ClmsL4Model.callSpInsStrBillStmt()
    -> SPINSSTRBILL
  -> executeT2()
    -> MsgFun._1
    -> ClmsL4FetchVMsgFunc1.execute()
    -> ClmsL4Model.callSpInsDetail178Stmt()
    -> SPINSDETAIL_178
```

關鍵檔案與 method：

- com.tradevan.clms.message.fetch.service.ClmsL4Execute.MsgFun：`_1(new ClmsL4FetchVMsgFunc1())`。
- com.tradevan.clms.message.fetch.service.ClmsL4FetchVMsgFunc1.execute：組 `ClmsL4SpInsDetail178StmtDTO`，必要時寫 GRNT_SENDLOG。
- com.tradevan.clms.message.fetch.service.ClmsL4Model.callSpInsDetail178Stmt：呼叫 `SPINSDETAIL_178`。

待 procedure 確認：`SPINSDETAIL_178` 內部是否真的 DELETE、DELETE 的 where 條件、rowcount=0 時是否仍回 success。

## T1=9 新增流程

T1 action `hszMsgFun=9` 已確認會進新增流程。

```text
ClmsL4Execute.execute()
  -> executeT1()
    -> ClmsL4Model.callSpInsStrBillStmt()
    -> SPINSSTRBILL
  -> executeT2()
    -> MsgFun._9
    -> ClmsL4FetchVMsgFunc9.execute()
    -> ClmsL4Model.callSpinsdetail9()
    -> SPINSDETAIL_9_L4
    -> 依 declType D/R 可能 update GRNTITEM.ISEVAL
```

關鍵檔案與 method：

- com.tradevan.clms.message.fetch.service.ClmsL4Execute.MsgFun：`_9(new ClmsL4FetchVMsgFunc9())`。
- com.tradevan.clms.message.fetch.service.ClmsL4FetchVMsgFunc9.execute：組 `ClmL4Spinsdetail9InputDTO`，必要時寫 GRNT_SENDLOG。
- com.tradevan.clms.message.fetch.service.ClmsL4Model.callSpinsdetail9：呼叫 `SPINSDETAIL_9_L4`。
- com.tradevan.clms.message.fetch.service.ClmsL4Model.updateGrntitem：依 bondno/refbillno/declno/itemno/strtype/decltype 更新 GRNTITEM.ISEVAL，但目前沒有檢查 affected rows。

待 procedure 確認：`SPINSDETAIL_9_L4` 內部是否真的 INSERT、INSERT 前是否查重/跳過、rowcount=0 或 duplicate 時是否仍回 success。

## 已確認 Procedure 清單

Java/BK 端會呼叫：

- `SPINSSTRBILL`：每個有效 T1 先呼叫，input 含 MSGFUN/BONDNO/STRTYPE/GDSTYPE/REFBILLNO/CTMCODE，output 含 AUTHORITY/RTNCODE/ERRCODE/ERRDESC。
- `SPINSDETAIL_178`：T1=1/7/8 進此 procedure；T1=1 是刪除主線。
- `SPINSDETAIL_9_L4`：T1=9 新增主線。
- `SPINSDETAIL_5_L4`：T1=5 使用，非本次主線但同在 L4 detail flow。

Y path 直接使用 JDBC CallableStatement，procedure 名稱含 schema `PCLMSMGR.`；U/V path 透過 XDAO 呼叫未加 schema 的 procedure name，推測由 datasource user/schema 決定。

## Transaction 邊界與成功判斷

### U/V path

- com.tradevan.clms.message.fetch.service.ClmsL4Execute.execute：取得 `XdaoSessionManager.getDoXdaoSession()`。
- 成功時呼叫 `xdao.commit()`。
- catch exception 時呼叫 `xdao.rollback()`。
- 但 catch 後沒有 rethrow，因此外層可能仍視為處理完成。

### Y path

- com.tradevan.clms.message.fetch.service.ClmsL4FetchYServiceImpl.insertData：raw JDBC connection，`conn.setAutoCommit(false)`。
- 全部處理完呼叫 `conn.commit()`。
- exception 時 `conn.rollback()`。
- catch 後同樣沒有 rethrow。

### 成功判斷

- Dequeue 成功只代表 `QueService.DeQue()` 成功與 `.flg` 建立，不代表 business DB 異動成功。
- Procedure 成功判斷依 output params：`rtnCode != null`、`rtnCode != -1`、`errCode == 0`。
- Java 端沒有檢查 procedure 內 DELETE/INSERT affected rows。
- `GRNTITEM` update 也沒有檢查 affected rows。

## 目前根因假設

最可能造成「接收成功但資料未異動」的原因：

1. 接收成功只是 dequeue/flg 成功，不等於新增/刪除成功。
2. Procedure 可能 where 沒命中或沒有異動，但仍回 rtnCode success / errCode 0。
3. Java 端沒有 executeUpdate rowcount 或 affected rows 檢查。
4. `ClmsL4Execute.executeT2()` catch exception 後只寫失敗 recvlog，不 rethrow；外層仍可能 commit 並搬檔成功。
5. `ClmsL4Execute.execute()` rollback 後不 rethrow；controller 可能仍回 FINISH。
6. `SPINSSTRBILL` T1 成功不代表後續 T2 detail 新增/刪除成功。
7. 格式分流 U/V/Y/ERROR 若不符合客戶檔案格式，也可能造成 T1/T2 沒照預期處理。

## Procedure 核對結論

### SPINSSTRBILL

- `T1=1` 只執行 `NULL`，表頭 procedure 本身不做任何刪除或 DB 異動，但仍可維持 `RTN_CODE=0 / ERR_CODE=0`。
- `T1=9` 會先查 `STRBILL`，不存在才 `INSERT INTO StrBill`。
- 若 `T1=9` 的 `STRBILL` 已存在，procedure 也只做 `NULL`；註解明確表示表頭不擋，交由 detail procedure 處理。
- 因此 `SPINSSTRBILL` 成功只代表表頭檢核或前置作業成功，不代表新增/刪除已完成。

### SPINSDETAIL_178

- `T1=1` 是實際刪除主線，`T1=7/8` 也共用這支 procedure。
- 進倉刪除主查 `INDETAIL`，條件核心為 `BondNo + RefBillNo + Item + InPost`；有資料時刪 `INDETAIL`、`PARTIALSTORE`，必要時刪 `STRBILL`，並可能處理 `GRNTITEM`。
- 出倉刪除主查 `OUTDETAIL`，條件核心為 `BondNo + RefBillNo + Item + OutPost`；有資料時刪 `OUTDETAIL`、`PARTIALSTORE`，必要時刪 `STRBILL`，並可能處理 `GRNTITEM`。
- 若進倉查不到 `INDETAIL`，會再查 `BACK`；若都查不到，回 `RTN_CODE=-1 / ERR_CODE=6 / 查無資料`。
- 若出倉查不到 `OUTDETAIL`，回 `RTN_CODE=-1 / ERR_CODE=6 / 查無資料`。
- procedure 沒有回傳 affected rows，也沒有使用 `SQL%ROWCOUNT` 作為成功判斷。

### SPINSDETAIL_9_L4

- `T1=9` 是實際新增主線。
- 進倉新增會 insert/update `INDETAIL`，必要時寫 `PARTIALSTORE`、`GRNTITEM`、`MODLOG`、`DECLAR` 等。
- 出倉新增會 insert/update `OUTDETAIL`，後續可能核銷並 update `INDETAIL.Balance`，再 update `OUTDETAIL.OutStatus`，並處理 `GRNTITEM`、`DECLAR` 等。
- 已存在且非分批情境時，會回 `原資料己存在[進倉]` 或 `原資料己存在[出倉]`。
- 進倉與出倉的部分 `PARTIALSTORE` insert 區塊有 `WHEN OTHERS THEN NULL`，因此 partialstore 失敗可能不會中斷主流程。
- procedure 沒有回傳 affected rows，也沒有使用 `SQL%ROWCOUNT` 作為成功判斷。

### 舊格式 / Y path 成功判斷風險

- `ClmsL4FetchYServiceImpl` 使用 raw JDBC `CallableStatement`，直接呼叫 `PCLMSMGR.SPINS*`。
- Y path 判斷 detail procedure 時主要看 `RTN_CODE == -1`，不像 U/V path 的 `ClmsL4Model.ReturnCode.isError()` 會同時檢查 `ERR_CODE != 0`。
- 若舊格式封包落到 Y path，存在 `RTN_CODE=0` 但 `ERR_CODE!=0` 時仍被寫成成功 recvlog 的風險。
- 這是「接收端顯示成功，但資料未如預期異動」的高風險來源之一。

## 資料修正方向

- 先用 read-only SQL 確認現況與客戶預期差異，不以接收端「作業成功」作為驗收依據。
- 針對受影響 rows 先產出 before snapshot，或至少保存查詢結果以便 rollback/比對。
- 依 T1 action 分流準備人工修正 SQL：
  - `T1=1`：確認應刪除或還原的 `INDETAIL` / `OUTDETAIL` / `PARTIALSTORE` / `GRNTITEM` / `STRBILL` 狀態。
  - `T1=9`：確認應補入或修正的 `INDETAIL` / `OUTDETAIL` / `GRNTITEM` / `DECLAR` 狀態。
- 修正後回查 `RECVLOG` 與核心業務表，確認資料狀態符合客戶預期。
- 流程分析暫時保留為後續備用；若 PM 後續改回修 Java/procedure，再從本 recap 的 call chain 與風險點接續。

## 若改回修流程時的建議補 Log 位置

- DeqQueneMyService.execute：deqRet、msg[5]、flg path。
- BaseCLMSFetchController.execute：file、ProStatus、搬移目的地。
- ClmsL4FetchServiceImpl.ClmsL4FetchType：實際選到 U/V/Y/ERROR、第一行長度、encoding 判斷。
- ClmsL4FetchUServiceImpl.checkT1 / ClmsL4FetchVServiceImpl.checkT1：hszMsgFun、bondNo、refBillNo、strType。
- ClmsL4Execute.execute：transaction begin/commit/rollback、controlno。
- ClmsL4Execute.executeT2：每筆 T2 的 item、declno、itemno、呼叫哪個 MsgFun、proc return。
- ClmsL4Model.callSpInsDetail178Stmt / callSpinsdetail9：input key、rtnCode、errCode、errDesc、若 procedure 可提供則加 affected rows。
- ClmsL4Model.updateGrntitem：where 條件與 affected rows。

## 資料修正前 read-only 驗證 SQL 草稿

```sql
-- 本次 L4 處理結果
select controlno, bondno, recvtype, keyword, msgtype, procstatus, procrmk, proctime
from recvlog
where controlno = :controlno
order by proctime;

-- T1 master 是否存在
select bondno, refbillno, strtype, gdstype, ctmcode
from strbill
where bondno = :bondno
  and refbillno = :refbillno
  and strtype = :strtype;

-- T1=9 新增後確認 GRNTITEM 是否有資料
select *
from grntitem
where bondno = :bondno
  and refbillno = :refbillno
  and declno = :declno
  and itemno = :itemno;

-- T1=1 刪除後確認舊報單/項次是否仍存在
select *
from grntitem
where bondno = :bondno
  and refbillno = :refbillno
  and declno = :odeclno
  and itemno = :oitemno;

-- 保證金 send log
select *
from grnt_sendlog
where controlno = :controlno
order by processtime, updtime;
```

## 資料修正所需 key

- controlno / L4 檔名。
- bondno / refbillno / strtype / item / strpost。
- declno / itemno / odeclno / oitemno。
- 客戶預期結果：`T1=1` 要刪哪筆，`T1=9` 要補哪筆。
- 現況查詢結果：`RECVLOG`、`STRBILL`、`INDETAIL` 或 `OUTDETAIL`、`GRNTITEM`、`GRNT_SENDLOG`。
