import path from 'node:path';
import type { GomiWorkbenchBridge, GomiBridgeMessage } from '../electron-sandbox/gomiBridge';
import { normalizeGomiOfficeSettings } from '../common/gomiOfficeSettings';
import type {
  GomiMemoryEmbeddingProviderId,
  GomiOfficeSettings,
  GomiPatchPreviewResult,
  GomiRuntimeEvent
} from '../common/gomiTypes';
import {
  GomiAgentRuntime,
  type GomiRuntimeMemoryPruneReport,
  type GomiRuntimeOptions,
  type GomiRuntimeRunOptions
} from './agentRuntime';
import type { GomiCliCommandRunner } from './cliAgentProvider';
import {
  createConfiguredEmbeddingProvider,
  type GomiEmbeddingFetch,
  type GomiHttpEmbeddingRoute
} from './embeddingProvider';
import type { GomiHttpFetch, GomiHttpProviderRoute } from './httpAgentProvider';
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
import { createWorkbenchGomiAgentProvider } from './workbenchAgentProvider';

export interface GomiRuntimeRunner {
  run(request: string, options?: GomiRuntimeRunOptions): AsyncGenerator<GomiRuntimeEvent>;
  pruneMemory?: () => Promise<GomiRuntimeMemoryPruneReport>;
}

export interface GomiWorkbenchControllerOptions {
  bridge: GomiWorkbenchBridge;
  workspaceRoot: string;
  runtime?: GomiRuntimeRunner;
  memoryDirectory?: string;
  runtimeOptions?: GomiRuntimeOptions;
  enableCliAgentExecution?: boolean;
  enableHttpAgentExecution?: boolean;
  cliAgentCommandRunner?: GomiCliCommandRunner;
  httpFetch?: GomiHttpFetch;
  httpRoutes?: Partial<Record<string, GomiHttpProviderRoute>>;
  providerEnv?: Record<string, string | undefined>;
  enableEmbeddingProviderExecution?: boolean;
  embeddingFetch?: GomiEmbeddingFetch;
  embeddingRoute?: GomiHttpEmbeddingRoute;
  embeddingEnv?: Record<string, string | undefined>;
  cliAgentTimeoutMs?: number;
  patchApplyOptions?: GomiPatchApplyOptions;
  applyPatch?: (
    message: Extract<GomiBridgeMessage, { type: 'gomi.applyPatch' }>,
    workspaceRoot: string,
    options?: GomiPatchApplyOptions
  ) => Promise<GomiPatchApplyResult>;
  previewPatch?: (
    message: Extract<GomiBridgeMessage, { type: 'gomi.previewPatch' }>,
    workspaceRoot: string
  ) => Promise<GomiPatchPreviewResult>;
}

export class GomiWorkbenchController {
  private readonly bridge: GomiWorkbenchBridge;
  private readonly workspaceRoot: string;
  private readonly runtime?: GomiRuntimeRunner;
  private readonly runtimeFactory: (officeSettings?: GomiOfficeSettings) => GomiRuntimeRunner;
  private readonly patchApplyOptions?: GomiPatchApplyOptions;
  private readonly applyPatch: NonNullable<GomiWorkbenchControllerOptions['applyPatch']>;
  private readonly previewPatch?: GomiWorkbenchControllerOptions['previewPatch'];
  private readonly previewedPatches = new Map<string, string>();
  private unsubscribe?: () => void;
  private isRunning = false;
  private abortController?: AbortController;

