---
name: critical-relay-lifecycle
description: CR 全流程 Skill。CR 研究／搜尋／設計／開發／全流程或完整自動接力時，將資源查找、方案取捨、實作與實測證據納入共同的反證迴圈。單純一般研究或開發不強制啟動。
origin: Pixiu
version: 0.1.0
language: zh-TW
---

# CR Lifecycle：研究、設計、開發、驗證一體化

本 Skill **沿用** `skills/critical-relay/SKILL.md` 的 canonical CR state、驗收閘門、授權與單一 Agent 政策。不能另建競爭的 state，也不能當成啟動 Agent、Git push、Release、Deploy 或網路搜尋的權限。

## 路由與啟用

Router 明確命中 `CR 研究`、`CR 搜尋`、`CR 設計`、`CR 開發`、`CR 全流程`、`CR Research/Design/Development/Lifecycle`、`CR 完整自動接力` 或「反證」等意圖，載入本 Skill 和 `.agent/workflows/cr-lifecycle.md`。不使用裸 `CR`，也不從一般「研究」、「開發」、「找資料」臆測要求深度 CR；否定句跳過。

已有 CR 任務沿用同一份 ledger/state，不重建或清除失敗紀錄。新完整交付任務用 `relay-evidence.js init-lifecycle` 或受控 workflow 加入 `lifecycleRequired=true` 與 `lifecycle`；舊任務維持原契約。

## 深度選擇

- **Quick**：明確低風險可逆工作；來源、反向查找、方案理由與必要驗證仍不能跳過。
- **Standard**：一般變更預設；至少比較兩個方案並記錄支持與反對證據。
- **Deep**：Production、資損、DB 寫入、資安、破壞性修改，或多重跨 repo／未知框架風險。須使用兩個不同來源位置交叉查核，並額外做反例。

`scripts/critical-relay/lifecycle.js` 提供 `createLifecycle`、`recordEvent`、`advanceStage`、`reopenLifecycle` 和 `evaluateLifecycle`，風險深度不可任意降低。

## 各階段操作

1. **RESEARCH**：查官方／原始來源，拆分 claim 與 evidence；以 `source_check` 記來源及查法，再以 `countersearch` 實際查詢反方材料（關鍵字、FOUND／NOT_FOUND、方法與結果）。FOUND 時需引用 counterEvidence 與逐項 `reassessment`；找不到不等於證實。
2. **DESIGN**：`options_review` 比較可行方案與維持現況的利弊，`decision` 記錄採用／拒絕理由、evidenceRefs、challengeRefs。高風險、不可逆或權限相關架構取捨仍遵守使用者授權。
3. **DEVELOPMENT**：每單位用 `change_review` 保存改檔及可能破壞情境，`counterexample` 主動測故障與邊界。反證成立回研究／設計修正假設，不降級測試。
4. **VERIFICATION**：`evidence_review` 連結真實執行結果／測試 ID；`rechallenge` 在驗證之後重新挑戰。最後跑現有 CR completion gate 與 v2 真實證據 Gate。
5. **HANDOFF**：交出基準 commit、選項和取捨、支持來源、反證、實際測試、未解風險及下一步。只有明確授權才 commit／push／release／deploy。

研究專用請用 `taskType=research`，只執行 research → verification，不假裝已有開發或 UI／API 實測。若有新反證，`reopenLifecycle` 開下一 cycle，保留舊紀錄；既有 runner 證據在改源後失效。

## 信任與限制

Lifecycle entry 是**查核筆記**，不是外部自動搜尋或執行證明。對 `state.claims/evidence/counterEvidence/challenges/tests` 僅引用真實 ID；在正式 runner 中只接受真實可回讀測試。未知語言及 UI/API 目前沒有自動 Adapter 時標 UNVERIFIED／ENV_BLOCKED，不能宣稱 PASS。

維持**單一 Agent**，不啟用子 Agent、背景模型或 ChatGPT 自動推播。不把同一模型自我覆核稱為獨立審查，也不把雜湊當成外部不可偽造簽章。

操作範本：`.agent/workflows/cr-lifecycle.md`。CLI：`commands/cr-lifecycle.md`。
