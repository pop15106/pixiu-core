# Pixiu Document Health Auditor
# Global Framework Script - Works for all offspring projects

param (
    [string]$TargetDir = (Get-Location).Path
)

# Setup console for UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   PIXIU Mother Ship - Document Health Auditor" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Target: $TargetDir" -ForegroundColor Gray
Write-Host ""

# Try to find Source and Docs directories
$SrcDir = @("$TargetDir\src", "$TargetDir\ptwcs_ap\src", "$TargetDir\main\src") | Where-Object { Test-Path $_ } | Select-Object -First 1
$DocsDir = @("$TargetDir\docs", "$TargetDir\doc") | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($null -eq $SrcDir) {
    Write-Host "[INFO] No common 'src' directory found. Using project root for source check." -ForegroundColor Gray
    $SrcDir = $TargetDir
}

if (-not (Test-Path $DocsDir)) {
    Write-Host "[WARN] Documentation directory ('docs/') not found. Skipping sync check." -ForegroundColor Yellow
}
else {
    # 1. Time-delta check (Source vs Docs)
    # Exclude .git and .agent folders to get meaningful timestamp
    $LastSrcMod = Get-ChildItem -Path $SrcDir -Recurse -File | Where-Object { $_.FullName -notmatch "\\\.git|\\\.agent|\\\.gemini" } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $LastDocMod = Get-ChildItem -Path $DocsDir -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1


    if ($null -ne $LastSrcMod -and $null -ne $LastDocMod) {
        if ($LastSrcMod.LastWriteTime -gt $LastDocMod.LastWriteTime) {
            Write-Host "[🚨 ALERT] Source code was modified AFTER documentation." -ForegroundColor Red
            Write-Host "  - Last Source: $($LastSrcMod.LastWriteTime) ($($LastSrcMod.Name))" -ForegroundColor Gray
            Write-Host "  - Last Document: $($LastDocMod.LastWriteTime)" -ForegroundColor Gray
            Write-Host "  >> Suggestion: Run /doc-sync in your IDE to update docs." -ForegroundColor Yellow
        }
        else {
            Write-Host "[✅ OK] Documentation is up-to-date relative to source code." -ForegroundColor Green
        }
    }
}

# 2. Ledger Audit
if (Test-Path $LedgerFile) {
    $Content = Get-Content $LedgerFile -ErrorAction SilentlyContinue
    if ($null -ne $Content) {
        $Lines = $Content.Count
        if ($Lines -gt 500) {
            Write-Host "[⚠️ WARNING] project-ledger.md is too large ($Lines lines)." -ForegroundColor Yellow
            Write-Host "  >> Threshold: 500 lines. Please distill lessons into Mother Ship." -ForegroundColor White
        }
        else {
            Write-Host "[✅ OK] project-ledger.md capacity is healthy ($Lines lines)." -ForegroundColor Green
        }
    }
}

else {
    Write-Host "[INFO] project-ledger.md not found in target." -ForegroundColor Gray
}

# 3. Git Status Check (Optional)
if (Test-Path (Join-Path $TargetDir ".git")) {
    $GitStatus = git -C $TargetDir status --porcelain
    if ($null -ne $GitStatus) {
        Write-Host "[📊 INFO] Uncommitted changes detected. Remember to update CHANGELOG.md before commit." -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "Audit Complete." -ForegroundColor Cyan
