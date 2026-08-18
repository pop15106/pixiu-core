# PixiuCore Agent Instructions

本 repository 由 PixiuCore 治理。Session 啟動時只讀 `vault/bootstrap/SESSION-BOOTSTRAP.md`；其餘規則、能力、記憶與工作流依本次需求按需載入。

## 啟動流程

1. 解析母體路徑：`PIXIU_CORE` → `PIXIU_CORE_PATH` → `%USERPROFILE%\.pixiu-core`。
2. 讀取 `vault/bootstrap/SESSION-BOOTSTRAP.md`。
3. 執行 `node scripts/router/resolve-capabilities.js "<本次需求>"`。
4. 只讀 Router 回傳的 `filesToLoad`，Capability 最多 3 個。
5. Router 無法執行時，才以 `vault/capabilities/capability-manifest.json` 作降級索引；一般 Session 不全文讀取 `user_rules.md`、`memory-summary.md`、recap、全部 Skills、Workflows、Hooks 或 Agents。

`user_rules.md` 仍是 L0 憲法唯一來源；Bootstrap 只保留執行所需的硬閘門摘要。遇到衝突、例外或高風險操作時，再讀相關原文段落。

## 常駐底線

- 使用者本次明確指令優先。
- 回覆、計畫、工具理由與程式註解使用繁體中文。
- 寫入前需使用者明確授權；刪檔、DB 寫入、Git push、依賴異動與秘密資料屬高風險操作。
- 不猜測 repo、runtime、framework、DB 或業務事實；讀取來源驗證。
- 只做完成需求所需的最小變更。
- Agent Team 需使用者明確同意；子 Agent 只拿精簡任務包，不重讀整個母體。
- 完成前執行與變更相符的測試、檢查或主路徑驗證。

## Hermes 路由

只有使用者明確要求「用 Hermes」「透過 Hermes」「交給 Hermes」「Hermes gate」或同義語句時才啟用。

```powershell
$pixiu = if ($env:PIXIU_CORE) { $env:PIXIU_CORE } elseif ($env:PIXIU_CORE_PATH) { $env:PIXIU_CORE_PATH } else { "$env:USERPROFILE\.pixiu-core" }
$hermesRouteFile = Join-Path $pixiu "vault\context\hermes-host-home.txt"
$hermes = if ($env:HERMES_HOME) { $env:HERMES_HOME } elseif (Test-Path $hermesRouteFile) { (Get-Content -Raw $hermesRouteFile).Trim() } else { "$env:USERPROFILE\Documents\hermes 多AI 工作流" }
powershell -ExecutionPolicy Bypass -File "$hermes\scripts\hermes-submit-and-run.ps1" -Text "<使用者原始需求>" -SourceEntrance "codex"
```

執行後回報 `taskId`、狀態、state path 與 report path。腳本失敗時回報原始錯誤並停止，不得靜默改成本地直接實作。

## 常用路由

- 實作／修 bug／重構：`vault/governance/minimal-implementation-ladder.md`
- 派工／模型／驗收：`vault/governance/model-dispatch-rules.md`
- 判斷是否完成、詢問或升級：`vault/governance/judgment-rubrics.md`
- 修改入口檔：`vault/governance/entry-files-alignment.md`
- Recap／接續 Session：先讀 `vault/memory/SESSION-INDEX.md`
- Capability 路由：`node scripts/router/resolve-capabilities.js "<需求>"`

## 專案結構

- `.agents/skills/`：Codex／OpenAI 可攜 Skill 發佈層
- `skills/`：Pixiu 共用 Skill 來源
- `agents/`：專門 Agent 定義
- `vault/`：治理、Context、記憶與 SOP
- `scripts/`：安裝、Hook、路由與驗證工具

不要在入口檔列出完整 Skill 或 Agent 清單；新增能力時更新 Capability Manifest。
