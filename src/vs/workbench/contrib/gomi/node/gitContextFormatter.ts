/**
 * Git context formatter for workspace context chunks (bounty #30).
 * Enriches git status / SCM diff summary into structured text for AI agents.
 */

import type { GitStatusSummary } from './gitStatusIndexer';

export interface FormattedGitContext {
  /** High-level summary text for the git-summary chunk */
  summaryText: string;
  /** Detailed file-level changes for a dedicated git-changes chunk */
  changesDetail: string;
}

/**
 * Formats a GitStatusSummary into structured text.
 *
 * @param git - The git status summary from the indexer
 * @returns Formatted git context with summary and detailed changes
 */
export function formatGitContext(git: GitStatusSummary | null): FormattedGitContext {
  if (!git) {
    return {
      summaryText: 'Git: unavailable (not a git repository or git not installed)',
      changesDetail: '',
    };
  }

  if (!git.hasChanges) {
    return {
      summaryText: `Git: clean working tree on branch "${git.branch}"`,
      changesDetail: '',
    };
  }

  const summaryText = buildSummaryText(git);
  const changesDetail = buildChangesDetail(git);

  return { summaryText, changesDetail };
}

function buildSummaryText(git: GitStatusSummary): string {
  const parts: string[] = [`Branch: ${git.branch}`];

  if (git.changedFiles > 0) {
    parts.push(`Modified (unstaged): ${git.changedFiles} file(s)`);
  }
  if (git.stagedFiles > 0) {
    parts.push(`Staged: ${git.stagedFiles} file(s)`);
  }
  if (git.untrackedFiles > 0) {
    parts.push(`Untracked: ${git.untrackedFiles} file(s)`);
  }
  if (git.diffSummary) {
    parts.push(`\nDiff summary:\n${git.diffSummary}`);
  }

  return `Git status — ${parts.join(' | ')}`;
}

function buildChangesDetail(git: GitStatusSummary): string {
  const lines = git.status.split('\n').filter(Boolean);
  const fileEntries: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('??')) {
      fileEntries.push(`[untracked] ${trimmed.slice(2).trim()}`);
    } else if (trimmed.startsWith('!!')) {
      // Ignored, skip
    } else {
      const xy = trimmed.replace(/\s+/g, ' ').split(' ', 2);
      const stagedIdx = xy[0]?.charAt(0) ?? ' ';
      const worktreeIdx = xy[0]?.charAt(1) ?? ' ';
      const filePath = xy.slice(1).join(' ');

      const statusLabel = getStatusLabel(stagedIdx, worktreeIdx);
      fileEntries.push(`[${statusLabel}] ${filePath}`);
    }
  }

  if (fileEntries.length === 0) {
    return '';
  }

  return `Changed files (${fileEntries.length} total):\n${fileEntries.join('\n')}`;
}

function getStatusLabel(stagedIdx: string, worktreeIdx: string): string {
  const staged = decodeStatusChar(stagedIdx);
  const worktree = decodeStatusChar(worktreeIdx);

  if (staged && worktree) return `${staged}+${worktree}`;
  if (staged) return staged;
  if (worktree) return worktree;
  return 'modified';
}

function decodeStatusChar(ch: string): string {
  switch (ch) {
    case 'M': return 'modified';
    case 'A': return 'added';
    case 'D': return 'deleted';
    case 'R': return 'renamed';
    case 'C': return 'copied';
    case 'U': return 'updated';
    case '?': return 'untracked';
    default: return '';
  }
}
