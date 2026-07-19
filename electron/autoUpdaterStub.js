/**
 * Electron auto-update stub (issue #29).
 * Wires electron-updater with feature flag (off by default).
 * This is a stub — full implementation requires signing certs.
 *
 * Note: do NOT `import type` from `electron-updater` — the package is optional
 * and not always installed in CI typecheck. Use a minimal local interface.
 */

/**
 * @typedef {Object} AppUpdater
 * @property {boolean} autoDownload
 * @property {boolean} autoInstallOnAppQuit
 * @property {string=} channel
 * @property {function(Object): void} setFeedURL
 * @property {function(): Promise<unknown>=} checkForUpdates
 */

/**
 * @typedef {Object} AutoUpdateConfig
 * @property {boolean} enabled
 * @property {'github'|'generic'} provider
 * @property {string=} repo
 * @property {string=} url
 * @property {string=} channel
 */

/**
 * @param {AutoUpdateConfig} config
 * @returns {AppUpdater|null}
 */
function createAutoUpdaterStub(config) {
  if (!config.enabled) return null;

  try {
    // Dynamic require — electron-updater is an optional dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { autoUpdater } = require("electron-updater");

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    if (config.provider === "github" && config.repo) {
      const [owner, repo] = config.repo.split("/");
      autoUpdater.setFeedURL({
        provider: "github",
        owner,
        repo,
      });
    }

    if (config.channel) {
      autoUpdater.channel = config.channel;
    }

    return autoUpdater;
  } catch {
    // electron-updater not installed — return null
    return null;
  }
}

/**
 * @returns {boolean}
 */
function isAutoUpdateAvailable() {
  try {
    require.resolve("electron-updater");
    return true;
  } catch {
    return false;
  }
}

module.exports = { createAutoUpdaterStub, isAutoUpdateAvailable };
