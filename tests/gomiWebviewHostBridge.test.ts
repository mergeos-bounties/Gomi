import { describe, expect, it } from 'vitest';
import type { GomiBridgeMessage } from '../src/vs/workbench/contrib/gomi/electron-sandbox/gomiBridge';
import {
  createGomiWebviewHostBridge,
  type GomiDisposable,
  type GomiNativeWebviewMessageEvent
} from '../src/vs/workbench/contrib/gomi/browser/gomiWebviewHostBridge';

describe('Gomi webview host bridge', () => {
  it('adapts native webview messages to the Gomi bridge contract', () => {
    const webview = new MemoryNativeWebview();
    const bridge = createGomiWebviewHostBridge(webview);
    const received: GomiBridgeMessage[] = [];
    const unsubscribe = bridge.onMessage((message) => received.push(message));

    bridge.postMessage({
      type: 'gomi.run',
      request: 'Host to webview'
    });
    webview.emit({
      type: 'gomi.applyPatchResult',
      patchId: 'patch-1'
    });
    webview.emit({ type: 'not-gomi' });
    unsubscribe();
    webview.emit({
      type: 'gomi.applyPatchResult',
      patchId: 'patch-2'
    });

    expect(webview.outbox).toEqual([
      {
        type: 'gomi.run',
        request: 'Host to webview'
      }
    ]);
    expect(received).toEqual([
      {
        type: 'gomi.applyPatchResult',
        patchId: 'patch-1'
      }
    ]);

    bridge.dispose();
    webview.emit({
      type: 'gomi.applyPatchResult',
      patchId: 'patch-3'
    });

    expect(received).toHaveLength(1);
  });
});

class MemoryNativeWebview {
  readonly outbox: GomiBridgeMessage[] = [];
  private readonly listeners = new Set<(event: GomiNativeWebviewMessageEvent) => void>();

  onMessage(listener: (event: GomiNativeWebviewMessageEvent) => void): GomiDisposable {
    this.listeners.add(listener);

    return {
      dispose: () => {
        this.listeners.delete(listener);
      }
    };
  }

  postMessage(message: GomiBridgeMessage): boolean {
    this.outbox.push(message);

    return true;
  }

  emit(message: unknown): void {
    for (const listener of this.listeners) {
      listener({ message });
    }
  }
}
