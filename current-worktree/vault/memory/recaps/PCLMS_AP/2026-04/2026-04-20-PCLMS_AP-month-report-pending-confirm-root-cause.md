---
type: session-recap
date: 2026-04-20
project: PCLMS_AP
system: PCLMS
repo: PCLMS_AP
topic: month-report-pending-confirm-root-cause
status: follow-up
tags: [recap, session, pclms, bug, data-fix]
summary: 釐清 PCLMS_AP 彙報出倉待確認的資料根因，聚焦原進倉欄位缺漏與確認流程依賴。
---

# Session Recap：PCLMS_AP 彙報出倉待確認原因釐清

## ✅ 本次完成

1. 已讀取母體最新 recap，接續「已申報彙報單無資料 Bug」脈絡。
2. 釐清 `RlsCatMonthitem` 查詢邏輯：依 `strtype` 決定查 `indetail` 或 `outdetail`，核心條件是 `bondno + monthno`。
3. 對照使用者截圖，確認該畫面若顯示「出倉日期」，代表走 `outdetail` 查詢。
4. 重新釐清業務情境：要被彙報出倉的報單目前仍在待確認，不是單純「已出倉明細查不到」。

## 🔄 進行中

- 目前步驟：資料面原因判斷與修復方案收斂。
- 進度：已完成查詢邏輯與涉入表初步盤點。
- 新判斷：待確認原因是該出倉報單沒有填「原進倉報單 / 原進倉報單項次」，因此無法完成確認。

## ⚠️ 發現的問題 / 踩坑

- `RlsCatMonthitem` 只靠 `monthno` 查明細；URL 的 `declno` 主要用於畫面條件顯示與回復按鈕傳參，並不是明細查詢 WHERE 條件。
- 若報單尚未確認，重點不應先補 `monthno`，而應先確認 `outdetail.odeclno`、`outdetail.oitemno`、`outdetail.outpost` 是否能對到來源 `indetail.declno`、`indetail.itemno`、`indetail.inpost`。
- 出倉確認與保證金核銷流程會依原進倉欄位回查來源資料；缺漏會導致確認失敗或後續核銷異常。

## 🎯 重要決策

| 日期         | 決策               | 選擇                              | 原因                          |
| ---------- | ---------------- | ------------------------------- | --------------------------- |
| 2026-04-20 | PCLMS 彙報出倉資料修復方向 | 先查/補出倉報單的原進倉報單與項次，不先補 `monthno` | 使用者確認該報單仍待確認，失敗原因是未填原進倉報單項次 |

## 📌 下次 session 要做的事

- [ ] 取得待確認出倉報單號、監管編號、項次、料號、儲位。
- [ ] 查 `outdetail` 該報單的 `odeclno/oitemno/outpost/outunit/routqty/monthno`。
- [ ] 查來源 `indetail` 是否存在可對應的 `declno/itemno/inpost/inunit/balance`。
- [ ] 若來源唯一且業務確認，再規劃最小資料修復 SQL；若來源不唯一，先回業務確認來源項次。

## 💡 補充筆記

關聯程式：
- `RlsCatMonthitem.java`：已申報彙報單明細查詢，依 `strtype` 查 `indetail` 或 `outdetail`。
- `listCatMonthSave.java`：彙報報單確認時，會更新 `month`、`declar`，並依 `monthno` 更新明細的報單號與項次。
- 出倉確認相關流程會依 `outdetail.odeclno/oitemno/outpost` 回查來源進倉資料。
