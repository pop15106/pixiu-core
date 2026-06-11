---
type: session-recap
date: 2026-06-05
project: PCLMS
system: PCLMS
repo: PCLMS_AP
topic: decltype-t-balance-sa-review
status: follow-up
tags: [recap, pclms, pclms-ap, decltype-t, balance, back, sp, sa-review]
source_paths:
  - C:\Users\7010\Desktop\gravityTest\PCLMS_AP\docs\pclms-decltype-T-balance-analysis.md
  - C:\Users\7010\Desktop\gravityTest\PCLMS_AP\docs\pclms-decltype-T-balance-sa-review.md
  - C:\Users\7010\Desktop\gravityTest\PCLMS_AP\docs\pclms-decltype-T-balance-sa-review.docx
  - C:\Users\7010\Desktop\gravityTest\PCLMS_AP\JAVA\pclms_mvn\src\main\resources\conf\xdao.xml
  - C:\Users\7010\Desktop\gravityTest\PCLMS_AP\JAVA\pclms_mvn\src\main\java\service\impl\GoodsBalanceServiceImpl.java
  - C:\Users\7010\Desktop\gravityTest\PCLMS_AP\JAVA\pclms_mvn\src\main\java\service\impl\CalBalanceServiceImpl.java
  - C:\Users\7010\Desktop\gravityTest\PCLMS_AP\JAVA\pclms_mvn\src\main\java\service\impl\GrntServiceImpl.java
  - C:\Users\7010\Desktop\gravityTest\PCLMS_AP\JAVA\pclms_mvn\src\main\java\service\impl\OutNMonthsServiceImpl.java
  - C:\Users\7010\Desktop\SPINSDETAIL_178.sql
  - C:\Users\7010\Desktop\Spinsdetail_9_L4.sql
summary: "核對 Claude 對 PCLMS decltype=T / BACK / BALANCE 的分析，確認主方向可採信但修法需先釐清 BACK 語義；並產出給 SA 的 Markdown 與 DOCX 報告。"
---

# Session Recap：PCLMS decltype=T / BACK / BALANCE 分析核對與 SA 報告

> 日期：2026-06-05
> 專案：PCLMS
> AI：Codex

## 觸發與背景

- 使用者要求核對 Claude 的 docs/pclms-decltype-T-balance-analysis.md 是否正確。
- 使用者提供兩個 Oracle SP SQL 檔供參考：SPINSDETAIL_178.sql、Spinsdetail_9_L4.sql。
- 後續要求把 Claude 分析與 Codex 核對結果整理成 .md 與 .docx，供 SA 查看。

## 結論

- Claude 分析大方向可採信，約 75% 正確。
- 已確認 SPINSDETAIL_178 的 MsgFun=8 / 移倉相關段落存在 UPDATE INDETAIL SET balance = rinqty - toutqty + backqty 類型邏輯。
- 已確認 Spinsdetail_9_L4 出倉重算公式為 v_rinqty - (v_sumoutqty + v_rstrqty - v_sumbackqty + v_sumtestitem)，也就是 BACK 量會加回 balance。
- 已確認 AP 端多處查詢吃 INDETAIL.BALANCE，包含貨物庫存、庫存核銷試算、保證金計算與逾 N 月未出倉查詢。
- 但不能直接定案把所有 + backqty 改為 - backqty；需要先釐清 BACK 是否混用移倉中間態、退貨暫存、分批輔助等多種語義。

## 證據與流程

- xdao.xml 不是本題主體 SQL；目前看起來主要是 XDAO connection / encoding / show-sql 設定。
- GoodsBalanceServiceImpl.getSql() 直接 select i.balance，並用 i.balance != 0 篩選庫存，未 join BACK 修正。
- CalBalanceServiceImpl.getSql() 顯示公式為 i.balance + outqty + testqty - backqty，且 BACK 子查詢會套 indate > inEndDate。
- GrntServiceImpl.getOutGrntitemInventorySQl() 用 decltype in ('P','T') and balance>0 接 GRNTITEM STRTYPE='2'。
- OutNMonthsServiceImpl 也使用 BALANCE > 0 與 uninqty + balance，應納入回歸檢查。
- SPINSDETAIL_178.sql 也確認刪除 OS10 出倉時使用 v_newbalance := v_balance + v_strqty，若原 balance 已虛高，會在虛高基礎上再加回。

