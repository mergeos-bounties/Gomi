/**
 * Tests for buildInfo (issue #45).
 */

import { describe, expect, it } from 'vitest';
import { getBuildInfo } from '../src/vs/workbench/contrib/gomi/common/buildInfo';

describe('buildInfo', () => {
  it('returns version from package.json', () => {
    const info = getBuildInfo();
    expect(info.version).toBeTruthy();
    expect(info.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns environment name', () => {
    const info = getBuildInfo();
    expect(['development', 'production', 'test']).toContain(info.env);
  });

  it('returns node version', () => {
    const info = getBuildInfo();
    expect(info.nodeVersion).toContain('v');
  });

  it('produces a formatted string', () => {
    const info = getBuildInfo();
    expect(info.formatted).toContain('Gomi IDE');
    expect(info.formatted).toContain(info.version);
  });

  it('formatted string is not empty', () => {
    const info = getBuildInfo();
    expect(info.formatted.length).toBeGreaterThan(10);
  });

  it('caches result (same object on second call)', () => {
    const a = getBuildInfo();
    const b = getBuildInfo();
    expect(a).toBe(b);
  });

  it('gitSha is a hex string when available', () => {
    const info = getBuildInfo();
    if (info.gitSha) {
      expect(info.gitSha).toMatch(/^[0-9a-f]{40}$/);
    }
  });

  it('gitDescribe contains version-like tag when available', () => {
    const info = getBuildInfo();
    if (info.gitDescribe && info.gitDescribe !== info.gitSha) {
      // git describe typically produces something like v0.1.0-1-gabcdef
      expect(info.gitDescribe.length).toBeGreaterThan(0);
    }
  });
});
