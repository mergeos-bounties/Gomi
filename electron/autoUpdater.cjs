'use strict';

const { app } = require('electron');

/**
 * Auto-update stub for Gomi IDE.
 *
 * Disabled by default — no network calls unless both:
 *   - GOMI_AUTO_UPDATE_ENABLED=true
 *   - GOMI_UPDATE_FEED_URL is set to a valid https:// URL
 *
 * Security: feed URL must be HTTPS; hostname is logged for audit.
 * electron-updater is loaded lazily so packages without it still work.
 */

const AUTO_UPDATE_ENABLED = process.env.GOMI_AUTO_UPDATE_ENABLED === 'true';
const UPDATE_FEED_URL = process.env.GOMI_UPDATE_FEED_URL || '';

/**
 * Policy: should we check for updates?
 * @returns {boolean}
 */
function shouldCheckForUpdates() {
  if (!AUTO_UPDATE_ENABLED) return false;
  if (!UPDATE_FEED_URL) return false;
  try {
    const u = new URL(UPDATE_FEED_URL);
    if (u.protocol !== 'https:') return false;
  } catch {
    return false;
  }
  return app.isPackaged;
}

/**
 * Lazily require electron-updater so it's truly optional.
 * @returns {object|null} updater module or null
 */
let _updater = undefined;
let _loadAttempted = false;

function _loadUpdater() {
  if (_loadAttempted) return _updater;
  _loadAttempted = true;
  try {
    _updater = require('electron-updater');
  } catch {
    _updater = null;
  }
  return _updater;
}

/**
 * Initialise auto-update if conditions are met.
 * Call once after app.whenReady().
 */
function initAutoUpdater() {
  if (!shouldCheckForUpdates()) {
    if (AUTO_UPDATE_ENABLED && !UPDATE_FEED_URL) {
      console.warn('[gomi:auto-update] enabled but GOMI_UPDATE_FEED_URL not set — skipping');
    }
    return;
  }

  const { autoUpdater } = _loadUpdater() || {};
  if (!autoUpdater) {
    console.warn('[gomi:auto-update] electron-updater not installed — skipping');
    return;
  }

  const feedHostname = new URL(UPDATE_FEED_URL).hostname;
  console.log(`[gomi:auto-update] initialised — feed host: ${feedHostname}`);

  autoUpdater.setFeedURL({ provider: 'generic', url: UPDATE_FEED_URL });
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    console.warn('[gomi:auto-update] check failed:', err.message);
  });
}

module.exports = { shouldCheckForUpdates, initAutoUpdater, AUTO_UPDATE_ENABLED, UPDATE_FEED_URL };
