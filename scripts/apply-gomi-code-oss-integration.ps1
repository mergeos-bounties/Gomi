param(
  [Parameter(Mandatory = $true)]
  [string]$CodeOssRoot,

  [string]$ManifestPath,
  [switch]$ValidateOnly,
  [switch]$DryRun,
  [string]$ReportPath
)

$ErrorActionPreference = 'Stop'

$script:GomiIntegrationReportActions = @()
$script:GomiIntegrationRollbackActions = @()

function Test-GomiPathIsUnderRoot {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathValue,

    [Parameter(Mandatory = $true)]
    [string]$RootPath
  )

  $comparison = if ([System.Environment]::OSVersion.Platform -eq [System.PlatformID]::Win32NT) {
    [System.StringComparison]::OrdinalIgnoreCase
  } else {
    [System.StringComparison]::Ordinal
  }
  $fullPath = [System.IO.Path]::GetFullPath($PathValue)
  $fullRoot = [System.IO.Path]::GetFullPath($RootPath)
  $rootPrefix = if ($fullRoot.EndsWith([System.IO.Path]::DirectorySeparatorChar)) {
    $fullRoot
  } else {
    "$fullRoot$([System.IO.Path]::DirectorySeparatorChar)"
  }

  return $fullPath.Equals($fullRoot, $comparison) -or $fullPath.StartsWith($rootPrefix, $comparison)
}

function Resolve-GomiReportPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathValue,

    [Parameter(Mandatory = $true)]
    [string]$CodeRoot
  )

  $resolvedPath = if ([System.IO.Path]::IsPathRooted($PathValue)) {
    [System.IO.Path]::GetFullPath($PathValue)
  } else {
    [System.IO.Path]::GetFullPath((Join-Path (Get-Location).Path $PathValue))
  }

  if ($DryRun -and (Test-GomiPathIsUnderRoot -PathValue $resolvedPath -RootPath $CodeRoot)) {
    throw "Dry-run report path must be outside the Code - OSS checkout so dry-run leaves the target tree unchanged: $resolvedPath"
  }

  return $resolvedPath
}

function Add-GomiIntegrationReportAction {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Kind,

    [string]$Source,
    [string]$Destination,
    [string]$Message,
    [hashtable]$Data = @{}
  )

  $entry = [ordered]@{
    kind = $Kind
    source = $Source
    destination = $Destination
    message = $Message
  }

  foreach ($key in $Data.Keys) {
    $entry[$key] = $Data[$key]
  }

  $script:GomiIntegrationReportActions += [pscustomobject]$entry
}

function Add-GomiIntegrationRollbackAction {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Kind,

    [string]$Target,
    [string]$Message,
    [hashtable]$Data = @{}
  )

  $entry = [ordered]@{
    kind = $Kind
    target = $Target
    message = $Message
  }

  foreach ($key in $Data.Keys) {
    $entry[$key] = $Data[$key]
  }

  $script:GomiIntegrationRollbackActions += [pscustomobject]$entry
}

function Write-GomiIntegrationReport {
  param(
    [string]$PathValue,

    [Parameter(Mandatory = $true)]
    [string]$RepoRoot,

    [Parameter(Mandatory = $true)]
    [string]$CodeRoot,

    [Parameter(Mandatory = $true)]
    [string]$ManifestFile
  )

  $report = [ordered]@{
    schemaVersion = 1
    generatedAt = (Get-Date).ToUniversalTime().ToString('o')
    repoRoot = $RepoRoot
    codeOssRoot = $CodeRoot
    manifestPath = $ManifestFile
    validateOnly = [bool]$ValidateOnly
    dryRun = [bool]$DryRun
    actions = @($script:GomiIntegrationReportActions)
    rollbackActions = @($script:GomiIntegrationRollbackActions)
  }

  if (-not $PathValue) {
    Write-Host "Integration report summary: $($script:GomiIntegrationReportActions.Count) actions, $($script:GomiIntegrationRollbackActions.Count) rollback steps." -ForegroundColor Green
    return
  }

  $reportParent = Split-Path -Parent $PathValue

  if ($reportParent) {
    New-Item -ItemType Directory -Force -Path $reportParent | Out-Null
  }

  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  $reportJson = $report | ConvertTo-Json -Depth 32
  [System.IO.File]::WriteAllText($PathValue, "$reportJson`n", $utf8NoBom)
  Write-Host "Integration report written: $PathValue" -ForegroundColor Green
}

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
  $destinationExists = Test-Path -LiteralPath $Destination
  Add-GomiIntegrationReportAction -Kind 'copy' -Source $Source -Destination $Destination -Message 'Copy integration file or directory into the Code - OSS checkout.'

  if ($destinationExists) {
    Add-GomiIntegrationRollbackAction -Kind 'restore-path' -Target $Destination -Message 'Restore the previous destination contents from source control or a pre-apply backup.'
  } else {
    Add-GomiIntegrationRollbackAction -Kind 'remove-path' -Target $Destination -Message 'Remove the copied destination path.'
  }

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

