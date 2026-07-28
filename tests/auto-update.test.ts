import { describe, expect, it, vi } from 'vitest';

// Mock auto-update module
vi.mock('electron-updater', () => ({
  autoUpdater: {
    setFeedURL: vi.fn(),
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: vi.fn(),
    checkForUpdates: vi.fn(() => Promise.resolve()),
  }
}), { virtual: true });

describe('auto-update stub module (bounty #29)', () => {
  it('returns disabled for non-packaged app', async () => {
    const mod = await import('../electron/auto-update.cjs');
    const app = { isPackaged: false };
    const result = mod.shouldCheckForUpdates(app);
    expect(result.shouldCheck).toBe(false);
    expect(result.reason).toBe('not-packaged');
  });

  it('returns disabled when feature flag is off', async () => {
    const mod = await import('../electron/auto-update.cjs');
    const app = { isPackaged: true };
    process.env.GOMI_AUTO_UPDATE_ENABLED = '';
    const result = mod.shouldCheckForUpdates(app);
    expect(result.shouldCheck).toBe(false);
    expect(result.reason).toBe('feature-disabled');
  });

  it('returns enabled when packaged and flag is set', async () => {
    const mod = await import('../electron/auto-update.cjs');
    const app = { isPackaged: true };
    process.env.GOMI_AUTO_UPDATE_ENABLED = '1';
    const result = mod.shouldCheckForUpdates(app);
    expect(result.shouldCheck).toBe(true);
    expect(result.reason).toBe('enabled');
  });

  it('gracefully handles missing electron-updater', async () => {
    vi.resetModules();
    // Temporarily make electron-updater unavailable
    vi.doMock('electron-updater', () => { throw new Error('not found'); });
    const mod = await import('../electron/auto-update.cjs');
    const app = { isPackaged: true };
    process.env.GOMI_AUTO_UPDATE_ENABLED = '1';
    const result = mod.initAutoUpdate(app);
    expect(result.initialized).toBe(false);
    expect(result.autoUpdater).toBeNull();
  });
});
