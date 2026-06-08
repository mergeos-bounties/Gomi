param(
  [string]$CodeOssRoot,

  [string]$Repository = 'https://github.com/microsoft/vscode.git',

  [string]$Ref = 'main',

  [switch]$SkipCheckout,
  [switch]$SkipBrandAssets,
  [switch]$SkipWebviewBundle,
  [switch]$ValidateOnly,
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

function Resolve-GomiRepoPath {
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

function Invoke-GomiBootstrapCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string]$FilePath,

    [Parameter(Mandatory = $true)]
    [string[]]$ArgumentList,

    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory
  )

  Write-Host ">> $FilePath $($ArgumentList -join ' ')" -ForegroundColor Cyan

  if ($DryRun) {
    return
  }

  Push-Location $WorkingDirectory
  try {
    & $FilePath @ArgumentList

    if ($LASTEXITCODE -ne 0) {
      throw "Command failed with exit code ${LASTEXITCODE}: $FilePath $($ArgumentList -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Test-GitWorktreeClean {
  param(
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory
  )

  $status = & git -C $WorkingDirectory status --porcelain

  if ($LASTEXITCODE -ne 0) {
    throw "Unable to inspect git status in $WorkingDirectory."
  }

  return -not $status
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$defaultCodeOssRoot = Join-Path (Split-Path -Parent $repoRoot) 'gomi-code-oss'
$targetCodeOssRoot = if ($CodeOssRoot) { $CodeOssRoot } else { $defaultCodeOssRoot }

if (-not [System.IO.Path]::IsPathRooted($targetCodeOssRoot)) {
  $targetCodeOssRoot = Join-Path $repoRoot $targetCodeOssRoot
}

$targetCodeOssRoot = [System.IO.Path]::GetFullPath($targetCodeOssRoot)

if ($ValidateOnly -and -not $PSBoundParameters.ContainsKey('SkipCheckout')) {
  $SkipCheckout = $true
}

$targetParent = Split-Path -Parent $targetCodeOssRoot

Write-Host 'Bootstrapping Gomi IDE over a Code - OSS checkout.' -ForegroundColor Green
Write-Host "Gomi repository: $repoRoot" -ForegroundColor Green
Write-Host "Code - OSS target: $targetCodeOssRoot" -ForegroundColor Green
Write-Host "Code - OSS repository: $Repository" -ForegroundColor Green
Write-Host "Code - OSS ref: $Ref" -ForegroundColor Green
Write-Host "Skip checkout: $([bool]$SkipCheckout)" -ForegroundColor Green
Write-Host "Validate only: $([bool]$ValidateOnly)" -ForegroundColor Green
Write-Host "Dry run: $([bool]$DryRun)" -ForegroundColor Green

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  throw 'git is required to clone or update the Code - OSS checkout.'
}

if (-not (Test-Path -LiteralPath $targetCodeOssRoot)) {
  if ($ValidateOnly -and -not $DryRun) {
    throw "ValidateOnly requires an existing Code - OSS checkout: $targetCodeOssRoot"
  }

  if (-not $targetParent) {
    throw "Unable to resolve parent directory for Code - OSS target: $targetCodeOssRoot"
  }

  if (-not $DryRun) {
    New-Item -ItemType Directory -Force -Path $targetParent | Out-Null
  }

  Invoke-GomiBootstrapCommand -FilePath 'git' -ArgumentList @('clone', '--filter=blob:none', $Repository, $targetCodeOssRoot) -WorkingDirectory $targetParent
} else {
  Resolve-GomiRepoPath -PathValue (Join-Path $targetCodeOssRoot '.git') -Description 'Code - OSS git metadata' | Out-Null
}

$codeRoot = if ($DryRun -and -not (Test-Path -LiteralPath $targetCodeOssRoot)) {
  $targetCodeOssRoot
} else {
  Resolve-GomiRepoPath -PathValue $targetCodeOssRoot -Description 'Code - OSS root'
}

if (-not $SkipCheckout) {
  if ((Test-Path -LiteralPath $codeRoot) -and -not (Test-GitWorktreeClean -WorkingDirectory $codeRoot)) {
    throw "Code - OSS checkout has local changes. Commit/stash them or rerun with -SkipCheckout: $codeRoot"
  }

  Invoke-GomiBootstrapCommand -FilePath 'git' -ArgumentList @('-C', $codeRoot, 'fetch', '--all', '--tags', '--prune') -WorkingDirectory $repoRoot
  Invoke-GomiBootstrapCommand -FilePath 'git' -ArgumentList @('-C', $codeRoot, 'checkout', $Ref) -WorkingDirectory $repoRoot
}

if (-not $SkipBrandAssets) {
  $brandAssetScript = Resolve-GomiRepoPath -PathValue (Join-Path $repoRoot 'scripts/generate-gomi-brand-assets.mjs') -Description 'Gomi brand asset generator'
  Invoke-GomiBootstrapCommand -FilePath 'node.exe' -ArgumentList @($brandAssetScript) -WorkingDirectory $repoRoot
}

if (-not $SkipWebviewBundle) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'node_modules'))) {
    Invoke-GomiBootstrapCommand -FilePath 'npm.cmd' -ArgumentList @('ci') -WorkingDirectory $repoRoot
  }

  Invoke-GomiBootstrapCommand -FilePath 'npm.cmd' -ArgumentList @('run', 'build:webview') -WorkingDirectory $repoRoot
}

$integrationScript = Resolve-GomiRepoPath -PathValue (Join-Path $repoRoot 'scripts/apply-gomi-code-oss-integration.ps1') -Description 'Gomi integration script'
$integrationArgs = @('-ExecutionPolicy', 'Bypass', '-File', $integrationScript, '-CodeOssRoot', $codeRoot)

if ($ValidateOnly) {
  $integrationArgs += '-ValidateOnly'
}

if ($DryRun) {
  $integrationArgs += '-DryRun'
}

Invoke-GomiBootstrapCommand -FilePath 'powershell' -ArgumentList $integrationArgs -WorkingDirectory $repoRoot

Write-Host 'Gomi Code - OSS bootstrap completed.' -ForegroundColor Green
Write-Host 'Next packaging step:' -ForegroundColor Green
Write-Host "  powershell -ExecutionPolicy Bypass -File .\scripts\build-gomi-code-oss-windows.ps1 -CodeOssRoot `"$codeRoot`" -Platform win32-x64 -Minified -BuildSetup" -ForegroundColor Green
