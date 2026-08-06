# Windows Desktop Release

Gomi IDE is intended to ship as a standalone desktop IDE built from a Code - OSS fork. The React/Vite demo in this repository is only the Gomi Office workbench prototype; it is not the final user-facing distribution format.

The Windows release path is:

```text
Gomi repository
-> Generate Gomi desktop branding assets
-> Build Gomi Office webview bundle
-> Code - OSS fork checkout
-> Apply Gomi product metadata and Gomi workbench module
-> Run Code - OSS Windows gulp packaging task
-> Upload ZIP/EXE artifacts to GitHub Releases
```


## Pre-Release Readiness Check

Before tagging a release, run the desktop release readiness checker to validate that all required branding, icons, and packaging configuration are in place:

```bash
npm run check:desktop
```

The checker validates:

- `product.json` — ensures all branding fields are Gomi-specific (name, app ID, extension gallery)
- `package.json` — verifies electron main entry, build config, and win32 icon path
- `resources/gomi-branding/` — confirms brand asset directories for win32, darwin, and linux
- `electron/main.cjs` — validates the electron entry point exists

A non-zero exit means the repository is not ready for desktop packaging. Fix the reported issues before tagging `v*`.

Exit codes:
- `0` — all checks passed, repository is release-ready
- `1` — one or more checks failed, see output for details

## GitHub Actions

The repository includes `.github/workflows/build-release.yml`.

Pushes to `master` run the verification job and upload a prototype artifact. Release tags named `v*` run the Windows Code - OSS packaging job and publish the produced artifacts to a GitHub prerelease. Manual release publishing also requires the Windows desktop packaging step to be enabled, so GitHub Releases do not present the prototype bundle as the final IDE.

It has three jobs:

- `verify-prototype`: installs dependencies, generates branded desktop assets, runs typecheck/tests/release-readiness checks, builds the standalone preview and Code - OSS webview bundle, then uploads a versioned `gomi-office-webview-prototype-<commit>.zip` with a SHA-256 checksum.
- `code-oss-windows`: checks out a Code - OSS fork, applies the Gomi integration manifest, packages Gomi for Windows, validates the patched `product.json` still identifies the build as Gomi IDE, collects `.exe`, `.msi`, and `.zip` outputs when present, and writes an `ARTIFACTS.md` manifest. It runs automatically for `v*` tags and can be enabled manually with `build_code_oss_windows`.
- `release`: downloads all artifacts, generates release notes, and publishes artifacts to a GitHub Release only after the Windows desktop packaging job succeeds.

For tagged releases, the Code - OSS source defaults to `microsoft/vscode` at `main`. In production, configure repository variables before tagging:

- `GOMI_CODE_OSS_REPOSITORY`: the real Gomi Code - OSS fork, for example `mergeos-bounties/gomi-code-oss`.
- `GOMI_CODE_OSS_REF`: the branch, tag, or SHA to package.
- `GOMI_WINDOWS_PLATFORM`: `win32-x64`, `win32-arm64`, or `win32-ia32`.
- `GOMI_BUILD_SETUP_EXE`: set to `false` to skip the Windows setup installer task. Tag builds attempt the setup `.exe` by default because the product release should be a desktop installer when the fork supports it.

To create a release from a tag:

```powershell
git tag v0.1.0-alpha.1
git push origin v0.1.0-alpha.1
```

For tag-based desktop releases, configure the repository variables first so the workflow packages the Gomi Code - OSS fork instead of the upstream development default:

```text
GOMI_CODE_OSS_REPOSITORY=mergeos-bounties/gomi-code-oss
GOMI_CODE_OSS_REF=main
GOMI_WINDOWS_PLATFORM=win32-x64
GOMI_BUILD_SETUP_EXE=true
```

If the fork does not yet expose a compatible Windows setup task, set `GOMI_BUILD_SETUP_EXE=false`. The workflow will still upload the packaged Windows folder as a ZIP when the Code - OSS packaging task succeeds.

To run the full Windows desktop packaging workflow:

