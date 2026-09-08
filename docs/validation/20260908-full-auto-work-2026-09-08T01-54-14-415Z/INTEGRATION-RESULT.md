# PixiuCore 完整自動接力：本輪實機修正與驗證結果

日期：2026-09-08（Asia/Taipei）
狀態：`WORK_HOST_SAFE_FIX_VERIFIED_FULL_NATIVE_INTEGRATION_PENDING`

## 結論

工作機的部署防護、測試修正與 OneClick 管理狀態修復已完成。最後一輪 11 組安全驗證均退出 0。R01–R05 完整原生整合與雙機 A01–A17 沒有完成，候選控制器沒有部署。不得把本次安全回歸通過當作完整自動接力已安裝。

沒有 stage、commit、push，沒有啟動 Agent、subagent 或真實模型，也沒有啟停產品任務、恢復暫停專案或修改排程。

## 現場

工作機：`C:\Users\7010\Desktop\gravityTest\pixiu-core`；主機 TV7010NB；分支 master；HEAD `186b70b11166609ead49596b25c7b523e6268417`。Node v22.22.0、DevSpace 1.0.8、Codex 0.153.4、PowerShell 5.1.26100.8655、Git 2.52.0.windows.1。

工作機 read、write、精準 edit/readback、exec、bash、長命令輪詢及指定 PTY session 取消已實測。唯一 probe 檔已移除。指定 PTY 程序取消不等於 R01 原生 workflow stop 已驗收。

Secure 對 C:\PixiuCore 的 open_workspace 兩次失敗，原始錯誤：

```text
ConnectorClientError: 400: Server returned 400:
"We couldn't connect your account. Please try again."
```

家用 Git、版本、4187 與 Telegram 健康未讀取。連線錯誤根因為【資料不足，無法確認】，未假設為 Token 到期。

目前工作機是單檔 WorkflowStore，沒有候選依賴的 external/session-workflow、DevSpace.ProjectResolver.mjs 與三個 full-automatic-handoff/SKILL.md 入口。沒有切換分支、覆蓋測試相依或降版。獨立核心相容整合尚待實作，不能把重新連線視為全部剩餘工作。

## 本輪程式範圍

| 類型 | 路徑 | 修改理由 |
|---|---|---|
| 修改 | scripts/devspace-portable/DevSpace.OneClick.Subagents.psm1 | 只在 Install-DevSpaceWorkflowModule 加入部署前檢、目錄連結拒絕與複製後雜湊核對。其他既有 dirty 修改保留。 |
| 修改 | scripts/devspace-portable/tests/run-portable-package-tests.ps1 | 保留原始例外，將測試篡改的 Add-Content 改為明確 UTF-8 AppendAllText；原篡改拒絕斷言保留。 |
| 新增 | scripts/devspace-portable/tests/run-workflow-deployment-guard-tests.ps1 | 46 個部署防護斷言。 |
| 新增 | scripts/devspace-portable/tests/workflow-native-mcp.test.mjs | 真實 Zod、SDK 與隔離 HTTP MCP 測試既有 WorkflowStore。 |
| 新增 | scripts/devspace-portable/tests/run-full-auto-safe-validation.mjs | 固定安全測試入口；記錄原始輸出、退出碼、雜湊及暫存清理。 |

舊部署器仍是單檔安裝器。缺 helper、外部核心來源、多檔來源或 reparse point（重新解析點）會在部署寫入前拒絕。這是避免半套部署的防護，不是五模組原子部署功能。即使所有 helper 存在，舊安裝器仍拒絕多檔候選。

部署防護有效重現為 14 通過、32 失敗；修正後 46 個斷言通過。打包測試在修正前曾回報暫存清理 IOException；保留原始例外後重現 Add-Content 的 System.ArgumentException / GetContentWriterArgumentError（資料流不可讀）。改用 AppendAllText 後最後一輪 25 個檢查通過。沒有刪除失敗日誌。

## 實際管理狀態修復

初始 runtime.json 記錄的 PID 6716／34348 已找不到，但 7676 健康正常。先核對 listener、建立時間與共同 parent，再執行既有入口：

```text
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/devspace-portable/devspace-oneclick.ps1 repair-state
```

退出 0；沒有重啟。管理紀錄採用現場 DevSpace PID 3616、Dev Tunnel PID 27616。收尾仍是相同 PID 與建立時間，parent 都是 18224。

- DevSpace：2026-09-08T00:59:07.6140375Z。
- Dev Tunnel：2026-09-08T01:00:02.8780682Z。
- 7676 healthz：`{"ok":true,"name":"devspace"}`。
- settings 未刪除既有欄位；變更欄位 publicBaseUrl、createdAtUtc。

