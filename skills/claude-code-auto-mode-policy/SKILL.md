---
name: claude-code-auto-mode-policy
description: Pixiu 專用 Claude Code Auto mode 授權政策。管理 Claude UI/CLI 的自動放行，不管理 FULL_AUTOMATIC_HANDOFF 工作流；完整自動接力依 Task Contract 與 handoff contract 決定續跑、修復與停止。觸發詞：auto mode、自動模式、shift-tab、自動放行、跳過確認、不要每次問我。
origin: Pixiu
version: 0.2.0
layer_binding: L0-憲法 / L1-安全 / L3-流程
language: zh-TW
---

# Auto mode 授權政策（Claude Code）

> 本 Skill 不是開啟 Auto mode 的工具，而是「要不要開、開多大、出事怎辦」的政策判斷器。
> 任何 Auto mode 啟用請求**必須**先通過此 Skill 的三步驟評估，**絕不可直接啟用**。

---

## 觸發條件（關鍵字 / 語義）

任一出現即啟動本 Skill：

- `auto mode`、`自動模式`、`開 auto`、`開自動`
- `shift-tab`（搭配 Claude Code 語境）
- `自動放行`、`自動確認`、`跳過確認`、`不用問我`、`不要每次問我`
- `--dangerously-skip-permissions`（殘留用法）
- 任何明確要求 Claude Code UI/CLI 自動核准工具動作的同義請求

### 明確排除：完整自動接力不是 Auto mode

以下語句本身**不得**觸發 Claude Code Auto mode：

- `FULL_AUTOMATIC_HANDOFF`
- 「完整自動接力」
- 「繼續完整自動接力」
- 「恢復完整自動接力」
- 「完整自動模式」（完整接力的既有縮寫）

這些是 handoff / Task Contract 驅動的工作流治理模式。它們可以在 Claude Auto mode 關閉時正常運作。若使用者同時明確要求「完整自動接力 + Claude Auto mode」，才對 Auto mode 部分執行本 Skill。

---

## 步驟 1｜黑名單掃描（Hard Deny）

出現以下任一類別，**強制退回手動模式**，不得啟用 Auto mode：

