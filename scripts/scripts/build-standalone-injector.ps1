# Builder to create the standalone injector
$OutputFile = Join-Path $PSScriptRoot "transplant-skills-standalone.ps1"

# Script Template (Pure English for UI to avoid encoding parser errors in PS 5.1)
$ScriptTemplate = @'
param (
    [string]$TargetDir,
    [string]$ProjectName
)

# 🚀 Interactive Mode
if ([string]::IsNullOrEmpty($TargetDir)) {
    Write-Host "`n[?] Target Project Path?" -ForegroundColor Yellow -NoNewline
    Write-Host " (You can drag the folder here)" -ForegroundColor Gray
    $TargetDir = (Read-Host " >> ").Trim('"')
}

if ([string]::IsNullOrEmpty($ProjectName)) {
    Write-Host "[?] New Project Label?" -ForegroundColor Yellow -NoNewline
    Write-Host " (e.g., PCLMS)" -ForegroundColor Gray
    $ProjectName = Read-Host " >> "
}

# Basic Check
if (!(Test-Path $TargetDir)) {
    Write-Host "!! Error: Path not found '$TargetDir'" -ForegroundColor Red
    Pause
    exit
}

Write-Host "`n🚀 Injecting Standalone Tech Lead Skills..." -ForegroundColor Cyan

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Write-SkillFile {
    param($Path, $Base64Content)
    $FullDir = [System.IO.Path]::GetDirectoryName($Path)
    if (!(Test-Path $FullDir)) {
        New-Item -ItemType Directory -Path $FullDir -Force | Out-Null
    }
    
    $Bytes = [Convert]::FromBase64String($Base64Content)
    $Content = [System.Text.Encoding]::UTF8.GetString($Bytes)
    
    $Content = $Content -replace "PTWCS", $ProjectName
    $Content = $Content -replace "PCLMS_BK_new", $ProjectName
    
    [System.IO.File]::WriteAllText($Path, $Content, $Utf8NoBom)
    Write-Host "  [OK] Saved: $([System.IO.Path]::GetFileName($Path))" -ForegroundColor Green
}

# Start Injection
'@

# Use UTF-8 WITH BOM for the generated .ps1 so PowerShell 5.1 reads it correctly
$Utf8WithBom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText($OutputFile, $ScriptTemplate, $Utf8WithBom)

$FilesToBundle = @(
    @{ Source = "..\.agent\skills\architect-protocol\architect_protocol_guide.md"; Target = ".agent\skills\architect-protocol\architect_protocol_guide.md" },
    @{ Source = "..\.agent\skills\architect-protocol\module1_context_mapping.md"; Target = ".agent\skills\architect-protocol\module1_context_mapping.md" },
    @{ Source = "..\.agent\skills\architect-protocol\module2_debt_detection.md"; Target = ".agent\skills\architect-protocol\module2_debt_detection.md" },
    @{ Source = "..\.agent\skills\architect-protocol\module3_architectural_blueprinting.md"; Target = ".agent\skills\architect-protocol\module3_architectural_blueprinting.md" },
    @{ Source = "..\.agent\skills\architect-protocol\module4_boy_scout_execution.md"; Target = ".agent\skills\architect-protocol\module4_boy_scout_execution.md" },
    @{ Source = "..\.agent\skills\architect-protocol\module5_verification.md"; Target = ".agent\skills\architect-protocol\module5_verification.md" },
    @{ Source = "..\.agent\skills\claude-reasoning-modes\SKILL.md"; Target = ".agent\skills\claude-reasoning-modes\SKILL.md" },
    @{ Source = "..\.agent\skills\claude-reasoning-modes\claude_integration_guide.md"; Target = ".agent\skills\claude-reasoning-modes\claude_integration_guide.md" },
    @{ Source = "..\.agent\skills\claude-reasoning-modes\claude_reasoning_modes.md"; Target = ".agent\skills\claude-reasoning-modes\claude_reasoning_modes.md" },
    @{ Source = "..\user_rules.md"; Target = "user_rules.md" }
)

foreach ($Item in $FilesToBundle) {
    $FullPath = Join-Path $PSScriptRoot $Item.Source
    if (Test-Path $FullPath) {
        $Bytes = [System.IO.File]::ReadAllBytes($FullPath)
        $Base64 = [Convert]::ToBase64String($Bytes)
        
        $RelPath = $Item.Target
        # Fix: Ensure variable escaping in string interpolation
        $WriteCode = "`nWrite-SkillFile -Path (Join-Path `$TargetDir `"$RelPath`") -Base64Content `"$Base64`""
        
        [System.IO.File]::AppendAllText($OutputFile, $WriteCode, $Utf8WithBom)
    }
    else {
        Write-Warning "File not found: $FullPath"
    }
}

$Footer = @"

Write-Host "`n  >> All skills injected successfully! You are good to go." -ForegroundColor Yellow
Write-Host "  >> Target: `$TargetDir"
Write-Host "  >> Project: `$ProjectName"
Write-Host "`n[Press any key to exit...]"
`$null = `$Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
"@
[System.IO.File]::AppendAllText($OutputFile, $Footer, $Utf8WithBom)

Write-Host "Builder completed. $OutputFile is generated." -ForegroundColor Green
