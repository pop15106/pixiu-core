# PixiuCore Workflow Lab

Workflow Lab 是角色型 AI Workflow 測試控制台，與既有 `scripts/test-console/` 分工：

- `test-console`：驗證 PixiuCore 平台底座、Router、Recap、DevSpace 與 Repository Safety。
- `workflow-lab`：驗證轉譯器、PM、SA、SD、PG、QA、檢核官、文件、Need-to-Know 與人工核准流程。

Workflow Lab 只使用 Node.js 內建模組與原生 HTML／CSS／JavaScript，不需要安裝 npm 套件。

## 啟動

在 PixiuCore 根目錄執行：

```powershell
node scripts/workflow-lab/server.js --open
```

預設網址：

```text
http://127.0.0.1:8792
```

不自動開啟瀏覽器：

```powershell
node scripts/workflow-lab/server.js
```

改用其他本機 Port：

```powershell
node scripts/workflow-lab/server.js --port=8793 --open
```

按 `Ctrl+C` 關閉服務。Server 固定監聽 `127.0.0.1`，不能改成對外網卡。

## 可測試模組

| 模組 | 功能 | Live 權限 |
|---|---|---|
| 轉譯器 | 正規化需求、遮罩敏感詞與建立受控需求 | 本機契約 |
| 決策／路由 | 決定模組順序、權限、Worktree 與核准點 | 本機契約 |
| PM | 問題、範圍、需求、驗收條件、風險與依賴 | 專案唯讀 |
| PM 檢核官 | 驗證 PM Artifact 契約 | 本機契約 |
| SA | As-Is、商業規則、資料流、影響範圍與回歸風險 | 專案唯讀 |
| SA 檢核官 | 驗證 SA Artifact 契約 | 本機契約 |
| SD | To-Be、架構邊界、契約、實作與回滾方案 | 專案唯讀 |
| SD 檢核官 | 驗證 SD Artifact 契約 | 本機契約 |
| PG | 驗證實作契約或在隔離 Worktree 實作 | Worktree 寫入 |
| QA | 驗收、回歸、邊界與 RED／GREEN | Worktree 唯讀 |
| 人工核准閘門 | 原文直通、危險順序、Worktree 與 RED 退回 | 本機契約 |
| 文件 | 彙整已核准的需求、分析、設計、實作與測試結果 | 專案唯讀 |
| 記憶候選 | 產生 Recap／Decision／Observation 候選 | 本機契約 |
| Need-to-Know 診斷 | 顯示角色可見資料並執行 Canary 洩漏測試 | 本機契約 |

## 三種流程模式

### 單模組

選擇任一模組獨立測試。後段模組有兩種輸入方式：

- **Strict Contract**：在「手動上游 Artifacts」貼入 JSON。
- **Assisted Fixture**：由 Workflow Lab 建立合成上游 Artifact；只有被選模組會執行，其他角色不會被列入測試結果。

QA Strict 範例：

```json
{
  "pm-artifact-v1": {
    "acceptanceCriteria": ["回傳 GREEN"]
  },
  "sa-artifact-v1": {
    "businessRules": ["輸入有效時執行"]
  },
  "sd-artifact-v1": {
    "designContract": {
      "input": "valid",
      "output": "GREEN"
    }
  },
  "pg-artifact-v1": {
    "changedFiles": ["Example.java"],
    "diffSummary": "測試 Fixture"
  }
}
```

### 部分流程

一般模式依固定 SDLC 順序勾選需要的模組，例如：

```text
轉譯器 → PM → SA
SA → SD → PG
PG → QA → 文件
```

進階排序可使用每張模組卡片的上下按鈕。順序缺少必要上游產物時預設阻擋；「允許不安全順序」只用於刻意測試異常流程，建立 Run 後仍會進入人工核准。

### 完整流程

完整 Offline 流程為：

```text
轉譯器
→ 決策／路由
→ PM
→ PM 檢核官
→ SA
→ SA 檢核官
→ SD
→ SD 檢核官
→ PG
→ QA
→ 人工核准閘門
→ 文件
→ 記憶候選
```

任一檢核官或 QA 判定 RED 時停止後續流程，顯示原因與建議退回角色，等待使用者確認。

## Offline Contract

Offline 是預設模式：

