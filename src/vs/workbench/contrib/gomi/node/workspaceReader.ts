import type { GomiWorkspaceSnapshot } from '../common/gomiTypes';

export type GomiWorkspaceSnapshotReader = () =>
  | GomiWorkspaceSnapshot
  | Promise<GomiWorkspaceSnapshot>;

export function createDemoWorkspaceSnapshot(rootName = 'Gomi'): GomiWorkspaceSnapshot {
  return {
    rootName,
    rootPath: '.',
    files: [
      'product.json',
      'package.json',
      'src/vs/workbench/contrib/gomi/browser/GomiOfficeApp.tsx',
      'src/vs/workbench/contrib/gomi/node/agentRuntime.ts',
      'src/vs/workbench/contrib/gomi/node/taskPlanner.ts',
      'README.md'
    ],
    openEditors: ['GomiOfficeApp.tsx', 'agentRuntime.ts'],
    gitSummary: 'Workspace scaffold, no upstream Code - OSS history yet.',
    terminalSummary: 'Node and npm are available for Vite development.',
    contentSnippets: [
      {
        filePath: 'README.md',
        content:
          'Gomi IDE is a Code - OSS fork direction with a visual multi-agent office, shared project memory, patch approval, and agent runtime.',
        language: 'markdown',
        source: 'workspace'
      },
      {
        filePath: 'src/vs/workbench/contrib/gomi/node/agentRuntime.ts',
        content:
          'GomiAgentRuntime reads workspace context, retrieves shared project memory, runs specialist agents, emits patch proposals, and waits for approval before apply.',
        language: 'typescript',
        source: 'open_editor'
      },
      {
        filePath: 'product.json',
        content:
          '{"nameShort":"Gomi","nameLong":"Gomi IDE","applicationName":"gomi-ide","dataFolderName":".gomi-ide","win32AppUserModelId":"Gomi.IDE","darwinBundleIdentifier":"com.gomi.ide","linuxIconName":"gomi-ide"}',
        language: 'json',
        source: 'workspace'
      }
    ]
  };
}

export function createDemoWorkspaceSnapshotReader(): GomiWorkspaceSnapshotReader {
  return () => createDemoWorkspaceSnapshot();
}
