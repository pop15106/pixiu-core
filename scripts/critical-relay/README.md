# CR 本機證據驗證入口

此版本為 `pixiu.cr-execution.v2`，使用既有 Critical Relay／DevSpace workflow，不增加常駐服務、排程或 Agent。舊 `general` 研究紀錄保留相容；新完整交付任務需固定計劃並回讀原始測試證據。舊 runtime 只支援 v1 時必須拒絕 v2，先升級再使用。

## 本次支援範圍

`public-core.plan.json` 第 5 版固定十八組必要驗證，涵蓋原有 CR、路由、workflow、lazy-loading、私人資源隔離、測試執行器、證據閘門及交接正反例。母體使用 Node.js 22；沒有更動系統 JDK 或 Java 專案。

目前 adapter 只執行 Node `node:test`。UI、API、build、document 可作驗收所需種類，但尚無對應的自動收集 adapter，缺少該證據就阻擋完成。此工具不會以 build 或核心測試假冒產品 UI／API 驗收。

## 全生命週期 CR：研究→設計→開發→驗證

本版將研究、方案評估、程式開發與既有 CR Verification 連在同一份 state。來源在 `scripts/critical-relay/lifecycle.js`，可由 Router 載入 `skills/critical-relay-lifecycle/SKILL.md` 與 `.agent/workflows/cr-lifecycle.md`。

新任務採 `pixiu.cr-lifecycle.v1` 並固定政策 binding，舊任務不被強制升版：

```text
node scripts/critical-relay/relay-evidence.js init-lifecycle scripts/critical-relay/public-core.plan.json development standard
node scripts/critical-relay/lifecycle-cli.js status
node scripts/critical-relay/lifecycle-cli.js record .cr/research-event.json
node scripts/critical-relay/lifecycle-cli.js advance
node scripts/critical-relay/lifecycle-cli.js reopen .cr/new-evidence.json
```

`record` 只保存具 method/result 和現存主張／證據／反證 ID 的事件；`advance` 在當前階段必備紀錄完整時才會前進，`reopen` 保留舊輪但使過去的完成標記與測試 checkpoint 失效。深度 Quick／Standard（預設）／Deep 由實際風險選擇，高風險不得降級；Deep 需要兩個不同來源位置。

已使用 DevSpace Workflow Ledger 的任務沿用該 ledger，透過 `createEvidenceState(root, planPath, { lifecycleOptions:{ taskType:'development', depth:'standard', riskSignals:[] }})` 建立附加狀態，不執行 fallback init。標準版與家用 schema-3 相容橋接均固定 lifecycleBinding，不能移除、降級或藉修改 metadata 宣告完成。

純研究任務用 `taskType=research`，只需研究及來源證據驗收；不得冒稱做了程式或 UI/API 實測。Ledger、CLI 與心跳均不授權 Agent、背景推播、網頁或 Git push；研究與開發須由當前明確授權的執行者實際操作。雜湊不是外部第三方簽章。

## 長任務心跳與輪詢（Git-only 維護）

新啟動的 CR runner 每 **15 秒**更新 `.cr/runs/<runId>/status.json`，讓單組測試沒有任何輸出時仍能觀測心跳。輪詢端預設 **10 秒**讀一次；最後心跳超過 **45 秒**則回傳 `HEARTBEAT_STALE`，只表示本輪無法證實仍在執行，**不得自動推斷測試失敗或成功，也不得刪鎖或重啟另一輪**。

```text
node scripts/critical-relay/status-watch.js status
node scripts/critical-relay/status-watch.js watch
node scripts/critical-relay/status-watch.js task
```

