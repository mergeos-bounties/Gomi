/**
 * Tests for the auto-update policy (issue #29).
 *
 * The policy gates every network call, so these cover the default-off
 * guarantee and each fail-closed path. No electron-updater required.
 */

import { describe, expect, it } from 'vitest';
import { shouldCheckForUpdates } from '../src/vs/workbench/contrib/gomi/node/autoUpdaterStub';

const available = () => true;
const unavailable = () => false;

describe('shouldCheckForUpdates', () => {
  it('a default packaged build performs no update check', () => {
    const d = shouldCheckForUpdates({ isPackaged: true }, available);
    expect(d.shouldCheck).toBe(false);
    expect(d.reason).toBe('disabled');
  });

  it('stays off when the flag is explicitly false', () => {
    expect(shouldCheckForUpdates({ enabled: false, isPackaged: true, repo: 'a/b' }, available).shouldCheck).toBe(false);
  });

  it('never checks in an unpackaged (dev or test) build', () => {
    const d = shouldCheckForUpdates({ enabled: true, repo: 'a/b' }, available);
    expect(d.shouldCheck).toBe(false);
    expect(d.reason).toBe('not-packaged');
  });

  it('refuses when enabled but no feed is configured', () => {
    const d = shouldCheckForUpdates({ enabled: true, isPackaged: true }, available);
    expect(d.shouldCheck).toBe(false);
    expect(d.reason).toBe('no-feed');
  });

  it('rejects a malformed github repo slug', () => {
    expect(shouldCheckForUpdates({ enabled: true, isPackaged: true, repo: 'notaslug' }, available).reason).toBe('no-feed');
  });

  it('requires https for a generic feed url', () => {
    const d = shouldCheckForUpdates({ enabled: true, isPackaged: true, provider: 'generic', url: 'http://example.com/feed' }, available);
    expect(d.reason).toBe('no-feed');
  });

  it('refuses when electron-updater is not installed', () => {
    const d = shouldCheckForUpdates({ enabled: true, isPackaged: true, repo: 'a/b' }, unavailable);
    expect(d.reason).toBe('updater-unavailable');
  });

  it('allows a fully configured packaged build', () => {
    const d = shouldCheckForUpdates({ enabled: true, isPackaged: true, repo: 'mergeos/Gomi' }, available);
    expect(d.shouldCheck).toBe(true);
    expect(d.reason).toBe('ok');
  });

  it('allows a generic https feed', () => {
    const d = shouldCheckForUpdates(
      { enabled: true, isPackaged: true, provider: 'generic', url: 'https://updates.example.com/' }, available);
    expect(d.shouldCheck).toBe(true);
  });

  it('treats an empty input as off', () => {
    expect(shouldCheckForUpdates().shouldCheck).toBe(false);
  });
});
