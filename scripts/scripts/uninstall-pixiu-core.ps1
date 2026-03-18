<#
.SYNOPSIS
    Pixiu 母艦共用模式 - 解除部署與 Rollback 腳本
    此腳本負責清除全域掛載設定，將開發環境恢復純淨。

.DESCRIPTION
    1. 移除 User 層級環境變數 PIXIU_CORE_PATH。
    2. 如果有指定 ProjectPath，從母艦的艦隊清單 (fleet.json) 中移除該路徑。
    3. 從 VSCode/Cursor 設定中移除 pixiu.core 相關屬性。
#>

param (
    [string]$ProjectPath = $null
)

$ErrorActionPreference = "Continue"

$CorePath = "C:\PixiuCore"
$FleetFile = "$CorePath\fleet.json"

Write-Host "🧹 開始執行 Pixiu 母艦解除部署與清理程序..." -ForegroundColor Cyan

# 1. 移除環境變數
Write-Host "📡 正在移除環境變數 PIXIU_CORE_PATH..." -ForegroundColor Yellow
[Environment]::SetEnvironmentVariable("PIXIU_CORE_PATH", $null, [EnvironmentVariableTarget]::User)
Write-Host "✅ 環境變數已清除。" -ForegroundColor Green

# 2. 如果有指定專案，從艦隊名錄中移除
if ($null -ne $ProjectPath -and (Test-Path $FleetFile)) {
    $AbsPath = (Resolve-Path $ProjectPath).Path
    Write-Host "📜 正在從艦隊名錄中移除專案：$AbsPath" -ForegroundColor Yellow
    
    $Fleet = Get-Content $FleetFile | ConvertFrom-Json
    $NewFleet = $Fleet | Where-Object { $_ -ne $AbsPath }
    
    $NewFleet | ConvertTo-Json | Out-File $FleetFile -Encoding UTF8
    Write-Host "✅ 專案已從名錄中移除。" -ForegroundColor Green
}

# 3. 清理 IDE 設定

foreach ($Path in $IDESettingsPaths) {
    if (Test-Path $Path) {
        Write-Host "📝 清理 IDE 設定檔：$Path" -ForegroundColor Cyan
        try {
            # 讀取 JSON 並過濾掉 Pixiu 相關 Key
            $Content = Get-Content $Path -Raw | ConvertFrom-Json
            $NewSettings = New-Object PSObject
            
            foreach ($Prop in $Content.psobject.Properties) {
                if ($Prop.Name -notmatch "^pixiu\.") {
                    $NewSettings | Add-Member -MemberType NoteProperty -Name $Prop.Name -Value $Prop.Value
                }
            }
            
            $NewSettings | ConvertTo-Json -Depth 10 | Set-Content $Path -Encoding UTF8
            Write-Host "✅ 已成功清除 $Path 中的母艦指示。" -ForegroundColor Green
        }
        catch {
            Write-Warning "⚠️ 清理 $Path 時發生錯誤。"
        }
    }
}

Write-Host "✨ 清理完成！開發環境已恢復純淨。" -ForegroundColor Cyan
Write-Host "請重新啟動 IDE 以完全套用變更。" -ForegroundColor Gray
