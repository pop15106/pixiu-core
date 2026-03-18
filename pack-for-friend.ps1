# PixiuCore 自動打包腳本
# 用途：將 Pixiu 母艦內容打包成 .zip，方便分享給朋友並記錄版本

$version = Get-Date -Format "yyyyMMdd"
$outputName = "PixiuCore-$version.zip"
$outputPath = Join-Path $env:USERPROFILE "Desktop\$outputName"

Write-Host "📦 正在打包 PixiuCore..." -ForegroundColor Cyan

# 排除 .git 資料夾以減小體積
Compress-Archive -Path "C:\PixiuCore\*" -DestinationPath $outputPath -Force -ErrorAction Stop

Write-Host "✅ 打包完成！" -ForegroundColor Green
Write-Host "📍 檔案位置: $outputPath" -ForegroundColor Yellow
Write-Host "💡 提示：你可以直接把這個 zip 檔傳給朋友，讓他們解壓縮覆蓋即可同步。"
