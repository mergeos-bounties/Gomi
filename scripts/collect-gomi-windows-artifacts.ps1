param(
  [Parameter(Mandatory = $true)]
  [string]$CodeOssRoot,

  [string]$ReleaseDir = 'release',

  [ValidateSet('win32-x64', 'win32-arm64', 'win32-ia32')]
  [string]$Platform = 'win32-x64',

  [string]$CodeOssRepository = $env:GOMI_CODE_OSS_REPOSITORY,
  [string]$CodeOssRef = $env:GOMI_CODE_OSS_REF,
  [string]$CommitSha = $env:GITHUB_SHA,
  [string]$RefName = $env:GITHUB_REF_NAME,
  [switch]$SetupRequested
)

$ErrorActionPreference = 'Stop'

function Resolve-RequiredPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathValue,

    [Parameter(Mandatory = $true)]
    [string]$Description
  )

  if (-not (Test-Path -LiteralPath $PathValue)) {
    throw "$Description was not found: $PathValue"
  }

  return (Resolve-Path -LiteralPath $PathValue).Path
}

function Assert-GomiProductJson {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProductJsonPath
  )

  $productJsonText = Get-Content -LiteralPath $ProductJsonPath -Raw
  $product = $productJsonText | ConvertFrom-Json
  $checks = @{
    nameShort = 'Gomi'
    nameLong = 'Gomi IDE'
    applicationName = 'gomi-ide'
    dataFolderName = '.gomi-ide'
    win32NameVersion = 'Gomi IDE'
  }

  foreach ($entry in $checks.GetEnumerator()) {
    $actualProperty = $product.PSObject.Properties[$entry.Key]
    $actual = if ($actualProperty) { $actualProperty.Value } else { $null }

    if ($actual -ne $entry.Value) {
      throw "Refusing to collect Windows artifacts because product.json has $($entry.Key)='$actual', expected '$($entry.Value)'."
    }
  }

  $galleryUrl = $null
  $galleryProperty = $product.PSObject.Properties['extensionsGallery']

  if ($galleryProperty -and $galleryProperty.Value) {
    $serviceUrlProperty = $galleryProperty.Value.PSObject.Properties['serviceUrl']
    if ($serviceUrlProperty) {
      $galleryUrl = $serviceUrlProperty.Value
    }
  }

  if ($galleryUrl -and $galleryUrl -notmatch 'open-vsx\.org') {
    throw "Refusing to collect Windows artifacts because extensionsGallery.serviceUrl is not Open VSX: $galleryUrl"
  }

  if ($productJsonText -match 'marketplace\.visualstudio\.com|Visual Studio Marketplace') {
    throw 'Refusing to collect Windows artifacts because product.json still references the Microsoft Visual Studio Marketplace.'
  }
}

function Get-ReleaseRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathValue
  )

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    New-Item -ItemType Directory -Force -Path $PathValue | Out-Null
    return (Resolve-Path -LiteralPath $PathValue).Path
  }

  $resolved = Join-Path (Get-Location).Path $PathValue
  New-Item -ItemType Directory -Force -Path $resolved | Out-Null
  return (Resolve-Path -LiteralPath $resolved).Path
}

function Get-GomiSha256 {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathValue
  )

  $getFileHashCommand = Get-Command Get-FileHash -ErrorAction SilentlyContinue

  if ($getFileHashCommand) {
    return (Get-FileHash -LiteralPath $PathValue -Algorithm SHA256).Hash.ToLowerInvariant()
  }

  $stream = [System.IO.File]::OpenRead($PathValue)

  try {
    $sha256 = [System.Security.Cryptography.SHA256]::Create()

    try {
      $hashBytes = $sha256.ComputeHash($stream)
      return (($hashBytes | ForEach-Object { $_.ToString('x2') }) -join '')
    } finally {
      $sha256.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
}

$codeRoot = Resolve-RequiredPath -PathValue $CodeOssRoot -Description 'Code - OSS root'
$productJsonPath = Resolve-RequiredPath -PathValue (Join-Path $codeRoot 'product.json') -Description 'Code - OSS product.json'
$buildRoot = Resolve-RequiredPath -PathValue (Join-Path $codeRoot '.build') -Description 'Code - OSS .build output'
$releaseRoot = Get-ReleaseRoot -PathValue $ReleaseDir

Assert-GomiProductJson -ProductJsonPath $productJsonPath

$artifactFiles = Get-ChildItem -Path $buildRoot -Recurse -File -Include *.exe, *.msi, *.zip -ErrorAction SilentlyContinue

if (-not $artifactFiles) {
  $archiveRoot = Join-Path $buildRoot $Platform

  if (-not (Test-Path -LiteralPath $archiveRoot)) {
    throw "No Code - OSS Windows artifacts were found under $buildRoot."
  }

  $archiveName = "gomi-ide-$Platform.zip"
  $archivePath = Join-Path $releaseRoot $archiveName
  Compress-Archive -Path "$archiveRoot\*" -DestinationPath $archivePath -Force
  $artifactFiles = @(Get-Item -LiteralPath $archivePath)
} else {
  foreach ($file in $artifactFiles) {
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $releaseRoot $file.Name) -Force
  }
}

$releaseFiles = Get-ChildItem -Path $releaseRoot -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notin @('ARTIFACTS.md', 'WINDOWS-SHA256SUMS.txt') }

if (-not $releaseFiles) {
  throw 'The Windows packaging job completed without producing release files.'
}

$manifest = @(
  '# Gomi IDE Windows Artifacts',
  '',
  "Commit: $CommitSha",
  "Ref: $RefName",
  "Code - OSS source: $CodeOssRepository@$CodeOssRef",
  "Platform: $Platform",
  "Setup installer requested: $($SetupRequested.IsPresent)",
  '',
  'Product identity verified from Code - OSS product.json:',
  '- nameLong: Gomi IDE',
  '- applicationName: gomi-ide',
  '- dataFolderName: .gomi-ide',
  '- extension gallery: Open VSX',
  '',
  'Files:'
)

foreach ($file in $releaseFiles | Sort-Object Name) {
  $manifest += "- $($file.Name) ($([Math]::Round($file.Length / 1MB, 2)) MB)"
}

$manifest | Set-Content -Path (Join-Path $releaseRoot 'ARTIFACTS.md') -Encoding UTF8

$checksumLines = foreach ($file in ($releaseFiles | Sort-Object Name)) {
  $hash = Get-GomiSha256 -PathValue $file.FullName
  "$hash  $($file.Name)"
}

$checksumLines | Set-Content -Path (Join-Path $releaseRoot 'WINDOWS-SHA256SUMS.txt') -Encoding UTF8

Write-Host "Collected $($releaseFiles.Count) Gomi Windows artifact(s) into $releaseRoot." -ForegroundColor Green
