---
description: CR 全流程 Workflow：研究→方案比較→實作→反證→驗證→接力；沿用同一份 Critical Relay state。
---

# CR Lifecycle Workflow

**觸發**：`CR 研究`／`CR 設計`／`CR 開發`／`CR 全流程`，或已授權的 `CR 完整自動接力`。維持單一 Agent，不啟動背景任務、第二份 ledger 或額外 Agent。

## 0. UNDERSTAND — 範圍與風險

核對本次授權、repo / 工作區、branch、Git 基準及必要驗收條件；不覆寫 dirty checkout。依風險選擇 Quick／Standard（預設）／Deep。既有 CR state 只接續不重置。以本機 runner 實際可執行的必要測試建立 evidence plan；缺 Java／UI／API Adapter 時保留未驗證。

若**全新**專案沒有 fallback state：

```text
node scripts/critical-relay/relay-evidence.js init-lifecycle scripts/critical-relay/public-core.plan.json development standard
node scripts/critical-relay/lifecycle-cli.js status
```

若已有 Workflow Ledger，建立任務時用 `createEvidenceState(root, planPath, {lifecycleOptions:{taskType,depth,riskSignals}})` 放入原本 `criticalRelay` 欄位，不執行另一份 fallback init。

## 1. RESEARCH — 對抗搜尋

建立可被推翻的 claim。查官方、原始碼、原文或特定 Repo。寫入 `source_check`（claimRefs、evidenceRefs、method、result），之後做 `countersearch`：查失敗案例、已知限制、替代方案，記查詢關鍵字、FOUND／NOT_FOUND 與原始證據定位；若 FOUND，要加 counterEvidence、逐項 `reassessment`。沒有網路或憑證時標 BLOCKED，不能寫成已搜尋。

## 2. DESIGN — 方案取捨（純研究跳過）

`options_review` 至少比較兩個可行方案（Quick 可最小化），記下利點、成本及不採用理由。 `decision` 要有 evidenceRefs、challengeRefs 及可稽核 rationale，先比較後決策。Production、DB 或不可逆取捨需先確認獨立授權。

## 3. DEVELOPMENT — 可推翻的開發

每最小改動：`change_review` 寫修改範圍、依賴和失敗情境；`counterexample` 注入正常／錯誤／並發／權限邊界並記錄實測。反證成立時回研究或設計重新判斷，失敗不得靠跳過必要測試補救。

## 4. VERIFY → RECHALLENGE

實際執行專案建置、單元／整合／UI／API（僅有可用的原生工具與授權環境時），保存 command、exit code、headSha、changeDigest、案例、原始事件。 `evidence_review` 引用已驗證 testRefs，之後 `rechallenge` 再查反方；僅在正式證據回讀與 CR gate 成功後交付。研究型任務以來源 read-back 驗證，不能冒充產品測試。

## 5. HANDOFF／恢復

保留 canonical CR state、Lifecycle cycle、方案與否決理由、反證、原始測試、未解風險和下一步。新反證用 `reopen` 加入新 cycle；舊證據不可刪，修改 Git 版本後重測。既有任務不新增第二份 ledger。

狀態進度：長時間工作利用 `status-watch.js` 查已啟動 run 的心跳與 checkpoint，**只有對話及工具連線可用時**才能回傳聊天進度。

## 操作入口

```text
node scripts/critical-relay/lifecycle-cli.js status
node scripts/critical-relay/lifecycle-cli.js record .cr/research-event.json
node scripts/critical-relay/lifecycle-cli.js advance
node scripts/critical-relay/lifecycle-cli.js reopen .cr/new-counter-evidence.json
node scripts/critical-relay/critical-relay.js check .cr/state.json
```

`.cr/research-event.json` 由操作者依**真實證據**建立；CLI 不自動搜尋網頁、生成程式碼或執行模型。禁止無授權 push、Release、Deploy、DB 寫入、任意刪鎖、啟動子 Agent 或假造 PASS。

詳細規則：`skills/critical-relay-lifecycle/SKILL.md`；程式：`scripts/critical-relay/lifecycle.js`。
