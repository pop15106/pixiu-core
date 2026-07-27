---
type: vault-init
alwaysApply: true
readAt: session-start
priority: highest
---

# Pixiu Vault — AI 知識庫初始化

> 本 vault 由 Pixiu Mothership Core 統一管理。
> 所有接線至母體的 AI（Claude、Gemini、Codex）均須在 session 開始時依序讀取。

## Init 讀取序列（每次 Session）

```
1. vault/bootstrap/SESSION-BOOTSTRAP.md              ← 常駐硬閘門與降級規則
2. vault/capabilities/capability-manifest.json       ← 依本次需求選最多 3 個能力
3. Manifest 命中的 Skill／Context／Governance       ← 按需讀取
```

以下內容不再每次 Session 自動全文載入：

- `identity/founder-profile.md`、`identity/agent-persona.md`：需要個人化或角色校準時讀取。
- `memory/memory-summary.md`、recap、decisions：先讀 `memory/SESSION-INDEX.md`，命中舊決策或接續工作時再讀原文。
- `governance/INDEX.md` 與制度本體：命中派工、驗收、入口檔、維護或判斷問題時讀取。
- `context/pclms-overview.md`、`context/tech-stack.md`：涉及對應專案或技術決策時讀取。

## Vault 資料夾用途

| 資料夾 | 用途 | 更新頻率 |
|--------|------|---------|
| `identity/` | 使用者檔案、AI 角色設定 | 低（原則性變更才更新）|
| `memory/` | 決策紀錄、跨 session 記憶快照（`memory/hook-state/` 為機器狀態，任何搜尋與索引一律排除） | 高（每次重要決策後）|
| `governance/` | 制度本體：路由、派工、判準、模板、維護協議 | 低（制度變更才更新）|
| `context/` | 專案背景、系統說明 | 中（架構變更時更新）|
| `sop/` | 標準作業流程 | 低（流程確立後穩定）|
| `after-action/` | 事後回顧、踩坑紀錄 | 事件驅動 |

## 適用範圍

本 vault 為**跨專案、跨 AI 工具**的共用知識庫。
無論當前工作目錄為何，均適用。

## 維護責任

- 使用者：填寫 `identity/` 待補欄位、更新 `memory/memory-summary.md`
- AI：每次 session 結束前，若有重要決策，提醒使用者更新 memory
