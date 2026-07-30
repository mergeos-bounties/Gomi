import { checkForUpdates, getUpdateStatus, onUpdateAvailable } from './auto-updater';

describe('AutoUpdater', () => {
  test('checkForUpdates returns no update in dev mode', async () => {
    const result = await checkForUpdates();
    expect(result.available).toBe(false);
    expect(result.checking).toBe(false);
    expect(result.error).toContain('not packaged');
  });

  test('getUpdateStatus returns initial state', () => {
    const status = getUpdateStatus();
    expect(status.available).toBe(false);
    expect(status.checking).toBe(false);
  });

  test('onUpdateAvailable returns unsubscribe function', () => {
    const unsub = onUpdateAvailable(() => {});
    expect(typeof unsub).toBe('function');
  });
});
