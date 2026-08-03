# PixiuCore 全域入口同步

此工具只管理三個使用者層入口檔：

- `%USERPROFILE%\.codex\AGENTS.md`
- `%USERPROFILE%\.claude\CLAUDE.md`
- `%USERPROFILE%\.gemini\GEMINI.md`

它不修改 junction、Codex `hooks.json`、Claude `settings.json`、DevSpace process、Dev Tunnel 或全域 DevSpace 套件。

## 設計

使用者層入口只保留短橋接規則，實際治理仍以 `C:\PixiuCore` 或環境變數解析出的母體為準：

1. 解析 `PIXIU_CORE`、`PIXIU_CORE_PATH`、`%USERPROFILE%\.pixiu-core`。
2. 讀取對應的 repo 入口檔。
3. 執行 `scripts/router/resolve-capabilities.js`。
4. 只載入 Router 回傳的 `filesToLoad`。

橋接檔含 `PIXIU-GLOBAL-ENTRY:1` marker。工具不會把 `user_rules.md`、identity、完整記憶、Skill 清單或 Hook 定義複製到使用者層入口。

## 唯讀檢查

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\entry-sync\Test-PixiuGlobalEntries.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\entry-sync\Test-PixiuLiveBindings.ps1
```

`Test-PixiuLiveBindings.ps1` 會檢查：

- `PIXIU_CORE`／`PIXIU_CORE_PATH`
- `%USERPROFILE%\.pixiu-core` junction
- `%USERPROFILE%\.agents\skills` junction
- `%USERPROFILE%\.claude\commands` junction
- Codex Hook bridge 檔案與 `hooks.json` 指向
- DevSpace 1.0.4 canonical Skill suppression marker
- 六檔 patch manifest

檢查只回報，不自動修復。

## 套用

套用會先完整 preflight，任一目標是 reparse point 或非檔案時，會在寫入任何入口前停止。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\entry-sync\Sync-PixiuGlobalEntries.ps1 `
  -Action Apply `
  -ConfirmApply
```

套用流程：

1. 驗證母體與三個入口來源存在。
2. 備份原入口到 `%USERPROFILE%\.pixiu-entry-backups\<時間戳-guid>`。
3. 寫入 UTF-8 無 BOM 短橋接檔。
4. 逐檔 read-back 與 SHA-256 驗證。
5. 寫入 `manifest.json`，供受控還原。

已是最新內容時不寫檔，也不建立新備份。

## 還原

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\entry-sync\Sync-PixiuGlobalEntries.ps1 `
  -Action Restore `
  -BackupSetPath "%USERPROFILE%\.pixiu-entry-backups\<備份目錄>" `
  -ConfirmRestore
```

還原前會驗證：

- manifest 版本
- 原始備份 SHA-256
- 目前入口仍是工具套用版本，或已經是原始版本
- 入口沒有被改成 reparse point

若套用後有其他程序修改入口，還原會拒絕，不會覆蓋外部變更。原本不存在的入口，只有在目前內容仍符合套用雜湊時才會移除。

## 測試

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\entry-sync\tests\run-tests.ps1
```

測試只使用 `%TEMP%` 下的臨時母體與使用者目錄，不會操作真實使用者設定。