  constructor(options: GomiWorkbenchControllerOptions) {
    this.bridge = options.bridge;
    this.workspaceRoot = options.workspaceRoot;
    this.runtime = options.runtime;
    this.runtimeFactory = (officeSettings) => {
      const normalizedOfficeSettings = officeSettings
        ? normalizeGomiOfficeSettings(officeSettings)
        : options.runtimeOptions?.officeSettings;

      return createWorkbenchRuntime(
        options.workspaceRoot,
        options.memoryDirectory,
        {
          ...options.runtimeOptions,
          officeSettings: normalizedOfficeSettings
        },
        {
          enableCliAgentExecution: options.enableCliAgentExecution,
          enableHttpAgentExecution: options.enableHttpAgentExecution,
          cliAgentCommandRunner: options.cliAgentCommandRunner,
          httpFetch: options.httpFetch,
          httpRoutes: options.httpRoutes,
          providerEnv: options.providerEnv,
          enableEmbeddingProviderExecution: options.enableEmbeddingProviderExecution,
          embeddingFetch: options.embeddingFetch,
          embeddingRoute: options.embeddingRoute,
          embeddingEnv: options.embeddingEnv,
          cliAgentTimeoutMs: options.cliAgentTimeoutMs
        }
      );
    };
    this.patchApplyOptions = options.patchApplyOptions;
    this.applyPatch =
      options.applyPatch ??
      ((message, workspaceRoot, applyOptions) =>
        applyPatchProposalToWorkspace(message.patch, workspaceRoot, applyOptions));
    this.previewPatch = options.previewPatch;
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
    if (this.isRunning && this.abortController) {
      this.abortController.abort('Gomi workbench controller was disposed.');
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

    if (message.type === 'gomi.applyPatch') {
      await this.applyPatchMessage(message);
      return;
    }

    if (message.type === 'gomi.previewPatch') {
      await this.previewPatchMessage(message);
    }
  }

  private async runOfficeSession(message: Extract<GomiBridgeMessage, { type: 'gomi.run' }>): Promise<void> {
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
    const abortController = new AbortController();
    this.abortController = abortController;

    try {
      const runtime = this.runtime ?? this.runtimeFactory(message.officeSettings);

      for await (const event of runtime.run(message.request, {
        signal: abortController.signal,
        stopReason: 'Gomi Office session stopped by user.'
      })) {
        this.bridge.postMessage({
          type: 'gomi.event',
          event
        });
      }
    } finally {
      if (this.abortController === abortController) {
        this.abortController = undefined;
      }

      this.isRunning = false;
    }
  }

  stopOfficeSession(reason = 'Gomi Office session stopped by user.'): void {
    if (!this.isRunning || !this.abortController) {
      this.postSystemMessage('No Gomi Office session is running.');
      return;
    }

    this.postSystemMessage('Stopping the current Gomi Office session...');
    this.abortController.abort(reason);
  }

  private async pruneMemory(
    message: Extract<GomiBridgeMessage, { type: 'gomi.pruneMemory' }>
  ): Promise<void> {
    try {
      const runtime = this.runtime ?? this.runtimeFactory(message.officeSettings);

      if (!runtime.pruneMemory) {
        throw new Error('Memory pruning is not configured for this Gomi workbench controller.');
      }

      this.bridge.postMessage({
        type: 'gomi.pruneMemoryResult',
        report: await runtime.pruneMemory()
      });
    } catch (error) {
      this.bridge.postMessage({
        type: 'gomi.pruneMemoryResult',
        error: error instanceof Error ? error.message : 'Unknown memory prune error.'
      });
    }
  }

  private async applyPatchMessage(
    message: Extract<GomiBridgeMessage, { type: 'gomi.applyPatch' }>
  ): Promise<void> {
    try {
      const previewMatched = this.previewedPatches.get(message.patch.id) === message.patch.diff;

      if (this.previewPatch && !previewMatched) {
        throw new Error('Preview the Gomi patch before applying it.');
      }

      const applyOptions = previewMatched
        ? { ...this.patchApplyOptions, authorize: true }
        : this.patchApplyOptions;
      const result = await this.applyPatch(message, this.workspaceRoot, applyOptions);

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

  private async previewPatchMessage(
    message: Extract<GomiBridgeMessage, { type: 'gomi.previewPatch' }>
  ): Promise<void> {
    try {
      if (!this.previewPatch) {
        throw new Error('Patch preview is not configured for this Gomi workbench controller.');
      }

      const result = await this.previewPatch(message, this.workspaceRoot);
      this.previewedPatches.set(message.patch.id, message.patch.diff);

      this.bridge.postMessage({
        type: 'gomi.previewPatchResult',
        patchId: message.patch.id,
        result
      });
    } catch (error) {
      this.bridge.postMessage({
        type: 'gomi.previewPatchResult',
        patchId: message.patch.id,
        error: error instanceof Error ? error.message : 'Unknown patch preview error.'
      });
    }
  }

  private postSystemMessage(content: string): void {
    this.bridge.postMessage({
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

function createWorkbenchRuntime(
  workspaceRoot: string,
  memoryDirectory?: string,
  runtimeOptions: GomiRuntimeOptions = {},
  cliOptions: Pick<
    GomiWorkbenchControllerOptions,
    | 'enableCliAgentExecution'
    | 'enableHttpAgentExecution'
    | 'cliAgentCommandRunner'
    | 'httpFetch'
    | 'httpRoutes'
    | 'providerEnv'
    | 'enableEmbeddingProviderExecution'
    | 'embeddingFetch'
    | 'embeddingRoute'
    | 'embeddingEnv'
    | 'cliAgentTimeoutMs'
  > = {}
): GomiRuntimeRunner {
  const projectMemoryDirectory = memoryDirectory ?? path.join(workspaceRoot, '.gomi-ide', 'memory');
  const officeEmbeddingRoute = createOfficeEmbeddingRoute(runtimeOptions.officeSettings?.memory.embeddingProvider);
  const officeEmbeddingsEnabled =
    runtimeOptions.officeSettings?.memory.embeddingExecutionEnabled ?? true;
  const hostEmbeddingsAllowed =
    cliOptions.enableEmbeddingProviderExecution ?? cliOptions.enableHttpAgentExecution ?? false;

  return new GomiAgentRuntime({
    ...runtimeOptions,
    workspaceReader: runtimeOptions.workspaceReader ?? (() => readNodeWorkspaceSnapshot(workspaceRoot)),
    memoryStore:
      runtimeOptions.memoryStore ??
      createFileBackedGomiMemoryStore(path.join(projectMemoryDirectory, 'lexical-memory.json')),
    vectorMemoryStore:
      runtimeOptions.vectorMemoryStore ??
      createFileBackedVectorMemoryStore(
        path.join(projectMemoryDirectory, 'vector-memory.json'),
        createConfiguredEmbeddingProvider({
          enabled: hostEmbeddingsAllowed && officeEmbeddingsEnabled,
          fetchImpl: cliOptions.embeddingFetch ?? cliOptions.httpFetch,
          route: cliOptions.embeddingRoute ?? officeEmbeddingRoute,
          env: cliOptions.embeddingEnv ?? cliOptions.providerEnv
        })
      ),
    agentProvider:
      runtimeOptions.agentProvider ??
      createWorkbenchGomiAgentProvider({
        enableCliAgentExecution: cliOptions.enableCliAgentExecution ?? false,
        enableHttpAgentExecution: cliOptions.enableHttpAgentExecution ?? false,
        cliAgentCommandRunner: cliOptions.cliAgentCommandRunner,
        httpFetch: cliOptions.httpFetch,
        httpRoutes: cliOptions.httpRoutes,
        env: cliOptions.providerEnv,
        timeoutMs: cliOptions.cliAgentTimeoutMs,
        cwd: workspaceRoot
      })
  });
}

function createOfficeEmbeddingRoute(
  embeddingProvider?: GomiMemoryEmbeddingProviderId
): GomiHttpEmbeddingRoute | undefined {
  if (!embeddingProvider || embeddingProvider === 'local-hashing') {
    return undefined;
  }

  if (embeddingProvider === 'openai-compatible') {
    return {
      mode: 'openai-compatible',
      endpointEnv: 'GOMI_EMBEDDINGS_ENDPOINT',
      apiKeyEnv: 'GOMI_EMBEDDINGS_API_KEY',
      modelEnv: 'GOMI_EMBEDDINGS_MODEL'
    };
  }

  return {
    mode: embeddingProvider,
    endpointEnv: 'GOMI_LOCAL_EMBEDDINGS_ENDPOINT',
    modelEnv: 'GOMI_LOCAL_EMBEDDINGS_MODEL'
  };
}
