---
name: pixiu-session-recap
description: Pixiu 版 Session Recap。整合 Claude Code 2.1.108+ 的 /recap 功能；當使用者輸入 recap/摘要/現在到哪了/下一步，或階段結束、session 恢復時，必須產出結構化摘要並立即把當前 recap 內容寫入 vault/memory/recaps，供下次 session 或 Codex 稽核使用。
origin: Pixiu
version: 0.4.0
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

## 專案範圍進度查詢

Recap 集中存放在 PixiuCore Vault，不代表查詢時可以混用不同專案。回答「進度／現在到哪／下一步」前，必須先解析唯一專案 context。

### 已在專案 workspace 內

- 目前 canonical workspace project 是未指定專案時的唯一查詢範圍。
- 只讀取該專案 key／root 對應的 recap、handoff、current-progress、machine state 與 execution-affine workflow。
- 不得因其他專案 recap 更新較新、全域 memory-summary 排在前面、或跨專案 task 可見，就改報其他專案進度。
- 使用者明確問「Project A 進度」時，可以唯讀查 A；但若目前 execution binding 是 Project B，這次查詢不會把後續未指定專案的「繼續完整自動接力」切到 A。

### 不在專案 workspace 內

- 使用者必須在本次訊息明確提供專案名稱、alias 或路徑。
- 先用 `project_resolve` 取得唯一 canonical root／project key，再查該專案。
- 沒有明確專案時回 `PROJECT_CONTEXT_REQUIRED`；多個候選時回 `PROJECT_CONTEXT_AMBIGUOUS`。
- 禁止以最近 recap、最近 task、最近 Git commit 或最近監控事件猜測。

### Vault 檢索規則

```text
resolved project key/root
→ filter recap frontmatter project/system/repo
→ filter vault/memory/recaps/<專案>/...
→ merge only the resolved project records
```

「跨專案集中保存」與「跨專案混合檢索」必須分離。Status Pulse、Recovery Supervisor、reviewer-watch、governance task 也不得被一般進度查詢當成產品專案進度。

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
- **正式執行入口固定為 `scripts/hooks/pixiu-manual-recap.js`**：整理完本次 recap 內容後，必須把 `relative_path` 與完整 `content` 交給該 helper 寫入；不得改成只在對話中輸出 recap。
- `scripts/hooks/pixiu-manual-recap.js` 是唯一正式寫入鏈：先在零寫入狀態完成 recap schema、敏感資訊、summary 相容性與 observation metadata 預檢，再寫 recap 原件、同步 `vault/memory/memory-summary.md`，最後才呼叫 `scripts/hooks/pixiu-deterministic-capture.js` 產生 0-3 筆 observation；若任一步失敗，整條鏈 fail closed，不得留下錯誤 observation。
- 正式 manual recap 原件不可靜默覆蓋：同路徑同內容視為冪等重跑；同路徑不同內容必須改用更精準的非時間短識別詞後重送。CLI 錯誤不得回顯 raw stdin、本機絕對路徑或內部檔名。
- Phase 2 capture 只接受 strict `type: session-recap` + `recap_mode: manual` 與 canonical 專案／月份／檔名；`source_paths` 必填且不得為空，每個項目都必須是 PixiuCore 內既存且可讀的相對路徑，缺失或任一不合法就整批在 durable write 前拒絕。

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
| 寫檔 | 無 | `vault/memory/recaps/<專案或母體>/<YYYY-MM>/YYYY-MM-DD-專案-內容.md` |
| 綁 Pixiu 七層 | 否 | 是（L3 + L5 + L6） |
| 語言 | 英 | 繁中 |

**Pixiu Recap 呼叫原生 `/recap` 作為資料來源**，在其上加結構化、審計、跨 session 合併能力。

---

## Memory 寫入規範（Obsidian 相容格式）

### 檔案命名（Obsidian 友善）

```text
vault/memory/recaps/<專案或母體>/<YYYY-MM>/YYYY-MM-DD-專案-內容.md
```

範例：

- `vault/memory/recaps/PCLMS/2026-06/2026-06-08-PCLMS-庫存核銷交易邊界.md`
- `vault/memory/recaps/母體/2026-06/2026-06-08-母體-recap檔名規則修正.md`

