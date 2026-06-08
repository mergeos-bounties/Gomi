import { describe, expect, it } from 'vitest';
import {
  applyCodeOssPatchProposal,
  readCodeOssWorkspaceSnapshot,
  type GomiCodeOssFileStat,
  type GomiCodeOssUri,
  type GomiCodeOssWorkspaceServices
} from '../src/vs/workbench/contrib/gomi/browser/codeOssWorkspaceServices';
import type { GomiPatchProposal } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';

describe('Code - OSS workspace services adapter', () => {
  it('reads workspace folders, open editors, and important content snippets', async () => {
    const services = createFakeCodeOssServices({
      'README.md': '# Gomi\nNative workspace context.',
      'package.json': '{"scripts":{"test":"vitest"}}',
      'src/login.ts': 'export const ok = true;\n'
    });

    const snapshot = await readCodeOssWorkspaceSnapshot(services, {
      maxFiles: 20,
      maxDepth: 4,
      maxSnippets: 6,
      maxSnippetLength: 500
    });

    expect(snapshot.rootName).toBe('Demo Workspace');
    expect(snapshot.files).toEqual(['src/login.ts', 'package.json', 'README.md']);
    expect(snapshot.openEditors).toEqual(['src/login.ts']);
    expect(snapshot.contentSnippets?.map((snippet) => snippet.filePath)).toEqual([
      'src/login.ts',
      'package.json',
      'README.md'
    ]);
    expect(snapshot.terminalSummary).toContain('Code - OSS workspace');
  });

  it('applies approved unified diffs through text-file services', async () => {
    const services = createFakeCodeOssServices({
      'src/login.ts': 'export const ok = false;\n'
    });

    const result = await applyCodeOssPatchProposal(
      {
        ...createPatch(),
        diff: [
          'diff --git a/src/login.ts b/src/login.ts',
          '--- a/src/login.ts',
          '+++ b/src/login.ts',
          '@@ -1 +1 @@',
          '-export const ok = false;',
          '+export const ok = true;'
        ].join('\n')
      },
      services
    );

    expect(result).toEqual({
      patchId: 'patch-1',
      dryRun: false,
      appliedFiles: ['src/login.ts'],
      deletedFiles: []
    });
    expect(services.readFileMap().get('/workspace/src/login.ts')).toBe('export const ok = true;\n');
  });

  it('creates new files from approved unified diffs', async () => {
    const services = createFakeCodeOssServices({});

    const result = await applyCodeOssPatchProposal(
      {
        ...createPatch(),
        filePath: 'docs/gomi-agent-plan.md',
        targetFiles: ['docs/gomi-agent-plan.md'],
        diff: [
          'diff --git a/docs/gomi-agent-plan.md b/docs/gomi-agent-plan.md',
          'new file mode 100644',
          '--- /dev/null',
          '+++ b/docs/gomi-agent-plan.md',
          '@@ -0,0 +1,2 @@',
          '+# Gomi Agent Plan',
          '+Patch application remains approval gated.'
        ].join('\n')
      },
      services
    );

    expect(result.appliedFiles).toEqual(['docs/gomi-agent-plan.md']);
    expect(services.readFileMap().get('/workspace/docs/gomi-agent-plan.md')).toBe(
      '# Gomi Agent Plan\nPatch application remains approval gated.\n'
    );
  });

  it('requires approval and blocks workspace path escape', async () => {
    const services = createFakeCodeOssServices({});

    await expect(
      applyCodeOssPatchProposal(
        {
          ...createPatch(),
          approvalStatus: 'pending'
        },
        services
      )
    ).rejects.toThrow('must be approved');

    await expect(
      applyCodeOssPatchProposal(
        {
          ...createPatch(),
          diff: [
            'diff --git a/../secret.txt b/../secret.txt',
            'new file mode 100644',
            '--- /dev/null',
            '+++ b/../secret.txt',
            '@@ -0,0 +1 @@',
            '+secret'
          ].join('\n')
        },
        services
      )
    ).rejects.toThrow('escapes the workspace root');
  });
});

