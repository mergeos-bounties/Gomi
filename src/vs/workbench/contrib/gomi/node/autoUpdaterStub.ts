/**
 * Electron auto-update stub (issue #29).
 * Wires electron-updater with feature flag (off by default).
 * This is a stub — full implementation requires signing certs.
 *
 * Note: do NOT `import type` from `electron-updater` — the package is optional
 * and not always installed in CI typecheck. Use a minimal local interface.
 */

/** Subset of electron-updater AppUpdater used by this stub. */
export interface AppUpdater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  channel?: string;
  setFeedURL(options: Record<string, unknown>): void;
  checkForUpdates?: () => Promise<unknown>;
}

export interface AutoUpdateConfig {
  enabled: boolean;
  provider: "github" | "generic";
  repo?: string;
  url?: string;
  channel?: string;
}

export function createAutoUpdaterStub(config: AutoUpdateConfig): AppUpdater | null {
  if (!config.enabled) return null;

  try {
    // Dynamic require — electron-updater is an optional dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { autoUpdater } = require("electron-updater") as { autoUpdater: AppUpdater };

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

export function isAutoUpdateAvailable(): boolean {
  try {
    require.resolve("electron-updater");
    return true;
  } catch {
    return false;
  }
}