> 檔名只保留日期，不加入時間戳。若同日同專案有多份 recap，優先讓 `內容` 更精準；仍撞名時加非時間性的短識別詞。
> recap 必須依專案與月份落位；專案資料夾使用檔名前綴，月份資料夾使用 frontmatter `date` 的 `YYYY-MM`。

### 檔名前綴規則

- 與特定專案、系統或 repo 有關時，檔名前綴必須使用專案 key，例如 `PCLMS`、`PCLMS_AP`、`PCLMS_BK`、`PEPIS`、`PERMS`、`PISSO`、`SECOND_BRAIN`、`AUTO_RESEARCH`、`DOCX_TOOLING`、`OPENSPEC`。
- 與特定專案無關，且內容屬於 PixiuCore 母體治理、AI 行為、skill/workflow、vault 結構、recap 規範、跨 AI 決策或操作準則時，檔名前綴必須使用 `母體`。
- `內容` 優先取自 `topic`，並移除重複的專案字樣；保持短、可掃讀、可搜尋。
- 檔名不得包含 Windows 不合法字元：`\ / : * ? " < > |`。
- 母體類 recap 的 frontmatter `project` 仍使用 canonical key `PIXIUCORE`；只有檔名前綴使用 `母體`，方便人在 Obsidian 直接辨識。

### 半自動 / 全自動並存規則

- 半自動 recap：使用者主動輸入 `recap`、`摘要`、`現在到哪了`、`下一步` 時產生，frontmatter 使用 `recap_mode: manual`，視為正式 recap。
- 全自動 recap：由 `scripts/hooks/pixiu-auto-recap.js` 在 `Stop` / `SessionEnd` hook 產生，frontmatter 使用 `recap_mode: auto`、`status: draft-auto`、`auto_trigger: stop | session-end`。
- 全自動 recap 只作為候選記憶與保險網，不覆蓋半自動正式 recap；撞名時使用非時間短識別詞，如 `auto1`。
- 第二大腦索引需保留 `recap_mode`、`auto_trigger`、`recap_project`、`recap_month`，方便查詢正式 recap 或 auto draft。

### 檔案內容（Obsidian Frontmatter 格式）

> **寫檔原則：比對話輸出更詳細。** vault 是長期知識庫，使用者事後查閱時需要看到完整脈絡，不要因為「已經說過了」就省略。

```markdown
---
type: session-recap
date: YYYY-MM-DD
project: PROJECT_KEY
system: SYSTEM_KEY
repo: repo-name
topic: kebab-case-topic
status: done | follow-up | paused | verified-local | procedure-pending
recap_mode: manual
tags: [recap, session, project-key, topic-key]
source_paths:
  - vault/context/ai-mothership-loading-policy.md
summary: 一句話摘要，說明本 recap 的核心結論或下一步。
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
> Frontmatter 必須使用目前 vault 的英文欄位：`type/date/project/system/repo/topic/status/recap_mode/tags/source_paths/summary`；`source_paths` 一律必填且不得為空，每個項目都必須是 PixiuCore 內既存、可讀的相對路徑。
> 模板位於 `vault/templates/session-recap.md`，寫入時照此格式產生。

### Obsidian Properties 對齊規則

本 skill 只是執行入口；跨 AI 的共同標準以 `vault/sop/recap-standard.md` 與 `vault/templates/session-recap.md` 為準。Claude、Gemini、Codex 都必須使用同一套 frontmatter 欄位與檔名規則。

寫入前先對照最近一份同類 recap 的 Properties。repo tracing / code investigation 類 recap 必須讓 Obsidian Properties 長得一致：

- `system` 必填，使用產品或系統 key，例如 `PCLMS`、`PTWCS`。
- `repo` 填短 repo 名，例如 `PCLMS_BK_new`、`PTWCS`；不要填完整 Windows 路徑。
- `source_paths` 一律必填且不得為空；只填 PixiuCore 內既存、可讀的相對路徑，不得填完整絕對路徑、環境變數占位符或不存在路徑。
- `summary` 必填，用一句話寫核心結論或下一步，方便 Obsidian property table 直接掃讀。
- `tags` 至少包含 `recap`、project/system key、主題 key；必要時補 repo key。
- 寫完後用 `Get-Content -First 30` 或同等方式確認 frontmatter 欄位齊全，再回覆使用者。

### 決策獨立記錄

重要決策同時建立 `vault/memory/decisions/YYYY-MM-DD-決策名稱.md`，模板見 `vault/templates/decision-log.md`。

### memory-summary.md 同步

每次寫入 recap 後，在 `vault/memory/memory-summary.md` 更新「進行中的工作」區塊；若本次 recap 含重要決策，才在「最近重要決策」表格追加一行。

### 月份封存（每月 1 日觸發）

當月份切換時（例如 5/1 首次 session），執行以下封存流程：

1. 確認所有 recap 都位於 `vault/memory/recaps/<專案或母體>/<YYYY-MM>/`
2. 若發現根目錄或舊 `vault/memory/recaps/YYYY-MM/` 月份資料夾內仍有 Markdown recap，依 frontmatter 或檔名前綴搬回對應專案/月資料夾
3. 在 Dashboard 檢查近期 recap 查詢是否仍可跨專案遞迴讀取
4. 在第二大腦重建 manifest / index 前，確認 path、`recap_project`、`recap_month` 可被匯出

封存後的結構：

```text
vault/memory/recaps/
├── PCLMS/
│   ├── 2026-05/
│   └── 2026-06/
├── PEPIS/
│   └── 2026-06/
└── 母體/
    ├── 2026-05/
    └── 2026-06/
