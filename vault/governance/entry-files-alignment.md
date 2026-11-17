---
type: governance
date: 2026-07-03
project: PIXIUCORE
system: PIXIUCORE
topic: entry-files-alignment
status: active
lastVerified: 2026-11-17
tags: [pixiucore, governance, entry-files, routing, claude, codex, gemini, agents-md]
summary: 跨 AI 入口制度：AGENTS.md 是工具中立的共同入口，各工具入口檔只帶同一段啟動流程與專屬差異；含各工具實際讀取行為、強制力對照、新工具接入步驟與同步檢查清單。
---

# 跨 AI 入口路由制度

## 1. 設計原則（為什麼要這樣做）

1. **單一真源**：規則本體只存在一份。常駐硬閘門在 `vault/bootstrap/SESSION-BOOTSTRAP.md`，制度本體在 `vault/governance/`、`vault/sop/` 與 `vault/context/ai-mothership-loading-policy.md`，L0 憲法是 `user_rules.md`。
2. **`AGENTS.md` 是共同入口**：它不屬於任何一個工具，只寫「定位母體、讀 Bootstrap、執行 Router、按需路由」四步。會讀 `AGENTS.md` 的工具不需要另外寫檔就能接上母體。
3. **工具入口只帶差異**：`CLAUDE.md`、`CODEX.md`、`GEMINI.md` 保留與 `AGENTS.md` 逐字相同的啟動四步，另加該工具的專屬差異。保留啟動四步，是因為這些檔會被工具單獨載入，也會被複製到其他專案，必須能獨立運作；逐字相同由測試強制，不靠人工同步。
4. **規則要進 Bootstrap 才算跨工具**：一般 Session 不讀 `user_rules.md`。要每個工具每次都遵守的規則，必須在 Bootstrap 有一行摘要；只寫在憲法或單一工具入口檔的規則，其他工具看不到。
5. **改本體不改入口**：規則變更只改制度本體或 Bootstrap；入口檔只有在「路由目標變了」才改。每個入口檔上限 **60 行**（測試強制），超過就是有規則長錯地方，要搬回本體。
6. **與既有載入政策的分工**：`vault/context/ai-mothership-loading-policy.md` 管「載入什麼、何時載入」（L1-L6 分層、skills 路由、agent team 閘門），本檔管「入口檔的形狀與同步」。兩檔對入口檔內容描述不一致時，以本檔第 4 節為準。

## 2. 現況盤點（2026-11-17）

### 2.1 入口相關檔案

| 檔案 | 角色 | 內容 |
|---|---|---|
| `AGENTS.md` | 共同入口（工具中立） | 啟動四步、工具差異指引、專案結構 |
| `CLAUDE.md` | Claude 入口 | 啟動四步＋Claude 邊界 |
| `GEMINI.md` | Gemini 入口 | 啟動四步＋Gemini 邊界 |
| `CODEX.md` | Codex 橋接入口 | 啟動四步＋指向 `.codex/AGENTS.md` |
| `.codex/AGENTS.md` | Codex 專屬差異 | Skill discovery、Codex 職責、Hermes 觸發條件 |
| `.codex/hermes-routing.md` | Hermes 指令（按需） | 使用者明確要求用 Hermes 時才由 `.codex/AGENTS.md` 載入 |
| `vault/bootstrap/SESSION-BOOTSTRAP.md` | 常駐硬閘門 | 唯一每次必讀的規則檔 |
| `vault/capabilities/ROUTING.md` | 不能執行指令時的路由索引 | 由 Manifest 產生，勿手改 |
| `scripts/entry-sync/templates/` | 使用者層橋接範本 | `claude`、`codex`、`gemini` 由 entry-sync 安裝；`generic` 供其他工具手動貼入 |

### 2.2 各工具實際讀取行為

2026-11-17 依各工具官方文件查證，未在每個工具內逐一實測；工具改版後要重新查證並更新本表。

