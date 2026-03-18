param (
    [Parameter(Mandatory = $true)]
    [string]$TargetDir,

    [Parameter(Mandatory = $true)]
    [string]$ProjectName
)

$SourceBase = "c:\Users\7010\Desktop\gravityTest\PTWCS\.agent\skills"
$Skills = @("architect-protocol", "claude-reasoning-modes")

write-host "🚀 啟動技能移植程序..." -ForegroundColor Cyan

foreach ($Skill in $Skills) {
    $SourcePath = Join-Path $SourceBase $Skill
    $DestPath = Join-Path $TargetDir ".agent\skills\$Skill"

    if (Test-Path $SourcePath) {
        write-host "📦 正在複製 $Skill 到 $DestPath..." -ForegroundColor Green
        if (!(Test-Path $DestPath)) {
            New-Item -ItemType Directory -Path $DestPath -Force | Out-Null
        }
        Copy-Item -Path "$SourcePath\*" -Destination $DestPath -Recurse -Force

        # 內容替換 (強制使用 UTF8 編碼防止亂碼)
        $Files = Get-ChildItem -Path $DestPath -Filter *.md -Recurse
        foreach ($File in $Files) {
            $Content = Get-Content $File.FullName -Raw -Encoding UTF8
            $UpdatedContent = $Content -replace "PTWCS", $ProjectName
            $UpdatedContent = $UpdatedContent -replace "PCLMS_BK_new", $ProjectName
            # 使用 UTF8 (無 BOM) 寫入
            $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($File.FullName, $UpdatedContent, $Utf8NoBom)
        }
    }
    else {
        write-warning "⚠️ 找不到來源技能目錄: $SourcePath"
    }
}

write-host "✅ 移植完成！專案名稱已更新為: $ProjectName" -ForegroundColor Yellow
