---
type: governance
date: 2026-08-09
lastVerified: 2026-08-09
project: PIXIUCORE
system: PIXIUCORE
topic: agent-team-mode-policy
status: active
tags: [pixiucore, governance, agent-team, multi-agent, model-routing, cross-ai]
summary: 跨 Claude、Codex、Gemini 的 Agent Team 啟動閘門、三種成本品質模式、模型能力映射、派工與驗收規則。
---

# Agent Team 模式政策

> 本檔是跨 AI 的單一真源。各 AI 保留自己的原生 subagent／agent／thread 能力，但必須共用相同的啟動語意、模式選擇、權限邊界與驗收規則。

## 1. 啟動閘門

1. 使用者只說「啟動 agent team」「開 agent」「多 agent」「平行處理」或等效語句，且尚未指定模式時，**不得立即派工**；只問一次：
   - `1. 平衡模式（推薦）`
   - `2. 省錢模式`
   - `3. 品質優先模式`
   - 使用者也可直接描述自訂模式。
   - 提醒使用者優先回覆完整模式名稱；只回數字時，僅在目前對話仍保留等待狀態的環境中接受。
2. 使用者回答模式後，該回答視為**目前任務、目前 session 的派工授權**。先顯示派工表，再依該模式啟動。
3. 使用者在同一句已指定模式（例如「啟動 agent team，省錢模式」），可直接顯示派工表並啟動，不重複詢問。
4. 「評估是否需要 agent team」「你建議開嗎」只代表諮詢，不是派工授權。
5. 沒有明確任務目標時先問任務；任務清楚後再問模式。授權不跨任務沿用。
6. 刪檔、DB schema、套件安裝、母體寫入、外部推送等高風險動作，仍各自受 L0 審批閘門約束；選擇模式不等於授權這些動作。

## 2. 三種共用模式

模型名稱會改版，因此制度本體以 `model-dispatch-rules.md` 的高／中／低能力階層描述；各 AI 執行時才映射到已確認可用的型號與 effort。

| 模式 | 主 Agent | 一般 subagent | 機械／高量工作 | 審查與驗收 | 同時執行上限 |
|---|---|---|---|---|---:|
| **平衡（推薦）** | 高階，`high` | 中階，`medium` | 低階，`medium`；封閉難題可提高 effort | 中高階，`high`，fresh context | 3 個 subagent |
| **省錢** | 中階，`high` | 低階，`medium` | 低階，`low/medium` | 中階，`high`；失敗才升級 | 2 個 subagent |
| **品質優先** | 高階，`xhigh`；最難才 `max` | 高階或中階，`high` | 中階，`medium/high` | 高階，`high/xhigh`，fresh context | 3 個 subagent |

共同原則：使用「能達標的最低階設定」。`max` 不是預設值，只用於品質優先且確實需要更多探索與驗證的單一難題。

## 3. Codex／OpenAI 對照

下表是 2026-08-09 驗證的 Codex／OpenAI adapter。只有當目前環境實際提供該模型與 effort 時才能套用；不可用時依第 5 節降級。

| 工作 | 平衡模式 | 省錢模式 | 品質優先模式 |
|---|---|---|---|
| 主 Agent／架構整合 | Sol `high` | Terra `high` | Sol `xhigh`；必要時 `max` |
| Repo 探索／大量讀取 | Terra `medium` | Luna `medium` | Terra `high` |
| UI／截圖／視覺判斷 | Sol `medium` | Terra `medium` | Sol `high` |
| 邊界清楚的實作 | Terra `high`；重複工作可 Luna `max` | Luna `medium/max` | Sol `high` 或 Terra `high` |
| 測試、Log、格式轉換 | Luna `medium` | Luna `low/medium` | Terra `medium` |
| 安全／DB／Code Review | Terra `high` | Terra `high` | Sol `high/xhigh` |
| 獨立驗收 | Terra `high` | Terra `medium/high` | Sol `high` |

`Terra max` 只作代表性任務的 A/B 測試候選，不固定排在 `Sol xhigh` 與 `Sol high` 之間。

## 4. Claude、Gemini 與其他 AI 對照

