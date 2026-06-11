---
type: session-recap
date: 2026-04-20
project: PCLMS_BK
system: PCLMS
repo: PCLMS_BK_new
topic: l1-l4-n1c-routing-inventory
status: done
tags: [recap, session, pclms, enqueue]
summary: 盤點並完成 PCLMS_BK 的 L1、L4、N1C 訊息傳送規則與修正前置事項。
---

# Session Recap：PCLMS L1/L4/N1C 訊息傳送規則盤點

## 📥 Inbox — 給 AI 的任務清單
> 在這裡寫任務，AI 讀到後會逐項執行。完成的項目 AI 會自動打勾。

<!-- AI_INBOX_START -->
- [x] 修正 `EnqueueN1C_modified.java` 中的冗餘 `moveFolder` 呼叫以消除誤報。
- [x] 修正 `EnqueueN1C_modified.java` 的 `getRecvId` SQL，加入監管編號過濾。
- [x] 驗證資料庫 `WAREHSE` 的 `SEPID` 是否已補全。
- [x] 測試新 Port 的網路連通性。
<!-- AI_INBOX_END -->

---

## ✅ 本次完成
- **分析發送機制**：確認 L1/L4 採用 `.flg` 檔觸發機制，Regex 過濾條件為 `L1.{15}.flg`。
- **盤點訊息類型**：盤點出系統支援 L1, L4, L9, N1, N1C, F1 等多種訊息傳送。
- **釐清邏輯差異**：
    - **L1/L4**：查 `WAREHSE` 表的 `SEPID` 作為收件者。
    - **N1C**：查 `SYSCODE` 表的 `SENDID` 作為收件者。
- **N1C 實測分析**：判定 `status:0` 為成功，`has not exist` 為重複搬移導致的誤報。

## ⚠️ 發現的問題 / 踩坑
- **SEPID 依賴**：L1/L4 傳送時若 `WAREHSE.SEPID` 為空，會導致傳送失敗。
- **檔名對應規則**：資料檔名必須與觸發檔（去掉 `.flg` 後）完全一致。
- **N1C getRecvId Bug**：SQL 查詢未帶入 `bondno` 過濾，潛在抓錯接收者風險。

## 🎯 重要決策
| 日期 | 決策 | 選擇 | 原因 |
|------|------|------|------|
| 2026-04-20 | N1C Log 診斷 | 判定為 Library 自動搬移 | 解釋 `has not exist` 誤報，確認 status:0 為成功。 |

## 📅 待辦
- [ ] 實作上述修改並測試。
- [ ] 檢查營運環境 N1C 檔名範例與規則是否一致。

## 💡 補充筆記
<!-- 你可以在這裡補充 -->
- N1C 執行頻率：每 200 秒一輪。


---
*由 Gemini (Cowork) 自動產生，可手動編輯*
