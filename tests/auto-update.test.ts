import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock electron-updater before importing anything
vi.mock('electron-updater', () => ({
  autoUpdater: {
    setFeedURL: vi.fn(),
    autoDownload: false,
    allowDowngrade: false,
    allowPrerelease: false,
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
    on: vi.fn(),
    logger: null,
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

// Mock electron
const mockSend = vi.fn();
vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getPath: vi.fn().mockReturnValue('/tmp/gomi-test'),
    on: vi.fn(),
    whenReady: vi.fn().mockResolvedValue(undefined),
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
  },
  ipcMain: {
    handle: vi.fn(),
  },
  dialog: {
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  },
  Menu: {
    setApplicationMenu: vi.fn(),
  },
}));

describe('auto-update.cjs', () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...OLD_ENV };
    delete process.env.GOMI_AUTO_UPDATE_ENABLED;
    delete process.env.GOMI_UPDATE_FEED_URL;
    delete process.env.GOMI_AUTO_DOWNLOAD;
    delete process.env.GOMI_UPDATE_CHANNEL;
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  describe('isEnabled()', () => {
    it('returns false when GOMI_AUTO_UPDATE_ENABLED is not set', () => {
      const { isEnabled } = require('../electron/auto-update.cjs');
      expect(isEnabled()).toBe(false);
    });

    it('returns false when GOMI_AUTO_UPDATE_ENABLED is "0"', () => {
      process.env.GOMI_AUTO_UPDATE_ENABLED = '0';
      const { isEnabled } = require('../electron/auto-update.cjs');
      expect(isEnabled()).toBe(false);
    });

    it('returns true when GOMI_AUTO_UPDATE_ENABLED is "1"', () => {
      process.env.GOMI_AUTO_UPDATE_ENABLED = '1';
      const { isEnabled } = require('../electron/auto-update.cjs');
      expect(isEnabled()).toBe(true);
    });
  });

  describe('initAutoUpdater()', () => {
    it('does not throw when electron-updater is missing and env is disabled', () => {
      process.env.GOMI_AUTO_UPDATE_ENABLED = '0';
      const mod = require('../electron/auto-update.cjs');
      expect(() => mod.initAutoUpdater(null)).not.toThrow();
    });

    it('logs a message when disabled', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mod = require('../electron/auto-update.cjs');
      mod.initAutoUpdater(null);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Disabled')
      );
      spy.mockRestore();
    });

    it('skips when window is null', () => {
      process.env.GOMI_AUTO_UPDATE_ENABLED = '1';
      const mod = require('../electron/auto-update.cjs');
      expect(() => mod.initAutoUpdater(null)).not.toThrow();
    });
  });

  describe('feed URL resolution', () => {
    it('uses GOMI_UPDATE_FEED_URL if set', () => {
      process.env.GOMI_UPDATE_FEED_URL = 'https://custom.example.com/updates';
      process.env.GOMI_AUTO_UPDATE_ENABLED = '1';
      // The feed URL is passed to setFeedURL in wireAutoUpdater
      const { autoUpdater } = require('electron-updater');
      const mod = require('../electron/auto-update.cjs');
      mod.initAutoUpdater({ webContents: { send: vi.fn() }, isDestroyed: () => false });
      // autoUpdater.setFeedURL should have been called
      expect(autoUpdater.setFeedURL).toHaveBeenCalled();
    });
  });
});
