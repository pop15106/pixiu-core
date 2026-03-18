param (
    [string]$ProjectPath = (Get-Location).Path
)

$MotherRules = "C:\PixiuCore\user_rules.md"
$AgentLinks = @{
    ".clinerules"  = "RooCode (Cline)"
    ".codexrules"  = "Codex"
}

Write-Host "--- Pixiu 母體代理人連結工具 ---" -ForegroundColor Cyan
Write-Host "目標專案: $ProjectPath"

if (!(Test-Path $MotherRules)) {
    Write-Error "錯誤: 找不到母體規則檔案：$MotherRules"
    exit 1
}

foreach ($LinkName in $AgentLinks.Keys) {
    $TargetPath = Join-Path $ProjectPath $LinkName
    $AgentName = $AgentLinks[$LinkName]

    if (Test-Path $TargetPath) {
        Write-Host "警告: $AgentName 連結檔案已存在 ($LinkName)，正在備份..." -ForegroundColor Yellow
        Move-Item $TargetPath "$TargetPath.bak" -Force
    }

    Write-Host "正在為 $AgentName 建立符號連結..." -ForegroundColor Green
    New-Item -ItemType SymbolicLink -Path $TargetPath -Target $MotherRules -Force
}

Write-Host "連結完成！請重啟 VS Code 以讓代理人載入新規則。" -ForegroundColor Cyan
