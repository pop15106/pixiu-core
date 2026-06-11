---
type: session-recap
date: 2026-05-26
project: PixiuCore
system: AI_TOOLING
repo: Playground
topic: codegraph-understand-anything-all-ai-install
status: done
tags: [recap, pixiucore, codegraph, understand-anything, agent-tooling]
source_paths:
  - C:/Users/7010/.codex/config.toml
  - C:/Users/7010/.codex/AGENTS.md
  - C:/Users/7010/.claude.json
  - C:/Users/7010/.claude/CLAUDE.md
  - C:/Users/7010/.claude/settings.json
  - C:/Users/7010/.cursor/mcp.json
  - C:/Users/7010/AppData/Roaming/opencode/opencode.jsonc
  - C:/Users/7010/.hermes/config.yaml
  - C:/Users/7010/AppData/Local/codegraph/current/bin/codegraph.cmd
  - C:/Users/7010/.understand-anything/repo
  - C:/Users/7010/.agents/skills/understand
  - C:/Users/7010/.copilot/skills/understand
  - C:/Users/7010/.gemini/antigravity/skills/understand-anything
  - C:/Users/7010/Documents/Playground/tool-install-backups/20260526-135458
summary: 已完成 CodeGraph 與 Understand-Anything 的多 AI 安裝與驗證，保留 CodeGraph 官方 PATH-resolved command 設計，需重開各 AI 讓 PATH 生效。
---

# Session Recap：CodeGraph 與 Understand-Anything 全 AI 安裝

> 日期：2026-05-26 14:09
> 專案：PixiuCore / AI tooling
> AI：Codex

## 觸發與背景

使用者先要求比較 `Lum1104/Understand-Anything` 與 `colbymchenry/codegraph`，後續確認兩者都要安裝，並補充「要讓所有 AI 都能用」。本 session 因此從 repo orientation 轉成實際安裝與驗證。

安裝前已依 Playground AGENTS 規則讀取 PixiuCore 啟動檔，active core 為 `C:/Users/7010/Desktop/gravityTest/pixiu-core`。second-brain 查詢一開始在 sandbox 失敗，改用 escalated shell 後成功；結果只作為 lead，實際安裝以 repo 文件與本機檔案驗證為準。

## 結論

- CodeGraph 已安裝並配置到它支援的 agent：Claude Code、Cursor、Codex CLI、opencode、Hermes Agent。
- Understand-Anything 已 clone 到 `C:/Users/7010/.understand-anything/repo`，並安裝到 Windows installer 支援的 skill surfaces：`gemini`、`codex`、`opencode`、`pi`、`openclaw`、`antigravity`、`vscode`、`hermes`、`cline`、`kimi`。
- Node 已用 nvm 切到 `v22.22.0`，並補裝 `pnpm 10.6.2`。
- Understand-Anything 的 core、skill package、dashboard build 都已通過。
- CodeGraph MCP config 目前保留官方預設 `command = "codegraph"`，不改成絕對路徑。這樣較可攜，但需要重開各 AI / IDE / terminal，讓新的 User PATH 生效。
- 若某個 agent 重開後仍找不到 `codegraph`，先檢查該 agent 是否有讀到 User PATH；最後手段才考慮把該 agent 的 MCP command 改成絕對路徑。

## 證據與流程

### CodeGraph

已執行：

```powershell
C:\nvm4w\nodejs\npx.cmd @colbymchenry/codegraph install --target=all --location=global --yes
irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex
```

安裝結果：

- `C:/Users/7010/.claude.json` 新增 / 更新 `codegraph` MCP server。
- `C:/Users/7010/.claude/settings.json` 更新 Claude Code permission。
- `C:/Users/7010/.claude/CLAUDE.md` 更新 CodeGraph 使用說明。
- `C:/Users/7010/.cursor/mcp.json` 建立 Cursor MCP config。
- `C:/Users/7010/.codex/config.toml` 更新 Codex MCP config。
- `C:/Users/7010/.codex/AGENTS.md` 加入 CodeGraph instructions。
- `C:/Users/7010/AppData/Roaming/opencode/opencode.jsonc` 與 `AGENTS.md` 建立。
- `C:/Users/7010/.hermes/config.yaml` 建立。
- `C:/Users/7010/AppData/Local/codegraph/current/bin/codegraph.cmd` 安裝成功。

重點決策：

```toml
[mcp_servers.codegraph]
command = "codegraph"
args = ["serve", "--mcp"]
```

保留相對 command / PATH-resolved 的原因是避免硬綁目前使用者路徑。User PATH 已加入：

