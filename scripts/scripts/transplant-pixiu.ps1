param (
    [string]$TargetDir,
    [string]$ProjectLabel
)

# 0. Setup paths
$SourceZip = Join-Path $PSScriptRoot "pixiu_framework_backup.zip"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "[Pixiu] Starting Transplant Process..." -ForegroundColor Cyan

# 1. Detection
if ([string]::IsNullOrEmpty($TargetDir)) {
    $TargetDir = $PSScriptRoot
}

# 2. Get Label
if ([string]::IsNullOrEmpty($ProjectLabel)) {
    Write-Host "[?] Please enter new project label (Default is folder name)" -ForegroundColor Yellow
    $DefaultLabel = Split-Path $TargetDir -Leaf
    $ProjectLabel = Read-Host " >> (Default: $DefaultLabel)"
    if ([string]::IsNullOrEmpty($ProjectLabel)) { $ProjectLabel = $DefaultLabel }
}

# 3. Check Zip
if (!(Test-Path $SourceZip)) {
    Write-Host "[ERROR] zip file not found: $SourceZip" -ForegroundColor Red
    Pause; exit 1
}

Write-Host "[*] Injecting into: $ProjectLabel ..." -ForegroundColor Cyan

# 4. Prepare .agent folder
$TargetAgentDir = Join-Path $TargetDir ".agent"
if (!(Test-Path $TargetAgentDir)) {
    New-Item -ItemType Directory -Path $TargetAgentDir -Force | Out-Null
}

# 5. Extract (Overwrite)
Write-Host "[*] Extracting framework components..." -ForegroundColor Gray
if (Get-Command tar -ErrorAction SilentlyContinue) {
    tar -x -f $SourceZip -C $TargetAgentDir
}
else {
    Expand-Archive -Path $SourceZip -DestinationPath $TargetAgentDir -Force
}

# 6. Adapt environment (Replace PTWCS label)
Write-Host "[*] Adapting environment tags..." -ForegroundColor Gray
$Items = Get-ChildItem -Path $TargetAgentDir -Recurse -File
foreach ($Item in $Items) {
    if ($Item.Extension -match "md|json|yaml|xml|bat|ps1") {
        try {
            $Content = Get-Content -Path $Item.FullName -Raw -ErrorAction SilentlyContinue
            if ($Content -match "PTWCS") {
                $NewContent = $Content -replace "PTWCS", $ProjectLabel
                [System.IO.File]::WriteAllText($Item.FullName, $NewContent, $Utf8NoBom)
                Write-Host "  [OK] Updated tag in: $($Item.Name)" -ForegroundColor Green
            }
        }
        catch { }
    }
}

# 7. Inject Constitution (user_rules.md)
$SourceRules = Join-Path $PSScriptRoot "user_rules.md"
$TargetRules = Join-Path $TargetDir "user_rules.md"
if (Test-Path $SourceRules) {
    if ($SourceRules -eq $TargetRules) {
        Write-Host "  [SKIP] user_rules.md is already at the target root. Skipping injection." -ForegroundColor Gray
    }
    else {
        Write-Host "[*] Injecting Constitution (user_rules.md)..." -ForegroundColor Cyan
        if (Test-Path $TargetRules) {
            Write-Host "  [WARNING] user_rules.md already exists in target. Backing up old version..." -ForegroundColor Yellow
            $BackupName = "user_rules_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').md"
            Copy-Item -Path $TargetRules -Destination (Join-Path $TargetDir $BackupName) -Force
        }
        Copy-Item -Path $SourceRules -Destination $TargetRules -Force
        Write-Host "  [OK] user_rules.md deployed successfully." -ForegroundColor Green
    }
}


Write-Host ""
Write-Host "SUCCESS: Pixiu framework has been transplanted." -ForegroundColor Green
Write-Host "New Label: $ProjectLabel"
Write-Host "Please restart your AI agent to apply changes."
Write-Host ""
Pause
