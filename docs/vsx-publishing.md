# Open VSX Publishing Guide

Gomi IDE distributes its extension ecosystem via [Open VSX](https://open-vsx.org/) — an open, vendor-neutral VS Code extension marketplace operated by Eclipse.

## Why Open VSX?

- **No vendor lock-in**: Not tied to Microsoft's proprietary marketplace terms
- **Open governance**: Community-run, no commercial requirements
- **OSS-friendly**: Free publishing for open-source extensions
- **Privacy-respecting**: No marketplace telemetry forced on users

## Gallery Configuration

Gomi's `product.json` configures the extensions gallery as follows:

```json
{
  "extensionsGallery": {
    "serviceUrl": "https://open-vsx.org/vscode/gallery",
    "itemUrl": "https://open-vsx.org/vscode/item"
  }
}
```

This is tested by `tests/vsxGallery.test.ts`, which asserts:

- Both `serviceUrl` and `itemUrl` are defined
- Both URLs point to `open-vsx.org` (not `marketplace.visualstudio.com`)
- URLs use HTTPS
- No Microsoft marketplace references in the gallery config

## Publishing an Extension to Open VSX

### 1. Create a Publisher Account

Register at [open-vsx.org](https://open-vsx.org/) and create a publisher namespace (e.g., `gomi`).

### 2. Package Your Extension

```bash
# Install vsce if not already installed
npm install -g @vscode/vsce

# Package (from extension root)
vsce package
```

### 3. Publish

```bash
# Using personal access token from open-vsx.org
vsce publish --pac @open-vsx/publisher YOUR_TOKEN
```

Or publish via the web UI at [open-vsx.org](https://open-vsx.org/workspace/publish).

## Extension Identity Checklist

Before publishing, ensure your `package.json` extension manifest includes:

```json
{
  "name": "your-extension-name",
  "publisher": "your-publisher-id",
  "version": "1.0.0",
  "displayName": "Your Extension Display Name",
  "description": "Brief description",
  "license": "MIT"
}
```

The VSX extension registry validates:
- Publisher ID matches your registered namespace
- Extension name is unique within that namespace
- Version follows semver (`major.minor.patch`)

## Anti-Patterns to Avoid

| Anti-Pattern | Why | Fix |
|---|---|---|
| `marketplace.visualstudio.com` URLs | Microsoft proprietary marketplace | Use `open-vsx.org` |
| Hardcoded private token | Security risk | Use CI secrets / PAT |
| Missing publisher field | Fails VSX validation | Add `"publisher": "your-id"` |
| Non-HTTPS gallery URLs | Security risk | Always use `https://` |

## CI Integration

In CI pipelines, validate the gallery configuration before building:

```bash
# Smoke test — no marketplace.visualstudio.com refs
grep -r "marketplace.visualstudio.com" product.json && exit 1 || echo "OK"
grep -r "marketplace.visualstudio.com" src/ && exit 1 || echo "OK"
```

The `tests/vsxGallery.test.ts` test suite covers this automatically.

## Further Reading

- [Open VSX Documentation](https://github.com/EclipseFdn/open-vsx.org)
- [VSCE Publishing Reference](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [VSCode Extension Gallery API](https://code.visualstudio.com/api/references/extension-gallery)