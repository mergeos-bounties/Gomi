import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  setMemoryBroadcastThreshold,
  setSeatWorkMode
} from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';
import type {
  GomiOfficeSettings,
  GomiPatchProposal,
  GomiRuntimeEvent
} from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import type { GomiBridgeMessage, GomiWorkbenchBridge } from '../src/vs/workbench/contrib/gomi/electron-sandbox/gomiBridge';
import {
  GomiWebviewHostController,
  type GomiWebviewRuntimeRunner
} from '../src/vs/workbench/contrib/gomi/browser/gomiWebviewHostController';
import type { GomiRuntimeRunOptions } from '../src/vs/workbench/contrib/gomi/node/agentRuntime';

describe('Gomi webview host controller', () => {
  it('streams runtime events back to the webview bridge', async () => {
    const bridge = new MemoryBridge();
    const seenSettings: GomiOfficeSettings[] = [];
    const controller = new GomiWebviewHostController({
      bridge,
      runtimeFactory: (officeSettings) => {
        if (officeSettings) {
          seenSettings.push(officeSettings);
        }

        return createRuntime([
          {
            type: 'session_started',
            sessionId: 'session-1',
            request: 'Review login',
            workspace: {
              rootName: 'BridgeWorkspace',
              files: ['src/login.ts'],
              openEditors: ['src/login.ts'],
              gitSummary: 'Git branch master.',
              terminalSummary: 'npm test'
            }
          },
          {
            type: 'session_completed',
            sessionId: 'session-1'
          }
        ]);
      }
    });

    const officeSettings = setMemoryBroadcastThreshold(
      setSeatWorkMode(DEFAULT_GOMI_OFFICE_SETTINGS, 'head-backend', 'sleeping'),
      0.88
    );

    await controller.handleMessage({
      type: 'gomi.run',
      request: 'Review login',
      officeSettings
    });

    expect(seenSettings[0].seats.find((seat) => seat.id === 'head-backend')?.workMode).toBe('sleeping');
    expect(seenSettings[0].memory.broadcastThreshold).toBe(0.88);
    expect(bridge.outbox.map((message) => message.type)).toEqual(['gomi.event', 'gomi.event']);
  });

  it('stops a running host session through a bridge stop message', async () => {
    const bridge = new MemoryBridge();
    let seenSignal: AbortSignal | undefined;
    const controller = new GomiWebviewHostController({
      bridge,
      runtime: {
        async *run(_request: string, options?: GomiRuntimeRunOptions) {
          seenSignal = options?.signal;
          yield {
            type: 'session_started',
            sessionId: 'session-stop',
            request: 'Stop this',
            workspace: {
              rootName: 'StopWorkspace',
              files: ['README.md'],
              openEditors: [],
              gitSummary: 'Git clean.',
              terminalSummary: 'Idle.'
            }
          } satisfies GomiRuntimeEvent;

          await waitForAbort(options?.signal);

          yield {
            type: 'session_stopped',
            sessionId: 'session-stop',
            reason: 'Stopped by test.'
          } satisfies GomiRuntimeEvent;
          yield {
            type: 'session_completed',
            sessionId: 'session-stop'
          } satisfies GomiRuntimeEvent;
        }
      }
    });

    const runPromise = controller.handleMessage({
      type: 'gomi.run',
      request: 'Stop this'
    });
    await Promise.resolve();
    await controller.handleMessage({
      type: 'gomi.stop',
      reason: 'Stopped by test.'
    });
    await runPromise;

    const eventTypes = bridge.outbox
      .filter((message): message is Extract<GomiBridgeMessage, { type: 'gomi.event' }> => message.type === 'gomi.event')
      .map((message) => message.event.type);

    expect(seenSignal?.aborted).toBe(true);
    expect(eventTypes).toContain('session_stopped');
    expect(eventTypes.at(-1)).toBe('session_completed');
  });

  it('returns manual memory prune reports through the bridge', async () => {
    const bridge = new MemoryBridge();
    const controller = new GomiWebviewHostController({
      bridge,
      runtime: {
        async *run() {
          yield {
            type: 'session_completed',
            sessionId: 'unused'
          } satisfies GomiRuntimeEvent;
        },
        pruneMemory: async () => ({
          removed: 3,
          remaining: 2,
          lexical: {
            removed: 2,
            remaining: 1
          },
          vector: {
            removed: 1,
            remaining: 1
          }
        })
      }
    });

    await controller.handleMessage({
      type: 'gomi.pruneMemory',
      officeSettings: DEFAULT_GOMI_OFFICE_SETTINGS
    });

    expect(bridge.outbox[0]).toEqual({
      type: 'gomi.pruneMemoryResult',
      report: {
        removed: 3,
        remaining: 2,
        lexical: {
          removed: 2,
          remaining: 1
        },
        vector: {
          removed: 1,
          remaining: 1
        }
      }
    });
  });

  it('opens a recent project through the configured host opener', async () => {
    const bridge = new MemoryBridge();
    const openedProjects: string[] = [];
    const controller = new GomiWebviewHostController({
      bridge,
      projectOpener: async (message) => {
        openedProjects.push(message.project.path);
      }
    });

    await controller.handleMessage({
      type: 'gomi.openProject',
      project: {
        id: 'project-gomi',
        name: 'Gomi IDE',
        path: '/workspaces/gomi',
        lastOpenedAt: '2026-07-15T10:00:00.000Z'
      }
    });

    expect(openedProjects).toEqual(['/workspaces/gomi']);
    expect(bridge.outbox[0]).toMatchObject({
      type: 'gomi.event',
      event: {
        type: 'message',
        message: {
          senderName: 'Gomi System',
          content: 'Opening recent project: Gomi IDE.'
        }
      }
    });
  });

  it('returns patch apply errors when no host patch applier is configured', async () => {
    const bridge = new MemoryBridge();
    const controller = new GomiWebviewHostController({ bridge });

    await controller.handleMessage({
      type: 'gomi.applyPatch',
      patch: {
        id: 'patch-host',
        filePath: 'README.md',
        targetFiles: ['README.md'],
        summary: 'Host patch.',
        diff: '',
        approvalStatus: 'approved',
        riskLevel: 'low',
        createdByAgentId: 'ceo'
      }
    });

    expect(bridge.outbox[0]).toMatchObject({
      type: 'gomi.applyPatchResult',
      patchId: 'patch-host',
      error: 'Native patch application is not configured for this Gomi webview host.'
    });
  });

  it('requires native patch preview before apply when a previewer is configured', async () => {
    const bridge = new MemoryBridge();
    let applyCount = 0;
    const controller = new GomiWebviewHostController({
      bridge,
      patchPreviewer: async (message) => ({
        patchId: message.patch.id,
        previewedFiles: message.patch.targetFiles,
        skippedFiles: []
      }),
      patchApplier: async (message) => {
        applyCount += 1;
        return {
          patchId: message.patch.id,
          dryRun: false,
          appliedFiles: message.patch.targetFiles,
          deletedFiles: []
        };
      }
    });
    const patch = createPatch('patch-preview-required');

    await controller.handleMessage({
      type: 'gomi.applyPatch',
      patch
    });
    await controller.handleMessage({
      type: 'gomi.previewPatch',
      patch
    });
    await controller.handleMessage({
      type: 'gomi.applyPatch',
      patch
    });

    expect(applyCount).toBe(1);
    expect(bridge.outbox.map((message) => message.type)).toEqual([
      'gomi.applyPatchResult',
      'gomi.previewPatchResult',
      'gomi.applyPatchResult'
    ]);
    expect(bridge.outbox[0]).toMatchObject({
      type: 'gomi.applyPatchResult',
      patchId: 'patch-preview-required',
      error: 'Preview the Gomi patch in the native diff editor before applying it.'
    });
    expect(bridge.outbox[1]).toMatchObject({
      type: 'gomi.previewPatchResult',
      patchId: 'patch-preview-required',
      result: {
        previewedFiles: ['README.md']
      }
    });
    expect(bridge.outbox[2]).toMatchObject({
      type: 'gomi.applyPatchResult',
      patchId: 'patch-preview-required',
      result: {
        appliedFiles: ['README.md']
      }
    });
  });

  it('rejects apply when the patch diff differs from the native preview', async () => {
    const bridge = new MemoryBridge();
    let applyCount = 0;
    const controller = new GomiWebviewHostController({
      bridge,
      patchPreviewer: async (message) => ({
        patchId: message.patch.id,
        previewedFiles: message.patch.targetFiles,
        skippedFiles: []
      }),
      patchApplier: async (message) => {
        applyCount += 1;
        return {
          patchId: message.patch.id,
          dryRun: false,
          appliedFiles: message.patch.targetFiles,
          deletedFiles: []
        };
      }
    });

    await controller.handleMessage({
      type: 'gomi.previewPatch',
      patch: createPatch('patch-stale')
    });
    await controller.handleMessage({
      type: 'gomi.applyPatch',
      patch: {
        ...createPatch('patch-stale'),
        diff: 'diff --git a/README.md b/README.md\n@@ -1 +1 @@\n-old\n+different'
      }
    });

    expect(applyCount).toBe(0);
    expect(bridge.outbox[1]).toMatchObject({
      type: 'gomi.applyPatchResult',
      patchId: 'patch-stale',
      error: 'Preview the Gomi patch in the native diff editor before applying it.'
    });
  });

  it('subscribes to bridge messages and disposes cleanly', async () => {
    const bridge = new MemoryBridge();
    const controller = new GomiWebviewHostController({
      bridge,
      runtime: createRuntime([
        {
          type: 'session_completed',
          sessionId: 'session-direct'
        }
      ])
    });

    controller.start();
    bridge.emit({
      type: 'gomi.run',
      request: 'Run through subscription'
    });
    await Promise.resolve();
    controller.dispose();
    bridge.emit({
      type: 'gomi.run',
      request: 'Ignored after dispose'
    });
    await Promise.resolve();

    expect(bridge.outbox).toHaveLength(1);
  });
});

class MemoryBridge implements GomiWorkbenchBridge {
  readonly outbox: GomiBridgeMessage[] = [];
  private readonly listeners = new Set<(message: GomiBridgeMessage) => void>();

  postMessage(message: GomiBridgeMessage): void {
    this.outbox.push(message);
  }

  onMessage(listener: (message: GomiBridgeMessage) => void): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(message: GomiBridgeMessage): void {
    for (const listener of this.listeners) {
      listener(message);
    }
  }
}

function createRuntime(events: GomiRuntimeEvent[]): GomiWebviewRuntimeRunner {
  return {
    async *run() {
      for (const event of events) {
        yield event;
      }
    }
  };
}

function waitForAbort(signal?: AbortSignal): Promise<void> {
  if (!signal || signal.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

function createPatch(id: string): GomiPatchProposal {
  return {
    id,
    filePath: 'README.md',
    targetFiles: ['README.md'],
    summary: 'Update README.',
    diff: 'diff --git a/README.md b/README.md\n@@ -1 +1 @@\n-old\n+new',
    approvalStatus: 'approved',
    riskLevel: 'low',
    createdByAgentId: 'ceo'
  };
}
