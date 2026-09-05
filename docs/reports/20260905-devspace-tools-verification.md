# DevSpace Secure 工具實測與自我驗證報告

- 測試日期：2026-09-05（Asia/Taipei）。
- 測試專案：`C:\PixiuCore`，使用實際 checkout。
- 工作區：`ws_e2ac7a04-6ef1-4815-b5c3-24c36163d659`。
- 分支：`feature/standalone-session-workflow-20260819`。
- 首次取得的 HEAD：`e8f6b6df25fd47ed36ea2fb51e25d8dd1244174a`。
- 實測環境：Windows，Node.js `v24.13.0`。

## 一、結論與完成界線

本次列出的 16 種 DevSpace Secure 工具中，14 種已實際呼叫。13 種完成表列的正向操作；`workflow_takeover` 只驗證保護性拒絕，不代表接手成功路徑已驗證。`workflow_run` 與 `workflow_sync` 沒有執行，因為本次不啟動 Agent，也沒有建立模型執行紀錄。

一般開發所需的讀檔、搜尋、新增、精準編輯、Git 查詢、命令執行、長命令輪詢、標準輸入及取消命令均已通過表列測試。既有 DevSpace 回歸測試為 **122 項通過、0 項失敗**。

本次修正的是命令的呼叫方式：單一命令直接執行；PowerShell 分號串接改用明確的 `powershell.exe -Command` 入口，重測成功。沒有修改執行中的 DevSpace 伺服器程式，也沒有重新安裝或重啟服務。先前提過的 `Resource not found` 本次未重現，不能把本次成功宣稱為已修復該歷史故障的根因。

**不能標示「全部工具已完整修復」：原生 Windows PTY 尚未啟用；一次複合指紋複驗被平台攔截；兩個 Agent 相關工具未測。**

## 二、逐項工具結果

| 工具 | 結果 | 本次實際驗證範圍 |
|---|---|---|
| `open_workspace` | 通過 | 開啟 `C:\PixiuCore` 實際 checkout，取得工作區與專案指示；未測另建 worktree。 |
| `read` | 通過 | 讀取啟動規則、驗證規則、原始碼與測試檔；繁體中文讀回正常。 |
| `write` | 通過 | 新增專用測試檔，隨後由 read 讀回；本報告亦以此工具建立。 |
| `edit` | 通過 | 唯一目標精準替換成功；不存在的目標、重複目標均正確拒絕，測試檔最後讀回正常。 |
| `grep` | 通過 | 搜尋 DevSpace 腳本內的命令、版本與修補相關文字。 |
| `glob` | 通過 | 搜尋腳本檔名，並確認測試檔名前綴最初沒有既有檔案。 |
| `ls` | 通過 | 列出 `scripts/devspace-portable` 目錄。 |
| `bash` | 通過 | 執行 `git diff --stat`；指定相對工作目錄後，Node 回報正確目錄。 |
| `exec_command` | 一般命令通過，有限制 | Git、Node、明確 PowerShell 入口及既有測試成功；退出碼可正確回傳。原生 PTY 測試失敗，另有一次複合指令遭平台攔截。 |
| `write_stdin` | 通過表列操作 | 長命令輪詢、傳入文字及 Ctrl+C 均成功；未驗證真正 PTY 的尺寸調整。 |
| `workflow_create` | 通過 | 建立本次專用單一會話測試任務，沒有啟動模型。 |
| `workflow_list` | 通過 | 以精確 taskId 讀回同一任務，狀態與版本一致。 |
| `workflow_update` | 通過 | claim、complete 成功；舊 revision 被正確拒絕。 |
| `workflow_takeover` | 保護測試通過 | 在 owner 心跳缺失條件為 false 時正確拒絕；沒有接手他人或既有任務。成功接手路徑未測。 |
| `workflow_run` | 未執行 | 本次不啟動 Agent；不能據此判定工具故障或正常。 |
| `workflow_sync` | 未執行 | 沒有建立模型 run；不能據此判定工具故障或正常。 |

