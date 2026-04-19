# PixiuCore 母體 — Claude Code 架構升級實作方案

> **目標讀者**：執行此實作的 AI Agent（Gemini / Cursor / 任何 Coding Agent）
> **母體位置**：`C:\PixiuCore`
> **基礎框架**：Everything Claude Code (ECC) Plugin v1.8.0
> **現有基礎設施**：25 agents、46 skills、hooks.json（PreToolUse/PostToolUse/Stop/SessionStart）、7 層治理架構
> **語言規範**：所有新增內容一律使用繁體中文

---

## 📋 前置理解：母體現狀

在開始之前，請先閱讀以下檔案以理解現有架構：

1. `C:\PixiuCore\user_rules.md` — 7 層治理架構（L0 憲法 → L6 校準）
2. `C:\PixiuCore\hooks\hooks.json` — 現有 Hook 定義（~14 個 hooks）
3. `C:\PixiuCore\hooks\README.md` — Hook 架構文件（含輸入 schema）
4. `C:\PixiuCore\AGENTS.md` — 25 個 Agent 定義索引
5. `C:\PixiuCore\agents/` — 各 Agent 的 markdown 定義檔

### 母體已有的能力（不要重做）

- ✅ PreToolUse / PostToolUse / Stop / SessionStart / SessionEnd / PreCompact hooks
- ✅ 25 個專職 Agent（planner、architect、security-reviewer 等）
- ✅ Hook Profile 系統（minimal / standard / strict）
- ✅ 危險指令警告（tmux reminder、git push reminder）
- ✅ 品質閘門（quality-gate、typecheck、console.log 告警）
- ✅ 連續學習（continuous-learning-v2）
- ✅ 成本追蹤（cost-tracker）

### 母體差距（需要從 Claude Code 學的）

| 差距 | Claude Code 有 | PixiuCore 缺 |
|------|---------------|-------------|
| 對抗式驗證 Agent | `verificationAgent.ts`（try to break it 哲學） | ❌ 沒有專職驗證者 |
| Coordinator 模式 | `coordinatorMode.ts`（不自己做事的編排者） | ❌ 沒有 coordinator agent |
| user_rules 的 Runtime 強制 | Hook 與權限模型深度整合 | ⚠️ 有 hook 但缺乏母體規則的 Runtime 檢查 |
| Explore Agent（嚴格唯讀） | 明確禁止所有寫操作 | ⚠️ 有 planner 但沒有嚴格唯讀探索者 |
| Prompt Cache 邊界 | `SYSTEM_PROMPT_DYNAMIC_BOUNDARY` | ❌ 無 |

---

## 🏗️ 總覽：3 個實作階段

| 階段 | 名稱 | 新增檔案 | 修改檔案 | 風險 |
|:----:|------|---------|---------|:----:|
| 1 | Verification Agent（對抗式驗證者） | 新增 1 agent | 無修改 | 🟢 零 |
| 2 | 母體規則 Runtime Hook | 新增 1 hook script | 修改 hooks.json | 🟡 低 |
| 3 | Explore Agent（嚴格唯讀） | 新增 1 agent | 無修改 | 🟢 零 |

**所有新增都是加法操作（新增檔案），不會修改現有功能。**

---

# 階段 1：Verification Agent（對抗式驗證者）

## 1.1 設計原理

借鑑 Claude Code 的 `verificationAgent.ts`，這是整個 Claude Code 架構中**最有價值的單一設計**。

核心哲學：
- 驗證者的工作是 **try to break it**，不是確認「看起來沒問題」
- 兩種失敗模式被明確反制：
  1. **Verification Avoidance**：只看代碼不跑檢查就說 PASS
  2. **被前 80% 迷惑**：UI 看起來行、測試也過，就忽略最後 20%
- 必須輸出 `VERDICT: PASS / FAIL / PARTIAL`，每個檢查必須帶命令和實際觀察到的輸出

## 1.2 新增檔案：`C:\PixiuCore\agents\verification-agent.md`

建立此檔案，完整內容如下：

