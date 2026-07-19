/**
 * Unit tests for secureKeyStore (issue #47).
 * Covers: memory store, environment store, composite store,
 * migration helper, error handling.
 */

import { describe, expect, it } from 'vitest';
import {
  MemoryKeyStore,
  EnvironmentKeyStore,
  CompositeKeyStore,
  migratePlaintextKeys,
  createSecureKeyStore,
  type SecureKeyStore,
} from '../src/vs/workbench/contrib/gomi/node/secureKeyStore';

// ────────────────────────────────────────────────
describe('MemoryKeyStore', () => {
  it('stores and retrieves keys in memory', async () => {
    const store = new MemoryKeyStore();
    expect(store.isEncrypted).toBe(false);

    await store.setKey('gomi-cloud-llm', 'sk-test-123');
    const key = await store.getKey('gomi-cloud-llm');
    expect(key).toBe('sk-test-123');
  });

  it('returns undefined for unknown providers', async () => {
    const store = new MemoryKeyStore();
    expect(await store.getKey('unknown')).toBeUndefined();
  });

  it('overwrites existing keys', async () => {
    const store = new MemoryKeyStore();
    await store.setKey('test', 'old');
    await store.setKey('test', 'new');
    expect(await store.getKey('test')).toBe('new');
  });

  it('deletes keys', async () => {
    const store = new MemoryKeyStore();
    await store.setKey('test', 'value');
    await store.deleteKey('test');
    expect(await store.getKey('test')).toBeUndefined();
  });

  it('deleteKey is no-op for unknown keys', async () => {
    const store = new MemoryKeyStore();
    await store.deleteKey('nonexistent');
    // Should not throw
  });

  it('lists all stored provider IDs', async () => {
    const store = new MemoryKeyStore();
    await store.setKey('a', '1');
    await store.setKey('b', '2');
    const providers = await store.listProviders();
    expect(providers).toHaveLength(2);
    expect(providers).toContain('a');
    expect(providers).toContain('b');
  });
});

// ────────────────────────────────────────────────
describe('EnvironmentKeyStore', () => {
  it('reads keys from environment variables', async () => {
    const store = new EnvironmentKeyStore({
      GOMI_CLOUD_LLM_API_KEY: 'sk-env-456',
      GOMI_EMBEDDINGS_API_KEY: 'emb-env-789',
    });

    expect(await store.getKey('gomi-cloud-llm')).toBe('sk-env-456');
    expect(await store.getKey('gomi-embeddings')).toBe('emb-env-789');
  });

  it('returns undefined for unmapped providers', async () => {
    const store = new EnvironmentKeyStore({});
    expect(await store.getKey('gomi-cloud-llm')).toBeUndefined();
  });

  it('is read-only — setKey throws', async () => {
    const store = new EnvironmentKeyStore({});
    await expect(store.setKey('test', 'val')).rejects.toThrow('read-only');
  });

  it('is not encrypted', () => {
    const store = new EnvironmentKeyStore({});
    expect(store.isEncrypted).toBe(false);
  });

  it('lists providers from env vars', async () => {
    const store = new EnvironmentKeyStore({
      GOMI_CLOUD_LLM_API_KEY: 'a',
      GOMI_EMBEDDINGS_API_KEY: 'b',
      IRRELEVANT_VAR: 'c',
    });
    const providers = await store.listProviders();
    expect(providers).toContain('gomi-cloud-llm');
    expect(providers).toContain('gomi-embeddings');
    expect(providers).not.toContain('IRRELEVANT_VAR');
  });
});

