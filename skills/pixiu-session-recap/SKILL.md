---
name: pixiu-session-recap
description: Pixiu 版 Session Recap。整合 Claude Code 2.1.108+ 的 /recap 功能；當使用者輸入 recap/摘要/現在到哪了/下一步，或階段結束、session 恢復時，必須產出結構化摘要並立即把當前 recap 內容寫入 vault/memory/recaps，供下次 session 或 Codex 稽核使用。
origin: Pixiu
version: 0.3.2
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

## 硬性寫入規則

- **跨專案強制適用**：只要使用者下達 `recap` 或等效觸發詞，無論目前工作目錄、專案類型、repo 是否屬於 Pixiu/PCLMS、是否存在專案內 vault，都必須把 recap 回寫到 `%PIXIU_CORE%\vault\memory\recaps\`。不得因「當前專案不是 PixiuCore」、「目前在其他 repo」、「使用者只說 recap 沒說寫入」而降級成只輸出文字。
- 使用者主動輸入 `recap`、`摘要`、`現在到哪了`、`剛剛做了什麼`、`下一步`、`進度` 時，產出的當前 recap 內容必須立即寫入 `vault/memory/recaps/`。
- 不得把使用者主動觸發的 recap 視為「只輸出、不寫檔」的 Quick Recap。
- 若目前工具環境無法直接寫入 `%PIXIU_CORE%`，必須立刻請求必要授權/升權；只有在授權被拒或工具失敗時，才可明確回報「尚未寫入」。
- 寫入檔案內容必須以本次對話產出的當前 recap 為準，不另行縮減成短摘要。

---

## Recap 結構（必輸出格式）

> **原則：寧可詳細，不可精簡。** 使用者和下一個 session 的 AI 都需要看懂這份 recap，不要為了簡潔而省略規劃細節、架構說明或決策脈絡。

```text
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Session Recap｜[ISO 時間]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 當前任務總覽
  目標：[完整描述這個 session 要達成什麼，不只一句話]
  背景：[為什麼要做這件事，來自哪個需求或問題]
  範圍：[影響哪些專案 / 模組 / 檔案]

✅ 已完成事項
  1. [動作] → [結果 + 驗證方式]
  2. [動作] → [結果 + 驗證方式]
  （每項說明做了什麼、結果如何，不要只寫動作名稱）

🔄 進行中
  - 目前步驟：[名稱 + 說明這步驟在做什麼]
  - 整體進度：[X / Y Phase 完成]
  - 各 Phase 狀態：
      Phase 1 [名稱]：[✅完成 / 🔄進行中 / ⏳待開始]
      Phase 2 [名稱]：[✅完成 / 🔄進行中 / ⏳待開始]
      Phase 3 [名稱]：[✅完成 / 🔄進行中 / ⏳待開始]
  - 卡點（如有）：[描述問題 + 目前的信心程度]

📐 當前規劃內容（完整保留，供下次接續）
  [把這個 session 中設計的架構、流程、方案詳細寫出來]
  [包含：資料夾結構、指令格式、設定檔範例、關鍵邏輯]
  [這個區塊不能省略，是跨 session 接續的核心依據]

  範例格式（視任務類型調整）：
  架構設計：
    [詳細說明]
  關鍵設定：
    [程式碼或 YAML 片段]
  流程步驟：
    1. [步驟 + 說明]
    2. [步驟 + 說明]

🎯 重要決策記錄
  | 決策點 | 選擇 | 棄選方案 | 原因 |
  |--------|------|---------|------|
  | [決策] | [選擇] | [棄選] | [為什麼] |
  （棄選方案也要記，避免下次重複踩坑）

📌 下次 session 要做的事
  優先執行：
  - [ ] [具體動作，包含指令或檔案路徑]
  - [ ] [具體動作]

  可並行：
  - [ ] [可同時進行的項目]

  待確認（需使用者決策）：
  - [ ] [等使用者拍板的事項 + 背景說明]

⚠️ 踩坑 / 遺留風險
  - [問題描述] → [目前處理狀態或建議]
  - [尚未解決的疑點] → [建議下次優先確認]

💾 關鍵狀態
  - 專案：[專案名稱]
  - 分支：[branch]
  - 改動檔案：[列出主要檔案]
  - 尚未 commit 的變更：[有 / 無，若有列出]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 三種模式