| 工具 | 專案層常駐入口 | 使用者層入口 | Skill 位置 | Hook |
|---|---|---|---|---|
| Claude Code | `CLAUDE.md`；有它時預設不讀 `AGENTS.md` | `~/.claude/CLAUDE.md` | `~/.claude/skills` | 有（`settings.json`） |
| Codex | `AGENTS.md`（Git root 到目前目錄） | `~/.codex/AGENTS.md` | `.agents/skills`、`~/.agents/skills` | 有（`hooks.json` bridge） |
| Gemini CLI | `GEMINI.md`；`context.fileName` 可加入 `AGENTS.md` | `~/.gemini/GEMINI.md` | 【未確認】 | 無 |
| ChatGPT | 無；以上傳的 Skill 載入 | 無 | 上傳的 Skill 包 | 無 |
| 其他會讀 `AGENTS.md` 的工具 | `AGENTS.md` | 各工具自訂，見 4.6 | 各工具自訂 | 各工具自訂 |

查證來源：Claude Code `code.claude.com/docs/en/memory`、Codex `developers.openai.com/codex/guides/agents-md` 與 `/codex/concepts/customization`、Gemini CLI `geminicli.com/docs/cli/gemini-md/`、ChatGPT `help.openai.com/en/articles/20001066-skills-in-chatgpt`。

### 2.3 強制力對照

| 閘門 | Claude Code | Codex | Gemini、ChatGPT 與其他工具 |
|---|---|---|---|
| 機密掃描、Auto mode 閘門、變更範圍提醒、母體同步提醒 | Hook 攔截（`scripts/hooks/pixiu-guardrails.js`） | Hook bridge 攔截（`scripts/codex-bridge/`） | 無程式攔截 |
| Bootstrap 其餘硬閘門（審批、最小改動、驗證、先對齊理解等） | 文字規則 | 文字規則 | 文字規則 |

Hook 要在該台機器安裝後才生效（見第 5 節第 6 項）。沒有 Hook 的工具，所有閘門都只靠 Bootstrap 文字約束。

## 3. 衝突處理優先序（所有 AI 一體適用）

以下只比較 Pixiu 專案規則；先滿足執行平台的系統與開發者指令、安全規則及工具權限，再於有效授權範圍內依下列順序處理：

1. 本次使用者明確指令
2. 目前目標專案的 `AGENTS.md`
3. 目前目標專案其他 AI 入口檔
4. PixiuCore `user_rules.md`（L0 硬閘門）
5. `vault/governance/`（本制度）與 `vault/context/ai-mothership-loading-policy.md`
6. vault 其他內容（sop、memory、context）
7. 模型預設行為

**發現入口檔之間互相矛盾時**：不要自行擇一吞掉。做法＝「按上表位階執行位階高者，同時把矛盾寫進 `vault/memory/agent-learning/observations/`（用模板），並在回覆結尾用一行告知使用者」。

## 4. 各入口檔內容規範

### 4.1 啟動四步只有一個版本

以 `AGENTS.md` 的「## 啟動」為準，本檔不另外抄一份。`CLAUDE.md`、`CODEX.md`、`GEMINI.md` 的「## 啟動」必須與它逐字相同。修改時先改 `AGENTS.md`，再原樣貼到另外三檔，最後跑第 5 節第 1 項的測試。

### 4.2 各檔可以放什麼

- `AGENTS.md`：啟動四步、工具差異指引、專案結構。不放任何單一工具專用的指令。
- `CLAUDE.md`：啟動四步＋Claude 邊界（Hook profile、Agent Team 指令、子 Agent 任務包、完成前驗證）。
- `GEMINI.md`：啟動四步＋Gemini 邊界（沒有 Skill 或 Hook 時的運作方式、第一手來源驗證、`SESSION-INDEX.md`）。
- `CODEX.md`：啟動四步＋指向 `.codex/AGENTS.md`。Codex 原生讀的是 `AGENTS.md`；`CODEX.md` 供使用者層橋接與專案複本使用。
- `.codex/AGENTS.md`：Codex 專屬差異。必須提到 Bootstrap 與 Router。

### 4.3 入口檔不可出現的內容

- 要求 Session 啟動時讀 `memory-summary.md`、identity 或完整 `user_rules.md`。
- 把 `capability-manifest.json` 當成第一步；Router 優先，不能執行時查 `ROUTING.md`。
- `AGENTS.md` 與 `.codex/AGENTS.md` 不提 `GIT-FALLBACK-BOOTSTRAP.md`；Git fallback 由使用者層橋接處理。
- 完整 Skill、Agent、模型或 Hook 清單。