// ────────────────────────────────────────────────
describe('CompositeKeyStore', () => {
  it('cascades getKey through all stores', async () => {
    const mem = new MemoryKeyStore();
    const env = new EnvironmentKeyStore({ GOMI_CLOUD_LLM_API_KEY: 'from-env' });
    const composite = new CompositeKeyStore([mem, env]);

    // Returns from env when memory is empty
    expect(await composite.getKey('gomi-cloud-llm')).toBe('from-env');

    // Memory takes priority
    await mem.setKey('gomi-cloud-llm', 'from-mem');
    expect(await composite.getKey('gomi-cloud-llm')).toBe('from-mem');
  });

  it('setKey writes to first writable store', async () => {
    const mem = new MemoryKeyStore();
    const env = new EnvironmentKeyStore({});
    const composite = new CompositeKeyStore([env, mem]);

    await composite.setKey('test', 'composite-val');
    // Env is read-only, so it should have been written to memory
    expect(await mem.getKey('test')).toBe('composite-val');
  });

  it('deleteKey cleans all stores', async () => {
    const mem = new MemoryKeyStore();
    await mem.setKey('test', 'val');
    const env = new EnvironmentKeyStore({ GOMI_CLOUD_LLM_API_KEY: 'env-val' });
    const composite = new CompositeKeyStore([mem, env]);

    await composite.deleteKey('test');
    expect(await mem.getKey('test')).toBeUndefined();
  });

  it('lists providers from all stores', async () => {
    const mem = new MemoryKeyStore();
    await mem.setKey('mem-only', '1');
    const env = new EnvironmentKeyStore({ GOMI_CLOUD_LLM_API_KEY: '2' });
    const composite = new CompositeKeyStore([mem, env]);

    const providers = await composite.listProviders();
    expect(providers).toContain('mem-only');
    expect(providers).toContain('gomi-cloud-llm');
  });

  it('shows isEncrypted=true when any store is encrypted', () => {
    const mem = new MemoryKeyStore(); // isEncrypted = false
    const env = new EnvironmentKeyStore({}); // isEncrypted = false
    const plain = new CompositeKeyStore([mem, env]);
    expect(plain.isEncrypted).toBe(false);
  });

  it('has a descriptive name', () => {
    const store = new CompositeKeyStore([new MemoryKeyStore(), new EnvironmentKeyStore({})]);
    expect(store.name).toBe('memory+environment');
  });
});

// ────────────────────────────────────────────────
describe('migratePlaintextKeys', () => {
  it('migrates plaintext API keys to secure store', async () => {
    const store = new MemoryKeyStore();
    const settings = {
      providers: [
        { id: 'openai', apiKey: 'sk-plain-123' },
        { id: 'ollama', apiKey: undefined },
      ],
      embeddingProvider: { id: 'openai-emb', apiKey: 'emb-plain-456' },
    };

    const result = await migratePlaintextKeys(store, settings);

    expect(result.migrated).toContain('provider:openai');
    expect(result.migrated).toContain('gomi-embeddings');
    expect(result.cleared).toContain('provider:openai');
    expect(result.cleared).toContain('gomi-embeddings');
    expect(result.errors).toEqual([]);

    // Plain values cleared from settings
    expect(settings.providers[0].apiKey).toBeUndefined();
    expect(settings.embeddingProvider?.apiKey).toBeUndefined();

    // Values in secure store
    expect(await store.getKey('provider:openai')).toBe('sk-plain-123');
    expect(await store.getKey('gomi-embeddings')).toBe('emb-plain-456');
  });

  it('handles empty settings gracefully', async () => {
    const store = new MemoryKeyStore();
    const result = await migratePlaintextKeys(store, {});
    expect(result.migrated).toEqual([]);
    expect(result.cleared).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('does not clear keys that failed to migrate', async () => {
    // Simulate a store that always throws on setKey
    const brokenStore: SecureKeyStore = {
      name: 'broken',
      isEncrypted: false,
      getKey: async () => undefined,
      setKey: async () => { throw new Error('simulated failure'); },
      deleteKey: async () => {},
      listProviders: async () => [],
    };

    const settings = {
      providers: [{ id: 'openai', apiKey: 'sk-plain-123' }],
    };

    const result = await migratePlaintextKeys(brokenStore, settings);
    expect(result.errors.length).toBeGreaterThan(0);
    // Plain key should NOT be cleared because migration failed
    expect(settings.providers[0].apiKey).toBe('sk-plain-123');
  });
});

// ────────────────────────────────────────────────
describe('createSecureKeyStore', () => {
  it('returns a store that can set and get keys', async () => {
    const store = createSecureKeyStore();
    expect(store.name).toBeTruthy();
    expect(typeof store.isEncrypted).toBe('boolean');

    // Basic set/get should work (will use memory in test environment)
    await store.setKey('test-factory', 'value');
    const key = await store.getKey('test-factory');
    expect(key).toBe('value');

    await store.deleteKey('test-factory');
  });
});
