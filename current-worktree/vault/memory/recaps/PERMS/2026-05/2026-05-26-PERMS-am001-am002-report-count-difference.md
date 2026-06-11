---
type: session-recap
date: 2026-05-26
project: PERMS
system: PERMS
repo: perms
topic: perms-am001-am002-report-count-difference
status: done
tags: [recap, perms, report-tracing, am001, am002]
source_paths:
  - C:/Users/7010/Desktop/gravityTest/perms/AM001_AM002_報表筆數差異分析.md
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/webapp/pages/am/AM001.jsp
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/webapp/pages/am/AM002.jsp
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/action/am/AM001Action.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/java/com/tradevan/perms/action/am/AM002Action.java
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/resources/mapper/ApplyMainMapper.xml
  - C:/Users/7010/Desktop/gravityTest/perms/src/main/resources/mapper/XauthCompanyMapper.xml
summary: 已整理 AM001 與 AM002 報表筆數差異，核心原因是 AM001 明細未排除 NOW_STATUS 999/NULL，AM002 則排除 999 並採年月與母子公司報表口徑。
---

# Session Recap：PERMS AM001 / AM002 報表筆數差異分析

> 日期：2026-05-26 15:10
> 專案：PERMS
> AI：Codex

## 觸發與背景

使用者要求再追 AM001 報表與 AM002 報表為什麼存在筆數差異，後續要求整理成 `.md` 文件，且要有程式碼作證。依 AGENTS / PixiuCore 規則，先查 second-brain 作為 lead，再回 repo source tracing，最後產出可交接的 Markdown 文件。

## 結論

- AM001 與 AM002 都以 `APPLY_MAIN` 為主資料來源，但不是同一個統計口徑。
- AM001 是明細查詢，走 `AM001Action.query()` 與 `ApplyMainMapper.sel_mg001_01`，條件包含公司、申請表編號、證照號碼、統一編號與精確交易日期時間，但 SQL 沒有排除 `NOW_STATUS = '999'`。
- AM002 是年月彙總報表，走 `AM002Action.print()` 與 `ApplyMainMapper.sel_rpt_001`，用 `TO_CHAR(TRADE_DATE, 'YYYYMM')` 彙總，且明確加上 `NOW_STATUS != '999'`。
- Oracle 條件 `NOW_STATUS != '999'` 不會納入 `NOW_STATUS IS NULL`，所以 AM001 若查到 `999` 或 NULL 狀態，AM001 筆數會比 AM002 多。
- AM002 若選到母公司，還會透過 `XauthCompanyMapper.selectRecCompany` 產生母子公司 Sheet2；若拿 AM001 單一公司明細比 AM002 Sheet2，也會因公司範圍不同而不一致。

## 證據與流程

- UI 入口：
  - `AM001.jsp` 查詢欄位包含 `compBan`、`taxAppNo`、`passportNo`、`sellerId`、`begDateStr`、`endDateStr`，查詢 URL 是 `${pid}!query`。
  - `AM002.jsp` 透過 `viewReport` 呼叫 `${pid}!print`，報表格式是 `xls`，條件是 `compBan`、`begYm`、`endYm`。
- Action：
  - `AM001Action.query()` 將 `compBan` 塞入 `bean.setSellerId(compBan)`，再把 `begDateStr`、`endDateStr` 放入 map，呼叫 `commonService.query(..., "sel_mg001_01", map)`。
  - `AM002Action.print()` 將 `sellerId`、`begYm`、`endYm` 放入 params，呼叫 `ApplyMainMapper.sel_rpt_001` 產生 Sheet1；若判斷是母公司，再呼叫 `XauthCompanyMapper.selectRecCompany` 與 `ApplyMainMapper.sel_rpt_001_02` 產生 Sheet2。
- SQL：
  - `sel_mg001_01` 查 `PERMSMGR.APPLY_MAIN`，有 `TAX_APP_NO`、`PASSPORT_NO`、`SELLER_ID`、`TRADE_DATE >=`、`TRADE_DATE <=` 條件，但沒有 `NOW_STATUS` 條件。
  - `sel_rpt_001` 查 `APPLY_MAIN`，有 `SELLER_ID=#{sellerId}`、`NOW_STATUS != '999'`、`TO_CHAR(TRADE_DATE, 'YYYYMM') BETWEEN #{begYm} AND #{endYm}`，並以年月 group by。
  - `sel_rpt_001_02` 以 `XAUTH_COMPANY` left join `APPLY_MAIN`，join 條件同樣包含 `B.NOW_STATUS != '999'`。
  - `selectRecCompany` 以 recursive `WITH DATA_LIST` 從母公司 `COMP_BAN` 往下抓 `PARENT_BAN` 子公司。

## 已做變更

- 新增 repo 文件：
  - `C:/Users/7010/Desktop/gravityTest/perms/AM001_AM002_報表筆數差異分析.md`
- 文件內容包含：
  - AM001 / AM002 流程對照表。
  - JSP、Action、Mapper SQL 的程式碼證據片段。
  - 差異原因整理表。
  - 可直接拿去 DB 驗證的 SQL，包括狀態拆分、AM002 同口徑月統計、AM001 多出資料清單、AM002 Sheet2 母子公司口徑。
  - 對外說法草稿。

## 驗證

- 已用 `Select-String` 檢查新文件命中關鍵段落：
  - `NOW_STATUS`
  - `sel_mg001_01`
  - `sel_rpt_001`
  - `selectRecCompany`
  - `建議驗證 SQL`
  - `對外說法`
- 已用 `git status --short -- AM001_AM002_報表筆數差異分析.md` 確認 repo 新增該 Markdown 文件。
- 未連線資料庫執行 SQL，因此實際差額數字仍需用文件中的驗證 SQL 對目標環境資料確認。

## 下一步

- [ ] 若要定案實際差額，請以同一組 `compBan`、`begDateStr/endDateStr` 或 `begYm/endYm` 跑文件中的驗證 SQL，確認 `NOW_STATUS = '999'` 與 `NOW_STATUS IS NULL` 的筆數。
- [ ] 若使用者比對的是 AM002 Sheet2，需先確認 AM001 是否也改用母子公司清單口徑，避免單一公司明細與母子公司彙總互比。

## 備註

second-brain 查詢沒有直接命中 AM001/AM002 的既有結論，只命中類似報表筆數差異需回 repo / SQL 追口徑的舊線索；最終結論以本次 repo 檔案 tracing 為準。

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 產出。*
