# PixiuCore 母艦

> 跨 AI 工具的治理母體：集中維護規則、技能、指令、Hooks、Vault 記憶與 Fleet 專案清單。

PixiuCore 的目標不是把每個 AI 工具改成同一個樣子，而是讓 Claude Code、Codex、Gemini、Cursor、Windsurf、OpenCode 等工具都先遵守同一份工程憲法，再依各自能力執行任務。這份 README 是入口地圖；細節請看各子目錄文件。

## 目前狀態

盤點日期：2026-05-27  
盤點路徑：PixiuCore

| 項目 | 現況 |
|------|------|
| Plugin | `everything-claude-code` v1.8.0 |
| Fleet 專案 | `fleet.json` 目前 30 個路徑 |
| 頂層 Agents | 27 個，位於 `agents/` |
| ECC Agents | 29 個，位於 `.agent/agents/`（+skill-opt agent）|
| Slash Commands | 58 條，位於 `commands/` |
| ECC Workflows | 79 條，位於 `.agent/workflows/` |
| 頂層 Skills | 68 個，位於 `skills/`（+skill-opt；cybersecurity-library 以 submodule 掛載，不計入）|
| ECC Skills | 148 個，位於 `.agent/skills/`（含本輪新增 6 個資安域 skill）|
| OpenAI 可攜 Skills | 43 個，位於 `.agents/skills/` |
| Rules | 51 條 Markdown 規則，位於 `rules/` 與 `.agent/rules/` |
| Vault | 已啟用，包含 `identity/`、`memory/`、`context/`、`sop/`、`after-action/`、`templates/` |
| 最近明顯新增 | 2026-05-27：Cybersecurity Library（754 skills submodule）、Architecture Maps、SkillOpt 系統、security-reviewer / architect 全面升級 |

> 注意：目前啟動規則優先讀 `PIXIU_CORE`，部分安裝腳本仍設定 `PIXIU_CORE_PATH`。兩者是既有技術債，調整前請確認所有工具相容性。

## Quick Start（新人第一步）

> Clone 完後依序執行，5 分鐘內讓母體正常運作。

### Step 1：初始化母體環境變數

```bat
setup_zh.bat
```

執行後重新開啟終端機與 IDE，讓 `%PIXIU_CORE%` 環境變數生效。

### Step 2：安裝 Claude Code hooks & skills

需要 PowerShell 7+（`pwsh`）：

```powershell
pwsh -File "scripts\setup\install-to-cli.ps1"
```

### Step 3：初始化 Cybersecurity Library submodule

```bash
git submodule update --init --recursive
```

完成後 `skills/cybersecurity-library/` 會有 754 個資安技能。

### Step 4：建立 fleet.json（選用）

`fleet.json` 不在 repo 內（含個人路徑），需自行建立：

```json
[
  "C:\\你的路徑\\專案A",
  "C:\\你的路徑\\專案B"
]
```

放在 repo 根目錄即可。

### Step 5：設定 SECOND_BRAIN_PATH（選用）

若要使用 `second-brain-health-check` skill，需設定環境變數：

```powershell
[System.Environment]::SetEnvironmentVariable("SECOND_BRAIN_PATH", "C:\你的路徑\second-brain", "User")
```

---

## 核心觀念

PixiuCore 分成三層來看，比較不容易迷路：

| 層級 | 用途 | 代表檔案 / 目錄 |
|------|------|------------------|
| 治理層 | 定義 AI 能做什麼、不能做什麼 | `user_rules.md`、`CLAUDE.md`、`CODEX.md`、`AGENTS.md` |
| 能力層 | 提供代理、技能、指令、Hooks | `agents/`、`skills/`、`commands/`、`hooks/`、`.agent/` |
| 記憶層 | 保存跨 session 的背景、決策與踩坑 | `vault/` |

最重要的原則是：`user_rules.md` 是 L0 憲法，任何技能、流程、代理建議都不能違反它。

## 目錄導覽

