/**
 * Auto-update stub for Gomi IDE.
 *
 * ## Design
 *
 * - **Off by default.** No network requests are ever made unless the user
 *   explicitly opts in via `GOMI_AUTO_UPDATE=1` AND provides a feed URL via
 *   `GOMI_UPDATE_FEED_URL`.
 * - **Optional dependency.** `electron-updater` is NOT a hard dependency. If it
 *   isn't installed the stub degrades silently — no crash, no error popup.
 * - **Policy function.** `shouldCheckForUpdates()` is the single decision point.
 *   It can be unit-tested without spinning up Electron.
 *
 * ## Security
 *
 * By keeping auto-update disabled in the default build we avoid:
 * - Unexpected network egress from a packaged IDE.
 * - Man-in-the-middle risk on the update feed (the user controls the URL).
 * - Supply-chain dependency on `electron-updater` until the user opts in.
 *
 * When the user enables auto-update they accept responsibility for:
 * - Verifying the feed URL points to a trusted source.
 * - Ensuring the update channel uses HTTPS.
 * - Keeping `electron-updater` up to date independently of Gomi releases.
 *
 * ## Configuration
 *
 * | Env var               | Required | Description                          |
 * |-----------------------|----------|--------------------------------------|
 * | `GOMI_AUTO_UPDATE`    | yes      | Set to `1`, `true`, or `yes`         |
 * | `GOMI_UPDATE_FEED_URL`| yes      | HTTPS URL to the update feed / repo  |
 *
 * @module electron/autoUpdater
 */

const { app } = require('electron');

// ---------------------------------------------------------------------------
// Policy (pure – testable without Electron)
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the environment signals that auto-update checks should
 * be attempted.
 *
 * The default packaged build ships with this returning `false` so that zero
 * network calls are made unless the operator explicitly configures both the
 * feature flag and a feed URL.
 *
 * @param {{
 *   env?: Record<string, string | undefined>;
 *   isPackaged?: boolean;
 * }} [opts]
 * @returns {boolean}
 */
function shouldCheckForUpdates(opts = {}) {
  const env = opts.env || process.env;
  const isPackaged =
    opts.isPackaged !== undefined ? opts.isPackaged : app.isPackaged;

  // Only meaningful in a packaged build (dev builds don't auto-update).
  if (!isPackaged) {
    return false;
  }

  const flag = String(env.GOMI_AUTO_UPDATE || '').trim().toLowerCase();
  const enabled = flag === '1' || flag === 'true' || flag === 'yes';
  if (!enabled) {
    return false;
  }

  const feedUrl = String(env.GOMI_UPDATE_FEED_URL || '').trim();
  if (!feedUrl) {
    return false;
  }

  // Enforce HTTPS for the feed URL.
  if (!/^https:\/\//i.test(feedUrl)) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Lazy loader
// ---------------------------------------------------------------------------

/** @type {import('electron-updater').AppUpdater | null} */
let _updater = null;

/**
 * Try to load `electron-updater`. Returns `null` when the optional dependency
 * is not installed so that callers can degrade gracefully.
 *
 * @returns {import('electron-updater').AppUpdater | null}
 */
function resolveUpdater() {
  if (_updater) {
    return _updater;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { autoUpdater } = require('electron-updater');
    _updater = autoUpdater;
    return _updater;
  } catch (_err) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Initialisation
// ---------------------------------------------------------------------------

/**
 * Wire auto-update when the environment opts in.
 *
 * Must be called AFTER `app.whenReady()` so that `app.isPackaged` is settled.
 *
 * In the default (packaged, no env vars) case this is a no-op: zero network
 * activity, zero console noise.
 */
function initAutoUpdater() {
  if (!shouldCheckForUpdates()) {
    return;
  }

  const updater = resolveUpdater();
  if (!updater) {
    console.warn(
      '[gomi:auto-update] GOMI_AUTO_UPDATE is enabled but electron-updater ' +
        'is not installed. Run `npm install electron-updater` to enable updates.'
    );
    return;
  }

  const feedUrl = String(process.env.GOMI_UPDATE_FEED_URL || '').trim();

  // Configure the updater's feed provider. electron-updater reads from
  // package.json `build.publish` by default; here we explicitly set the feed
  // URL so that the configuration is self-contained.
  updater.setFeedURL(feedUrl);

  updater.logger = {
    info: (...args) => console.log('[gomi:auto-update]', ...args),
    warn: (...args) => console.warn('[gomi:auto-update]', ...args),
    error: (...args) => console.error('[gomi:auto-update]', ...args),
    debug: () => {
      /* silent by default */
    }
  };

  // Check for updates on startup (non-blocking).
  updater.checkForUpdatesAndNotify().catch((err) => {
    console.warn('[gomi:auto-update] update check failed:', err.message);
  });
}

module.exports = {
  shouldCheckForUpdates,
  initAutoUpdater
};