### 4.4 使用者層橋接

`scripts/entry-sync/` 只管 Codex、Claude、Gemini 三個使用者層入口。`templates/codex.md` 的內容會被 Codex 原生發布器以雜湊辨識（`scripts/codex-native-core/publish.mjs` 的舊入口檢查）；修改它之前先確認工作機上 `~/.codex/AGENTS.md` 的狀態，改完重跑 entry-sync，否則發布器會停在「舊 Pixiu 入口與已知範本不同」。

### 4.5 不能執行指令的工具

改讀 `vault/capabilities/ROUTING.md`。它由 `node scripts/router/build-routing-index.js` 從 Manifest 產生；Manifest 改動後要重跑，否則測試會失敗。

### 4.6 新工具接入步驟

1. 查該工具的官方文件：專案層讀哪個檔、使用者層指令放哪裡、有沒有 Skill 與 Hook。
2. 會讀 `AGENTS.md`：專案層不用做事。不會讀：為它建一個入口檔，內容是啟動四步加專屬差異，並把檔名加進 `scripts/performance/lazy-loading-integration.test.js` 的逐字比對清單與 `AGENTS.md` 的工具差異指引。
3. 使用者層：把 `scripts/entry-sync/templates/generic.md` 貼進該工具的全域指令位置。entry-sync 目前只自動安裝 Codex、Claude、Gemini。
4. 需要單獨追蹤啟動預算時，在 `scripts/performance/measure-core-startup.js` 加 profile；否則沿用 `generic`。
5. 在 2.2 登記該工具的實際讀取行為與查證日期。

## 5. 同步檢查清單（防漂移，每月首次 session 執行）

弱模型照做即可，全部是機械操作：

1. 跑 `node --test scripts/performance/lazy-loading-integration.test.js`。它檢查啟動四步逐字一致、入口檔 60 行上限、四組啟動預算、共同入口維持工具中立，以及 Bootstrap 的硬閘門摘要。失敗就依訊息修正。
2. 跑 `node scripts/router/build-routing-index.js --check`，確認路由索引與 Manifest 一致。
3. 根目錄四個入口檔中，`%USERPROFILE%` 以外的本機絕對路徑（如 `C:\Users\`）出現次數為 0。出現就改用環境變數鏈。
4. `vault/governance/INDEX.md` 的檔案清單與 `vault/governance/` 實際檔案一致。不一致就更新 INDEX。
5. 檢查結果寫一行到當日 recap；有修改則入口檔先備份到 `vault/governance/backups/<日期>/`。
6. **Hook 生效副本對照**（2026-07-05 新增；適用任何執行月維護的 AI——Claude／Codex／Gemini 皆同）：repo 內的 hook 檔是本體範本，實際生效的是各 AI 的使用者層設定，兩邊會漂移（2026-07-05 實例：matcher 修了本體、生效副本沒跟上，閘門空轉兩天）。逐項對照：
   - **Claude Code**：repo `hooks/hooks.json` ↔ `%USERPROFILE%\.claude\settings.json` 的 `hooks` 區塊。快速比對：`Select-String -Path "$env:USERPROFILE\.claude\settings.json" -Pattern 'pixiu-guardrails|auto-mode-guard'`，逐條核 matcher 與 command 和本體一致。
   - **Codex**：repo／Playground hook 本體 ↔ `%USERPROFILE%\.codex\hooks.json`（bridge 註冊）。快速比對：`Select-String -Path "$env:USERPROFILE\.codex\hooks.json" -Pattern 'pixiu'`。
   - **Gemini**：無 hook 機制（單體模式，見 model-dispatch-rules 第 7 節），本項跳過；其入口檔 GEMINI.md 已由第 1-3 項涵蓋。
   - 差異處理：以 repo 本體為準源提案更新副本；**hook 設定屬硬閘門，動手前仍須使用者核准**。對照結果寫一行到當日 recap。

## 本檔維護

- 修改第 3 節優先序、或第 4 節入口內容規範：屬制度變更，**先問使用者**。
- 更新第 2 節盤點狀態（例如重新查證某工具的讀取行為）：AI 可自行更新，需在 frontmatter 更新 `lastVerified` 日期。
