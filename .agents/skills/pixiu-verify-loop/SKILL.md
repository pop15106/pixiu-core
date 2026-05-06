---
name: pixiu-verify-loop
description: Pixiu 版端對端自我驗證迴圈（仿 Boris /go）。任務寫入階段完成後強制啟動三步驟：端對端測試 → /simplify 收斂 → 產 PR 草稿。綁 Pixiu L3 流程層 + L6 校準層，任一階段紅燈即停、不自動修。觸發詞：驗證、跑驗證、跑看看、收尾、收斂、產 PR、端對端測試。Slash 入口：/go（見 commands/go.md）。
origin: Pixiu
version: 0.1.1
layer_binding: L3-流程 / L4-技能 / L6-校準
language: zh-TW
---

# Pixiu 自我驗證迴圈（Verify Loop）

> 本 Skill 對應 Boris 的「給 Claude 一個可以驗證自己的方法」核心主張。
> Boris 原話：**「驗證能從 Claude 拿到 2–3 倍產出，4.7 之後更明顯。」**
> Pixiu 版在此基礎上加硬閘門：紅燈不自動修、PR 不自動推、每步寫 audit。

---

## 觸發條件

任一成立即啟動：
- 使用者輸入「驗證」、「跑驗證」、「跑看看」、「收尾」、「收斂」、「端對端測試」、「產 PR」
- 使用者輸入 `/go`（走 slash command 路徑，由 `commands/go.md` 載入本 skill）
- 任務涉及寫入／編輯／重構，且主要寫入階段已完成
- 長任務（> 30 分鐘或 > 10 個工具呼叫）的收尾
- 被 `pixiu-session-recap` 呼叫作為階段收斂手段

> 備註：`/go` 為真正的 slash command，由 Claude Code CLI 攔截後解析 `commands/go.md`，而非由本 skill 的關鍵字觸發。請勿把 `/go` 當一般文字關鍵字。

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

**紅燈處理**：任一 criteria 失敗 → **立即停止**，輸出「紅燈報告」含：失敗項目、錯誤訊息、可能原因（標信心）、修復選項 2–3 個。**不自動改碼**（Pixiu「禁止預先實作」硬閘門優先）。

---

### 步驟 2｜`/simplify` 收斂

步驟 1 全綠後才執行。呼叫 Claude Code built-in `/simplify`：
- 會啟動 3 個並行 review agents，各自看完整 diff
- 自動修掉有效 issue、過濾 false positive
- 輸出一份「改了什麼」摘要

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
| 步驟 1 紅燈 | 停、出紅燈報告、不自動修 |
| 步驟 2 改動 > 30% | 退回手動審核 |
| 步驟 3 無法產 diff（非 git repo） | 只輸出摘要，不建分支 |
| 過程中觸發母體寫入 | 立即停、呼叫「絕對用戶審批閘門」 |

---

## 與其他 Skill 的互動

- **與 `claude-code-auto-mode-policy` 配合**：Auto mode 開啟時，本 Skill 仍須完整跑三步驟，**不得省略紅燈報告與 PR 草稿審核**。
- **被 `pixiu-session-recap` 呼叫**：Recap 偵測到階段結束時自動觸發本 Skill 作為收斂。
- **與 `opus-behavior-core` L3 行動層**：對應「事後驗證」規則的實作層。

---

## 與 Pixiu 憲法銜接

- **L0 絕對用戶審批閘門**：PR 推送、master push、package 異動仍需 yes
- **禁止預先實作**：步驟 1 紅燈不得自動改碼
- **最小改動原則**：`/simplify` 改動 > 30% 退回手動
- **可見推理一律中文**：三步驟所有輸出皆繁中

---

## 審計記錄

每次完整跑完寫入 `vault/memory/verify-loop.log`：
```
[時間]｜taskId｜技術棧｜步驟1結果｜步驟2改動行數｜PR狀態｜總耗時
```

---

## 版本與來源
- v0.1.1｜2026-04-17
  - 移除 `/go` 作為一般關鍵字觸發，改為 slash command 入口（`commands/go.md`）。
  - 釐清 slash command 與自然語關鍵字兩條觸發路徑。
- v0.1.0｜2026-04-17
  - 初版。
- 來源：Boris Cherny `/go` skill 公開分享、Claude Code built-in `/simplify`、Pixiu 七層治理架構 L3+L6。
