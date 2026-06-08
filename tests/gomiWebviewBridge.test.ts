import { describe, expect, it } from 'vitest';
import type { GomiBridgeMessage } from '../src/vs/workbench/contrib/gomi/electron-sandbox/gomiBridge';
import {
  createGomiWebviewBridge,
  isGomiBridgeMessage,
  resolveGomiWebviewBridge,
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
    target.emit({
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
      type: 'gomi.applyPatchResult',
      patchId: 'patch-2'
    });

    expect(api.outbox).toEqual([
      {
        type: 'gomi.run',
        request: 'Review workspace'
      }
    ]);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({
      type: 'gomi.applyPatchResult',
      patchId: 'patch-1'
    });
  });

  it('filters bridge messages by Gomi namespace', () => {
    expect(isGomiBridgeMessage({ type: 'gomi.event' })).toBe(true);
    expect(isGomiBridgeMessage({ type: 'workspace.event' })).toBe(false);
    expect(isGomiBridgeMessage(undefined)).toBe(false);
  });

  it('can be constructed directly with an injected api and target', () => {
    const api = new MemoryVsCodeApi();
    const target = new MemoryMessageTarget();
    const bridge = createGomiWebviewBridge(api, target);

    bridge.postMessage({
      type: 'gomi.run',
      request: 'Direct bridge'
    });

    expect(api.outbox[0]).toMatchObject({
      type: 'gomi.run',
      request: 'Direct bridge'
    });
  });
});

class MemoryVsCodeApi implements GomiVsCodeWebviewApi {
  readonly outbox: GomiBridgeMessage[] = [];

  postMessage(message: GomiBridgeMessage): void {
    this.outbox.push(message);
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
