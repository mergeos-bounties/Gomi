import type { GomiBridgeMessage, GomiWorkbenchBridge } from '../electron-sandbox/gomiBridge';
import {
  createGomiBridgeErrorMessage,
  isGomiBridgeMessage,
  shouldReportInvalidGomiBridgeMessage,
  withGomiBridgeProtocol
} from './gomiWebviewBridge';
import {
  createDetailedGomiBridgeError,
  validateGomiBridgeMessage
} from './gomiWebviewHostValidation';

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
      // --- Enhanced validation with detailed diagnostics ---
      const validation = validateGomiBridgeMessage(event.message);

      if (!validation.valid) {
        if (shouldReportInvalidGomiBridgeMessage(event.message)) {
          void this.webview.postMessage(
            createDetailedGomiBridgeError(validation.reason ?? 'Invalid message.')
          );
        }
        return;
      }

      // `validateGomiBridgeMessage` already confirmed the payload is a
      // valid GomiBridgeMessage — safe to cast.
      const message = event.message as GomiBridgeMessage;

      for (const listener of this.listeners) {
        listener(message);
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
