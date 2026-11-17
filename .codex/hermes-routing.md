# Hermes 路由（Codex）

> 由 `.codex/AGENTS.md` 按需載入；內容自根目錄 `AGENTS.md` 原樣移入，未改指令。

## Hermes 路由

只有使用者明確要求「用 Hermes」「透過 Hermes」「交給 Hermes」「Hermes gate」或同義語句時才啟用。

```powershell
$pixiu = if ($env:PIXIU_CORE) { $env:PIXIU_CORE } elseif ($env:PIXIU_CORE_PATH) { $env:PIXIU_CORE_PATH } else { "$env:USERPROFILE\.pixiu-core" }
$hermesRouteFile = Join-Path $pixiu "vault\context\hermes-host-home.txt"
$hermes = if ($env:HERMES_HOME) { $env:HERMES_HOME } elseif (Test-Path $hermesRouteFile) { (Get-Content -Raw $hermesRouteFile).Trim() } else { "$env:USERPROFILE\Documents\hermes 多AI 工作流" }
powershell -ExecutionPolicy Bypass -File "$hermes\scripts\hermes-submit-and-run.ps1" -Text "<使用者原始需求>" -SourceEntrance "codex"
```

執行後回報 `taskId`、狀態、state path 與 report path。腳本失敗時回報原始錯誤並停止，不得靜默改成本地直接實作。
