# macOS / Linux Packaging Notes

## Overview

Gomi IDE's primary packaging target is Windows (Code - OSS fork). This document
outlines the steps needed to add macOS and Linux packaging support via
electron-builder.

## macOS

### Prerequisites
- macOS 12+ with Xcode Command Line Tools
- Apple Developer account (for code signing + notarization)
- Node.js 22

### electron-builder config (add to package.json `build` section)

```json
"mac": {
  "target": ["dmg", "zip"],
  "category": "public.app-category.developer-tools",
  "icon": "resources/gomi-branding/macos/gomi.icns",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist"
}
```

### Notarization (add to package.json)

```json
"afterSign": "scripts/notarize.js",
"mac": {
  "notarize": {
    "teamId": "YOUR_TEAM_ID"
  }
}
```

### Build command

```bash
npm run desktop:dir -- --mac
npm run desktop:build -- --mac
```

## Linux

### Prerequisites
- Build tools: `build-essential`, `libx11-dev`, `libxkbfile-dev`
- Optional: `fakeroot`, `dpkg`, `rpm` for package formats

### electron-builder config

```json
"linux": {
  "target": ["AppImage", "deb", "rpm"],
  "category": "Development",
  "icon": "resources/gomi-branding/linux",
  "maintainer": "gomi@example.com"
}
```

### Build command

```bash
npm run desktop:dir -- --linux
npm run desktop:build -- --linux
```

## Cross-platform CI

Add to `.github/workflows/build-release.yml`:

```yaml
strategy:
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
```

Note: macOS builds require a paid GitHub Actions runner or self-hosted M-series
Mac. Linux builds work on ubuntu-latest (free tier).
