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
- 輸出：結構化格式 + 寫入 `vault/memory/recap-<sessionId>-phase<N>.md`
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

## Memory 寫入規範

### 檔案命名
```
vault/memory/recap-<YYYYMMDD>-<sessionId>-phase<N>.md
```

### 檔案內容
```markdown
---
session: <sessionId>
phase: <N>
timestamp: <ISO>
task: <一句話>
status: [completed | paused | blocked]
---

# Recap 內容（上述 6 區塊）

## 下次 session 接續建議
[給未來自己看的提示]
```

### Index 維護
每次寫入後更新 `vault/memory/recap-index.md`：
- 按時間倒序
- 每筆一行：`[時間] [status] [task 一句話]`
- 舊紀錄 30 天後自動歸檔到 `vault/memory/archive/`（由排程觸發，非即時）

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
- v0.1.0｜2026-04-17
- 來源：Claude Code 2.1.108 `/recap` 功能、Pixiu `continuous-learning` skill、vault/memory 結構。
