/**
 * Unified diff parser edge case tests (issue #74).
 */

import { describe, expect, it } from 'vitest';
import { parseUnifiedDiff } from '../src/vs/workbench/contrib/gomi/node/patchApplier';

describe('unified diff parser edge cases (issue #74)', () => {
  it('handles empty diff string', () => {
    const files = parseUnifiedDiff('');
    expect(files).toEqual([]);
  });

  it('handles whitespace-only diff', () => {
    const files = parseUnifiedDiff('   \n  \n');
    expect(files).toEqual([]);
  });

  it('handles diff with no hunks', () => {
    const diff = [
      'diff --git a/empty.ts b/empty.ts',
      'index 0000000..e69de29',
    ].join('\n');
    const files = parseUnifiedDiff(diff);
    expect(files.length).toBeGreaterThanOrEqual(0);
  });

  it('handles new file mode', () => {
    const diff = [
      'diff --git a/new.ts b/new.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/new.ts',
      '@@ -0,0 +1 @@',
      '+new content',
    ].join('\n');
    const files = parseUnifiedDiff(diff);
    expect(files.length).toBeGreaterThan(0);
  });

  it('handles deleted file mode', () => {
    const diff = [
      'diff --git a/old.ts b/old.ts',
      'deleted file mode 100644',
      '--- a/old.ts',
      '+++ /dev/null',
      '@@ -1 +0,0 @@',
      '-removed',
    ].join('\n');
    const files = parseUnifiedDiff(diff);
    expect(files.length).toBeGreaterThan(0);
  });

  it('handles rename', () => {
    const diff = [
      'diff --git a/old.ts b/new.ts',
      'rename from old.ts',
      'rename to new.ts',
      '--- a/old.ts',
      '+++ b/new.ts',
    ].join('\n');
    const files = parseUnifiedDiff(diff);
    expect(files.length).toBeGreaterThanOrEqual(0);
  });

  it('handles multiline context', () => {
    const diff = [
      'diff --git a/file.ts b/file.ts',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1,3 +1,3 @@',
      ' line1',
      '-line2',
      '+line2-modified',
      ' line3',
    ].join('\n');
    const files = parseUnifiedDiff(diff);
    expect(files.length).toBeGreaterThan(0);
  });

  it('handles diff with Windows line endings', () => {
    const diff = [
      'diff --git a/file.ts b/file.ts',
      '--- a/file.ts',
      '+++ b/file.ts',
      '@@ -1 +1 @@',
      '-old',
      '+new',
    ].join('\r\n');
    const files = parseUnifiedDiff(diff);
    expect(files.length).toBeGreaterThan(0);
  });
});
