param(
  [Parameter(Mandatory = $true)]
  [string]$CodeOssRoot,

  [ValidateSet('win32-x64', 'win32-arm64', 'win32-ia32')]
  [string]$Platform = 'win32-x64',

  [switch]$Minified,
  [switch]$BuildSetup,
  [switch]$SkipInstall,
  [switch]$DryRun
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

function Invoke-GomiBuildCommand {
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

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$codeRoot = Resolve-RequiredPath -PathValue $CodeOssRoot -Description 'Code - OSS root'

$requiredCodeOssPaths = @(
  'package.json',
  'product.json',
  'build/gulpfile.vscode.win32.js',
  'src/vs/workbench'
)

foreach ($relativePath in $requiredCodeOssPaths) {
  Resolve-RequiredPath -PathValue (Join-Path $codeRoot $relativePath) -Description "Required Code - OSS path" | Out-Null
}

$integrationScript = Resolve-RequiredPath -PathValue (Join-Path $repoRoot 'scripts/apply-gomi-code-oss-integration.ps1') -Description 'Gomi integration script'

Write-Host "Preparing Gomi IDE Windows package from Code - OSS root: $codeRoot" -ForegroundColor Green
Write-Host "Platform: $Platform" -ForegroundColor Green
Write-Host "Minified: $($Minified.IsPresent)" -ForegroundColor Green
Write-Host "Build setup installer: $($BuildSetup.IsPresent)" -ForegroundColor Green

$targetProductJson = Join-Path $codeRoot 'product.json'
$backupProductJson = Join-Path $codeRoot 'product.gomi-backup.json'

if (-not $DryRun -and -not (Test-Path -LiteralPath $backupProductJson)) {
  Copy-Item -LiteralPath $targetProductJson -Destination $backupProductJson -Force
}

$integrationArgs = @('-ExecutionPolicy', 'Bypass', '-File', $integrationScript, '-CodeOssRoot', $codeRoot)

if ($DryRun) {
  $integrationArgs += '-DryRun'
}

Write-Host ">> powershell $($integrationArgs -join ' ')" -ForegroundColor Cyan
Push-Location $repoRoot
try {
  & powershell @integrationArgs

  if ($LASTEXITCODE -ne 0) {
    throw "Gomi integration script failed with exit code ${LASTEXITCODE}."
  }
} finally {
  Pop-Location
}

if (-not $SkipInstall) {
  Invoke-GomiBuildCommand -FilePath 'npm.cmd' -ArgumentList @('install') -WorkingDirectory $codeRoot
}

$packageTask = if ($Minified) { "vscode-$Platform-min" } else { "vscode-$Platform" }
Invoke-GomiBuildCommand -FilePath 'npm.cmd' -ArgumentList @('run', 'gulp', '--', $packageTask) -WorkingDirectory $codeRoot

if ($BuildSetup) {
  $gulpScript = Join-Path $codeRoot 'node_modules/gulp/bin/gulp.js'
  if (-not $DryRun) {
    Resolve-RequiredPath -PathValue $gulpScript -Description 'gulp executable' | Out-Null
  }

  $taskList = @()

  if (-not $DryRun) {
    Push-Location $codeRoot
    try {
      $taskList = & node $gulpScript --tasks-simple
    } finally {
      Pop-Location
    }
  }

  $setupTaskCandidates = @(
    "vscode-$Platform-user-setup",
    "vscode-$Platform-system-setup",
    "vscode-$Platform-setup"
  )
  $setupTask = if ($DryRun) {
    $setupTaskCandidates[0]
  } else {
    $setupTaskCandidates | Where-Object { $taskList -contains $_ } | Select-Object -First 1
  }

  if (-not $setupTask) {
    throw "No Windows setup gulp task was found for $Platform. Available setup candidates checked: $($setupTaskCandidates -join ', ')"
  }

  Invoke-GomiBuildCommand -FilePath 'npm.cmd' -ArgumentList @('run', 'gulp', '--', $setupTask) -WorkingDirectory $codeRoot
}

$buildRoot = Join-Path $codeRoot '.build'

if (Test-Path -LiteralPath $buildRoot) {
  $artifacts = Get-ChildItem -Path $buildRoot -Recurse -File -Include *.exe, *.msi, *.zip |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 20

  if ($artifacts.Count -gt 0) {
    Write-Host 'Gomi build artifacts:' -ForegroundColor Green
    foreach ($artifact in $artifacts) {
      Write-Host " - $($artifact.FullName)" -ForegroundColor Green
    }
  } else {
    Write-Host "Packaged output was created under $buildRoot, but no exe/msi/zip artifacts were found by this script." -ForegroundColor Yellow
  }
}

Write-Host 'Gomi Code - OSS Windows packaging step completed.' -ForegroundColor Green