| 類別 | 具體範例 | 依據 |
|------|---------|------|
| **母體寫入** | `%PIXIU_CORE%\` 下任何檔案（skills / agents / rules / commands / vault / user_rules.md） | 違反「框架變更回寫母體 [HARD]」 |
| **破壞性指令** | `rm -rf`、`drop database`、`drop table`、`migration down`、`git reset --hard`、`git push --force`、`truncate` | 不可逆、違反「高風險操作需確認」 |
| **相依異動** | `npm install`、`pip install`、`gradle` plugin、`cargo add`、`go get` 新增套件 | 供應鏈風險 |
| **秘密類檔** | `.env`、`*.pem`、`*.key`、`credentials.json`、`id_rsa*` | 洩漏風險、違反安全規範 |
| **白名單外路徑** | 使用者未明示授權的目錄 | 違反「白名單變更」 |
| **結構性重構** | 跨 5 檔以上搬移／改命名／改命名空間 | 違反「最小改動原則」 |
| **DB Schema** | CREATE TABLE / ALTER COLUMN 類 | 違反「高風險操作需確認」 |

**偵測到任一類別 → 輸出「本任務不得 Auto mode」＋理由＋手動確認方案**，任務照手動流程走。

---

## 步驟 2｜授權聲明（允許進入時必輸出）

通過黑名單掃描後，**必須**先輸出以下結構化聲明，待使用者點頭才真的啟用：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚦 Auto mode 授權範圍
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
本次任務：[一句話描述]
主模型：[查 vault/governance/model-dispatch-rules.md 第 3 節填當下實際型號]｜分類器：[Claude Code 原生]

允許動作：
  ✅ [編輯 / 建立 / 讀取][限定路徑清單]
  ✅ [bash 指令白名單：ls、cat、grep、test 等]

禁止動作（命中即自動退出 Auto mode）：
  ❌ [列出當次適用的黑名單類別]

失敗回退：
  - 分類器連擋 3 次 → 自動退回手動
  - 分類器累計擋 20 次 → 全面暫停
  - 偵測到黑名單類別 → 立即停止、回報

預估成本：[Token 預估量（含 +35% tokenizer 補償）｜時間]
審計記錄：寫入 vault/memory/auto-mode-audit.log

確認開啟請回「開」，調整請說明。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

使用者回「開」之後才按 Shift+Tab（CLI）或下拉選單切換 Auto mode。

---

## 步驟 3｜審計紀錄

每次進出 Auto mode 都寫入 `%PIXIU_CORE%\vault\memory\auto-mode-audit.log`，格式：

```
[ISO 時間]｜[進入/退出]｜主模型｜任務摘要｜範圍白名單｜結束狀態（完成/中斷/擋住）｜消耗 token
```

此檔為 append-only，供 Codex 事後稽核與 L6 校準層回饋。

---

## 與 Pixiu 憲法銜接

### 優先級
```text
一般模式：L0 絕對用戶審批閘門 ＞ 本 Skill ＞ Claude Code 原生 Auto mode
FULL_AUTOMATIC_HANDOFF：L0 安全邊界 + Task Contract 預授權 ＞ handoff recovery/stop policy ＞ 本 Skill ＞ Claude Code 原生 Auto mode
```

`FULL_AUTOMATIC_HANDOFF` 的預授權只消除 Task Contract 範圍內的重複確認，不會授權 production、release、新 secrets、destructive external action、force push/reset 或未列入 owned scope 的變更。

### 仍須保留的硬閘門（本 Skill 不覆蓋）

| Pixiu 硬閘門 | 一般 Auto mode | `FULL_AUTOMATIC_HANDOFF` 已啟用時 |
|-------------|----------------|------------------------------------|
| 絕對用戶審批閘門 | 破壞性動作、母體寫入停等 yes | Task Contract 內可逆、task-owned、非高風險動作使用既有預授權；高風險仍停 |
| 禁止預先實作 | Debug 找到根因後停等修復授權 | recoverable RED 在 owned scope 內直接最小修復 → 重驗 |
| 框架變更回寫母體 [HARD] | 母體治理變更停等 yes | 只有當前使用者明確授權且 Task Contract 明列母體 owned path 才可繼續 |
| 分階段任務審核門檻 | Phase 完成停等「下一步」 | `PHASE_COMPLETED → CONTINUE_NEXT_ACTION` |
| 計畫優先審查規則 | 計畫未核可前不動工 | 已核可 Task Contract 繼續；scope change 才重新 gate |

**Auto mode 僅控制 Claude Code 原生自動核准；完整自動接力即使退出 Auto mode，也必須依 checkpoint / reconciliation 規則繼續，不能把 Auto mode 退出誤判成工作 blocker。**

---

## 退出條件（任一即退出）

1. 使用者說「關掉 auto」、「回手動」、「暫停」
2. 分類器擋 3 次或累計 20 次（Claude Code 原生行為）
3. 任務完成
4. 偵測到黑名單類別
5. 連續 30 分鐘無進度（疑似卡死）

退出後**必須**輸出 `Auto mode 結束報告`：共處理幾個動作、幾個被擋、最終狀態。

若同時存在 `FULL_AUTOMATIC_HANDOFF`，Auto mode 退出只表示 UI 自動核准關閉；完整自動接力若仍有安全、已授權下一步，必須改用一般工具確認/下一棒 checkpoint-resume，不得因此標記 `HARD_BLOCKED`。

---

## 自我查核（每次啟用前跑）

- [ ] 黑名單七類是否全掃過？
- [ ] 授權聲明是否已輸出並等到「開」？
- [ ] 審計日誌路徑是否存在、可寫？
- [ ] 使用者說的是 Claude Auto mode，還是 `FULL_AUTOMATIC_HANDOFF`？若只有完整自動接力，不啟用本 Skill。
- [ ] 是否觸發其他 Pixiu 硬閘門？若是，本 Skill 讓位；若完整自動接力已啟用，先套用其 Task Contract 預授權與 hard blocker 定義。

---

## 版本與來源
- v0.2.0｜2026-08-26：明確拆分 Claude Auto mode 與 `FULL_AUTOMATIC_HANDOFF`；完整自動接力的 Phase/RED/session 語義改由 Task Contract 與 stop policy 管理，避免 Auto mode policy 誤停接力。
- v0.1.1｜2026-07-05：型號名稱去寫死，改指向 model-dispatch-rules.md 第 3 節（單一真源）。
- v0.1.0｜2026-04-17
- 來源：Anthropic 官方 Auto Mode 文件、Pixiu `user_rules.md` L0 憲法、`opus-behavior-core` L3 行動層。
