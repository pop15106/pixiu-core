# Pixiu Mothership - Environment Init Script
# Public portable rule:
#   - The core root is inferred from this script location or the provided argument.
#   - Local tools use %USERPROFILE%\.pixiu-core as a stable junction.
#   - Repo files do not contain machine-specific absolute paths.

param(
    [string]$CorePath = ""
)

$ErrorActionPreference = 'Stop'
$Utf8NoBom = [System.Text.UTF8Encoding]::new($false)
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Resolve-FullPath {
    param([string]$Path)
    return [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
}

function Write-Utf8NoBom {
    param([string]$Path, [string]$Text)
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($Path, $Text, $Utf8NoBom)
}

function Set-Junction {
    param([string]$Path, [string]$Target)
    $Path = Resolve-FullPath $Path
    $Target = Resolve-FullPath $Target

    if (-not (Test-Path $Target)) {
        Write-Host "  [SKIP] Target missing: $Target" -ForegroundColor DarkGray
        return
    }

    if (Test-Path $Path) {
        $item = Get-Item -LiteralPath $Path -Force
        $targets = @($item.Target)
        if ($item.LinkType -eq 'Junction') {
            if ($targets -contains $Target) {
                Write-Host "  [OK] Junction already set: $Path" -ForegroundColor DarkCyan
                return
            }
            [System.IO.Directory]::Delete($Path, $false)
        } else {
            Write-Host "  [SKIP] Existing non-junction path kept: $Path" -ForegroundColor Yellow
            return
        }
    }

    $parent = Split-Path -Parent $Path
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    New-Item -ItemType Junction -Path $Path -Target $Target | Out-Null
    Write-Host "  [OK] Junction: $Path -> $Target" -ForegroundColor Green
}

function Resolve-PixiuCore {
    param([string]$InputPath)
    if ($InputPath) { return Resolve-FullPath $InputPath }
    return Resolve-FullPath (Split-Path -Parent $PSScriptRoot)
}

$SourceCorePath = Resolve-PixiuCore $CorePath
if (-not (Test-Path (Join-Path $SourceCorePath 'user_rules.md') -PathType Leaf)) {
    Write-Host "[ERROR] user_rules.md not found in: $SourceCorePath" -ForegroundColor Red
    exit 1
}

$StableCorePath = Resolve-FullPath (Join-Path $env:USERPROFILE '.pixiu-core')
$ClaudeDir = Join-Path $env:USERPROFILE '.claude'
$GeminiDir = Join-Path $env:USERPROFILE '.gemini'
$CodexDir = Join-Path $env:USERPROFILE '.codex'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "   PIXIU Mothership - Portable Init" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Source core : $SourceCorePath" -ForegroundColor Yellow
Write-Host "Stable link : $StableCorePath" -ForegroundColor Yellow
Write-Host ""

Set-Junction -Path $StableCorePath -Target $SourceCorePath

[Environment]::SetEnvironmentVariable('PIXIU_CORE', $StableCorePath, 'User')
[Environment]::SetEnvironmentVariable('PIXIU_CORE_PATH', $StableCorePath, 'User')
$env:PIXIU_CORE = $StableCorePath
$env:PIXIU_CORE_PATH = $StableCorePath
Write-Host "[OK] PIXIU_CORE = $StableCorePath" -ForegroundColor Green
Write-Host "[OK] PIXIU_CORE_PATH = $StableCorePath" -ForegroundColor Green

if (-not (Test-Path $ClaudeDir)) { New-Item -ItemType Directory -Path $ClaudeDir -Force | Out-Null }
if (-not (Test-Path $GeminiDir)) { New-Item -ItemType Directory -Path $GeminiDir -Force | Out-Null }
if (-not (Test-Path $CodexDir)) { New-Item -ItemType Directory -Path $CodexDir -Force | Out-Null }

$claudeLines = @(
    '# Pixiu Global Claude Code Configuration',
    '',
    '> Resolve Pixiu core in this order: PIXIU_CORE, PIXIU_CORE_PATH, then %USERPROFILE%\.pixiu-core.',
    "> Stable local core: $StableCorePath",
    '',
    '## Vault Init',
    '',
    "@$StableCorePath\vault\README.md",
    "@$StableCorePath\user_rules.md",
    "@$StableCorePath\vault\identity\founder-profile.md",
    "@$StableCorePath\vault\identity\agent-persona.md",
    "@$StableCorePath\vault\memory\memory-summary.md",
    '',
    '## ECC Common Rules',
    ''
)

$ruleFiles = @(
    'rules\README.md',
    'rules\common\agents.md',
    'rules\common\coding-style.md',
    'rules\common\development-workflow.md',
    'rules\common\git-workflow.md',
    'rules\common\hooks.md',
    'rules\common\security.md',
    'rules\common\testing.md',
    'rules\common\performance.md',
    'rules\common\patterns.md',
    'rules\common\prompt-engineering.md',
    'rules\typescript\coding-style.md',
    'rules\typescript\patterns.md',
    'rules\typescript\testing.md',
    'rules\python\coding-style.md',
    'rules\python\patterns.md',
    'rules\python\testing.md',
    'rules\golang\coding-style.md',
    'rules\golang\patterns.md',
    'rules\golang\testing.md',
    'rules\kotlin\coding-style.md',
    'rules\kotlin\patterns.md',
    'rules\kotlin\testing.md',
    'rules\cpp\coding-style.md',
    'rules\cpp\security.md',
    'rules\cpp\testing.md'
)

foreach ($rel in $ruleFiles) {
    if (Test-Path (Join-Path $StableCorePath $rel)) {
        $claudeLines += "@$StableCorePath\$rel"
    }
}
Write-Utf8NoBom -Path (Join-Path $ClaudeDir 'CLAUDE.md') -Text ($claudeLines -join "`r`n")
Write-Host "[OK] ~/.claude/CLAUDE.md" -ForegroundColor Green

$geminiText = @(
    '## PixiuCore Startup Rules',
    '',
    'At the start of each session, resolve the core path in this order:',
    '1. Use `PIXIU_CORE` when it exists.',
    '2. Otherwise use `PIXIU_CORE_PATH` when it exists.',
    '3. Otherwise use `%USERPROFILE%\.pixiu-core`.',
    '',
    'Read these files first:',
    '1. `%PIXIU_CORE%\vault\README.md`',
    '2. `%PIXIU_CORE%\user_rules.md`',
    '3. `%PIXIU_CORE%\vault\identity\founder-profile.md`',
    '4. `%PIXIU_CORE%\vault\identity\agent-persona.md`',
    '5. `%PIXIU_CORE%\vault\memory\memory-summary.md`',
    '',
    'Do not load the whole core folder. Read only the needed rules, skills, memory, and context files.'
) -join "`r`n"
Write-Utf8NoBom -Path (Join-Path $GeminiDir 'GEMINI.md') -Text $geminiText
Write-Host "[OK] ~/.gemini/GEMINI.md" -ForegroundColor Green

$codexText = @(
    '### PixiuCore Startup Rules',
    '',
    'At the start of each session, resolve the core path in this order:',
    '1. Use `PIXIU_CORE` when it exists.',
    '2. Otherwise use `PIXIU_CORE_PATH` when it exists.',
    '3. Otherwise use `%USERPROFILE%\.pixiu-core`.',
    '',
    'Read these files first:',
    '1. `%PIXIU_CORE%\vault\README.md`',
    '2. `%PIXIU_CORE%\user_rules.md`',
    '3. `%PIXIU_CORE%\vault\identity\founder-profile.md`',
    '4. `%PIXIU_CORE%\vault\identity\agent-persona.md`',
    '5. `%PIXIU_CORE%\vault\memory\memory-summary.md`',
    '',
    'If the current project is PCLMS, also read:',
    '- `%PIXIU_CORE%\vault\context\pclms-overview.md`',
    '- `%PIXIU_CORE%\vault\context\tech-stack.md`',
    '',
    'Do not load the whole core folder. Read only the needed rules, skills, memory, and context files.'
) -join "`r`n"
Write-Utf8NoBom -Path (Join-Path $CodexDir 'AGENTS.md') -Text $codexText
Write-Utf8NoBom -Path (Join-Path $CodexDir 'instructions.md') -Text $codexText
Write-Host "[OK] ~/.codex/AGENTS.md" -ForegroundColor Green
Write-Host "[OK] ~/.codex/instructions.md" -ForegroundColor Green

foreach ($name in @('agents', 'commands', 'hooks', 'rules', 'scripts')) {
    Set-Junction -Path (Join-Path $ClaudeDir $name) -Target (Join-Path $StableCorePath $name)
}

$settingsPath = Join-Path $ClaudeDir 'settings.json'
if (Test-Path $settingsPath) {
    try {
        $settings = Get-Content $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json
    } catch {
        $settings = [PSCustomObject]@{}
    }
} else {
    $settings = [PSCustomObject]@{}
}
if (-not $settings.PSObject.Properties['permissions']) {
    $settings | Add-Member -NotePropertyName 'permissions' -NotePropertyValue ([PSCustomObject]@{})
}
$settings.permissions | Add-Member -NotePropertyName 'additionalDirectories' -NotePropertyValue @($StableCorePath) -Force
if ($settings.permissions.PSObject.Properties['allow']) {
    $filtered = @($settings.permissions.allow | Where-Object {
        $_ -notmatch 'C:(\\+|/+)Users(\\+|/+)[^\\/"]+' -and
        $_ -notmatch 'C:(\\+|/+)PixiuCore'
    })
    $settings.permissions.allow = $filtered
}
$settings | Add-Member -NotePropertyName 'effortLevel' -NotePropertyValue 'medium' -Force
Write-Utf8NoBom -Path $settingsPath -Text ($settings | ConvertTo-Json -Depth 20)
Write-Host "[OK] ~/.claude/settings.json" -ForegroundColor Green

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Init complete. Restart terminal and AI tools." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan