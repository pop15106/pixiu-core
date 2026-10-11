# CR 單一 Agent 交付調整與推送前驗證

## 範圍與基準

- 任務：調整通用 CR 完整自動接力，降低無效反覆，驗證後推送。
- Repository：`pop15106/pixiu-core`；遠端目標：`master`。
- 基準／推送前 HEAD：`64669e53f48c2a563cac6c7994889b5b149056ed`。
- 實作分支：`feat/cr-execution-efficiency-20261011`。
- DevSpace 任務：`tsk_2447194dfd6b`，單一對話直接實作與自我覆核，沒有啟動額外 Agent/model。
- 在隔離 worktree 修改；來源 checkout 的既有分支與未提交修改未被覆寫或納入提交。
- 未修改全域模型設定、憑證、Java 版本、專案入口 AGENTS.md、Production、Release 或 Deploy。

## 已驗證的問題與修正

| 編號 | 基準問題 | 修正與驗證 |
| --- | --- | --- |
| F1 | CR 授權內持續修復，Verify Loop 卻要求紅燈立即停且禁止修復 | 改成唯讀／已授權修復／CR 三模式；依本次授權判斷 |
| F2 | Verify Loop 與 /go 預設要求會啟動三個 reviewer 的 /simplify | 單一 Agent 重新讀 diff 依序自我覆核；不冒充獨立審查 |
| F3 | 遠端缺少 `.agents/skills/critical-relay/SKILL.md` | 補齊 Codex 副本，新增來源／發布一致性測試 |
| F4 | 完成閘門沒有工作單位、目前程式版本與實測輸出的交付關聯 | 新增 executionContract；對應 criterion、test、headSha、changeDigest、command、exitCode、outputRef |
| F5 | 第二輪覆核發現未被 unit 引用的必要 test 仍需版本檢查 | 對所有 required test 加上相同證據檢查，補反例測試 |

## 執行行為

短計畫後先完成一個最小端到端工作單位。沿用按需路由，使用既有專案慣例處理可逆細節。每個里程碑保存 evidence、錯誤 fingerprint、已排除假設及 nextAction；相同失敗兩次且無新證據時轉 REASSESS，不原樣重試。

`FULL_AUTOMATIC_RELAY` 實作模式強制要求執行契約。既有 general state 保留相容性；原 CR 的 evidence、counterEvidence、challenge、VERIFY → RECHALLENGE 與高風險閘門維持有效。handoff 深複製與 digest 包含新契約。

已授權 push 在驗證後執行；沒有授權只交付本機變更。Release、Deploy、DB 寫入與額外 Agent 分開檢查。推理強度屬實際 adapter 設定，不將提示詞或 workflow metadata 視為成功切換。

## 驗證結果

以下為本次實際工具輸出的摘要，不是原始完整 log。執行環境為 Windows／Node.js v24.13.0；GitHub Actions 另外使用 Node.js 22。

| 命令 | 通過 | 失敗 | exit code |
| --- | ---: | ---: | ---: |
| `node --test scripts/critical-relay/execution-contract.test.js` | 45 | 0 | 0 |
| `node scripts/critical-relay/critical-relay.test.js` | 19 | 0 | 0 |
| `node scripts/router/resolve-capabilities.test.js` | 21 | 0 | 0 |
| `node scripts/critical-relay/critical-relay.integration.test.js` | 6 | 0 | 0 |
| `node --test scripts/devspace-portable/tests/workflow-store.test.mjs` | 18 | 0 | 0 |
| `git diff --cached --check` | 通過 | 0 | 0 |

CR 相關測試合計 **109／109 通過**。第一次新增測試為 39／40，失敗定位是缺少 CR 發布副本；補齊及擴充反例後為 45／45。基準既有 64 項在修改前與修改後都通過。

反例包含：缺失／null／錯型契約、刪除 required 旗標、隱含多 Agent、多個進行中工作、未覆蓋條件、缺失測試、假 passed、無命令／exit code／可追溯輸出、舊 SHA、舊內容指紋、未解決失敗、缺少換路紀錄、handoff 竄改、既有未解反證與缺少 RECHALLENGE。

## 額外檢查的既有限制

`node scripts/performance/lazy-loading-integration.test.js` 的前兩個測試通過，第三個測試因缺少 `vault/identity/founder-profile.md` 拋出 ENOENT，exit code 1，後續未執行。

已用 `git ls-tree --name-only HEAD -- vault/identity/founder-profile.md` 確認基準沒有該檔；`git diff HEAD -- scripts/performance/lazy-loading-integration.test.js` 為空。本次不修改該測試、不補造私人資料，也不將它標成通過。這不是本次 109 項 CR 驗收測試或既有 CR CI 的執行步驟；不宣稱整個 repository 的所有測試全綠。

## 證據版本與重現

本次 code／policy 變更內容指紋：

`bae4d41befbecd085fc1088adcd325fa2caa9ffa7aa6736ddcd567a7bd8fa35e`

演算法：以下相對路徑按字典序排列，依序以 UTF-8 的 `path + NUL`、Git index 中的原始 blob bytes、NUL 更新 SHA-256。涵蓋新增檔案；此報告與 CR state 是事後證據，不納入自身指紋。提交後以同一 commit 的 `git show <commit>:<path>` 原始 bytes 可重算。

```text
.agents/skills/critical-relay/SKILL.md
.agents/skills/pixiu-verify-loop/SKILL.md
.agents/skills/verification-loop/SKILL.md
.github/workflows/critical-relay.yml
commands/go.md
scripts/critical-relay/critical-relay.js
scripts/critical-relay/execution-contract.js
scripts/critical-relay/execution-contract.test.js
skills/critical-relay/SKILL.md
skills/pixiu-verify-loop/SKILL.md
skills/verification-loop/SKILL.md
```

CR state：`docs/validation/cr-execution-20261011-state.json`。

```text
node scripts/critical-relay/critical-relay.js check docs/validation/cr-execution-20261011-state.json
```

state 的 HEAD＋changeDigest 定位本次提交前的受驗收內容；不是冒稱已知道最終 commit SHA。state 與報告均為執行者紀錄，契約檢查不取代真實測試或外部內容核對。

## 發布、生效與未驗證事項

這份報告記錄推送前驗證。推送成功及精確 commit 的 Actions 結果，以遠端 commit／run 的實際回讀為準。

技能來源與 `.agents/skills/` 副本一起納入版本控管；使用這個版本的 PixiuCore 路由或專案本地技能才會讀取新版。原本有未提交修改的 checkout，以及使用者目錄的舊全域技能沒有被覆寫；全域技能衝突仍需在實際使用環境確認來源。

此次沒有進行 Sol／Opus A/B 測試，沒有量測完成速度或模型能力差距，沒有切換 ChatGPT 模型，沒有宣稱學到其他模型的訓練方式。此處的覆核為單一 Agent 的 sequential self-review，不是獨立 reviewer。
