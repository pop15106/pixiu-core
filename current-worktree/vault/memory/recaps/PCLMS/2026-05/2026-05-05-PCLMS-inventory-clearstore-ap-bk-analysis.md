---
type: recap
date: 2026-05-05
project: PCLMS
system: PCLMS
repo: PCLMS_AP,PCLMS_BK_new
topic: inventory-clearstore-ap-bk-analysis
status: follow-up
tags: [pclms, inventory, clearStore, balance, code-review, root-cause-analysis]
summary: 深度比對 PCLMS AP 與 BK 的庫存核銷鏈路，聚焦 clearStore、交易邊界與異常落點。
---

# PCLMS 庫存核銷問題 — AP + BK 雙端深度分析

## 背景

客戶反映「庫存核銷不準確，需手動調整」。針對此問題對 PCLMS_AP（核銷引擎、出倉 servlet）與 PCLMS_BK（L1/L4 訊息產生、PublishMsg 回寫）進行全面程式碼審查。

## 調查範圍

- **AP 端**：`clearStore.java`（核銷引擎）、`chkOutDetailaddSave/check/del.java`（出倉 CRUD）、`listCatMonthSave.java`（按月彙報）、`RlsDeclareConfirmItemsUpdate.java`（報單確認）
- **BK 端**：`PclmsL1U.java`（L1 訊息產檔）、`EnqueueL4_modified.java`（L4 傳送）、`PublishMsg.java`（海關訊息轉發）、`IOGServiceImpl.java`（進出倉檢核）

## 發現：10 項風險因素

### 🔴 高風險（2 項）
1. **AP — 出倉 INSERT 與核銷分屬不同交易**：`chkOutDetailaddSave` 先 commit 出倉明細，clearStore 用獨立 Connection，失敗時 balance 沒扣
2. **AP — clearStore 每筆迴圈 commit**：多筆 outdetail 部分失敗無法回滾

### 🟠 中風險（4 項）
3. AP — 修改出倉先還原再核銷分離
4. AP — 刪除出倉只還原 OS10，OS09 部分扣減永遠回不來
5. AP — 彙報更新 declno 連鎖斷裂
6. BK — L1U `PclmsL1U.java` Line 331 關錯 ResultSet（`rset.close()` 應為 `chkT2Rest.close()`）

### 🟡 低風險（4 項）
7. AP — 浮點精度 `calQty.formatQty` 截斷
8. AP — `clearStore` wasNull 使用錯誤 ResultSet（Line 347/351）
9. BK — L4 傳送 recvId 為空時不重試
10. BK — PublishMsg 轉發失敗只記 info log

## 根因推斷

**風險 1 + 2 的組合**最可能：出倉操作已 commit，核銷引擎因獨立 Connection + 每筆 commit 設計，失敗後 balance 不一致且無法自動恢復。

## 建議的後續行動

| 優先序 | 行動 |
|--------|------|
| P0 | 查 clearStore errlog，確認核銷失敗紀錄 |
| P0 | SQL 比對 outdetail/indetail 不一致案例 |
| P1 | 將 clearStore 納入調用方交易單元 |
| P1 | clearStore 改為整批 commit |
| P2 | 修正 wasNull bug + L1U ResultSet bug |
| P3 | 增加 balance 更新前防負值檢核 |

## 產出物

- 完整分析報告：`~/.gemini/antigravity/brain/28f6124c-.../inventory_writeoff_analysis.md`
- Session walkthrough：`~/.gemini/antigravity/brain/28f6124c-.../walkthrough.md`

## 備註

本次為純程式碼審查，未修改任何原始碼。
