# ⚡ Pixiu 強化母體 (PixiuCore)

> **AI 工具中央母艦** — 統一管理 Claude Code、Gemini Antigravity、Cursor、Windsurf 的規則、技能與工作流程。
> 讓所有 AI 工具說同一種語言、遵守同一套憲法。

---

## 📖 目錄

- [什麼是 PixiuCore](#-什麼是-pixiucore)
- [整體架構](#-整體架構)
- [7 層治理架構](#-7-層治理架構)
- [核心元件](#-核心元件)
  - [Agents 專業代理](#-agents-專業代理-27-個)
  - [Skills 技能庫](#-skills-技能庫-177-個)
  - [Workflows 工作流程](#-workflows-工作流程-79-條)
  - [Commands 指令集](#-commands-指令集-58-條)
  - [Rules 規則層](#-rules-規則層-51-條)
  - [Hooks 自動化鉤子](#-hooks-自動化鉤子)
  - [Vault 記憶庫](#-vault-記憶庫)
- [目錄結構](#-目錄結構)
- [支援的 AI 工具](#-支援的-ai-工具)
- [安裝與部署](#-安裝與部署)
- [設定說明](#-設定說明)
- [分享給朋友](#-分享給朋友)
- [Fleet 艦隊管理](#-fleet-艦隊管理)
- [Plugin 插件系統](#-plugin-插件系統)
- [安全規範](#-安全規範)
- [常見問題](#-常見問題)

---

## 🧭 什麼是 PixiuCore

PixiuCore 是一套「AI 行為憲法 + 技能武器庫」的中央母艦系統。它解決了以下核心痛點：

- **AI 工具各自為政**：Cursor、Claude Code、Gemini 各有一套設定，行為不一致
- **規則難以維護**：每個專案都要重新設定一次，更新時無法同步
- **技能無法複用**：好的 Prompt 模式散落各處，換工具就得重寫
- **安全閘門缺失**：AI 容易在未確認的情況下直接修改程式碼或刪除檔案

PixiuCore 解決方式：**單一母體 → 多工具套用**。所有 AI 工具從同一個來源讀取規則、技能、工作流，確保一致的行為與安全保障。

---

## 🏗️ 整體架構

```
C:\PixiuCore\                       ← 母體根目錄
│
├── user_rules.md                   ← L0 憲法核心（硬閘門，最高優先）
├── CLAUDE.md                       ← Claude Code 全域啟動協議
├── CODEX.md                        ← Codex 審計協議
├── AGENTS.md                       ← ECC Agent 全局指令
├── SKILLS_INDEX.md                 ← 176+ 技能分類索引
├── fleet.json                      ← 艦隊專案路徑清單
├── plugin.json                     ← Claude Code Plugin 描述檔
├── setup.bat                       ← 一鍵安裝腳本
├── pack-for-friend.bat             ← 打包分享腳本
│
├── agents/                         ← 頂層 Agent 定義（27 個）
├── commands/                       ← Slash 指令集（57 條）
├── skills/                         ← 頂層 Skills（領域技能集）
├── rules/                          ← 規則層（51 條，多語言分類）
├── hooks/                          ← 自動化鉤子設定
├── scripts/                        ← 輔助腳本（hooks JS / PS1）
├── mcp-configs/                    ← MCP 伺服器設定
├── plugins/                        ← 插件擴展
├── docs/                           ← 專案文件
│
└── .agent/                         ← ECC 核心引擎（Everything Claude Code）
    ├── agents/                     ← ECC Agent 定義（28 個）
    ├── skills/                     ← ECC Skills 庫（177 個）
    ├── workflows/                  ← 工作流程（79 條）
    ├── rules/                      ← 語言專屬規則（51 條）
    ├── hooks/                      ← Hook 設定 JSON
    ├── commands/                   ← 舊版指令（相容層）
    ├── extensions/                 ← 擴展模組
    ├── knowledge/                  ← 知識庫與經驗教訓
    ├── contexts/                   ← 上下文模板
    ├── schemas/                    ← JSON Schema 驗證
    ├── mcp-configs/                ← MCP 設定
    ├── logs/                       ← 執行日誌
    ├── reports/                    ← 統計報告（token、quota）
    ├── backups/                    ← 自動備份
    └── config.yaml                 ← Agent 主設定檔
```

**資料流向：**

```
PixiuCore（唯一來源）
    ├─→ Claude Code        透過 additionalDirectories + ~/.claude/CLAUDE.md
    ├─→ Gemini Antigravity  透過 ~/.gemini/GEMINI.md（由 setup.bat 生成）
    ├─→ Cursor / Windsurf   透過 user_rules.md（專案級規則自動讀取）
    └─→ 任何未來 AI 工具    透過 PIXIU_CORE_PATH 環境變數
```

---

## 🏛️ 7 層治理架構

PixiuCore 採用「憲法至上」原則，所有 AI 行為必須通過以下階層檢核，任何層級的衝突一律服從更高層：

| 層級 | 名稱 | 職責 | 來源 |
|------|------|------|------|
| **L0** | 憲法層 | 我是誰？我被禁止做什麼？具一票否決權 | `user_rules.md` |
| **L1** | 安全層 | 我的操作安全嗎？OWASP 掃描 | `security-reviewer` agent |
| **L2** | 心智層 | 我思考得夠深嗎？BDI 認知模型 | `claude-reasoning-modes` + `planner` |
| **L3** | 流程層 | 我的工作步驟對嗎？5 大工程模組 | `architect-protocol` + `/plan` |
| **L4** | 技能層 | 我如何執行具體戰術？ | `.agent/skills/` 90+ 技能 |
| **L5** | 經驗層 | 前輩有留下相關教訓嗎？ | `troubleshooting-master` + `instinct-status` |
| **L6** | 校準層 | 我這次的表現值得信任嗎？ | `/learn` 學習迴圈 |

> ⚠️ **底線原則**：當 L4 技能層的技術方案違背 L0 憲法的任何硬禁令時，**無條件服從 L0**。

---

## 🧩 核心元件

### 🤖 Agents 專業代理（27 個）

> 同步更新（2026-04-20）：新增 `vault/` 記憶庫、5 個 Pixiu 專屬 Skills、`/go` 驗證迴圈指令、完整 `.agent/` 子系統（knowledge、hooks、rules、schemas、contexts）、`Tools/` 母艦工具集。

Agents 是有特定專業職責的 AI 子系統，由主 AI 在需要時自動調用。

#### 規劃與架構

| Agent | 功能 | 自動觸發時機 |
|-------|------|------------|
| `planner` | 複雜功能規劃、架構決策、多步驟分解 | 收到新功能需求時 |
| `architect` | 系統架構設計、擴展性評估、ADR 撰寫 | 大型重構或新系統設計 |
| `chief-of-staff` | Email/Slack/LINE 訊息分類與回覆草稿 | 多管道通訊管理 |

#### 開發與測試

| Agent | 功能 | 自動觸發時機 |
|-------|------|------------|
| `tdd-guide` | 測試驅動開發，強制 80%+ 覆蓋率 | 寫新功能或修 bug |
| `code-reviewer` | 品質、安全性、可維護性全方位審查 | 每次 code 修改後 |
| `security-reviewer` | OWASP Top 10、SSRF、注入漏洞掃描 | 碰到 user input、認證、API |
| `e2e-runner` | Playwright E2E 測試生成與執行 | 關鍵使用者流程 |
| `test-writer` | 單元 / 整合測試自動撰寫 | 補充測試覆蓋率 |

#### 語言專屬代理

| Agent | 語言 | 職責 |
|-------|------|------|
| `go-reviewer` | Go | 慣用模式、並發安全、goroutine leak |
| `go-build-resolver` | Go | go vet 警告、module 錯誤修復 |
| `cpp-reviewer` | C++ | 記憶體安全、現代 C++17/20 |
| `cpp-build-resolver` | C++ | CMake 編譯錯誤修復 |
| `rust-reviewer` | Rust | 所有權、生命週期、unsafe 使用 |
| `rust-build-resolver` | Rust | cargo 編譯、借用檢查器錯誤 |
| `kotlin-reviewer` | Kotlin | Android/KMP、協程安全 |
| `kotlin-build-resolver` | Kotlin | Gradle 建置錯誤 |
| `java-reviewer` | Java | Spring Boot、JPA、安全審查 |
| `java-build-resolver` | Java | Maven/Gradle 建置錯誤 |
| `python-reviewer` | Python | PEP 8、型別提示、安全性 |

#### 維運與特殊代理

| Agent | 功能 |
|-------|------|
| `database-reviewer` | PostgreSQL 查詢優化、Supabase Schema 設計 |
| `doc-updater` | 文件與 codemap 更新 |
| `docs-lookup` | 即時查詢函式庫文件（Context7）|
| `refactor-cleaner` | 死碼清除、重複程式碼整合 |
| `build-error-resolver` | TypeScript/JS 建置錯誤修復 |
| `loop-operator` | 自主 agent 迴圈監控與安全介入 |
| `harness-optimizer` | Agent harness 設定可靠性優化 |
| `explore-agent` | 🆕 程式碼庫探索與快速理解 |
| `verification-agent` | 🆕 多步驟任務驗證與事實查核 |

---

### 🧠 Skills 技能庫（177 個）

Skills 是可複用的 AI 行為模式，分為「通用型」（所有 AI 工具可用）與「Claude Code 專屬」。

#### 通用型 Skills（🔵 任何 AI 工具）

| 分類 | 技能 |
|------|------|
| 認知框架 | `bdi-mental-states`、`analogical-reasoning`、`claude-reasoning-modes` |
| 開發流程 | `tdd-workflow`、`systematic-debugging`、`verification-before-completion` |
| 程式設計 | `api-design`、`backend-patterns`、`frontend-patterns`、`coding-standards` |
| 安全 | `security`、`error-handling` |
| 語言框架 | `android-clean-architecture`、`compose-multiplatform-patterns` |
| | `golang-patterns`、`golang-testing` |
| | `kotlin-coroutines-flows`、`kotlin-exposed-patterns`、`kotlin-ktor-patterns` |
| | `java-coding-standards`、`cpp-coding-standards`、`cpp-testing` |
| | `django-patterns`、`django-tdd`、`laravel-patterns`、`laravel-tdd` |
| 資料庫 | `db-schema`、`clickhouse-io` |
| 測試 | `e2e-testing`、`ai-regression-testing`、`eval-harness` |
| 文件 | `md-to-docx`、`article-writing`、`content-engine` |
| UX | `UxSoul-extractor`、`ui-design` |
| 其他 | `brainstorming`、`research`、`visualization`、`performance` |

#### Claude Code 專屬 Skills（🟣）

| 技能 | 功能 |
|------|------|
| `claude-api-cost` | Claude API 成本優化與 Token 路由 |
| `continuous-learning` / `v2` | 自動從對話萃取可複用模式 |
| `agentic-engineering` | Agent 架構設計 |
| `agent-harness-construction` | Agent harness 建構規範 |
| `ai-first-engineering` | AI 優先工程方法論 |
| `autonomous-loops` | 自主 Agent 迴圈設計 |
| `configure-ecc` | ECC 設定與初始化 |
| `eval-harness` | 評估框架建構 |
| `iterative-retrieval` | 迭代式資料檢索模式 |
| `context-architect` | 上下文架構設計 |
| `codebase-adapter` | 跨專案程式碼移植 |
| `prompt-optimize` | Prompt 自動優化 |
| `skill-acquisition` | 新技能發現、審核、安裝 |

#### 🆕 Pixiu 核心專屬 Skills

| 技能 | 層級綁定 | 功能 |
|------|---------|------|
| `pixiu-verify-loop` | L3 流程 / L4 技能 / L6 校準 | 端對端自我驗證迴圈（Boris /go 概念 × Pixiu 硬閘門）：E2E 測試 → `/simplify` → PR 草稿，任一階段紅燈即停，不自動修。Slash 入口：`/go` |
| `pixiu-session-recap` | L3 流程 / L5 經驗 / L6 校準 | 階段 Recap 系統，整合 Claude Code `/recap`，在 session 斷點自動產出結構化摘要並寫入 `vault/memory/`，供下次接續 |
| `claude-code-auto-mode-policy` | L0 憲法 / L1 安全 / L3 流程 | Auto mode 授權政策判斷器，評估「哪些任務可以自動放行、哪些強制退回手動」，與 L0 絕對用戶審批閘門銜接 |
| `opus-behavior-core` | L0～L4 全層 | 將 Opus 4 行為常數抽象為「認知 / 資訊 / 行動 / 溝通 / 安全」五層可移植規則，供任意 Agent 在啟動階段載入，統一跨模型行為骨幹 |
| `make-docx` | L4 技能 | 以固定 Pixiu 風格（藍色標題、彩色表格、風險框、流程圖、自動目錄）產生 DOCX 技術文件，Slash 入口：`/make-docx` |

---

### ⚡ Workflows 工作流程（79 條）

Workflows 是多步驟任務的標準化 Slash 指令，透過 `/指令名稱` 觸發。

#### 規劃與架構

| 指令 | 功能 |
|------|------|
| `/plan` | 強制規劃審批，禁止未審核直接實作 |
| `/multi-plan` | 多模型協作規劃（Claude + Gemini）|
| `/devfleet` | 並行 Agent 派遣，同時處理多個子任務 |
| `/orchestrate` | 多 Agent 協作指揮 |
| `/adr` | Architecture Decision Record 撰寫 |

#### 開發與測試

| 指令 | 功能 |
|------|------|
| `/tdd` | 測試驅動開發完整流程 |
| `/e2e` | E2E 測試生成（Playwright）|
| `/code-review` | 全方位程式碼審查 |
| `/verify` | 完成前驗證清單 |
| `/quality-gate` | 品質閘門檢查 |
| `/eval` | AI 輸出評估與評分 |
| `/learn-eval` | 評估結果學習回饋 |

#### 語言專屬建置 / 測試 / 審查

| 語言 | 可用指令 |
|------|---------|
| Go | `/go-build`、`/go-review`、`/go-test` |
| C++ | `/cpp-build`、`/cpp-review`、`/cpp-test` |
| Rust | `/rust-build`、`/rust-review`、`/rust-test` |
| Kotlin | `/kotlin-build`、`/kotlin-review`、`/kotlin-test` |
| Python | `/python-review` |
| Gradle | `/gradle-build` |

#### 維運與部署

| 指令 | 功能 |
|------|------|
| `/deploy` | 部署流程標準化 |
| `/release` | 版本發布流程 |
| `/pm2` | PM2 程序管理 |
| `/build-fix` | 自動修復建置錯誤 |
| `/refactor-clean` | 安全重構與死碼清理 |
| `/db-migrate` | 資料庫遷移流程 |

#### 記憶與上下文管理

| 指令 | 功能 |
|------|------|
| `/save-session` | 將當前對話關鍵資訊永久存入 session 檔 |
| `/resume-session` | 下次對話開始時恢復上下文 |
| `/compact` | 壓縮過長對話，節省 token |
| `/checkpoint` | 中途存檔目前進度 |

#### 持續學習

| 指令 | 功能 |
|------|------|
| `/learn` | 從本次任務萃取可複用模式 |
| `/instinct-status` | 查閱累積的直覺知識庫 |
| `/instinct-export` | 匯出直覺庫 |
| `/instinct-import` | 匯入直覺庫 |
| `/evolve` | 技能自我演化 |

#### 自主迴圈

| 指令 | 功能 |
|------|------|
| `/loop-start` | 啟動自主 Agent 迴圈 |
| `/loop-status` | 查看迴圈執行狀態 |
| `/model-route` | 動態模型路由選擇 |

#### 🆕 驗證迴圈

| 指令 | 功能 |
|------|------|
| `/go` | 啟動 Pixiu 端對端自我驗證迴圈（E2E → /simplify → PR 草稿），支援 `quick`、`full`、`pr-only`、`dry-run` 四種模式。結果自動寫入 `vault/memory/verify-loop.log` |

#### 技能管理

| 指令 | 功能 |
|------|------|
| `/skill-create` | 建立新技能 |
| `/skill-health` | 技能健康狀態審查 |
| `/promote` | 將本地改動提升為母體規則 |
| `/transplant-skills` | 跨專案移植技能 |

---

### 📋 Commands 指令集（58 條）

Commands 是已標準化的 Slash 指令定義，與 Workflows 搭配使用。涵蓋範圍從程式碼審查、測試、文件更新到 UX 審查。完整清單見 `commands/` 目錄。新增 `/go`（驗證迴圈），見上方 Workflows 章節。

---

### 📏 Rules 規則層（51 條）

Rules 定義了各語言的編碼風格、安全規範、測試要求與 Git 工作流。

| 分類 | 語言 / 範圍 |
|------|------------|
| 通用規則 | 編碼風格、開發流程、Git 工作流、安全、測試、效能、設計模式、Hooks |
| 語言規則 | TypeScript、Python、Go、Kotlin、Java、C++、Rust、Swift、Perl、PHP |
| 特殊規則 | `prompt-engineering`（🆕 Prompt 工程最佳實踐）|

每個語言分類包含：`coding-style`、`hooks`、`patterns`、`security`、`testing` 共 5 個面向。

---

### 🪝 Hooks 自動化鉤子

Hooks 在 AI 執行特定工具前後自動觸發，無需手動介入。

#### PreToolUse（工具執行前）

| 鉤子 | 觸發條件 | 功能 |
|------|---------|------|
| `auto-tmux-dev` | Bash | 自動在 tmux 中啟動開發伺服器 |
| `pre-bash-tmux-reminder` | Bash | 長時間指令提醒使用 tmux |
| `pre-bash-git-push-reminder` | Bash | git push 前提醒確認變更 |
| `doc-file-warning` | Write | 寫入非標準文件路徑時警告 |
| `suggest-compact` | Edit/Write | 在邏輯節點建議壓縮對話 |
| `pixiu-guardrails` | Edit/Write | 🆕 母體治理：大規模變更警告 + `.agent/` 偵測 |

#### PostToolUse（工具執行後）

| 鉤子 | 觸發條件 | 功能 |
|------|---------|------|
| `secret-scanner` | Edit/Write | 🆕 API Key / 機密洩露自動掃描 |
| `console-log-detector` | Edit/Write | 偵測未移除的 console.log |
| `pre-commit` | Bash（git commit）| 提交前品質閘門 |
| `commit-msg` | Bash（git commit）| 提交訊息格式驗證 |

#### Stop（對話結束）

| 鉤子 | 功能 |
|------|------|
| `mothership-sync` | 偵測 `.agent/` 框架級變更，提醒回寫母體 |

---

### 🗄️ Vault 記憶庫

`vault/` 是 PixiuCore 的跨 session 長期記憶系統，讓 AI 在每次啟動時能快速恢復工作狀態與個人化設定。

```
vault/
├── identity/
│   ├── founder-profile.md    ← 創辦人畫像（偏好、思考風格、決策模式）
│   └── agent-persona.md      ← Agent 人格設定（溝通風格、語氣基調）
├── memory/
│   ├── memory-summary.md     ← 跨 session 記憶摘要（累積更新）
│   ├── verify-loop.log       ← /go 驗證迴圈執行歷史
│   └── auto-mode-audit.log   ← Auto mode 授權稽核日誌
├── context/
│   ├── tech-stack.md         ← 技術棧偏好與版本設定
│   └── pclms-overview.md     ← 核心專案概覽
└── sop/
    └── dev-workflow.md       ← 個人開發流程 SOP
```

**Vault 與 CODEX.md 的關係：** Codex 在執行任何審計前，必須先讀取 `vault/identity/` 與 `vault/memory/memory-summary.md`，確保稽核視角符合個人背景與歷史決策脈絡。

**Vault 自動寫入時機：**
- `/go` 執行完成 → 寫入 `verify-loop.log`
- `/recap` 或 `pixiu-session-recap` 觸發 → 更新 `memory-summary.md`
- Auto mode 授權評估 → 寫入 `auto-mode-audit.log`

> ⚠️ `vault/` 包含個人資料，若 fork 此母體分享給他人，建議在 `.gitignore` 中排除 `vault/identity/` 與 `vault/memory/`，或手動清空後再推送。

---

## 📁 目錄結構

```
C:\PixiuCore\
│
├── 📜 user_rules.md              # L0 憲法（7層治理 + 硬閘門 + 安全規範）
├── 📜 CLAUDE.md                  # Claude Code 啟動協議
├── 📜 CODEX.md                   # Codex 審計協議（含 Vault Init）
├── 📜 AGENTS.md                  # ECC Agent 全局指令（27 agents）
├── 📜 SKILLS_INDEX.md            # 176+ 技能索引（含 Claude/Gemini 標注）
├── 📜 PLUGIN_SCHEMA_NOTES.md     # Plugin Manifest 技術注意事項
│
├── 🤖 agents/                    # 頂層 Agent（27個，含 explore/verification-agent）
├── 💬 commands/                  # Slash 指令（58條，含 /go 驗證迴圈）
├── 🧠 skills/                    # 領域技能集（51個，含 5 個 Pixiu 核心 skills）
├── 📏 rules/                     # 規則層（common + 9 語言 × 5 面向）
├── 🪝 hooks/                     # Hook 設定（hooks.json，含 guardrails 安全閘門）
├── 🔧 scripts/hooks/             # Hook JS 腳本（pixiu-guardrails.js 等）
├── 🔧 scripts/setup/             # 安裝腳本（install-to-cli.ps1、uninstall-from-cli.ps1）
├── 🔧 scripts/scripts/           # 母體部署工具（deploy、backup、transplant、sync）
├── 🔌 mcp-configs/               # MCP 伺服器設定
├── 🧩 plugins/                   # 插件擴展
├── 📚 docs/                      # 技術文件（claude-code-upgrade-plan 等）
├── 🛠️ Tools/                     # 母艦工具集（pixiu-init.ps1、sync-pixiu-fleet.ps1 等）
│
├── 🗄️  vault/                    # 跨 session 長期記憶系統
│   ├── identity/                 #   創辦人畫像 + Agent 人格設定
│   ├── memory/                   #   記憶摘要、verify-loop.log、auto-mode 稽核
│   ├── context/                  #   技術棧偏好、核心專案概覽
│   └── sop/                      #   個人開發流程 SOP
│
├── ⚙️  fleet.json                # 艦隊專案清單
├── 📦 plugin.json                # Claude Code Plugin 描述
├── 🚀 setup.bat                  # 一鍵安裝（Windows）
├── 📦 pack-for-friend.bat        # 打包分享工具
├── 📦 pack-for-friend.ps1        # 打包（PowerShell 版）
│
└── 🏭 .agent/                    # ECC 核心引擎 v1.8.0
    ├── agents/                   # 28 個專業代理
    ├── skills/                   # 177 個技能
    ├── workflows/                # 79 條工作流程
    ├── rules/                    # 51 條語言規則
    ├── hooks/                    # Hook JSON 設定
    ├── knowledge/                # 知識庫（codex_bridge、workflow_methodology、lesson 等）
    ├── contexts/                 # 上下文模板（dev / research / review）
    ├── schemas/                  # JSON Schema 驗證（hooks、plugin、install-state 等）
    ├── examples/                 # 範例 CLAUDE.md（django、go、nextjs 等專案模板）
    ├── mcp-configs/              # MCP 設定
    ├── logs/pixiu.log            # 執行日誌
    ├── reports/                  # token_usage、quota_trend、scan_history
    ├── backups/                  # 自動備份
    └── config.yaml               # Agent 主設定
```

---

## 🛠️ 支援的 AI 工具

| AI 工具 | 整合方式 | 規則載入方式 |
|---------|---------|------------|
| **Claude Code** | `additionalDirectories` + Plugin | 自動讀取 `CLAUDE.md` + `user_rules.md` |
| **Gemini Antigravity** | `~/.gemini/GEMINI.md` | `setup.bat` 自動生成並嵌入規則 |
| **Cursor** | 專案級 `.cursor/rules/` | 讀取 `user_rules.md`（專案規則）|
| **Windsurf** | 專案設定 | 同上 |
| **Copilot** | 需手動設定 | 讀取 `user_rules.md` |
| **任何未來工具** | 透過 `PIXIU_CORE_PATH` | 指向母體路徑即可 |

> ✅ 標注 🔵 的技能可在任何 AI 工具使用；標注 🟣 的技能需要 Claude Code 才能使用。

---

## 🚀 安裝與部署

### 前置需求

- Windows 10 / 11（`setup.bat` 適用）
- Node.js 18+（Hook 腳本需要）
- Git（版本管理）
- Claude Code CLI（如需使用 🟣 技能）

### 步驟一：Clone 母體

> **安裝路徑不限 C 槽。** `C:\PixiuCore` 只是建議路徑，你可以放在任意位置（例如 `D:\Tools\PixiuCore`）。`setup.bat` 會自動偵測所在目錄並設定 `PIXIU_CORE_PATH`。

```powershell
# 建議路徑（非必須）
git clone https://github.com/pop15106/pixiu-core C:\PixiuCore

# 自訂路徑範例
git clone https://github.com/pop15106/pixiu-core D:\Tools\PixiuCore
```

或直接解壓縮收到的 `pixiu-mothership.zip` 到任意目錄。

### 步驟二：執行安裝腳本

在母體目錄內，**右鍵以系統管理員身分執行** `setup.bat`：

```
<你的母體路徑>\setup.bat
```

安裝腳本自動完成 6 件事：

| 步驟 | 動作 | 結果 |
|------|------|------|
| 1 | 設定 `PIXIU_CORE_PATH` 環境變數 | 其他腳本可找到母體位置 |
| 2 | 寫入 `~\.gemini\GEMINI.md` | 母體規則注入 Gemini CLI |
| 3 | 寫入 `~\.claude\CLAUDE.md` | 母體規則注入 Claude Code |
| 4 | 寫入 `~\.codex\instructions.md` | 母體規則注入 Codex CLI |
| 5 | 寫入 `.github\copilot-instructions.md` | Copilot 專案層級指令 |
| 6 | 更新 VS Code `settings.json` | Copilot 使用者層級全域指令 |

安裝完成後**重新啟動終端機與 VS Code**讓環境變數與設定生效。

### 步驟三：設定 Claude Code（additionalDirectories）

在 Claude Code 全域設定（`~/.claude/settings.json`）加入：

```json
{
  "additionalDirectories": ["C:\\PixiuCore"]
}
```

> 路徑請換成你實際的母體安裝位置（即 `PIXIU_CORE_PATH` 的值）。

或在 Claude Code 中執行：

```
/configure-ecc
```

### 步驟四：驗證安裝

開啟 Claude Code，對話開始時應看到：

```
⚡ Pixiu 強化母體已連線
母體路徑：<你的 PIXIU_CORE_PATH>
載入：Pixiu 7 層憲法 + ECC 全集（177 skills · 79 workflows · 51 rules）

請問你要我做什麼？
```

### 步驟五：專案級設定（每個新專案）

在你的專案根目錄建立 `CLAUDE.md`，內容參考母體的 `CLAUDE.md` 範本，修改 `{PROJECT_NAME}` 為實際專案名稱。

---

## ⚙️ 設定說明

### `config.yaml` — Agent 主設定

位於 `.agent/config.yaml`，控制以下行為：

```yaml
# Skill 快捷別名（pixiu install stripe）
aliases:
  stripe: https://...
  docker: https://...

# Watchdog 監控（自動偵測依賴變動）
watchdog:
  enabled: true
  interval: 60      # 秒
  files:
    - package.json
    - go.mod
    - requirements.txt

# 安全掃描設定
security:
  pre_commit:
    enabled: true
    check_secrets: true
    large_file_threshold_mb: 1
```

### `hooks/hooks.json` — Hook 觸發設定

控制哪些工具操作會觸發哪些自動化腳本。支援以下觸發點：`PreToolUse`（工具執行前）、`PostToolUse`（工具執行後）、`Stop`（對話結束時）。

Hook 可透過環境變數控制：

```bash
ECC_HOOK_PROFILE=strict    # 嚴格模式（所有 hook 啟用）
ECC_DISABLED_HOOKS=tmux    # 停用特定 hook
```

### `user_rules.md` — L0 憲法

這是最重要的設定檔，定義了 AI 的所有行為邊界。修改時請注意：

- 任何修改都必須回寫母體（由 `mothership-sync` hook 提醒）
- 建議修改前先備份
- 修改後執行 `setup.bat` 重新同步到 Gemini

---

## 📦 分享給朋友

執行 `pack-for-friend.bat`（或 PowerShell 版 `pack-for-friend.ps1`）：

```powershell
C:\PixiuCore\pack-for-friend.bat
```

此腳本自動：
1. `git pull` 同步最新版本
2. 打包核心檔案為 `pixiu-mothership.zip`（輸出到桌面），包含 `.agent\`、`user_rules.md`、`CLAUDE.md`、`SKILLS_INDEX.md`、`setup.bat`
3. 詢問是否開啟桌面資料夾

**朋友安裝方式：**
1. 解壓縮到 `C:\PixiuCore`（建議路徑）
2. 右鍵系統管理員執行 `setup.bat`
3. 重啟終端機
4. 開啟 Claude Code 或 Antigravity

---

## 🚢 Fleet 艦隊管理

`fleet.json` 記錄了所有受母體管理的專案路徑，實現跨專案一致的 AI 行為：

```json
[
  "C:\\Users\\{user}\\Desktop\\專案A",
  "C:\\Users\\{user}\\Desktop\\專案B"
]
```

使用 `/devfleet` 或 `/multi-plan` 指令可同時對多個專案進行協作任務。新增專案到艦隊時，在該專案目錄建立 `CLAUDE.md` 並引用母體路徑即可。

---

## 🧩 Plugin 插件系統

PixiuCore 以 Claude Code Plugin 形式發布（`plugin.json`），可直接在 Claude Code 市集安裝。

**Plugin 資訊：**

```json
{
  "name": "everything-claude-code",
  "version": "1.8.0",
  "description": "完整的 Claude Code 設定集合，來自 Anthropic Hackathon 冠軍作品",
  "license": "MIT"
}
```

**Plugin 包含元件：** agents（27個）、commands（57條）、hooks（自動化）、rules（51條）、skills（技能庫）。

> ⚠️ Plugin Manifest 注意事項：`agents` 欄位必須使用明確檔案路徑（非目錄），`components` 欄位必須為陣列，且必須包含 `version` 欄位。詳見 `PLUGIN_SCHEMA_NOTES.md`。

---

## 🔐 安全規範

**程式碼安全（L1 安全層）**

- 敏感資料放 `.env`，強制加入 `.gitignore`
- 禁止硬編碼 API Key、密碼、Token
- 所有 user input 必須在系統邊界驗證
- SQL 注入防護（參數化查詢）、XSS 防護、CSRF 保護

**AI 行為安全（L0 憲法層）**

- 任何修改操作必須獲得用戶明確核可後才執行
- 禁止在未確認前自動修復 bug（即使是一行程式碼）
- 刪除、大規模重構、DB schema 變更需額外確認
- 高風險操作（rm -rf、drop database）永久禁止

**機密掃描（PostToolUse Hook）**

- 每次 Edit/Write 後自動掃描 API Key 洩露
- 偵測 AWS、GitHub、Stripe、OpenAI 等格式的 Token
- 發現機密立即中斷並提示輪換

---

## ❓ 常見問題

**Q: `setup.bat` 執行後環境變數沒生效？**

必須重新開啟終端機（不是重新整理），因為 `setx` 只對新開的視窗有效。

**Q: Claude Code 找不到母體的 Skills？**

確認 `~/.claude/settings.json` 中 `additionalDirectories` 包含 `C:\\PixiuCore`，路徑使用雙反斜線。

**Q: Gemini 沒有讀到 user_rules？**

重新執行 `setup.bat` 重新生成 `~/.gemini/GEMINI.md`，確認檔案存在且包含完整規則。

**Q: Commit 時出現 lock file 錯誤？**

```powershell
Remove-Item "C:\PixiuCore\.git\index.lock" -Force
```

**Q: 修改 user_rules.md 後需要做什麼？**

執行 `setup.bat` 同步到 Gemini，再 git commit 並 push 保留版本歷史。

**Q: 如何將本地改進的技能回寫母體？**

使用 `/promote` 指令，或直接修改 `C:\PixiuCore\.agent\skills\` 下的對應檔案。母體的 `mothership-sync` hook 會在對話結束時自動提醒你同步。

---

## 📊 版本資訊

| 項目 | 版本 / 數量 |
|------|------------|
| ECC 版本 | v1.8.0 |
| Agents | 27 個 |
| Skills（.agent/） | 177 個 |
| Skills（頂層 skills/） | 51 個（含 5 個 Pixiu 核心 skills） |
| Workflows | 79 條 |
| Commands | 58 條（含 /go 驗證迴圈） |
| Rules | 51 條 |
| Vault 記憶系統 | ✅ 已啟用 |
| 支援 AI 工具 | Claude Code、Gemini Antigravity、Cursor、Windsurf、Copilot |
| 最後同步 | 2026-04-20（雙向母體同步）|

---

## 📁 關聯資源

- [SKILLS_INDEX.md](SKILLS_INDEX.md) — 完整技能分類索引（含 Claude/Gemini 標注）
- [AGENTS.md](AGENTS.md) — ECC Agent 完整說明
- [PLUGIN_SCHEMA_NOTES.md](PLUGIN_SCHEMA_NOTES.md) — Plugin 開發技術注意事項
- [vault/README.md](vault/README.md) — Vault 記憶庫說明與使用規範
- [docs/claude-code-upgrade-plan.md](docs/claude-code-upgrade-plan.md) — Claude Code 升級計畫
- [.agent/README-ECC-zh.md](.agent/README-ECC-zh.md) — ECC 中文詳細說明
- [.agent/README-ECC.md](.agent/README-ECC.md) — ECC 英文說明
- [.agent/CHANGELOG.md](.agent/CHANGELOG.md) — 版本更新紀錄
- [.agent/TROUBLESHOOTING.md](.agent/TROUBLESHOOTING.md) — 常見問題排查

---

*⚡ Pixiu 強化母體 · 讓所有 AI 工具說同一種語言*
