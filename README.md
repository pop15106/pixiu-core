# PixiuCore 母艦

> 跨 AI 工具的治理母體：集中維護規則、技能、指令、Hooks、Vault 記憶與 Fleet 專案清單。

PixiuCore 的目標不是把每個 AI 工具改成同一個樣子，而是讓 Claude Code、Codex、Gemini、Cursor、Windsurf、OpenCode 等工具都先遵守同一份工程憲法，再依各自能力執行任務。這份 README 是入口地圖；細節請看各子目錄文件。

## 目前狀態

盤點日期：2026-08-09
盤點路徑：PixiuCore

| 項目 | 現況 |
|------|------|
| Plugin | `everything-claude-code` v1.8.0 |
| Fleet 專案 | `fleet.json` 為本機私有清單，路徑數量未納入本次公開盤點 |
| 頂層 Agents | 27 個，位於 `agents/` |
| ECC Agents | 29 個，位於 `.agent/agents/` |
| Slash Commands | 59 條，位於 `commands/` |
| ECC Workflows | 79 條，位於 `.agent/workflows/` |
| Capability Router | 13 個 Capability，單次需求硬上限 3 個 |
| Canonical Skills | 89 個目錄型 Skill，位於 `skills/`；加上根層 `INDEX.md` 後 validator 共檢查 90 個 |
| ECC Skills | 149 個有效 Skill，位於 `.agent/skills/` |
| OpenAI 可攜 Skills | 87 個，位於 `.agents/skills/` |
| Rules | 102 條 Markdown 規則，位於 `rules/` 與 `.agent/rules/` |
| Governance | 11 份入口、判準、派工、維護與稽核文件，位於 `vault/governance/` |
| Automation Scripts | 143 個檔案，分布於 `scripts/` 的安裝、同步、路由、驗證、DevSpace 與 Workflow 工具 |
| Vault | 已啟用，包含 `bootstrap/`、`capabilities/`、`governance/`、`identity/`、`memory/`、`projects/`、`context/`、`sop/`、`after-action/`、`templates/` |
| 最近明顯新增 | 2026-08-09：母體瘦身、Skill 8+81 分層、最小實作梯、跨 AI Agent Team 三模式、Workflow Lab、全域入口同步、DevSpace watchdog／手動重連，以及 93 項 OneClick／Discovery 回歸保障 |

> 注意：目前啟動規則優先讀 `PIXIU_CORE`，`PIXIU_CORE_PATH` 保留作相容別名；初始化器會同時設定兩者。部分 legacy 工具仍先讀舊名稱，移除前要先完成入口對齊。

## Quick Start（新人第一步）

> Clone 完後依序執行，5 分鐘內讓母體正常運作。

### Step 1：初始化母體環境變數

```bat
setup_zh.bat
```

執行後重新開啟終端機與 IDE，讓 `%PIXIU_CORE%` 與相容用的 `%PIXIU_CORE_PATH%` 生效。

### Step 2：同步低 Token 全域入口

將 Codex、Claude 與 Gemini 的使用者層入口改成短橋接檔；每個 Session 再由母體 Router 按需求載入能力：

```powershell
powershell -ExecutionPolicy Bypass -File "scripts\entry-sync\Sync-PixiuGlobalEntries.ps1" -Action Apply -ConfirmApply
```

這個工具只管理三個使用者層入口，套用前會先備份並驗證；不會修改 hooks、junction 或 DevSpace。

### Step 3：安裝 Claude Code hooks & skills

需要 PowerShell 7+（`pwsh`）：

```powershell
pwsh -File "scripts\setup\install-to-cli.ps1"
```

### Step 4：初始化 Cybersecurity Library submodule

```bash
git submodule update --init --recursive
```

完成後 `skills/cybersecurity-library/` 會有 754 個資安技能。

### Step 5：建立 fleet.json（選用）

`fleet.json` 不在 repo 內（含個人路徑），需自行建立：

```json
[
  "%PROJECT_ROOT%\\專案A",
  "%PROJECT_ROOT%\\專案B"
]
```

放在 repo 根目錄即可。

### Step 6：設定 SECOND_BRAIN_PATH（選用）

若要使用 `second-brain-health-check` skill，需設定環境變數：