```text
C:/Users/7010/AppData/Local/codegraph/current/bin
```

### Understand-Anything

已執行：

```powershell
git clone https://github.com/Lum1104/Understand-Anything.git C:\Users\7010\.understand-anything\repo
powershell -ExecutionPolicy Bypass -File C:\Users\7010\.understand-anything\repo\install.ps1 <target>
```

target 全部跑過：

```text
gemini, codex, opencode, pi, openclaw, antigravity, vscode, hermes, cline, kimi
```

安裝結果：

- `C:/Users/7010/.understand-anything-plugin` 指向 plugin root。
- `C:/Users/7010/.agents/skills/understand` 與相關 skills 已建立，供 gemini/codex/opencode/pi 這類 per-skill target 使用。
- `C:/Users/7010/.copilot/skills/understand` 與相關 skills 已建立，供 VS Code / Copilot 使用。
- `C:/Users/7010/.gemini/antigravity/skills/understand-anything` 已建立。
- `C:/Users/7010/.openclaw/skills/understand-anything` 已建立。
- `C:/Users/7010/.hermes/skills/understand-anything` 已建立。
- `C:/Users/7010/.cline/skills/understand-anything` 已建立。
- `C:/Users/7010/.kimi/skills/understand-anything` 已建立。

## 已做變更

- 使用 nvm 將 active Node symlink 切到 `v22.22.0`。
- 透過 npm 全域安裝 `pnpm@10.6.2`。
- 安裝 CodeGraph v0.9.4 npm installer 設定到多個 AI agent。
- 安裝 CodeGraph standalone binary 到 `%LOCALAPPDATA%/codegraph/current/bin`，並加入 User PATH。
- clone Understand-Anything 到 `%USERPROFILE%/.understand-anything/repo`。
- 建立 Understand-Anything 的 skills junction 到多個 AI skill 目錄。
- 在 Understand-Anything repo 執行 workspace dependency install 與 build。
- 安裝前備份既有設定到：

```text
C:/Users/7010/Documents/Playground/tool-install-backups/20260526-135458
```

備份包含：

- `.codex/config.toml`
- `.codex/AGENTS.md`
- `.claude.json`
- `.claude/CLAUDE.md`
- `.claude/settings.json`

## 驗證

已確認：

```text
C:/Users/7010/AppData/Local/codegraph/current/bin/codegraph.cmd --version => 0.9.4
C:/nvm4w/nodejs/node.exe --version => v22.22.0
C:/nvm4w/nodejs/pnpm.cmd --version => 10.6.2
```

CodeGraph config 驗證：

- `C:/Users/7010/.codex/config.toml` 有 `[mcp_servers.codegraph]`。
- `C:/Users/7010/.codex/AGENTS.md` 有 `<!-- CODEGRAPH_START -->` 區塊。
- `C:/Users/7010/.claude.json` 有 `mcpServers.codegraph`。
- `C:/Users/7010/.cursor/mcp.json` 有 `codegraph` MCP server。
- `C:/Users/7010/.hermes/config.yaml` 有 `codegraph` MCP server。

Understand-Anything 驗證：

- `packages/core/dist/index.js` 存在。
- `understand-anything-plugin/dist/index.js` 存在。
- `packages/dashboard/dist/index.html` 存在。
- `pnpm --filter @understand-anything/skill build` 通過。
- `pnpm --filter @understand-anything/dashboard build` 通過。
- 多個 skill link / junction 存在性已驗證為 True。

## 下一步

- [ ] 重開 Codex、Claude Code、Cursor、opencode、Hermes、Antigravity、VS Code / Copilot 等 AI / IDE，讓新的 PATH 與 skill discovery 生效。
- [ ] 重開後在任一 repo 先跑 `codegraph init -i`，再確認 MCP 端能呼叫 `codegraph_status`。
- [ ] 若某個 agent 重開後仍無法啟動 CodeGraph MCP，先在同一 agent 啟動環境測 `where codegraph`，確認 PATH 是否包含 `C:/Users/7010/AppData/Local/codegraph/current/bin`。
- [ ] Understand-Anything 第一次不要直接跑 PCLMS 全 repo；建議先用中小 repo 測 `/understand --language zh-TW`。

## 備註

CodeGraph 適合作為日常 repo tracing / callers / callees / impact 的本機索引 lead；Understand-Anything 較適合作為 onboarding、dashboard 視覺化與知識圖分享。兩者都不能取代最終 repo source、SQL、log 或 live endpoint 驗證。

---

*依 [[pixiu-session-recap]] 與 [[recap-standard]] 產出。*
