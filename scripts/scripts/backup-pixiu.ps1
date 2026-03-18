$ProjectRootDir = (Get-Item $PSScriptRoot).Parent.FullName
$AgentDir = Join-Path $ProjectRootDir ".agent"
$BackupFile = Join-Path $ProjectRootDir "pixiu_framework_backup.zip"
$TransplantPs1 = Join-Path $ProjectRootDir "transplant-pixiu.ps1"
$TransplantBat = Join-Path $ProjectRootDir "移植框架.bat"

Write-Host "[Pixiu Backup] Internal process starting..."

if (!(Test-Path $AgentDir)) { exit 1 }
if (Test-Path $BackupFile) { Remove-Item $BackupFile -Force }

# 1. Collect
$TempPath = Join-Path $env:TEMP "pixiu_bk_$(Get-Date -Format 'HHmmss')"
New-Item -ItemType Directory -Path $TempPath -Force | Out-Null

$Files = Get-ChildItem -Path $AgentDir -Recurse -File | Where-Object {
    $FullName = $_.FullName
    $FullName -notmatch "\\logs\\" -and
    $FullName -notmatch "\\backups\\" -and
    $FullName -notmatch "\\reports\\audit-" -and
    $FullName -notmatch "\.log$" -and
    $FullName -notmatch "\.bak$"
}

foreach ($File in $Files) {
    $Rel = $File.FullName.Substring($AgentDir.Length + 1)
    $Dest = Join-Path $TempPath $Rel
    $Dir = Split-Path $Dest
    if (!(Test-Path $Dir)) { New-Item -ItemType Directory -Path $Dir -Force | Out-Null }
    Copy-Item -Path $File.FullName -Destination $Dest -ErrorAction SilentlyContinue
}

# 2. Pack
Compress-Archive -Path "$TempPath\*" -DestinationPath $BackupFile -Force
Remove-Item -Path $TempPath -Recurse -Force -ErrorAction SilentlyContinue

# 3. Extra tools
if (Test-Path (Join-Path $PSScriptRoot "transplant-pixiu.ps1")) {
    Copy-Item -Path (Join-Path $PSScriptRoot "transplant-pixiu.ps1") -Destination $TransplantPs1 -Force
}

$Line1 = "@echo off"
$Line2 = "echo 🚀 Starting Pixiu framework injection..."
$Line3 = 'powershell -ExecutionPolicy Bypass -File "%~dp0transplant-pixiu.ps1"'
$Line4 = "pause"
$BatContent = "$Line1`r`n$Line2`r`n$Line3`r`n$Line4"

[System.IO.File]::WriteAllText($TransplantBat, $BatContent, [System.Text.Encoding]::Default)

Write-Host "Success: Backup and tools are ready."
exit 0
