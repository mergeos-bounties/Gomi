/**
 * Git status indexer (issue #30).
 * Captures git status and SCM diff summary for workspace context chunks.
 */

import { execSync } from 'node:child_process';

export interface GitStatusSummary {
  branch: string;
  status: string;
  changedFiles: number;
  stagedFiles: number;
  untrackedFiles: number;
  diffSummary: string;
  hasChanges: boolean;
}

export function getGitStatusSummary(cwd?: string): GitStatusSummary | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000,
    }).trim();

    const status = execSync('git status --porcelain', {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000,
    });

    const lines = status.trim().split('\n').filter(Boolean);
    let stagedFiles = 0;
    let changedFiles = 0;
    let untrackedFiles = 0;

    for (const line of lines) {
      const idx = line.charAt(2);
      if (idx === ' ') changedFiles++;
      else if (idx !== ' ') stagedFiles++;
      if (line.startsWith('??')) untrackedFiles++;
    }

    let diffSummary = '';
    try {
      diffSummary = execSync('git diff --stat', {
        cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000,
      }).trim();
    } catch {
      // No diff to show
    }

    return {
      branch,
      status: status.trim(),
      changedFiles,
      stagedFiles,
      untrackedFiles,
      diffSummary,
      hasChanges: lines.length > 0,
    };
  } catch {
    return null;
  }
}
