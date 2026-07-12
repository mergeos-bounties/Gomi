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
      protocolVersion: 1,
      type: 'gomi.applyPatchResult',
      patchId: 'patch-1'
    });
    webview.emit({ type: 'not-gomi' });
    unsubscribe();
    webview.emit({
      protocolVersion: 1,
      type: 'gomi.applyPatchResult',
      patchId: 'patch-2'
    });

    expect(webview.outbox).toEqual([
      {
        protocolVersion: 1,
        type: 'gomi.run',
        request: 'Host to webview'
      }
    ]);
    expect(received).toEqual([
      {
        protocolVersion: 1,
        type: 'gomi.applyPatchResult',
        patchId: 'patch-1'
      }
    ]);

    bridge.dispose();
    webview.emit({
      protocolVersion: 1,
      type: 'gomi.applyPatchResult',
      patchId: 'patch-3'
    });

    expect(received).toHaveLength(1);
  });

  it('rejects invalid inbound messages with a sanitized bridge error', () => {
    const webview = new MemoryNativeWebview();
    const bridge = createGomiWebviewHostBridge(webview);
    const received: GomiBridgeMessage[] = [];
    bridge.onMessage((message) => received.push(message));

    webview.emit({ type: 'gomi.run', request: 'Missing protocol' });
    webview.emit({
      protocolVersion: 1,
      type: 'gomi.run',
      request: 'x'.repeat(70_000)
    });
    webview.emit({
      protocolVersion: 1,
      type: 'gomi.run',
      request: 'Review workspace',
      officeSettings: {
        seats: 'not-an-array',
        memory: {},
        execution: {}
      }
    });
    webview.emit({
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
    });

    expect(received).toEqual([]);
    expect(webview.outbox).toEqual([
      {
        protocolVersion: 1,
        type: 'gomi.bridgeError',
        code: 'invalid_message',
        message: 'Rejected invalid Gomi bridge message.'
      },
      {
        protocolVersion: 1,
        type: 'gomi.bridgeError',
        code: 'invalid_message',
        message: 'Rejected invalid Gomi bridge message.'
      },
      {
        protocolVersion: 1,
        type: 'gomi.bridgeError',
        code: 'invalid_message',
        message: 'Rejected invalid Gomi bridge message.'
      },
      {
        protocolVersion: 1,
        type: 'gomi.bridgeError',
        code: 'invalid_message',
        message: 'Rejected invalid Gomi bridge message.'
      }
    ]);
    expect(JSON.stringify(webview.outbox)).not.toContain('../secret');
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
