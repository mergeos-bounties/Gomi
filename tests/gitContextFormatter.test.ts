import { describe, expect, it, vi } from 'vitest';
import { formatGitContext } from '../src/vs/workbench/contrib/gomi/node/gitContextFormatter';
import type { GitStatusSummary } from '../src/vs/workbench/contrib/gomi/node/gitStatusIndexer';

describe('git context formatter (bounty #30)', () => {
  it('returns unavailable message when git is null', () => {
    const result = formatGitContext(null);
    expect(result.summaryText).toContain('unavailable');
    expect(result.changesDetail).toBe('');
  });

  it('returns clean message when no changes', () => {
    const git: GitStatusSummary = {
      branch: 'main',
      status: '',
      changedFiles: 0,
      stagedFiles: 0,
      untrackedFiles: 0,
      diffSummary: '',
      hasChanges: false,
    };
    const result = formatGitContext(git);
    expect(result.summaryText).toContain('clean');
    expect(result.summaryText).toContain('main');
    expect(result.changesDetail).toBe('');
  });

  it('includes changed/staged/untracked file counts', () => {
    const git: GitStatusSummary = {
      branch: 'feature/test',
      status: ' M src/index.ts\nA  src/new.ts\n?? untracked.md',
      changedFiles: 1,
      stagedFiles: 1,
      untrackedFiles: 1,
      diffSummary: 'src/index.ts | 2 +-',
      hasChanges: true,
    };
    const result = formatGitContext(git);
    expect(result.summaryText).toContain('feature/test');
    expect(result.summaryText).toContain('Modified');
    expect(result.summaryText).toContain('Staged');
    expect(result.summaryText).toContain('Untracked');
  });

  it('builds file-level change details from status lines', () => {
    const git: GitStatusSummary = {
      branch: 'main',
      status: ' M src/index.ts\nA  src/new.ts\n?? untracked.md\nD  src/old.ts',
      changedFiles: 2,
      stagedFiles: 1,
      untrackedFiles: 1,
      diffSummary: '',
      hasChanges: true,
    };
    const result = formatGitContext(git);
    expect(result.changesDetail).toContain('modified');
    expect(result.changesDetail).toContain('added');
    expect(result.changesDetail).toContain('untracked');
    expect(result.changesDetail).toContain('src/index.ts');
    expect(result.changesDetail).toContain('src/new.ts');
  });
});