1. Open GitHub Actions.
2. Run `Build and Release Gomi IDE`.
3. Set `build_code_oss_windows` to `true`.
4. Set `code_oss_repository` to the Gomi Code - OSS fork.
5. Set `code_oss_ref` to the branch/tag/SHA to package.
6. Choose `win32-x64`, `win32-arm64`, or `win32-ia32`.
7. Enable `build_setup_exe` when the fork has a compatible Windows setup gulp task.

The Windows packaging job runs `scripts/build-gomi-code-oss-windows.ps1`. That script validates the Code - OSS checkout, generates Gomi desktop branding assets, builds the Gomi Office React/Phaser webview bundle, applies `build/gomi-code-oss.integration.json`, merges Gomi product metadata over the fork's existing `product.json`, copies Gomi branding/module files into the fork, overlays the native Gomi workbench registration template, copies the generated webview assets into the workbench module, appends the Gomi workbench import when needed, and then runs the Code - OSS gulp package task.

After packaging, `scripts/collect-gomi-windows-artifacts.ps1` validates the final Code - OSS `product.json` before any artifact is uploaded. It refuses to collect release files unless the product identity is `Gomi IDE`, the app id is `gomi-ide`, the data folder is `.gomi-ide`, and the extension gallery points to Open VSX. This prevents a release run from accidentally publishing upstream Code - OSS artifacts under the Gomi release.

The workflow intentionally keeps the heavy Code - OSS packaging job separate from the normal `master` verification path. Normal pushes verify the Gomi module quickly. Tags or manual release runs produce desktop artifacts.

## Local Windows Packaging

Bootstrap or update a Code - OSS checkout with the Gomi overlay:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-gomi-code-oss-fork.ps1 `
  -CodeOssRoot D:\path\to\code-oss-fork `
  -Repository https://github.com/your-org/gomi-code-oss.git `
  -Ref main
```

The bootstrap script clones the checkout when it is missing, checks out the requested ref when the worktree is clean, generates Gomi branding assets, builds the Gomi Office webview bundle, and runs the integration manifest. Use `-ValidateOnly` against an existing checkout to inspect the integration without copying files, or `-DryRun` to preview the command sequence.

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

The local packaging script runs the Gomi brand asset generator and `npm run build:webview` before applying the manifest. The generated webview assets are written to `build/gomi-office-webview` locally and copied into `src/vs/workbench/contrib/gomi/browser/media/office` inside the Code - OSS checkout. The generated desktop branding assets are written under `resources/gomi-branding` and copied over Code - OSS packaging resources such as `resources/win32/code.ico`, `resources/win32/code_70x70.png`, `resources/win32/code_150x150.png`, `resources/win32/inno-*.bmp`, `resources/linux/code.png`, and `resources/darwin/code.icns`.

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

For the lower-level manifest apply step, write a dry-run report outside the Code - OSS checkout so the target tree remains unchanged:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\apply-gomi-code-oss-integration.ps1 `
  -CodeOssRoot D:\path\to\code-oss-fork `
  -DryRun `
  -ReportPath .\artifacts\gomi-code-oss-dry-run-report.json
```

The dry-run report lists the planned manifest actions and matching rollback steps, such as restoring `product.json`, removing copied Gomi module paths, or removing the appended workbench import. In dry-run mode the report path is rejected if it is inside the Code - OSS checkout.

## Why EXE, Not NPM

End users should not run Gomi IDE with `npm run dev`.

`npm` is used only for:

- Developing the Gomi Office module.
- Running tests.
- Building the prototype and Code - OSS webview bundles.
- Invoking Code - OSS gulp packaging tasks during automation.

The product release artifact should be a Windows desktop package from the Code - OSS fork, usually a packaged folder/ZIP and, when the setup task is available, an Inno Setup `.exe` installer.

VS Code's Windows setup path uses Inno Setup. MSI is not the primary upstream packaging format, so Gomi should target a setup `.exe` first and add MSI only if an enterprise installer pipeline is introduced later.

## Current Limitation

This repository is still a Gomi product foundation and module scaffold. A full release requires validating the native workbench contribution and patch diff preview inside a real Code - OSS fork, deepening terminal scrollback and workbench log/output-channel readers beyond the current adapter hooks, and replacing all final branding assets.