```powershell
[System.Environment]::SetEnvironmentVariable("SECOND_BRAIN_PATH", "$env:USERPROFILE\Documents\second-brain", "User")
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
| `AGENTS.md` | PixiuCore 專案治理與能力路由入口 |
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
| `setup_zh.bat` | Windows 中文包裝入口；呼叫 `Tools/pixiu-init.ps1` 建立穩定 junction、設定 `PIXIU_CORE`／`PIXIU_CORE_PATH`，並初始化各工具入口 |
| `setup.bat` | 與中文版使用相同初始化器的英文包裝入口 |
| `scripts/entry-sync/Sync-PixiuGlobalEntries.ps1` | 將 Codex、Claude、Gemini 使用者層入口同步為 Router-first 短橋接檔；套用前備份並支援受控還原 |
| `scripts/setup/bootstrap.ps1` | 新機器的一鍵部署入口：初始化 submodule、環境變數、junction、Claude Code 與 Codex 接線 |
| `scripts/setup/install-to-cli.ps1` | 將 Pixiu commands、skills、hooks 接到 `~/.claude/`，讓 Claude Code CLI 能看到母體能力 |
| `scripts/setup/uninstall-from-cli.ps1` | 回滾 Claude Code CLI 注入，不動母體原始檔 |
| `uninstall.bat` | 移除 Pixiu 對使用者環境的整合設定 |

安裝後請重新開啟終端機與 VS Code，讓使用者層級環境變數生效。

### Fleet 同步

`fleet.json` 是不進版控的本機私有專案清單，實際數量與路徑依裝置而異。日常同步工具在 `Tools/`：

- `Tools\sync-pixiu-fleet.ps1`
- `Tools\一鍵母艦同步.bat`
- `Tools\pixiu-init.ps1`
- `Tools\fleet-agent-cleanup.ps1`

同步前先確認目標專案與母體方向，避免把舊規則覆蓋新規則。

## Session 啟動規則

每次 AI Session 開始時：

1. 依序解析 `PIXIU_CORE`、`PIXIU_CORE_PATH`、`%USERPROFILE%\.pixiu-core`。
2. 只讀 `vault/bootstrap/SESSION-BOOTSTRAP.md` 的常駐硬閘門。
3. 執行 `node scripts/router/resolve-capabilities.js "<本次需求>"`。
4. 只讀 Router 回傳的 `filesToLoad`，最多選 3 個 Capability。
5. Router 無法執行時，才以 `vault/capabilities/capability-manifest.json` 作降級索引；不得退回全文載入 identity、memory、全部 Skills 或治理文件。
6. 修改後執行與本次改動相符的最小充分驗證，並如實回報未驗證項目。

## 母體瘦身：低 Token、按需載入、最小實作

這裡的「瘦身」不是移除治理或安全，而是降低每個 Session 的固定 Context、重複 Skill 與不必要實作。安全閘門、錯誤處理、驗證、審批與使用者指定行為不得因瘦身而省略。

| 機制 | 現在的做法 | 效果 |
|------|------------|------|
| Router-first 啟動 | 常駐 `SESSION-BOOTSTRAP.md`，再由需求命中最多 3 個 Capability | 不再開場全文載入規則、身份、記憶、Skills、Workflows、Hooks 與 Agents |
| Skill 分層 | `skills/` 分成 8 個高優先路由能力與 81 個參考能力；正常 Session 不全文讀 `skills/INDEX.md` | 保留 89 個 canonical Skill，但只載入本次需要的檔案 |
| 發佈層去重 | `skills/` 是 canonical，`.agents/skills/` 是 OpenAI／Codex 可攜發佈層 | DevSpace canonical suppression 將有效同名 collision 壓到 0，不刪可攜能力 |
| 記憶按需 | 只有涉及舊決策、前次進度或跨 Session 經驗時，才從 `SESSION-INDEX.md` 追到原文 | recap、decision 與完整 memory 不再成為每次啟動底噪 |
| 最小實作梯 | 依序檢查：不用新增 → repo 已有 → 標準庫 → 原生平台 → 既有依賴 → 更小共用點 → 最小正確實作 | 減少額外檔案、依賴、抽象與重複程式碼 |

### 2026-08-09 驗證基線

| 驗證項目 | 實測結果 | 門檻／判定 |
|----------|----------|-------------|
| Codex 常駐入口 | 6,705 bytes／124 行 | ≤ 8 KB，通過 |
| Claude 常駐入口 | 3,939 bytes／76 行 | ≤ 6 KB，通過 |
| Gemini 常駐入口 | 3,963 bytes／76 行 | ≤ 6 KB，通過 |
| Skill collision | Raw 87／Effective 0 | canonical suppression 生效 |
| OneClick／Discovery | 93 passed／0 failed | 包含 SHA-256、junction、大小寫別名、讀取競態與安全 restore |
| Entry Sync | 41 passed／0 failed | Codex、Claude、Gemini 短入口同步與還原通過 |
| Skill metadata | Canonical 90／Portable 87 | YAML、唯一名稱與必要欄位通過 |
| Capability Router | 13 個 Capability；單次最多 3 個 | 無命中或 Manifest 故障時不退回全量載入 |

完整架構與量測門檻見 `docs/architecture/pixiu-lazy-loading.md`；實作範圍判斷以 `vault/governance/minimal-implementation-ladder.md` 為準。可用下列命令驗證啟動預算、Router、Skill metadata、collision 與 Manifest 引用：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/performance/run-lazy-loading-tests.ps1
```

