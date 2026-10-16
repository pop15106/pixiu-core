# /cr-lifecycle — CR 研究／設計／開發／驗證完整接力

本指令是 workflow 入口，不會直接啟動 Agent、外部瀏覽器或未授權寫入。先載入 `skills/critical-relay/SKILL.md`、`skills/critical-relay-lifecycle/SKILL.md` 與 `.agent/workflows/cr-lifecycle.md`。

在使用者明確要求 CR 研究、CR 設計、CR 開發、CR 全流程、CR 完整自動接力時，從既有 canonical CR state 開始，依照 RESEARCH → DESIGN → DEVELOPMENT → VERIFY → RECHALLENGE 檢查證據。純研究只跑 Research → Verification。

不要把本指令當作 Git push、Release、Deploy、資料庫寫入、Agent Team 或背景推播的授權。

操作差異：開發使用 `init-lifecycle <test-plan.json> development <depth>`；純研究使用 `init-research <research-plan.json> <depth>` 後執行 `sources`。驗證 adapter 與完整計畫範例見 `scripts/critical-relay/adapter-guide.md`。
