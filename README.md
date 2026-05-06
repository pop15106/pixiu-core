# PixiuCore 母艦

> 跨 AI 工具的治理母體：集中維護規則、技能、指令、Hooks、Vault 記憶與 Fleet 專案清單。

PixiuCore 的目標不是把每個 AI 工具改成同一個樣子，而是讓 Claude Code、Codex、Gemini、Cursor、Windsurf、OpenCode 等工具都先遵守同一份工程憲法，再依各自能力執行任務。這份 README 是入口地圖；細節請看各子目錄文件。

## 目前狀態

盤點日期：2026-05-04  
盤點路徑：`%PIXIU_CORE%`

| 項目 | 現況 |
|------|------|
| Plugin | `everything-claude-code` v1.8.0 |
| Fleet 專案 | `fleet.json` 目前 30 個路徑 |
| 頂層 Agents | 27 個，位於 `agents/` |
| ECC Agents | 28 個，位於 `.agent/agents/` |
| Slash Commands | 58 條，位於 `commands/` |
| ECC Workflows | 79 條，位於 `.agent/workflows/` |
| 頂層 Skills | 66 個，位於 `skills/` |
| ECC Skills | 142 個，位於 `.agent/skills/` |
| OpenAI 可攜 Skills | 43 個，位於 `.agents/skills/` |
| Rules | 51 條 Markdown 規則，位於 `rules/` 與 `.agent/rules/` |
| Vault | 已啟用，包含 `identity/`、`memory/`、`context/`、`sop/`、`after-action/`、`templates/` |
| 最近明顯新增 | `spec-improve` skill，2026-04-29 同步到 `skills/`、`.agent/skills/`、`.agents/skills/` |

> 注意：目前啟動規則優先讀 `PIXIU_CORE`，部分安裝腳本仍設定 `PIXIU_CORE_PATH`。兩者是既有技術債，調整前請確認所有工具相容性。

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
- [scripts/setup/README.md](scripts/setup/README.md)：Claude Code CLI 部署包說明。
- [vault/README.md](vault/README.md)：Vault 記憶庫初始化規則。

## 版本資訊

| 項目 | 值 |
|------|----|
| README 更新日 | 2026-05-04 |
| ECC Plugin 版本 | v1.8.0 |
| 目前 gravityTest 版最新內容 | `spec-improve` skill 同步，2026-04-29 |
| 正式母體同步狀態 | 需依 `%PIXIU_CORE%` 與本 repo 實際差異另行確認 |