| 路徑 | 用途 |
|------|------|
| `user_rules.md` | Pixiu L0 憲法，最高優先級規範 |
| `CLAUDE.md` | Claude Code 啟動與母艦連線協議 |
| `CODEX.md` | Codex 審計與 Vault init 協議 |
| `AGENTS.md` | ECC Agent 全域說明 |
| `agents/` | 頂層專業代理定義 |
| `commands/` | 可被工具載入的 Slash command 定義 |
| `skills/` | Pixiu / 專案常用技能入口 |
| `.agent/` | ECC 核心引擎，含 agents、skills、workflows、rules、hooks、schemas、reports |
| `.agents/` | OpenAI Agents / 可攜 skill 結構 |
| `.codex/` | Codex 專用設定與代理設定 |
| `.cursor/` | Cursor 專案規則入口 |
| `.opencode/` | OpenCode 整合包與遷移文件 |
| `rules/` | 通用與多語言規則層 |
| `hooks/` | Hook 設定與說明 |
| `scripts/` | 安裝、部署、hook、備份與移植腳本 |
| `Tools/` | 母艦日常維護工具，例如初始化、同步、艦隊清理 |
| `vault/` | 長期記憶、身份設定、專案背景、SOP、回顧 |
| `docs/` | 技術文件與升級規劃 |
| `mcp-configs/` | MCP server 設定 |
| `plugins/` | Plugin 相關設定與 blocklist |
| `Backup/` | 歷史備份，分享或打包前要特別檢查 |

## 安裝與同步

### 建議安裝入口

| 腳本 | 用途 |
|------|------|
| `setup_zh.bat` | 目前較完整的 Windows 安裝入口，會設定 `PIXIU_CORE_PATH`，並寫入 Gemini、Claude Code、Codex、Copilot / VS Code 相關設定 |
| `setup.bat` | 較輕量的 Gemini 安裝腳本，主要設定 `PIXIU_CORE_PATH` 與 `~/.gemini/GEMINI.md` |
| `scripts/setup/install-to-cli.ps1` | 將 Pixiu commands、skills、hooks 接到 `~/.claude/`，讓 Claude Code CLI 能看到母體能力 |
| `scripts/setup/uninstall-from-cli.ps1` | 回滾 Claude Code CLI 注入，不動母體原始檔 |
| `uninstall.bat` | 移除 Pixiu 對使用者環境的整合設定 |

安裝後請重新開啟終端機與 VS Code，讓使用者層級環境變數生效。

### Fleet 同步

`fleet.json` 是母艦管理的專案清單，目前包含 PCLMS、PFTZ、PEPIS、PTWCS 等 30 個路徑。日常同步工具在 `Tools/`：

- `Tools\sync-pixiu-fleet.ps1`
- `Tools\一鍵母艦同步.bat`
- `Tools\pixiu-init.ps1`
- `Tools\fleet-agent-cleanup.ps1`

同步前先確認目標專案與母體方向，避免把舊規則覆蓋新規則。

## Session 啟動規則

每次 AI session 開始時：

1. 先讀環境變數 `PIXIU_CORE`；若不存在，預設 `%PIXIU_CORE%`。
2. 依序讀取：
   - `vault/README.md`
   - `user_rules.md`
   - `vault/identity/founder-profile.md`
   - `vault/identity/agent-persona.md`
   - `vault/memory/memory-summary.md`
3. 若任務涉及 PCLMS，再讀：
   - `vault/context/pclms-overview.md`
   - `vault/context/tech-stack.md`
4. 任何寫入前先說明改動範圍與風險，等待使用者確認。
5. 修改後做最小可行驗證，並說明驗證結果。

## 維護原則

- 不直接整包載入母體，只讀任務需要的 rules、skills、memory、context。
- `vault/identity/` 與 `vault/memory/` 含個人資料，分享或打包前要清理。
- 新增 skill 時，同步檢查 `skills/`、`.agent/skills/`、`.agents/skills/` 是否都需要更新。
- 修改 `.agent/`、`user_rules.md`、流程閘門或 AI 約束時，完成後要詢問是否同步回正式母體。
- README、`SKILLS_INDEX.md`、`AGENTS.md` 的數量容易漂移；新增或刪除能力時一起更新。

