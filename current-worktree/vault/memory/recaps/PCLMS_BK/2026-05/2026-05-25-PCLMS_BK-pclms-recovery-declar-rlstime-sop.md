---
type: session-recap
date: 2026-05-25
project: PCLMS_BK
system: PCLMS
repo: Playground
topic: pclms-recovery-declar-rlstime-sop
status: follow-up
tags: [recap, pclms, pclms-bk, recovery-declar, rlstime, sql, workflow]
source_paths:
  - C:/Users/7010/Documents/Playground/docs/superpowers/plans/2026-05-25-pclms-recovery-declar-rlstime-flow.md
  - C:/Users/7010/Desktop/Project/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/pclms/service/RecoveryDeclarService.java
  - C:/Users/7010/Desktop/Project/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/pclms/service/ProcessStagingDataServiceImpl.java
  - C:/Users/7010/Desktop/Project/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/pclms/model/DeclarModel.java
  - C:/Users/7010/Desktop/Project/PCLMS_BK_new/JAVA/pclms_bp/src/main/java/com/tradevan/pclms/model/PclmsDataModel.java
  - C:/Users/7010/Desktop/Project/PCLMS_BK_new/JAVA/jks/SCT/clRecoveryDeclarService
  - C:/Users/7010/Desktop/Project/PCLMS_BK_new/JAVA/jks/SCT/start.sh
summary: 已整理 PCLMS `N5116` 放行訊息重收 SOP，確認 recovery trigger 檔名前段應使用 `IM_5116M_N.TRANSACTION_ID`，後續需以實際 declno 清單執行 DB 與主機驗證。
---

# Session Recap：PCLMS 報單放行資料重收與 RLSTIME 更新 SOP

> 日期：2026-05-25 16:21
> 專案：PCLMS
> AI：Codex

## 觸發與背景

- 使用者要整理一個 PCLMS 執行流程，目標是針對 `DECLNO` 以 `CX  ` 開頭、且 `BOXNO = '2230'` 的報單，重新建立 recovery trigger file，讓 `clRecoveryDeclarService` 重收放行訊息。
- 原始流程草稿提到從 `DECLAR` 找 `declno`，再用 `IM_5116M_N` 產 `touch` 指令，到 `/PCLMS/log/recoveryFile` 建檔，必要時重啟 `/APCLMS/SCT/clRecoveryDeclarService`，最後從 `RELEASE` 找重收後 `RLSTIME` 更新回 `DECLAR`。
- 使用者後續微調文件，要求 Task 1 Step 2 改成 `declno IN (...)` 方便自行貼報單號，且 Task 2 產生指令的 SQL 要直接用 `IM_5116M_N` 裡面的 `decl_no`。

## 結論

- 已建立中文 SOP 文件：`C:/Users/7010/Documents/Playground/docs/superpowers/plans/2026-05-25-pclms-recovery-declar-rlstime-flow.md`。
- repo 證據顯示，`RecoveryDeclarService` 掃描 `/PCLMS/log/recoveryFile` 後，會把檔名用 `_` 拆成 `transId_msg`。
- 對 `N5116`，流程會走 `ProcessStagingDataServiceImpl.doReleaseI(transId)`，而 `DeclarModel.getAIm5116M(transId)` 是用 `IM_5116M_N.TRANSACTION_ID = transId` 取 staging source，不是用 `CONTROL_NO`。
- 因此 SOP 裡產生 `touch` 指令時，主版 SQL 使用 `n.transaction_id || '_' || n.msg_type`，並把 `n.decl_no IN (...)` 留給使用者貼實際報單號。

## 證據與流程

- `RecoveryDeclarService.java`：
  - 固定掃 `/PCLMS/log/recoveryFile`。
  - `scanFolder()` 用 `_` 拆檔名，前段放入 `transId`，後段放入 `msg`。
  - `releaseStr = "N5204,N5116"`；若 `msg` 包含 `N5116`，呼叫 `ps.doReleaseI(transId)`。
