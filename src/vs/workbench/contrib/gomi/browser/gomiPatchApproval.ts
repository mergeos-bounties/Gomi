import type { GomiPatchApprovalStatus, GomiPatchProposal } from '../common/gomiTypes';

export type GomiDiffLineKind = 'addition' | 'deletion' | 'hunk' | 'meta' | 'context';

export interface GomiPatchReviewState {
  patch: GomiPatchProposal;
  approvalStatus: GomiPatchApprovalStatus;
  applyError?: string;
}

export function createPatchReviewState(patch: GomiPatchProposal): GomiPatchReviewState {
  return {
    patch,
    approvalStatus: patch.approvalStatus
  };
}

export function approvePatchReview(state: GomiPatchReviewState): GomiPatchReviewState {
  if (state.approvalStatus === 'applied' || state.approvalStatus === 'applying') {
    return state;
  }

  return {
    ...state,
    approvalStatus: 'approved',
    applyError: undefined
  };
}

export function rejectPatchReview(state: GomiPatchReviewState): GomiPatchReviewState {
  if (state.approvalStatus === 'applied' || state.approvalStatus === 'applying') {
    return state;
  }

  return {
    ...state,
    approvalStatus: 'rejected',
    applyError: undefined
  };
}

export function canApplyPatch(state?: GomiPatchReviewState): boolean {
  return state?.approvalStatus === 'approved';
}

export function markPatchApplying(state: GomiPatchReviewState): GomiPatchReviewState {
  if (!canApplyPatch(state)) {
    return state;
  }

  return {
    ...state,
    approvalStatus: 'applying',
    applyError: undefined
  };
}

export function markPatchApplied(state: GomiPatchReviewState): GomiPatchReviewState {
  if (state.approvalStatus !== 'applying' && state.approvalStatus !== 'approved') {
    return state;
  }

  return {
    ...state,
    approvalStatus: 'applied',
    applyError: undefined
  };
}

export function markPatchFailed(
  state: GomiPatchReviewState,
  applyError: string
): GomiPatchReviewState {
  return {
    ...state,
    approvalStatus: 'failed',
    applyError
  };
}

export function getDiffLineKind(line: string): GomiDiffLineKind {
  if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('diff --git')) {
    return 'meta';
  }

  if (line.startsWith('@@')) {
    return 'hunk';
  }

  if (line.startsWith('+')) {
    return 'addition';
  }

  if (line.startsWith('-')) {
    return 'deletion';
  }

  return 'context';
}
