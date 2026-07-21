# Core Evolution Gates Design

## 文件狀態

- 日期：2026-07-21
- 分支：`feature/core-evolution-gates`
- 基底：`master`
- 狀態：待使用者審閱
- 實作順序：Resource Identity Gate → MCP Compatibility Gateway → Pixiu Extension Package

## 目標

建立三個彼此隔離、可獨立驗證的核心能力：

1. 在任何外部 Repo、Skill、MCP 或 Plugin 進入候選池前驗證真實身分與來源。
2. 以相容層處理不同 MCP 協定版本、任務狀態、Schema 與棄用能力。
3. 以平台中立的 Package Manifest 封裝 Skill、Agent、Command、Workflow、工具與權限。

這三個模組只強化 PixiuCore 的治理與可移植性，不直接導入外部專案，也不取代現有 `repo-scan`、Hermes Durable Spool、DevSpace、Skill 路由或人工核准閘門。

## 全域約束

- 所有工作只能發生在 `feature/core-evolution-gates` 或由它建立的隔離 Worktree。
- 不直接修改、Commit、Push 或 Merge 到 `master`。
- 不下載、安裝或執行未經驗證的外部程式碼。
- 不接觸正式 Mem0、pgvector、憑證、Token、SSH Key 或正式資料。
- 外部來源必須固定完整 Commit SHA，並保存內容 Hash 與授權證據。
- 所有自動判斷只產生候選、報告或阻擋結果；正式導入仍需人工核准。
- 優先重用現有 `repo-scan`、Auto Research、DevSpace Worktree、治理規則與驗證迴圈。
- 新功能採 TDD；安全拒絕案例與正常案例同等重要。

---

# 1. Resource Identity Gate

## 問題

目前流程可在取得 Repo 後執行安全掃描，但仍缺少「這個資源是否真的是預期資源」的前置驗證。AI 可能產生不存在、拼錯、重新命名、被轉移或遭 Typosquatting 的 Repo／Skill 名稱。

若身分驗證晚於 Clone 或安裝，惡意來源已經進入候選執行邊界。

## 邊界

Resource Identity Gate 只負責：

- 將搜尋意圖解析為可驗證的候選來源。
- 驗證 Owner、Repository、版本與來源一致性。
- 產生不可變的來源證據。
- 決定候選是否能進入 `repo-scan`。

它不負責：

- 判斷程式碼是否安全。
- Clone 或執行外部 Repo。
- 自動核准導入。
- 修改正式核心。

## 資料流

```text
Auto Research 搜尋意圖
        ↓
Resource Resolver
        ↓
Resource Identity Gate
        ↓
Verified Source Evidence
        ↓
repo-scan／Skill Scanner
        ↓
DevSpace Candidate Worktree
```

## 輸入模型

```yaml
resource_request:
  category: skill | repository | mcp-server | plugin
  search_intent: string
  expected_capabilities:
    - string
  proposed_name: string | null
  proposed_url: string | null
  requested_by: automation | human | agent
```

Agent 可以提供搜尋意圖與候選名稱，但不能直接決定最終下載來源。

## 驗證項目

### Repository 身分

- Repository 必須由受控 Resolver 透過 GitHub API 或官方 Registry 解析。
- 保存 canonical owner、canonical repository、repository ID 與 canonical URL。
- 檢查 archived、disabled、visibility、default branch 與 redirect／rename 狀態。
- 若 proposed URL 與 canonical URL 不一致，標記 `REVIEW_REQUIRED`。

### Owner 信任訊號

- 保存 Owner 類型、帳號 ID 與建立時間。
- 檢查是否為預期官方組織或已知維護者。
- Owner 名稱相似但 ID 不一致時視為不同實體。
- 不以 Stars 或名稱相似度單獨判斷可信。

### 版本固定

- 只接受完整 40 字元 Commit SHA。
- Tag、Branch 與 Release 名稱只能作為解析輸入，不能作為最終執行版本。
- 保存 Commit SHA、Tree SHA、取得時間與內容 Hash。
- 來源更新時建立新候選，不覆蓋舊候選證據。

### Typosquatting 與 Redirect