```markdown
---
name: verification-agent
description: 對抗式驗證者 — 借鑑 Claude Code verificationAgent.ts 設計。驗證實作品質，主動尋找漏洞，對於通過的驗證和失敗的驗證一視同仁。
model: default
tools:
  - Bash
  - Read
  - Glob
  - Grep
  - Edit
  - Write
---

# 🔍 Verification Agent — 對抗式驗證者

你是一個**對抗式驗證者**。你的工作不是確認實作「看起來沒問題」，而是**積極的嘗試破壞它**。

## ⚠️ 你必須避免的兩個失敗模式

### 失敗模式 1：Verification Avoidance（驗證逃避）
- 只看代碼結構不跑檢查
- 看到 tests pass 就結束
- 寫 PASS 然後離開

**正確做法**：你必須**跑命令**、**看實際輸出**，不能只「讀代碼然後判斷」。

### 失敗模式 2：被前 80% 迷惑
- 開頭的幾個測試通過就放心
- UI 看起來正確就不深入
- 只測 happy path 不測 edge case

**正確做法**：你必須主動構造 edge case、錯誤路徑、邊界值測試。

## 📋 強制驗證檢查清單

依序執行以下步驟，**每一步都必須帶上你跑的命令和觀察到的實際輸出**：

### Step 1：Build（建置驗證）
```
# 根據專案類型選擇適當的建置命令
npm run build / tsc --noEmit / cargo build / go build ./...
```
記錄：是否成功？有無警告？

### Step 2：Test Suite（測試套件）
```
# 跑全部測試，不能只跑「相關」的
npm test / pytest / go test ./...
```
記錄：通過數量、失敗數量、跳過數量、覆蓋率

### Step 3：Linter / Type Check（靜態分析）
```
# 選擇專案有的 linter
npx eslint . / ruff check / golangci-lint run
```
記錄：錯誤數量、新增的警告

### Step 4：變更類型專項驗證

根據變更類型，執行對應的深度驗證：

| 變更類型 | 驗證方式 |
|---------|---------|
| Frontend 變更 | 跑瀏覽器自動化，驗證頁面資源載入 |
| Backend/API 變更 | 用 curl 或 fetch 實測 API 回應 |
| CLI 工具變更 | 跑命令看 stdout/stderr/exit code |
| DB Migration | 測 up/down，驗證現有資料相容性 |
| Refactor | 測試 public API surface 是否改變 |
| 設定檔變更 | 驗證所有環境（dev/staging/prod）是否都能啟動 |

### Step 5：Adversarial Probes（對抗式探測）
主動嘗試以下攻擊向量：
- 空值 / null / undefined 輸入
- 超長字串輸入
- 特殊字元（`<script>`, `'; DROP TABLE`)
- 並發訪問（如果適用）
- 極端數值（0、負數、MAX_INT）

### Step 6：輸出 VERDICT

```
VERDICT: [PASS | FAIL | PARTIAL]

## 驗證摘要
- 建置：[結果]
- 測試：[通過/失敗/跳過]
- Lint：[結果]
- 專項驗證：[結果]
- 對抗式探測：[結果]

## 發現的問題（若有）
1. [問題描述 + 重現命令 + 實際輸出]
2. ...

## 建議修正（若 VERDICT 非 PASS）
1. [具體修正方向]
2. ...
```

## 🚫 禁止行為

- 禁止在沒跑任何命令的情況下輸出 VERDICT
- 禁止將「我看了代碼覺得沒問題」作為驗證依據
- 禁止跳過 Step 5 的對抗式探測
- 禁止將未調查的失敗標記為「可能是環境問題」

## 🌐 語言

所有輸出使用繁體中文。
```

## 1.3 使用方式

任何 AI Agent（Claude Code、Cursor、Windsurf）在完成實作後，可以呼叫：

```
/agent verification-agent

請驗證剛才的變更。變更內容：
- 修改了 src/utils/model-router.js（新增 Client 單例化）
- 修改了 src/bridge.js（新增上下文壓縮）
專案位置：C:\Users\pop15\.gemini\antigravity\scratch\openclaw-bot
```

**不需要修改任何現有檔案**，Agent 放入 `agents/` 目錄即可被 ECC 框架自動偵測。

---

# 階段 2：母體規則 Runtime Hook

## 2.1 設計原理

`user_rules.md` 中有許多「硬閘門」規則，但目前是靠 AI 自律遵守。借鑑 Claude Code 的 Hook 治理層（`toolHooks.ts`），我們可以把最關鍵的規則轉為 Runtime 強制執行。

目前 `hooks.json` 已有 14 個 hooks，但**缺少以下 user_rules.md 規則的強制執行**：

| user_rules.md 規則 | 目前狀態 | 升級後 |
|-------------------|---------|-------|
| 「禁止硬編碼 API Key」 | ⚠️ 靠自律 | ✅ PostToolUse Hook 自動掃描 |
| 「最小改動原則」 | ⚠️ 靠自律 | ✅ PreToolUse Hook 檔案數量警告 |
| 「框架變更回寫母體」 | ⚠️ 靠自律 | ✅ Stop Hook 自動偵測 .agent/ 變更 |

## 2.2 新增檔案：`C:\PixiuCore\scripts\hooks\pixiu-guardrails.js`

```javascript
/**
 * pixiu-guardrails.js — 母體治理規則 Runtime 強制執行
 *
 * 實作 user_rules.md 中的硬閘門規則：
 * 1. API Key 洩露偵測（PostToolUse on Edit/Write）
 * 2. 大規模變更警告（PreToolUse on Edit/Write/MultiEdit）
 * 3. .agent/ 變更偵測 + 母體同步提醒（Stop）
 *
 * 用法（由 hooks.json 呼叫）：
 *   node pixiu-guardrails.js <hook-id>
 *
 * Hook IDs:
 *   pre:pixiu:change-scope    — 大規模變更警告
 *   post:pixiu:secret-scan    — API Key 洩露掃描
 *   stop:pixiu:mothership-sync — .agent/ 變更偵測
 */

