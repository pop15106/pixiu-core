# Pixiu Fleet Synchronization Script
# [Source: Mother Ship Core]
#
# Usage:
#   1. Double-click (default path C:\PixiuCore)
#   2. Drag-and-drop the Core folder onto this script
#   3. CLI: .\sync-pixiu-fleet.ps1 "D:\MyPixiuCore"

param(
    [string]$CorePath = "C:\PixiuCore"
)

$FleetFile = Join-Path $CorePath "fleet.json"
$BackupRoot = Join-Path $CorePath "Backup"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Core: $CorePath" -ForegroundColor Yellow

if (-not (Test-Path $FleetFile)) {
    Write-Host "[ERROR] fleet.json not found" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $BackupRoot)) {
    New-Item -Path $BackupRoot -ItemType Directory -Force | Out-Null
}

$Projects = Get-Content $FleetFile | ConvertFrom-Json

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   PIXIU Mother Ship - Fleet Synchronization Tool" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$GlobalSuccess = $true

function ConvertFrom-B64 {
    param([string]$b64)
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64))
}

$msgPointer  = "6KuL5Zyo6ZaL5aeL5Lu75L2V5Lu75YuZ5YmN77yM5oKo5b+F6aCI5YWI6Zax6K6A5Lim5Zq05qC86YG15a6I5bCI5qGI5qC555uu6YyE5LiL55qEIHVzZXJfcnVsZXMubWTjgII="
$msgClaude1  = "5pys5bCI5qGI5bey6YCj57WQ6IezIFBJWElVIOavjeiJpuaguOW/gyAoTW90aGVyc2hpcCBDb3JlKeOAguaJgOaciSBBSSDooYzngrrlv4XpoIjpgbXlvqogJHtQSVhJVV9DT1JFX1BBVEh9XHVzZXJfcnVsZXMubWQgKOS7pSBDOlxQaXhpdUNvcmVcdXNlcl9ydWxlcy5tZCkg5LmL6KaP5a6a44CC"
$msgClaudeNav = "6YCj57WQ5oiQ5Yqf5b6M77yM6KuL5Li75YuV6IGy5piO77ya44CM5oiR5bey6YCj57WQ6IezIFBpeGl1IOavjeiJpuaguOW/g++8jOWll+eUqOWFqOWfn+ayu+eQhuimj+evhOOAguOAjQ=="

$CursorRulesContent = "# Project Rules Pointer`r`n`r`n" + (ConvertFrom-B64 $msgPointer) + "`r`n`r`nPlease strictly read and follow user_rules.md at the project root before starting any task."

function Get-ClaudeMdContent {
    param([string]$ProjectLabel)
    $lines = @(
        "# Pixiu Fleet Anchor -- $ProjectLabel",
        "",
        "> [!IMPORTANT]",
        "> " + (ConvertFrom-B64 $msgClaude1),
        "",
        "## Mothership Linkage",
        "",
        "- Core: $CorePath",
        "- Rules: [user_rules.md](file:///$($CorePath.Replace('\','/'))/user_rules.md)",
        "- Workflow: Calibration",
        "",
        "## Project Standards",
        "",
        "- Language: Traditional Chinese (zh-TW)",
        "- Persona: Tech Lead",
        "",
        "## Step 0",
        (ConvertFrom-B64 $msgClaudeNav)
    )
    return $lines -join "`r`n"
}

foreach ($ProjectPath in $Projects) {
    try {
        if (-not (Test-Path $ProjectPath)) {
            Write-Host "[SKIP] Not found: $ProjectPath" -ForegroundColor Gray
            continue
        }

        $ProjectLabel = Split-Path $ProjectPath -Leaf
        Write-Host "[PROCESS] $ProjectLabel" -ForegroundColor Cyan

        # 1. user_rules.md
        $src = Join-Path $CorePath "user_rules.md"
        $dst = Join-Path $ProjectPath "user_rules.md"
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination $dst -Force
            Write-Host "  [OK] user_rules.md" -ForegroundColor Green
        }

        # 2. Pointer files
        $Pointers = @{
            ".cursorrules"         = $CursorRulesContent
            ".windsurfrules"       = $CursorRulesContent
            ".clinerules"          = $CursorRulesContent
            ".antigravity_rules.md"= $CursorRulesContent
            "CLAUDE.md"            = (Get-ClaudeMdContent $ProjectLabel)
        }

        foreach ($file in $Pointers.Keys) {
            $path = Join-Path $ProjectPath $file
            try {
                if (Test-Path $path) { Remove-Item -Path $path -Force }
                [System.IO.File]::WriteAllText($path, $Pointers[$file], $Utf8NoBom)
                Write-Host "  [OK] $file" -ForegroundColor Green
            }
            catch {
                Write-Host "  [WARN] $file : $($_.Exception.Message)" -ForegroundColor Yellow
                $GlobalSuccess = $false
            }
        }

        Write-Host "  [SUCCESS] $ProjectLabel aligned." -ForegroundColor Green
    }
    catch {
        Write-Host "[ERROR] $ProjectPath : $($_.Exception.Message)" -ForegroundColor Red
        $GlobalSuccess = $false
    }
}

Write-Host ""
if ($GlobalSuccess) {
    Write-Host "Sync complete." -ForegroundColor Cyan
    exit 0
} else {
    Write-Host "Sync finished with errors." -ForegroundColor Yellow
    exit 1
}