## 快速盤點指令

在 PowerShell 內可用以下指令重新計數：

```powershell
$root = "%PIXIU_CORE%"
(Get-ChildItem -File "$root\agents").Count
(Get-ChildItem -File "$root\commands").Count
(Get-ChildItem -Directory "$root\skills").Count
(Get-ChildItem -Directory "$root\.agent\skills").Count
(Get-ChildItem -File "$root\.agent\workflows").Count
(Get-ChildItem -File -Recurse "$root\rules" | Where-Object Extension -eq ".md").Count
(Get-Content -Raw -Encoding UTF8 "$root\fleet.json" | ConvertFrom-Json).Count
```

這些指令是 README 更新的校準尺；先量現況，再改文件，才不會讓母艦地圖跟實際房間對不上。


---

## 2026-05 新增能力

> 本節說明 2026-05-27 整合的三項擴充：Cybersecurity Library、Architecture Maps、SkillOpt。

### 1. Cybersecurity Library — 754 個資安技能縱深補強

#### 是什麼

[Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) 是一個包含 754 個資安技能的開源庫，以 git submodule 方式掛載於 `skills/cybersecurity-library/`。涵蓋 OWASP Top 10 2025、MITRE ATT&CK v14（218 個技術）、NIST CSF 的完整 mapping。

#### 初次安裝

Clone 完 pixiu-core 後，需要手動初始化 submodule：

```bash
git submodule update --init --recursive
```

日後更新技能庫：

```bash
git submodule update --remote skills/cybersecurity-library
```

#### 目錄結構

```
skills/cybersecurity-library/
├── skills/               ← 754 個技能目錄（各含 SKILL.md）
│   ├── analyzing-api-gateway-access-logs/
│   ├── implementing-rbac/
│   └── ...（依字母排列）
├── mappings/
│   ├── owasp/            ← OWASP Top 10 2025 對應表
│   ├── mitre-attack/     ← ATT&CK v14 layer（可匯入 ATT&CK Navigator）
│   └── nist-csf/
└── index.json
```

#### Subdomain 分布（技能分類）

| Subdomain | 技能數 | 適用場景 |
|-----------|--------|---------|
| cloud-security | 63 | AWS/Azure/GCP 安全設定 |
| threat-hunting | 56 | 主動威脅偵測 |
| threat-intelligence | 54 | CTI 分析 |
| network-security | 43 | 網路層防護 |
| web-application-security | 42 | OWASP / Web 漏洞 |
| identity-access-management | 33 | OAuth / JWT / RBAC |
| api-security | 28 | OWASP API Top 10 |
| vulnerability-management | 25 | CVE triage / patch |
| devsecops | 17 | CI/CD / Container 安全 |

#### 如何觸發 / 使用

**日常資安審查（自動）**

`security-reviewer` agent 在以下情況會自動深查技能庫：

```
新增 API endpoint → security-reviewer 偵測到 web/api 相關 → 自動載入熱路徑 skill
CI/CD 設定變更  → security-reviewer 偵測到 devsecops 相關 → 自動載入 devsecops skill
發現 CVE / 弱點  → security-reviewer 自動載入 vulnerability-management skill
```

**手動深查特定域**

```bash
# 找某個 subdomain 的所有技能
grep -rl "subdomain: web-application-security" skills/cybersecurity-library/skills/

# 找特定關鍵字的技能
grep -rl "IDOR\|BOLA" skills/cybersecurity-library/skills/

# 查 OWASP mapping
cat skills/cybersecurity-library/mappings/owasp/README.md
```

**熱路徑 domain skill（`.agent/skills/`）**

以下 5 個高頻域已預先摘要安裝，agent 可直接載入，無需 grep 完整庫：

