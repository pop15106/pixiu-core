param(
    [string]$PixiuCore
)

if (-not $PixiuCore) {
    if ($env:PIXIU_CORE) {
        $PixiuCore = $env:PIXIU_CORE
    } elseif ($env:PIXIU_CORE_PATH) {
        $PixiuCore = $env:PIXIU_CORE_PATH
    } else {
        $PixiuCore = Join-Path $env:USERPROFILE ".pixiu-core"
    }
}

$agentsDir = Join-Path $PixiuCore "agents"
if (-not (Test-Path -LiteralPath $agentsDir)) {
    Write-Error "agents directory not found: $agentsDir"
    exit 1
}

$agents = Get-ChildItem -LiteralPath $agentsDir -Filter "*.md" -File | Sort-Object Name
$mapPath = Join-Path (Split-Path $PSScriptRoot -Parent) "references\agent-routing-map.md"
$mapText = if (Test-Path -LiteralPath $mapPath) { Get-Content -Raw -LiteralPath $mapPath } else { "" }

$missing = @()
foreach ($agent in $agents) {
    $name = [System.IO.Path]::GetFileNameWithoutExtension($agent.Name)
    $needle = [char]96 + $name + [char]96
    if ($mapText -notmatch [regex]::Escape($needle)) {
        $missing += $name
    }
}

[pscustomobject]@{
    PixiuCore = $PixiuCore
    AgentCount = $agents.Count
    RoutingMap = $mapPath
    MissingFromMap = $missing -join ", "
} | Format-List

if ($missing.Count -gt 0) {
    exit 2
}