### 模式 A｜User-triggered Recap（預設）

- 觸發：使用者主動輸入關鍵字
- 耗時：< 1 分鐘
- 輸出：上述結構化格式
- 必須立即寫入 Obsidian 相容的獨立檔案（見下方 Memory 寫入規範）

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

```text
vault/memory/recaps/YYYY-MM-DD-HHMMSS-主題關鍵字.md
```

範例：`2026-04-20-143022-PCLMS-executeUpdate修復.md`

> 時分秒（HHMMSS）為本地時間，避免同一天多個 recap 撞名。

### 檔案內容（Obsidian Frontmatter 格式）

> **寫檔原則：比對話輸出更詳細。** vault 是長期知識庫，使用者事後查閱時需要看到完整脈絡，不要因為「已經說過了」就省略。

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

## 🎯 任務目標與背景

[完整說明這個任務的目標、背景脈絡、為什麼要做、影響範圍]

## ✅ 本次完成

[每項說明動作 + 結果 + 驗證，不只列標題]

## 🔄 進行中

[目前步驟說明 + 各 Phase 狀態]

## 📐 當前規劃完整內容

[架構設計、資料夾結構、設定範例、流程步驟 — 完整保留，不精簡]
[這是下次 session 接續的核心依據]

## 🎯 重要決策（含棄選方案）

| 決策點 | 選擇 | 棄選方案 | 原因 |
|--------|------|---------|------|

## ⚠️ 發現的問題 / 踩坑

[問題描述 + 目前狀態 + 建議]

## 📌 下次 session 要做的事

- [ ] [具體動作，含指令或路徑]
- [ ] [待使用者決策的事項 + 背景]

## 💡 補充筆記

[任何值得記錄但不屬於上面分類的內容]
```

> ⚠️ **重要**：使用 Obsidian Frontmatter（`---` 包圍的 YAML），讓 Dataview 可以查詢。
> 模板位於 `vault/templates/session-recap.md`，寫入時照此格式產生。

### 決策獨立記錄

重要決策同時建立 `vault/memory/decisions/YYYY-MM-DD-決策名稱.md`，模板見 `vault/templates/decision-log.md`。

### memory-summary.md 同步

每次寫入 recap 後，在 `vault/memory/memory-summary.md` 更新「進行中的工作」區塊；若本次 recap 含重要決策，才在「最近重要決策」表格追加一行。

### 月份封存（每月 1 日觸發）

當月份切換時（例如 5/1 首次 session），執行以下封存流程：

1. 在 `vault/memory/recaps/` 建立上個月的子資料夾，格式：`YYYY-MM/`（例如 `2026-04/`）
2. 將上個月所有 recap 檔案移入該子資料夾
3. 在 Dashboard 的封存 callout 區塊更新月份範圍（日期篩選條件 +1 個月）
4. 在 Dashboard 新增下個月的封存 callout 區塊（預留給下次封存用）

封存後的結構：

```text
vault/memory/recaps/
├── 2026-04/          ← 封存，callout 摺疊顯示
│   ├── 2026-04-20-...md
│   └── 2026-04-21-...md
└── （本月新 recap 放這層）
```

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

- [ ] 輸出是否包含全部區塊（任務總覽、已完成、進行中、規劃內容、決策、下一步、風險）？
- [ ] **「當前規劃內容」區塊是否完整？**（架構設計、流程、設定範例都有嗎？）
- [ ] **決策表是否列出棄選方案？**（只記選擇不夠，棄選原因同樣重要）
- [ ] **下次要做的事是否具體到可直接執行？**（含指令、路徑、待確認事項）
- [ ] Phase Recap 是否寫入 `vault/memory/recaps/YYYY-MM-DD-HHMMSS-主題.md`？
- [ ] memory-summary.md 是否同步更新「進行中的工作」區塊？
- [ ] 有沒有因為「已說過」就省略重要規劃細節？（不能省）

---

## 版本與來源

- v0.3.1｜2026-04-21｜修正 markdown lint 警告（空行、code block 語言標注）
- v0.3.0｜2026-04-21｜輸出格式加入「當前規劃內容」完整區塊、決策含棄選方案、月份封存機制
- v0.2.0｜2026-04-20｜新增 Obsidian 相容格式、獨立 recap 檔、Dataview frontmatter
- v0.1.0｜2026-04-17｜初版


