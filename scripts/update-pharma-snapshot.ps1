param(
  [string]$OutputPath = "assets/data/pharma_snapshot.json",
  [int]$MaxLookbackYears = 8
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$outFile = Join-Path $repoRoot $OutputPath
$outDir = Split-Path -Parent $outFile

if (-not (Test-Path $outDir)) {
  New-Item -Path $outDir -ItemType Directory -Force | Out-Null
}

$areas = @(
  @{ key = 'oncology'; label = 'Oncology'; prefixes = @('L01', 'L02') },
  @{ key = 'cardio'; label = 'Cardiovascular'; prefixes = @('C') },
  @{ key = 'diabetes'; label = 'Diabetes'; prefixes = @('A10') },
  @{ key = 'rare'; label = 'Rare Diseases'; prefixes = @('A16') },
  @{ key = 'neuro'; label = 'Neurology'; prefixes = @('N') }
)

function Get-TokenForYear {
  param([int]$Year)
  $fileName = "${Year}_atc_code_data.txt"
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($fileName)
  [Convert]::ToBase64String($bytes)
}

function Test-PrefixMatch {
  param(
    [string]$Code,
    [string]$Prefix
  )

  if ([string]::IsNullOrWhiteSpace($Code) -or [string]::IsNullOrWhiteSpace($Prefix)) {
    return $false
  }

  if (-not $Code.StartsWith($Prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $false
  }

  if ($Prefix.Length -eq 1) {
    return $Code.Length -eq 1
  }

  return $Code.Length -eq $Prefix.Length
}

function Get-MeasureFromFields {
  param([string[]]$Fields)

  $max = 0.0
  for ($i = 2; $i -lt $Fields.Length; $i++) {
    $raw = $Fields[$i]
    if ([string]::IsNullOrWhiteSpace($raw)) {
      continue
    }

    $normalized = $raw.Replace(',', '.')
    $value = 0.0
    if ([double]::TryParse($normalized, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$value)) {
      if ($value -gt $max) {
        $max = $value
      }
    }
  }

  return $max
}

function Download-YearFile {
  param(
    [int]$Year,
    [string]$TargetPath
  )

  $token = Get-TokenForYear -Year $Year
  $url = "https://www.medstat.dk/da/download/file/$token"

  & curl.exe -sSL `
    -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" `
    -H "Accept: text/plain,*/*" `
    -H "Accept-Language: en-US,en;q=0.9" `
    -H "Referer: https://www.medstat.dk/" `
    $url `
    -o $TargetPath

  if ($LASTEXITCODE -ne 0) {
    throw "curl failed for year $Year"
  }

  if (-not (Test-Path $TargetPath)) {
    throw "Download file missing for year $Year"
  }

  $file = Get-Item $TargetPath
  if ($file.Length -lt 1024) {
    throw "Downloaded file is unexpectedly small for year $Year"
  }
}

function Parse-YearSums {
  param(
    [int]$Year,
    [string]$Path
  )

  $sums = @{}
  foreach ($area in $areas) {
    $sums[$area.key] = 0.0
  }

  foreach ($line in (Get-Content -Path $Path)) {
    if ([string]::IsNullOrWhiteSpace($line) -or $line.IndexOf(';') -lt 0) {
      continue
    }

    $parts = $line.Split(';')
    if ($parts.Length -lt 4) {
      continue
    }

    $code = ($parts[0]).Trim().ToUpperInvariant()
    $lineYear = 0
    if (-not [int]::TryParse($parts[1], [ref]$lineYear)) {
      continue
    }

    if ($lineYear -ne $Year -or [string]::IsNullOrWhiteSpace($code)) {
      continue
    }

    $measure = Get-MeasureFromFields -Fields $parts
    if ($measure -le 0) {
      continue
    }

    foreach ($area in $areas) {
      $hit = $false
      foreach ($prefix in $area.prefixes) {
        if (Test-PrefixMatch -Code $code -Prefix $prefix) {
          $hit = $true
          break
        }
      }
      if ($hit) {
        $sums[$area.key] += $measure
      }
    }
  }

  $allZero = $true
  foreach ($area in $areas) {
    if ($sums[$area.key] -gt 0) {
      $allZero = $false
      break
    }
  }

  if ($allZero) {
    throw "Parsed year $Year but got only zero values"
  }

  return $sums
}

$tmpDir = Join-Path $env:TEMP ("medstat-snapshot-" + [Guid]::NewGuid().ToString('N'))
New-Item -Path $tmpDir -ItemType Directory -Force | Out-Null

try {
  $currentYear = (Get-Date).Year
  $collected = @{}

  for ($offset = 0; $offset -le $MaxLookbackYears; $offset++) {
    if ($collected.Count -ge 3) {
      break
    }

    $year = $currentYear - $offset
    $target = Join-Path $tmpDir ("$year.txt")

    try {
      Download-YearFile -Year $year -TargetPath $target
      $sums = Parse-YearSums -Year $year -Path $target
      $collected[$year] = $sums
      Write-Host "Loaded Medstat year $year"
    } catch {
      Write-Host "Skipping year ${year}: $($_.Exception.Message)"
    }
  }

  if ($collected.Count -lt 3) {
    throw "Could not collect three Medstat years. Found $($collected.Count)."
  }

  $years = @($collected.Keys | Sort-Object)
  $latestYear = $years[-1]
  $previousYear = $years[-2]
  $olderYear = $years[-3]

  $statusLabels = @{
    recruiting = [string]$latestYear
    active = [string]$previousYear
    completed = [string]$olderYear
  }

  $areasOut = @()
  $statusOut = @{}

  foreach ($area in $areas) {
    $latestValue = [math]::Round($collected[$latestYear][$area.key])
    $previousValue = [math]::Round($collected[$previousYear][$area.key])
    $olderValue = [math]::Round($collected[$olderYear][$area.key])

    $areasOut += [ordered]@{
      key = $area.key
      label = $area.label
      value = [int]$latestValue
    }

    $statusOut[$area.key] = [ordered]@{
      recruiting = [ordered]@{ count = [int]$latestValue }
      active = [ordered]@{ count = [int]$previousValue }
      completed = [ordered]@{ count = [int]$olderValue }
    }
  }

  $snapshot = [ordered]@{
    meta = [ordered]@{
      name = 'CPDSE pharma snapshot'
      updated = (Get-Date).ToString('yyyy-MM-dd')
      source = 'Medstat.dk curated Danish fallback for About visualization'
      years = @([int]$olderYear, [int]$previousYear, [int]$latestYear)
      status_labels = $statusLabels
    }
    areas = $areasOut
    status = $statusOut
  }

  $json = $snapshot | ConvertTo-Json -Depth 8
  Set-Content -Path $outFile -Value $json -Encoding utf8

  Write-Host "Snapshot written to $OutputPath"
  Write-Host "Years used: $olderYear, $previousYear, $latestYear"
}
finally {
  if (Test-Path $tmpDir) {
    Remove-Item -Path $tmpDir -Recurse -Force
  }
}