1. 派工前先從目前 UI、CLI、設定或官方文件確認可用模型與 effort；不得憑記憶填型號。
2. 將當下可用模型映射為：高階＝複雜判斷；中階＝日常工作馬；低階＝快速、明確、高量工作。
3. Codex 額外載入 `skills/pixiu-agent-router/SKILL.md`，把 Pixiu 角色映射到當下可用的內建／自訂 subagent。
4. Claude 使用原生 subagent／agent 能力；Gemini 或其他工具若無 subagent 能力，依 `model-dispatch-rules.md` 第 7 節退化為單體分段模式，不宣稱已啟動 Agent Team。
5. 個別環境沒有 effort 參數時，只切模型階層，不模擬不存在的參數。
6. Claude、Gemini 與其他平台的實際型號與價格只維護在 `model-dispatch-rules.md` 或供應商專屬設定，不在本檔複製易過時清單。

## 5. 可用性與降級

1. 先驗證目前環境可選的 model、effort、最大並行數與工具權限。
2. 指定模型不可用時，改用**同能力階層**的已確認模型；找不到同階才降一階並在派工表標示。
3. Codex 中 Luna 不可用時：機械型工作改 Terra `medium`；UI 工作仍優先 Sol `medium`，若 Sol 不可用再用 Terra `high`。
4. `max` 不可用時回退 `xhigh`；`xhigh` 不可用時回退 `high`。
5. 不得因降級而省略安全審查、fresh-context 驗收或使用者指定的驗收條件。

## 6. 團隊組成與寫入邊界

1. 通常選 2–4 個 Pixiu 角色；主 Agent 之外同時最多 3 個真正 subagent，除非使用者另行授權。
2. 優先平行化唯讀探索、文件查證、測試、Log 分析與獨立審查。
3. 寫入型 worker 的檔案／模組白名單必須互斥；兩個 worker 不得同時修改同一檔案。
4. Planner、架構決策與最終整合留在主 Agent；不要把主線阻塞點外包後原地等待。
5. 每個 subagent 只收到精簡任務包：目標與動機、允許路徑、禁止事項、必要來源、驗收條件、回報格式。
6. Writer 不驗自己的成果；驗收者只拿驗收條件與產出路徑，使用 fresh context read-back／實跑。
7. 子 Agent 不得重讀完整母體、回寫母體、刪檔、安裝套件或擴張白名單，除非主 Agent 已取得該動作的明確授權。

## 7. 啟動前派工表

真正派工前先顯示下列最小資訊，不需要再次等待確認（模式回答已構成派工授權）：

```text
Agent Team：<平衡／省錢／品質優先／自訂>
- 主 Agent：<模型／effort>｜責任：<決策與整合>
- <角色>：<模型／effort>｜範圍：<路徑／模組>｜寫入：<是／否>
- <角色>：<模型／effort>｜範圍：<路徑／模組>｜寫入：<是／否>
驗收：<fresh-context 角色>｜<可驗證條件>
降級／未確認：<沒有則省略>
```

如果派工表暴露新的高風險操作或路徑衝突，停止派工並回到對應審批閘門。

## 8. 升降級與停止條件

1. 低階同一子任務錯一次，帶錯誤輸出升中階，不在低階重試。
2. 中階同一子任務連錯兩次，帶完整失敗軌跡升高階。
3. 高階找出可重複模式後，降回中／低階執行批次工作。
4. 同一方向最多兩輪；仍失敗就停止，向使用者回報方向或前提可能錯誤。
5. 發現任務不可獨立並行、寫入邊界重疊或協調成本高於收益時，縮減 Agent 數或退回單體模式並說明原因。

## 9. 回報合約

- 主對話只保留結論、決策、風險、驗收證據與下一步。
- Subagent 回報上限 30 行；長產物落檔，只回路徑與三行內摘要。
- 狀態只能是：`完成`、`部分完成`、`失敗`，並逐條標示驗收條件。
- 不得以「已派 Agent」代替成果；只有通過獨立驗收才能宣稱完成。

## 10. 觸發驗收案例

| 使用者語句 | 預期行為 |
|---|---|
| 「啟動 agent team」 | 問三種模式，不派工 |
| 「啟動 agent team，平衡模式」 | 顯示派工表後啟動 |
| 「省錢模式」且上一回合正在等模式 | 視為本任務授權，顯示派工表後啟動 |
| 「你建議要開 agent team 嗎？」 | 只分析利弊，不派工 |
| 「用 agent team」但沒有任務內容 | 先問任務，不派工 |

## 本檔維護

- 三種模式的語意與審批流程屬制度本體，修改前先取得使用者同意。
- 本檔不記價格；第 3 節平台 adapter 的型號與 effort 每次使用前仍須驗證，失效時連同 `lastVerified` 一起更新。
- 新增 AI 平台時只補能力階層映射，不複製整份政策。
