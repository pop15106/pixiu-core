---
type: memory
readAt: session-init
lastUpdated: 2026-04-20
tags: [memory, pixiucore]
---

# Memory Summary — 最新記憶快照

> 此檔案是跨 session、跨 AI 的共用記憶。
> 每次重要決策或架構變更後請更新。
> AI 每次 session 必讀，確保不需要重新交代背景。
> 詳細 recap 見 [[🏠 Dashboard]] 或 `vault/memory/recaps/` 目錄。

---

## 目前狀態（2026-04-20）

### 進行中的工作

- **PixiuCore 母體維護**：雙向同步完成，gravityTest 待 git push → [[2026-04-20-母體雙向同步]]
- **PCLMS_AP — 已申報彙報單無資料 Bug**（進行中，待實作修改）
  - 根本原因：`CatMonthSave.java:262` — `executeUpdate` 更新 0 筆靜默不拋例外，`itemcount` 仍遞增，導致資料不一致
  - 下一步：在 `executeUpdate` 後驗證回傳值，0 筆時 `itemcount--` 觸發 rollback

### 最近重要決策

| 日期 | 決策 | 選擇 | 原因 |
|------|------|------|------|
| 2026-04-20 | 母體同步策略 | gravityTest 為 git 版本基底 | 有版本歷史較安全 |
| 2026-04-20 | Obsidian 整合方式 | 獨立 recap 檔 + Dataview Dashboard | 比追加更好搜尋與視覺化 |
| 2026-04-20 | PCLMS bug 修法 | 驗證 executeUpdate 回傳值 + rollback | 不改 schema，最小侵入 |
| 2026-04-16 | Vault 架構 | 在 PixiuCore 建 vault/ | 全域共用、不綁定特定專案 |

### 已確認的技術約束

- PCLMS DB schema 不可大改
- Java 版本維持現有（非 Java 8 以上需確認）
- 分支策略：`feature/*` → `r_sit` → `r_uat` → `master`

### 踩坑紀錄

| 日期 | 坑 | 解法 |
|------|-----|------|
| 2026-04-20 | `/recap` 斜線指令被 Claude Code 過濾 | 用純文字「現在到哪了？」觸發 |
| 2026-04-20 | `cp -r` 在已存在目錄產生雙層路徑 | 改用 `cp -rn src/. dst/` |

---

## 更新指引

每次 session 結束前，若有以下情況請更新：
- 做了架構級決策 → 同時建立 `vault/memory/decisions/` 獨立檔案
- 發現新的技術約束
- 解決了重要 bug 或踩了新坑
- 待辦事項有重大變更

**詳細 recap 請存為獨立檔案**：`vault/memory/recaps/YYYY-MM-DD-主題.md`（用 Templater 模板）
