---
name: pixiu-verify-loop
description: Pixiu 自我驗證：依本次授權分為唯讀審核、已授權修復與 CR 完整自動接力。使用單一 Agent 依序執行實測、差異覆核、修復重驗及交付；/go 由 commands/go.md 載入。
origin: Pixiu
version: 0.3.0
language: zh-TW
---

# Pixiu 自我驗證迴圈

## 授權先判

以使用者本次授權決定行為，而非把「驗證」視為新的寫入或推送許可。

| 模式 | 紅燈處置 | 交付 |
| --- | --- | --- |
| 唯讀審核 | 收集失敗證據，保持程式不變 | findings、風險與修復建議 |
| 已授權實作／修復 | 在原範圍修復根因並重驗 | 變更、實測結果與 handoff |
| CR 完整自動接力 | REPAIR；相同失敗兩次無新證據先 REASSESS | CR completion gate 通過後依本次授權 commit／push |

DB 寫入、刪檔、Production、Release、Deploy、秘密資料及超出範圍的修改各自檢查權限。已有的明確授權沿用，不為同一個已授權動作反覆詢問。工具拒絕或環境硬阻礙照實記錄。

## 1. 實測

先讀專案實際 build／test 設定，從需求萃取可驗收條件；一般可逆細節採現有慣例並記錄假設。業務語意或不可逆決策不明時才確認。

每完成一個最小端到端工作單位即驗證。依實際修改選編譯、單元、整合、API、UI 或資料庫唯讀檢查；新 UI 行為需要頁面操作，不以編譯成功替代。先跑相關小測試，再跑受影響回歸。

每次驗證保留 command、exit code、輸出定位、Git headSha 與變更摘要。先保存真實 exit code 再精簡輸出；不以管線最後一個 head／tail 的成功碼代替測試結果。區分 PASS、FAIL、NOT_RUN 與有理由的 N/A，必要 NOT_RUN 不能標綠。

紅燈先建立最小重現、檢查根因與已排除假設。依授權表處理；修復後先重跑失敗項，再重跑受影響回歸。相同失敗兩次無新證據時換成診斷，不原樣重試或修改測試來掩蓋錯誤。明確資源邊界耗盡時保存未完成狀態，不能以「重試結束」代替驗收。

## 2. 單一 Agent 依序覆核

重新讀取最新 diff，依序核對需求完整性、程式相依、錯誤處理、邊界與回歸。只修與本次需求有關的問題；有任何修正即重驗。

這是 sequential self-review，不是獨立審查。保留 findings 與修復證據；不得把換角色名稱說成第二個 reviewer。獨立 reviewer 是必要條件但目前缺少時，保持該條件未完成。

單一 Agent 模式採直接讀檔與測試覆核。任何會啟動額外 Agent 的工具（含 /simplify 的多 Agent 實作）都需要另行明確授權。CR 交付契約的 agentPolicy 保持 single。

## 3. 完成與推送

逐項核對驗收條件、最新 diff、測試輸出與未預期改動。CR 任務保留 VERIFY → RECHALLENGE，再執行 `node scripts/critical-relay/critical-relay.js check <state.json>`；gate 非零即未完成。

有本次 push 授權且必要檢查通過，直接推送已覆核的變更；推送前確認遠端基準，遠端前進時整合並重驗，使用非強制 push 保護他人提交。沒有 push 授權則交付本機變更與 PR 內容草稿。Release／Deploy 另判。

推送後讀回遠端 SHA；存在 CI 時取得 run ID、輪詢至終態並區分成功／失敗／尚未完成。CI 只在推送後執行，不能把本機通過預先說成遠端 CI 通過。

## v2 執行證據入口

PixiuCore 的必要測試固定於 `scripts/critical-relay/public-core.plan.json`。使用 `test-runner.js` 自動收集命令、exit code、結構化案例與來源指紋，再以 `relay-evidence.js` 回填既有 criticalRelay state。新完整交付使用 v2 契約；有 ledger 就沿用 ledger，沒有才初始化 `.cr/state.json` 與獨立 binding。

只有必要命令成功不等於完成；CLI／workflow 完成入口必須回讀證據，再滿足 VERIFY → RECHALLENGE。取消、逾時、零筆、缺檔、過期或必要清單變動都不標綠。使用者已授權的修復由目前單一 Agent 執行，helper 不啟動模型。操作及未支援的 adapter 見 `scripts/critical-relay/README.md`。

## 狀態與報告

沿用現行 durable workflow 的 criticalRelay state；沒有 ledger 時，在授權專案的 `.cr/` 保存 state 與 handoff。每個里程碑記錄基準／目標 SHA、改動內容指紋、驗收進度、失敗軌跡、唯一下一步。恢復時重新核對 Git 與實測版本；新的修改使舊測試證據失效。

回報完成內容、測試命令與結果、未驗證項目、風險、commit／push／CI 各自狀態。模型名稱與推理強度只根據執行環境提供的實際值，未確認填 null。此流程不切換 ChatGPT 模型，也不保證效能倍率。

長任務狀態依 `vault/governance/long-running-progress-policy.md`；可見進度不代表已啟動背景 Agent。一般驗證不強制產生全域記憶檔，handoff 保留在本次任務的證據範圍。
