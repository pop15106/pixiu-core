param(
  [string]$VaultPath = '',
  [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
$MotherProject = "$([char]0x6BCD)$([char]0x9AD4)"

$root = Split-Path -Parent $PSScriptRoot

function Resolve-DefaultVaultPath {
  $core = $env:PIXIU_CORE
  if (-not $core) {
    $core = $env:PIXIU_CORE_PATH
  }
  if (-not $core) {
    $core = Join-Path $env:USERPROFILE '.pixiu-core'
  }

  return Join-Path $core 'vault'
}

function ConvertTo-PlainFrontmatterValue {
  param([string]$Value)

  if ($null -eq $Value) {
    return ''
  }

  $clean = $Value.Trim()
  if (($clean.StartsWith('"') -and $clean.EndsWith('"')) -or ($clean.StartsWith("'") -and $clean.EndsWith("'"))) {
    $clean = $clean.Substring(1, $clean.Length - 2)
  }

  return $clean.Trim()
}

function Read-SimpleFrontmatter {
  param([Parameter(Mandatory = $true)][string]$Path)

  $metadata = @{}
  $lines = [System.IO.File]::ReadAllLines($Path, [System.Text.Encoding]::UTF8)
  if ($lines.Count -lt 3 -or $lines[0].Trim() -ne '---') {
    return $metadata
  }

  for ($i = 1; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line.Trim() -eq '---') {
      break
    }
    if ($line -notmatch '^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$') {
      continue
    }

    $metadata[$Matches[1]] = ConvertTo-PlainFrontmatterValue -Value $Matches[2]
  }

  return $metadata
}

function Get-FrontmatterValue {
  param(
    [Parameter(Mandatory = $true)][hashtable]$Metadata,
    [Parameter(Mandatory = $true)][string]$Name
  )

  if ($Metadata.ContainsKey($Name)) {
    return [string]$Metadata[$Name]
  }

  return ''
}

function Get-RecapProjectFromName {
  param([Parameter(Mandatory = $true)][string]$FileNameWithoutExtension)

  $name = $FileNameWithoutExtension
  $name = $name -replace '^\d{4}-\d{2}-\d{2}-\d{6}-', ''
  $name = $name -replace '^\d{4}-\d{2}-\d{2}-', ''
  $name = $name -replace '^\d{4}-\d{2}-', ''
  $lower = $name.ToLowerInvariant()

  $escapedMotherProject = [regex]::Escape($MotherProject)
  if ($name -match "^$escapedMotherProject" -or $lower -match 'pixiu|pixiucore|agent-team|recap|dashboard|vault|skill') {
    return $MotherProject
  }

  $knownProjects = @(
    'PCLMS_AP',
    'PCLMS_BK',
    'PCLMS_FD',
    'SECOND_BRAIN',
    'AUTO_RESEARCH',
    'DOCX_TOOLING',
    'OPENSPEC',
    'PCLMS',
    'PEPIS',
    'PERMS',
    'PISSO',
    'PPOST',
    'PTWCS'
  )
  foreach ($project in $knownProjects) {
    if ($lower.StartsWith($project.ToLowerInvariant())) {
      return $project
    }
  }

  return ''
}

function Get-RecapMetadata {
  param(
    [Parameter(Mandatory = $true)][string]$RelativePath,
    [Parameter(Mandatory = $true)][string]$FileNameWithoutExtension,
    [Parameter(Mandatory = $true)][hashtable]$Frontmatter
  )

  $recapProject = ''
  $recapMonth = ''
  $frontmatterDate = Get-FrontmatterValue -Metadata $Frontmatter -Name 'date'
  $frontmatterProject = Get-FrontmatterValue -Metadata $Frontmatter -Name 'project'

  if ($RelativePath -notmatch '^memory/recaps/') {
    return [pscustomobject]@{
      recap_project = ''
      recap_month = ''
    }
  }

  if ($RelativePath -match '^memory/recaps/([^/]+)/(\d{4}-\d{2})/') {
    $recapProject = $Matches[1]
    $recapMonth = $Matches[2]
  } elseif ($RelativePath -match '^memory/recaps/(\d{4}-\d{2})/') {
    $recapMonth = $Matches[1]
  } elseif ($RelativePath -match '^memory/recaps/') {
    if ($FileNameWithoutExtension -match '^(\d{4}-\d{2})') {
      $recapMonth = $Matches[1]
    }
  }

  if (-not $recapMonth -and $frontmatterDate -match '^(\d{4}-\d{2})') {
    $recapMonth = $Matches[1]
  }

  if (-not $recapProject) {
    if ($frontmatterProject -eq 'PIXIUCORE') {
      $recapProject = $MotherProject
    } elseif ($frontmatterProject) {
      $recapProject = $frontmatterProject
    } else {
      $recapProject = Get-RecapProjectFromName -FileNameWithoutExtension $FileNameWithoutExtension
    }
  }

  return [pscustomobject]@{
    recap_project = $recapProject
    recap_month = $recapMonth
  }
}

if (-not $VaultPath) {
  $VaultPath = Resolve-DefaultVaultPath
}

if (-not (Test-Path -LiteralPath $VaultPath)) {
  throw "Pixiu vault not found: $VaultPath"
}

if (-not $OutputPath) {
  $OutputPath = Join-Path $root 'data\files\indexing-queue\pixiu-vault-manifest.jsonl'
}

$vaultFull = (Resolve-Path -LiteralPath $VaultPath).Path.TrimEnd('\', '/')
$outputFull = Join-Path (Split-Path -Parent $OutputPath) (Split-Path -Leaf $OutputPath)
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $outputFull) | Out-Null

$lines = New-Object System.Collections.Generic.List[string]
$files = Get-ChildItem -LiteralPath $vaultFull -Recurse -Filter *.md -File | Sort-Object FullName

foreach ($file in $files) {
  $relativePath = $file.FullName.Substring($vaultFull.Length).TrimStart('\', '/')
  $relativePathNormalized = $relativePath.Replace('\', '/')
  $containerPath = "/pixiu-vault/$relativePathNormalized"
  $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
  $frontmatter = Read-SimpleFrontmatter -Path $file.FullName
  $recapMetadata = Get-RecapMetadata -RelativePath $relativePathNormalized -FileNameWithoutExtension ([System.IO.Path]::GetFileNameWithoutExtension($file.Name)) -Frontmatter $frontmatter

  $title = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
  foreach ($line in [System.IO.File]::ReadLines($file.FullName, [System.Text.Encoding]::UTF8)) {
    if ($line -match '^#\s+(.+)$') {
      $title = $Matches[1].Trim()
      break
    }
  }

  $record = [ordered]@{
    source_type = 'pixiu-vault'
    source_path_host = $file.FullName
    source_path_container = $containerPath
    relative_path = $relativePathNormalized
    title = $title
    size_bytes = $file.Length
    updated_at = $file.LastWriteTime.ToString('o')
    content_hash = $hash
    vault_type = (Get-FrontmatterValue -Metadata $frontmatter -Name 'type')
    frontmatter_date = (Get-FrontmatterValue -Metadata $frontmatter -Name 'date')
    frontmatter_project = (Get-FrontmatterValue -Metadata $frontmatter -Name 'project')
    frontmatter_system = (Get-FrontmatterValue -Metadata $frontmatter -Name 'system')
    frontmatter_repo = (Get-FrontmatterValue -Metadata $frontmatter -Name 'repo')
    frontmatter_topic = (Get-FrontmatterValue -Metadata $frontmatter -Name 'topic')
    frontmatter_status = (Get-FrontmatterValue -Metadata $frontmatter -Name 'status')
    frontmatter_summary = (Get-FrontmatterValue -Metadata $frontmatter -Name 'summary')
    recap_mode = (Get-FrontmatterValue -Metadata $frontmatter -Name 'recap_mode')
    auto_trigger = (Get-FrontmatterValue -Metadata $frontmatter -Name 'auto_trigger')
    auto_transcript_hash = (Get-FrontmatterValue -Metadata $frontmatter -Name 'auto_transcript_hash')
    recap_project = $recapMetadata.recap_project
    recap_month = $recapMetadata.recap_month
  }

  $lines.Add(($record | ConvertTo-Json -Compress -Depth 8))
}

[System.IO.File]::WriteAllLines($outputFull, $lines, [System.Text.Encoding]::UTF8)
Write-Host "Exported Pixiu vault manifest: $outputFull"
Write-Host "Markdown files: $($files.Count)"