```

### Dashboard 自動顯示

Recap 寫入後，`vault/🏠 Dashboard.md` 的 Dataview 查詢會自動抓到新檔案，無需手動更新。

---

## 與其他 Skill 的互動

- **`pixiu-verify-loop` 完成 → 自動呼叫本 Skill 的模式 B**，把驗證結果併入 Recap
- **`continuous-learning` / `continuous-learning-v2` → 讀取 recap-index** 作為長期記憶來源
- **Codex 審計 → 從 vault/memory/recaps/**/*.md** 抽樣檢視 session 品質

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
- [ ] Phase Recap 是否寫入 `vault/memory/recaps/<專案或母體>/<YYYY-MM>/YYYY-MM-DD-專案-內容.md`，且母體治理類使用 `母體-內容`？
- [ ] Frontmatter 是否包含 `type/date/project/system/repo/topic/status/recap_mode/tags/source_paths/summary`？
- [ ] `source_paths` 是否非空，且所有項目都是 PixiuCore 內既存、可讀的相對路徑？`repo` 是否為短 repo 名而非完整路徑？
- [ ] memory-summary.md 是否同步更新「進行中的工作」區塊？
- [ ] 有沒有因為「已說過」就省略重要規劃細節？（不能省）

---

## 版本與來源

- v0.4.0｜2026-08-27｜新增 Project-scoped progress lookup：目前 workspace 為預設範圍，專案外必須明確解析，唯讀查其他專案不改 execution binding，全域 Vault 不得混合最近 recap
- v0.3.9｜2026-07-26｜明確化正式 manual recap 入口：使用者明示 recap 一律呼叫 `scripts/hooks/pixiu-manual-recap.js`，並固定採 recap → memory-summary → deterministic capture 的 fail-closed 順序
- v0.3.8｜2026-06-08｜加入全自動 draft-auto recap lane，並以 `recap_mode` 區分半自動正式與全自動候選
- v0.3.7｜2026-06-08｜recap 原件改為依專案與月份存放；第二大腦需匯出 `recap_project` / `recap_month`
- v0.3.6｜2026-06-08｜檔名只保留日期；同日撞名時改用更精準內容或非時間性短識別詞
- v0.3.5｜2026-06-08｜明確化 recap 檔名規則：新 recap 使用 `專案-內容`，非專案、屬母體治理/AI 行為/skill/workflow/vault 決策者使用 `母體-內容`
- v0.3.4｜2026-05-19｜強化跨 AI Obsidian Properties 對齊：共同標準以 vault/sop/recap-standard.md 與 vault/templates/session-recap.md 為準，repo 必須是短名，code tracing recap 必須補 source_paths 與 summary
- v0.3.3｜2026-05-18｜對齊週五後 vault recap frontmatter：改用英文 Dataview 欄位，補 system/repo/topic/summary/source_paths
- v0.3.1｜2026-04-21｜修正 markdown lint 警告（空行、code block 語言標注）
- v0.3.0｜2026-04-21｜輸出格式加入「當前規劃內容」完整區塊、決策含棄選方案、月份封存機制
- v0.2.0｜2026-04-20｜新增 Obsidian 相容格式、獨立 recap 檔、Dataview frontmatter
- v0.1.0｜2026-04-17｜初版
