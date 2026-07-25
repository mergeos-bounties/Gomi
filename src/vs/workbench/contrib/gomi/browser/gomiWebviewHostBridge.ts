import type { GomiBridgeMessage, GomiWorkbenchBridge } from '../electron-sandbox/gomiBridge';
import {
  validateHostBridgeMessage,
  type SchemaValidationResult,
} from '../electron-sandbox/gomiHostBridgeSchema';
import {
  createGomiBridgeErrorMessage,
  isGomiBridgeMessage,
  shouldReportInvalidGomiBridgeMessage,
  withGomiBridgeProtocol
} from './gomiWebviewBridge';

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
        void this.reportInvalidMessage(event.message);
        return;
      }

      const schemaResult = validateHostBridgeMessage(event.message);
      if (!schemaResult.valid) {
        void this.reportInvalidMessage(event.message, schemaResult);
        return;
      }

      for (const listener of this.listeners) {
        listener(schemaResult.message!);
      }
    });
  }

  private reportInvalidMessage(raw: unknown, schemaResult?: SchemaValidationResult): void {
    if (!shouldReportInvalidGomiBridgeMessage(raw)) {
      return;
    }
    void this.webview.postMessage(
      createGomiBridgeErrorMessage(schemaResult?.error)
    );
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
