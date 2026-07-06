---
type: governance
date: 2026-07-03
project: PIXIUCORE
system: PIXIUCORE
topic: entry-files-alignment
status: active
lastVerified: 2026-07-05
tags: [pixiucore, governance, entry-files, routing, claude, codex, gemini]
summary: 跨 AI 入口路由制度：四個入口檔只留精簡路由，制度本體集中在 vault/governance/。含各入口檔最小路由文字與套用步驟。
---

# 跨 AI 入口路由制度

## 1. 設計原則（為什麼要這樣做）

1. **單一真源**：規則本體只存在一份，放 `vault/governance/` 與既有 `vault/sop/`、`vault/context/ai-mothership-loading-policy.md`。
2. **入口檔只做路由**：`CLAUDE.md` / `CODEX.md` / `GEMINI.md` / `AGENTS.md` 各自只保留「路徑解析＋讀取序列＋該 AI 專屬差異」，上限 **60 行**。超過 60 行就是有規則長錯地方，要搬回本體。
3. **改本體不改入口**：任何規則變更只改制度本體檔；入口檔只有在「路由目標變了」才改。這是防止四套入口漂移成四套制度的唯一機制。
4. **與既有載入政策的分工**：`vault/context/ai-mothership-loading-policy.md` 管「載入什麼、何時載入」（L1-L6 分層、skills 路由、agent team 閘門），本檔管「入口檔的形狀與同步」。兩檔對入口檔內容描述不一致時，以本檔第 4 節為準；loading-policy 的「各 AI 入口規則」節與本檔重疊處，待提案合併（見 letter-to-future-sessions 未完成項目）。

## 2. 現況盤點（2026-07-03）

| 檔案 | 位置 | 狀態 |
|---|---|---|
| `vault/README.md` | vault | 已讀。init 序列健全，本次加一行指向 governance/INDEX |
| `vault/context/ai-mothership-loading-policy.md` | vault | 已讀。內容良好，保留為載入政策本體，不重寫 |
| `CLAUDE.md` | 母體根目錄 | 已讀（2026-07-03 快照）。36 行；bootstrap 第 2 步讀 vault/README.md → 已間接接上 governance。最終版加直連段 |
| `CODEX.md` | 母體根目錄 | 已讀。43 行；同樣經 README 間接接上。最終版加直連段。`.codex/AGENTS.md` 仍【未確認】（快照未含子資料夾） |
| `GEMINI.md` | 母體根目錄 | 已讀。34 行；原版把 README 列為「需要時才讀」→ 有斷線風險。最終版已改為必讀＋直連 |
| `AGENTS.md` | 母體根目錄 | 已讀。165 行，實為 ECC 插件主說明檔——屬特例，見 4.4。原版未指向 README／governance，最終版已補 |
| `user_rules.md` | 母體根目錄 | 已讀。L0 最高憲法確認。與現行實務有兩處衝突（recap 檔名時間戳、寫入豁免範圍），修訂屬必問級，見 letter 待辦 |
| `SKILLS_INDEX.md` | 母體根目錄 | 已讀。最後更新 2026-03-18；agents/skills/commands 數量與 AGENTS.md、根 README 三處互相不一致，且未被任何入口路由 |

> 讀取方式：根目錄無法掛載，由使用者複製快照至 `vault/_root-snapshot/`（2026-07-03）。四個入口檔的**合併後最終版**已產出於 `vault/_root-snapshot/updated/`，先備份、再由使用者回貼根目錄。

## 3. 衝突處理優先序（所有 AI 一體適用）

由高到低：

1. 本次使用者明確指令
2. 目前目標專案的 `AGENTS.md`
3. 目前目標專案其他 AI 入口檔
4. PixiuCore `user_rules.md`（L0 硬閘門）
5. `vault/governance/`（本制度）與 `vault/context/ai-mothership-loading-policy.md`
6. vault 其他內容（sop、memory、context）
7. 模型預設行為

**發現入口檔之間互相矛盾時**：不要自行擇一吞掉。做法＝「按上表位階執行位階高者，同時把矛盾寫進 `vault/memory/agent-learning/observations/`（用模板），並在回覆結尾用一行告知使用者」。

## 4. 各入口檔最小路由文字

以下每段可直接貼入對應檔案。**套用步驟（每檔相同）**：
1. 備份：`copy CLAUDE.md vault\governance\backups\2026-07-03\CLAUDE.md.bak`（其餘檔案同理）。
2. 若現有檔案已包含 init 序列或載入政策連結：保留其 AI 專屬設定，僅「追加」下方第 3 點的 governance 路由段。
3. 若現有檔案超過 60 行：把超出的規則內容剪下，搬到 `vault/governance/` 相應檔案或新檔，入口只留路由。

### 4.1 `CLAUDE.md`（Claude Code / Claude 桌面 / VSCode extension）

```markdown
## PixiuCore 母體路由（governance）

1. 解析母體路徑：`PIXIU_CORE` → `PIXIU_CORE_PATH` → `%USERPROFILE%\.pixiu-core`。
2. Session 開始依序讀：
   - `vault/README.md`（init 序列）
   - `vault/governance/INDEX.md`（制度路由：何時讀哪份規則）
3. 制度本體一律在 `vault/governance/` 與 `vault/context/ai-mothership-loading-policy.md`；本檔不承載規則內容。
4. 派工、模型選擇、驗收：照 `vault/governance/model-dispatch-rules.md`。
5. 拿不準要不要問使用者：照 `vault/governance/judgment-rubrics.md`。
```