| 觸發情境 | 載入的 Skill |
|---------|-------------|
| Web endpoint / form 安全問題 | `.agent/skills/web-application-security/SKILL.md` |
| REST / GraphQL API 設計審查 | `.agent/skills/api-security/SKILL.md` |
| Auth / JWT / OAuth / RBAC 設計 | `.agent/skills/iam-and-access-control/SKILL.md` |
| Docker / CI/CD / IaC 安全 | `.agent/skills/devsecops/SKILL.md` |
| CVE 分析 / 弱點修復排序 | `.agent/skills/vulnerability-management/SKILL.md` |

---

### 2. Architecture Maps — 21 個架構模板選型指引

#### 是什麼

整合自 [awesome-software-architecture](https://github.com/mehdihadeli/awesome-software-architecture) 的架構知識庫，提供 16 個經典架構 + 5 個 AI-native 架構的快速選型指引，讓 `architect` agent 在設計時有結構化的參考。

#### 檔案位置

```
.agent/knowledge/architecture-maps.md   ← 架構知識庫主文件
.agent/agents/architect.md              ← 已升級的 architect agent
```

#### 知識庫結構

```
architecture-maps.md
├── Part A：16 個經典架構模板
│   Layered / Hexagonal / Clean / DDD / CQRS / Event Sourcing /
│   EDA / Microservices / Service Mesh / Strangler Fig / Saga /
│   Outbox / BFF / API Gateway / Sidecar / Pipe-and-Filter
│
├── Part B：5 個 AI-native 架構模板
│   RAG / Agent Loop / Multi-Agent / LLM Router / SkillOpt
│
├── Part C：選型速查矩陣（場景 → 推薦架構）
│
└── Part D：9 章架構教程摘要
```

#### 如何觸發 / 使用

**自動觸發（`architect` agent）**

以下情境會啟動 architect agent，並自動載入架構地圖：

- 規劃新功能或新系統
- 重構大型模組（超過 3 個元件受影響）
- 做技術選型決策（DB / 框架 / 通訊方式）
- 設計含 LLM / Agent 的 AI 系統

**手動使用**

```
# 在 Claude Code 中
use agent: architect
→ architect 會在 Step 0 自動 Read .agent/knowledge/architecture-maps.md
→ 依需求提供 1-3 個候選架構方案 + trade-off 分析
```

**選型流程**

```
1. 描述系統需求（用戶量級、業務複雜度、AI 特性）
2. architect agent 從 Part C 速查矩陣推薦候選架構
3. 對比方案的 trade-off
4. 確認後寫入 ADR（存於 vault/context/tech-stack.md）
```

**快速查詢特定架構**

直接讀取知識庫中的特定段落：

```bash
grep -A20 "### 4. Domain-Driven Design" .agent/knowledge/architecture-maps.md
grep -A15 "### AI-3. Multi-Agent" .agent/knowledge/architecture-maps.md
```

---

### 3. SkillOpt — Skill 持續演化系統

#### 是什麼

依 [SkillOpt (arxiv:2605.23904)](https://arxiv.org/abs/2605.23904) 實作的 skill 演化機制。把 SKILL.md 文件視為「可訓練的外部狀態」，用 edit budget + validation gate 機制漸進優化 skill，讓母體的技能隨時間自動進化。

#### 檔案位置

```
.agent/agents/skill-opt.md              ← Skill Optimizer agent
skills/skill-opt/SKILL.md              ← skill 使用指引
vault/templates/skill-opt-session.md   ← 每次優化的記錄模板
vault/memory/skill-opt-log.md          ← 優化歷史紀錄
vault/memory/skill-opt-rejected.md     ← 未通過驗證的編輯暫存
```

#### 核心概念

| 概念 | 說明 |
|------|------|
| Edit Budget | 每次優化有修改上限，防止過度改動破壞穩定技能 |
| Validation Gate | 修改前必須通過 Regression / Scope / Precision 三層測試 |
| Rejected Buffer | 未通過驗證的編輯不丟棄，等累積後進行結構性重組 |
| Fast Update | 單次執行後的即時微調（Mode A）|
| Slow Update | 跨 session 的結構性重組（Mode B）|

#### 如何觸發 / 使用

**4 個使用 Mode**

| Mode | 觸發時機 | 說明 |
|------|---------|------|
| A — Fast Update | 某個 skill 本次執行結果不完整或不準確 | Edit Budget: Conservative（≤ 3 處修改）|
| B — Slow Update | 同一個 skill 連續 3 次以上都有問題 | Edit Budget: Normal/Aggressive，完整三層驗證 |
| C — Description Opt | Skill 觸發頻率不對（漏觸發或誤觸發）| 調整 description 中的觸發關鍵字 |
| D — Merge | 發現兩個 skill 功能高度重疊 | 合併，舊的標 deprecated |

**觸發方式（對話中）**

```
# 方式 1：直接描述問題
「security-review 這個 skill 一直沒有 Java 的範例，幫我優化」
→ skill-opt agent 自動啟動，選 Mode A

# 方式 2：明確指定
「用 skill-opt Mode B 重構 api-design 這個 skill」

# 方式 3：搭配 skill-stocktake
先跑 skill-stocktake → 得到評估為 Improve 的 skill 清單
→ 對每個 Improve skill 啟動 skill-opt
```

**Edit Budget 選擇**

```
Conservative（預設）：≤ 3 處修改，每處 < 10 行
  → 適合：補一個步驟、修一個錯誤範例

Normal：≤ 5 處修改，每處 < 20 行
  → 適合：加入新技術棧對應、調整結構

Aggressive：允許完全重構
  → 必須有 rejected buffer 的積累作為依據
  → 必須通過完整三層 Validation Gate
```

**Skill Lifecycle 完整流程**

```
新建 → skill-creator
  ↓
評估 → skill-stocktake（Quick Scan / Full Stocktake）
  ↓
優化 → skill-opt（Mode A/B/C/D）
  ↓
退場 → description 加 [DEPRECATED] → 30 天觀察 → 刪除
```

**查看優化歷史**

```bash
cat vault/memory/skill-opt-log.md        # 已套用的優化
cat vault/memory/skill-opt-rejected.md   # 待下次 Slow Update 的候選
```

---

## 已知技術債

| 項目 | 影響 | 建議 |
|------|------|------|
| `PIXIU_CORE` 與 `PIXIU_CORE_PATH` 併存 | 不同工具可能讀不同母體路徑 | 後續統一命名，或在啟動文件明確定義優先序 |
| `setup.bat` 與 `setup_zh.bat` 職責不一致 | 使用者容易選錯安裝入口 | 保留一個主入口，另一個標成 legacy 或 wrapper |
| `SKILLS_INDEX.md` 數字仍偏舊 | 技能盤點會誤導 | 下次技能異動時一起翻修 |
| `Backup/` 內容龐大 | 打包分享可能帶出歷史或私人內容 | 分享前用 `pack-for-friend` 流程並人工檢查 |
| 多套工具設定分散 | Claude / Codex / Gemini / OpenCode 行為可能漂移 | 以 `user_rules.md` 與 Vault init 作為共同地基 |

## 相關文件

- [SKILLS_INDEX.md](SKILLS_INDEX.md)：技能分類索引，目前需要後續校準數量。
- [AGENTS.md](AGENTS.md)：ECC Agent 說明。
- [CODEX.md](CODEX.md)：Codex 審計協議。
- [CLAUDE.md](CLAUDE.md)：Claude Code 啟動協議。
- [PLUGIN_SCHEMA_NOTES.md](PLUGIN_SCHEMA_NOTES.md)：Plugin manifest 注意事項。
- [hooks/README.md](hooks/README.md)：Hook 觸發規則與自訂方式。
- [scripts/setup/README.md](scripts/setup/READ