interface FakeCodeOssWorkspaceServices extends GomiCodeOssWorkspaceServices {
  readFileMap(): Map<string, string>;
}

class FakeUri implements GomiCodeOssUri {
  readonly scheme = 'file';

  constructor(readonly path: string) {}

  get fsPath(): string {
    return this.path;
  }

  toString(): string {
    return `file://${this.path}`;
  }
}

function createFakeCodeOssServices(files: Record<string, string>): FakeCodeOssWorkspaceServices {
  const root = new FakeUri('/workspace');
  const fileMap = new Map(
    Object.entries(files).map(([filePath, content]) => [`/workspace/${filePath}`, content])
  );
  const folder = {
    name: 'workspace',
    uri: root,
    toResource: (relativePath: string) => joinPath(root, ...relativePath.split('/'))
  };
  const services: FakeCodeOssWorkspaceServices = {
    workspaceContextService: {
      getWorkspace: () => ({
        id: 'workspace-1',
        name: 'Demo Workspace',
        folders: [folder]
      })
    },
    fileService: {
      resolve: async (resource) => createFakeStat(fileMap, resource),
      del: async (resource) => {
        fileMap.delete(resource.path ?? '');
      },
      createFolder: async () => undefined
    },
    textFileService: {
      read: async (resource) => {
        const content = fileMap.get(resource.path ?? '');

        if (content === undefined) {
          const error = new Error(`Entry not found: ${resource.path}`);
          error.name = 'EntryNotFound';
          throw error;
        }

        return {
          value: content
        };
      },
      write: async (resource, value) => {
        fileMap.set(resource.path ?? '', value);
      },
      create: async (operations) => {
        for (const operation of operations) {
          fileMap.set(operation.resource.path ?? '', operation.value ?? '');
        }
      }
    },
    editorService: {
      activeEditor: {
        resource: joinPath(root, 'src', 'login.ts')
      },
      visibleEditors: [
        {
          resource: joinPath(root, 'src', 'login.ts')
        }
      ]
    },
    basename: (resource) => resource.path?.split('/').pop() ?? '',
    dirname: (resource) => new FakeUri((resource.path ?? '').split('/').slice(0, -1).join('/')),
    joinPath,
    relativePath: (from, to) => {
      const fromPath = from.path ?? '';
      const toPath = to.path ?? '';

      return toPath.startsWith(`${fromPath}/`) ? toPath.slice(fromPath.length + 1) : undefined;
    },
    readFileMap: () => fileMap
  };

  return services;
}

function createFakeStat(fileMap: Map<string, string>, resource: GomiCodeOssUri): GomiCodeOssFileStat {
  const resourcePath = resource.path ?? '';
  const childPaths = Array.from(fileMap.keys())
    .filter((filePath) => filePath.startsWith(`${resourcePath}/`))
    .map((filePath) => filePath.slice(resourcePath.length + 1));
  const directChildren = Array.from(new Set(childPaths.map((filePath) => filePath.split('/')[0]))).sort();

  return {
    resource,
    isDirectory: true,
    isFile: false,
    children: directChildren.map((name) => {
      const childPath = `${resourcePath}/${name}`;
      const isFile = fileMap.has(childPath);

      return {
        name,
        resource: new FakeUri(childPath),
        isDirectory: !isFile,
        isFile,
        children: undefined
      };
    })
  };
}

function joinPath(resource: GomiCodeOssUri, ...paths: string[]): FakeUri {
  const joined = [resource.path ?? '', ...paths].join('/').replace(/\/+/g, '/');
  return new FakeUri(joined);
}

function createPatch(): GomiPatchProposal {
  return {
    id: 'patch-1',
    filePath: 'src/login.ts',
    targetFiles: ['src/login.ts'],
    summary: 'Update login.',
    diff: [
      'diff --git a/src/login.ts b/src/login.ts',
      '--- a/src/login.ts',
      '+++ b/src/login.ts',
      '@@ -1 +1 @@',
      '-export const ok = false;',
      '+export const ok = true;'
    ].join('\n'),
    approvalStatus: 'approved',
    riskLevel: 'low',
    createdByAgentId: 'backend'
  };
}
