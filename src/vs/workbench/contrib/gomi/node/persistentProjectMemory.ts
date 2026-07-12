import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { GomiMemoryEntry } from '../common/gomiTypes';
import type {
  GomiMemoryHit,
  GomiMemoryItem,
  GomiMemoryPruneReport,
  GomiMemoryRetentionPolicy,
  GomiMemoryScope,
  GomiMemoryStore
} from './memoryStore';
import {
  cosineSimilarity,
  HashingEmbeddingProvider,
  type GomiEmbeddingProvider
} from './embeddingProvider';
import type { GomiVectorMemoryRecord, GomiVectorMemoryStore } from './vectorMemoryStore';

interface FileBackedMemoryData {
  version: 1;
  entries: GomiMemoryEntry[];
  scopedItems: Array<[string, GomiMemoryItem]>;
}

interface FileBackedVectorMemoryData {
  version: 1;
  records: Array<[string, GomiVectorMemoryRecord]>;
}

export class FileBackedGomiMemoryStore implements GomiMemoryStore {
  private entries: GomiMemoryEntry[] = [];
  private scopedItems = new Map<string, GomiMemoryItem>();

  constructor(private readonly filePath: string) {
    this.load();
  }

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
    this.persist();
    return nextItem;
  }

  async search(scope: GomiMemoryScope, query: string, limit = 8): Promise<GomiMemoryHit[]> {
    const normalizedQuery = query.toLowerCase();
    const scopePrefix = this.scopePrefix(scope);

    return Array.from(this.scopedItems.entries())
      .filter(([key]) => key.startsWith(scopePrefix))
      .map(([, item]) => ({
        ...item,
        score: scoreMemoryItem(item, normalizedQuery)
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  prune(scope: GomiMemoryScope, policy: GomiMemoryRetentionPolicy): GomiMemoryPruneReport {
    const scopePrefix = this.scopePrefix(scope);
    const cutoffTime = Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000;
    const scopedItems = Array.from(this.scopedItems.entries())
      .filter(([key]) => key.startsWith(scopePrefix))
      .sort((left, right) => memoryTimestamp(right[1]) - memoryTimestamp(left[1]));
    const entryCountBefore = this.entries.length;
    const scopedCountBefore = scopedItems.length;

    for (const [key, item] of scopedItems) {
      if (memoryTimestamp(item) < cutoffTime) {
        this.scopedItems.delete(key);
      }
    }

    const retainedScopedItems = Array.from(this.scopedItems.entries())
      .filter(([key]) => key.startsWith(scopePrefix))
      .sort((left, right) => memoryTimestamp(right[1]) - memoryTimestamp(left[1]));

    for (const [key] of retainedScopedItems.slice(policy.maxProjectMemoryItems)) {
      this.scopedItems.delete(key);
    }

    this.entries = this.entries.filter((entry) => Date.parse(entry.createdAt) >= cutoffTime);
    this.persist();

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
    this.persist();
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
      this.persist();
      return;
    }

    this.entries = this.entries.filter((entry) => entry.sessionId !== sessionId);
    this.persist();
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    const data = JSON.parse(readFileSync(this.filePath, 'utf8')) as FileBackedMemoryData;
    this.entries = data.entries ?? [];
    this.scopedItems = new Map(data.scopedItems ?? []);
  }

  private persist(): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(
      this.filePath,
      JSON.stringify(
        {
          version: 1,
          entries: this.entries,
          scopedItems: Array.from(this.scopedItems.entries())
        } satisfies FileBackedMemoryData,
        null,
        2
      ),
      'utf8'
    );
  }

  private scopedKey(scope: GomiMemoryScope, key: string): string {
    return `${this.scopePrefix(scope)}${key}`;
  }

  private scopePrefix(scope: GomiMemoryScope): string {
    return `${scope.workspaceId}:${scope.userId ?? 'anonymous'}:${scope.threadId ?? 'default'}:`;
  }
}

export class FileBackedVectorMemoryStore implements GomiVectorMemoryStore {
  private records = new Map<string, GomiVectorMemoryRecord>();

  constructor(
    private readonly filePath: string,
    private readonly embeddingProvider: GomiEmbeddingProvider = new HashingEmbeddingProvider()
  ) {
    this.load();
  }

  async upsert(
    scope: GomiMemoryScope,
    item: Omit<GomiMemoryItem, 'createdAt' | 'updatedAt'>
  ): Promise<GomiMemoryItem> {
    const key = this.scopedKey(scope, item.key);
    const existingRecord = this.records.get(key);
    const nextItem: GomiMemoryItem = {
      ...item,
      createdAt: existingRecord?.createdAt ?? new Date().toISOString(),
      updatedAt: existingRecord ? new Date().toISOString() : undefined
    };
    const vector = await this.embeddingProvider.embed(memorySearchText(nextItem));

    this.records.set(key, {
      ...nextItem,
      vector
    });
    this.persist();
    return nextItem;
  }

  async search(scope: GomiMemoryScope, query: string, limit = 8): Promise<GomiMemoryHit[]> {
    const queryVector = await this.embeddingProvider.embed(query);
    const scopePrefix = this.scopePrefix(scope);

    return Array.from(this.records.entries())
      .filter(([key]) => key.startsWith(scopePrefix))
      .map(([, record]) => ({
        key: record.key,
        value: record.value,
        tags: record.tags,
        importance: record.importance,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        metadata: record.metadata,
        score: cosineSimilarity(queryVector, record.vector) + (record.importance ?? 0) * 0.08
      }))
      .filter((hit) => hit.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);
  }

  prune(scope: GomiMemoryScope, policy: GomiMemoryRetentionPolicy): GomiMemoryPruneReport {
    const scopePrefix = this.scopePrefix(scope);
    const cutoffTime = Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000;
    const scopedRecords = Array.from(this.records.entries())
      .filter(([key]) => key.startsWith(scopePrefix))
      .sort((left, right) => memoryTimestamp(right[1]) - memoryTimestamp(left[1]));
    const scopedCountBefore = scopedRecords.length;

    for (const [key, record] of scopedRecords) {
      if (memoryTimestamp(record) < cutoffTime) {
        this.records.delete(key);
      }
    }

    const retainedScopedRecords = Array.from(this.records.entries())
      .filter(([key]) => key.startsWith(scopePrefix))
      .sort((left, right) => memoryTimestamp(right[1]) - memoryTimestamp(left[1]));

    for (const [key] of retainedScopedRecords.slice(policy.maxProjectMemoryItems)) {
      this.records.delete(key);
    }

    this.persist();

    const remaining = Array.from(this.records.keys()).filter((key) =>
      key.startsWith(scopePrefix)
    ).length;

    return {
      removed: scopedCountBefore - remaining,
      remaining
    };
  }

  clear(scope?: GomiMemoryScope): void {
    if (!scope) {
      this.records.clear();
      this.persist();
      return;
    }

    const scopePrefix = this.scopePrefix(scope);

    for (const key of Array.from(this.records.keys())) {
      if (key.startsWith(scopePrefix)) {
        this.records.delete(key);
      }
    }

    this.persist();
  }

  private load(): void {
    if (!existsSync(this.filePath)) {
      return;
    }

    const data = JSON.parse(readFileSync(this.filePath, 'utf8')) as FileBackedVectorMemoryData;
    this.records = new Map(data.records ?? []);
  }

  private persist(): void {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(
      this.filePath,
      JSON.stringify(
        {
          version: 1,
          records: Array.from(this.records.entries())
        } satisfies FileBackedVectorMemoryData,
        null,
        2
      ),
      'utf8'
    );
  }

  private scopedKey(scope: GomiMemoryScope, key: string): string {
    return `${this.scopePrefix(scope)}${key}`;
  }

  private scopePrefix(scope: GomiMemoryScope): string {
    return `${scope.workspaceId}:${scope.userId ?? 'anonymous'}:${scope.threadId ?? 'default'}:`;
  }
}

export function createFileBackedGomiMemoryStore(filePath: string): GomiMemoryStore {
  return new FileBackedGomiMemoryStore(filePath);
}

export function createFileBackedVectorMemoryStore(
  filePath: string,
  embeddingProvider: GomiEmbeddingProvider = new HashingEmbeddingProvider()
): GomiVectorMemoryStore {
  return new FileBackedVectorMemoryStore(filePath, embeddingProvider);
}

function scoreMemoryItem(item: GomiMemoryItem, normalizedQuery: string): number {
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

function memorySearchText(item: GomiMemoryItem): string {
  return [item.key, item.value, ...(item.tags ?? [])].join('\n');
}

function memoryTimestamp(item: Pick<GomiMemoryItem, 'createdAt' | 'updatedAt'>): number {
  return Date.parse(item.updatedAt ?? item.createdAt);
}
