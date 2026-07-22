import { describe, it } from 'vitest';
import * as assert from 'assert';
import {
  createPatchReviewState,
  filterPatchesByFilePath,
  filterPatchesByRiskLevel,
  filterPendingPatches,
  type GomiPatchReviewState,
} from './gomiPatchApproval';
import type { GomiPatchProposal } from '../common/gomiTypes';

function makePatch(id: string, filePath: string, targetFiles: string[], riskLevel: 'low' | 'medium' | 'high' = 'low', status: 'pending' | 'approved' | 'rejected' | 'applied' = 'pending'): GomiPatchProposal {
  return {
    id,
    filePath,
    targetFiles,
    summary: `Patch ${id}`,
    diff: `--- a/${filePath}\n+++ b/${filePath}\n+test`,
    approvalStatus: status,
    riskLevel,
    createdByAgentId: 'agent-1',
  };
}

function review(p: GomiPatchProposal): GomiPatchReviewState {
  return createPatchReviewState(p);
}

const patches: GomiPatchReviewState[] = [
  review(makePatch('1', 'src/main.ts', ['src/main.ts'], 'high', 'pending')),
  review(makePatch('2', 'src/utils/helper.ts', ['src/utils/helper.ts', 'src/utils/types.ts'], 'low', 'pending')),
  review(makePatch('3', 'README.md', ['README.md'], 'low', 'approved')),
  review(makePatch('4', 'src/components/Button.tsx', ['src/components/Button.tsx'], 'medium', 'pending')),
  review(makePatch('5', 'package.json', ['package.json'], 'high', 'applied')),
];

describe('filterPatchesByFilePath', () => {
  it('returns all patches for empty query', () => {
    assert.strictEqual(filterPatchesByFilePath(patches, '').length, 5);
    assert.strictEqual(filterPatchesByFilePath(patches, '  ').length, 5);
  });

  it('filters by file path substring', () => {
    const result = filterPatchesByFilePath(patches, 'main.ts');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].patch.id, '1');
  });

  it('matches target files too', () => {
    const result = filterPatchesByFilePath(patches, 'types.ts');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].patch.id, '2');
  });

  it('case insensitive', () => {
    const result = filterPatchesByFilePath(patches, 'README.MD');
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].patch.id, '3');
  });

  it('src/ matches multiple', () => {
    const result = filterPatchesByFilePath(patches, 'src/');
    assert.strictEqual(result.length, 3);
  });
});

describe('filterPatchesByRiskLevel', () => {
  it('all returns all patches', () => {
    assert.strictEqual(filterPatchesByRiskLevel(patches, 'all').length, 5);
  });

  it('filters by risk level', () => {
    const result = filterPatchesByRiskLevel(patches, 'high');
    assert.strictEqual(result.length, 2);
  });

  it('low returns low-risk patches', () => {
    const result = filterPatchesByRiskLevel(patches, 'low');
    assert.strictEqual(result.length, 2);
  });
});

describe('filterPendingPatches', () => {
  it('only returns pending or idle patches', () => {
    const result = filterPendingPatches(patches);
    assert.strictEqual(result.length, 3);
    assert(result.every((p) => p.approvalStatus === 'pending'));
  });

  it('filters pending by file path', () => {
    const result = filterPendingPatches(patches, { filePathQuery: 'src/' });
    assert.strictEqual(result.length, 2);
  });

  it('filters pending by risk level', () => {
    const result = filterPendingPatches(patches, { riskLevel: 'high' });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].patch.id, '1');
  });

  it('combined filter', () => {
    const result = filterPendingPatches(patches, {
      filePathQuery: 'src/',
      riskLevel: 'low',
    });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].patch.id, '2');
  });
});
