---
type: session-recap
date: 2026-05-04
project: PCLMS_AP
system: PCLMS
repo: PCLMS_AP
topic: month-report-orphan-header-investigation
status: done
tags: [recap, session, pclms, month, outdetail, investigation]
summary: 調查 PCLMS 彙報出倉孤兒表頭與未確認報單，釐清 month 表頭、outdetail 與 iconfirmed 狀態落差。
---

# Session Recap：PCLMS 彙報出倉孤兒表頭與未確認報單調查

## 任務背景

客戶反應出倉報單 `CW  1401371477` 一直卡在待確認，但客服截圖曾顯示彙報單 `25MB000106K038` 有核銷紀錄。使用者查詢已申報彙報單時，依出倉報單號碼查到的卻是 `25MB0001060022`，點入後無明細。

## 已確認資料狀態

- `declar`：`bondno=CD178`、`declno=CW  1401371477`、`strtype=2`、`decltype=D5`、`iconfirmed=N`、`rlstime=2025-06-20`、`msgtype=N5203`。
- `decldetail`：所有項次皆缺原進倉報單號碼/項次，也就是 `odeclno/oitemno` 空。
- `outdetail`：以 `CW  1401371477`、`25MB000106K038`、`25MB0001060022` 等條件查不到有效明細。
- `month`：`25MB0001060022` 有表頭，且已申報彙報單清表可查到，但無 `outdetail` 明細支撐。
- `user_action`：`2025-06-20 19:51:30`，使用者 `adw0283` 執行 `/APCLMS/servlet/listCatMonthSave`，參數為 `declno:CW  1401371477, decltype:D5, monthno:25MB0001060022, rb:1, strtype:2`。

## 程式流程判斷

### 出倉明細彙整

`CatMonthresult` 的出倉清單來源是 `outdetail`，條件包含 `o.monthno is null / '' / '-'`。因此，沒有完成出倉確認、沒有 `outdetail` 的報單，正常不會在出倉明細彙整清單被挑到。

`CatMonthSave` 會先更新明細的 `monthno`，再 insert `month`，且以 `monthcount == itemcount && itemcount > 0` 控制 commit。正常情況下不會只產生空的 `month` 表頭。

### 彙報報單號碼確認

`listCatMonthSave` 查的是 `declar`，只檢核：報單存在、`strtype/decltype` 符合、`rlstime` 已放行、`iconfirmed` 不是 `Y`。它沒有檢查 `decldetail.odeclno/oitemno`，也沒有先確認該 `monthno` 底下必定有 `outdetail` 明細。

因此，`iconfirmed=N` 且已放行的出倉報單，可以在 `listCatMonthSave` 被填入作為彙報報單號碼。正常成功後，程式會更新：

```sql
update month
set declno = ?, decltype = ?, confirmdate = to_char(sysdate, 'YYYYMMDD')
where bondno = ? and monthno = ?;

update declar
set iconfirmed = 'Y'
where bondno = ? and declno = ? and strtype = '2';
```

## 目前最合理推論

這案不是「出倉明細彙整時挑到未確認出倉報單」，而是「彙報報單號碼確認時，允許使用未確認但已放行的報單」。

`25MB0001060022` 目前只剩 `month` 表頭且沒有 `outdetail`，屬孤兒表頭。若 `listCatMonthSave` 當時完整成功，`CW  1401371477` 理應被改為 `Y`；現在仍為 `N`，代表後續可能有回復未申報、刪除出倉明細、人工 SQL 或非標準資料更新。

`25MB000106K038` 若在目前 DB 已查不到，標準流程中可能由 `CancelMonth` 刪除 `month` 表頭；但 `CancelMonth` 不刪 `outdetail`，只會將明細 `monthno` 清空。因此如果目前完全沒有 `outdetail`，需另追後續是否執行 `chkOutDetaildel / chkOutDetaildelList` 或其他清資料流程。

## 建議後續排查

```sql
select user_id, bond_no, startdate, starttime, url, attribute, declno, refbillno, message
from pclmsmgr.user_action
where bond_no = 'CD178'
  and startdate >= '20250620'
  and (
       replace(attribute, ' ', '') like '%CW1401371477%'
    or replace(declno, ' ', '') = 'CW1401371477'
    or attribute like '%25MB0001060022%'
    or attribute like '%25MB000106K038%'
  )
order by startdate, starttime;
```

重點找：`CancelMonth`、`RlsCatMonth_Return`、`chkOutDetaildel`、`chkOutDetaildelList`。

## 對外說法草稿

經查目前系統資料，`CW  1401371477` 報單主檔仍為待確認，且報單明細缺原進倉報單號碼及項次，因此無法透過正常確認出倉流程完成核銷。另查得 `25MB0001060022` 僅有彙報表頭，無對應出倉明細支撐，需另行釐清該表頭資料來源及後續是否有取消彙報、回復未申報或刪除出倉明細操作。