---
description: 啟動模組切割掃描 (Modular Scan)
---

# Modular Scan Workflow

此工作流會呼叫 `modular-scanner` Skill，對專案進行領域邊界分析並自動生成模組 Skill 檔案。

## 使用方式
`/modular-scan`

## 前置條件
- 專案根目錄已有 `AGENTS.md`
- `.agent/skills/` 目錄已存在

## 執行步驟

1. **技術棧偵測**:
   - 讀取 `.agent/skills/tech-stack.skill.md` 取得偵測規則。
   - 掃描 `package.json`、`requirements.txt` 等檔案，確認技術棧。
   - 將結果輸出為技術棧摘要表格。

1.5. **粒度選擇 (Granularity)**:
   - 檢查使用者是否在指令中明確指定粒度（如 `--granularity=fine`）。
   - 若無，檢查專案根目錄是否存在 `.modular-scanner.json`，讀取 `granularity` 欄位。
   - 若皆無，依主要程式碼目錄的檔案數自動推斷：`< 20` → `coarse` / `20~80` → `standard` / `> 80` → `fine`。
   - 向使用者展示推薦粒度等級，**等待確認或調整後才進入下一步**。

2. **領域邊界掃描**:
   - 讀取 `.agent/skills/modular-scanner.skill.md` 取得掃描規則。
   - 掃描前端 `src/components/`、`src/app/`（或 `src/pages/`）。
   - 掃描後端 `routes/`、`models/`、`services/`（依框架調整）。
   - 根據「邊界識別規則」列出候選模組清單。

3. **確認模組清單**:
   - 將候選模組清單呈現給使用者。
   - 等待使用者確認或調整（可合併/拆分/重命名）。
   - **⚠️ 必須等使用者確認後才進入下一步。**

4. **生成領域 Skill 檔案**:
   - 對每個確認的模組，掃描其相關原始碼。
   - 依照 `modular-scanner.skill.md` 中的「生成領域 Skill」模板產出 `.skill.md`。
   - (Optional) 若有 `UxSoul-extractor.skill.md`，為前端模組補充 UX 行為規範。

5. **索引更新**:
   - 將新 Skill 加入 `AGENTS.md` 的 `skills` 索引。
   - 更新 `skill-trigger.shared.md`，為每個新模組加入觸發關鍵字。
   - 更新 `.agent/pixiu/registries/skills.registry.yaml`。

6. **通知使用者**:
   - 顯示掃描摘要表格（模組名稱、類型、檔案路徑）。
   - 請求使用者檢閱生成的 Skill 檔案。
