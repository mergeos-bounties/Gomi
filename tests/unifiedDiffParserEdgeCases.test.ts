import { describe, expect, it } from 'vitest';
import { applyParsedPatchFile, parseUnifiedDiff } from '../src/vs/workbench/contrib/gomi/common/gomiUnifiedDiff';

describe('parseUnifiedDiff edge cases', () => {
  it('parses CRLF diffs with timestamped headers and no-newline markers', () => {
    const [file] = parseUnifiedDiff(
      [
        'diff --git a/src/app.ts b/src/app.ts',
        '--- a/src/app.ts\t2026-07-14 10:00:00 +0800',
        '+++ b/src/app.ts\t2026-07-14 10:01:00 +0800',
        '@@ -1,2 +1,2 @@',
        ' export const name = "Gomi";',
        '-export const mode = "demo";',
        '\\ No newline at end of file',
        '+export const mode = "office";',
        '\\ No newline at end of file'
      ].join('\r\n')
    );

    expect(file.oldPath).toBe('src/app.ts');
    expect(file.newPath).toBe('src/app.ts');
    expect(file.hunks).toHaveLength(1);
    expect(file.hunks[0].lines).toEqual([
      { kind: 'context', content: 'export const name = "Gomi";' },
      { kind: 'deletion', content: 'export const mode = "demo";' },
      { kind: 'addition', content: 'export const mode = "office";' }
    ]);
  });

  it('keeps paths with spaces while stripping git header prefixes', () => {
    const [file] = parseUnifiedDiff(
      [
        'diff --git a/docs/agent plan.md b/docs/agent plan.md',
        '--- a/docs/agent plan.md',
        '+++ b/docs/agent plan.md',
        '@@ -1 +1 @@',
        '-old plan',
        '+new plan'
      ].join('\n')
    );

    expect(file.oldPath).toBe('docs/agent plan.md');
    expect(file.newPath).toBe('docs/agent plan.md');
  });

  it('parses multiple files including deleted files', () => {
    const files = parseUnifiedDiff(
      [
        'diff --git a/src/keep.ts b/src/keep.ts',
        '--- a/src/keep.ts',
        '+++ b/src/keep.ts',
        '@@ -1 +1 @@',
        '-export const value = 1;',
        '+export const value = 2;',
        'diff --git a/docs/old.md b/docs/old.md',
        'deleted file mode 100644',
        '--- a/docs/old.md',
        '+++ /dev/null',
        '@@ -1,2 +0,0 @@',
        '-# Old',
        '-Remove this document.'
      ].join('\n')
    );

    expect(files).toHaveLength(2);
    expect(files[0].newPath).toBe('src/keep.ts');
    expect(files[1].oldPath).toBe('docs/old.md');
    expect(files[1].newPath).toBeUndefined();
    expect(files[1].hunks[0].lines.every((line) => line.kind === 'deletion')).toBe(true);
  });

  it('applies an insertion-only hunk at the start of a file', () => {
    const [file] = parseUnifiedDiff(
      [
        'diff --git a/README.md b/README.md',
        '--- a/README.md',
        '+++ b/README.md',
        '@@ -0,0 +1,2 @@',
        '+# Gomi',
        '+Regression tests'
      ].join('\n')
    );

    expect(applyParsedPatchFile('', file)).toBe('# Gomi\nRegression tests\n');
  });
});