備份位於 `%LOCALAPPDATA%\DevSpaceOneClick`：

| 檔案 | SHA-256 |
|---|---|
| runtime.json.20260908-094601.bak | 9ff117bc537f90062efbc849e890746665193850da33b432684320810847b5fc |
| settings.json.20260908-094601.bak | fc68849ce34f0066254de97cd93bb4489196ce5aed20abbc6356314ec7ade4f9 |

兩份備份已核對原始位元組。舊 runtime 含過期 PID，不要把直接還原它當作服務身分已恢復正確。

## 最後一輪測試與證據

本目錄的 summary.json 為原始測試摘要，另有每組 stdout.log、stderr.log 與雜湊。最後一輪 2026-09-08T01:54:14.426Z 至 01:55:16.730Z，11 組退出 0，原始日誌雜湊讀回及本輪唯一暫存區清理皆通過。

| 組別 | 結果 | 退出碼 |
|---|---|---|
| deployment-guard | 46 個斷言；0 失敗、0 跳過 | 0 |
| native-http-mcp | 8 子情境；TAP 9 含父測試 | 0 |
| workflow-store | 15 項 | 0 |
| router | 測試檔通過；TAP 以 1 檔計數 | 0 |
| skill-metadata-tests | 測試檔通過；TAP 以 1 檔計數 | 0 |
| skill-metadata-source | 94 技能檔頭通過 | 0 |
| skill-metadata-published | 91 技能檔頭通過 | 0 |
| oneclick | 109 個檢查 | 0 |
| portable-package | 25 個檢查 | 0 |
| reconnect-wrapper | 14 個檢查；替身，不重啟服務 | 0 |
| watchdog | 162 個檢查；通知替身，不發送 Telegram | 0 |

不相加宣稱總情境數：各組有包含關係，技能數、斷言數及 TAP 父子計數也不同。技能檔頭通過不代表完成三個 full-auto 入口同步。

原生 MCP 測試使用目前已安裝 SDK、ext-apps、真實 Zod，但 server、client、workspace、ledger 為隔離測試環境。它驗證舊流程；明確測得 workflow_update 不支援 pause。並非實際服務已載入候選的證據。

保留的失敗輪次：

```text
docs/validation/20260908-full-auto-work-2026-09-08T01-43-46-494Z
docs/validation/20260908-full-auto-work-2026-09-08T01-49-05-324Z
```

Linux / Node v22.16.0 原候選重跑為 84 通過、0 失敗、0 跳過、退出 0；外層 7 筆、內層 32 筆 SHA-256 與 ZIP CRC 核對通過。這些 Linux 原始證據在本次對話附件中，不在本工作機目錄。

重跑工作機測試：

```text
node scripts/devspace-portable/tests/run-full-auto-safe-validation.mjs
```

## R01–R05

| 項目 | 狀態 | 未完成內容 |
|---|---|---|
| R01 | 未完成 | 真實 stop、launch-key lookup、回執與中斷恢復。 |
| R02 | 未完成 | pause/resume 與實際 edit/write/exec/Git 入口的 task/project/owner/lease/epoch 閘門。 |
| R03 | 未完成 | 真正全域排程供應者、CAS 或等價臨界區、全域拓樸。 |
| R04 | 未完成 | 真實進度 evidence、通知送達回執與冷卻喚醒。 |
| R05 | 部分修正，未完成 | 單檔拒絕防護與管理狀態修復已做；五模組部署、新載入實例、雙機結構往返與技能同步未做。 |

## A01–A17 整列驗收

本節的「部分測試 0」不代表整列通過。證據檔均相對本目錄。

