# macOS & Linux Packaging Guide

This document provides instructions for building and packaging Gomi IDE for macOS and Linux platforms.

## Overview

While the primary focus has been on Windows packaging, Gomi IDE supports cross-platform distribution via Electron Builder. This guide covers macOS (.dmg, .zip) and Linux (AppImage, .deb, .rpm) packaging configurations.

## Prerequisites

### macOS Requirements
- macOS 10.15+ (Catalina or newer)
- Xcode Command Line Tools: `xcode-select --install`
- [electron-builder](https://www.electron.build/) dependencies

### Linux Requirements
- Ubuntu 20.04+ or equivalent Debian-based distro
- For RPM builds: rpmbuild package (`sudo apt-get install rpm`)
- For AppImage: fuse library (`sudo apt-get install libfuse2`)
- [electron-builder](https://www.electron.build/) dependencies

## Configuration

The build configuration is defined in `package.json` under the `build` section:

```json
"build": {
  "appId": "com.gomi.ide",
  "productName": "Gomi IDE",
  "copyright": "Copyright (c) Gomi",
  "directories": {
    "output": "release/desktop",
    "buildResources": "resources/gomi-branding"
  },
  "files": [
    "dist/**/*",
    "electron/**/*",
    "package.json"
  ],
  "win": {
    "target": ["nsis"],
    "icon": "resources/gomi-branding/win32/gomi.ico",
    "artifactName": "Gomi-IDE-Setup-${version}-${arch}.${ext}"
  },
  "mac": {
    "target": ["dmg", "zip"],
    "category": "public.app-category.developer-tools",
    "icon": "resources/gomi-branding/macos/gomi.icns",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  },
  "linux": {
    "target": ["AppImage", "deb", "rpm"],
    "category": "Development",
    "icon": "resources/gomi-branding/linux",
    "maintainer": "gomi@example.com"
  },
  "nsis": {
    "oneClick": false,
    "perMachine": false,
    "allowToChangeInstallationDirectory": true,
    "shortcutName": "Gomi IDE",
    "uninstallDisplayName": "Gomi IDE"
  }
}
```

## Building for Specific Platforms

### macOS Build
```bash
# Build both DMG and ZIP archives
npm run build
npx electron-builder --mac

# Or build specific artifacts
npx electron-builder --mac -d  # DMG only
npx electron-builder --mac -z  # ZIP only
```

### Linux Build
```bash
# Build all Linux targets (AppImage, deb, rpm)
npm run build
npx electron-builder --linux

# Build specific targets
npx electron-builder --linux -AppImage
npx electron-builder --linux -deb
npx electron-builder --linux -rpm
```

### Cross-Platform Build (CI)
```bash
# Build for all platforms (requires appropriate build environment)
npm run build
npx electron-builder --multi-platform
```

## Code Signing & Notarization (macOS)

For distribution outside the App Store, macOS applications should be code-signed and notarized.

### Environment Variables
Set these in your CI environment or `.env` file:
- `APPLE_ID`: Apple ID for notarization
- `APPLE_ID_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Your Apple Developer Team ID
- `CSC_LINK`: Base64-encoded certificate (for Windows)
- `CSC_KEY_PASSWORD`: Certificate password

### Notarization Script
A helper script is available at `scripts/notarize.js`:
```bash
npm run notarize
```

## Resources & Icons

Platform-specific icons should be placed in:
- macOS: `resources/gomi-branding/macos/gomi.icns` (1024x1024px)
- Windows: `resources/gomi-branding/win32/gomi.ico` (256x256px)
- Linux: `resources/gomi-branding/linux` (1024x1024px PNG)

## Testing Built Artifacts

### macOS
```bash
# For DMG
hdiutil attach dist/Gomi-IDE-*.dmg
# Copy to /Applications and test
hdiutil detach /Volumes/Gomi-IDE

# For ZIP
unzip dist/Gomi-IDE-*.zip
open Gomi-IDE.app
```

### Linux
```bash
# AppImage
chmod +x dist/Gomi-IDE-*.AppImage
./dist/Gomi-IDE-*.AppImage

# DEB
sudo dpkg -i dist/Gomi-IDE_*_amd64.deb
gomide  # or find in menu

# RPM
sudo rpm -i dist/Gomi-IDE-*.x86_64.rpm
gomide  # or find in menu
```

## CI/CD Examples

### GitHub Actions (macOS)
```yaml
macos-build:
  runs-on: macos-latest
  steps:
    - uses: actions/checkout@v3
    - name: Setup Node
      uses: actions/setup-node@v3
      with:
        node-version: 20
    - run: npm ci
    - run: npm run build
    - run: npx electron-builder --mac
    - uses: actions/upload-artifact@v3
      with:
        name: macos-build
        path: release/desktop/*
```

### GitHub Actions (Linux)
```yaml
linux-build:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - name: Setup Node
      uses: actions/setup-node@v3
      with:
        node-version: 20
    - run: npm ci
    - run: npm run build
    - run: npx electron-builder --linux
    - uses: actions/upload-artifact@v3
      with:
        name: linux-build
        path: release/desktop/*
```

## Troubleshooting

### Common Issues

**macOS: "App is damaged" error**
- Ensure proper code signing and notarization
- Check Gatekeeper settings: `spctl --assess --type execute /path/to/Gomi-IDE.app`

**Linux: Missing dependencies**
- AppImage: Usually self-contained
- DEB/RPM: Ensure dependencies are specified in package.json build.linux section

**Build fails on CI**
- Verify all native dependencies are installed in the CI environment
- Check node-gyp prerequisites for native modules

## Further Reading

- [electron-builder Documentation](https://www.electron.build/)
- [macOS App Distribution Guide](https://developer.apple.com/documentation/xcode/distributing-your-app-for-macos)
- [Linux AppImage Documentation](https://appimage.org/)
- [Debian Package Maintenance](https://www.debian.org/doc/manuals/maint-guide/)
- [RPM Packaging Guide](https://rpm-packaging-guide.github.io/)