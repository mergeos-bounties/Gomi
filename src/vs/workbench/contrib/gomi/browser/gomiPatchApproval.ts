import type { GomiPatchApprovalStatus, GomiPatchPreviewResult, GomiPatchProposal } from '../common/gomiTypes';

export type GomiDiffLineKind = 'addition' | 'deletion' | 'hunk' | 'meta' | 'context';
export type GomiPatchPreviewStatus = 'idle' | 'opening' | 'opened' | 'failed';

export interface GomiPatchReviewState {
  patch: GomiPatchProposal;
  approvalStatus: GomiPatchApprovalStatus;
  applyError?: string;
  previewStatus: GomiPatchPreviewStatus;
  previewError?: string;
  previewedFiles: string[];
}

export function createPatchReviewState(patch: GomiPatchProposal): GomiPatchReviewState {
  return {
    patch,
    approvalStatus: patch.approvalStatus,
    previewStatus: 'idle',
    previewedFiles: []
  };
}

export function approvePatchReview(state: GomiPatchReviewState): GomiPatchReviewState {
  if (state.approvalStatus === 'applied' || state.approvalStatus === 'applying') {
    return state;
  }

  return {
    ...state,
    approvalStatus: 'approved',
    applyError: undefined,
    previewError: undefined
  };
}

export function rejectPatchReview(state: GomiPatchReviewState): GomiPatchReviewState {
  if (state.approvalStatus === 'applied' || state.approvalStatus === 'applying') {
    return state;
  }

  return {
    ...state,
    approvalStatus: 'rejected',
    applyError: undefined,
    previewError: undefined
  };
}

export function canApplyPatch(
  state?: GomiPatchReviewState,
  options: {
    requirePreview?: boolean;
  } = {}
): boolean {
  return state?.approvalStatus === 'approved' && (!options.requirePreview || state.previewStatus === 'opened');
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

export function markPatchPreviewOpening(state: GomiPatchReviewState): GomiPatchReviewState {
  if (state.approvalStatus !== 'approved') {
    return state;
  }

  return {
    ...state,
    previewStatus: 'opening',
    previewError: undefined,
    previewedFiles: []
  };
}

export function markPatchPreviewOpened(
  state: GomiPatchReviewState,
  result: GomiPatchPreviewResult
): GomiPatchReviewState {
  if (state.patch.id !== result.patchId || state.approvalStatus !== 'approved') {
    return state;
  }

  return {
    ...state,
    previewStatus: 'opened',
    previewError: undefined,
    previewedFiles: result.previewedFiles
  };
}

export function markPatchPreviewFailed(
  state: GomiPatchReviewState,
  previewError: string
): GomiPatchReviewState {
  if (state.approvalStatus !== 'approved') {
    return state;
  }

  return {
    ...state,
    previewStatus: 'failed',
    previewError,
    previewedFiles: []
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
