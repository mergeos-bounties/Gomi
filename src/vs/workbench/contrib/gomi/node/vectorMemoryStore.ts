import type {
  GomiMemoryHit,
  GomiMemoryItem,
  GomiMemoryRetentionPolicy,
  GomiMemoryScope
} from './memoryStore';
import {
  cosineSimilarity,
  HashingEmbeddingProvider,
  type GomiEmbeddingProvider
} from './embeddingProvider';

export interface GomiVectorMemoryRecord extends GomiMemoryItem {
  vector: number[];
}

export interface GomiVectorMemoryStore {
  upsert(scope: GomiMemoryScope, item: Omit<GomiMemoryItem, 'createdAt' | 'updatedAt'>): Promise<GomiMemoryItem>;
  search(scope: GomiMemoryScope, query: string, limit?: number): Promise<GomiMemoryHit[]>;
  prune(scope: GomiMemoryScope, policy: GomiMemoryRetentionPolicy): void;
  clear(scope?: GomiMemoryScope): void;
}

export class InMemoryVectorMemoryStore implements GomiVectorMemoryStore {
  private readonly records = new Map<string, GomiVectorMemoryRecord>();

  constructor(private readonly embeddingProvider: GomiEmbeddingProvider = new HashingEmbeddingProvider()) {}

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

  prune(scope: GomiMemoryScope, policy: GomiMemoryRetentionPolicy): void {
    const scopePrefix = this.scopePrefix(scope);
    const cutoffTime = Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000;
    const scopedRecords = Array.from(this.records.entries())
      .filter(([key]) => key.startsWith(scopePrefix))
      .sort((left, right) => memoryTimestamp(right[1]) - memoryTimestamp(left[1]));

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
  }

  clear(scope?: GomiMemoryScope): void {
    if (!scope) {
      this.records.clear();
      return;
    }

    const scopePrefix = this.scopePrefix(scope);

    for (const key of this.records.keys()) {
      if (key.startsWith(scopePrefix)) {
        this.records.delete(key);
      }
    }
  }

  private scopedKey(scope: GomiMemoryScope, key: string): string {
    return `${this.scopePrefix(scope)}${key}`;
  }

  private scopePrefix(scope: GomiMemoryScope): string {
    return `${scope.workspaceId}:${scope.userId ?? 'anonymous'}:${scope.threadId ?? 'default'}:`;
  }
}

export function createInMemoryVectorMemoryStore(
  embeddingProvider: GomiEmbeddingProvider = new HashingEmbeddingProvider()
): GomiVectorMemoryStore {
  return new InMemoryVectorMemoryStore(embeddingProvider);
}

function memorySearchText(item: GomiMemoryItem): string {
  return [item.key, item.value, ...(item.tags ?? [])].join('\n');
}

function memoryTimestamp(item: Pick<GomiMemoryItem, 'createdAt' | 'updatedAt'>): number {
  return Date.parse(item.updatedAt ?? item.createdAt);
}
