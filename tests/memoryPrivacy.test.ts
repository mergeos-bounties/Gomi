import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  setMemoryPrivacyMode,
  setTerminalSnippetIndexing
} from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';
import type { GomiWorkspaceSnapshot } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import {
  applyWorkspaceMemoryPolicy,
  createMemoryPrivacySummary,
  GOMI_MAX_INDEXED_TERMINAL_SNIPPET_CHARS,
  GOMI_MAX_INDEXED_TERMINAL_SNIPPETS,
  redactSecrets
} from '../src/vs/workbench/contrib/gomi/node/memoryPrivacy';

const workspace: GomiWorkspaceSnapshot = {
  rootName: 'Gomi',
  files: ['README.md', '.env', '.env.example', 'src/auth.ts'],
  openEditors: ['.env', 'src/auth.ts'],
  gitSummary: 'Git branch master, 0 changed files.',
  terminalSummary: 'npm test',
  contentSnippets: [
    {
      filePath: '.env',
      content: 'DATABASE_URL=postgres://admin:secret@localhost/gomi',
      language: 'text',
      source: 'workspace'
    },
    {
      filePath: '.env.example',
      content: 'DATABASE_URL=postgres://user:password@localhost/example',
      language: 'text',
      source: 'workspace'
    },
    {
      filePath: 'src/auth.ts',
      content: 'const API_KEY = "super-secret-value";\nconst mode = "demo";',
      language: 'typescript',
      source: 'open_editor'
    },
    {
      filePath: 'Terminal: npm test',
      content: 'Bearer abcdefghijklmnopqrstuvwxyz',
      language: 'text',
      source: 'terminal'
    }
  ]
};

describe('memory privacy policy', () => {
  it('filters sensitive paths while keeping safe templates', () => {
    const result = applyWorkspaceMemoryPolicy(workspace, DEFAULT_GOMI_OFFICE_SETTINGS.memory);

    expect(result.workspace.files).not.toContain('.env');
    expect(result.workspace.files).toContain('.env.example');
    expect(result.workspace.openEditors).toEqual(['src/auth.ts']);
    expect(result.workspace.contentSnippets?.map((snippet) => snippet.filePath)).not.toContain('.env');
    expect(createMemoryPrivacySummary(result.audit)).toContain('sensitive file');
  });

  it('redacts secret-looking values before memory indexing', () => {
    expect(redactSecrets('API_KEY=super-secret-value\nBearer abcdefghijklmnopqrstuvwxyz')).toBe(
      'API_KEY=[REDACTED]\nBearer [REDACTED]'
    );

    const result = applyWorkspaceMemoryPolicy(workspace, DEFAULT_GOMI_OFFICE_SETTINGS.memory);
    const authSnippet = result.workspace.contentSnippets?.find((snippet) => snippet.filePath === 'src/auth.ts');

    expect(authSnippet?.content).toContain('[REDACTED]');
    expect(authSnippet?.content).not.toContain('super-secret-value');
  });

  it('keeps terminal snippets out of memory by default while preserving terminal summary', () => {
    const result = applyWorkspaceMemoryPolicy(workspace, DEFAULT_GOMI_OFFICE_SETTINGS.memory);

    expect(DEFAULT_GOMI_OFFICE_SETTINGS.memory.indexTerminalSnippets).toBe(false);
    expect(result.workspace.terminalSummary).toBe('npm test');
    expect(result.workspace.contentSnippets?.some((snippet) => snippet.source === 'terminal')).toBe(false);
    expect(result.audit.droppedSnippets).toContain('Terminal: npm test');
  });

  it('indexes terminal snippets only when enabled, with redaction and caps', () => {
    const terminalWorkspace: GomiWorkspaceSnapshot = {
      ...workspace,
      contentSnippets: Array.from({ length: GOMI_MAX_INDEXED_TERMINAL_SNIPPETS + 2 }, (_, index) => ({
        filePath: `Terminal: run ${index + 1}`,
        content:
          index === 0
            ? `Bearer abcdefghijklmnopqrstuvwxyz\n${'x'.repeat(GOMI_MAX_INDEXED_TERMINAL_SNIPPET_CHARS + 60)}`
            : `npm run task-${index + 1}`,
        language: 'text',
        source: 'terminal' as const
      }))
    };
    const settings = setTerminalSnippetIndexing(DEFAULT_GOMI_OFFICE_SETTINGS, true);
    const result = applyWorkspaceMemoryPolicy(terminalWorkspace, settings.memory);
    const terminalSnippets = result.workspace.contentSnippets?.filter((snippet) => snippet.source === 'terminal') ?? [];

    expect(terminalSnippets).toHaveLength(GOMI_MAX_INDEXED_TERMINAL_SNIPPETS);
    expect(terminalSnippets[0]?.content).toContain('Bearer [REDACTED]');
    expect(terminalSnippets[0]?.content).not.toContain('abcdefghijklmnopqrstuvwxyz');
    expect(terminalSnippets.every((snippet) => snippet.content.length <= GOMI_MAX_INDEXED_TERMINAL_SNIPPET_CHARS)).toBe(true);
    expect(result.audit.droppedSnippets).toContain(`Terminal: run ${GOMI_MAX_INDEXED_TERMINAL_SNIPPETS + 1}`);
  });

  it('drops terminal and error log snippets in strict mode', () => {
    const strictSettings = setMemoryPrivacyMode(DEFAULT_GOMI_OFFICE_SETTINGS, 'strict');
    const result = applyWorkspaceMemoryPolicy(workspace, strictSettings.memory);

    expect(result.workspace.contentSnippets?.some((snippet) => snippet.source === 'terminal')).toBe(false);
    expect(result.workspace.terminalSummary).not.toContain('Bearer');
    expect(result.audit.droppedSnippets).toContain('Terminal: npm test');
  });
});