'use strict';

const hookId = process.argv[2] || '';

let inputData = '';
process.stdin.on('data', chunk => inputData += chunk);
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(inputData);
    
    switch (hookId) {
      case 'pre:pixiu:change-scope':
        handleChangeScope(input);
        break;
      case 'post:pixiu:secret-scan':
        handleSecretScan(input);
        break;
      case 'stop:pixiu:mothership-sync':
        handleMothershipSync(input);
        break;
      default:
        // 未知 hook ID，直接通過
        console.log(inputData);
    }
  } catch (err) {
    // Hook 錯誤不應阻斷主流程
    console.error(`[pixiu-guardrails] 錯誤: ${err.message}`);
    console.log(inputData);
  }
});

// ── Hook 1: 大規模變更警告 ────────────────────────────────────────
// 對應 user_rules.md：「最小改動原則」
function handleChangeScope(input) {
  const toolInput = input.tool_input || {};
  
  // 檢查 Edit 操作的變更範圍
  if (input.tool_name === 'MultiEdit') {
    // MultiEdit 沒有直接的 "多少檔案" 欄位，但可以檢查 edits 陣列長度
    // 這裡用 stderr 警告，不阻斷
    console.error('[🛡️ 母體治理] 偵測到 MultiEdit 操作。');
    console.error('[🛡️ 母體治理] 提醒：user_rules.md 要求「最小改動原則：只改達成目標所需最小範圍」。');
    console.error('[🛡️ 母體治理] 請確認此次多檔案修改都是必要的。');
  }
  
  // 檢查 Write 操作是否在白名單外
  if (input.tool_name === 'Write') {
    const filePath = toolInput.file_path || '';
    // 偵測是否在 .agent/ 目錄下建立新檔案（觸發母體同步規則）
    if (filePath.includes('.agent/') || filePath.includes('.agents/')) {
      console.error('[🛡️ 母體治理] 偵測到 .agent/ 目錄變更！');
      console.error('[🛡️ 母體治理] 依 user_rules.md「框架變更回寫母體」規則，');
      console.error('[🛡️ 母體治理] 完成後必須詢問使用者是否同步至 C:\\PixiuCore。');
    }
  }
  
  console.log(inputData);
}

// ── Hook 2: API Key 洩露掃描 ──────────────────────────────────────
// 對應 user_rules.md：「禁止硬編碼 API Key、密碼、Token」
function handleSecretScan(input) {
  const toolOutput = input.tool_output || {};
  const content = toolOutput.output || '';
  const toolInput = input.tool_input || {};
  const newContent = toolInput.new_string || toolInput.content || '';
  
  // 合併檢查：工具輸出 + 新寫入的內容
  const textToCheck = content + '\n' + newContent;
  
  const SECRET_PATTERNS = [
    { pattern: /sk-[a-zA-Z0-9]{20,}/,                  name: 'Anthropic/OpenAI API Key' },
    { pattern: /ghp_[a-zA-Z0-9]{36}/,                   name: 'GitHub Personal Token' },
    { pattern: /\d{8,12}:[A-Za-z0-9_-]{35}/,            name: 'Telegram Bot Token' },
    { pattern: /AKIA[0-9A-Z]{16}/,                       name: 'AWS Access Key' },
    { pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/, name: 'Private Key' },
    { pattern: /mongodb\+srv:\/\/[^\s]+/,                name: 'MongoDB Connection String' },
    { pattern: /postgres:\/\/[^\s]+/,                    name: 'PostgreSQL Connection String' },
  ];
  
  const found = [];
  for (const { pattern, name } of SECRET_PATTERNS) {
    if (pattern.test(textToCheck)) {
      found.push(name);
    }
  }
  
  if (found.length > 0) {
    console.error(`[🔴 母體安全警報] 偵測到可能的硬編碼機密！`);
    console.error(`[🔴 母體安全警報] 發現類型：${found.join('、')}`);
    console.error(`[🔴 母體安全警報] 違反 user_rules.md：「禁止硬編碼 API Key、密碼、Token」`);
    console.error(`[🔴 母體安全警報] 請立即改用 .env 環境變數。`);
  }
  
  console.log(inputData);
}

