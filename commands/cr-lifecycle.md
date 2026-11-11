# /cr-lifecycle — CR 研究／設計／開發／驗證完整接力

本指令是 workflow 入口，不會直接啟動 Agent、外部瀏覽器或未授權寫入。先載入 `skills/critical-relay/SKILL.md`、`vault/governance/cr-chat-dev-policy.md`、`skills/critical-relay-lifecycle/SKILL.md` 與 `.agent/workflows/cr-lifecycle.md`。

使用者明確要求開 CR、建立正式 CR、CR 研究、CR 設計、CR 開發、CR 全流程或 CR 完整自動接力時啟用。在 Chat 先建立或續接案件卡；依 Dev 選擇取證與同步，未開 Dev 仍可在對話內進行 CR。正式帳本須先查重，依最新 revision 與合法持有人續接，取得實際 taskId 與狀態後才稱登錄成功。

有工作機及寫入授權後，沿用既有 canonical CR state，依照 RESEARCH → DESIGN → DEVELOPMENT → VERIFY → RECHALLENGE 檢查證據。純研究只跑 Research → Verification；CLI 初始化與帳本同步的成功，均與分析驗收分開確認。

不要把本指令當作 Git push、Release、Deploy、資料庫寫入、Agent Team 或背景推播的授權。

操作差異：開發使用 `init-lifecycle <test-plan.json> development <depth>`；純研究使用 `init-research <research-plan.json> <depth>` 後執行 `sources`。驗證 adapter 與完整計畫範例見 `scripts/critical-relay/adapter-guide.md`。
