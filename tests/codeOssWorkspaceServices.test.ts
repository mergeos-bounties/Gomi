import { describe, expect, it } from 'vitest';
import {
  applyCodeOssPatchProposal,
  previewCodeOssPatchProposal,
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

  it('captures selected code and diagnostics from native editor services', async () => {
    const services = createFakeCodeOssServices({
      'src/login.ts': 'const token = login();\n'
    });

    services.editorService = {};
    services.codeEditorService = {
      getFocusedCodeEditor: () => ({
        getModel: () => ({
          uri: new FakeUri('/workspace/src/login.ts'),
          getValueInRange: () => 'const token = login();'
        }),
        getSelection: () => ({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 22,
          isEmpty: () => false
        })
      })
    };
    services.markerService = {
      read: () => [
        {
          resource: new FakeUri('/workspace/src/login.ts'),
          severity: 8,
          message: 'Cannot find name login.',
          source: 'ts',
          code: '2304',
          startLineNumber: 1,
          startColumn: 15
        }
      ]
    };

    const snapshot = await readCodeOssWorkspaceSnapshot(services, {
      maxFiles: 10,
      maxDepth: 3,
      maxSnippets: 4,
      maxSnippetLength: 500,
      maxDiagnostics: 5,
      maxSelectionLength: 100
    });

    expect(snapshot.openEditors).toEqual(['src/login.ts']);
    expect(snapshot.contentSnippets?.[0]).toMatchObject({
      filePath: 'src/login.ts',
      content: 'const token = login();',
      source: 'selection'
    });
    expect(snapshot.contentSnippets?.[1]).toMatchObject({
      filePath: 'Code - OSS Diagnostics',
      source: 'diagnostic'
    });
    expect(snapshot.contentSnippets?.[1]?.content).toContain('error src/login.ts:1:15 [ts 2304]');
    expect(snapshot.terminalSummary).toContain('1 selection snippet(s), 1 diagnostic snippet(s)');
  });

  it('captures terminal output, SCM diff previews, and error-log context', async () => {
    const services = createFakeCodeOssServices({
      'src/login.ts': 'export const ok = true;\n',
      'package.json': '{"scripts":{"test":"vitest"}}'
    });
    services.readFileMap().set('/original/src/login.ts', 'export const ok = false;\n');
    services.terminalService = {
      activeInstance: {
        title: 'npm test',
        shellType: 'pwsh',
        cwd: 'D:/repo/gomi',
        hasSelection: () => false,
        getCommandAndOutputAsText: () => 'npm test\nPASS login.spec.ts\n'
      }
    };
    services.scmService = {
      repositories: [
        {
          id: 'repo-1',
          provider: {
            id: 'git',
            providerId: 'git',
            label: 'Git',
            name: 'Git',
            groups: [
              {
                id: 'changes',
                label: 'Changes',
                resources: [
                  {
                    sourceUri: new FakeUri('/workspace/src/login.ts'),
                    decorations: {
                      tooltip: 'Modified'
                    },
                    contextValue: 'modified',
                    multiDiffEditorOriginalUri: new FakeUri('/original/src/login.ts')
                  }
                ]
              }
            ]
          }
        }
      ]
    };
    services.errorLogService = {
      getRecentErrorLog: () => 'Extension host warning: failed to activate demo extension.'
    };

    const snapshot = await readCodeOssWorkspaceSnapshot(services, {
      maxFiles: 10,
      maxDepth: 3,
      maxSnippets: 8,
      maxSnippetLength: 500
    });
    const terminalSnippet = snapshot.contentSnippets?.find((snippet) => snippet.source === 'terminal');
    const gitSnippet = snapshot.contentSnippets?.find((snippet) => snippet.source === 'git_diff');
    const errorLogSnippet = snapshot.contentSnippets?.find((snippet) => snippet.source === 'error_log');

    expect(terminalSnippet?.filePath).toBe('Terminal: npm test');
    expect(terminalSnippet?.content).toContain('PASS login.spec.ts');
    expect(snapshot.gitSummary).toContain('Git Changes: src/login.ts (Modified)');
    expect(gitSnippet?.content).toContain('diff --git a/src/login.ts b/src/login.ts');
    expect(gitSnippet?.content).toContain('-export const ok = false;');
    expect(gitSnippet?.content).toContain('+export const ok = true;');
    expect(errorLogSnippet).toMatchObject({
      filePath: 'Code - OSS Error Log',
      source: 'error_log'
    });
    expect(errorLogSnippet?.content).toContain('failed to activate demo extension');
    expect(snapshot.terminalSummary).toContain('1 terminal snippet(s), 1 git diff snippet(s), 1 error-log snippet(s)');
  });

  it('indexes multiple terminal instances and prefers selected terminal text', async () => {
    const services = createFakeCodeOssServices({
      'src/login.ts': 'export const ok = true;\n'
    });
    const activeTerminal = {
      title: 'npm test',
      shellType: 'pwsh',
      cwd: 'D:/repo/gomi',
      hasSelection: () => false,
      getCommandAndOutputAsText: () => 'npm test\nPASS login.spec.ts\n'
    };
    const duplicateTitleTerminal = {
      title: 'npm test',
      shellType: 'pwsh',
      cwd: 'D:/repo/gomi',
      hasSelection: () => false,
      serialize: () => 'npm run build\nDone in 1.2s\n'
    };
    const selectedTerminal = {
      title: 'debug shell',
      shellType: 'bash',
      cwd: 'D:/repo/gomi',
      selection: 'TypeError: Cannot read properties of undefined',
      hasSelection: () => true,
      getCommandAndOutputAsText: () => 'very long unrelated server transcript'
    };
    const emptyTerminal = {
      title: 'empty',
      hasSelection: () => false,
      getCommandAndOutputAsText: () => '   '
    };

    services.terminalService = {
      activeInstance: activeTerminal,
      instances: [activeTerminal, duplicateTitleTerminal, selectedTerminal, emptyTerminal]
    };

    const snapshot = await readCodeOssWorkspaceSnapshot(services, {
      maxFiles: 10,
      maxDepth: 3,
      maxSnippets: 8,
      maxSnippetLength: 500,
      maxTerminalInstances: 3,
      maxTerminalOutputLength: 600
    });
    const terminalSnippets = snapshot.contentSnippets?.filter((snippet) => snippet.source === 'terminal') ?? [];

    expect(terminalSnippets.map((snippet) => snippet.filePath)).toEqual([
      'Terminal: npm test',
      'Terminal: debug shell',
      'Terminal: npm test (2)'
    ]);
    expect(terminalSnippets[0]?.content).toContain('PASS login.spec.ts');
    expect(terminalSnippets[1]?.content).toContain('source: selected terminal text');
    expect(terminalSnippets[1]?.content).toContain('TypeError: Cannot read properties of undefined');
    expect(terminalSnippets[1]?.content).not.toContain('very long unrelated server transcript');
    expect(terminalSnippets[2]?.content).toContain('npm run build');
    expect(snapshot.terminalSummary).toContain('3 terminal snippet(s)');
  });

  it('keeps SCM summaries when original resources cannot be read', async () => {
    const services = createFakeCodeOssServices({
      'src/login.ts': 'export const ok = true;\n'
    });
    services.scmService = {
      repositories: [
        {
          provider: {
            label: 'Git',
            groups: [
              {
                label: 'Changes',
                resources: [
                  {
                    sourceUri: new FakeUri('/workspace/src/login.ts'),
                    decorations: {
                      tooltip: 'Modified'
                    }
                  }
                ]
              }
            ],
            getOriginalResource: async () => {
              throw new Error('original resource is unavailable');
            }
          }
        }
      ]
    };

    const snapshot = await readCodeOssWorkspaceSnapshot(services, {
      maxFiles: 10,
      maxDepth: 3,
      maxSnippets: 6,
      maxSnippetLength: 500
    });

    expect(snapshot.gitSummary).toContain('Git Changes: src/login.ts (Modified)');
    expect(snapshot.contentSnippets?.some((snippet) => snippet.source === 'git_diff')).toBe(false);
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

  it('opens a native diff preview before writing approved unified diffs', async () => {
    const services = createFakeCodeOssServices({
      'src/login.ts': 'export const ok = false;\n'
    });
    const openedEditors: unknown[] = [];
    services.editorService = {
      ...services.editorService,
      openEditor: async (editor) => {
        openedEditors.push(editor);
      }
    };

    const result = await previewCodeOssPatchProposal(createPatch(), services);
    const openedEditor = openedEditors[0] as {
      label?: string;
      original?: { contents?: string; resource?: GomiCodeOssUri };
      modified?: { contents?: string; resource?: GomiCodeOssUri };
    };

    expect(result).toEqual({
      patchId: 'patch-1',
      previewedFiles: ['src/login.ts'],
      skippedFiles: []
    });
    expect(services.readFileMap().get('/workspace/src/login.ts')).toBe('export const ok = false;\n');
    expect(openedEditor.label).toBe('Gomi Preview: src/login.ts');
    expect(openedEditor.original?.contents).toBe('export const ok = false;\n');
    expect(openedEditor.modified?.contents).toBe('export const ok = true;\n');
    expect(openedEditor.modified?.resource?.scheme).toBe('gomi-preview');
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
  constructor(readonly path: string, readonly scheme = 'file') {}

  get fsPath(): string {
    return this.path;
  }

  toString(): string {
    return `${this.scheme}://${this.path}`;
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
    createUri: (components) => new FakeUri(components.path, components.scheme),
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
