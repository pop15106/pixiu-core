---
description: Pixiu 程式碼風格與文件規範（按需載入）
alwaysApply: false
---

## 📐 程式碼風格

- 變數命名：camelCase
- 元件命名：PascalCase
- CSS 類名：kebab-case
- 使用 ES6+ 語法
- 關鍵 UI 與第三方呼叫必須 try-catch
- 單一模組錯誤不可導致全站停止

## 📝 文件規範

- 專案文件（API/架構/部署/設計）放 `docs/`，規則/技能/工作流放 `.agent/` 對應目錄
- `README.md`、`CHANGELOG.md`、`AGENTS.md` 放根目錄
- 功能變更時需提醒同步更新相關文件（RoadMap、CHANGELOG）