- 對 Owner／Repo 名稱執行大小寫、連字號、底線、單字交換與編輯距離檢查。
- 發現近似官方名稱時提高風險，不自動選擇較熱門結果。
- Repository Redirect、Transfer 或 Rename 後必須重新驗證 Owner ID 與 Repo ID。

### 授權

- 保存 SPDX License ID 或明確標記 `UNKNOWN`。
- `UNKNOWN` 只能進入 Reference，不得 Integrate。
- License 變更時建立新的來源證據。

## 決策狀態

```text
VERIFIED
REVIEW_REQUIRED
REFERENCE_ONLY
REJECTED
```

- `VERIFIED`：可交給後續靜態掃描。
- `REVIEW_REQUIRED`：需人工確認來源異常。
- `REFERENCE_ONLY`：可閱讀，不可下載執行或整合。
- `REJECTED`：不得進入候選池。

## 輸出模型

```yaml
verified_source:
  request_id: string
  category: string
  canonical:
    owner: string
    owner_id: string
    repository: string
    repository_id: string
    url: string
  version:
    commit_sha: string
    tree_sha: string
    content_hash: string
  license:
    spdx_id: string | UNKNOWN
    evidence_source: string
  checks:
    redirect: PASS | WARN | FAIL
    typosquat: PASS | WARN | FAIL
    owner_identity: PASS | WARN | FAIL
    commit_pin: PASS | FAIL
    license: PASS | WARN | FAIL
  decision: VERIFIED | REVIEW_REQUIRED | REFERENCE_ONLY | REJECTED
  evidence_created_at: ISO-8601
```

## 失敗處理

- GitHub／Registry 不可用：回傳 `UNRESOLVED`，不改用搜尋引擎結果直接下載。
- 找不到完整 Commit SHA：拒絕進入 DevSpace。
- Canonical 身分不一致：停在人工核准。
- License 不明：降級為 Reference。
- 雙重解析結果不一致：拒絕並保留兩份證據。

## 測試重點

- 不存在的 Repo 被拒絕。
- 拼字相近的惡意 Repo 觸發警告。
- Tag 被重新指向時，舊候選仍保持原 SHA。
- Repo Rename／Transfer 觸發重新驗證。
- License 不明不能進入 Integrate。
- Agent 提供的 URL 不會直接成為下載來源。

---

# 2. MCP Compatibility Gateway

## 問題

不同 Client、Server 與工具可能支援不同 MCP 規格版本、Schema 能力、任務生命週期與授權模式。若逐一修改每個 MCP Server，會造成平台綁定、重複邏輯與升級風險。

## 邊界

Gateway 只負責：

- 協定版本協商與 Feature Flag。
- Tool Input／Output Schema 驗證。
- 任務狀態映射。
- Trace Context 傳遞。
- 棄用能力偵測與相容性報告。

Gateway 不負責：

- 取代 Hermes Durable Spool。
- 儲存正式業務狀態。
- 自動升級所有 MCP Server。
- 繞過既有工具權限。

## 架構

```text
Codex／Claude／Gemini／Hermes
              ↓
    MCP Compatibility Gateway
              ↓
  Version Adapter／Schema Validator
              ↓
舊 MCP Server           新 MCP Server
```

## Version Policy

```yaml
mcp_policy:
  stable_version: current-production-version
  experimental_versions:
    - "2026-07-28"
  allow_downgrade: true
  allow_experimental_in_production: false
  unsupported_version_action: reject
```

正式切換前，`2026-07-28` 必須位於 Feature Flag 後方。沒有共同版本時明確拒絕，不猜測或靜默降級。

## 執行 Context

每次工具呼叫都攜帶明確識別資訊：

```yaml
execution_context:
  trace_id: string
  task_id: string
  workspace_id: string | null
  candidate_id: string | null
  run_id: string | null
  actor: string
  protocol_version: string
```

這些 ID 只傳遞既有狀態，不由 Gateway 取代 Durable Store。

## Task 狀態映射

```text
queued
running
input_required
waiting_approval
completed
failed
cancelled
```

Hermes 仍是任務狀態的唯一真相；Gateway 只提供 MCP Task Adapter，將內部狀態轉成標準介面。

## Schema 驗證

所有核心工具至少驗證：

- 必填 Context ID。
- 允許與禁止路徑。
- 禁止操作清單。
- Network Policy。
- Secret Policy。
- Candidate Worktree 邊界。

