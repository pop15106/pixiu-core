# Pixiu 母體 → Claude Code CLI 部署包

> 這個資料夾把 `C:\PixiuCore\` 接進 `~/.claude\`，讓 Claude Code CLI 真的用得到母體的全功能。

## 為什麼需要這個

母體放在 `C:\PixiuCore\`，但 Claude Code CLI 只會掃：

- `~/.claude/commands/` — slash commands（`/go`、`/verify`…）
- `~/.claude/skills/` — skills
- `~/.claude/settings.json` 的 `hooks` 欄位 — hooks

不接通 = CLI 看不到母體，`/go` 會回 `Unknown command`、hooks 也不會跑。

## 腳本清單

| 腳本 | 用途 |
|------|------|
| `install-to-cli.ps1` | 一鍵部署（冪等，可重複跑） |
| `uninstall-from-cli.ps1` | 回滾（撤掉所有 Pixiu 注入） |

## 裝它會做什麼

1. 備份 `~/.claude/settings.json` 到 `~/.claude/backups/settings-<時間戳>.json`
2. 清掉違反 Pixiu 憲法的 `"defaultMode": "auto"`（若存在）
3. 複製 `C:\PixiuCore\commands\*.md` 到 `~/.claude/commands/`（目前只有 `go.md`）
4. 把 Pixiu hooks 寫進 `~/.claude/settings.json`：
   - `PreToolUse`：change-scope、auto-mode-guard
   - `PostToolUse`：secret-scan
   - `Stop`：mothership-sync
5. 為每個 `origin: Pixiu` 的 skill 在 `~/.claude/skills/` 下建立 junction，指向 `C:\PixiuCore\skills\<name>\`（母體更新即時生效）

## 安全保證

- **不覆蓋**使用者既有 settings 其他欄位（只 merge `hooks` 和清掉 `defaultMode: auto`）
- **不動**母體原始檔（`C:\PixiuCore\` 只讀）
- **每次執行先備份**舊 settings
- 僅處理 `origin: Pixiu` 的 skills，避免碰到 ECC 外掛的同名 skill

## 怎麼跑

### 方法 A｜右鍵跑

對著 `install-to-cli.ps1` 右鍵 → 以 PowerShell 執行。

### 方法 B｜PowerShell

```powershell
Set-ExecutionPolicy -Scope Process Bypass
C:\PixiuCore\scripts\setup\install-to-cli.ps1
```

## 裝完後驗收

新開一個 Claude Code session，依序跑：

1. `/go` → 應該**不會**再回 Unknown command
2. 問 `auto mode` → 應該觸發 Pixiu 三步驟授權流程（黑名單掃描 → 授權聲明 → 等「開」）
3. 模擬寫 `~/.claude/settings.json` 把 `defaultMode` 改 `auto` → 應該被 `pre:pixiu:auto-mode-guard` hook 直接 `exit 2` 擋下
4. 問 `recap` → 應該載入 `pixiu-session-recap` skill

## 回滾

```powershell
C:\PixiuCore\scripts\setup\uninstall-from-cli.ps1
```

回滾**只動** `~/.claude/`，母體資料夾 `C:\PixiuCore\` 完全不受影響。

## 版本

- v0.1.0｜2026-04-17｜初版
