"use strict";

/**
 * Auto-update policy for Gomi IDE.
 *
 * Security: auto-update is OFF by default. Two conditions must both be met:
 *   1. GOMI_AUTO_UPDATE_ENABLED must be set to "1" or "true"
 *   2. GOMI_AUTO_UPDATE_FEED_URL must be a non-empty string (HTTPS required)
 *
 * Without both, the default packaged build makes zero network calls for updates.
 */

const ENABLED_TRUTHY = new Set(["1", "true"]);

function shouldCheckForUpdates(env) {
  const rawEnabled = (env && env.GOMI_AUTO_UPDATE_ENABLED) || "";
  const feedUrl = (env && env.GOMI_AUTO_UPDATE_FEED_URL) || "";

  const enabled = ENABLED_TRUTHY.has(rawEnabled.toLowerCase());
  const hasFeed = typeof feedUrl === "string" && feedUrl.startsWith("https://");

  return enabled && hasFeed;
}

function setupAutoUpdater(env, autoUpdater) {
  if (!shouldCheckForUpdates(env)) {
    return false;
  }

  const feedUrl = env.GOMI_AUTO_UPDATE_FEED_URL;
  try {
    autoUpdater.setFeedURL({ url: feedUrl });
    autoUpdater.checkForUpdates();
    return true;
  } catch (_err) {
    return false;
  }
}

module.exports = { shouldCheckForUpdates, setupAutoUpdater };
