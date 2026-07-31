// @ts-check
"use strict";

/**
 * @file Auto-update module for Gomi IDE.
 * Powered by electron-updater (optional dependency).
 * Feature-gated behind GOMI_AUTO_UPDATE_ENABLED (default: "0" = off).
 *
 * ## Configuration
 *
 * | Variable                     | Default                    | Description                          |
 * |-----------------------------|----------------------------|--------------------------------------|
 * | GOMI_AUTO_UPDATE_ENABLED     | "0"                        | "1" to enable the updater            |
 * | GOMI_UPDATE_FEED_URL         | (platform-specific)        | Override the update feed URL         |
 * | GOMI_AUTO_DOWNLOAD           | "1"                        | "0" to prompt before downloading     |
 * | GOMI_UPDATE_CHANNEL          | "latest"                   | Release channel (latest/beta/alpha)  |
 *
 * ## IPC Channels (Renderer ↔ Main)
 *
 * | Channel                          | Direction  | Payload                                    |
 * |----------------------------------|-----------|---------------------------------------------|
 * | gomi:update:check                | renderer→ | —                                           |
 * | gomi:update:status               | main→     | {state, info?, error?, progress?}            |
 * | gomi:update:download-progress    | main→     | {percent, transferred, total, bytesPerSecond}|
 * | gomi:update:quit-and-install     | renderer→ | —                                           |
 */

const { autoUpdater } = require("electron-updater");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");

// ---------------------------------------------------------------------------
// Feature gate
// ---------------------------------------------------------------------------

function isEnabled() {
  return process.env.GOMI_AUTO_UPDATE_ENABLED === "1";
}

// ---------------------------------------------------------------------------
// Feed URL resolution
// ---------------------------------------------------------------------------

function resolveFeedUrl() {
  const override = process.env.GOMI_UPDATE_FEED_URL;
  if (override) return override;

  const channel = process.env.GOMI_UPDATE_CHANNEL || "latest";
  const platform = process.platform; // darwin | win32 | linux
  const arch = process.arch;         // x64 | arm64

  // Per-platform feeds — override for real deployment
  const base = "https://updates.gomi.dev";
  const feeds = {
    darwin: `${base}/mac/${channel}/${arch}`,
    win32: `${base}/win/${channel}/${arch}`,
    linux: `${base}/linux/${channel}/${arch}`,
  };

  return feeds[platform] || feeds.linux;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** @type {BrowserWindow | null} */
let mainWindow = null;
let autoDownload = process.env.GOMI_AUTO_DOWNLOAD !== "0";

// ---------------------------------------------------------------------------
// IPC registration
// ---------------------------------------------------------------------------

function registerIpc() {
  ipcMain.handle("gomi:update:check", async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      sendStatus("error", { error: String(err) });
    }
  });

  ipcMain.handle("gomi:update:quit-and-install", () => {
    setImmediate(() => autoUpdater.quitAndInstall(false, true));
  });
}

// ---------------------------------------------------------------------------
// Send status to renderer
// ---------------------------------------------------------------------------

/**
 * @param {"checking"|"available"|"not-available"|"downloading"|"downloaded"|"error"} state
 * @param {object} [extra]
 */
function sendStatus(state, extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("gomi:update:status", { state, ...extra });
  }
}

// ---------------------------------------------------------------------------
// Auto-updater event wiring
// ---------------------------------------------------------------------------

function wireAutoUpdater() {
  autoUpdater.autoDownload = autoDownload;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = process.env.GOMI_UPDATE_CHANNEL !== "latest";

  const feedUrl = resolveFeedUrl();
  autoUpdater.setFeedURL(feedUrl);

  // Internal logger — writes to app data for diagnostics
  const logDir = path.join(app.getPath("userData"), "logs");
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch (_) { /* best effort */ }

  const log = (/** @type {string} */ msg) => {
    const ts = new Date().toISOString();
    const line = `[${ts}] ${msg}\n`;
    try {
      fs.appendFileSync(path.join(logDir, "auto-update.log"), line, "utf-8");
    } catch (_) { /* best effort */ }
  };

  autoUpdater.logger = {
    info: log,
    warn: log,
    error: log,
    debug: log,
    verbose: log,
    silly: log,
    http: log,
  };

  autoUpdater.on("checking-for-update", () => {
    sendStatus("checking");
  });

  autoUpdater.on("update-available", (info) => {
    sendStatus("available", { info });
    log(`Update available: ${info.version}`);
  });

  autoUpdater.on("update-not-available", (info) => {
    sendStatus("not-available", { info });
  });

  autoUpdater.on("download-progress", (progress) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("gomi:update:download-progress", {
        percent: Math.round(progress.percent),
        transferred: progress.transferred,
        total: progress.total,
        bytesPerSecond: progress.bytesPerSecond,
      });
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendStatus("downloaded", { info });
    log(`Update downloaded: ${info.version}`);

    if (!autoDownload) {
      // Prompt user before installing
      if (mainWindow && !mainWindow.isDestroyed()) {
        dialog
          .showMessageBox(mainWindow, {
            type: "info",
            title: "Update Ready",
            message: `Gomi IDE ${info.version} is ready. Restart now to apply?`,
            buttons: ["Restart Now", "Later"],
            defaultId: 0,
          })
          .then(({ response }) => {
            if (response === 0) {
              setImmediate(() => autoUpdater.quitAndInstall(false, true));
            }
          });
      }
    }
  });

  autoUpdater.on("error", (err) => {
    sendStatus("error", { error: String(err) });
    log(`Error: ${err.message}`);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the auto-updater. Call once after the main window is created.
 * @param {BrowserWindow} window
 */
function initAutoUpdater(window) {
  if (!isEnabled()) {
    console.log("[gomi:auto-update] Disabled — set GOMI_AUTO_UPDATE_ENABLED=1 to enable.");
    return;
  }

  try {
    require.resolve("electron-updater");
  } catch (_) {
    console.warn("[gomi:auto-update] electron-updater is not installed — skipping.");
    return;
  }

  mainWindow = window;
  wireAutoUpdater();
  registerIpc();

  // Check for updates on startup (after a short delay to avoid blocking startup)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      sendStatus("error", { error: String(err) });
    });
  }, 10_000);

  // Periodic check every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => { /* silent */ });
  }, 4 * 60 * 60 * 1000);
}

module.exports = { initAutoUpdater, isEnabled };
