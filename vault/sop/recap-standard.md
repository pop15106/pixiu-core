# Pixiu Recap Standard — AI 會話紀錄標準格式

> 本檔案定義了所有 AI (Claude/Gemini/Codex) 在結束 session 或階段性任務時，產生的 Recap 檔案應遵循的格式。

---

## 檔案命名規範

```text
vault/memory/recaps/<專案或母體>/<YYYY-MM>/YYYY-MM-DD-專案-內容.md
```

### 前綴規則

- 與特定專案、系統或 repo 有關：檔名前綴使用專案 key，例如 `PCLMS`、`PCLMS_AP`、`PCLMS_BK`、`PEPIS`、`PERMS`、`PISSO`、`SECOND_BRAIN`、`AUTO_RESEARCH`、`DOCX_TOOLING`、`OPENSPEC`。
- 與特定專案無關，且內容屬於 PixiuCore 母體治理、AI 行為、skill/workflow、vault 結構、recap 規範、跨 AI 決策或操作準則：檔名前綴使用 `母體`。
- 母體類 recap 的 frontmatter `project` 使用 canonical key `PIXIUCORE`；檔名前綴才使用 `母體`。
- `內容` 優先取自 `topic`，移除重複專案字樣，保持短、可掃讀、可搜尋。
- 檔名不得包含 Windows 不合法字元：`\ / : * ? " < > |`。

範例：

- `vault/memory/recaps/PCLMS/2026-06/2026-06-08-PCLMS-庫存核銷交易邊界.md`
- `vault/memory/recaps/母體/2026-06/2026-06-08-母體-recap檔名規則修正.md`

> 檔名只保留日期，不加入時間戳。若同日同專案有多份 recap，優先讓 `內容` 更精準；仍撞名時加非時間性的短識別詞。
> recap 原件必須依專案與月份存放；專案資料夾使用檔名前綴，月份資料夾使用 frontmatter `date` 的 `YYYY-MM`。

---

## 標準內容結構

### 1. Frontmatter (YAML)
```yaml
---
type: session-recap
date: YYYY-MM-DD
project: PROJECT_KEY
system: SYSTEM_KEY
repo: repo-name
topic: kebab-case-topic
status: done | follow-up | paused | verified-local | procedure-pending
tags: [recap, session, project-key, topic-key]
source_paths:
  - %PROJECT_ROOT%/path/to/important/source
summary: 一句話摘要，說明本 recap 的核心結論或下一步。
---
```

### 半自動與全自動並存規則

- 半自動 recap：使用者主動要求 `recap`、`摘要`、`現在到哪了`、`下一步` 時產生，frontmatter 使用 `recap_mode: manual`，視為正式 recap。
- 全自動 recap：由 hook 在 `Stop` 或 `SessionEnd` 事件產生，frontmatter 使用 `recap_mode: auto`、`status: draft-auto`、`auto_trigger: stop | session-end`。
- 全自動 recap 是候選記憶，只當保險網；若同一天同專案已有半自動正式 recap，不覆蓋，改用非時間短識別詞如 `auto1`。
- 第二大腦索引必須保留 `recap_mode`、`auto_trigger`、`recap_project`、`recap_month`，讓查詢可以選擇只看正式 recap 或包含自動 draft。

### 2. 📥 Inbox — 給 AI 的任務清單 (核心功能)
> 用於跨會話的任務接力。AI 讀到後會自動識別並追蹤。

```markdown
<!-- AI_INBOX_START -->
- [ ] 待執行任務 1
- [ ] 待執行任務 2
<!-- AI_INBOX_END -->
```

### 3. ✅ 本次完成
*   簡述本次會話達成的里程碑或修正的 Bug。

### 4. ⚠️ 發現的問題 / 踩坑
*   記錄開發過程中發現的潛在風險、程式碼臭味或技術債。

### 5. 🎯 重要決策 (表格格式)
| 日期 | 決策 | 選擇 | 原因 |
|------|------|------|------|
| YYYY-MM-DD | 決策主題 | 最終採取的方案 | 決策背後的權衡分析 |

### 6. 📅 待辦 (使用者/AI 共用)
*   [ ] 尚未完成的具體步驟。

### 7. 💡 補充筆記
<!-- 你可以在這裡補充 -->
*   任何有助於理解脈絡的補充資訊。

---

### 8. 頁尾標記
`*由 [AI 名稱] (Cowork) 自動產生，可手動編輯*`

---

## 觸發機制
當使用者說「**去讀我的 recap**」或「**現在進度到哪了？**」時，AI 應優先讀取最近一份符合此格式的檔案，並解析 **Inbox** 區塊。
