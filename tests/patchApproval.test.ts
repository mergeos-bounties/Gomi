import { describe, expect, it } from 'vitest';
import type { GomiPatchProposal } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import {
  approvePatchReview,
  canApplyPatch,
  createPatchReviewState,
  getDiffLineKind,
  markPatchApplied,
  markPatchApplying,
  rejectPatchReview
} from '../src/vs/workbench/contrib/gomi/browser/gomiPatchApproval';

const patch: GomiPatchProposal = {
  id: 'patch-1',
  filePath: 'docs/gomi-agent-plan.md',
  targetFiles: ['docs/gomi-agent-plan.md'],
  summary: 'Create a plan document.',
  diff: 'diff --git a/docs/gomi-agent-plan.md b/docs/gomi-agent-plan.md\n+hello\n-world\n@@',
  approvalStatus: 'pending',
  riskLevel: 'low',
  createdByAgentId: 'ceo'
};

describe('gomiPatchApproval', () => {
  it('requires approval before apply', () => {
    const pending = createPatchReviewState(patch);
    const approved = approvePatchReview(pending);
    const applying = markPatchApplying(approved);
    const applied = markPatchApplied(applying);

    expect(canApplyPatch(pending)).toBe(false);
    expect(canApplyPatch(approved)).toBe(true);
    expect(applying.approvalStatus).toBe('applying');
    expect(applied.approvalStatus).toBe('applied');
  });

  it('keeps rejected patches from being applied', () => {
    const rejected = rejectPatchReview(createPatchReviewState(patch));

    expect(rejected.approvalStatus).toBe('rejected');
    expect(canApplyPatch(rejected)).toBe(false);
  });

  it('classifies unified diff lines', () => {
    expect(getDiffLineKind('diff --git a/a b/a')).toBe('meta');
    expect(getDiffLineKind('@@ -1 +1 @@')).toBe('hunk');
    expect(getDiffLineKind('+added')).toBe('addition');
    expect(getDiffLineKind('-removed')).toBe('deletion');
    expect(getDiffLineKind(' context')).toBe('context');
  });
});
