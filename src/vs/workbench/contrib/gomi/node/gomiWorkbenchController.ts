import path from 'node:path';
import type { GomiWorkbenchBridge, GomiBridgeMessage } from '../electron-sandbox/gomiBridge';
import type { GomiRuntimeEvent } from '../common/gomiTypes';
import { GomiAgentRuntime, type GomiRuntimeOptions } from './agentRuntime';
import {
  createFileBackedGomiMemoryStore,
  createFileBackedVectorMemoryStore
} from './persistentProjectMemory';
import { readNodeWorkspaceSnapshot } from './nodeWorkspaceReader';
import {
  applyPatchProposalToWorkspace,
  type GomiPatchApplyOptions,
  type GomiPatchApplyResult
} from './workspacePatchApplier';

export interface GomiRuntimeRunner {
  run(request: string): AsyncGenerator<GomiRuntimeEvent>;
}

export interface GomiWorkbenchControllerOptions {
  bridge: GomiWorkbenchBridge;
  workspaceRoot: string;
  runtime?: GomiRuntimeRunner;
  memoryDirectory?: string;
  runtimeOptions?: GomiRuntimeOptions;
  patchApplyOptions?: GomiPatchApplyOptions;
  applyPatch?: (
    message: Extract<GomiBridgeMessage, { type: 'gomi.applyPatch' }>,
    workspaceRoot: string,
    options?: GomiPatchApplyOptions
  ) => Promise<GomiPatchApplyResult>;
}

export class GomiWorkbenchController {
  private readonly bridge: GomiWorkbenchBridge;
  private readonly workspaceRoot: string;
  private readonly runtime: GomiRuntimeRunner;
  private readonly patchApplyOptions?: GomiPatchApplyOptions;
  private readonly applyPatch: NonNullable<GomiWorkbenchControllerOptions['applyPatch']>;
  private unsubscribe?: () => void;
  private isRunning = false;

  constructor(options: GomiWorkbenchControllerOptions) {
    this.bridge = options.bridge;
    this.workspaceRoot = options.workspaceRoot;
    this.runtime =
      options.runtime ??
      createWorkbenchRuntime(options.workspaceRoot, options.memoryDirectory, options.runtimeOptions);
    this.patchApplyOptions = options.patchApplyOptions;
    this.applyPatch =
      options.applyPatch ??
      ((message, workspaceRoot, applyOptions) =>
        applyPatchProposalToWorkspace(message.patch, workspaceRoot, applyOptions));
  }

  start(): void {
    if (this.unsubscribe) {
      return;
    }

    this.unsubscribe = this.bridge.onMessage((message) => {
      void this.handleMessage(message);
    });
  }

  dispose(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  async handleMessage(message: GomiBridgeMessage): Promise<void> {
    if (message.type === 'gomi.run') {
      await this.runOfficeSession(message.request);
      return;
    }

    if (message.type === 'gomi.applyPatch') {
      await this.applyPatchMessage(message);
    }
  }

  private async runOfficeSession(request: string): Promise<void> {
    if (this.isRunning) {
      this.bridge.postMessage({
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

    this.isRunning = true;

    try {
      for await (const event of this.runtime.run(request)) {
        this.bridge.postMessage({
          type: 'gomi.event',
          event
        });
      }
    } finally {
      this.isRunning = false;
    }
  }

  private async applyPatchMessage(
    message: Extract<GomiBridgeMessage, { type: 'gomi.applyPatch' }>
  ): Promise<void> {
    try {
      const result = await this.applyPatch(message, this.workspaceRoot, this.patchApplyOptions);

      this.bridge.postMessage({
        type: 'gomi.applyPatchResult',
        patchId: message.patch.id,
        result
      });
    } catch (error) {
      this.bridge.postMessage({
        type: 'gomi.applyPatchResult',
        patchId: message.patch.id,
        error: error instanceof Error ? error.message : 'Unknown patch application error.'
      });
    }
  }
}

function createWorkbenchRuntime(
  workspaceRoot: string,
  memoryDirectory?: string,
  runtimeOptions: GomiRuntimeOptions = {}
): GomiRuntimeRunner {
  const projectMemoryDirectory = memoryDirectory ?? path.join(workspaceRoot, '.gomi-ide', 'memory');

  return new GomiAgentRuntime({
    ...runtimeOptions,
    workspaceReader: runtimeOptions.workspaceReader ?? (() => readNodeWorkspaceSnapshot(workspaceRoot)),
    memoryStore:
      runtimeOptions.memoryStore ??
      createFileBackedGomiMemoryStore(path.join(projectMemoryDirectory, 'lexical-memory.json')),
    vectorMemoryStore:
      runtimeOptions.vectorMemoryStore ??
      createFileBackedVectorMemoryStore(
      path.join(projectMemoryDirectory, 'vector-memory.json')
    )
  });
}