- `status` 只查一次最新執行狀態，或指定真實的 UUID runId。
- `watch` 預設每 10 秒讀取同一個 run；顯示命令、完成組數、journal 事件數和最近心跳時間，遇到終態或 stale 結束。最大輪詢次數由程式限制。
- `task` 查既有 `.cr/state.json` 研究／設計／開發階段的**上次 checkpoint**，不宣稱目前 Agent 仍在線。
- `TESTS_PASS_GATE_NOT_CONFIRMED` 代表 runner 的 `result.json` 已報測試結束，但仍須既有 evidence verifier／CR completion gate 和 RECHALLENGE。
- `latest-run.json` 與 heartbeat 只提供查詢，不增加第二份帳本或任何 Agent、排程／背景 ChatGPT 推播權限。連線完全失效時，ChatGPT 無法自行推送進度。

新狀態只對安裝新版後**重新啟動的 run** 生效；舊 run 不會補寫虛構心跳。兩台現有 DevSpace **不因原始碼推送而自動升級**，需要另行做安裝與服務載入驗收。心跳及狀態文件保存在忽略版本控管的 `.cr/`，不得將個別任務或憑證同步到 GitHub。

## 單純執行公共核心測試

在已確認的 checkout 執行：

```text
node scripts/critical-relay/test-runner.js
```

入口依事前計劃逐組執行，輸出 JSON 進度及最後的 runId、resultPath、planDigest、來源指紋。`PASS` 表示必要命令執行成功，不表示使用者需求、反證覆核、推送、CI、產品功能或部署已完成。

exit code：0 為必要命令及證據回讀通過；1 為測試失敗、零筆、取消、逾時、來源變更或證據回讀未通過；2 為入口或環境錯誤。各命令的真實 exit code、signal、outcome、leaf-case 統計均保留在結果中。獨立命令繼續收集；依賴失敗命令的項目標為 NOT_RUN。

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

每輪在 `.cr/runs/<runId>/` 保存執行前 plan.json、result.json、逐命令 stdout.jsonl、stderr.log 與 progress.json。完整事件逐行寫入並 fsync，再保存位元組位置及事件數；命令尚未完成就能回讀已落盤事件。截斷尾端不拼成完整行，沒有完整終態仍不得成功。

runner.lock v2 保存工作區、主機、使用者、PID、程序建立時間及子程序身分。受控恢復先證實主控與已記錄子程序都不存活，再歸檔原鎖與結果並標示 INTERRUPTED。活 PID（包含已被重用的 PID）、身分未知或尚未確認的子程序啟動窗口一律阻擋，不自動殺程序，也不按鎖齡刪鎖。

測試結果使用 Node 官方事件。檔案層空測試結果不計為案例；suite 容器不重複計數。正常 stdout 只當成 log，不能靠印出 PASS 或 JSON 冒充案例。正式完成時，重新解析原始事件、核對 counts、檔案 digest、runId、計劃、runtime 與目前來源。

來源採 Git tracked 加未忽略的 untracked 檔案，對路徑及工作區原始 bytes 計算指紋；唯一額外排除區是 `.cr/`。新增、刪除與修改都影響指紋。提交後 HEAD 改變也須重跑。Windows 與 Linux 換行及 runtime 不同時需要各自驗證，不能互換證據。

Git 子模組以 gitlink commit 與初始化狀態納入來源指紋。未初始化且沒有內容的模組不自動下載，也不宣稱其功能已驗證；必要命令依賴它時仍標 ENV_BLOCKED。已初始化模組需 HEAD 與 index 指標一致且沒有未提交修改。未初始化卻有不明內容時拒絕。

只讀授權根目錄中的證據，拒絕路徑穿越、絕對資源路徑及 symlink／junction。工作目錄本身由已授權入口提供；這不構成作業系統沙盒。測試程式仍以目前 OS 帳號權限執行。

子程序只接收受控的工具／暫存路徑環境，不傳入完整環境變數。已知密鑰樣式在保存前遮蔽。無法把任意業務文字或個資辨識保證為完全去敏；一般證據保持本機私有，公開前仍需核對內容。

雜湊表示內容一致，不是數位簽章。持有同一 OS／repo 寫入權限的人能重寫計劃與證據；本版不宣稱不可偽造或獨立第三方驗證。

## CI 與部署狀態

