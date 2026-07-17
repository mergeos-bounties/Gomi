import type {
  GomiOfficeMemorySettings,
  GomiWorkspaceContentSnippet,
  GomiWorkspaceSnapshot
} from '../common/gomiTypes';

export interface GomiMemoryPrivacyAudit {
  filteredFiles: string[];
  droppedSnippets: string[];
  redactedSnippets: string[];
}

export interface GomiMemoryPolicyResult {
  workspace: GomiWorkspaceSnapshot;
  audit: GomiMemoryPrivacyAudit;
}

export const GOMI_MAX_INDEXED_TERMINAL_SNIPPETS = 3;
export const GOMI_MAX_INDEXED_TERMINAL_SNIPPET_CHARS = 1200;

const STRICT_ONLY_SOURCES = new Set<GomiWorkspaceContentSnippet['source']>([
  'terminal',
  'error_log'
]);

const SECRET_LINE_PATTERN =
  /^(\s*(?:(?:export\s+)?(?:const|let|var)\s+)?[A-Z0-9_.-]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API[_-]?KEY|PRIVATE[_-]?KEY|ACCESS[_-]?KEY|CLIENT[_-]?SECRET|DATABASE_URL|DB_PASSWORD|AUTH_TOKEN)[A-Z0-9_.-]*\s*[:=]\s*)(.+)$/i;

export function applyWorkspaceMemoryPolicy(
  workspace: GomiWorkspaceSnapshot,
  settings: GomiOfficeMemorySettings
): GomiMemoryPolicyResult {
  const audit: GomiMemoryPrivacyAudit = {
    filteredFiles: [],
    droppedSnippets: [],
    redactedSnippets: []
  };
  const files = workspace.files.filter((filePath) => {
    if (!isSensitivePath(filePath)) {
      return true;
    }

    audit.filteredFiles.push(filePath);
    return false;
  });
  const openEditors = workspace.openEditors.filter((filePath) => !isSensitivePath(filePath));
  const contentSnippets: GomiWorkspaceContentSnippet[] = [];
  let indexedTerminalSnippetCount = 0;

  for (const snippet of workspace.contentSnippets ?? []) {
    if (shouldDropSnippet(snippet, settings, indexedTerminalSnippetCount)) {
      audit.droppedSnippets.push(snippet.filePath);
      continue;
    }

    const redactedContent = settings.redactSecrets ? redactSecrets(snippet.content) : snippet.content;
    const content =
      snippet.source === 'terminal'
        ? redactedContent.slice(0, GOMI_MAX_INDEXED_TERMINAL_SNIPPET_CHARS)
        : redactedContent;

    if (redactedContent !== snippet.content) {
      audit.redactedSnippets.push(snippet.filePath);
    }

    if (snippet.source === 'terminal') {
      indexedTerminalSnippetCount += 1;
    }

    contentSnippets.push({
      ...snippet,
      content
    });
  }

  return {
    workspace: {
      ...workspace,
      files,
      openEditors,
      gitSummary: settings.redactSecrets ? redactSecrets(workspace.gitSummary) : workspace.gitSummary,
      terminalSummary:
        settings.privacyMode === 'strict'
          ? 'Memory privacy mode is strict; terminal and error-log transcripts are not indexed.'
          : settings.redactSecrets
            ? redactSecrets(workspace.terminalSummary)
            : workspace.terminalSummary,
      contentSnippets
    },
    audit
  };
}

export function createMemoryPrivacySummary(audit: GomiMemoryPrivacyAudit): string {
  const parts = [
    audit.filteredFiles.length > 0 ? `${audit.filteredFiles.length} sensitive file path(s) hidden` : '',
    audit.droppedSnippets.length > 0 ? `${audit.droppedSnippets.length} snippet(s) skipped` : '',
    audit.redactedSnippets.length > 0 ? `${audit.redactedSnippets.length} snippet(s) redacted` : ''
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(', ')
    : 'No sensitive workspace context detected by the memory privacy policy.';
}

export function redactSecrets(value: string): string {
  return value
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED]')
    .replace(/\b(sk|pk|ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{12,}\b/g, '$1_[REDACTED]')
    .split(/\r?\n/)
    .map((line) => {
      const match = SECRET_LINE_PATTERN.exec(line);

      if (!match) {
        return line;
      }

      return `${match[1]}[REDACTED]`;
    })
    .join('\n');
}

function shouldDropSnippet(
  snippet: GomiWorkspaceContentSnippet,
  settings: GomiOfficeMemorySettings,
  indexedTerminalSnippetCount: number
): boolean {
  if (isSensitivePath(snippet.filePath)) {
    return true;
  }

  if (snippet.source === 'terminal') {
    return (
      !settings.indexTerminalSnippets ||
      settings.privacyMode === 'strict' ||
      indexedTerminalSnippetCount >= GOMI_MAX_INDEXED_TERMINAL_SNIPPETS
    );
  }

  return settings.privacyMode === 'strict' && STRICT_ONLY_SOURCES.has(snippet.source);
}

function isSensitivePath(filePath: string): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
  const fileName = normalizedPath.split('/').pop() ?? normalizedPath;

  if (isAllowedTemplatePath(fileName)) {
    return false;
  }

  return (
    fileName === '.env' ||
    fileName.startsWith('.env.') ||
    fileName === '.npmrc' ||
    fileName === '.pypirc' ||
    fileName === 'id_rsa' ||
    fileName === 'id_dsa' ||
    fileName === 'id_ed25519' ||
    fileName.endsWith('.pem') ||
    fileName.endsWith('.p12') ||
    fileName.endsWith('.pfx') ||
    /(^|[._-])(secret|secrets|credential|credentials|private-key|service-account)([._-]|$)/i.test(fileName)
  );
}

function isAllowedTemplatePath(fileName: string): boolean {
  return (
    fileName === '.env.example' ||
    fileName === '.env.sample' ||
    fileName === '.env.template' ||
    fileName.endsWith('.example') ||
    fileName.endsWith('.sample') ||
    fileName.endsWith('.template')
  );
}
