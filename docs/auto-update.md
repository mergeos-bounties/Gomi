# Auto-Update

Gomi IDE supports optional automatic updates via `electron-updater`.

## Enabling

Set the environment variable before launching the Electron process:

```bash
# Enable auto-updates
GOMI_AUTO_UPDATE_ENABLED=1 npm run electron:start

# Or in production packaging:
GOMI_AUTO_UPDATE_ENABLED=1 npm run desktop:build
```

The feature is **disabled by default** to avoid unexpected network activity.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `GOMI_AUTO_UPDATE_ENABLED` | `"0"` | Set to `"1"` to enable |
| `GOMI_UPDATE_FEED_URL` | (auto) | Override the update feed URL |
| `GOMI_AUTO_DOWNLOAD` | `"1"` | `"0"` to prompt before downloading |
| `GOMI_UPDATE_CHANNEL` | `"latest"` | Release channel: `latest`, `beta`, `alpha` |

## How It Works

1. On startup (after a 10-second delay), the updater checks the configured feed for a newer version.
2. If an update is available and `GOMI_AUTO_DOWNLOAD=1`, it downloads automatically in the background.
3. When the download completes, the user is prompted to restart (or it restarts automatically if `GOMI_AUTO_DOWNLOAD=1`).
4. Periodic checks run every 4 hours.
5. All updater events are logged to `{userData}/logs/auto-update.log`.

## IPC Integration

The renderer can interact with the updater via these channels:

| Channel | Direction | Purpose |
|---|---|---|
| `gomi:update:check` | renderer → main | Trigger a manual update check |
| `gomi:update:status` | main → renderer | Receives `{state, info?}` events |
| `gomi:update:download-progress` | main → renderer | Receives `{percent, transferred, total}` |
| `gomi:update:quit-and-install` | renderer → main | Trigger quit-and-install |

### Renderer Example

```typescript
// Listen for status changes
window.electronAPI.onUpdateStatus((event, { state, info }) => {
  if (state === 'available') {
    console.log(`Update available: ${info.version}`);
  }
});

// Trigger manual check
window.electronAPI.checkForUpdates();
```

## Code Signing (macOS)

Auto-updates on macOS require code signing. Set these environment variables:

```bash
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your-password
export APPLE_ID=your@apple.id
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
export APPLE_TEAM_ID=YOUR_TEAM_ID
```

## Feed Server

The default feed URL pattern is:

- **macOS**: `https://updates.gomi.dev/mac/{channel}/{arch}`
- **Windows**: `https://updates.gomi.dev/win/{channel}/{arch}`
- **Linux**: `https://updates.gomi.dev/linux/{channel}/{arch}`

To use a custom feed, set `GOMI_UPDATE_FEED_URL`.
