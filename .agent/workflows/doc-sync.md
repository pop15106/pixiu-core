---
description: 執行文件健康檢查與內容同步
---

# 文件同步工作流 (/doc-sync)

此工作流用於偵測程式碼與文件的落差，並引導 AI 自動補齊過時的文件內容。

## 1. 診斷 (Diagnostic)

AI 應首先呼叫母體中央腳本進行健康檢查：
// turbo

```powershell
powershell -ExecutionPolicy Bypass -File "C:\PixiuCore\.agent\pixiu\scripts\doc-health-audit.ps1"
```

## 2. 變更分析 (Impact Analysis)

若腳本回報「Source code was modified AFTER documentation」，AI 必須：

1. 列出所有在最後一次文件更新後修改過的檔案。
2. 判斷這些變更是否影響 `docs/RoadMap.md`, `docs/Architecture.md` 或 `CHANGELOG.md`。

## 3. 自動同步 (Auto-Sync)

AI 應主動向使用者提議：

- 「偵測到 X 功能已有實作但文件未更新，是否由我自動補齊 `docs/Architecture.md` 的描述？」
- 獲得授權後，讀取程式碼邏輯並更新對應文件。

## 4. 交付 (Delivery)

同步完成後，再次執行診斷腳本以確保狀態轉為「✅ OK」。
