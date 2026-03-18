# Pixiu 治理架構：PowerShell 腳本強健性與編碼治理 (Windows 環境)

在 Pixiu 母艦核心工具鏈中，PowerShell 負責處理大量的檔案同步與目錄清理任務。針對 Windows PowerShell (5.1) 的環境特性，必須遵守以下開發模式以避免腳本失效或資料遺失。

---

## 🛡️ 模式 1：救援中心機制 (The Rescue Center Pattern)

### 1. 核心邏輯
當任務涉及「大量刪除」或「覆寫」子專案目錄（如 `.agent/skills`）時，嚴禁直接執行 `Remove-Item`。必須先實作**局部備份區**。

### 2. 實作規範
* **備份命名**：使用 `$Timestamp` 區分執行次數。
* **路徑對齊**：備份目錄應保留專案名稱的層級結構，確保「一鍵還原」的可能性。
* **邏輯範例**：
    ```powershell
    # 先 Copy 再 Remove
    Copy-Item -Path $TargetDir -Destination $BackupPath -Recurse -Force
    Remove-Item -Path $TargetDir -Recurse -Force
    ```

---

## 🔠 模式 2：編碼治理與字串插值 (Encoding & Interpolation Safety)

### 1. 陷阱：無 BOM 的 UTF-8
Windows PowerShell (5.1) 在讀取沒有 Byte Order Mark (BOM) 的 UTF-8 腳本時，若內容包含中文字元或複雜的字串插值，解析器 (Parser) 會發生位移，產生 `Missing terminator: "` 或 `Missing array index` 等語法錯誤。

### 2. 解決方案：強制產生 UTF-8 BOM
當 AI 需要寫入或產生 PowerShell 腳本時，必須確保檔案以具備 BOM 的 UTF-8 格式儲存。在 PowerShell 環境下建議使用：
```powershell
Set-Content -Path $Path -Value $Content -Encoding UTF8
```
（註：PowerShell 的 `-Encoding UTF8` 預設會包含 BOM，這對相容性至關重要。）

---

## 🚦 模式 3：跨環境錯誤攔截 (Cross-Shell Error Catching)

當 `.bat` 作為進入點呼叫 `.ps1` 時，批次檔預設不會感知 PowerShell 內部的 `try-catch`。

### 實作邏輯
1. **PS 腳本內部**：設定 `$GlobalSuccess` 變數。結束時根據狀態執行 `exit 0` 或 `exit 1`。
2. **Batch 進入點**：必須緊跟著檢查 `%ERRORLEVEL%` 並使用 `pause` 鎖定視窗，防止錯誤訊息一閃而過。
    ```batch
    powershell -File "myscript.ps1"
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] 處理中斷：請檢視上方 log！
        pause
    )
    ```

---
*更新日期：2026-03-11*   
*來源：母體核心 - 同步治理專案*
