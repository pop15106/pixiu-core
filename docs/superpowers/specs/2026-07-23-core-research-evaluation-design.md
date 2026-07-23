# Core Research Evaluation Design

## 文件狀態

- 日期：2026-07-23
- 分支：`feature/core-research-pipeline`
- 基底：Phase 1～2 已完成的 `9cb19ae`
- 狀態：Phase 3～4 已實作，待使用者審閱與決定是否合併

## 目標

將週選擇結果接到安全、可稽核的候選評估流程：產生不可變 DevSpace 任務包、驗證固定 Commit 的候選工作區、執行不會啟動候選程式碼的靜態掃描、驗證受限 Sandbox 證據、產出整合提案，最後停在人工核准 Ledger。

## 核心邊界

PixiuCore 內的 Node.js 程式不能直接呼叫 DevSpace MCP，因此採明確分工：

```text
selected.json
    ↓
prepare-evaluations CLI
    ↓
不可變 Evaluation Task Packet
    ↓
ChatGPT Automation／人工操作透過 DevSpace 建立候選 worktree
    ↓
evaluate-workspace CLI（唯讀掃描）
    ↓
Sandbox 由 DevSpace 受限環境執行並產生證據
    ↓
record-evidence CLI
    ↓
Review Report／Integration Spec／AWAITING_APPROVAL
    ↓
approve CLI（只允許 APPROVED_FOR_PLAN／DEFERRED／REJECTED）
```

正式核心修改永遠是另一個經人工核准的新實作任務。

## 模組

```text
scripts/core-research/
├─ repository-source-gate.js   固定來源、Commit、License 與風險前置閘門
├─ evaluation-task-builder.js  DevSpace checkout／掃描／Sandbox 任務包
├─ workspace-scanner.js        唯讀授權、Secret、靜態、供應鏈、Prompt Injection 掃描
├─ sandbox-evidence.js         驗證外部 Sandbox 執行證據
├─ evaluation-ledger.js        Append-only 評估與人工核准 Ledger
├─ review-report-builder.js    安全報告與整合 Spec 草案
└─ cli.js                      新增 prepare-evaluations／evaluate-workspace／record-evidence／approve／evaluation-status
```

## Repository Source Gate

只有 `repository` 候選能建立 worktree 任務。必須同時滿足：

- canonical URL 為 `https://github.com/<owner>/<repo>`，不可包含帳密、query 或 fragment。
- 完整 40 字元 Commit SHA。
- License 不是 `UNKNOWN`。
- `riskFlags` 不含 `SOURCE_BLOCKED`、`INTEGRITY_MISMATCH`、`MALICIOUS_CONTENT`。
- 週選擇 disposition 為 `Extract` 或 `Integrate Proposed`。

輸出狀態：

```text
CHECKOUT_ALLOWED
REFERENCE_ONLY
REJECTED
```

## Evaluation Task Packet

任務包必須包含：

- `taskId`：候選 canonical key 與 Commit 的 SHA-256 前 24 字元。
- `source`：canonical URL、Commit SHA、License、Publisher。
- `checkoutPlan`：以 Git argv 陣列表示，不使用 shell 字串。
- `workspace`：候選 cache 與 worktree 的相對路徑。
- `allowedPaths`：只有候選 worktree、該 task artifact 與該 task ledger。
- `prohibitedActions`：`commit`、`push`、`merge`、`deploy`、`formal-core-write`、`read-secrets`。
- `scanPlan`：license、secret、static、supply-chain、prompt-injection。
- `sandboxPolicy`：要求網路隔離、空秘密環境、workspace-only、timeout 與輸出限制。

任務包以穩定序列化計算 digest，讀取時必須重新驗證。

## Workspace Scanner

掃描器只能讀檔與執行 Git metadata 指令，不執行候選程式碼：

1. 驗證 `git rev-parse HEAD` 等於固定 Commit SHA。
2. 驗證 `remote.origin.url` 正規化後等於 canonical URL。
3. License：檢查授權檔與候選宣告是否一致。
4. Secret：保守規則掃描常見 token／private key，輸出檔案與行號，不輸出完整秘密。
5. Static：檢查 `eval`、shell command 拼接、TLS 驗證關閉、`curl | sh` 等高風險模式。
6. Supply Chain：檢查 install lifecycle scripts、未鎖定依賴、可疑下載執行與過多依賴。
7. Prompt Injection：檢查要求忽略規則、讀取秘密、擴權、外傳資料或修改核心的文字。

限制：

- 排除 `.git`、`node_modules`、build output 與 binary。
- 單檔最多 1 MiB、總檔案最多 5,000、總讀取最多 50 MiB。
- 所有發現必須包含 reason code、相對路徑、行號與遮罩後摘要。

## Sandbox Evidence

PixiuCore 不自行執行不可信候選。DevSpace 或其他受控 Sandbox 執行後提供證據：

```text
PASS
FAIL
SKIPPED_UNAVAILABLE
```

`PASS` 必須證明：

- `networkIsolated = true`
- `secretsAvailable = false`
- `workspaceOnly = true`
- command 在 task 的 approved commands 內
- timeout 未超限

缺少 OS 級隔離時只能 `SKIPPED_UNAVAILABLE`，評估狀態為 `REVIEW_READY_WITH_CONCERNS`。

## Evaluation Ledger

Append-only JSONL 事件：

```text
EVALUATION_PREPARED
WORKSPACE_SCANNED
EVIDENCE_RECORDED
REVIEW_READY
APPROVAL_RECORDED
```

衍生狀態：

```text
PREPARED
EVALUATING
REVIEW_READY
REVIEW_READY_WITH_CONCERNS
AWAITING_APPROVAL
APPROVED_FOR_PLAN
DEFERRED
REJECTED
```

人工核准限制：

- `actor` 必須以 `human:` 開頭。
- `comment` 必填。
- 只有 `AWAITING_APPROVAL` 可核准。
- `approve-plan` 只轉成 `APPROVED_FOR_PLAN`，不會出現 `INTEGRATED`。

## 報告

每個 task 產生：

```text
artifacts/core-research/evaluations/<taskId>/
├─ task.json
├─ evidence.json
├─ security-report.md
└─ integration-spec.md
```

`integration-spec.md` 只包含：目標、可萃取能力、影響範圍、風險、驗收條件與待人工決策，不修改程式碼。

## 驗收條件

1. 缺 Commit、License 不明或阻擋風險候選不能建立 checkout 任務。
2. 任務包 digest 可重現，遭竄改時拒絕。
3. checkout plan 不使用 shell 字串，路徑固定在 state root 下。
4. Workspace HEAD 或 origin 不符時掃描失敗。
5. 掃描器不執行候選程式碼，並輸出五類證據。
6. Secret 發現不洩漏完整秘密。
7. Sandbox PASS 缺任一隔離證據時拒絕。
8. 證據完成後產生安全報告與整合 Spec，狀態停在 AWAITING_APPROVAL。
9. 只有 human actor 能將狀態改為 APPROVED_FOR_PLAN／DEFERRED／REJECTED。
10. 全部既有 Phase 1～2 與 core-evolution 測試保持通過。

## 不做

- 不自動 Push、Merge、部署或修改 master。
- 不自動執行候選安裝腳本或測試。
- 不假裝 DevSpace worktree 等同 OS Sandbox。
- 不寫入正式 Mem0、pgvector、憑證或業務資料。
- 不自動把 APPROVED_FOR_PLAN 變成正式整合。