function Merge-GomiJsonObject {
  param(
    [Parameter(Mandatory = $true)]
    [pscustomobject]$Base,

    [Parameter(Mandatory = $true)]
    [pscustomobject]$Overlay
  )

  foreach ($property in $Overlay.PSObject.Properties) {
    $baseProperty = $Base.PSObject.Properties[$property.Name]

    if (
      $baseProperty -and
      $baseProperty.Value -is [pscustomobject] -and
      $property.Value -is [pscustomobject]
    ) {
      Merge-GomiJsonObject -Base $baseProperty.Value -Overlay $property.Value
      continue
    }

    if ($baseProperty) {
      $baseProperty.Value = $property.Value
    } else {
      $Base | Add-Member -MemberType NoteProperty -Name $property.Name -Value $property.Value
    }
  }
}

function Set-GomiProductJson {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,

    [Parameter(Mandatory = $true)]
    [string]$Destination,

    [string]$Mode = 'copy',

    [string[]]$RemoveKeys = @()
  )

  if ($Mode -eq 'merge') {
    Write-Host "Merge product metadata $Source -> $Destination" -ForegroundColor DarkCyan
  } else {
    Copy-GomiIntegrationItem -Source $Source -Destination $Destination
    return
  }

  Add-GomiIntegrationReportAction -Kind 'merge-product-json' -Source $Source -Destination $Destination -Message 'Merge Gomi product metadata into Code - OSS product.json.' -Data @{
    removeKeys = @($RemoveKeys)
  }
  Add-GomiIntegrationRollbackAction -Kind 'restore-file' -Target $Destination -Message 'Restore product.json from source control or the pre-apply backup created by the caller.'

  if ($ValidateOnly -or $DryRun) {
    return
  }

  $baseProduct = Get-Content -LiteralPath $Destination -Raw | ConvertFrom-Json
  $overlayProduct = Get-Content -LiteralPath $Source -Raw | ConvertFrom-Json

  Merge-GomiJsonObject -Base $baseProduct -Overlay $overlayProduct

  foreach ($key in $RemoveKeys) {
    $property = $baseProduct.PSObject.Properties[$key]

    if ($property) {
      Write-Host "Remove upstream product metadata key: $key" -ForegroundColor DarkCyan
      $baseProduct.PSObject.Properties.Remove($key)
    }
  }

  $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
  $productJson = $baseProduct | ConvertTo-Json -Depth 64
  [System.IO.File]::WriteAllText($Destination, "$productJson`n", $utf8NoBom)
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
    Add-GomiIntegrationReportAction -Kind 'ensure-workbench-import' -Destination $TargetFile -Message 'Workbench import already exists.' -Data @{
      import = $ImportLine
      changed = $false
    }
    return
  }

  Write-Host "Patch $TargetFile with: $ImportLine" -ForegroundColor DarkCyan
  Add-GomiIntegrationReportAction -Kind 'append-workbench-import' -Destination $TargetFile -Message 'Append the native Gomi workbench contribution import.' -Data @{
    import = $ImportLine
  }
  Add-GomiIntegrationRollbackAction -Kind 'remove-workbench-import' -Target $TargetFile -Message 'Remove the appended Gomi workbench contribution import line.' -Data @{
    import = $ImportLine
  }

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
$resolvedReportPath = if ($ReportPath) {
  Resolve-GomiReportPath -PathValue $ReportPath -CodeRoot $codeRoot
} else {
  $null
}

$manifest = Get-Content -LiteralPath $manifestFile -Raw | ConvertFrom-Json

Resolve-GomiPath -PathValue (Join-Path $codeRoot 'package.json') -Description 'Code - OSS package.json' | Out-Null
Resolve-GomiPath -PathValue (Join-Path $codeRoot 'product.json') -Description 'Code - OSS product.json' | Out-Null
Resolve-GomiPath -PathValue (Join-Path $codeRoot 'src/vs/workbench') -Description 'Code - OSS workbench source' | Out-Null

Write-Host "Applying Gomi Code - OSS integration manifest: $manifestFile" -ForegroundColor Green
Write-Host "Code - OSS root: $codeRoot" -ForegroundColor Green
Write-Host "Validate only: $($ValidateOnly.IsPresent)" -ForegroundColor Green
Write-Host "Dry run: $($DryRun.IsPresent)" -ForegroundColor Green
if ($resolvedReportPath) {
  Write-Host "Report path: $resolvedReportPath" -ForegroundColor Green
}

$productSource = Resolve-GomiPath -PathValue (Join-Path $repoRoot $manifest.productJson.source) -Description 'Gomi product.json'
$productTarget = Join-Path $codeRoot $manifest.productJson.target
$productRemoveKeys = @()

if ($manifest.productJson.PSObject.Properties['removeKeys']) {
  $productRemoveKeys = @($manifest.productJson.removeKeys)
}

Set-GomiProductJson -Source $productSource -Destination $productTarget -Mode $manifest.productJson.mode -RemoveKeys $productRemoveKeys

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
      Add-GomiIntegrationReportAction -Kind 'copy' -Source $sourcePath -Destination $target -Message $message -Data @{
        sourceMissing = $true
      }
      Add-GomiIntegrationRollbackAction -Kind 'remove-path' -Target $target -Message 'Remove generated webview assets if a later non-dry-run apply creates them.'
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

Write-GomiIntegrationReport -PathValue $resolvedReportPath -RepoRoot $repoRoot -CodeRoot $codeRoot -ManifestFile $manifestFile

Write-Host 'Gomi Code - OSS integration manifest completed.' -ForegroundColor Green
