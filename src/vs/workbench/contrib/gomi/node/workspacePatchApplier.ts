import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { GomiPatchProposal } from '../common/gomiTypes';
import { applyParsedPatchFile, parseUnifiedDiff } from './patchApplier';

export interface GomiPatchApplyOptions {
  dryRun?: boolean;
  requireApproval?: boolean;
  authorize?: boolean;
}

export interface GomiPatchApplyResult {
  patchId: string;
  dryRun: boolean;
  appliedFiles: string[];
  deletedFiles: string[];
}

export async function applyPatchProposalToWorkspace(
  patch: GomiPatchProposal,
  workspaceRoot: string,
  options: GomiPatchApplyOptions = {}
): Promise<GomiPatchApplyResult> {
  const requireApproval = options.requireApproval ?? true;

  if (requireApproval && options.authorize !== true && patch.approvalStatus !== 'approved') {
    throw new Error(`Patch ${patch.id} must be approved before it can be applied.`);
  }

  const parsedFiles = parseUnifiedDiff(patch.diff);
  const appliedFiles: string[] = [];
  const deletedFiles: string[] = [];

  for (const parsedFile of parsedFiles) {
    const targetPath = parsedFile.newPath ?? parsedFile.oldPath;

    if (!targetPath) {
      throw new Error('Patch file is missing both old and new paths.');
    }

    const absolutePath = await resolveWorkspacePatchPathSafe(workspaceRoot, targetPath);
    const existingContent = await readTextFileIfExists(absolutePath);
    const nextContent = applyParsedPatchFile(existingContent, parsedFile);

    if (parsedFile.newPath === undefined) {
      deletedFiles.push(toPortableRelativePath(workspaceRoot, absolutePath));

      if (!options.dryRun) {
        await fs.rm(absolutePath, { force: true });
      }

      continue;
    }

    appliedFiles.push(toPortableRelativePath(workspaceRoot, absolutePath));

    if (!options.dryRun) {
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, nextContent, 'utf8');
    }

    const isRename =
      parsedFile.oldPath !== undefined &&
      parsedFile.newPath !== undefined &&
      parsedFile.oldPath !== parsedFile.newPath;

    if (isRename && parsedFile.oldPath) {
      const oldAbsolutePath = await resolveWorkspacePatchPathSafe(workspaceRoot, parsedFile.oldPath);
      deletedFiles.push(toPortableRelativePath(workspaceRoot, oldAbsolutePath));

      if (!options.dryRun) {
        await fs.rm(oldAbsolutePath, { force: true });
      }
    }
  }

  return {
    patchId: patch.id,
    dryRun: options.dryRun ?? false,
    appliedFiles,
    deletedFiles
  };
}

async function resolveWorkspacePatchPathSafe(workspaceRoot: string, patchPath: string): Promise<string> {
  if (path.isAbsolute(patchPath)) {
    throw new Error(`Patch path must be relative to the workspace: ${patchPath}`);
  }

  const normalizedPatchPath = patchPath.split('/').join(path.sep);
  const root = path.resolve(workspaceRoot);
  const absolutePath = path.resolve(root, normalizedPatchPath);
  const relativePath = path.relative(root, absolutePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Patch path escapes the workspace root: ${patchPath}`);
  }

  const realAncestor = await realPathOfNearestAncestor(absolutePath);

  if (realAncestor !== undefined) {
    const realRoot = await fs.realpath(root).catch(() => root);
    const realRelative = path.relative(realRoot, realAncestor);

    if (realRelative.startsWith('..') || path.isAbsolute(realRelative)) {
      throw new Error(`Patch path resolves outside the workspace root through a symlink: ${patchPath}`);
    }
  }

  return absolutePath;
}

async function realPathOfNearestAncestor(absolutePath: string): Promise<string | undefined> {
  let current = path.dirname(absolutePath);

  while (true) {
    try {
      return await fs.realpath(current);
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return undefined;
    }

    current = parent;
  }
}

async function readTextFileIfExists(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

function toPortableRelativePath(workspaceRoot: string, absolutePath: string): string {
  return path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