範例：

```json
{
  "type": "object",
  "required": ["taskId", "allowedPaths", "prohibitedActions"],
  "properties": {
    "taskId": { "type": "string", "minLength": 1 },
    "workspaceId": { "type": ["string", "null"] },
    "allowedPaths": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1
    },
    "prohibitedActions": {
      "type": "array",
      "items": { "type": "string" },
      "contains": { "const": "formal-core-write" }
    }
  },
  "additionalProperties": false
}
```

## Trace

同一條核心演化流程共用 Trace：

```text
排程 → Auto Research → Source Gate → DevSpace → Worker → Reviewer → 人工核准
```

Trace 必須能回答：

- 候選由哪個來源與 Commit 產生。
- 哪個 Agent 執行了什麼工具。
- 哪個 Reviewer 判定通過或拒絕。
- 是否發生協定降級、Schema 拒絕或權限阻擋。

## Deprecated Capability Scanner

只產生報告，不自動修改：

- 檢查舊版 Session 假設。
- 檢查 Roots、Sampling、Logging 等待棄用能力。
- 檢查 Tool Schema 相容性。
- 檢查版本協商與錯誤處理。
- 檢查 Server 是否依賴隱含狀態。

## 失敗處理

- 沒有共同協定版本：拒絕並列出 Client／Server 支援版本。
- Schema 驗證失敗：工具不執行，保存最小錯誤證據。
- Trace Context 缺漏：建立阻擋事件，不自行補假 ID。
- Experimental Feature 在正式環境被要求：拒絕。
- Adapter 轉換可能遺失語意：回傳 `REVIEW_REQUIRED`。

## 測試重點

- 新舊 Client／Server 的版本矩陣。
- 無共同版本時拒絕。
- Feature Flag 關閉時不能使用實驗規格。
- Schema 缺欄位、額外欄位與禁止操作測試。
- Hermes 狀態映射不改變原始狀態。
- Trace 跨多個工具仍保持同一 `trace_id`。

---

# 3. Pixiu Extension Package

## 問題

現有能力分散於 Skills、Agents、Commands、Rules、Hooks、Workflows 與 MCP Configs。單獨搬移 Skill 或修改其中一個檔案時，可能遺漏依賴、權限、驗收條件或平台 Adapter。

## 原則

建立 Pixiu 自有、平台中立的 Package Manifest；OpenAI Plugin、Claude Skill、Gemini Instruction 與 MCP Tool 都只是輸出 Adapter。

不可把 PixiuCore 的內部模型改成任何單一廠商專用格式。

## Package 邊界

Package 可以宣告：

- Skills
- Agents
- Commands
- Workflows
- Rules
- Hooks
- Tool／MCP Dependencies
- Roles
- Permissions
- Quality Gates
- Provenance

Package 不直接保存：

- Secret 值
- 使用者憑證
- 正式執行狀態
- Agent 對話內容

## Manifest

```yaml
api_version: pixiu.dev/v1
kind: ExtensionPackage

metadata:
  id: repo-security-assessment
  version: 1.0.0
  description: 外部 Repository 安裝前安全評估
  license: internal
  source_commit: full-commit-sha
  content_hash: sha256-value

capabilities:
  skills:
    - repo-scan
  agents:
    - security-reviewer
  commands:
    - repo-scan
  workflows:
    - external-resource-review
  rules:
    - external-resource-policy

provenance:
  repository: owner/repository
  commit_sha: full-commit-sha
  content_hash: sha256-value
  retrieved_at: ISO-8601
  local_modifications: false

dependencies:
  required_tools:
    - github-read
    - devspace-read
  optional_tools: []
  required_packages: []

permissions:
  filesystem:
    read:
      - candidate-workspace
    write:
      - candidate-reports
  network:
    allow:
      - api.github.com
  secrets: []
  formal_core_write: false

roles:
  auto_install: []
  available:
    - security-reviewer
    - codex-worker

quality_gates:
  minimum_score: 85
  required_tests:
    - manifest-schema
    - trigger-tests
    - injection-tests
    - permission-tests
    - provenance-tests
```

## Registry

Package Registry 應能判斷：