- `ProcessStagingDataServiceImpl.java`：
  - `doReleaseI(transId)` 會呼叫 `dModel.getAIm5116M(transId)`。
  - 成功取得 source 後，`makeReleaseI()` 呼叫 `pModel.getIm5116MInput(src)`，再呼叫 `pModel.insertRelease(procInpts)`。
- `DeclarModel.java`：
  - `getAIm5116M(transId)` 使用 `Im5116mNDo.TRANSACTION_ID` 作為 where condition。
- `PclmsDataModel.java`：
  - `getIm5116MInput()` 將 `broker_box_no + broker_sub_box_no` 組成 `IN_BOXNO`。
  - 將 `release_date + release_time` 組成 `IN_RLSTIME`。
  - `insertRelease()` 呼叫 stored procedure `SpInsRelease`。
- `JAVA/jks/SCT/clRecoveryDeclarService`：
  - 進入 `/APCLMS/JAVA` 後執行 `java com.tradevan.pclms.service.RecoveryDeclarService`。
  - 外層 shell 有 `while true` 與 `sleep 180`。
- `JAVA/jks/SCT/start.sh`：
  - 會檢查並啟動 `clRecoveryDeclarService`。

## 已做變更

- 新增並中文化 SOP：
  - `docs/superpowers/plans/2026-05-25-pclms-recovery-declar-rlstime-flow.md`
- SOP 內容包含：
  - `DECLAR` 目標報單查詢。
  - `IM_5116M_N` staging row 查詢。
  - 用 `TRANSACTION_ID` 產生 `touch/chmod 777` 指令。
  - 到 `/PCLMS/log/recoveryFile` 建立 trigger files。
  - 重啟與觀察 `clRecoveryDeclarService`。
  - 從 `RELEASE` 查重收後放行時間，並用 `MERGE` 更新 `DECLAR.RLSTIME` 的 SQL 模板。
- 依使用者最新指示調整：
  - Task 1 Step 2 改成直接查 `im_5116m_n n`，使用 `n.decl_no IN (...)` 讓使用者自行貼報單號。
  - Task 2 Step 1 改成直接從 `im_5116m_n n` 產生指令，條件同樣使用 `n.decl_no IN (...)`，不再依賴 `source_rows` CTE。

## 驗證

- 已用 `Get-Content -Encoding UTF8` 確認 SOP 中文顯示正常。
- 已用 `Select-String -Encoding UTF8` 確認關鍵段落存在：
  - `Task 1: 找出要重收的報單`
  - `Task 2: 產生 recovery trigger 指令`
  - `FROM im_5116m_n n`
  - `n.decl_no IN (...)`
- 尚未執行真實 DB SQL、主機 `touch`、`kill -9`、或重啟 service；本 recap 狀態因此維持 `follow-up`。

## 下一步

- [ ] 將實際 `CX  ...` 報單號貼進 Task 1 Step 2 與 Task 2 Step 1 的 `n.decl_no IN (...)`。
- [ ] 先跑 Task 1 Step 2，確認每筆都有 `IM_5116M_N.TRANSACTION_ID` 與 `N5116` source row。
- [ ] 到主機 `/PCLMS/log/recoveryFile` 建立 trigger file，並確認檔案權限。
- [ ] 重啟或確認 `clRecoveryDeclarService` 後，追 `/PCLMS/log/clBackendManager/clRecoveryDeclarService.log`。
- [ ] 檢查 `RELEASE` 重收結果，再由使用者確認是否執行 `DECLAR.RLSTIME` 更新 SQL。

## 備註

- 這次最重要的停損點是 `CONTROL_NO` 與 `TRANSACTION_ID` 不可混用。repo 目前版本的 recovery service 期待的是 `TRANSACTION_ID`。
- 若正式環境已被客製成使用 `CONTROL_NO`，必須先以正式環境程式或 log 驗證後，才能改用 `CONTROL_NO` 版本。

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 產出。*
