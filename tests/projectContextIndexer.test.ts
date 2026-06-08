import { describe, expect, it } from 'vitest';
import type { GomiWorkspaceSnapshot } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import { createInMemoryGomiMemoryStore } from '../src/vs/workbench/contrib/gomi/node/memoryStore';
import {
  createWorkspaceContextChunks,
  DefaultGomiProjectContextIndexer
} from '../src/vs/workbench/contrib/gomi/node/projectContextIndexer';
import { createInMemoryVectorMemoryStore } from '../src/vs/workbench/contrib/gomi/node/vectorMemoryStore';

const workspace: GomiWorkspaceSnapshot = {
  rootName: 'Gomi',
  files: ['README.md', 'src/api/login.ts', 'product.json'],
  openEditors: ['src/api/login.ts'],
  gitSummary: 'Git branch master, 0 changed files.',
  terminalSummary: 'package.json gomi-ide with scripts: test, build.',
  contentSnippets: [
    {
      filePath: 'src/api/login.ts',
      content: 'export function loginController() { return validateUserSession(); }',
      language: 'typescript',
      source: 'open_editor'
    },
    {
      filePath: 'Terminal: npm test',
      content: 'npm test\nPASS login.spec.ts',
      language: 'text',
      source: 'terminal'
    },
    {
      filePath: 'src/api/login.ts',
      content: 'diff --git a/src/api/login.ts b/src/api/login.ts\n-export const ok = false;\n+export const ok = true;',
      language: 'diff',
      source: 'git_diff'
    },
    {
      filePath: 'Code - OSS Error Log',
      content: 'Extension host warning: failed to activate demo extension.',
      language: 'text',
      source: 'error_log'
    }
  ]
};

describe('project context indexer', () => {
  it('creates chunks for manifests, file tree, and content snippets', () => {
    const chunks = createWorkspaceContextChunks(workspace);

    expect(chunks.some((chunk) => chunk.id === 'context:workspace:file-tree')).toBe(true);
    expect(chunks.some((chunk) => chunk.sourcePath === 'src/api/login.ts')).toBe(true);
    expect(chunks.some((chunk) => chunk.id === 'context:terminal:Terminal: npm test:0')).toBe(true);
    expect(chunks.some((chunk) => chunk.id === 'context:git_diff:src/api/login.ts:0')).toBe(true);
    expect(chunks.some((chunk) => chunk.id === 'context:error_log:Code - OSS Error Log:0')).toBe(true);
  });

  it('indexes chunks into lexical and vector memory stores', async () => {
    const memoryStore = createInMemoryGomiMemoryStore();
    const vectorMemoryStore = createInMemoryVectorMemoryStore();
    const indexer = new DefaultGomiProjectContextIndexer();
    const scope = { workspaceId: 'Gomi' };

    const result = await indexer.indexWorkspace(workspace, scope, {
      memoryStore,
      vectorMemoryStore
    });
    const hits = await vectorMemoryStore.search(scope, 'login controller user session', 3);

    expect(result.chunkCount).toBeGreaterThan(3);
    expect(hits.map((hit) => hit.key)).toContain('context:open_editor:src/api/login.ts:0');
  });
});
