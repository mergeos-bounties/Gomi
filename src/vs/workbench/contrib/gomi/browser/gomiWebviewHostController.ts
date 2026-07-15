import { normalizeGomiOfficeSettings } from '../common/gomiOfficeSettings';
import type { GomiOfficeSettings, GomiPatchPreviewResult, GomiRuntimeEvent } from '../common/gomiTypes';
import type { GomiBridgeMessage, GomiWorkbenchBridge } from '../electron-sandbox/gomiBridge';
import {
  GomiAgentRuntime,
  type GomiRuntimeMemoryPruneReport,
  type GomiRuntimeOptions,
  type GomiRuntimeRunOptions
} from '../node/agentRuntime';
import type { GomiPatchApplyResult } from '../node/workspacePatchApplier';

export interface GomiWebviewRuntimeRunner {
  run(request: string, options?: GomiRuntimeRunOptions): AsyncGenerator<GomiRuntimeEvent>;
  pruneMemory?: () => Promise<GomiRuntimeMemoryPruneReport>;
}

export interface GomiWebviewHostControllerOptions {
  bridge: GomiWorkbenchBridge;
  runtime?: GomiWebviewRuntimeRunner;
  runtimeFactory?: (officeSettings?: GomiOfficeSettings) => GomiWebviewRuntimeRunner;
  patchApplier?: (
    message: Extract<GomiBridgeMessage, { type: 'gomi.applyPatch' }>
  ) => Promise<GomiPatchApplyResult>;
  patchPreviewer?: (
    message: Extract<GomiBridgeMessage, { type: 'gomi.previewPatch' }>
  ) => Promise<GomiPatchPreviewResult>;
  projectOpener?: (
    message: Extract<GomiBridgeMessage, { type: 'gomi.openProject' }>
  ) => Promise<void>;
  runtimeOptions?: GomiRuntimeOptions;
}

export class GomiWebviewHostController {
  private unsubscribe?: () => void;
  private running = false;
  private abortController?: AbortController;
  private readonly previewedPatches = new Map<string, string>();

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
    if (this.running && this.abortController) {
      this.abortController.abort('Gomi Office host view was disposed.');
    }

    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  async handleMessage(message: GomiBridgeMessage): Promise<void> {
    if (message.type === 'gomi.run') {
      await this.runOfficeSession(message);
      return;
    }

    if (message.type === 'gomi.stop') {
      this.stopOfficeSession(message.reason);
      return;
    }

    if (message.type === 'gomi.pruneMemory') {
      await this.pruneMemory(message);
      return;
    }

    if (message.type === 'gomi.openProject') {
      await this.openProject(message);
      return;
    }

    if (message.type === 'gomi.applyPatch') {
      await this.applyPatch(message);
      return;
    }

    if (message.type === 'gomi.previewPatch') {
      await this.previewPatch(message);
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
    const abortController = new AbortController();
    this.abortController = abortController;

    try {
      const runtime = this.options.runtime ?? this.createRuntime(message.officeSettings);

      for await (const event of runtime.run(message.request, {
        signal: abortController.signal,
        stopReason: 'Gomi Office session stopped by user.'
      })) {
        this.options.bridge.postMessage({
          type: 'gomi.event',
          event
        });
      }
    } finally {
      if (this.abortController === abortController) {
        this.abortController = undefined;
      }

      this.running = false;
    }
  }

  stopOfficeSession(reason = 'Gomi Office session stopped by user.'): void {
    if (!this.running || !this.abortController) {
      this.postSystemMessage('No Gomi Office session is running.');
      return;
    }

    this.postSystemMessage('Stopping the current Gomi Office session...');
    this.abortController.abort(reason);
  }

  private async pruneMemory(message: Extract<GomiBridgeMessage, { type: 'gomi.pruneMemory' }>): Promise<void> {
    try {
      const runtime = this.options.runtime ?? this.createRuntime(message.officeSettings);

      if (!runtime.pruneMemory) {
        throw new Error('Memory pruning is not configured for this Gomi webview host.');
      }

      this.options.bridge.postMessage({
        type: 'gomi.pruneMemoryResult',
        report: await runtime.pruneMemory()
      });
    } catch (error) {
      this.options.bridge.postMessage({
        type: 'gomi.pruneMemoryResult',
        error: error instanceof Error ? error.message : 'Unknown memory prune error.'
      });
    }
  }

  private async openProject(message: Extract<GomiBridgeMessage, { type: 'gomi.openProject' }>): Promise<void> {
    try {
      if (!this.options.projectOpener) {
        throw new Error('Recent project opening is not configured for this Gomi webview host.');
      }

      await this.options.projectOpener(message);
      this.postSystemMessage(`Opening recent project: ${message.project.name}.`);
    } catch (error) {
      this.postSystemMessage(error instanceof Error ? error.message : 'Unknown recent project open error.');
    }
  }

  private async applyPatch(message: Extract<GomiBridgeMessage, { type: 'gomi.applyPatch' }>): Promise<void> {
    try {
      if (!this.options.patchApplier) {
        throw new Error('Native patch application is not configured for this Gomi webview host.');
      }

      if (this.options.patchPreviewer && this.previewedPatches.get(message.patch.id) !== message.patch.diff) {
        throw new Error('Preview the Gomi patch in the native diff editor before applying it.');
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

  private async previewPatch(message: Extract<GomiBridgeMessage, { type: 'gomi.previewPatch' }>): Promise<void> {
    try {
      if (!this.options.patchPreviewer) {
        throw new Error('Native patch preview is not configured for this Gomi webview host.');
      }

      const result = await this.options.patchPreviewer(message);
      this.previewedPatches.set(message.patch.id, message.patch.diff);
      this.options.bridge.postMessage({
        type: 'gomi.previewPatchResult',
        patchId: message.patch.id,
        result
      });
    } catch (error) {
      this.options.bridge.postMessage({
        type: 'gomi.previewPatchResult',
        patchId: message.patch.id,
        error: error instanceof Error ? error.message : 'Unknown patch preview error.'
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
      officeSettings: officeSettings
        ? normalizeGomiOfficeSettings(officeSettings)
        : this.options.runtimeOptions?.officeSettings
    });
  }

  private postSystemMessage(content: string): void {
    this.options.bridge.postMessage({
      type: 'gomi.event',
      event: {
        type: 'message',
        message: {
          id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          senderId: 'system',
          senderName: 'Gomi System',
          content,
          createdAt: new Date().toLocaleTimeString()
        }
      }
    });
  }
}
