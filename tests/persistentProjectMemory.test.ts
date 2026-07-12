import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GomiMemoryScope } from '../src/vs/workbench/contrib/gomi/node/memoryStore';
import {
  FileBackedGomiMemoryStore,
  FileBackedVectorMemoryStore
} from '../src/vs/workbench/contrib/gomi/node/persistentProjectMemory';

let tempDirectory: string;

beforeEach(async () => {
  tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'gomi-memory-'));
});

afterEach(async () => {
  await fs.rm(tempDirectory, { recursive: true, force: true });
});

describe('persistent project memory', () => {
  it('persists lexical scoped memory and session entries across store instances', async () => {
    const filePath = path.join(tempDirectory, 'lexical-memory.json');
    const scope: GomiMemoryScope = {
      workspaceId: 'Gomi',
      threadId: 'main'
    };
    const firstStore = new FileBackedGomiMemoryStore(filePath);

    await firstStore.put(scope, {
      key: 'workspace:routes',
      value: 'Laravel routes include login and user APIs.',
      tags: ['backend', 'routes'],
      importance: 0.84
    });
    firstStore.add({
      sessionId: 'session-1',
      kind: 'request',
      content: 'Review login API'
    });

    const secondStore = new FileBackedGomiMemoryStore(filePath);
    const item = await secondStore.get(scope, 'workspace:routes');
    const hits = await secondStore.search(scope, 'login routes', 3);

    expect(item?.value).toContain('login');
    expect(hits.map((hit) => hit.key)).toContain('workspace:routes');
    expect(secondStore.recent('session-1', 1)[0]?.content).toBe('Review login API');
  });

  it('persists vector memory across store instances', async () => {
    const filePath = path.join(tempDirectory, 'vector-memory.json');
    const scope: GomiMemoryScope = {
      workspaceId: 'Gomi'
    };
    const firstStore = new FileBackedVectorMemoryStore(filePath);

    await firstStore.upsert(scope, {
      key: 'agent:backend:login',
      value: 'Backend login controller validates user sessions and middleware.',
      tags: ['backend', 'login'],
      importance: 0.9
    });

    const secondStore = new FileBackedVectorMemoryStore(filePath);
    const hits = await secondStore.search(scope, 'controller session middleware', 1);

    expect(hits[0]?.key).toBe('agent:backend:login');
    expect(hits[0]?.score).toBeGreaterThan(0);
  });

  it('clears only the requested vector memory scope', async () => {
    const filePath = path.join(tempDirectory, 'vector-memory.json');
    const store = new FileBackedVectorMemoryStore(filePath);
    const gomiScope: GomiMemoryScope = { workspaceId: 'Gomi' };
    const otherScope: GomiMemoryScope = { workspaceId: 'Other' };

    await store.upsert(gomiScope, {
      key: 'workspace:file-tree',
      value: 'Gomi source tree',
      tags: ['workspace'],
      importance: 0.6
    });
    await store.upsert(otherScope, {
      key: 'workspace:file-tree',
      value: 'Other project tree',
      tags: ['workspace'],
      importance: 0.6
    });

    store.clear(gomiScope);

    expect(await store.search(gomiScope, 'source tree', 3)).toHaveLength(0);
    expect((await store.search(otherScope, 'project tree', 3))[0]?.key).toBe('workspace:file-tree');
  });

  it('prunes expired lexical memory and caps scoped project memory', async () => {
    const filePath = path.join(tempDirectory, 'lexical-memory.json');
    const scope: GomiMemoryScope = { workspaceId: 'Gomi' };
    const scopePrefix = 'Gomi:anonymous:default:';
    const expiredDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date().toISOString();

    await fs.writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'memory-old',
            sessionId: 'session-1',
            kind: 'request',
            content: 'Old request',
            createdAt: expiredDate
          },
          {
            id: 'memory-new',
            sessionId: 'session-1',
            kind: 'request',
            content: 'Fresh request',
            createdAt: recentDate
          }
        ],
        scopedItems: [
          [
            `${scopePrefix}old`,
            {
              key: 'old',
              value: 'Expired context',
              createdAt: expiredDate
            }
          ],
          [
            `${scopePrefix}newer`,
            {
              key: 'newer',
              value: 'Fresh context',
              createdAt: recentDate
            }
          ],
          [
            `${scopePrefix}newest`,
            {
              key: 'newest',
              value: 'Freshest context',
              createdAt: new Date(Date.now() + 1000).toISOString()
            }
          ]
        ]
      }),
      'utf8'
    );

    const store = new FileBackedGomiMemoryStore(filePath);
    store.prune(scope, {
      retentionDays: 30,
      maxProjectMemoryItems: 1
    });

    expect(await store.get(scope, 'old')).toBeNull();
    expect(await store.get(scope, 'newer')).toBeNull();
    expect((await store.get(scope, 'newest'))?.value).toBe('Freshest context');
    expect(store.list('session-1').map((entry) => entry.content)).toEqual(['Fresh request']);
  });

  it('reports lexical prune removal and remaining counts', async () => {
    const filePath = path.join(tempDirectory, 'lexical-memory.json');
    const scope: GomiMemoryScope = { workspaceId: 'Gomi' };
    const scopePrefix = 'Gomi:anonymous:default:';
    const expiredDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date().toISOString();

    await fs.writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        entries: [
          {
            id: 'memory-old',
            sessionId: 'session-1',
            kind: 'request',
            content: 'Old request',
            createdAt: expiredDate
          },
          {
            id: 'memory-new',
            sessionId: 'session-1',
            kind: 'request',
            content: 'Fresh request',
            createdAt: recentDate
          }
        ],
        scopedItems: [
          [
            `${scopePrefix}old`,
            {
              key: 'old',
              value: 'Expired context',
              createdAt: expiredDate
            }
          ],
          [
            `${scopePrefix}newer`,
            {
              key: 'newer',
              value: 'Fresh context',
              createdAt: recentDate
            }
          ],
          [
            `${scopePrefix}newest`,
            {
              key: 'newest',
              value: 'Freshest context',
              createdAt: new Date(Date.now() + 1000).toISOString()
            }
          ]
        ]
      }),
      'utf8'
    );

    const store = new FileBackedGomiMemoryStore(filePath);
    const report = store.prune(scope, {
      retentionDays: 30,
      maxProjectMemoryItems: 1
    });

    expect(report).toEqual({
      removed: 3,
      remaining: 2
    });
  });

  it('prunes vector memory by scope retention and max project items', async () => {
    const filePath = path.join(tempDirectory, 'vector-memory.json');
    const scope: GomiMemoryScope = { workspaceId: 'Gomi' };
    const scopePrefix = 'Gomi:anonymous:default:';
    const expiredDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date().toISOString();

    await fs.writeFile(
      filePath,
      JSON.stringify({
        version: 1,
        records: [
          [
            `${scopePrefix}old`,
            {
              key: 'old',
              value: 'Expired vector context',
              tags: ['old'],
              importance: 0.7,
              createdAt: expiredDate,
              vector: [1, 0, 0]
            }
          ],
          [
            `${scopePrefix}newer`,
            {
              key: 'newer',
              value: 'Fresh vector context',
              tags: ['newer'],
              importance: 0.7,
              createdAt: recentDate,
              vector: [0, 1, 0]
            }
          ],
          [
            `${scopePrefix}newest`,
            {
              key: 'newest',
              value: 'Freshest vector context',
              tags: ['newest'],
              importance: 0.9,
              createdAt: new Date(Date.now() + 1000).toISOString(),
              vector: [0, 0, 1]
            }
          ]
        ]
      }),
      'utf8'
    );

    const store = new FileBackedVectorMemoryStore(filePath);
    store.prune(scope, {
      retentionDays: 30,
      maxProjectMemoryItems: 1
    });

    const hits = await store.search(scope, 'vector context', 5);

    expect(hits.map((hit) => hit.key)).toEqual(['newest']);
  });
});
