import { describe, expect, it } from 'vitest';
import { analyzePatchRisk } from '../src/vs/workbench/contrib/gomi/common/patchRiskSummary';

const smallDiff = [
  'diff --git a/src/index.ts b/src/index.ts',
  '--- a/src/index.ts',
  '+++ b/src/index.ts',
  '@@ -1,3 +1,4 @@',
  ' import x from "y";',
  '+import z from "w";',
  ' const a = 1;',
  '-const b = 2;',
].join('\n');

describe('patchRiskSummary', () => {
  it('detects small changes as low risk', () => {
    const r = analyzePatchRisk(smallDiff);
    expect(r.riskScore).toBe('low');
    expect(r.addedLines).toBe(1);
    expect(r.removedLines).toBe(1);
  });

  it('flags sensitive paths as high risk', () => {
    const r = analyzePatchRisk(smallDiff, ['.env']);
    expect(r.riskScore).toBe('high');
    expect(r.sensitivePaths).toContain('.env');
  });

  it('flags large changes as high risk', () => {
    const lines = ['diff --git a/x.ts b/x.ts', '--- a/x.ts', '+++ b/x.ts', '@@ -1,1 +1,200 @@'];
    for (let i = 0; i < 250; i++) lines.push(`+line ${i}`);
    const r = analyzePatchRisk(lines.join('\n'));
    expect(r.riskScore).toBe('high');
  });

  it('produces a human-readable summary', () => {
    const r = analyzePatchRisk(smallDiff);
    expect(r.summary).toContain('low');
    expect(r.summary).toContain('file');
  });

  it('handles empty diff', () => {
    const r = analyzePatchRisk('');
    expect(r.totalFiles).toBe(0);
    expect(r.riskScore).toBe('low');
  });
});
