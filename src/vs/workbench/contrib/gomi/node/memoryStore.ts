import type { GomiMemoryEntry, GomiMemoryKind, GomiAgentId } from '../common/gomiTypes';

export interface GomiMemoryScope {
  workspaceId: string;
  userId?: string;
  threadId?: string;
}

export interface GomiMemoryItem {
  key: string;
  value: string;
  tags?: string[];
  importance?: number;
  createdAt: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface GomiMemoryHit extends GomiMemoryItem {
  score: number;
}

export interface GomiMemoryRetentionPolicy {
  retentionDays: number;
  maxProjectMemoryItems: number;
}

export interface GomiMemoryPruneReport {
  removed: number;
  remaining: number;
}

export interface GomiMemoryStore {
  get(scope: GomiMemoryScope, key: string): Promise<GomiMemoryItem | null>;
  put(scope: GomiMemoryScope, item: Omit<GomiMemoryItem, 'createdAt' | 'updatedAt'>): Promise<GomiMemoryItem>;
  search(scope: GomiMemoryScope, query: string, limit?: number): Promise<GomiMemoryHit[]>;
  prune(scope: GomiMemoryScope, policy: GomiMemoryRetentionPolicy): GomiMemoryPruneReport;
  add(entry: Omit<GomiMemoryEntry, 'id' | 'createdAt'>): GomiMemoryEntry;
  list(sessionId: string): GomiMemoryEntry[];
  recent(sessionId: string, limit: number): GomiMemoryEntry[];
  clear(sessionId?: string): void;
}

export class InMemoryGomiMemoryStore implements GomiMemoryStore {
  private entries: GomiMemoryEntry[] = [];
  private scopedItems = new Map<string, GomiMemoryItem>();

  async get(scope: GomiMemoryScope, key: string): Promise<GomiMemoryItem | null> {
    return this.scopedItems.get(this.scopedKey(scope, key)) ?? null;
  }

  async put(
    scope: GomiMemoryScope,
    item: Omit<GomiMemoryItem, 'createdAt' | 'updatedAt'>
  ): Promise<GomiMemoryItem> {
    const existingItem = await this.get(scope, item.key);
    const nextItem: GomiMemoryItem = {
      ...item,
      createdAt: existingItem?.createdAt ?? new Date().toISOString(),
      updatedAt: existingItem ? new Date().toISOString() : undefined
    };

    this.scopedItems.set(this.scopedKey(scope, item.key), nextItem);
    return nextItem;
  }

  async search(scope: GomiMemoryScope, query: string, limit = 8): Promise<GomiMemoryHit[]> {
    const normalizedQuery = query.toLowerCase();
    const scopePrefix = this.scopePrefix(scope);

    return Array.from(this.scopedItems.entries())
      .filter(([key]) => key.startsWith(scopePrefix))
      .map(([, item]) => ({
        ...item,
        score: this.scoreMemoryItem(item, normalizedQuery)
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  prune(scope: GomiMemoryScope, policy: GomiMemoryRetentionPolicy): GomiMemoryPruneReport {
    const scopePrefix = this.scopePrefix(scope);
    const cutoffTime = Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000;
    const scopedEntries = Array.from(this.scopedItems.entries())
      .filter(([key]) => key.startsWith(scopePrefix))
      .sort((left, right) => memoryTimestamp(right[1]) - memoryTimestamp(left[1]));
    const entryCountBefore = this.entries.length;
    const scopedCountBefore = scopedEntries.length;

    for (const [key, item] of scopedEntries) {
      if (memoryTimestamp(item) < cutoffTime) {
        this.scopedItems.delete(key);
      }
    }

    const retainedScopedEntries = Array.from(this.scopedItems.entries())
      .filter(([key]) => key.startsWith(scopePrefix))
      .sort((left, right) => memoryTimestamp(right[1]) - memoryTimestamp(left[1]));

    for (const [key] of retainedScopedEntries.slice(policy.maxProjectMemoryItems)) {
      this.scopedItems.delete(key);
    }

    this.entries = this.entries.filter((entry) => Date.parse(entry.createdAt) >= cutoffTime);

    const remainingScopedItems = Array.from(this.scopedItems.keys()).filter((key) =>
      key.startsWith(scopePrefix)
    ).length;
    const remaining = remainingScopedItems + this.entries.length;

    return {
      removed: entryCountBefore + scopedCountBefore - remaining,
      remaining
    };
  }

  add(entry: Omit<GomiMemoryEntry, 'id' | 'createdAt'>): GomiMemoryEntry {
    const nextEntry: GomiMemoryEntry = {
      ...entry,
      id: `memory-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString()
    };

    this.entries.push(nextEntry);
    return nextEntry;
  }

  list(sessionId: string): GomiMemoryEntry[] {
    return this.entries.filter((entry) => entry.sessionId === sessionId);
  }

  recent(sessionId: string, limit: number): GomiMemoryEntry[] {
    return this.list(sessionId).slice(-limit);
  }

  clear(sessionId?: string): void {
    if (!sessionId) {
      this.entries = [];
      this.scopedItems.clear();
      return;
    }

    this.entries = this.entries.filter((entry) => entry.sessionId !== sessionId);
  }

  private scopedKey(scope: GomiMemoryScope, key: string): string {
    return `${this.scopePrefix(scope)}${key}`;
  }

  private scopePrefix(scope: GomiMemoryScope): string {
    return `${scope.workspaceId}:${scope.userId ?? 'anonymous'}:${scope.threadId ?? 'default'}:`;
  }

  private scoreMemoryItem(item: GomiMemoryItem, normalizedQuery: string): number {
    const haystack = [item.key, item.value, ...(item.tags ?? [])].join(' ').toLowerCase();

    if (!normalizedQuery) {
      return item.importance ?? 0.5;
    }

    if (haystack.includes(normalizedQuery)) {
      return 1 + (item.importance ?? 0);
    }

    return normalizedQuery
      .split(/\s+/)
      .filter((term) => term && haystack.includes(term)).length;
  }
}

export function createMemoryContent(kind: GomiMemoryKind, value: string): string {
  return `[${kind}] ${value}`;
}

export function createInMemoryGomiMemoryStore(): GomiMemoryStore {
  return new InMemoryGomiMemoryStore();
}

export function createAgentResultMemoryEntry(input: {
  sessionId: string;
  agentId: GomiAgentId;
  taskId: string;
  summary: string;
}): Omit<GomiMemoryEntry, 'id' | 'createdAt'> {
  return {
    sessionId: input.sessionId,
    kind: 'agent_result',
    content: input.summary,
    agentId: input.agentId,
    taskId: input.taskId
  };
}

function memoryTimestamp(item: Pick<GomiMemoryItem, 'createdAt' | 'updatedAt'>): number {
  return Date.parse(item.updatedAt ?? item.createdAt);
}
