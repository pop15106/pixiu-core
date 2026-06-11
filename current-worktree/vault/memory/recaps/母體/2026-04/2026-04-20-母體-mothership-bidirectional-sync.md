---
type: session-recap
date: 2026-04-20
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: mothership-bidirectional-sync
status: done
tags: [recap, session, pixiucore, sync]
summary: 完成母體雙向同步與 Obsidian 工作台建立，記錄保留的重複副本版本。
---

# Session Recap：母體雙向同步 + Obsidian 工作台建立

> **日期**：2026-04-20
> **專案**：PixiuCore 母體維護
> **AI**：Claude Code via Cowork

---

## ✅ 本次完成

- 全面深度比較 `%PIXIU_CORE%` 與 `<workspace-root>\pixiu-core` 的差異
- 執行雙向同步：兩邊內容對齊（除 Backup fleet 歷史快照外）
- PixiuCore → gravityTest 補入：`vault/`、5 個 Pixiu 核心 skills、`commands/go.md`、`hooks.json`（guardrails 安全閘門）、`CODEX.md`（含 Vault Init）、`scripts/setup/`
- gravityTest → PixiuCore 補入：`docs/`、`SKILLS_INDEX.md`、`scripts/scripts/`（部署工具）、完整 `.agent/` 子系統、`Tools/`、完整版 `README.md`
- 更新 `README.md`（672 → 738 行）：新增 Vault 記憶庫章節、5 個 Pixiu 核心 skills、`/go` 驗證迴圈說明、更新目錄結構圖與版本表
- 建立 Obsidian 工作台（Dashboard、templates、recap 目錄結構）
- 測試 vault 機制，確認 `/recap` 觸發方式

## 🔄 進行中

- gravityTest git push（需在 Windows 本機執行）

## ⚠️ 發現的問題 / 踩坑

- `cp -r` 在目標目錄已存在時會產生雙層巢狀路徑（`skills/skills/`），PixiuCore 的 Windows 磁碟不允許刪除，已用 `cp -rn` 方式補完 gravityTest 正確路徑
- `/recap` 斜線指令被 Claude Code 過濾為 unknown command，正確觸發方式是純文字「現在到哪了？」

## 🎯 重要決策

| 決策 | 選擇 | 原因 |
|------|------|------|
| 同步基底 | 以 gravityTest 為 git 版本（有 .git 歷史） | 有版本控制較安全 |
| Backup fleet_sync | 不互相覆蓋 | 兩邊 fleet 歷史不同，屬「註冊檔」 |
| Vault 分享策略 | vault/ 加入 git 但個人資料由使用者自行決定是否公開 | 彈性最大 |
| Obsidian 整合 | 用獨立 recap 檔取代追加模式 | Dataview + 圖譜更好用 |

## 📌 下次 session 要做的事

- [ ] 執行 `git add . && git commit && git push`（在 Windows 本機）
- [ ] 在 Obsidian 安裝 Dataview 與 Templater 插件
- [ ] 以 `%PIXIU_CORE%` 為根目錄開啟 Obsidian vault
- [ ] 測試 Dashboard 的 Dataview 查詢是否正確顯示

## 💡 補充筆記

<!-- 你可以在這裡補充 -->

---

*由 Claude Code (Cowork) 自動產生 · 可手動編輯*
