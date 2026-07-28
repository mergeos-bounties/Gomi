// @ts-check
"use strict";

/**
 * @file Auto-update stub for Gomi IDE.
 * Feature-gated behind env GOMI_AUTO_UPDATE_ENABLED (default: off).
 * electron-updater is optional — if not installed, the module is a no-op.
 */

const AUTO_UPDATE_ENABLED = process.env.GOMI_AUTO_UPDATE_ENABLED === "1" || process.env.GOMI_AUTO_UPDATE_ENABLED === "true";
const UPDATE_FEED_URL = process.env.GOMI_UPDATE_FEED_URL || "";

/**
 * Returns whether the packaged build should check for updates.
 * Only checks if:
 * 1. The app is packaged (not dev mode)
 * 2. GOMI_AUTO_UPDATE_ENABLED is set to "1" or "true"
 * 3. Optionally, an update feed URL is configured
 *
 * @returns {{ shouldCheck: boolean, reason: string }}
 */
function shouldCheckForUpdates(app) {
  if (!app || !app.isPackaged) {
    return { shouldCheck: false, reason: "not-packaged" };
  }

  if (!AUTO_UPDATE_ENABLED) {
    return { shouldCheck: false, reason: "feature-disabled" };
  }

  return { shouldCheck: true, reason: "enabled" };
}

/**
 * Initializes auto-update if conditions are met.
 * Tries to load electron-updater; silently skips if unavailable.
 *
 * @param {import("electron").App} app
 * @returns {{ initialized: boolean, autoUpdater: object | null }}
 */
function initAutoUpdate(app) {
  const { shouldCheck, reason } = shouldCheckForUpdates(app);

  if (!shouldCheck) {
    return { initialized: false, autoUpdater: null };
  }

  let autoUpdater = null;

  try {
    autoUpdater = require("electron-updater").autoUpdater;
  } catch {
    return { initialized: false, autoUpdater: null };
  }

  if (UPDATE_FEED_URL) {
    autoUpdater.setFeedURL(UPDATE_FEED_URL);
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", () => {
    console.log("[auto-update] Update available (not downloading — autoDownload is off)");
  });

  autoUpdater.on("error", (err) => {
    console.error("[auto-update] Error:", err.message);
  });

  autoUpdater.checkForUpdates().catch(() => {
    // silent failure
  });

  return { initialized: true, autoUpdater };
}

module.exports = { shouldCheckForUpdates, initAutoUpdate };
