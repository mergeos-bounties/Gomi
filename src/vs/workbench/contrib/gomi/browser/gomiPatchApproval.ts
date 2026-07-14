import type { GomiPatchApprovalStatus, GomiPatchPreviewResult, GomiPatchProposal, GomiPatchRiskLevel } from '../common/gomiTypes';

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

// ── Patch approval queue filters ────────────────────────────────────────────

export function filterPatchesByFilePath(
  patches: GomiPatchReviewState[],
  query: string,
): GomiPatchReviewState[] {
  if (!query.trim()) {
    return patches;
  }
  const q = query.toLowerCase().trim();
  return patches.filter((state) => {
    const fp = state.patch.filePath.toLowerCase();
    const tfs = state.patch.targetFiles.map((f) => f.toLowerCase());
    return fp.includes(q) || tfs.some((tf) => tf.includes(q));
  });
}

export function filterPatchesByRiskLevel(
  patches: GomiPatchReviewState[],
  riskLevel: GomiPatchRiskLevel | 'all',
): GomiPatchReviewState[] {
  if (riskLevel === 'all') {
    return patches;
  }
  return patches.filter((state) => state.patch.riskLevel === riskLevel);
}

export function filterPendingPatches(
  patches: GomiPatchReviewState[],
  options: {
    filePathQuery?: string;
    riskLevel?: GomiPatchRiskLevel | 'all';
  } = {},
): GomiPatchReviewState[] {
  let result = patches.filter(
    (state) =>
      state.approvalStatus === 'pending' ||
      state.approvalStatus === 'idle',
  );

  if (options.filePathQuery) {
    result = filterPatchesByFilePath(result, options.filePathQuery);
  }

  if (options.riskLevel && options.riskLevel !== 'all') {
    result = filterPatchesByRiskLevel(result, options.riskLevel);
  }

  return result;
}
