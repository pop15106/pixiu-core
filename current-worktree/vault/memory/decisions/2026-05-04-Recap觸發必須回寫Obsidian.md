---
type: decision
date: 2026-05-04
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: Recap觸發必須回寫Obsidian
status: accepted
decision: Recap 觸發必須回寫 Obsidian
choice: 使用者主動輸入 recap/摘要/現在到哪了/下一步/進度 時，當前 recap 必須立即寫入 vault/memory/recaps
alternative: Quick Recap 只輸出、不寫檔
reason: 避免長任務的關鍵狀態只留在對話中，確保下次 session 與 Obsidian Dashboard 可接續
summary: Recap 觸發必須回寫 Obsidian：使用者主動輸入 recap/摘要/現在到哪了/下一步/進度 時，當前 recap 必須立即寫入 vault/memory/recaps
tags: [decision, recap, pixiucore]
---

# 決策：Recap 觸發必須回寫 Obsidian

## 背景

使用者詢問先前 recap 是否已回寫 Obsidian，確認沒有後，要求修改 pixiu-session-recap 技能：不要再設定 Quick Recap 不寫檔；當使用者下 recap 時，就要把當前 recap 的內容回寫。

## 選擇

將 `pixiu-session-recap` 的模式 A 改為 `User-triggered Recap`，並新增硬性寫入規則：使用者主動輸入 `recap`、`摘要`、`現在到哪了`、`剛剛做了什麼`、`下一步`、`進度` 時，產出的當前 recap 內容必須立即寫入 `vault/memory/recaps/`。

## 棄選方案

維持原 Quick Recap 只輸出、不寫檔。

## 原因

Recap 的核心價值是跨 session 接續。若只輸出在對話中，Obsidian / Dashboard / memory-summary 無法承接，會造成記憶斷點。此變更符合 Pixiu 母體「長期記憶」與 L6 校準需求。