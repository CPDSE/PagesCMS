param(
  [string]$OutputPath = "assets/data/events-calendar.ics"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$calendarUrl = 'https://calendar.proton.me/api/calendar/v1/url/UpzCDxijJRWVQEDhaTiwMK81XtRUgwWRbcO_61QH_EZfTDW0Czg9lAzUKPVCpUitrXqtW5jo1B8RjivsvSpFxw==/calendar.ics?CacheKey=21o3DCCs8xsxJIWKZFilPg%3D%3D&PassphraseKey=hCzoAx4RH4SFgEZD0jk9mWPlYvKHGXWdBcIg9M_oX44%3D'

$repoRoot = Split-Path -Parent $PSScriptRoot
$outputFile = Join-Path $repoRoot $OutputPath
$outputDir = Split-Path -Parent $outputFile

if (-not (Test-Path $outputDir)) {
  New-Item -Path $outputDir -ItemType Directory -Force | Out-Null
}

$tempDir = [System.IO.Path]::GetTempPath()
if ([string]::IsNullOrWhiteSpace($tempDir)) {
  throw 'Could not determine a temporary directory on this runner.'
}

$tempFile = Join-Path $tempDir ("events-calendar-" + [Guid]::NewGuid().ToString('N') + '.ics')

try {
  Invoke-WebRequest -Uri $calendarUrl -OutFile $tempFile -UseBasicParsing

  if (-not (Test-Path $tempFile)) {
    throw 'Calendar download did not create a file.'
  }

  $downloaded = Get-Item $tempFile
  if ($downloaded.Length -lt 512) {
    throw 'Calendar download is unexpectedly small.'
  }

  Move-Item -Path $tempFile -Destination $outputFile -Force
  $saved = Get-Item $outputFile
  Write-Host "Updated calendar mirror: $($saved.FullName) ($($saved.Length) bytes)"
}
finally {
  if (Test-Path $tempFile) {
    Remove-Item $tempFile -Force
  }
}