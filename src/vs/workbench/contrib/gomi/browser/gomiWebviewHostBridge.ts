import type { GomiBridgeMessage, GomiWorkbenchBridge } from '../electron-sandbox/gomiBridge';
import {
  createGomiBridgeErrorMessage,
  isGomiBridgeMessage,
  shouldReportInvalidGomiBridgeMessage,
  withGomiBridgeProtocol
} from './gomiWebviewBridge';
import { GOMI_BRIDGE_PROTOCOL_VERSION } from '../electron-sandbox/gomiBridge';
import { validateGomiBridgeMessage } from '../common/gomiMessageValidator';

export interface GomiDisposable {
  dispose(): void;
}

export interface GomiNativeWebviewMessageEvent {
  message: unknown;
}

export interface GomiNativeWebviewHost {
  onMessage(listener: (event: GomiNativeWebviewMessageEvent) => void): GomiDisposable;
  postMessage(message: GomiBridgeMessage): Promise<boolean> | boolean | void;
}

export class GomiWebviewHostBridge implements GomiWorkbenchBridge, GomiDisposable {
  private readonly listeners = new Set<(message: GomiBridgeMessage) => void>();
  private readonly disposable: GomiDisposable;

  constructor(private readonly webview: GomiNativeWebviewHost) {
    this.disposable = this.webview.onMessage((event) => {
      if (!isGomiBridgeMessage(event.message)) {
        if (shouldReportInvalidGomiBridgeMessage(event.message)) {
          // Use Zod validator for a specific rejection reason (size, version,
          // unknown type, malformed payload) — capped at 2 000 chars.
          const zod = validateGomiBridgeMessage(event.message);
          const detail = zod.success ? '' : `: ${zod.error}`;
          void this.webview.postMessage({
            protocolVersion: GOMI_BRIDGE_PROTOCOL_VERSION,
            type: 'gomi.bridgeError',
            code: 'invalid_message',
            message: `Rejected invalid Gomi bridge message${detail}`.slice(0, 2_000),
          });
        }

        return;
      }

      for (const listener of this.listeners) {
        listener(event.message);
      }
    });
  }

  postMessage(message: GomiBridgeMessage): void {
    void this.webview.postMessage(withGomiBridgeProtocol(message));
  }

  onMessage(listener: (message: GomiBridgeMessage) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    this.listeners.clear();
    this.disposable.dispose();
  }
}

export function createGomiWebviewHostBridge(webview: GomiNativeWebviewHost): GomiWebviewHostBridge {
  return new GomiWebviewHostBridge(webview);
}
