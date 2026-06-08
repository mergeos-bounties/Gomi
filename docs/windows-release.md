# Windows Desktop Release

Gomi IDE is intended to ship as a standalone desktop IDE built from a Code - OSS fork. The React/Vite demo in this repository is only the Gomi Office workbench prototype; it is not the final user-facing distribution format.

The Windows release path is:

```text
Gomi repository
-> Code - OSS fork checkout
-> Apply Gomi product metadata and Gomi workbench module
-> Run Code - OSS Windows gulp packaging task
-> Upload ZIP/EXE artifacts to GitHub Releases
```

## GitHub Actions

The repository includes `.github/workflows/build-release.yml`.

Pushes to `master` run the verification job and upload the prototype artifact. Tagged releases and manual runs can also publish GitHub Release assets.

It has three jobs:

- `verify-prototype`: installs dependencies, runs typecheck/tests, builds the current Gomi Office webview prototype, and uploads `gomi-office-webview-prototype.zip`.
- `code-oss-windows`: optional manual job that checks out a Code - OSS fork, applies the Gomi integration manifest, and packages Gomi for Windows.
- `release`: publishes artifacts to a GitHub Release for `v*` tags or manual runs with `create_release` enabled.

To run the full Windows desktop packaging workflow:

1. Open GitHub Actions.
2. Run `Build and Release Gomi IDE`.
3. Set `build_code_oss_windows` to `true`.
4. Set `code_oss_repository` to the Gomi Code - OSS fork.
5. Set `code_oss_ref` to the branch/tag/SHA to package.
6. Choose `win32-x64`, `win32-arm64`, or `win32-ia32`.
7. Enable `build_setup_exe` when the fork has a compatible Windows setup gulp task.

The Windows packaging job runs `scripts/build-gomi-code-oss-windows.ps1`. That script validates the Code - OSS checkout, applies `build/gomi-code-oss.integration.json`, copies Gomi branding/module files into the fork, overlays the native Gomi workbench registration template, appends the Gomi workbench import when needed, and then runs the Code - OSS gulp package task.

## Local Windows Packaging

Validate the integration without changing the Code - OSS checkout:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\apply-gomi-code-oss-integration.ps1 `
  -CodeOssRoot D:\path\to\code-oss-fork `
  -ValidateOnly
```

Run from this repository:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-gomi-code-oss-windows.ps1 `
  -CodeOssRoot D:\path\to\code-oss-fork `
  -Platform win32-x64 `
  -Minified `
  -BuildSetup
```

For a faster packaged folder build without installer:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-gomi-code-oss-windows.ps1 `
  -CodeOssRoot D:\path\to\code-oss-fork `
  -Platform win32-x64 `
  -Minified
```

Preview the full packaging command sequence without copying files or running gulp:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-gomi-code-oss-windows.ps1 `
  -CodeOssRoot D:\path\to\code-oss-fork `
  -Platform win32-x64 `
  -Minified `
  -BuildSetup `
  -DryRun
```

## Why EXE, Not NPM

End users should not run Gomi IDE with `npm run dev`.

`npm` is used only for:

- Developing the Gomi Office module.
- Running tests.
- Building the prototype webview bundle.
- Invoking Code - OSS gulp packaging tasks during automation.

The product release artifact should be a Windows desktop package from the Code - OSS fork, usually a packaged folder/ZIP and, when the setup task is available, an Inno Setup `.exe` installer.

VS Code's Windows setup path uses Inno Setup. MSI is not the primary upstream packaging format, so Gomi should target a setup `.exe` first and add MSI only if an enterprise installer pipeline is introduced later.

## Current Limitation

This repository is still a Gomi product foundation and module scaffold. A full release requires validating the native workbench contribution inside a real Code - OSS fork, mounting the full React/Phaser office webview in that pane, and replacing all final branding assets.