以上是特定操作的實測結果，不是每個參數、分支或外部整合的全覆蓋驗證。

## 三、失敗項目、處置與重測

### C01：直接使用 PowerShell 分號串接失敗，已修正呼叫方式

首次將 `git status --short --branch; git diff --stat; ...` 直接傳入 exec_command，Git 回傳：

```text
error: unknown option `branch;'
Process exited with code 129.
```

這證明分號沒有按 PowerShell 語法處理，不能據此認定 exec_command 不可用，也不能把目前入口當成預設 PowerShell。

改成單一 `git status --short --branch` 後退出碼為 0。需要分號時改用明確入口：

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -Command "Write-Output 'DEVSPACE_CHAIN_BEGIN'; Start-Sleep -Seconds 3; Write-Output 'DEVSPACE_CHAIN_END'"
```

實測回傳 sessionId `110`，由 write_stdin 取得兩個標記，最後 `running=false`、`exitCode=0`。這是已驗證的操作相容處理，不是伺服器程式修補。

### C02：原生互動終端機未通過，尚未修成原生 PTY

以 `tty=true` 執行 Node 終端機探測，回傳 `TTY=false`。改用嚴格判定後，輸出如下：

```text
NATIVE_PTY_UNAVAILABLE
Process exited with code 78.
```

因此不能宣稱目前支援真正的互動終端機或終端機尺寸調整。一般命令、文字標準輸入、輪詢與取消已另外通過，不需要把所有開發操作都視為失效。

查閱時，官方 main 分支的 `src/process-sessions.ts` 使用 `input.tty && process.platform !== "win32"` 決定是否走 PTY；Windows 走 pipe，與本機觀察一致。這份公開原始碼不是本機已安裝檔案的逐位元證明。本機安裝腳本固定使用 `@waishnav/devspace@1.0.4`，沒有將上游 main 直接套入固定版本。

本次保留非 PTY 的已驗證操作路徑，沒有新增原生套件、修改使用中的服務或重啟連線。原生 PTY 的啟用、相容性修補與完整回歸仍未完成。

### C03：複合指紋複驗遭平台攔截，未解除

前段已成功取得 HEAD、根專案差異與暫存索引、子模組差異與暫存索引的指紋。最後一個把重新計算、比對與測試檔精確比對合併的 Node 指令，收到：

```text
由於 OpenAI 無法確定要求的安全狀態，因此已將此工具調用封鎖。
```

該指令未執行，不能把其中任何 assertion 計為通過。沒有修改安全設定或以編碼方式重送。後續一般 `git diff --stat` 與 `git diff --cached --stat` 均正常回傳，故不能把這次攔截說成整個 exec_command 已離線。

以獨立的 Git 差異統計與專用 read 工具完成較窄的檢查：前後差異統計一致、暫存區無變更、測試檔讀回正確。這些證據不等同於完整 SHA-256 複驗；既有工作樹逐位元一致性仍未確認。

## 四、自我驗證證據

### 檔案往返與編輯保護

專用檔案：`docs/reports/20260905-devspace-tools-smoke-fixture.txt`。

write 建立後，edit 將 `edit_status=PENDING` 改為 `edit_status=PASS`。不存在目標的編輯收到 `Could not find the exact text`；重複目標的編輯收到 `Found 2 occurrences`。兩次拒絕後再次 read，內容如下：

```text
DevSpace Secure 工具實測專用檔案。
probe_id=devspace-tools-20260905-e2ac7a04
write_status=PASS
edit_status=PASS
重複比對測試
重複比對測試
```

### 命令生命週期

