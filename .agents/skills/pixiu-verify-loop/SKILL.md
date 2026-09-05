---
name: pixiu-verify-loop
description: Pixiu 自我驗證：依本次授權分為唯讀審核、已授權修復與 FULL_AUTOMATIC_HANDOFF。適用於驗證、跑驗證、跑看看、收尾、收斂、產 PR、端對端測試；/go 由 commands/go.md 載入。
origin: Pixiu
version: 0.2.1
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

### 唯讀審核、已授權修復與完整自動接力

| 模式 | 可執行範圍 | 發現失敗時 |
|---|---|---|
| 唯讀審核 | 讀檔、差異審查、無外部副作用的驗證；不自動寫檔、改碼、派工或產生 PR | 回報證據與修正建議 |
| 已授權修復 | 使用者本次明確核准的檔案、修正與回歸測試 | 在核准範圍內最小修復並重驗；超出授權才詢問 |
| 完整自動接力 | 依目前專案已核准的 Task Contract | 依下節恢復、重驗與停止規則處理 |

只提到某模式、Router 命中、文章引用或歷史紀錄，不構成啟動或寫入授權。停止、暫停與取消要求依目前任務合約處理，不啟動新任務。既有授權範圍內不重複要求同意。本文「一般模式等待修復授權」僅指尚未取得修復授權的情境；已核准修復依上表執行。覆蓋率與驗證工具依專案現況、變更風險及驗收條件選擇，不因語言範例套用固定框架或額外安裝。

- 使用者已說「直接修」時，同一項修復沿用這次授權；新依賴、DB 寫入、刪檔、部署與 Git push 仍各自核對授權。
- 工具能力不足時，如實標示未套用或未執行。隔離副本通過測試只代表副本結果，正式環境狀態仍待驗證。

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

先讀取專案既有測試與腳本，確認輸入、輸出及副作用，再依**技術棧**選擇驗證路徑。下表是候選方式，不是直接執行授權。優先採隔離測試與既有唯讀健康檢查；使用中的服務、通知、排程與資料庫保持原狀，除非本次明確授權該項操作：

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

**紅燈處理**：任一 criteria 失敗都必須先輸出「紅燈報告」，包含失敗項目、錯誤訊息、可證明的原因與修復路徑。唯讀審核回報問題；已授權修復在範圍內修正並重驗；`FULL_AUTOMATIC_HANDOFF` 模式只要仍有安全、已授權且可證明的 remediation path，就立即進 self-healing，不得因 RED 或重試次數停止。

---

### 步驟 2｜當前會話自我覆核

步驟 1 完成後，由當前會話重新讀取變更、檢查完整 diff、檢視錯誤及邊界案例，再重跑受影響測試。唯讀審核只回報發現，不進入自動修正或 PR 流程；已授權修復在允許範圍內修正後重驗。

只有使用者本次明確同意派遣 Agent、允許該次改碼，且宿主提供對應能力時，才使用 `/simplify`。其他情境以當前會話的 diff review / equivalent gate 完成，保留相同驗收條件。

任何模式未取得 Agent/subagent/model reviewer 授權時，均由目前會話重新讀檔、檢查 diff 與重跑可重現測試；不得自行派工，也不得因沒有 Agent 而中止已授權修復或接力。記錄替代驗證證據。

**Pixiu 補強**：
- 報告交付到使用者指定位置；只有已授權保存報告時，才寫入 `vault/memory/simplify-<taskId>.md` 或專案既有報告目錄。
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
| 步驟 1 紅燈（一般模式） | 唯讀審核回報證據；已授權修復在範圍內修正並重驗 |
| 步驟 1 紅燈（`FULL_AUTOMATIC_HANDOFF`） | 保存證據 → diagnose → remediate → retry；有安全下一步就不得停 |
| 步驟 2 改動 > 30% | 一般模式退回手動審核；完整自動接力則先縮小變更或 rollback candidate，再以最小修復重跑 |
| 步驟 3 無法產 diff（非 git repo） | 只輸出摘要，不建分支 |
| 過程中觸發母體寫入 | 核對本次母體路徑與操作授權，已授權項目可繼續；未授權路徑先停、呼叫「絕對用戶審批閘門」；`FULL_AUTOMATIC_HANDOFF` 已由當前使用者明確授權且 Task Contract 明列該母體 owned path/action 時，依 contract 繼續，不重複停等 |

---

## 與其他 Skill 的互動

- **與 `claude-code-auto-mode-policy` 配合**：`FULL_AUTOMATIC_HANDOFF` 與 Claude Auto mode 是不同模式。Auto mode 只管理 UI 自動放行；完整自動接力的 RED/continue/stop 語義由 Task Contract 與 handoff contract 決定。兩種模式都不得省略失敗證據。
- **被 `pixiu-session-recap` 呼叫**：Recap 偵測到階段結束時自動觸發本 Skill 作為收斂。
- **與 `opus-behavior-core` L3 行動層**：對應「事後驗證」規則的實作層。

---

## 與 Pixiu 憲法銜接

- **L0 絕對用戶審批閘門**：一般模式依本次明確授權執行，超出範圍另行審批；`FULL_AUTOMATIC_HANDOFF` 僅使用使用者已明確授權的 Task Contract 預授權範圍。
- **禁止預先實作**：唯讀審核 RED 後先等修復授權，已授權修復在範圍內繼續；完整自動接力已授權的 recoverable failure 直接最小修復與重驗。
- **真正 hard blocker**：production/release/new secret/destructive external action/未授權 scope/無安全恢復路徑仍必停。
- **最小改動原則**：`/simplify` 或 remediation 變更過大時先縮小 candidate，不把「過大」本身當一般停止理由。
- **可見推理一律中文**：三步驟所有輸出皆繁中

---

## 審計記錄

每次完整跑完交付以下審計資料；只有本次已授權落檔時才寫入 `vault/memory/verify-loop.log`，唯讀模式在回覆呈現：
```
[時間]｜taskId｜技術棧｜步驟1結果｜步驟2改動行數｜PR狀態｜總耗時
```

---

## 版本與來源
- v0.2.1｜2026-09-05
  - 一般模式分為唯讀審核與已授權修復；所有模式預設使用當前會話自我覆核。
  - 分開標示隔離副本測試與使用中環境驗證；保留服務、通知、排程和資料庫邊界。
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
