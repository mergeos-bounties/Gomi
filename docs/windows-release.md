# Windows Desktop Release

Gomi IDE is intended to ship as a standalone desktop IDE built from a Code - OSS fork. The React/Vite demo in this repository is only the Gomi Office workbench prototype; it is not the final user-facing distribution format.

The Windows release path is:

```text
Gomi repository
-> Build Gomi Office webview bundle
-> Code - OSS fork checkout
-> Apply Gomi product metadata and Gomi workbench module
-> Run Code - OSS Windows gulp packaging task
-> Upload ZIP/EXE artifacts to GitHub Releases
```

## GitHub Actions

The repository includes `.github/workflows/build-release.yml`.

Pushes to `master` run the verification job and upload a prototype artifact. Release tags named `v*` run the Windows Code - OSS packaging job and publish the produced artifacts to a GitHub prerelease. Manual runs can also publish a release, with or without the heavy Windows desktop packaging step.

It has three jobs:

- `verify-prototype`: installs dependencies, runs typecheck/tests, builds the standalone preview and Code - OSS webview bundle, then uploads a versioned `gomi-office-webview-prototype-<commit>.zip`.
- `code-oss-windows`: checks out a Code - OSS fork, applies the Gomi integration manifest, packages Gomi for Windows, collects `.exe`, `.msi`, and `.zip` outputs when present, and writes an `ARTIFACTS.md` manifest. It runs automatically for `v*` tags and can be enabled manually with `build_code_oss_windows`.
- `release`: downloads all artifacts, generates release notes, and publishes artifacts to a GitHub Release for `v*` tags or manual runs with `create_release` enabled.

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

The Windows packaging job runs `scripts/build-gomi-code-oss-windows.ps1`. That script validates the Code - OSS checkout, builds the Gomi Office React/Phaser webview bundle, applies `build/gomi-code-oss.integration.json`, copies Gomi branding/module files into the fork, overlays the native Gomi workbench registration template, copies the generated webview assets into the workbench module, appends the Gomi workbench import when needed, and then runs the Code - OSS gulp package task.

The workflow intentionally keeps the heavy Code - OSS packaging job separate from the normal `master` verification path. Normal pushes verify the Gomi module quickly. Tags or manual release runs produce desktop artifacts.

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

The local packaging script runs `npm run build:webview` before applying the manifest. The generated assets are written to `build/gomi-office-webview` locally and copied into `src/vs/workbench/contrib/gomi/browser/media/office` inside the Code - OSS checkout.

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
- Building the prototype and Code - OSS webview bundles.
- Invoking Code - OSS gulp packaging tasks during automation.

The product release artifact should be a Windows desktop package from the Code - OSS fork, usually a packaged folder/ZIP and, when the setup task is available, an Inno Setup `.exe` installer.

VS Code's Windows setup path uses Inno Setup. MSI is not the primary upstream packaging format, so Gomi should target a setup `.exe` first and add MSI only if an enterprise installer pipeline is introduced later.

## Current Limitation

This repository is still a Gomi product foundation and module scaffold. A full release requires validating the native workbench contribution inside a real Code - OSS fork, deepening terminal scrollback and workbench log/output-channel readers beyond the current adapter hooks, adding a workbench diff preview before approved patch application, and replacing all final branding assets.