## 已做變更

- 新增 SA review Markdown：docs/pclms-decltype-T-balance-sa-review.md。
- 新增 SA review Word：docs/pclms-decltype-T-balance-sa-review.docx。
- 新增本地產檔腳本：tools/build_pclms_balance_sa_docx.py。
- 曾新增驗證/匯出輔助腳本：tools/export_docx_to_pdf.ps1、tools/verify_pclms_balance_sa_report.py。
- 未修改 PCLMS 業務 Java / SQL 原始碼。

## 驗證

- 使用 CodeGraph / rg / PowerShell 針對 Java 與 SQL 片段做來源核對。
- DOCX 已由 python-docx 產出。
- DOCX 視覺 render 未完成：artifact-tool 在此環境連最小 DOCX smoke test 都靜默失敗；LibreOffice 不存在；使用者拒絕 Word COM 匯出並要求停止檢查。
- 因使用者明確表示「不用檢查了，到這裡就好」，未再執行非視覺驗證腳本。

## 下一步

- [ ] SA 先用正式 DB 抽樣確認 BACK.rinqty 在 T / P 類案例中的業務語義。
- [ ] 盤點 OUTDETAIL.outstatus <> 'OS10' 的長期 OS01 案例，確認「沒扣」規模。
- [ ] 若確認 SP 公式錯，先設計 SP 修正與資料補正 SQL，不建議只修 AP 顯示。
- [ ] 回歸檢查貨物庫存查詢、庫存核銷試算、保證金計算、逾 N 月未出倉。

## 踩坑紀錄

- `xdao.xml` 是容易誤導的入口：使用者 IDE 開著 `xdao.xml`，但本題真正業務 SQL 不在 `xdao.xml`，而是在 Java 動態 SQL 與外部 Oracle SP。後續遇到 balance / BACK 問題，不要只停在 `xdao.xml`。
- `BACK` 語義不能先入為主：Claude 建議把 `+ backqty` 改 `- backqty`，但 SP 內 `BACK` 可能同時服務移倉、退貨、分批進倉輔助等語義。未用 DB 案例分類前，不能直接全域反號。
- `partialflg='1'` 的說法要精準：它會讓 `v_rstrqty` 歸零，但若該筆出倉已進入 `OUTDETAIL outstatus='OS10'` 的 `v_sumoutqty`，仍可能在重算中被扣到。不能簡化成「一定完全沒扣」。
- `artifact-tool` 在本機環境不可用：對正式 DOCX 與最小 smoke DOCX 都靜默失敗，stdout/stderr 皆空。後續不要把這次失敗誤判成報告 DOCX 壞掉。
- LibreOffice renderer 不可用：本機沒有 `soffice/libreoffice`，所以無法用 Documents skill 的 LibreOffice 備援 render。
- Word COM 匯出 PDF 需要使用者同意：曾準備用隱藏 Word COM 轉 PDF 做視覺 QA，但使用者拒絕執行，後續依使用者指示停止檢查。
- PowerShell / Python 偶發 `windows sandbox: spawn setup refresh`：多次讀檔或執行 Python 時出現沙箱啟動錯誤；必要時要改用已核准命令或 request escalation，但不要無限重試。
- 交付狀態要講清楚：MD/DOCX 已產出，但 DOCX 沒有完成視覺 render 驗證，這是使用者明確要求「不用檢查了，到這裡就好」後的狀態。
## 備註

- 本次使用 second brain 作為線索，但最終結論以 repo source 與使用者提供的 SP SQL 為證據。
- 給 SA 的一句話：Claude 對 decltype='T' 移倉 / BACK / BALANCE 造成庫存虛高的根因方向可信，但修法必須先分類 BACK 語義，不能直接全域反號。

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 產出。*