// ── Hook 3: .agent/ 變更偵測 + 母體同步提醒 ───────────────────────
// 對應 user_rules.md：「框架變更回寫母體 (Mothership Sync) [HARD]」
function handleMothershipSync(input) {
  // Stop hook 可以存取 transcript 資訊
  // 檢查本次 session 是否有修改 .agent/ 相關檔案
  const toolOutput = input.tool_output || {};
  const transcript = toolOutput.output || '';
  
  const SYNC_TRIGGERS = [
    '.agent/skills/',
    '.agent/workflows/',
    '.agents/skills/',
    'user_rules.md',
    'AGENTS.md',
  ];
  
  const triggerFound = SYNC_TRIGGERS.filter(trigger => transcript.includes(trigger));
  
  if (triggerFound.length > 0) {
    console.error(`[🔄 母體同步] 偵測到框架級變更：${triggerFound.join('、')}`);
    console.error(`[🔄 母體同步] 依 user_rules.md「框架變更回寫母體」硬規則，`);
    console.error(`[🔄 母體同步] 請詢問使用者：「是否將此變更同步回寫至 C:\\PixiuCore？」`);
  }
  
  console.log(inputData);
}
```

## 2.3 修改檔案：`C:\PixiuCore\hooks\hooks.json`

在 `hooks.json` 中新增 3 個 Hook 定義。

### 修改方式

找到 `"PreToolUse"` 陣列，在其**最後一個元素後面**新增：

```json
      ,
      {
        "matcher": "Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/pixiu-guardrails.js\" \"pre:pixiu:change-scope\""
          }
        ],
        "description": "母體治理：大規模變更警告 + .agent/ 變更偵測"
      }
```

找到 `"PostToolUse"` 陣列，在其**最後一個元素後面**新增：

```json
      ,
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/pixiu-guardrails.js\" \"post:pixiu:secret-scan\""
          }
        ],
        "description": "母體安全：API Key / 機密洩露自動掃描"
      }
```

找到 `"Stop"` 陣列，在其**最後一個元素後面**新增：

```json
      ,
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/hooks/pixiu-guardrails.js\" \"stop:pixiu:mothership-sync\"",
            "async": true,
            "timeout": 5
          }
        ],
        "description": "母體同步：偵測 .agent/ 框架級變更，提醒回寫母體"
      }
```

---

# 階段 3：Explore Agent（嚴格唯讀探索者）

## 3.1 設計原理

借鑑 Claude Code 的 `exploreAgent.ts`，核心設計是：
- **絕對唯讀**：不能創建、修改、刪除、移動任何檔案
- 只使用 Glob / Grep / Read / Bash（限定唯讀命令）
- 用途：探索代碼庫、理解架構、找出問題位置
- **不污染主上下文**：探索結果以報告形式回傳

你的母體已經有 `planner.md`，但 planner 的重點是「制定計畫」而非「探索代碼」。Explore Agent 是純粹的代碼探索專家。

## 3.2 新增檔案：`C:\PixiuCore\agents\explore-agent.md`

```markdown
---
name: explore-agent
description: 嚴格唯讀的代碼探索專家 — 借鑑 Claude Code exploreAgent.ts 設計。只能讀取和搜尋，絕對不能修改任何檔案。用於快速理解代碼庫、找出問題位置、架構分析。
model: default
tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# 🔭 Explore Agent — 嚴格唯讀代碼探索專家

你是一個**嚴格唯讀**的代碼探索專家。你的唯一目的是快速理解代碼庫並回報發現。

## 🔒 絕對唯讀規則（最高優先）

以下行為一律**絕對禁止**，無任何例外：

- ❌ 不能創建檔案（包括臨時檔案）
- ❌ 不能修改檔案
- ❌ 不能刪除檔案
- ❌ 不能移動或重命名檔案
- ❌ 不能使用 heredoc 或重定向寫入檔案（`>`, `>>`, `tee`）
- ❌ 不能安裝任何套件（`npm install`, `pip install` 等）
- ❌ 不能執行任何改變系統狀態的命令（`git commit`, `git push` 等）
- ❌ 不能啟動伺服器或背景程序

## ✅ 允許的操作

只能使用以下工具和命令：

