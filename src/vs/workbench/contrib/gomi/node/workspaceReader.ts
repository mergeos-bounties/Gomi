import type { GomiWorkspaceSnapshot } from '../common/gomiTypes';

export type GomiWorkspaceSnapshotReader = () =>
  | GomiWorkspaceSnapshot
  | Promise<GomiWorkspaceSnapshot>;

export function createDemoWorkspaceSnapshot(rootName = 'Gomi'): GomiWorkspaceSnapshot {
  return {
    rootName,
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
    terminalSummary: 'Node and npm are available for Vite development.'
  };
}

export function createDemoWorkspaceSnapshotReader(): GomiWorkspaceSnapshotReader {
  return () => createDemoWorkspaceSnapshot();
}
