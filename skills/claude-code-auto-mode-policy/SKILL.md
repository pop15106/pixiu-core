---
name: claude-code-auto-mode-policy
description: Pixiu 專用 Claude Code Auto mode 授權政策。當使用者提及「auto mode / 自動模式 / shift-tab / 跳過確認 / 自動放行」等關鍵字或語義時強制觸發，評估任務可否進入自動放行，列出強制退回手動的黑名單，並與 Pixiu L0 憲法「絕對用戶審批閘門」銜接。觸發詞：auto mode、自動模式、shift-tab、自動放行、跳過確認、不要每次問我。
origin: Pixiu
version: 0.1.0
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
- 任何語義等同於「讓你自己決定、我不盯」的請求

---

## 步驟 1｜黑名單掃描（Hard Deny）

出現以下任一類別，**強制退回手動模式**，不得啟用 Auto mode：

| 類別 | 具體範例 | 依據 |
|------|---------|------|
| **母體寫入** | `C:\PixiuCore\` 下任何檔案（skills / agents / rules / commands / vault / user_rules.md） | 違反「框架變更回寫母體 [HARD]」 |
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
主模型：[Opus 4.7 / Sonnet 4.6 等]｜分類器：Sonnet 4.6（Claude Code 原生）

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

每次進出 Auto mode 都寫入 `C:\PixiuCore\vault\memory\auto-mode-audit.log`，格式：

```
[ISO 時間]｜[進入/退出]｜主模型｜任務摘要｜範圍白名單｜結束狀態（完成/中斷/擋住）｜消耗 token
```

此檔為 append-only，供 Codex 事後稽核與 L6 校準層回饋。

---

## 與 Pixiu 憲法銜接

### 優先級
```
L0 絕對用戶審批閘門 ＞ 本 Skill ＞ Claude Code 原生 Auto mode
```

### 仍須保留的硬閘門（本 Skill 不覆蓋）

| Pixiu 硬閘門 | 在 Auto mode 下的行為 |
|-------------|---------------------|
| 絕對用戶審批閘門 | 破壞性動作、母體寫入**必停**等 yes |
| 禁止預先實作 | Debug 找到根因**不得**自動改碼 |
| 框架變更回寫母體 [HARD] | 改 `.agent/`、`user_rules.md`、約束規範**必停** |
| 分階段任務審核門檻 | Phase 完成**必停**等「下一步」 |
| 計畫優先審查規則 | 使用者問「怎麼做」時**禁止**動工 |

**Auto mode 僅覆蓋「一般檔案編輯的逐次 yes」這一層**，不是萬用繞道。

---

## 退出條件（任一即退出）

1. 使用者說「關掉 auto」、「回手動」、「暫停」
2. 分類器擋 3 次或累計 20 次（Claude Code 原生行為）
3. 任務完成
4. 偵測到黑名單類別
5. 連續 30 分鐘無進度（疑似卡死）

退出後**必須**輸出 `Auto mode 結束報告`：共處理幾個動作、幾個被擋、最終狀態。

---

## 自我查核（每次啟用前跑）

- [ ] 黑名單七類是否全掃過？
- [ ] 授權聲明是否已輸出並等到「開」？
- [ ] 審計日誌路徑是否存在、可寫？
- [ ] 是否觸發其他 Pixiu 硬閘門？若是，本 Skill 讓位。

---

## 版本與來源
- v0.1.0｜2026-04-17
- 來源：Anthropic 官方 Auto Mode 文件、Pixiu `user_rules.md` L0 憲法、`opus-behavior-core` L3 行動層。