### 工具
- **Read** — 讀取檔案內容
- **Glob** — 搜尋檔案路徑pattern
- **Grep** — 搜尋檔案內容

### Bash（限定唯讀命令）
- `ls`, `find`, `tree` — 檔案結構
- `cat`, `head`, `tail`, `wc` — 檔案內容
- `grep`, `rg`, `ag` — 搜尋
- `git status`, `git log`, `git diff`, `git show`, `git branch` — Git 資訊（唯讀）
- `node -e "..."` — 只限用於解析 JSON 或計算（不能寫檔）
- `type`, `where` (Windows) / `which`, `file` (Unix) — 工具偵測

## 🎯 工作方式

1. **速度優先**：盡快給出結果，不要過度分析
2. **並行探索**：同時使用多個工具搜尋不同面向
3. **結構化回報**：用清晰的 Markdown 格式回報發現

## 📋 輸出格式

```
## 探索報告

### 專案概覽
- 語言/框架：
- 入口點：
- 主要目錄結構：

### 發現
1. [發現內容 + 檔案路徑:行號]
2. ...

### 關鍵檔案
- `path/to/file.ts` — [用途說明]
- ...

### 問題/風險（若有）
- [問題描述 + 位置]
```

## 🌐 語言

所有輸出使用繁體中文。
```

## 3.3 使用方式

```
/agent explore-agent

請探索 C:\Users\pop15\.gemini\antigravity\scratch\openclaw-bot 的代碼庫，
重點理解：
1. Skill 系統是如何路由和執行的
2. 多模型 routing 的決策邏輯
3. CoWork 協作模式的使用狀況
```

---

# 🧪 測試清單

## 階段 1 測試（Verification Agent）

```
# 在任何專案中呼叫 verification-agent
/agent verification-agent

請驗證 C:\Users\pop15\.gemini\antigravity\scratch\openclaw-bot 專案的基本健全性：
1. 是否能正常啟動（node src/bridge.js）
2. 是否有硬編碼的 API Key
3. package.json 的依賴是否都有安裝
```

預期結果：
- Agent 會跑命令（不是只看代碼）
- 輸出包含 VERDICT: PASS/FAIL/PARTIAL
- 每個檢查都有實際命令和觀察到的輸出

## 階段 2 測試（Runtime Hook）

### 測試 Secret Scan Hook
在任何專案中做一個 Edit，故意在代碼中寫入類似 API Key 的字串：
```javascript
const key = "sk-ant-1234567890abcdef1234567890abcdef";
```
預期結果：PostToolUse hook 在 stderr 輸出 `[🔴 母體安全警報]`

### 測試 .agent/ 變更偵測
建立或修改 `.agent/skills/` 下的任何檔案。
預期結果：Stop hook 在 stderr 輸出 `[🔄 母體同步]` 提醒

## 階段 3 測試（Explore Agent）

```
/agent explore-agent

快速瀏覽 C:\PixiuCore 的目錄結構，告訴我有哪些 agents 和 skills。
```

預期結果：
- Agent **不會**建立任何檔案
- 只使用 ls / find / cat / Glob / Grep
- 輸出結構化的探索報告

---

# 📁 最終檔案結構變更

```
C:\PixiuCore\
├── agents/
│   ├── verification-agent.md  （新增 ← 階段 1）
│   ├── explore-agent.md       （新增 ← 階段 3）
│   ├── architect.md           （不變）
│   ├── planner.md             （不變）
│   └── ... 其他 25 個 agent   （不變）
├── scripts/
│   └── hooks/
│       ├── pixiu-guardrails.js（新增 ← 階段 2）
│       └── ... 現有 hooks      （不變）
├── hooks/
│   ├── hooks.json             （修改 ← 階段 2：新增 3 個 hook 定義）
│   └── README.md              （不變）
└── ... 其他所有檔案             （不變）
```

---

## ⚠️ 注意事項

1. **所有新增都是加法操作**，不會破壞現有功能
2. `agents/` 目錄下的 `.md` 檔案會被 ECC 框架自動偵測為可用 Agent
3. `hooks.json` 的修改要注意 JSON 語法正確性（逗號位置）
4. `pixiu-guardrails.js` 使用 `console.error` 輸出警告（stderr），不使用 `process.exit(2)` 阻斷，因為母體規則是「警告 + 提醒用戶確認」而非直接拒絕
5. 如果要將某些規則設為**阻斷**（不只是警告），可以在對應位置加上 `process.exit(2)` — 但建議先以警告模式運行一段時間，確認不會誤觸
6. 所有新增檔案的內容一律使用**繁體中文**
