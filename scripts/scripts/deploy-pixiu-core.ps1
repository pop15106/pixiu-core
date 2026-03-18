<#
.SYNOPSIS
    Pixiu Mother Ship Mode - Zero-Intrusion Deploy Script
    Deployment logic for central framework integration.
#>

param (
    [string]$ProjectPath = $null,
    [switch]$Recursive = $false
)

$CorePath = "C:\PixiuCore"
$FleetFile = "$CorePath\fleet.json"
$ErrorActionPreference = "Stop"

# Use UTF8 with BOM for console output
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if ([string]::IsNullOrWhiteSpace($ProjectPath)) {
    Write-Host "[PIXIU] No project path provided." -ForegroundColor Yellow
    $ProjectPath = Read-Host "[PIXIU] Please drag your project folder here and press Enter"
    $ProjectPath = $ProjectPath.Replace('"', '').Trim()
}

Write-Host "[PIXIU] Starting deployment..." -ForegroundColor Cyan

# 1. Verify Core
if (-not (Test-Path $CorePath)) {
    Write-Host "[ERROR] Mother ship core not found at $CorePath" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Mother ship verified: $CorePath" -ForegroundColor Green

# Define Registration Logic
function Register-Project ([string]$TargetDir) {
    if ([string]::IsNullOrWhiteSpace($TargetDir)) { return }
    try {
        $FullName = [System.IO.Path]::GetFullPath($TargetDir)
        $AbsPath = $FullName.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
        
        Write-Host "[REG] Registering: $AbsPath" -ForegroundColor Yellow
        
        if (-not (Test-Path $FleetFile)) {
            "[]" | Out-File $FleetFile -Encoding UTF8
        }
        
        # 強制將讀取結果宣告為陣列，防止單一元素時變為字串
        [array]$Fleet = Get-Content $FleetFile | ConvertFrom-Json
        if ($Fleet -notcontains $AbsPath) {
            $Fleet += $AbsPath
            $Fleet | ConvertTo-Json -Compress | Out-File $FleetFile -Encoding UTF8
            Write-Host "[OK] Added to fleet list." -ForegroundColor Green
        }
        else {
            Write-Host "[INFO] Already registered, skipping." -ForegroundColor Gray
        }
    }
    catch {
        Write-Warning "[WARN] Registration failed for $TargetDir. Reason: $($_.Exception.Message)"
    }
}

# 2. Execute Registration
if ($null -ne $ProjectPath) {
    if ($Recursive) {
        Write-Host "[SCAN] Auto-scanning: $ProjectPath" -ForegroundColor Cyan
        # Increase depth for nested enterprise structures and add .project (Eclipse) marker
        $ProjectDirs = Get-ChildItem -Path $ProjectPath -Directory -Recurse -Depth 4 | Where-Object {
            # 排除開發垃圾與框架暫存資料夾
            $_.FullName -notmatch 'node_modules|\\target|\\bin|\\obj|\\\.agent' -and (
                (Test-Path (Join-Path $_.FullName ".git")) -or 
                (Test-Path (Join-Path $_.FullName "pom.xml")) -or 
                (Test-Path (Join-Path $_.FullName ".project")) -or
                (Test-Path (Join-Path $_.FullName "package.json"))
            )
        }
        
        if ($null -eq $ProjectDirs -or $ProjectDirs.Count -eq 0) {
            Write-Host "[WARN] No projects (.git/pom.xml/.project/package.json) found in subdirectories." -ForegroundColor Red
        }
        else {
            foreach ($Dir in $ProjectDirs) {
                Register-Project $Dir.FullName
            }
        }
    }
    else {
        Register-Project $ProjectPath
    }
}

# 3. Environment Variable
Write-Host "[SYSTEM] Setting PIXIU_CORE_PATH environment variable..." -ForegroundColor Yellow
[Environment]::SetEnvironmentVariable("PIXIU_CORE_PATH", $CorePath, [EnvironmentVariableTarget]::User)

# 4. IDE Settings
$AppData = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::ApplicationData)
$IDESettingsPaths = @(
    "$AppData\Code\User\settings.json",
    "$AppData\Cursor\User\settings.json"
)

foreach ($Path in $IDESettingsPaths) {
    if (Test-Path $Path) {
        Write-Host "[IDE] Patching: $Path" -ForegroundColor Cyan
        try {
            $Settings = Get-Content $Path | ConvertFrom-Json
            
            # 安全注入或更新屬性
            if (-not ($Settings.PSObject.Properties["pixiu.core.managed"])) {
                $Settings | Add-Member -MemberType NoteProperty -Name "pixiu.core.managed" -Value $true
            }
            else {
                $Settings."pixiu.core.managed" = $true
            }
            
            if (-not ($Settings.PSObject.Properties["pixiu.core.path"])) {
                $Settings | Add-Member -MemberType NoteProperty -Name "pixiu.core.path" -Value $CorePath
            }
            else {
                $Settings."pixiu.core.path" = $CorePath
            }

            $Settings | ConvertTo-Json -Depth 10 | Set-Content $Path -Encoding UTF8
            Write-Host "[OK] IDE settings patched." -ForegroundColor Green
        }
        catch {
            Write-Warning "[IDE] Failed to patch $Path. Reason: $($_.Exception.Message)"
        }
    }
}

Write-Host "[DONE] Deployment complete!" -ForegroundColor Cyan
Write-Host "[HINT] Restart your IDE or Terminal to apply changes." -ForegroundColor Gray
