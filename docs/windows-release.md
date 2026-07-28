# Windows Release Notes — Gomi IDE

## Release Artifacts

Distributable packages are built via `electron-builder`:

```bash
# Build for Windows
npm run desktop:build

# Build output directory (no installer)
npm run desktop:dir
```

Output location: `release/desktop/`

## Auto-Update (Optional)

Auto-update is **disabled by default**. To enable:

1. Install the optional dependency:
   ```bash
   npm install electron-updater
   ```

2. Set environment variables before starting:
   ```bash
   set GOMI_AUTO_UPDATE_ENABLED=1
   set GOMI_UPDATE_FEED_URL=https://your-update-server.com/feed.json
   ```

### Behavior

- **Feature gated**: No network calls are made unless `GOMI_AUTO_UPDATE_ENABLED=1` is set.
- **No auto-download**: When an update is detected, it is NOT automatically downloaded or installed — the user is notified.
- **Custom feed**: Set `GOMI_UPDATE_FEED_URL` to point to your own update server. Falls back to electron-builder defaults.

### Security Considerations

- Updates are checked over HTTPS. Configure your feed URL with HTTPS in production.
- The update check happens after the app window is shown, not at startup, to avoid delaying the user experience.
- The verify:release pipeline and code signing must be configured separately.
