import type { GomiOfficeSettings, GomiRuntimeEvent } from '../common/gomiTypes';
import type { GomiBridgeMessage, GomiWorkbenchBridge } from '../electron-sandbox/gomiBridge';
import { GomiAgentRuntime, type GomiRuntimeOptions } from '../node/agentRuntime';
import type { GomiPatchApplyResult } from '../node/workspacePatchApplier';

export interface GomiWebviewRuntimeRunner {
  run(request: string): AsyncGenerator<GomiRuntimeEvent>;
}

export interface GomiWebviewHostControllerOptions {
  bridge: GomiWorkbenchBridge;
  runtime?: GomiWebviewRuntimeRunner;
  runtimeFactory?: (officeSettings?: GomiOfficeSettings) => GomiWebviewRuntimeRunner;
  patchApplier?: (
    message: Extract<GomiBridgeMessage, { type: 'gomi.applyPatch' }>
  ) => Promise<GomiPatchApplyResult>;
  runtimeOptions?: GomiRuntimeOptions;
}

export class GomiWebviewHostController {
  private unsubscribe?: () => void;
  private running = false;

  constructor(private readonly options: GomiWebviewHostControllerOptions) {}

  start(): void {
    if (this.unsubscribe) {
      return;
    }

    this.unsubscribe = this.options.bridge.onMessage((message) => {
      void this.handleMessage(message);
    });
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  async handleMessage(message: GomiBridgeMessage): Promise<void> {
    if (message.type === 'gomi.run') {
      await this.runOfficeSession(message);
      return;
    }

    if (message.type === 'gomi.applyPatch') {
      await this.applyPatch(message);
    }
  }

  private async runOfficeSession(message: Extract<GomiBridgeMessage, { type: 'gomi.run' }>): Promise<void> {
    if (this.running) {
      this.options.bridge.postMessage({
        type: 'gomi.event',
        event: {
          type: 'message',
          message: {
            id: `msg-${Date.now()}-busy`,
            senderId: 'system',
            senderName: 'Gomi System',
            content: 'A Gomi Office session is already running.',
            createdAt: new Date().toLocaleTimeString()
          }
        }
      });
      return;
    }

    this.running = true;

    try {
      const runtime = this.options.runtime ?? this.createRuntime(message.officeSettings);

      for await (const event of runtime.run(message.request)) {
        this.options.bridge.postMessage({
          type: 'gomi.event',
          event
        });
      }
    } finally {
      this.running = false;
    }
  }

  private async applyPatch(message: Extract<GomiBridgeMessage, { type: 'gomi.applyPatch' }>): Promise<void> {
    try {
      if (!this.options.patchApplier) {
        throw new Error('Native patch application is not configured for this Gomi webview host.');
      }

      this.options.bridge.postMessage({
        type: 'gomi.applyPatchResult',
        patchId: message.patch.id,
        result: await this.options.patchApplier(message)
      });
    } catch (error) {
      this.options.bridge.postMessage({
        type: 'gomi.applyPatchResult',
        patchId: message.patch.id,
        error: error instanceof Error ? error.message : 'Unknown patch application error.'
      });
    }
  }

  private createRuntime(officeSettings?: GomiOfficeSettings): GomiWebviewRuntimeRunner {
    if (this.options.runtimeFactory) {
      return this.options.runtimeFactory(officeSettings);
    }

    return new GomiAgentRuntime({
      delayMs: 120,
      ...this.options.runtimeOptions,
      officeSettings: officeSettings ?? this.options.runtimeOptions?.officeSettings
    });
  }
}
