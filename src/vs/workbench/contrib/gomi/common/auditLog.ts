/** Audit log types (issue #39) */
export type AuditAction = 'run' | 'approve' | 'reject' | 'settings_change' | 'memory_prune' | 'agent_start' | 'agent_finish';
export interface AuditEntry { id: string; action: AuditAction; actor: string; detail: string; timestamp: number; sessionId?: string; }
export class AuditLogger {
  private entries: AuditEntry[] = []; private limit: number; private idCounter = 0;
  constructor(limit = 500) { this.limit = limit; }
  log(action: AuditAction, actor: string, detail: string, sessionId?: string): AuditEntry {
    const entry: AuditEntry = { id: `audit-${++this.idCounter}`, action, actor, detail, timestamp: Date.now(), sessionId };
    this.entries.push(entry); if (this.entries.length > this.limit) this.entries.shift(); return entry;
  }
  getRecent(count?: number): AuditEntry[] { return this.entries.slice(-(count ?? 50)); }
  getBySession(sessionId: string): AuditEntry[] { return this.entries.filter(e => e.sessionId === sessionId); }
  clear(): void { this.entries = []; }
}
