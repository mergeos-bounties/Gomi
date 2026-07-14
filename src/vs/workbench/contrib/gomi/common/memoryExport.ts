/** Project memory export/import with privacy checks (issue #35) */
export interface MemoryExport { version: 1; exportedAt: string; workspaceName: string; items: Array<{ key: string; content: string; kind: string; createdAt: string }>; }
export interface PrivacyCheck { safe: boolean; redacted: boolean; warnings: string[]; }
const SECRET_PATTERNS = [/api[_-]?key/i, /token/i, /secret/i, /password/i, /-----BEGIN.*PRIVATE KEY-----/s];
export function checkPrivacy(items: Array<{ content: string }>): PrivacyCheck {
  const warnings: string[] = [];
  for (const item of items) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(item.content)) { warnings.push(`Item contains potential secret matching: ${pattern}`); break; }
    }
  }
  return { safe: warnings.length === 0, redacted: false, warnings };
}
export function exportMemory(workspaceName: string, items: Array<{ key: string; content: string; kind: string; createdAt: string }>): MemoryExport {
  return { version: 1, exportedAt: new Date().toISOString(), workspaceName, items };
}
export function formatMemoryExport(exp: MemoryExport): string { return JSON.stringify(exp, null, 2); }
