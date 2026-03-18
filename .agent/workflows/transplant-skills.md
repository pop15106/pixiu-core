---
description: 將架構師協議與推理模式移植到新專案
---

# 技能移植工作流 (/transplant-skills)

此工作流用於將當前專案的 `.agent/skills` 核心文件自動複製到指定目標目錄，並自動更新專案名稱。

## 操作步驟

1. **確認目標路徑與專案名稱**
   - 詢問用戶目標專案的絕對路徑。
   - 詢問新專案的簡寫名稱 (例如: `CMS`, `LMS`)。

2. **執行移植腳本**
   // turbo
   使用終端執行以下指令：

   ```powershell
   powershell -ExecutionPolicy Bypass -File "c:\Users\7010\Desktop\gravityTest\PTWCS\scripts\transplant-skills-standalone.ps1" -TargetDir "[目標路徑]" -ProjectName "[專案名稱]"
   ```

3. **初始化目標專案規則**
   - 提示用戶在新專案執行 `/init-docs` 或手動將 `user_rules.md` 複製過去。

4. **驗證**
   - 檢查目標目錄下的 `.agent/skills/architect-protocol/architect_protocol_guide.md` 是否已正確更新連結。
