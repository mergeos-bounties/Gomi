import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  setSeatWorkMode
} from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';
import type { GomiOfficeSettings, GomiRuntimeEvent } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import type { GomiBridgeMessage, GomiWorkbenchBridge } from '../src/vs/workbench/contrib/gomi/electron-sandbox/gomiBridge';
import {
  GomiWebviewHostController,
  type GomiWebviewRuntimeRunner
} from '../src/vs/workbench/contrib/gomi/browser/gomiWebviewHostController';

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

    await controller.handleMessage({
      type: 'gomi.run',
      request: 'Review login',
      officeSettings: setSeatWorkMode(DEFAULT_GOMI_OFFICE_SETTINGS, 'head-backend', 'sleeping')
    });

    expect(seenSettings[0].seats.find((seat) => seat.id === 'head-backend')?.workMode).toBe('sleeping');
    expect(bridge.outbox.map((message) => message.type)).toEqual(['gomi.event', 'gomi.event']);
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