## Agent Team 與 Subagent

Agent Team 是跨 AI 的受控執行模式，不是預設行為。Claude、Codex、Gemini 或其他工具可以使用各自原生的 subagent／agent／thread 能力，但共同遵守 `vault/governance/agent-team-mode-policy.md`。

| 模式 | 適合情境 | 同時執行上限 |
|------|----------|----------------|
| 平衡（推薦） | 一般跨模組工作，在品質、速度與成本之間取平衡 | 3 個 subagent |
| 省錢 | 邊界清楚、可由較低階模型完成的工作 | 2 個 subagent |
| 品質優先 | 架構、安全、DB、複雜根因或高風險驗收 | 3 個 subagent |

啟動規則：

- 只說「啟動 agent team」時，AI 先詢問平衡／省錢／品質優先／自訂模式，不得立即派工。
- 同一句已指定模式時，AI 先顯示派工表，再啟動本任務；授權不跨任務或 Session 沿用。
- 「你建議要開 agent team 嗎？」只代表諮詢，不是派工授權。
- 小型問答、單檔修改或單一路徑文件調整留在主 Agent；只有可獨立並行的跨模組探索、實作、測試或審查才建議組隊。
- 每個 subagent 只取得精簡任務包：目標、允許路徑、禁止事項、必要來源、驗收條件與回報格式，不重讀完整母體。
- 寫入型 worker 的檔案白名單必須互斥；writer 不驗自己的成果，最終結果由 fresh-context 角色或可重現測試獨立驗收。
- 模式不等於刪檔、DB 寫入、套件安裝、母體寫入或外部推送的授權；這些動作仍各自受 L0 閘門約束。
- 環境沒有 subagent 能力時，退化為單體分段執行，不宣稱已啟動 Agent Team。

模型名稱與可用 effort 會隨平台改變，README 不複製易過時清單；執行前依 `vault/governance/model-dispatch-rules.md` 驗證當下可用能力並套用降級規則。

## Web 測試控制台

本機可用 Web UI 分別執行 Core Evolution、Manual Recap、Auto Recap、Lazy Loading、DevSpace OneClick、Repository Safety，或一鍵執行完整整合測試：

```powershell
node scripts/test-console/server.js --open
```

預設網址為 `http://127.0.0.1:8787`。控制台不新增 npm 依賴、只監聽 loopback，且瀏覽器只能呼叫固定白名單模組，不能傳入任意命令。完整使用方式與自動測試入口見 `scripts/test-console/README.md`。

## Workflow Lab

角色型 Workflow Lab 可輸入需求或商業邏輯，分別執行轉譯器、PM、SA、SD、PG、QA、檢核官、文件、Need-to-Know 與人工核准，也能勾選部分流程或執行完整 AI SDLC：

```powershell
node scripts/workflow-lab/server.js --open
```

預設網址為 `http://127.0.0.1:8792`。Offline Contract 不呼叫模型；Live Smoke 會為每個角色建立獨立 `codex exec --ephemeral` Session，PG 只有在人工核准後才能建立隔離 Worktree，且一律禁止 Push、Merge、Deploy、DB 寫入與依賴變更。母體路徑可由 `PIXIU_CORE`／`PIXIU_CORE_PATH` 指定，一般專案白名單可用 `PIXIU_PROJECT_ROOTS` 設定多個根目錄。完整模組、單模組 Fixture、RED 退回、安全與測試方式見 `scripts/workflow-lab/README.md`。

## 維護原則

