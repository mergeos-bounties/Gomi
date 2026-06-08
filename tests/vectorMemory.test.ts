import { describe, expect, it } from 'vitest';
import { HashingEmbeddingProvider, cosineSimilarity } from '../src/vs/workbench/contrib/gomi/node/embeddingProvider';
import { createInMemoryVectorMemoryStore } from '../src/vs/workbench/contrib/gomi/node/vectorMemoryStore';

describe('vector project memory', () => {
  it('creates normalized embeddings with useful similarity', async () => {
    const provider = new HashingEmbeddingProvider(64);
    const apiVector = await provider.embed('backend api controller service');
    const similarVector = await provider.embed('api service controller');
    const unrelatedVector = await provider.embed('pink visual office avatar');

    expect(cosineSimilarity(apiVector, similarVector)).toBeGreaterThan(
      cosineSimilarity(apiVector, unrelatedVector)
    );
  });

  it('retrieves project memory by semantic query inside the same scope', async () => {
    const memory = createInMemoryVectorMemoryStore(new HashingEmbeddingProvider(64));
    const scope = { workspaceId: 'Gomi' };

    await memory.upsert(scope, {
      key: 'backend:routes',
      value: 'The Laravel login API uses controllers, services, and route middleware.',
      tags: ['backend', 'api'],
      importance: 0.8
    });
    await memory.upsert(scope, {
      key: 'ui:avatar',
      value: 'The Phaser office scene renders cute animated agent avatars.',
      tags: ['frontend', 'phaser'],
      importance: 0.6
    });

    const hits = await memory.search(scope, 'controller api service', 1);

    expect(hits[0]?.key).toBe('backend:routes');
  });
});
