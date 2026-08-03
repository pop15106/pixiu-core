# PixiuCore 全域入口與 Live Binding 架構

- 日期：2026-07-27
- 狀態：active
- 正式母體：`C:\PixiuCore`

## 問題

PixiuCore 同時存在兩種接線：

1. **Live binding**：junction、環境變數或 Hook command 直接指向 `C:\PixiuCore`。母體檔案一改，新 Session、下一次 Skill discovery、command 或 Hook 呼叫就會讀到新版。
2. **User-level copy**：`~/.codex/AGENTS.md`、`~/.claude/CLAUDE.md`、`~/.gemini/GEMINI.md` 是獨立檔案，不會跟母體自動同步，可能保留舊規則、全量載入流程或編碼損壞。

因此不能把所有入口都當成 junction，也不能只更新 repo 入口後假設使用者層副本會自動一致。

## 現行 Live Binding

| 入口 | 類型 | 目標 |
|---|---|---|
| `PIXIU_CORE` | 環境變數 | `C:\PixiuCore` |
| `PIXIU_CORE_PATH` | 環境變數 | `C:\PixiuCore` |
| `%USERPROFILE%\.pixiu-core` | junction | `C:\PixiuCore` |
| `%USERPROFILE%\.agents\skills` | junction | `C:\PixiuCore\skills` |
| `%USERPROFILE%\.claude\commands` | junction | `C:\PixiuCore\.agent\workflows` |
| `%USERPROFILE%\.codex\hooks.json` | command bridge | `C:\PixiuCore\scripts\codex-bridge\pixiu-global-hook-bridge.js` |

這些接線由 `Test-PixiuLiveBindings.ps1` 唯讀驗證，不由入口同步工具修復或重建。

## 全域入口策略

管理的使用者層副本只有：

- `%USERPROFILE%\.codex\AGENTS.md`
- `%USERPROFILE%\.claude\CLAUDE.md`
- `%USERPROFILE%\.gemini\GEMINI.md`

每個檔案只保留：

1. 母體路徑解析順序。
2. 對應 repo 入口檔。
3. `SESSION-BOOTSTRAP.md` 與 Capability Router 路由。
4. 只載入 `filesToLoad` 的約束。

不複製完整 L0、identity、memory、Skill 清單、Hook 定義或模型表。橋接檔以 `PIXIU-GLOBAL-ENTRY:1` marker 辨識。

## 安全操作流程

### Check

只讀檢查目前入口是否缺失、漂移、包含舊全量載入規則、出現 replacement character，或被改成 reparse point。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/entry-sync/Test-PixiuGlobalEntries.ps1
```

### Apply

`Apply` 必須明確傳入 `-ConfirmApply`。執行前一次 preflight 三個入口；任一目標或父目錄是 reparse point 時，在寫入任何入口前停止。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/entry-sync/Sync-PixiuGlobalEntries.ps1 `
  -Action Apply `
  -ConfirmApply
```

套用時：

1. 建立獨立 backup set。
2. 保留原始 bytes 與 SHA-256。
3. 以同目錄 temporary file 原子替換。
4. 以 UTF-8 無 BOM 寫入。
5. read-back 驗證完整內容。
6. 產生 `manifest.json`。

### Restore

`Restore` 必須明確傳入 `-ConfirmRestore` 與 backup set。若入口在 Apply 後被其他程序修改，拒絕覆蓋。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/entry-sync/Sync-PixiuGlobalEntries.ps1 `
  -Action Restore `
  -BackupSetPath <backup-set> `
  -ConfirmRestore
```

## Live Binding 檢查

```powershell
powershell -ExecutionPolicy Bypass -File scripts/entry-sync/Test-PixiuLiveBindings.ps1
```

檢查範圍：

- 兩個母體環境變數
- 三個 junction
- Codex Hook bridge 檔案與 `hooks.json` command
- DevSpace 1.0.4 canonical Skill suppression marker
- 六檔 OneClick patch manifest

此檢查不執行 repair、不重啟服務、不修改 Hook 或 junction。

## 合併與部署原則

1. 入口同步功能先在隔離 worktree 開發與測試。
2. 合併 repo 不等於套用使用者層入口。
3. 合併後先執行唯讀 Check 與 Live Binding 檢查。
4. 取得使用者明確核准後才執行 Apply。
5. Apply 後開新 Codex／Claude／Gemini Session 做 smoke test。
6. 不在同一維護動作中重建 junction、修改 Hook JSON 或重啟 DevSpace。

## 驗證

`run-lazy-loading-tests.ps1` 會執行入口同步的臨時目錄測試；測試不接觸真實使用者設定。
