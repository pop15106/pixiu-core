---
type: session-recap
date: 2026-05-04
project: PCLMS_AP
system: PCLMS
repo: PCLMS_AP
topic: month-report-investigation-and-recap-skill-fix
status: done
tags: [recap, session, pclms, pixiucore]
summary: 收斂 PCLMS 按月彙報出倉調查結果，並修正使用者主動 recap 必須回寫 Obsidian 的技能規則。
---

# Session Recap：PCLMS按月彙報出倉調查與Recap技能修正

## 任務目標與背景

本次任務從 Dashboard Inbox 觸發，調查 PCLMS_AP 按月彙報出倉流程：使用者發現「新增彙報出倉資料」流程似乎可挑選沒有原進倉報單項次的未確認報單，且客戶截圖顯示該筆按月已有已核銷狀態。後續調整調查方向為兩個問題：

1. 已確認出倉報單在什麼狀況下，出倉明細會被刪除並還原待確認，調查範圍包含 AP 與 BK。
2. 已完成按月後，為何測試資料沒有改成已確認。

後續使用者回查營運資料後確認：該流程實際有把出倉報單改為確認、在 decldetail 寫入原進倉報單項次、存倉有紀錄、monthno 有回寫，errorlog 也沒有異常紀錄。

## 本次完成

1. 讀取 PixiuCore 初始化資料與 Dashboard Inbox，確認本次任務來自 Dashboard 的 AI Inbox。
2. 盤點 AP/BK 中與 outdetail 刪除、iconfirmed 狀態變更、按月彙報確認相關的程式。
3. 確認 AP 的 chkOutDetaildel / chkOutDetaildelList 會在刪除 outdetail 後，如果該出倉報單已無剩餘 outdetail，就把 Declar.iconfirmed 改為 N。
4. 確認 RlsCatMonth_Return 會回復未申報狀態，清 month 的報單號與確認日期，並把 Declar.iconfirmed 改為 N。
5. 確認 CatMonthBatchSave 只負責建立 month 表頭與掛 outdetail.monthno，不會把 declar.iconfirmed 改為 Y。
6. 確認 listCatMonthSave 才是把 month 回填報單號、更新 outdetail/indetail 關聯、並把 declar.iconfirmed 改為 Y 的關鍵流程。
7. 使用者回查營運資料後確認流程實際已補齊 decldetail 原進倉報單項次、存倉紀錄與 monthno，因此目前可將此流程歸納為按月彙報流程允許前段先不完整填原進倉報單項次，後續由出倉彙整/彙報確認補齊。
8. 依使用者要求，已修改 PixiuCore 的 pixiu-session-recap 技能，讓使用者主動輸入 recap / 摘要 / 現在到哪了 / 下一步 / 進度 時，必須立即寫入 vault/memory/recaps，不再使用「Quick Recap 不寫檔」規則。

## 進行中

目前工作狀態：PCLMS 按月彙報出倉流程根因調查已形成可用結論，下一步是協助使用者產出搬測試環境所需的完整查詢 SQL 或匯出 SQL。

各階段狀態：

- Phase 1：讀取 Inbox 與調整調查方向：完成
- Phase 2：AP/BK 程式流程盤點：完成
- Phase 3：營運資料回查與結論修正：完成
- Phase 4：測試資料搬移 SQL：進行中
- Phase 5：Recap 技能修正與本次回寫：完成

## 當前規劃完整內容

### 按月彙報流程歸納

若出倉報單屬於按月彙報流程，前段挑選/彙整階段允許未完整帶入原進倉報單項次；後續透過出倉彙整與彙報報單確認流程，系統會補回原進倉報單項次，並同步完成報單確認、存倉紀錄與 monthno 回寫。

限制：這個結論只適用按月彙報流程，不可外推到所有一般出倉報單。

### 關鍵程式

- `CatMonthBatchSave.java`：建立 month 表頭，將 outdetail.monthno 掛上彙報單號。
- `listCatMonthSave.java`：輸入彙報報單號與類別後，更新 month.declno / confirmdate、更新 outdetail/indetail 的報單號與項次關聯，並更新 declar.iconfirmed = 'Y'。
- `chkOutDetaildel.java` / `chkOutDetaildelList.java`：刪除出倉明細，若該 declno 已無任何 outdetail，會把 declar.iconfirmed 改回 N。
- `RlsCatMonth_Return.java`：回復未申報狀態，清 month 的 declno/confirmdate，並改 declar.iconfirmed = N。
- BK `CleanInOutDataServiceImpl`：可刪出倉相關資料，但 CleanJobs 的 C9 目前註解，非一般啟用流程。

### 測試資料搬移原則

測試環境不要只搬出倉報單，要搬完整核銷鏈：

- declar
- decldetail
- outdetail
- month
- strbill
- 對應 indetail
- 必要時 grntitem

若同一原進倉被其他出倉共用，也要查出來評估庫存影響，不宜只搬單一料號。

### 使用者目前提供的查詢條件

- bondno = CD178
- declno = CW  1401371477，prdtno = IRFC0621
- declno = CSB214267S0697，prdtno = IRFC1012

## 重要決策（含棄選方案）

| 決策點 | 選擇 | 棄選方案 | 原因 |
|--------|------|---------|------|
| 按月彙報出倉流程結論 | 允許前段先缺原進倉報單項次，後續由按月彙報確認補齊 | 認定為資料異常或一定要人工先填齊 | 營運資料回查已確認 decldetail、存倉、monthno、iconfirmed 均完成 |
| Recap 技能行為 | 使用者主動輸入 recap 時必須回寫 Obsidian | Quick Recap 只輸出、不寫檔 | 使用者要求 recap 必須將當前 recap 內容回寫，避免記憶斷點只留在對話中 |
| 測試資料搬移策略 | 搬完整核銷鏈 | 只搬單一出倉報單與料號 | 避免測試環境因 indetail / strbill / grntitem / month 缺資料而得到假異常 |

## 發現的問題 / 踩坑

- 原本 pixiu-session-recap 技能存在 Quick Recap 不寫檔規則，與使用者期待衝突；已修正為 User-triggered Recap 必須寫檔。
- 第一次修改 Skill 時 PowerShell 反引號造成 `recap` 與 `vault` 文字轉義異常；已立即修正，三份 SKILL.md SHA256 一致。
- `listCatMonthSave` 即使內部更新前段成功與否需要看筆數與 errorlog，但使用者回查營運資料確認 errorlog 無紀錄且資料已正確回填，因此本案不再以錯誤分支為主因。

## 下次 session 要做的事

- [ ] 依 CD178 / CW  1401371477 / IRFC0621 與 CSB214267S0697 / IRFC1012 產出完整測試環境搬移查詢 SQL。
- [ ] 補查同一原進倉是否被其他 outdetail 共用，避免測試環境庫存鏈不完整。
- [ ] 若要實際搬測試環境，先確認匯出方式、目標環境、是否需要保留 rowid/序號/時間欄位。

## 補充筆記

本次未修改 PCLMS_AP / PCLMS_BK_new 程式碼，只修改 PixiuCore 的 pixiu-session-recap 技能規則，屬 AI 流程規範調整。