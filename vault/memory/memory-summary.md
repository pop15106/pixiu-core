---
type: memory
readAt: session-init
lastUpdated: 2026-04-16
---

# Memory Summary — 最新記憶快照

> 此檔案是跨 session、跨 AI 的共用記憶。
> 每次重要決策或架構變更後請更新。
> AI 每次 session 必讀，確保不需要重新交代背景。

## 目前狀態（2026-04-16）

### 進行中的工作
- 建立 Pixiu Vault：三 AI 共用知識庫（本次完成）
- PCLMS 系統維護：多個服務層修改（CalBalance、GoodsBalance、Grnt、OutNMonths）

### 最近重要決策
| 日期 | 決策 | 選擇 | 原因 |
|------|------|------|------|
| 2026-04-16 | 知識庫架構 | 在 PixiuCore 建 vault/ | 全域共用、不綁定特定專案 |

### 已確認的技術約束
- PCLMS DB schema 不可大改
- Java 版本維持現有（非 Java 8 以上需確認）
- 分支策略：feature/* → r_sit → r_uat → master

### 踩坑紀錄
_（首次建立，尚無紀錄）_

---

## 更新指引

每次 session 結束前，若有以下情況請更新此檔案：
- 做了架構級決策
- 發現新的技術約束
- 解決了重要 bug 或踩了新坑
- 待辦事項有重大變更

**更新格式**：在對應區塊追加，保留歷史紀錄，最新在最上方。
