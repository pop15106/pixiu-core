# RooCode 異形母體連結腳本 (PowerShell)
# 用於快速將當前專案連結至 PixiuCore 母體

$pixiuPath = $env:PIXIU_CORE_PATH
if (-not $pixiuPath) {
    $pixiuPath = "C:\PixiuCore"
}

if (-not (Test-Path $pixiuPath)) {
    Write-Error "找不到母體核心路徑: $pixiuPath"
    exit 1
}

# 1. 建立 .clinerules 連結 (RooCode 專屬規則)
$clinerulesPath = Join-Path $PWD ".clinerules"
$sourceRules = Join-Path $pixiuPath "user_rules.md"

if (Test-Path $clinerulesPath) {
    Write-Host "已存在 .clinerules，正在備份..."
    Rename-Item $clinerulesPath ".clinerules.bak" -Force
}

New-Item -ItemType HardLink -Path $clinerulesPath -Target $sourceRules
Write-Host "✅ 成功連結 .clinerules -> $sourceRules"

# 2. 注入母體技能載入提示
Write-Host "💡 提示：您可以在 RooCode 中使用指令讀取母體技能，路徑為: $($pixiuPath)\.agent\skills"
