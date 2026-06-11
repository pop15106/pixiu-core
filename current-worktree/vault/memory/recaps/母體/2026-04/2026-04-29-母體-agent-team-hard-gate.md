---
type: session-recap
date: 2026-04-29
project: PIXIUCORE
system: PIXIUCORE
repo: pixiu-core
topic: agent-team-hard-gate
status: done
tags: [recap, session, pixiucore, agent-team]
summary: 收斂 Agent Team 前置判斷硬閘門規則，寫入 user_rules 作為全域治理邊界。
---

# Session Recap：Agent Team 前置判斷硬閘門

## 🎯 任務目標與背景

使用者詢問 Codex 是否具備 agent team 功能，並進一步確認是否能預設開啟。討論後確認不採「無條件預設開啟」，避免 token 成本、延遲與多 agent 協作衝突風險；改採「每次需求正式提出方案或執行前，先判斷是否建議啟用 agent team，由使用者決定是否開啟」的治理規則。

影響範圍為 PixiuCore 全域規範：%PIXIU_CORE%\user_rules.md。此規則會影響後續接線至母體的 AI 在需求處理前的協作模式判斷。

## ✅ 本次完成

1. 說明 Codex 具備類似 agent team / sub-agent 的能力，可分成 explorer、worker 與主 agent 整合。
2. 說明不建議無條件預設開啟的原因：token 成本增加、延遲可能變長、協作衝突風險提高、小任務不划算。
3. 使用者決策採用「方案 1.5」：放入硬閘門，但內容保持短句，強制每次需求前先做 agent team 判斷。
4. 已寫入 %PIXIU_CORE%\user_rules.md，新增規則：每次需求在提出方案或執行前，必須先判斷是否建議啟用 agent team，說明原因，並等待使用者決定；不得自動啟用。
5. 寫入後已用 Select-String 驗證該規則位於 user_rules.md 第 38 行附近。

## 🔄 進行中

目前步驟：本次 recap 寫回母體，將決策與脈絡保存到 vault，供下次 session 接續。

整體進度：1 / 1 Phase 完成。

各 Phase 狀態：
- Phase 1 Agent Team 前置判斷規則討論與寫入：✅完成
- Phase 2 Recap 與 decision 記錄：✅完成

卡點：無。

## 📐 當前規劃完整內容

後續每個新需求的標準起手式：

1. 先聲明已連結 Pixiu 母艦核心。
2. 先做 Agent Team 判斷：
   - 建議開啟：跨模組 bug、影響範圍分析、大型重構評估、前後端並行調查、CI 失敗分析等。
   - 不建議開啟：單純問答、小修、單檔查詢、單一路徑文件寫入。
3. 說明建議開或不開的原因。
4. 等待使用者決定是否啟用，不得自動啟用。
5. 若使用者要求啟用，才依任務拆分 explorer / worker / 主 agent 整合。

新增到 user_rules.md 的核心規則：

`markdown
- **Agent Team 前置判斷 [HARD]**：每次需求在提出方案或執行前，必須先判斷是否建議啟用 agent team，說明原因，並等待使用者決定；不得自動啟用。
`

## 🎯 重要決策（含棄選方案）

| 決策點 | 選擇 | 棄選方案 | 原因 |
|--------|------|---------|------|
| Agent team 是否預設開啟 | 不自動開啟；每次需求前先判斷並請使用者決定 | 無條件預設開啟 | 無條件開啟會增加 token、延遲與協作衝突風險，小任務不划算 |
| 規則寫入位置 | 寫入 user_rules.md 硬閘門區 | 放在 AI 行為約束區 | 使用者擔心放在行為約束區有時會漏問；硬閘門可提高遵守率 |
| 規則文字長度 | 採短句硬閘門 | 長篇流程規範 | 避免每次回覆過度膨脹，保留可執行性 |

## ⚠️ 發現的問題 / 踩坑

- 若放在一般行為約束，模型在上下文壓力高或任務急迫時可能漏問；因此提升為硬閘門。
- Agent team 不是越多越好，應像翻修時先判斷工程規模，再決定是否派多工班進場，否則會增加管理成本。

## 📌 下次 session 要做的事

- [ ] 後續每次需求回覆前，先輸出 Agent Team 判斷與原因。
- [ ] 若任務適合啟用 agent team，等待使用者明確同意後再分派 sub-agent。
- [ ] 若未來覺得每次判斷太冗，可再討論是否改成「中大型任務才強制詢問」。

## 💾 關鍵狀態

- 專案：PixiuCore
- 分支：未檢查，本次直接依使用者授權修改母體檔案
- 改動檔案：%PIXIU_CORE%\user_rules.md、本 recap、decision 檔、memory-summary.md
- 尚未 commit 的變更：未檢查