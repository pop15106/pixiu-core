# Pixiu Fleet Agent Cleanup Script
# [來源: 母體核心] 
# 引進備份機制與 Try-Catch 保護，確保同步過程可逆且穩定。

$CorePath = $env:PIXIU_CORE
if ([string]::IsNullOrWhiteSpace($CorePath)) { $CorePath = $env:PIXIU_CORE_PATH }
if ([string]::IsNullOrWhiteSpace($CorePath)) { $CorePath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }
$CorePath = (Resolve-Path $CorePath).Path
$FleetFile = Join-Path $CorePath 'fleet.json'
$BackupRoot = Join-Path $CorePath 'Backup'
$Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$CurrentBackupDir = Join-Path $BackupRoot "fleet_sync_$Timestamp"

if (-not (Test-Path $FleetFile)) {
    Write-Host "[ERROR] fleet.json not found at $FleetFile" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $BackupRoot)) { New-Item -Path $BackupRoot -ItemType Directory -Force | Out-Null }

$Projects = Get-Content $FleetFile | ConvertFrom-Json

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   PIXIU Mother Ship - Fleet Agent Cleanup Tool (V2)" -ForegroundColor Cyan
Write-Host "   備份存檔點: $CurrentBackupDir" -ForegroundColor Gray
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$GlobalSuccess = $true

foreach ($ProjectPath in $Projects) {
    try {
        if (-not (Test-Path $ProjectPath)) {
            Write-Host "[SKIP] Project path not found: $ProjectPath" -ForegroundColor Gray
            continue
        }

        $AgentPath = Join-Path $ProjectPath ".agent"
        if (Test-Path $AgentPath) {
            Write-Host "[PROCESS] Cleaning up .agent in: $ProjectPath" -ForegroundColor Yellow
            $DirsToRemove = @("skills", "workflows", "agents")
            foreach ($Dir in $DirsToRemove) {
                $TargetSubDir = Join-Path $AgentPath $Dir
                if (Test-Path $TargetSubDir) {
                    $ProjectFolderName = Split-Path $ProjectPath -Leaf
                    $BackupPath = Join-Path $CurrentBackupDir "$ProjectFolderName\$Dir"
                    $ParentDir = Split-Path $BackupPath
                    if (-not (Test-Path $ParentDir)) { New-Item -Path $ParentDir -ItemType Directory -Force | Out-Null }
                    Copy-Item -Path $TargetSubDir -Destination $BackupPath -Recurse -Force
                    Remove-Item -Path $TargetSubDir -Recurse -Force
                }
            }
            Write-Host "  [OK] 同步完成，已受母體核心接管。" -ForegroundColor Green
        } else {
            Write-Host "[OK] No local .agent found in: $ProjectPath" -ForegroundColor Green
        }

        $ProjectName = Split-Path $ProjectPath -Leaf
        $TargetClaude = Join-Path $ProjectPath "CLAUDE.md"
        $TargetCodex = Join-Path $ProjectPath "CODEX.md"

        $ClaudeSource = Join-Path $CorePath "CLAUDE.md"`r`n        if (Test-Path $ClaudeSource) {`r`n            $ClaudeContent = Get-Content $ClaudeSource -Raw
            $ClaudeContent = $ClaudeContent -replace ('\{PROJECT_NAME\}'), $ProjectName
            $ClaudeContent | Set-Content $TargetClaude -Encoding UTF8
            Write-Host "  - 已同步 CLAUDE.md ($ProjectName)" -ForegroundColor Cyan
        }

        $CodexSource = Join-Path $CorePath "CODEX.md"`r`n        if (Test-Path $CodexSource) {`r`n            Copy-Item $CodexSource -Destination $TargetCodex -Force
            Write-Host "  - 已同步 CODEX.md" -ForegroundColor Cyan
        }
    } catch {
        Write-Host ("[ERROR] 處理專案 $ProjectPath 時發生錯誤: " + $_.Exception.Message) -ForegroundColor Red
        $GlobalSuccess = $false
    }
}

if ($GlobalSuccess) {
    Write-Host "Fleet cleanup complete." -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "Fleet cleanup finished WITH ERRORS." -ForegroundColor Yellow
    exit 1
}
