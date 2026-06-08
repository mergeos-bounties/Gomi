import { describe, expect, it } from 'vitest';
import {
  HashingEmbeddingProvider,
  HttpEmbeddingProvider,
  cosineSimilarity,
  createConfiguredEmbeddingProvider
} from '../src/vs/workbench/contrib/gomi/node/embeddingProvider';
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

  it('can call an OpenAI-compatible embedding endpoint and normalize the returned vector', async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = [];
    const provider = new HttpEmbeddingProvider({
      enabled: true,
      route: {
        mode: 'openai-compatible',
        endpoint: 'https://llm.example.test/v1/embeddings',
        apiKey: 'test-key',
        model: 'embedding-model'
      },
      fetchImpl: async (input, init) => {
        requests.push({ input, init });

        return new Response(
          JSON.stringify({
            data: [
              {
                embedding: [3, 4]
              }
            ]
          }),
          {
            status: 200,
            headers: {
              'content-type': 'application/json'
            }
          }
        );
      }
    });

    const vector = await provider.embed('login controller');
    const body = JSON.parse(String(requests[0]?.init?.body)) as {
      input?: string;
      model?: string;
    };

    expect(requests[0]?.input).toBe('https://llm.example.test/v1/embeddings');
    expect(requests[0]?.init?.headers).toMatchObject({
      authorization: 'Bearer test-key'
    });
    expect(body).toEqual({
      input: 'login controller',
      model: 'embedding-model'
    });
    expect(vector).toEqual([0.6, 0.8]);
  });

  it('supports local Ollama-style embedding payloads', async () => {
    const provider = new HttpEmbeddingProvider({
      enabled: true,
      route: {
        mode: 'ollama-embeddings',
        endpoint: 'http://127.0.0.1:11434/api/embeddings',
        model: 'nomic-embed-text'
      },
      fetchImpl: async (_input, init) => {
        const body = JSON.parse(String(init?.body)) as {
          prompt?: string;
          model?: string;
        };

        expect(body).toEqual({
          model: 'nomic-embed-text',
          prompt: 'project memory'
        });

        return new Response(JSON.stringify({ embedding: [0, 2] }), { status: 200 });
      }
    });

    await expect(provider.embed('project memory')).resolves.toEqual([0, 1]);
  });

  it('falls back to local hashing when HTTP embeddings are disabled or fail', async () => {
    const fallback = new HashingEmbeddingProvider(32);
    const disabled = createConfiguredEmbeddingProvider({
      enabled: false,
      fallbackProvider: fallback,
      fetchImpl: async () => {
        throw new Error('Should not call HTTP when disabled.');
      }
    });
    const failing = new HttpEmbeddingProvider({
      enabled: true,
      fallbackProvider: fallback,
      route: {
        mode: 'openai-compatible',
        endpoint: 'https://llm.example.test/v1/embeddings',
        model: 'embedding-model'
      },
      fetchImpl: async () => {
        throw new Error('Network unavailable');
      }
    });

    await expect(disabled.embed('backend api')).resolves.toHaveLength(32);
    await expect(failing.embed('backend api')).resolves.toHaveLength(32);
  });
});
