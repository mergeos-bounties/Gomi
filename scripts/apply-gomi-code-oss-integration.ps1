param(
  [Parameter(Mandatory = $true)]
  [string]$CodeOssRoot,

  [string]$ManifestPath,
  [switch]$ValidateOnly,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Resolve-GomiPath {
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

function Copy-GomiIntegrationItem {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [Parameter(Mandatory = $true)]
    [string]$Destination
  )

  Write-Host "Copy $Source -> $Destination" -ForegroundColor DarkCyan

  if ($ValidateOnly -or $DryRun) {
    return
  }

  $parent = Split-Path -Parent $Destination
  New-Item -ItemType Directory -Force -Path $parent | Out-Null

  if ((Get-Item -LiteralPath $Source).PSIsContainer -and (Test-Path -LiteralPath $Destination)) {
    Remove-Item -LiteralPath $Destination -Recurse -Force
  }

  Copy-Item -LiteralPath $Source -Destination $Destination -Force -Recurse
}

function Add-GomiWorkbenchImport {
  param(
    [Parameter(Mandatory = $true)]
    [string]$TargetFile,

    [Parameter(Mandatory = $true)]
    [string]$ImportLine
  )

  Resolve-GomiPath -PathValue $TargetFile -Description 'Code - OSS workbench entrypoint' | Out-Null

  $content = Get-Content -LiteralPath $TargetFile -Raw

  if ($content.Contains($ImportLine)) {
    Write-Host "Import already present in $TargetFile" -ForegroundColor DarkCyan
    return
  }

  Write-Host "Patch $TargetFile with: $ImportLine" -ForegroundColor DarkCyan

  if ($ValidateOnly -or $DryRun) {
    return
  }

  $nextContent = if ($content.EndsWith("`n")) {
    "$content$ImportLine`n"
  } else {
    "$content`n$ImportLine`n"
  }

  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  [System.IO.File]::WriteAllText($TargetFile, $nextContent, $utf8NoBom)
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$codeRoot = Resolve-GomiPath -PathValue $CodeOssRoot -Description 'Code - OSS root'
$manifestFile = if ($ManifestPath) {
  Resolve-GomiPath -PathValue $ManifestPath -Description 'Gomi integration manifest'
} else {
  Resolve-GomiPath -PathValue (Join-Path $repoRoot 'build/gomi-code-oss.integration.json') -Description 'Gomi integration manifest'
}

$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json

Resolve-GomiPath -PathValue (Join-Path $codeRoot 'package.json') -Description 'Code - OSS package.json' | Out-Null
Resolve-GomiPath -PathValue (Join-Path $codeRoot 'product.json') -Description 'Code - OSS product.json' | Out-Null
Resolve-GomiPath -PathValue (Join-Path $codeRoot 'src/vs/workbench') -Description 'Code - OSS workbench source' | Out-Null

Write-Host "Applying Gomi Code - OSS integration manifest: $manifestFile" -ForegroundColor Green
Write-Host "Code - OSS root: $codeRoot" -ForegroundColor Green
Write-Host "Validate only: $($ValidateOnly.IsPresent)" -ForegroundColor Green
Write-Host "Dry run: $($DryRun.IsPresent)" -ForegroundColor Green

$productSource = Resolve-GomiPath -PathValue (Join-Path $repoRoot $manifest.productJson.source) -Description 'Gomi product.json'
$productTarget = Join-Path $codeRoot $manifest.productJson.target
Copy-GomiIntegrationItem -Source $productSource -Destination $productTarget

foreach ($copy in $manifest.moduleCopies) {
  $source = Resolve-GomiPath -PathValue (Join-Path $repoRoot $copy.source) -Description 'Gomi module source'
  $target = Join-Path $codeRoot $copy.target
  Copy-GomiIntegrationItem -Source $source -Destination $target
}

foreach ($copy in $manifest.templateCopies) {
  $source = Resolve-GomiPath -PathValue (Join-Path $repoRoot $copy.source) -Description 'Gomi Code - OSS template source'
  $target = Join-Path $codeRoot $copy.target
  Copy-GomiIntegrationItem -Source $source -Destination $target
}

foreach ($copy in $manifest.webviewAssetCopies) {
  $sourcePath = Join-Path $repoRoot $copy.source
  $target = Join-Path $codeRoot $copy.target

  if (-not (Test-Path -LiteralPath $sourcePath)) {
    $message = "Generated Gomi Office webview assets were not found: $sourcePath. Run npm run build:webview before applying to a Code - OSS fork."

    if ($ValidateOnly -or $DryRun) {
      Write-Host $message -ForegroundColor Yellow
      Write-Host "Copy $sourcePath -> $target" -ForegroundColor DarkCyan
      continue
    }

    throw $message
  }

  $source = (Resolve-Path -LiteralPath $sourcePath).Path
  Copy-GomiIntegrationItem -Source $source -Destination $target
}

foreach ($copy in $manifest.resourceCopies) {
  $source = Resolve-GomiPath -PathValue (Join-Path $repoRoot $copy.source) -Description 'Gomi resource source'
  $target = Join-Path $codeRoot $copy.target
  Copy-GomiIntegrationItem -Source $source -Destination $target
}

foreach ($workbenchImport in $manifest.workbenchImports) {
  $target = Join-Path $codeRoot $workbenchImport.target
  Add-GomiWorkbenchImport -TargetFile $target -ImportLine $workbenchImport.import
}

Write-Host 'Gomi Code - OSS integration manifest completed.' -ForegroundColor Green
