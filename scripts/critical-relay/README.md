# CR 本機證據驗證入口

此版本為 `pixiu.cr-execution.v2`，使用既有 Critical Relay／DevSpace workflow，不增加常駐服務、排程或 Agent。舊 `general` 研究紀錄保留相容；新完整交付任務需固定計劃並回讀原始測試證據。舊 runtime 只支援 v1 時必須拒絕 v2，先升級再使用。

## 本次支援範圍

`public-core.plan.json` 固定九組必要驗證，涵蓋原有 CR、路由、workflow、lazy-loading、私人資源隔離、測試執行器、證據閘門及交接正反例。母體使用 Node.js 22；沒有更動系統 JDK 或 Java 專案。

目前 adapter 只執行 Node `node:test`。UI、API、build、document 可作驗收所需種類，但尚無對應的自動收集 adapter，缺少該證據就阻擋完成。此工具不會以 build 或核心測試假冒產品 UI／API 驗收。

## 單純執行公共核心測試

在已確認的 checkout 執行：

```text
node scripts/critical-relay/test-runner.js
```

入口依事前計劃逐組執行，輸出 JSON 進度及最後的 runId、resultPath、planDigest、來源指紋。`PASS` 表示必要命令執行成功，不表示使用者需求、反證覆核、推送、CI、產品功能或部署已完成。

exit code：0 為必要命令通過；1 為測試失敗、零筆、取消、逾時或來源變更；2 為入口或環境錯誤。各命令的真實 exit code、signal、outcome、leaf-case 統計均保留在結果中。獨立命令繼續收集；依賴失敗命令的項目標為 NOT_RUN。

## CR 完整交付：沒有既有 workflow ledger 時

先固定本次計劃與初始 state：

```text
node scripts/critical-relay/relay-evidence.js init scripts/critical-relay/public-core.plan.json
```

`.cr/verification-binding.json` 保存固定計劃；`.cr/state.json` 保存可更新的 canonical state。已有檔案時不覆寫，也不以重新初始化來消除失敗軌跡。

執行測試時可把固定 binding 中的完整 planDigest 作為第二個參數，入口會在啟動前比對：

```text
node scripts/critical-relay/test-runner.js scripts/critical-relay/public-core.plan.json <planDigest>
node scripts/critical-relay/relay-evidence.js ingest .cr/runs/<runId>/result.json
```

`<planDigest>` 與 `<runId>` 為實際輸出值，不是原樣照抄的文字。

目前對話的單一 Agent 需重新讀取 diff，處理 claims、challenges、反證、風險與未完成項，再記錄 `VERIFY → RECHALLENGE`。runner／ingest 不會自行把這些主觀覆核項目設成完成。最後執行：

```text
node scripts/critical-relay/critical-relay.js check .cr/state.json
```

完整交付 CLI 需要獨立保存的 binding。只改 state 中的 mode、刪除契約、刪除必要測試或將 required 改為 false，都不應使目前任務完成。沒有 binding 的歷史 v1 實作 state 須明確遷移並重驗，不自動回寫為 v2 已驗證。

## 已使用 DevSpace workflow ledger 時

使用 `createEvidenceState(root, planPath, options)` 建立 state，放入既有 task 的 `criticalRelay`；使用 `applyRunEvidence(root, state, runRef, options)` 回填新結果，再以原本 updateTask 的 revision／idempotencyKey 保存。不要再建立第二份 fallback state。

createTask 會固定 `verificationBinding`。更新時不可改成另一份計劃或降級模式。complete 重新核對實際檔案與工作區；handoff 的 acknowledge 若發現證據缺失或來源變更，會保留歷史並轉入 REASSESS，清除可交付 checkpoint。

`applyRunEvidence` 的 `authorizedRepair` 預設 false，只有本次已取得實作／修復授權才設為 true。相同錯誤兩次無新證據轉入 REASSESS；`changedApproach` 用來記錄真正的診斷或換路。重送同一 run 不增加次數；同 run 內容改變則拒絕。這些 helper 不啟動模型、不自動改碼。

## 證據與來源

每輪在 `.cr/runs/<runId>/` 保存執行前 plan.json、result.json、逐命令 stdout.jsonl 與 stderr.log。資料先寫入臨時檔、fsync，再原子更新結果；尚未完整收尾的 RUNNING 不計為成功。單一 runner.lock 避免重複執行。

測試結果使用 Node 官方事件。檔案層空測試結果不計為案例；suite 容器不重複計數。正常 stdout 只當成 log，不能靠印出 PASS 或 JSON 冒充案例。正式完成時，重新解析原始事件、核對 counts、檔案 digest、runId、計劃、runtime 與目前來源。

來源採 Git tracked 加未忽略的 untracked 檔案，對路徑及工作區原始 bytes 計算指紋；唯一額外排除區是 `.cr/`。新增、刪除與修改都影響指紋。提交後 HEAD 改變也須重跑。Windows 與 Linux 換行及 runtime 不同時需要各自驗證，不能互換證據。

只讀授權根目錄中的證據，拒絕路徑穿越、絕對資源路徑及 symlink／junction。工作目錄本身由已授權入口提供；這不構成作業系統沙盒。測試程式仍以目前 OS 帳號權限執行。

子程序只接收受控的工具／暫存路徑環境，不傳入完整環境變數。已知密鑰樣式在保存前遮蔽。無法把任意業務文字或個資辨識保證為完全去敏；一般證據保持本機私有，公開前仍需核對內容。

雜湊表示內容一致，不是數位簽章。持有同一 OS／repo 寫入權限的人能重寫計劃與證據；本版不宣稱不可偽造或獨立第三方驗證。

## CI 與部署狀態

`critical-relay.yml` 呼叫相同 runner，測試失敗仍嘗試保存指定 run 證據，保留失敗結論。CI 未執行就標 CI_NOT_RUN，本機通過不能改寫為 CI 成功。本次修改不觸發新的 Actions、不推送、不發行或部署。

新模組尚未安裝到現正運作的 DevSpace 程序。套件檔案清單、舊 runtime 升級、實際 Host 載入來源與 portable import graph 必須在部署前另驗；來源 worktree 通過不等於現有桌面／MCP 已生效。

## 已知後續工作

下一版優先處理：驗證計劃的明確遷移、異常斷電後 runner.lock 的受控恢復、portable 模組依賴與實機升級、Linux 交叉驗證，以及 Java 8／Maven／UI／API adapter。先驗證這些能力，再擴大支援範圍。