| ID | 整列狀態 | 環境、命令或工具及觀察 | 退出碼／證據 |
|---|---|---|---|
| A01 | 失敗／未達要求 | 工作機工具可用；Secure open_workspace 400；新載入版本未取得 | 工作測試 0；Secure 無程序退出碼；native-http-mcp.stdout.log |
| A02 | 未驗證 | Windows 缺件與多檔拒絕已測；新版能力漂移未測 | 部分測試 0；deployment-guard.stdout.log |
| A03 | 未驗證 | 未執行暫停後監控／服務重啟；家用 4187 無證據 | 不適用；Secure 錯誤 |
| A04 | 未驗證 | runner/lease/epoch 核對後恢復未做 | 不適用 |
| A05 | 未驗證 | 原生取消後拒絕恢復及停用 Watch/Pulse 未做 | 不適用 |
| A06 | 未驗證 | Linux 候選不等於原生啟動／回執中斷窗口驗收 | 候選 0；原生未執行 |
| A07 | 未驗證 | 沒有跨 Session 原生並行啟動證據 | 候選 0；原生未執行 |
| A08 | 未驗證 | 指定 PTY 取消不等於晚到結果／epoch 驗收 | PTY 取消後 1；整列未執行 |
| A09 | 未驗證 | 舊 stale revision 拒絕通過；原生 writer 世代閘門未做 | 部分測試 0；native-http-mcp.stdout.log |
| A10 | 未驗證 | 舊跨專案查詢拒絕通過；新版 writer／排程綁定未測 | 部分測試 0；native-http-mcp.stdout.log |
| A11 | 未驗證 | 新版審查中暫停、blocked 解除未實測 | 不適用 |
| A12 | 未驗證 | 真實 runner 心跳與產物／測試 evidence 未接入 | 不適用 |
| A13 | 未驗證 | 真實 CLI 分類／持久預算／條件喚醒未接入 | 候選 0；原生未執行 |
| A14 | 未驗證 | Get-ScheduledTask 只讀盤點；真正 provider 與暫停競爭未測 | 盤點 0；整列未執行 |
| A15 | 未驗證 | 舊查詢帳本唯讀通過；新版 Pulse／真實通知送達未測 | 部分測試 0；native-http-mcp、watchdog 日誌 |
| A16 | 未驗證 | 舊部署器拒絕半套已測；五模組部署與雙機重載未完成 | 部分測試 0；deployment-guard、portable-package 日誌 |
| A17 | 未驗證 | 工作機回歸與範圍外雜湊通過；家用機／新核心相容性缺證據 | 工作機 0；雙機未完成 |

## 保留項目與收尾核對

初始 8 個 dirty 檔及 1 個未追蹤檔均保留。只有 Subagents 安裝函式及原本乾淨的打包測試在既有追蹤檔中被本次更改。

原始比較集 2,614 筆，在記憶體恢復本次打包測試的已驗證原始位元組後，摘要仍為 `4328826798454c35b770bae4e283177245a3a024b53bc579609b8d67e2b38f79`。其餘 2,613 檔現場位元組未變；另核對 builder/verifier 兩檔未變，合計 2,615 個範圍外追蹤檔。沒有將來源檔寫回舊版。

- Subagents 函式之前：`4770d3762359e3b90e282dd1c526f649e3456c013bccfbbec305990a7001ed2d`。
- Subagents 函式之後：`e4a1bbb6c928861b0cf7d91f83084fca193d4e11ef6df770ebae827debc58817`。
- 原未追蹤 cogno 計畫：`b5439f98fbb7ca33573231e0978370b91fc94f79a04706f7ee91a7965edda4e2`。
- 安裝中 WorkflowStore 未變：`354a12690b9f7a5da0abeac4d4c519751b16bc434156f1550b18f43fb0e597a9`。

Git HEAD 未變，暫存差異為空。git diff --check 退出 0，僅有既有 LF/CRLF 提醒。

最終來源雜湊：

| 檔案 | SHA-256 |
|---|---|
| DevSpace.OneClick.Subagents.psm1 | d21e3f7d12bad3f7814d3730e8b36fc18ed32c910fae7d325fc29b7846e9ae21 |
| run-portable-package-tests.ps1 | 888656897bd681ef033d7d47f47cb0343e1824f21fefdeddf886c054c947e709 |
| run-workflow-deployment-guard-tests.ps1 | 3595dded4869a1cf5f9b1673eb7f0c2114410e396cf7ab3839bee7c2a65a6a3b |
| workflow-native-mcp.test.mjs | ce9fe56458f33afa000856b146b34ca2acbc9b7337f08c20bb673b5394c82c2a |
| run-full-auto-safe-validation.mjs | 08b88ce869f546974e29164921d77892986aefa542902fcf71597dc63d415ad2 |

工作機被盤點的 Pixiu Second Brain Index 與 Pixiu-Vault-Qdrant-Sync 仍啟用，未修改。沒有全域排程供應者證據，不宣稱完成去重。家用服務為本次未操作、健康未驗證，不能標 PASS。

## 回復與接續

不要整份 git restore Subagents 或 reset 工作樹。本次回復只應撤銷安裝函式與打包測試的 owned diff，保留其他原有升版修改。本次沒有候選部署可回退。

外部必要操作：重新連線 DevSpace Secure 並實際成功開啟 C:\PixiuCore。之後仍需重新核對兩端現場、完成獨立核心相容整合、R01–R04 真實接線與 R05 部署。維持不啟動模型、不派 Agent、不恢復無關任務，以及本任務未新增 Git 提交推送授權的邊界。
