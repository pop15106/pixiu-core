---
name: pixiu-session-recap
description: Pixiu 版 Session Recap。整合 Claude Code 2.1.108+ 的 /recap 功能，在階段（Phase）結束、session 恢復、長任務回來時自動產出結構化摘要並寫入 vault/memory，供下次 session 或 Codex 稽核使用。觸發詞：recap、摘要、現在到哪了、剛剛做了什麼、下一步是什麼、階段收尾。
origin: Pixiu
version: 0.1.0
layer_binding: L3-流程 / L5-經驗 / L6-校準
language: zh-TW
---

# Pixiu Session Recap

> 對應 Claude Code 2.1.108 的 `/recap` 功能。
> 目的：把「人類記憶斷點」這件事交給工具，讓長 session 回來就能無痛接續。

---

## 觸發條件

任一成立即啟動：
- 使用者輸入「recap」、「摘要」、「現在到哪了」、「剛剛做了什麼」、「下一步」、「進度」
- 單一 Phase（依 Pixiu「分階段任務審核門檻」）完成
- Session 閒置 > 15 分鐘後恢復
- 使用者切換上下文（新開話題）
- 被 `pixiu-verify-loop` 步驟 3 完成後呼叫作為收尾

---

## Recap 結構（必輸出格式）

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Session Recap｜[ISO 時間]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 當前任務
  [一句話描述目標]

✅ 已完成
  1. [動作 + 結果]
  2. [動作 + 結果]
  3. ...

🔄 進行中
  - 目前步驟：[名稱]
  - 進度：[X / Y 完成]
  - 卡點（如有）：[描述 + 信心]

📌 下一步
  1. [優先執行]
  2. [可並行]

⚠️ 遺留風險 / 待審批
  - [等使用者決定的事項]

💾 關鍵狀態
  - 分支：[branch]
  - 改動檔案數：[N]
  - Token 消耗：[預估，含 +35% 補償]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 三種模式

### 模式 A｜Quick Recap（預設）
- 觸發：使用者主動輸入關鍵字
- 耗時：< 1 分鐘
- 輸出：上述結構化格式
- 不寫檔

### 模式 B｜Phase Recap
- 觸發：Phase 完成（依「分階段任務審核門檻」）
- 耗時：2–3 分鐘
- 輸出：結構化格式 + 寫入 Obsidian 相容的獨立檔案（見下方 Obsidian 整合）
- 同步觸發 `pixiu-verify-loop`（若尚未跑過）

### 模式 C｜Session Resume Recap
- 觸發：Session 恢復、跨 session 接續
- 耗時：1–2 分鐘
- 輸出：讀取最近 3 個 phase recap → 合併成「回來報告」
- 包含「建議你從哪一步繼續」

---

## 與 Claude Code 原生 `/recap` 的關係

| 項目 | 原生 `/recap` | Pixiu Recap |
|------|-------------|------------|
| 觸發 | 手動 | 關鍵字 + 自動 |
| 輸出 | 對話摘要 | 結構化 6 區塊 |
| 寫檔 | 無 | `vault/memory/recap-*.md` |
| 綁 Pixiu 七層 | 否 | 是（L3 + L5 + L6） |
| 語言 | 英 | 繁中 |

**Pixiu Recap 呼叫原生 `/recap` 作為資料來源**，在其上加結構化、審計、跨 session 合併能力。

---

## Memory 寫入規範（Obsidian 相容格式）

### 檔案命名（Obsidian 友善）
```
vault/memory/recaps/YYYY-MM-DD-主題關鍵字.md
```

範例：`2026-04-20-PCLMS-executeUpdate修復.md`

### 檔案內容（Obsidian Frontmatter 格式）
```markdown
---
type: session-recap
日期: YYYY-MM-DD
主題: "一句話描述"
狀態: 進行中 | 完成 | 暫停
負責AI: Claude Code
專案: "專案名稱"
tags: [recap, session]
---

# Session Recap：主題

## ✅ 本次完成
## 🔄 進行中
## ⚠️ 發現的問題 / 踩坑
## 🎯 重要決策（表格）
## 📌 下次 session 要做的事（checklist）
## 💡 補充筆記
```

> ⚠️ **重要**：使用 Obsidian Frontmatter（`---` 包圍的 YAML），讓 Dataview 可以查詢。
> 模板位於 `vault/templates/session-recap.md`，寫入時照此格式產生。

### 決策獨立記錄
重要決策同時建立 `vault/memory/decisions/YYYY-MM-DD-決策名稱.md`，模板見 `vault/templates/decision-log.md`。

### memory-summary.md 同步
每次寫入 recap 後，在 `vault/memory/memory-summary.md` 的「最近重要決策」表格追加一行，並更新「進行中的工作」區塊。

### Dashboard 自動顯示
Recap 寫入後，`vault/🏠 Dashboard.md` 的 Dataview 查詢會自動抓到新檔案，無需手動更新。

---

## 與其他 Skill 的互動

- **`pixiu-verify-loop` 完成 → 自動呼叫本 Skill 的模式 B**，把驗證結果併入 Recap
- **`continuous-learning` / `continuous-learning-v2` → 讀取 recap-index** 作為長期記憶來源
- **Codex 審計 → 從 vault/memory/recap-*.md** 抽樣檢視 session 品質

---

## 與 Pixiu 憲法銜接

- **L3 分階段任務審核門檻**：Phase 完成自動跑 Recap，幫使用者審閱不漏掉狀態
- **L5 經驗層**：Recap 累積成長期記憶
- **L6 校準層**：Recap 提供 Codex 評量的原始數據
- **可見推理一律中文**：所有輸出繁中

---

## 自我查核
- [ ] 輸出是否包含 6 個區塊？
- [ ] Phase Recap 是否寫入 `vault/memory/`？
- [ ] recap-index.md 是否同步更新？
- [ ] Token 預估是否套了 +35% 補償？

---

## 版本與來源
- v0.2.0｜2026-04-20｜新增 Obsidian 相容格式、獨立 recap 檔、Dataview frontmatter
- v0.1.0｜2026-04-17｜初版