`critical-relay.yml` 呼叫相同 runner，測試失敗仍嘗試保存指定 run 證據，保留失敗結論。CI 未執行就標 CI_NOT_RUN，本機通過不能改寫為 CI 成功。runner 本身不執行 push、Release 或 Deploy；push 依儲存庫既有設定觸發 CI，結果以精確 SHA 的 run 回讀為準。

`scripts/devspace-portable/workflow-bundle.mjs` 組裝明確的依賴清單並保存內容指紋。打包驗證會在乾淨目錄真正 import；安裝器先驗證完整包，再切換單一入口，舊入口與 receipt 保留以供回復。`verify-portable-package.ps1 -IntegrityOnly` 僅供首次 bootstrap 前檢；Node 安裝完成後仍須做真正的 runtime 驗證。

套件的 Node 版本、v2 schema、實際載入路徑、來源 HEAD、來源是否未提交及內容指紋由 probe 回讀。這次只在暫存目錄做升級與回復，不重啟現正運作的 DevSpace。

## 明確恢復與計劃遷移

程序已終止且取得本次恢復授權時：

```text
node scripts/critical-relay/run-recovery.js recover <runId> --authorized
```

恢復只保留／標記原執行，不把部分結果轉成成功；之後以原計劃建立新 run 並完整重跑。目前不自動沿用部分完成的命令。遇到活子程序或無法確認的啟動窗口，先查明實際程序，不以 force 方式清鎖。

必要測試計劃需合法升版時，用新 revision、parentDigest、修改原因、授權定位與前後完整 digest 建立 approval.json，再執行：

```text
node scripts/critical-relay/plan-migration.js migrate .cr/approval.json --authorized
```

approval 必須含 newPlanPath、expectedOldDigest、expectedNewDigest、reason、approvalRef。移除必要命令或降低證據種類需另逐項列入 approvedRequiredRemovals／approvedEvidenceReductions；即使明確允許移除，舊的未解失敗也不會自動消失。只增加測試不需要這兩個移除清單。

fallback 先保存前後 snapshot 與交易 marker，再更新 binding 和 state；中途停止時 gate 保持阻擋。核對並授權後可恢復同一交易：

```text
node scripts/critical-relay/plan-migration.js resume <migrationId> --authorized
```

使用既有 workflow ledger 時，以 `migrate_verification` action 與 verificationMigration 物件執行相同驗證，沿用原 revision／idempotency 控制；不再建立另一套 fallback。新計劃會使舊驗收狀態失效，必須重測並重新覆核。

## 輔助鎖與套件切換恢復

`control.lock` 與 `workflow-install.lock` 使用帶有持有者身分的追加式世代紀錄。檔案存在不代表鎖仍在使用；請依 `auxiliary-lock-guide.md` 的 inspect／recover 操作，不手動刪除鎖或歷史。控制鎖未釋放時，證據 gate 保持阻擋。

套件入口切換使用前後快照與 `workflow-transition.pending.json`。恢復只接續同一交易；遇到第三方修改不覆蓋。建置清理採有界重試，保留主要錯誤與既有 ZIP。操作、相容性、已驗證故障情境與信任邊界詳見 `scripts/critical-relay/auxiliary-lock-guide.md`。

## 已知限制與後續工作

尚未更新 active DevSpace 或重啟服務；實際桌面／MCP 版本生效仍需另外授權與回讀。套件完整性不是數位簽章，不能替代供應鏈信任。

輔助鎖、計劃 binding/state 之間及套件入口切換前後已有程序強制終止測試。ENOSPC／EIO／不支援硬連結與 rename 失敗採故障注入，並非真的把磁碟寫滿或證明所有硬體斷電時序。網路檔案系統、任意非合作寫入者、歷史鏈自動壓縮及全機斷電尚未驗證。資料缺失或不一致保持阻擋，不宣稱任意中斷皆可自動續跑。

下一版仍需完成 Java 8／Maven、UI／API adapter、逐案例需求追溯、多工作區驗證，以及受控實機安裝。