- 相同 Package 的不同版本。
- 同名 Skill 來自不同 Package。
- 全域與專案層 Package 的優先級。
- 相同 Capability 的重複與衝突。
- Package 是否缺少必要工具或權限。
- Package 的來源是否已通過 Resource Identity Gate。

## Adapter

```text
Pixiu Extension Package
├── Codex Adapter
├── Claude Adapter
├── Gemini Adapter
├── OpenAI Plugin Adapter
└── MCP Adapter
```

第一階段只定義介面與驗證，不一次實作所有 Adapter。優先輸出目前核心真正需要的 Codex／Claude／Gemini 路由資訊。

## 安裝政策

- `auto_install` 預設空集合。
- Package 啟用需經人工核准。
- Permission 不得因 Adapter 限制而被放寬。
- Adapter 不支援某項權限時，拒絕輸出，不以註解代替安全控制。
- Package 更新建立新版本，不覆寫已使用版本。

## 失敗處理

- Manifest Schema 不合法：拒絕註冊。
- Capability 名稱衝突：要求明確優先級或重新命名。
- Provenance 缺失：只允許 Internal Draft，不得發布。
- Adapter 無法表達 Permission：拒絕產生 Adapter。
- Quality Gate 未通過：保持 Candidate，不進 Active Registry。

## 測試重點

- Manifest 正常與錯誤案例。
- Package 版本與衝突解析。
- Permission 不可被 Adapter 放寬。
- Provenance 與 Resource Identity Gate 證據一致。
- 同一 Package 產生不同 Adapter 時，核心能力與限制一致。

---

# 整合後資料流

```text
公開論壇／GitHub／官方 Registry
              ↓
     Resource Identity Gate
              ↓
         Auto Research
              ↓
      repo-scan／安全掃描
              ↓
       Candidate Worktree
              ↓
     Pixiu Extension Package
              ↓
      Permission／Role Policy
              ↓
    MCP Compatibility Gateway
              ↓
Codex／Claude／Gemini／Hermes／DevSpace
```

# 實作分期

## Phase 1：Resource Identity Gate

最小可交付內容：

- Source Request／Evidence Schema。
- GitHub Resolver 介面。
- Commit Pin、Canonical Identity、License 與 Typosquat 判斷。
- CLI 或腳本形式的唯讀驗證入口。
- 正常、拼字攻擊、Redirect、License Unknown 測試。

完成條件：未通過身分驗證的來源不能進入 `repo-scan` 或 DevSpace。

## Phase 2：MCP Compatibility Gateway

最小可交付內容：

- Version Policy 與 Feature Flag。
- Execution Context Schema。
- Task Status Adapter。
- Tool Schema Validator。
- Compatibility Matrix 與 Deprecated Capability Report。

完成條件：任何工具執行前都能驗證版本、Context 與安全欄位，且不改變 Hermes 的狀態真相。

## Phase 3：Pixiu Extension Package

最小可交付內容：

- Package Manifest Schema。
- Registry Validator。
- Capability／Permission 衝突檢查。
- Provenance 驗證。
- 一個既有能力的示範 Package，不全面搬移所有 Skills。

完成條件：示範 Package 能被驗證、版本化並輸出至少一種 Adapter，且 Permission 不被放寬。

# 不在本次範圍

- 自動 Merge 到 `master`。
- 自動安裝外部 Repo 或 Skill。
- 直接接正式 Mem0／pgvector。
- 全面升級所有 MCP Server。
- 移除舊 MCP 版本支援。
- 取代 Hermes Durable Spool。
- 一次封裝全部既有 Skills／Agents。
- 建立公開 Plugin Marketplace。

# 驗收準則

1. 所有變更存在 `feature/core-evolution-gates`，`master` 不變。
2. 外部來源沒有完整 Commit SHA 時不能進入 DevSpace。
3. Resource Identity Gate 能阻擋不存在、近似拼字與 Redirect 未複核來源。
4. MCP Gateway 能拒絕無共同版本、錯誤 Schema 與缺少安全 Context 的工具呼叫。
5. Extension Package 能驗證 Provenance、Permission、版本與 Capability 衝突。
6. 每個模組有獨立單元測試與失敗案例。
7. 不新增不必要依賴；新增依賴必須另行取得使用者核准。
8. 不 Commit、Push、Merge 到 `master`；合併由使用者最終決定。
