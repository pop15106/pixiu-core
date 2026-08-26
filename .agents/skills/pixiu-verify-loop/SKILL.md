---
name: pixiu-verify-loop
description: Pixiu 版端對端自我驗證迴圈（仿 Boris /go）。一般模式紅燈先回報並等待修復授權；FULL_AUTOMATIC_HANDOFF 模式則把 RED 視為 recoverable signal，自動修復、重驗並續跑，只有真正 hard blocker 才停。觸發詞：驗證、跑驗證、跑看看、收尾、收斂、產 PR、端對端測試。Slash 入口：/go（見 commands/go.md）。
origin: Pixiu
version: 0.2.0
layer_binding: L3-流程 / L4-技能 / L6-校準
language: zh-TW
---

# Pixiu 自我驗證迴圈（Verify Loop）

> 本 Skill 對應 Boris 的「給 Claude 一個可以驗證自己的方法」核心主張。
> Boris 原話：**「驗證能從 Claude 拿到 2–3 倍產出，4.7 之後更明顯。」**
> Pixiu 版保留一般模式的人工修復閘門；若 `FULL_AUTOMATIC_HANDOFF` 已由使用者明確啟用，則切換為 self-healing 驗證迴圈：RED 不終止流程，先保存證據，再修復、重驗並接續下一 gate。

---

## 觸發條件

任一成立即啟動：
- 使用者輸入「驗證」、「跑驗證」、「跑看看」、「收尾」、「收斂」、「端對端測試」、「產 PR」
- 使用者輸入 `/go`（走 slash command 路徑，由 `commands/go.md` 載入本 skill）
- 任務涉及寫入／編輯／重構，且主要寫入階段已完成
- 長任務（> 30 分鐘或 > 10 個工具呼叫）的收尾
- 被 `pixiu-session-recap` 呼叫作為階段收斂手段

> 備註：`/go` 為真正的 slash command，由 Claude Code CLI 攔截後解析 `commands/go.md`，而非由本 skill 的關鍵字觸發。請勿把 `/go` 當一般文字關鍵字。

## 模式分流

### 一般模式

維持原本 Pixiu 審批規則：RED 先輸出證據與修復方案，等待使用者明確授權後才改碼。

### `FULL_AUTOMATIC_HANDOFF`

當使用者已明確啟用完整自動接力，且目前 Task Contract / handoff / machine state 可驗證時，本 Skill 不得把 RED、Phase 完成或 `CHANGES_REQUIRED` 當停止點：

```text
RED
→ 保存 failure fingerprint / log / environment evidence
→ diagnose
→ 在 Task Contract owned scope 內最小 remediation
→ focused proof
→ 重跑受影響 downstream gates
→ GREEN 後接下一步
```

固定停止結果只有 `DONE`、`HARD_BLOCKED`、`USER_PAUSED`、`USER_CANCELLED`。Session/Watch/lease 中斷必須 checkpoint 後 resume，不得當成任務完成。

`FULL_AUTOMATIC_HANDOFF` 不等於 Claude Code Auto mode；是否啟用 UI Auto mode 由 `claude-code-auto-mode-policy` 另行治理。

---

## 三步驟

### 步驟 1｜端對端測試（E2E Verification）

依**技術棧**自動選擇驗證路徑：

| 棧別 | 驗證工具 | 預設指令 |
|------|---------|---------|
| **後端（Java / Spring Boot）** | 啟動 server → 跑 curl / 整合測試 | `./gradlew bootRun` + `curl -s http://localhost:PORT/health` |
| **後端（Node / Python）** | 同上，改用對應啟動指令 | `npm run dev` / `uvicorn main:app` |
| **前端（React / Vue）** | Claude Chromium Extension + Playwright | `npx playwright test` or 瀏覽器截圖對照 |
| **CLI / Script** | bash 直接跑 + 驗輸出 | `bash scripts/run.sh && echo OK` |
| **桌面 / GUI App** | computer use tool | 開啟 app → 操作關鍵路徑 → 截圖比對 |
| **Database** | 連線跑 read-only 驗證 SQL | `SELECT COUNT(*) FROM ...` |

**驗證目標**必須事先宣告（從任務中萃取）：
```
Criteria（由任務自動萃取，若無則問使用者）：
- 功能 A：呼叫 X 端點回 200 且 body 含 Y
- 功能 B：頁面載入後按下 Z 出現 W
- 效能：p95 回應 < 300ms
- 回歸：既有測試 100% 綠燈
```

**紅燈處理**：任一 criteria 失敗都必須先輸出「紅燈報告」，包含失敗項目、錯誤訊息、可證明的原因與修復路徑。一般模式停在人工修復授權；`FULL_AUTOMATIC_HANDOFF` 模式只要仍有安全、已授權且可證明的 remediation path，就立即進 self-healing，不得因 RED 或重試次數停止。

---

### 步驟 2｜`/simplify` 收斂

步驟 1 全綠後才執行。一般情況可呼叫 Claude Code built-in `/simplify`：
- 會啟動並行 review agents，各自看完整 diff
- 自動修掉有效 issue、過濾 false positive
- 輸出一份「改了什麼」摘要

