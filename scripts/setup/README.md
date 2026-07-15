# Pixiu 母體部署包

> 讓別人 clone 母體後，一鍵接上 Claude Code 與 Codex 的全部治理功能。

## 一鍵部署（新機器 clone 後）

前置：PowerShell 7+、git、node（Codex 接線需要）。

```powershell
git clone <repo-url> pixiu-core
cd pixiu-core
pwsh -File scripts/setup/bootstrap.ps1
```

`bootstrap.ps1` 冪等（可重跑），串起 6 步：

1. `git submodule update --init` — 拉 cybersecurity library（754 skills；普通 clone **不帶** submodule 內容）
2. `setx PIXIU_CORE` — 設環境變數（永久 user 層 + 本 session 立即）
3. 建 `~/.pixiu-core` junction → 母體
4. 建 `~/.claude/{agents,hooks,rules,scripts}` junction → 母體
5. 呼叫 `install-to-cli.ps1` — Claude Code 的 skills junction + commands + settings.json hooks
6. 呼叫 `install-to-codex.js` — 生成 `~/.codex/hooks.json`，並遷移 `config.toml` 內舊的 codebase-memory hook 區塊

## 腳本清單

| 腳本 | 用途 |
|---|---|
| `bootstrap.ps1` | **一鍵總入口**（新機器 clone 後跑這個） |
| `install-to-cli.ps1` | 只接 Claude Code（skills junction + settings.json hooks），冪等 |
| `install-to-codex.js` | 只接 Codex（node 跨平台生成 hooks.json、遷移舊 TOML hook，node 路徑動態） |
| `uninstall-from-cli.ps1` | 回滾 Claude Code 注入（只動 `~/.claude/`） |

## 個別接線（已部署過、只想補某一半）

```powershell
pwsh -File scripts/setup/install-to-cli.ps1   # 只補 Claude Code
node scripts/setup/install-to-codex.js         # 只補 Codex
```

## 可攜性保證

- node 路徑動態（`process.execPath`）；母體路徑三層 fallback（`PIXIU_CORE` → `PIXIU_CORE_PATH` → `~/.pixiu-core`）；junction 與 hooks 全用相對母體位置。**無寫死機器路徑。**
- Codex bridge 納入母體 `scripts/codex-bridge/`；wiki capture 是可選依賴（`PIXIU_WIKI_POC`，未設定時自動 skip，不影響核心）。
- Codex hook 定義以 `~/.codex/hooks.json` 為唯一來源；`config.toml` 只保留 `[hooks.state]` 等執行狀態。

## 裝完後驗收

Claude Code 新 session：

1. `/hooks` → 看到 pixiu 系列（guardrails / auto-recap）
2. `/go` → 不再 `Unknown command`
3. 測 `echo --dangerously-skip-permissions`（明說是測試）→ 被 `pre:pixiu:auto-mode-guard` 擋

Codex 新 session：

- `echo --dangerously-skip-permissions`（明說是測試）→ 應被擋（測 Codex shell 工具名有無盲區）

## 安全保證

- `install-to-cli.ps1` 只 merge settings.json 的 `hooks` + 清 `defaultMode: auto`，不覆蓋其他欄位；每次先備份
- `install-to-codex.js` 只移除 marker 成對且唯一的舊 TOML hook 區塊；先備份、再原子替換，其他 Codex 設定與 `[hooks.state]` 原樣保留
- 母體 `%PIXIU_CORE%\` 只讀，不動原始檔
- `bootstrap.ps1` 冪等：junction 已存在則跳過；遇同名非 junction 目錄只警告、不覆蓋

## 回滾

```powershell
pwsh -File scripts/setup/uninstall-from-cli.ps1
```

只動 `~/.claude/`，母體資料夾完全不受影響。

## 版本

- v0.2.1｜2026-07-15｜Codex hooks 改為單一 `hooks.json` 來源，部署時安全遷移舊 `config.toml` hook
- v0.2.0｜2026-07-07｜加 `bootstrap.ps1` 一鍵入口、Codex 接線（`install-to-codex.js`）、`install-to-cli.ps1` 的 auto-mode-guard matcher 補 PowerShell（修 PowerShell 盲區）
- v0.1.0｜2026-04-17｜初版（僅 `install-to-cli.ps1`）
