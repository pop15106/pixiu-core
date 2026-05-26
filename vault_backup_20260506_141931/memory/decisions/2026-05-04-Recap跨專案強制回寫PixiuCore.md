---
type: decision
date: 2026-05-04
status: accepted
tags: [decision, pixiucore, recap]
---

# Recap 跨專案強制回寫 PixiuCore

## 決策

只要使用者下達 `recap` 或等價請求，不論目前工作目錄、repo、專案類型或 vault 是否屬於當前專案，都必須直接回寫 `%PIXIU_CORE%\vault`。

## 原因

- 使用者明確要求 recap 不受專案範圍限制。
- 避免 AI 在 `pepis_ap`、PCLMS 或其他專案中只輸出文字 recap，卻沒有寫入 Obsidian/PixiuCore vault。
- 讓下一個 session 能從 PixiuCore 記憶接續，不需要重新交代脈絡。

## 實作內容

- 已更新 `%PIXIU_CORE%\skills\pixiu-session-recap\SKILL.md`。
- 已更新 `%PIXIU_CORE%\user_rules.md`。
- 強化規則：若遇到權限不足，不能跳過回寫，必須立即請求升權或明確回報阻塞。

## 影響

- 任一專案中的 `recap` 都會產生 `vault/memory/recaps/` 檔案。
- 重要決策需同步 `vault/memory/memory-summary.md` 與 `vault/memory/decisions/`。
- 這是 PixiuCore 母體治理規則，不綁定單一 repo。

