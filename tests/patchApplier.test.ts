import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GomiPatchProposal } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import {
  applyParsedPatchFile,
  parseUnifiedDiff
} from '../src/vs/workbench/contrib/gomi/node/patchApplier';
import { applyPatchProposalToWorkspace } from '../src/vs/workbench/contrib/gomi/node/workspacePatchApplier';

let workspaceRoot: string;

beforeEach(async () => {
  workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gomi-patch-'));
});

afterEach(async () => {
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

describe('patchApplier', () => {
  it('parses and applies a unified diff to text', () => {
    const [file] = parseUnifiedDiff(
      [
        'diff --git a/src/app.ts b/src/app.ts',
        '--- a/src/app.ts',
        '+++ b/src/app.ts',
        '@@ -1,3 +1,3 @@',
        ' export const name = "Gomi";',
        '-export const mode = "demo";',
        '+export const mode = "office";',
        ' export const ready = true;'
      ].join('\n')
    );

    const result = applyParsedPatchFile(
      ['export const name = "Gomi";', 'export const mode = "demo";', 'export const ready = true;', ''].join(
        '\n'
      ),
      file
    );

    expect(result).toContain('export const mode = "office";');
    expect(result).not.toContain('export const mode = "demo";');
  });

  it('writes an approved patch inside the workspace', async () => {
    await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(workspaceRoot, 'src', 'app.ts'),
      'export const name = "Gomi";\nexport const mode = "demo";\n',
      'utf8'
    );

    const result = await applyPatchProposalToWorkspace(
      createPatch({
        diff: [
          'diff --git a/src/app.ts b/src/app.ts',
          '--- a/src/app.ts',
          '+++ b/src/app.ts',
          '@@ -1,2 +1,2 @@',
          ' export const name = "Gomi";',
          '-export const mode = "demo";',
          '+export const mode = "office";'
        ].join('\n')
      }),
      workspaceRoot
    );
    const content = await fs.readFile(path.join(workspaceRoot, 'src', 'app.ts'), 'utf8');

    expect(result.appliedFiles).toEqual(['src/app.ts']);
    expect(content).toContain('export const mode = "office";');
  });

  it('creates new files and supports dry-run without writing', async () => {
    const patch = createPatch({
      diff: [
        'diff --git a/docs/plan.md b/docs/plan.md',
        'new file mode 100644',
        '--- /dev/null',
        '+++ b/docs/plan.md',
        '@@ -0,0 +1,2 @@',
        '+# Gomi Plan',
        '+Patch application is reviewed first.'
      ].join('\n')
    });

    const dryRun = await applyPatchProposalToWorkspace(patch, workspaceRoot, { dryRun: true });
    const existsAfterDryRun = await fileExists(path.join(workspaceRoot, 'docs', 'plan.md'));
    const applied = await applyPatchProposalToWorkspace(patch, workspaceRoot);
    const content = await fs.readFile(path.join(workspaceRoot, 'docs', 'plan.md'), 'utf8');

    expect(dryRun.dryRun).toBe(true);
    expect(existsAfterDryRun).toBe(false);
    expect(applied.appliedFiles).toEqual(['docs/plan.md']);
    expect(content).toContain('# Gomi Plan');
  });

  it('rejects unapproved patches and paths outside the workspace', async () => {
    await expect(
      applyPatchProposalToWorkspace(
        createPatch({
          approvalStatus: 'pending',
          diff: [
            'diff --git a/docs/plan.md b/docs/plan.md',
            '--- /dev/null',
            '+++ b/docs/plan.md',
            '@@ -0,0 +1 @@',
            '+hello'
          ].join('\n')
        }),
        workspaceRoot
      )
    ).rejects.toThrow('must be approved');

    await expect(
      applyPatchProposalToWorkspace(
        createPatch({
          diff: [
            'diff --git a/../outside.txt b/../outside.txt',
            '--- /dev/null',
            '+++ b/../outside.txt',
            '@@ -0,0 +1 @@',
            '+escape'
          ].join('\n')
        }),
        workspaceRoot
      )
    ).rejects.toThrow('escapes the workspace root');
  });
});

function createPatch(overrides: Partial<GomiPatchProposal>): GomiPatchProposal {
  return {
    id: 'patch-test',
    filePath: 'docs/plan.md',
    targetFiles: ['docs/plan.md'],
    summary: 'Test patch.',
    diff: '',
    approvalStatus: 'approved',
    riskLevel: 'low',
    createdByAgentId: 'ceo',
    ...overrides
  };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}
