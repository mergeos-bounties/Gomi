import { describe, expect, it } from 'vitest';
import {
  buildSettingsSearchIndex,
  matchesSettingsSearch,
  searchSettings
} from '../src/vs/workbench/contrib/gomi/common/settingsSearch';

describe('settingsSearch', () => {
  const fields = [
    { key: 'memory.retentionDays', label: 'Retention Days', value: 30, section: 'memory' },
    { key: 'execution.maxConcurrent', label: 'Max Concurrent', value: 4, section: 'execution' },
    { key: 'memory.embeddingProvider', label: 'Embedding Provider', value: 'local-hashing', section: 'memory' },
  ];

  it('filters by keyword', () => {
    const r = searchSettings(fields, 'memory');
    expect(r).toHaveLength(2);
  });

  it('returns all when query is empty', () => {
    expect(searchSettings(fields, '')).toHaveLength(3);
  });

  it('handles no match', () => {
    expect(searchSettings(fields, 'zzz')).toHaveLength(0);
  });

  it('builds search index from settings object', () => {
    const idx = buildSettingsSearchIndex({
      memory: { retentionDays: 30 },
      execution: { maxConcurrent: 4 },
    });
    expect(idx.length).toBeGreaterThan(0);
    expect(idx.find((f) => f.key === 'memory.retentionDays')).toBeTruthy();
  });

  it('matches multi-term section metadata', () => {
    expect(matchesSettingsSearch(['Shared Memory', { retentionDays: 30 }], 'memory retention')).toBe(true);
    expect(matchesSettingsSearch(['Execution Policy', { allowHttpProviders: true }], 'memory retention')).toBe(false);
  });
});
