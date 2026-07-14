/**
 * Electron auto-update stub (issue #29).
 * Wires electron-updater with feature flag (off by default).
 * This is a stub — full implementation requires signing certs.
 */

import type { AppUpdater } from 'electron-updater';

export interface AutoUpdateConfig {
  enabled: boolean;
  provider: 'github' | 'generic';
  repo?: string;
  url?: string;
  channel?: string;
}

export function createAutoUpdaterStub(config: AutoUpdateConfig): AppUpdater | null {
  if (!config.enabled) return null;

  try {
    // Dynamic require — electron-updater is an optional dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { autoUpdater } = require('electron-updater');

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    if (config.provider === 'github' && config.repo) {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: config.repo.split('/')[0],
        repo: config.repo.split('/')[1],
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
    require.resolve('electron-updater');
    return true;
  } catch {
    return false;
  }
}
