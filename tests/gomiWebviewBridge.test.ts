import { describe, expect, it } from 'vitest';
import type { GomiBridgeMessage } from '../src/vs/workbench/contrib/gomi/electron-sandbox/gomiBridge';
import {
  createGomiWebviewBridge,
  createGomiWebviewStateStore,
  isGomiBridgeMessage,
  resolveGomiWebviewBridge,
  resolveGomiWebviewBridgeContext,
  type GomiMessageEventTarget,
  type GomiVsCodeWebviewApi,
  type GomiWebviewBridgeGlobal
} from '../src/vs/workbench/contrib/gomi/browser/gomiWebviewBridge';

describe('Gomi webview bridge', () => {
  it('stays disabled until the native host explicitly enables it', () => {
    const api = new MemoryVsCodeApi();
    const target = new MemoryMessageTarget();
    const bridge = resolveGomiWebviewBridge(
      {
        acquireVsCodeApi: () => api,
        __GOMI_ENABLE_WORKBENCH_BRIDGE__: false
      },
      target
    );

    expect(bridge).toBeUndefined();
  });

  it('posts and receives Gomi messages when enabled', () => {
    const api = new MemoryVsCodeApi();
    const target = new MemoryMessageTarget();
    const bridge = resolveGomiWebviewBridge(
      {
        acquireVsCodeApi: () => api,
        __GOMI_ENABLE_WORKBENCH_BRIDGE__: true
      },
      target
    );
    const received: GomiBridgeMessage[] = [];
    const unsubscribe = bridge?.onMessage((message) => received.push(message));

    bridge?.postMessage({
      type: 'gomi.run',
      request: 'Review workspace'
    });
    bridge?.postMessage({
      type: 'gomi.stop',
      reason: 'Stop bridge test'
    });
    bridge?.postMessage({
      type: 'gomi.openProject',
      project: {
        id: 'project-gomi',
        name: 'Gomi IDE',
        path: '/workspaces/gomi',
        lastOpenedAt: '2026-07-15T10:00:00.000Z'
      }
    });
    target.emit({
      protocolVersion: 1,
      type: 'gomi.applyPatchResult',
      patchId: 'patch-1',
      result: {
        patchId: 'patch-1',
        dryRun: false,
        appliedFiles: ['README.md'],
        deletedFiles: []
      }
    });
    target.emit({ type: 'not-gomi' });
    unsubscribe?.();
    target.emit({
      protocolVersion: 1,
      type: 'gomi.applyPatchResult',
      patchId: 'patch-2'
    });

    expect(api.outbox).toEqual([
      {
        protocolVersion: 1,
        type: 'gomi.run',
        request: 'Review workspace'
      },
      {
        protocolVersion: 1,
        type: 'gomi.stop',
        reason: 'Stop bridge test'
      },
      {
        protocolVersion: 1,
        type: 'gomi.openProject',
        project: {
          id: 'project-gomi',
          name: 'Gomi IDE',
          path: '/workspaces/gomi',
          lastOpenedAt: '2026-07-15T10:00:00.000Z'
        }
      }
    ]);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      type: 'gomi.applyPatchResult',
      patchId: 'patch-1'
    });
  });

  it('resolves bridge and webview state store from one VS Code API handle', () => {
    const api = new MemoryVsCodeApi();
    const target = new MemoryMessageTarget();
    const context = resolveGomiWebviewBridgeContext(
      {
        acquireVsCodeApi: () => api,
        __GOMI_ENABLE_WORKBENCH_BRIDGE__: true
      },
      target
    );

    context?.stateStore.setState({ persisted: true });
    context?.bridge.postMessage({
      type: 'gomi.run',
      request: 'Persisted bridge'
    });

    expect(api.state).toEqual({ persisted: true });
    expect(context?.stateStore.getState()).toEqual({ persisted: true });
    expect(api.outbox[0]).toMatchObject({
      protocolVersion: 1,
      type: 'gomi.run',
      request: 'Persisted bridge'
    });
  });

  it('keeps an in-memory state fallback when the VS Code API omits state methods', () => {
    const api = {
      postMessage(message: GomiBridgeMessage) {
        void message;
      }
    };
    const stateStore = createGomiWebviewStateStore(api);

    stateStore.setState({ office: 'Gomi' });

    expect(stateStore.getState()).toEqual({ office: 'Gomi' });
  });

  it('filters bridge messages by Gomi namespace', () => {
    expect(isGomiBridgeMessage({ protocolVersion: 1, type: 'gomi.stop' })).toBe(true);
    expect(isGomiBridgeMessage({ type: 'gomi.stop' })).toBe(false);
    expect(isGomiBridgeMessage({ protocolVersion: 2, type: 'gomi.stop' })).toBe(false);
    expect(isGomiBridgeMessage({ protocolVersion: 1, type: 'gomi.danger' })).toBe(false);
    expect(isGomiBridgeMessage({ protocolVersion: 1, type: 'workspace.event' })).toBe(false);
    expect(isGomiBridgeMessage(undefined)).toBe(false);
  });

  it('validates recent-project open messages at the webview boundary', () => {
    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.openProject',
      project: {
        id: 'project-gomi',
        name: 'Gomi IDE',
        path: '/workspaces/gomi',
        lastOpenedAt: '2026-07-15T10:00:00.000Z'
      }
    })).toBe(true);
    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.openProject',
      project: {
        id: 'project-bad',
        name: 'Bad Project',
        path: 'bad\u0000path',
        lastOpenedAt: '2026-07-15T10:00:00.000Z'
      }
    })).toBe(false);
  });

  it('rejects malformed or oversized privileged webview payloads', () => {
    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.run',
      request: 'x'.repeat(70_000)
    })).toBe(false);
    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.run',
      request: 'Review workspace',
      officeSettings: {
        seats: 'not-an-array',
        memory: {},
        execution: {}
      }
    })).toBe(false);
    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.applyPatch',
      patch: {
        id: 'patch-escape',
        filePath: '../secret.txt',
        targetFiles: ['README.md'],
        summary: 'Unsafe patch.',
        diff: 'diff --git a/README.md b/README.md\n@@ -1 +1 @@\n-old\n+new',
        approvalStatus: 'approved',
        riskLevel: 'low',
        createdByAgentId: 'ceo'
      }
    })).toBe(false);
  });

  it('rejects non-integer values where integers are required', () => {
    const baseSettings = {
      seats: [],
      memory: {
        retrievalMode: 'hybrid-vector' as const,
        embeddingProvider: 'local-hashing' as const,
        embeddingExecutionEnabled: true,
        sharedMemoryEnabled: true,
        indexWorkspaceContext: true,
        indexTerminalSnippets: true,
        privacyMode: 'standard' as const,
        redactSecrets: true,
        retentionDays: 90,
        maxProjectMemoryItems: 100,
        broadcastThreshold: 0.5,
        requirePatchApproval: true
      },
      execution: {
        workspaceTrust: 'trusted' as const,
        liveProviderMode: 'demo-only' as const,
        allowCliProviders: true,
        allowHttpProviders: false,
        requirePatchApprovalForLiveProviders: true,
        maxConcurrentAgentRuns: 4,
        httpMaxRetries: 3
      }
    };

    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.run',
      request: 'Test',
      officeSettings: {
        ...baseSettings,
        memory: { ...baseSettings.memory, retentionDays: 90.5 }
      }
    })).toBe(false);

    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.run',
      request: 'Test',
      officeSettings: {
        ...baseSettings,
        memory: { ...baseSettings.memory, maxProjectMemoryItems: 100.1 }
      }
    })).toBe(false);

    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.run',
      request: 'Test',
      officeSettings: {
        ...baseSettings,
        execution: { ...baseSettings.execution, maxConcurrentAgentRuns: 2.5 }
      }
    })).toBe(false);

    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.run',
      request: 'Test',
      officeSettings: {
        ...baseSettings,
        execution: { ...baseSettings.execution, httpMaxRetries: 1.5 }
      }
    })).toBe(false);
  });

  it('rejects gomi.event payloads exceeding max message size', () => {
    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.event',
      event: { huge: 'x'.repeat(70_000) }
    })).toBe(false);
  });

  it('rejects project paths containing directory traversal', () => {
    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.openProject',
      project: {
        id: 'project-traversal',
        name: 'Traversal',
        path: '../../etc/passwd',
        lastOpenedAt: '2026-07-15T10:00:00.000Z'
      }
    })).toBe(false);

    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.openProject',
      project: {
        id: 'project-traversal',
        name: 'Traversal',
        path: '/workspaces/../etc',
        lastOpenedAt: '2026-07-15T10:00:00.000Z'
      }
    })).toBe(false);
  });

  it('rejects messages with __proto__ or constructor key injection', () => {
    expect(isGomiBridgeMessage({
      protocolVersion: 1,
      type: 'gomi.stop',
      ['__proto__']: { type: 'gomi.run' }
    })).toBe(false);

    const msg = {
      protocolVersion: 1,
      type: 'gomi.stop' as const,
    };
    (msg as Record<string, unknown>)['constructor'] = { type: 'gomi.run' };

    expect(isGomiBridgeMessage(msg)).toBe(false);
  });
});

class MemoryVsCodeApi implements GomiVsCodeWebviewApi {
  readonly outbox: GomiBridgeMessage[] = [];
  state: unknown;

  postMessage(message: GomiBridgeMessage): void {
    this.outbox.push(message);
  }

  getState(): unknown {
    return this.state;
  }

  setState(state: unknown): void {
    this.state = state;
  }
}

class MemoryMessageTarget implements GomiMessageEventTarget {
  private readonly listeners = new Set<(event: MessageEvent) => void>();

  addEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'message', listener: (event: MessageEvent) => void): void {
    this.listeners.delete(listener);
  }

  emit(data: unknown): void {
    const event = { data } as MessageEvent;

    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

const _typeCheckGlobal: GomiWebviewBridgeGlobal = {};
void _typeCheckGlobal;