### 4.2 `CODEX.md`（Codex 桌面 / VSCode extension / CLI；`.codex/AGENTS.md` 同步指向）

```markdown
## PixiuCore 母體路由（governance）

1. 解析母體路徑：`PIXIU_CORE` → `PIXIU_CORE_PATH` → `%USERPROFILE%\.pixiu-core`。
2. Session 開始依序讀 `vault/README.md`、`vault/governance/INDEX.md`。
3. 制度本體在 `vault/governance/`；本檔與 `.codex/AGENTS.md` 只做路由，不寫規則。
4. multi-agent / thread dispatch 前，先照 `vault/governance/model-dispatch-rules.md` 的派工三件套與回報合約。
5. `config.toml` 的能力（threads、reasoning effort）不等於預設啟用；啟用前仍受 user approval gate 約束。
```

### 4.3 `GEMINI.md`（Gemini CLI / Antigravity）

```markdown
## PixiuCore 母體路由（governance）

1. 解析母體路徑：`PIXIU_CORE` → `PIXIU_CORE_PATH` → `%USERPROFILE%\.pixiu-core`。
2. Session 開始依序讀 `vault/README.md`、`vault/governance/INDEX.md`。
3. 無 subagent / hooks 能力時的退化模式：不派工，改用 `vault/governance/model-dispatch-rules.md` 第 7 節「單體模式」——自己分段執行＋每段用檢查清單自驗。
4. 制度本體在 `vault/governance/`；本檔只做路由。
```

### 4.4 `AGENTS.md`（母體根目錄）——特例

實測發現它不是泛用入口檔，而是 ECC 插件的主說明檔（165 行，含 agents 清單、TDD、安全、風格規範）。**60 行上限不適用於它**；把插件內容硬搬走反而破壞 ECC 的功能。改用以下要求：

1. 其「Pixiu Mothership Loading Policy」節的 Key rules 開頭必含兩行：session 開始讀 `vault/README.md` 與 `vault/governance/INDEX.md`；位階與衝突處理指向本檔第 3 節。
2. Agent Orchestration 節補一句：派工與回報照 `model-dispatch-rules.md` 與 `delegation-templates.md`。
3. 其餘插件內容不動（最小改動）。

最終版已按此產出於 `vault/_root-snapshot/updated/AGENTS.md`（另補一條 legacy 專案的測試覆蓋率適用註記，指向 judgment-rubrics 第 5 節）。

### 4.5 `vault/README.md`（本次已直接修改）

已於 init 序列後加入一行指向 `vault/governance/INDEX.md`。原檔備份在 `vault/governance/backups/2026-07-03/README.md.bak`。

## 5. 同步檢查清單（防漂移，每月首次 session 執行）

弱模型照做即可，全部是機械操作：

1. `CLAUDE.md`／`CODEX.md`／`GEMINI.md` 行數 ≤ 60：`Get-Content CLAUDE.md | Measure-Object -Line`（其餘同理）。超標→把規則內容搬回 governance，入口只留路由。`AGENTS.md` 為 ECC 特例不設行數上限（見 4.4）。
2. 四個入口檔都含字串 `vault/governance/INDEX.md`。缺→補上第 4 節對應段落。
3. 四個入口檔中用 `%USERPROFILE%` 以外的絕對路徑（如 `C:\Users\`）出現次數為 0。出現→改用環境變數鏈。
4. `vault/governance/INDEX.md` 的檔案清單與 `vault/governance/` 實際檔案一致。不一致→更新 INDEX。
5. 檢查結果寫一行到當日 recap；有修改則入口檔先備份到 `vault/governance/backups/<日期>/`。
6. **Hook 生效副本對照**（2026-07-05 新增；適用任何執行月維護的 AI——Claude／Codex／Gemini 皆同）：repo 內的 hook 檔是本體範本，實際生效的是各 AI 的使用者層設定，兩邊會漂移（2026-07-05 實例：matcher 修了本體、生效副本沒跟上，閘門空轉兩天）。逐項對照：
   - **Claude Code**：repo `hooks/hooks.json` ↔ `%USERPROFILE%\.claude\settings.json` 的 `hooks` 區塊。快速比對：`Select-String -Path "$env:USERPROFILE\.claude\settings.json" -Pattern 'pixiu-guardrails|auto-mode-guard'`，逐條核 matcher 與 command 和本體一致。
   - **Codex**：repo／Playground hook 本體 ↔ `%USERPROFILE%\.codex\hooks.json`（bridge 註冊）。快速比對：`Select-String -Path "$env:USERPROFILE\.codex\hooks.json" -Pattern 'pixiu'`。
   - **Gemini**：無 hook 機制（單體模式，見 model-dispatch-rules 第 7 節），本項跳過；其入口檔 GEMINI.md 已由第 1-3 項涵蓋。
   - 差異處理：以 repo 本體為準源提案更新副本；**hook 設定屬硬閘門，動手前仍須使用者核准**。對照結果寫一行到當日 recap。

## 本檔維護

- 修改第 3 節優先序、或第 4 節路由文字：屬制度變更，**先問使用者**。
- 更新第 2 節盤點狀態（例如根目錄檔案讀到了）：AI 可自行更新，需在 frontmatter 加 `lastVerified` 日期。