- 不呼叫 Codex。
- 不修改專案。
- 使用固定、可重現的 Artifact Schema。
- 所有 Assisted Fixture 會標記 `synthetic: true`。
- 適合日常回歸、順序驗證、Need-to-Know、Canary、RED／GREEN 與核准流程。

內建測試情境：

- 正常 GREEN
- QA RED／人工退回
- 檢核官 RED
- Canary 洩漏

## Live Smoke

Live Smoke 會實際執行本機 Codex CLI，會消耗 Codex 額度。

執行前確認：

```powershell
codex --version
```

每個角色使用獨立命令：

```text
codex exec --ephemeral
```

權限規則：

- PM、SA、SD、文件：`read-only`。
- QA：若有 PG Worktree，使用該 Worktree 唯讀驗證。
- PG：建立隔離 Git Worktree 後使用 `workspace-write`。
- 轉譯器、路由、檢核官與核准閘門：使用本機確定性邏輯。

PG 前流程會暫停並顯示：

```text
Live PG 將建立隔離 Worktree，禁止修改原 checkout、Push、Merge 或 Deploy
```

只有人工核准後才建立 Worktree。Worktree 建立失敗時直接停止，不會改用原 checkout。完成後保留 Worktree 路徑供人工檢查，不自動刪除。

Workflow Lab 不提供：

- Git Push
- Merge
- Deploy
- DB 寫入
- 依賴變更
- 任意 Shell Web Terminal

## Need-to-Know 與原文直通

預設使用 Need-to-Know：

- 每個角色只取得明確 Allowlist 欄位。
- QA 不取得 PG 的思考過程。
- 文件只取得已核准 Artifact。
- Canary Secret 若出現在未授權輸出，流程立即 RED 並建議退回轉譯器。

原文直通只供 A/B 比較：

- 建立 Run 後先停在人工核准。
- 原文與該分支 Artifact 只存在記憶體。
- 不出現在 Run Snapshot、可持久化 Artifact 或 Log。
- 重新整理瀏覽器後無法從 Server 取回原文。

## 專案選擇

Live Smoke 可：

1. 從 `fleet.json` 選擇專案。
2. 輸入明確允許的 `C:\PixiuCore`。
3. 輸入 `D:\Project` 下的具體專案路徑。

磁碟根目錄、整個使用者家目錄、允許根目錄本身與範圍外路徑都會被拒絕。

## Artifact 與 Log

允許顯示與保存：

- 遮罩後 Role Artifact
- 模組狀態與 RED／GREEN
- 測試證據
- 核准紀錄
- Worktree 路徑

禁止保存：

- 原始需求
- 原始商業邏輯
- 遮罩對照表
- Canary 原值
- 完整內部 Prompt
- Fresh Session Transcript
- Secret、Token、密碼與 PII

Web UI 所有動態內容使用文字節點呈現；需求中的 HTML 或 Script 不會當成網頁內容執行。

## 自動測試

### 核心、API 與 UI 契約

```powershell
node --test scripts/workflow-lab/workflow-lab.test.js
```

涵蓋 Catalog、Request、Redaction、Need-to-Know、Artifact、所有單模組、部分／完整流程、RED 核准、Project、Worktree、Codex Executor、HTTP 與 UI。

### 真實 Web API 整合

```powershell
node --test scripts/workflow-lab/web-api-integration.test.js
```

會以隨機 loopback Port 啟動真正 Server，執行：

1. Translator 單模組。
2. `translator → pm → sa` 部分流程。
3. 13 步完整 Offline Flow。
4. QA RED、人工退回 PG、第二輪完成。
5. 執行中取消。
6. 原始 Secret 不出現在 Run 或 Artifact。

### 新舊控制台一起回歸

```powershell
node --test scripts/workflow-lab/workflow-lab.test.js scripts/workflow-lab/web-api-integration.test.js
node --test scripts/test-console/test-console.test.js scripts/test-console/web-api-integration.test.js
```

## HTTP 安全邊界

- 只監聽 `127.0.0.1`。
- 寫入 API 要求同源 `Origin`、`application/json` 與隨機 `X-Pixiu-Workflow-Token`。
- Request body 有固定大小上限。
- 同時間只允許一個 Active Run。
- API 不接受 executable、args、cwd、Prompt Template 或任意 Shell。
- 靜態頁面使用 CSP、`X-Frame-Options: DENY` 與 `nosniff`。
