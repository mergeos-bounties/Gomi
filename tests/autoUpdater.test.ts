import { describe, expect, it } from 'vitest';

// We import the CJS module via a dynamic require so vitest can resolve it
// without needing to configure a CJS→ESM bridge.
const { shouldCheckForUpdates } = require('../electron/autoUpdater.cjs');

describe('autoUpdater – shouldCheckForUpdates policy', () => {
  // -----------------------------------------------------------------------
  // Default: no network
  // -----------------------------------------------------------------------

  it('returns false when neither env var is set (default packaged build)', () => {
    expect(
      shouldCheckForUpdates({ env: {}, isPackaged: true })
    ).toBe(false);
  });

  it('returns false for an unpackaged (dev) build regardless of env', () => {
    expect(
      shouldCheckForUpdates({
        env: { GOMI_AUTO_UPDATE: '1', GOMI_UPDATE_FEED_URL: 'https://updates.example.com' },
        isPackaged: false
      })
    ).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Feature flag only
  // -----------------------------------------------------------------------

  it('returns false when auto-update flag is 1 but no feed URL is set', () => {
    expect(
      shouldCheckForUpdates({
        env: { GOMI_AUTO_UPDATE: '1' },
        isPackaged: true
      })
    ).toBe(false);
  });

  it.each(['0', 'false', 'no', '', ''])(
    'returns false when GOMI_AUTO_UPDATE is "%s"',
    (val) => {
      expect(
        shouldCheckForUpdates({
          env: { GOMI_AUTO_UPDATE: val, GOMI_UPDATE_FEED_URL: 'https://updates.example.com' },
          isPackaged: true
        })
      ).toBe(false);
    }
  );

  // -----------------------------------------------------------------------
  // Feed URL only
  // -----------------------------------------------------------------------

  it('returns false when feed URL is set but the feature flag is missing', () => {
    expect(
      shouldCheckForUpdates({
        env: { GOMI_UPDATE_FEED_URL: 'https://updates.example.com' },
        isPackaged: true
      })
    ).toBe(false);
  });

  // -----------------------------------------------------------------------
  // Both set – but URL must be HTTPS
  // -----------------------------------------------------------------------

  it.each(['http://updates.example.com', 'ftp://updates.example.com', 'file:///tmp/feed'])(
    'returns false when feed URL is not HTTPS: %s',
    (url) => {
      expect(
        shouldCheckForUpdates({
          env: { GOMI_AUTO_UPDATE: '1', GOMI_UPDATE_FEED_URL: url },
          isPackaged: true
        })
      ).toBe(false);
    }
  );

  // -----------------------------------------------------------------------
  // Happy path
  // -----------------------------------------------------------------------

  it('returns true when both env vars are set correctly on a packaged build', () => {
    expect(
      shouldCheckForUpdates({
        env: {
          GOMI_AUTO_UPDATE: '1',
          GOMI_UPDATE_FEED_URL: 'https://updates.example.com/releases'
        },
        isPackaged: true
      })
    ).toBe(true);
  });

  it.each(['1', 'true', 'TRUE', 'yes', 'Yes'])(
    'accepts "%s" as a truthy GOMI_AUTO_UPDATE value',
    (val) => {
      expect(
        shouldCheckForUpdates({
          env: {
            GOMI_AUTO_UPDATE: val,
            GOMI_UPDATE_FEED_URL: 'https://updates.example.com'
          },
          isPackaged: true
        })
      ).toBe(true);
    }
  );

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('trims whitespace from env values', () => {
    expect(
      shouldCheckForUpdates({
        env: {
          GOMI_AUTO_UPDATE: '  1  ',
          GOMI_UPDATE_FEED_URL: '  https://updates.example.com  '
        },
        isPackaged: true
      })
    ).toBe(true);
  });

  it('returns false when feed URL is set but empty', () => {
    expect(
      shouldCheckForUpdates({
        env: { GOMI_AUTO_UPDATE: '1', GOMI_UPDATE_FEED_URL: '   ' },
        isPackaged: true
      })
    ).toBe(false);
  });
});