| 測試 | 實際結果 |
|---|---|
| PowerShell 長命令與輪詢 | sessionId 110；兩個輸出標記完整；退出碼 0。 |
| 標準輸入 | sessionId 111；傳入 `DEVSPACE_STDIN_PROBE`，收到 `STDIN_OK:DEVSPACE_STDIN_PROBE`；退出碼 0。 |
| 錯誤退出碼 | 測試程式輸出 `EXPECTED_FAILURE_PROBE`；工具保留退出碼 7。這是預期失敗測試。 |
| 相對工作目錄 | bash 指定 `scripts/devspace-portable`，Node 回報 `C:\PixiuCore\scripts\devspace-portable`。 |
| Ctrl+C | sessionId 116；收到取消後 `running=false`、退出碼 1。這是預期取消結果。 |

### 工作流隔離測試

- taskId：`tsk_183134825e84`。
- sessionRef：`devspace-tools-20260905-e2ac7a04`。
- 建立 revision 1；claim 後 revision 2。
- 舊 revision 操作回傳：`Stale revision: expected 1, current revision is 2.`
- 接手保護回傳：`Stale-owner takeover requires confirmed missing owner heartbeat.`
- 由原 owner 完成後：`status=completed`、revision 3、`runs=[]`。
- 完成時間：2026-09-05 16:29:43（Asia/Taipei）。

本任務只測試工作流工具，不代表整份工具修復工作已全數完成；沒有留下待執行的測試工作流。

### 既有 DevSpace 回歸測試

執行來源：`scripts/devspace-portable/tests/run-tests.ps1`。先讀取測試與副作用相關內容，確認使用暫存測試目錄與假資料，再執行：

```powershell
powershell.exe -NoLogo -NoProfile -NonInteractive -File scripts/devspace-portable/tests/run-tests.ps1
```

sessionId `114` 的最終輸出：

```text
Tests: 122 passed, 0 failed
Process exited with code 0.
```

測試包含允許路徑、Windows 命令相容性、修補冪等性、版本與漂移保護、技能探索、工作流安裝與狀態測試。這是該既有測試套件的結果，不等於所有 PixiuCore 功能、Telegram 通知或完整 GUI 的端對端驗證。

## 五、變更範圍與既有使用保護

本次在專案內新增的持續保留檔案只有：

1. `docs/reports/20260905-devspace-tools-smoke-fixture.txt`：工具往返與保護測試證據。
2. `docs/reports/20260905-devspace-tools-verification.md`：本報告與已驗證的呼叫方式。

另由工作流工具建立並完成一筆專用測試任務；既有測試套件自行管理其暫存資料。沒有覆寫既有程式或已存在的未提交修改；沒有 stage、commit、push、reset、歷史改寫、DB 操作、Agent 啟動、正式服務啟停、通知或排程設定變更。

前後 `git diff --stat` 都顯示：

```text
70 files changed, 434 insertions(+), 1224 deletions(-)
```

結尾 `git diff --cached --stat` 沒有變更輸出，退出碼 0。兩個本次新增檔案屬未追蹤檔案，不包含在上述 tracked diff 統計內。完整指紋複驗遭攔截的限制已記於 C03，不能以相同統計替代逐位元一致證明。

## 六、來源

主要證據為本次 DevSpace Secure 實際工具回傳、read-back 與測試輸出。專案來源包括 `scripts/devspace-portable/devspace-oneclick.ps1` 的固定版本設定，以及 `scripts/devspace-portable/tests/run-tests.ps1` 的測試內容。

公開補充來源（查閱日 2026-09-05）：

- Node.js 官方 TTY 文件：`https://nodejs.org/api/tty.html`，說明 `process.stdout.isTTY` 判定方式。
- DevSpace 官方原始碼：`https://github.com/Waishnav/devspace/blob/main/src/process-sessions.ts`，說明查閱時的 Windows pipe／PTY 分流。上游 main 不是本機安裝版本的直接證據。

最終狀態：**一般開發操作可用，命令呼叫方式已修正並重驗；全工具、全模式修復尚未完成。**
