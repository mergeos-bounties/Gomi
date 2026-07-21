import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const electronDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'electron');
const { shouldCheckForUpdates } = require(path.join(electronDir, 'shouldCheckForUpdates.cjs')) as {
  shouldCheckForUpdates: (options: {
    isPackaged: boolean;
    env?: Record<string, string | undefined>;
    updateFeedUrl?: string | null;
  }) => { allowed: boolean; reason: string; feedUrl?: string };
};

describe('shouldCheckForUpdates', () => {
  it('never allows update checks when unpackaged (dev)', () => {
    const result = shouldCheckForUpdates({
      isPackaged: false,
      env: {
        GOMI_AUTO_UPDATE: '1',
        GOMI_UPDATE_FEED_URL: 'https://updates.example.com/gomi'
      }
    });

    expect(result).toEqual({
      allowed: false,
      reason: 'not-packaged'
    });
  });

  it('defaults packaged builds to no network check (flag off)', () => {
    expect(
      shouldCheckForUpdates({
        isPackaged: true,
        env: {}
      })
    ).toEqual({
      allowed: false,
      reason: 'flag-disabled'
    });

    expect(
      shouldCheckForUpdates({
        isPackaged: true,
        env: {
          GOMI_AUTO_UPDATE: '0',
          GOMI_UPDATE_FEED_URL: 'https://updates.example.com/gomi'
        }
      }).allowed
    ).toBe(false);
  });

  it('requires both opt-in flag and an HTTPS feed URL', () => {
    expect(
      shouldCheckForUpdates({
        isPackaged: true,
        env: { GOMI_AUTO_UPDATE: '1' }
      })
    ).toEqual({
      allowed: false,
      reason: 'missing-feed-url'
    });

    expect(
      shouldCheckForUpdates({
        isPackaged: true,
        env: {
          GOMI_AUTO_UPDATE: 'true',
          GOMI_UPDATE_FEED_URL: 'http://insecure.example.com/feed'
        }
      })
    ).toEqual({
      allowed: false,
      reason: 'feed-url-not-https'
    });

    expect(
      shouldCheckForUpdates({
        isPackaged: true,
        env: {
          GOMI_AUTO_UPDATE: 'yes',
          GOMI_UPDATE_FEED_URL: 'file:///tmp/updates'
        }
      }).reason
    ).toBe('feed-url-not-https');
  });

  it('allows a packaged check only when flag is on and feed is https', () => {
    const result = shouldCheckForUpdates({
      isPackaged: true,
      env: {
        GOMI_AUTO_UPDATE: '1',
        GOMI_UPDATE_FEED_URL: 'https://updates.example.com/gomi/'
      }
    });

    expect(result).toEqual({
      allowed: true,
      reason: 'enabled',
      feedUrl: 'https://updates.example.com/gomi/'
    });
  });

  it('prefers explicit updateFeedUrl option over env', () => {
    const result = shouldCheckForUpdates({
      isPackaged: true,
      env: {
        GOMI_AUTO_UPDATE: '1',
        GOMI_UPDATE_FEED_URL: 'https://env.example.com/feed'
      },
      updateFeedUrl: 'https://option.example.com/feed'
    });

    expect(result.allowed).toBe(true);
    expect(result.feedUrl).toBe('https://option.example.com/feed');
  });
});
