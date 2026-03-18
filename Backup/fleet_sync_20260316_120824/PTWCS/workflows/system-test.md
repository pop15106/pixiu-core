---
description: 執行全系統測試或當前程式功能的自動化測試工作流
---

// turbo-all

# 全系統測試工作流 (System Test Workflow)

當使用者要求「全系統測試」或「再次測試」時，執行此工作流。

## 階段 1：環境檢查

1. 確認資料庫連線與環境變數。
2. 確認 Maven 與 NPM 環境。

## 階段 2：執行全系統測試 (優先)

1. **後端 API 測試**：
   ```powershell
   mvn test
   ```
2. **前端 UI 測試**：
   ```powershell
   cd view/ptwcs_react; npm test
   ```

## 階段 3：目前程式功能測試 (若全系統測試過長或失敗)

1. 針對當前修改的 Controller 或 UseCase 執行特定的單元測試。
   - 例如：`mvn test -Dtest=JwtUtilsTest`

## 階段 4：結果回報

1. 彙整測試通過與失敗的項目。
2. 若有失敗，啟動 `systematic-debugging` 進行分析。