若 `FULL_AUTOMATIC_HANDOFF` 的 Task Contract 禁止 Agent/subagent/model reviewer，則不得因 `/simplify` 預設會開 Agent 而中止整個接力；改用當前 session 的最小化 diff review / equivalent gate，留下 `NOT_APPLICABLE` 或替代證據後繼續。

**Pixiu 補強**：
- `/simplify` 結束後，寫一份「收斂差異報告」到 `vault/memory/simplify-<taskId>.md`
- 若改動行數 > 原本 30%，退回手動審核（可能過度重構）

---

### 步驟 3｜產 PR 草稿（不自動推）

步驟 2 綠燈後，**產 PR 草稿但不推送**：

```
📦 PR 草稿
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
標題：[type: 一句話]
分支：feature/<taskId>
基底：main（或使用者指定）

摘要：
- 目標：[從任務還原]
- 變更：[主要改動 3–5 條]
- 風險：[潛在影響範圍]

測試結果：
- E2E：[步驟 1 全部 criteria 綠燈]
- 回歸：[既有測試數量 / 通過數]
- 效能：[若有基準，附數據]

遺留事項：
- [需人工確認的 TODO]
- [未涵蓋的邊界情境]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

git push 指令（請手動執行）：
  git push -u origin feature/<taskId>
gh pr create 指令（請手動執行）：
  gh pr create --title "..." --body-file PR_BODY.md
```

**為什麼不自動推**：PR 推到遠端 = 觸發 CI、通知 reviewer、佔 quota，屬「高風險操作」，依 Pixiu 憲法必須停下等明確同意。

---

## 失敗分級與處置

| 情境 | 處置 |
|------|------|
| 步驟 1 紅燈（一般模式） | 停、出紅燈報告、等待修復授權 |
| 步驟 1 紅燈（`FULL_AUTOMATIC_HANDOFF`） | 保存證據 → diagnose → remediate → retry；有安全下一步就不得停 |
| 步驟 2 改動 > 30% | 一般模式退回手動審核；完整自動接力則先縮小變更或 rollback candidate，再以最小修復重跑 |
| 步驟 3 無法產 diff（非 git repo） | 只輸出摘要，不建分支 |
| 過程中觸發母體寫入 | 一般模式或未授權路徑：立即停、呼叫「絕對用戶審批閘門」；`FULL_AUTOMATIC_HANDOFF` 已由當前使用者明確授權且 Task Contract 明列該母體 owned path/action 時，依 contract 繼續，不重複停等 |

---

## 與其他 Skill 的互動

- **與 `claude-code-auto-mode-policy` 配合**：`FULL_AUTOMATIC_HANDOFF` 與 Claude Auto mode 是不同模式。Auto mode 只管理 UI 自動放行；完整自動接力的 RED/continue/stop 語義由 Task Contract 與 handoff contract 決定。兩種模式都不得省略失敗證據。
- **被 `pixiu-session-recap` 呼叫**：Recap 偵測到階段結束時自動觸發本 Skill 作為收斂。
- **與 `opus-behavior-core` L3 行動層**：對應「事後驗證」規則的實作層。

---

## 與 Pixiu 憲法銜接

- **L0 絕對用戶審批閘門**：一般模式維持逐次審批；`FULL_AUTOMATIC_HANDOFF` 僅使用使用者已明確授權的 Task Contract 預授權範圍。
- **禁止預先實作**：一般模式 RED 後先等授權；完整自動接力已授權的 recoverable failure 直接最小修復與重驗。
- **真正 hard blocker**：production/release/new secret/destructive external action/未授權 scope/無安全恢復路徑仍必停。
- **最小改動原則**：`/simplify` 或 remediation 變更過大時先縮小 candidate，不把「過大」本身當一般停止理由。
- **可見推理一律中文**：三步驟所有輸出皆繁中

---

## 審計記錄

每次完整跑完寫入 `vault/memory/verify-loop.log`：
```
[時間]｜taskId｜技術棧｜步驟1結果｜步驟2改動行數｜PR狀態｜總耗時
```

---

## 版本與來源
- v0.2.0｜2026-08-26
  - 新增 `FULL_AUTOMATIC_HANDOFF` 模式分流：RED / `CHANGES_REQUIRED` / Phase 完成都不再是停止條件。
  - Session/lease 中斷改為 checkpoint + resume；只有 `DONE/HARD_BLOCKED/USER_PAUSED/USER_CANCELLED` 可停止。
  - `/simplify` 需要 Agent 但 Task Contract 禁止 Agent 時，改走無 Agent 等價驗證，不中止整個接力。
- v0.1.1｜2026-04-17
  - 移除 `/go` 作為一般關鍵字觸發，改為 slash command 入口（`commands/go.md`）。
  - 釐清 slash command 與自然語關鍵字兩條觸發路徑。
- v0.1.0｜2026-04-17
  - 初版。
- 來源：Boris Cherny `/go` skill 公開分享、Claude Code built-in `/simplify`、Pixiu 七層治理架構 L3+L6。