- 不直接整包載入母體，只讀任務需要的 rules、skills、memory、context。
- 瘦身只減少固定載入與不必要實作，不得刪減安全、驗證、錯誤處理或審批。
- Agent Team 只有在使用者明確選定模式後才能派工；subagent 只接收精簡任務包。
- `vault/identity/` 與 `vault/memory/` 含個人資料，分享或打包前要清理。
- 新增 skill 時，同步檢查 `skills/`、`.agent/skills/`、`.agents/skills/` 是否都需要更新。
- 修改 `.agent/`、`user_rules.md`、流程閘門或 AI 約束時，完成後要詢問是否同步回正式母體。
- `skills/INDEX.md` 是人類可讀的 Skill 單一真源；根 `SKILLS_INDEX.md` 只作導覽與當期盤點，不維護第二份完整清單。

## 快速盤點指令

在 PowerShell 內可用以下指令重新計數：

```powershell
$root = if ($env:PIXIU_CORE) {
    $env:PIXIU_CORE
} elseif ($env:PIXIU_CORE_PATH) {
    $env:PIXIU_CORE_PATH
} else {
    Join-Path $env:USERPROFILE ".pixiu-core"
}
(Get-ChildItem -File "$root\agents").Count
(Get-ChildItem -File "$root\commands").Count
(Get-ChildItem -Directory "$root\skills" | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") }).Count
(Get-ChildItem -Directory "$root\.agents\skills").Count
(Get-ChildItem -File "$root\.agent\workflows" -Filter "*.md").Count
(Get-ChildItem -File -Recurse "$root\rules", "$root\.agent\rules" | Where-Object Extension -eq ".md").Count
((Get-Content -Raw -Encoding UTF8 "$root\vault\capabilities\capability-manifest.json" | ConvertFrom-Json).capabilities).Count
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
| `PIXIU_CORE` 與 `PIXIU_CORE_PATH` 併存 | 新流程已統一優先序，但部分 legacy 工具仍先讀舊名稱 | 初始化器暫時同時設定兩者；完成所有入口對齊後再移除相容別名 |
| 初始化、工具接線與短入口同步分散在不同腳本 | 只跑部分步驟時，全域入口或 hooks 可能仍是舊版 | 依 Quick Start 執行；後續再收斂為單一總入口 |
| Canonical 與 portable Skill 發佈層可能漂移 | 宿主可能載入過期或重複能力 | 以 `skills/` 為 canonical，執行 metadata validator 與 Lazy Loading collision gate |
| `Backup/` 內容龐大 | 打包分享可能帶出歷史或私人內容 | 分享前用 `pack-for-friend` 流程並人工檢查 |
| 多套工具設定分散 | Claude / Codex / Gemini / OpenCode 行為可能漂移 | 以 `user_rules.md` 與 Vault init 作為共同地基 |

## 相關文件

- [SKILLS_INDEX.md](SKILLS_INDEX.md)：技能索引入口與當期盤點；完整分類以 `skills/INDEX.md` 為準。
- [vault/bootstrap/SESSION-BOOTSTRAP.md](vault/bootstrap/SESSION-BOOTSTRAP.md)：低 Token Session 的常駐硬閘門與 Router 入口。
- [docs/architecture/pixiu-lazy-loading.md](docs/architecture/pixiu-lazy-loading.md)：母體瘦身架構、量測門檻與回滾方式。
- [skills/INDEX.md](skills/INDEX.md)：8+81 Skill 人工索引；正常 Session 仍先走 Router。
- [vault/governance/minimal-implementation-ladder.md](vault/governance/minimal-implementation-ladder.md)：實作前最小化梯。
- [vault/governance/agent-team-mode-policy.md](vault/governance/agent-team-mode-policy.md)：跨 AI Agent Team 三模式、啟動閘門與 subagent 邊界。
- [vault/governance/model-dispatch-rules.md](vault/governance/model-dispatch-rules.md)：模型、effort、升降級與驗收規則。
- [AGENTS.md](AGENTS.md)：PixiuCore 專案治理與能力路由入口。
- [CODEX.md](CODEX.md)：Codex 審計協議。
- [CLAUDE.md](CLAUDE.md)：Claude Code 啟動協議。
- [PLUGIN_SCHEMA_NOTES.md](PLUGIN_SCHEMA_NOTES.md)：Plugin manifest 注意事項。
- [hooks/README.md](hooks/README.md)：Hook 觸發規則與自訂方式。
- [scripts/setup/README.md](scripts/setup/README.md)：安裝、bootstrap 與解除安裝腳本說明。
