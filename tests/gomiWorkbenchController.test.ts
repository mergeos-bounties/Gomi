import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { GomiBridgeMessage, GomiWorkbenchBridge } from '../src/vs/workbench/contrib/gomi/electron-sandbox/gomiBridge';
import type { GomiPatchProposal } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import { GomiAgentRuntime } from '../src/vs/workbench/contrib/gomi/node/agentRuntime';
import { GomiWorkbenchController } from '../src/vs/workbench/contrib/gomi/node/gomiWorkbenchController';

let workspaceRoot: string;

beforeEach(async () => {
  workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'gomi-controller-'));
});

afterEach(async () => {
  await fs.rm(workspaceRoot, { recursive: true, force: true });
});

describe('GomiWorkbenchController', () => {
  it('streams runtime events from a run message through the bridge', async () => {
    const bridge = new MemoryWorkbenchBridge();
    const controller = new GomiWorkbenchController({
      bridge,
      workspaceRoot,
      runtime: new GomiAgentRuntime({
        delayMs: 0,
        workspaceReader: () => ({
          rootName: 'BridgeWorkspace',
          files: ['package.json', 'src/app.ts'],
          openEditors: ['src/app.ts'],
          gitSummary: 'Git branch master, 0 changed files.',
          terminalSummary: 'package.json bridge-workspace.'
        })
      })
    });

    await controller.handleMessage({
      type: 'gomi.run',
      request: 'Review API and UI'
    });

    const eventTypes = bridge.outbox
      .filter((message): message is Extract<GomiBridgeMessage, { type: 'gomi.event' }> => message.type === 'gomi.event')
      .map((message) => message.event.type);

    expect(eventTypes).toContain('session_started');
    expect(eventTypes).toContain('patch');
    expect(eventTypes).toContain('report');
    expect(eventTypes.at(-1)).toBe('session_completed');
  });

  it('applies an approved patch message inside the workspace', async () => {
    const bridge = new MemoryWorkbenchBridge();
    const controller = new GomiWorkbenchController({ bridge, workspaceRoot });
    const patch = createPatch({
      diff: [
        'diff --git a/docs/bridge.md b/docs/bridge.md',
        'new file mode 100644',
        '--- /dev/null',
        '+++ b/docs/bridge.md',
        '@@ -0,0 +1,2 @@',
        '+# Bridge Patch',
        '+Applied through GomiWorkbenchController.'
      ].join('\n')
    });

    await controller.handleMessage({
      type: 'gomi.applyPatch',
      patch
    });

    const resultMessage = bridge.outbox.find(
      (message): message is Extract<GomiBridgeMessage, { type: 'gomi.applyPatchResult' }> =>
        message.type === 'gomi.applyPatchResult'
    );
    const content = await fs.readFile(path.join(workspaceRoot, 'docs', 'bridge.md'), 'utf8');

    expect(resultMessage?.result?.appliedFiles).toEqual(['docs/bridge.md']);
    expect(resultMessage?.error).toBeUndefined();
    expect(content).toContain('Bridge Patch');
  });

  it('returns bridge errors for unapproved patch messages', async () => {
    const bridge = new MemoryWorkbenchBridge();
    const controller = new GomiWorkbenchController({ bridge, workspaceRoot });

    await controller.handleMessage({
      type: 'gomi.applyPatch',
      patch: createPatch({
        approvalStatus: 'pending',
        diff: [
          'diff --git a/docs/bridge.md b/docs/bridge.md',
          '--- /dev/null',
          '+++ b/docs/bridge.md',
          '@@ -0,0 +1 @@',
          '+blocked'
        ].join('\n')
      })
    });

    const resultMessage = bridge.outbox.find(
      (message): message is Extract<GomiBridgeMessage, { type: 'gomi.applyPatchResult' }> =>
        message.type === 'gomi.applyPatchResult'
    );

    expect(resultMessage?.error).toContain('must be approved');
    expect(resultMessage?.result).toBeUndefined();
  });

  it('subscribes and disposes bridge listeners', async () => {
    const bridge = new MemoryWorkbenchBridge();
    const controller = new GomiWorkbenchController({
      bridge,
      workspaceRoot,
      applyPatch: async () => ({
        patchId: 'ignored',
        dryRun: true,
        appliedFiles: [],
        deletedFiles: []
      })
    });

    controller.start();
    bridge.emit({
      type: 'gomi.applyPatch',
      patch: createPatch({ id: 'first' })
    });
    await Promise.resolve();
    controller.dispose();
    bridge.emit({
      type: 'gomi.applyPatch',
      patch: createPatch({ id: 'second' })
    });
    await Promise.resolve();

    expect(bridge.outbox).toHaveLength(1);
    expect(bridge.outbox[0]).toMatchObject({
      type: 'gomi.applyPatchResult',
      patchId: 'first'
    });
  });

  it('uses persistent project memory for the default workbench runtime', async () => {
    const bridge = new MemoryWorkbenchBridge();
    const memoryDirectory = path.join(workspaceRoot, '.gomi-ide', 'memory');
    await fs.writeFile(
      path.join(workspaceRoot, 'package.json'),
      JSON.stringify({ name: 'persistent-workspace', scripts: { test: 'vitest' } }),
      'utf8'
    );
    const controller = new GomiWorkbenchController({
      bridge,
      workspaceRoot,
      memoryDirectory,
      runtimeOptions: {
        delayMs: 0
      }
    });

    await controller.handleMessage({
      type: 'gomi.run',
      request: 'Review workspace memory'
    });

    const lexicalMemory = await fs.readFile(path.join(memoryDirectory, 'lexical-memory.json'), 'utf8');
    const vectorMemory = await fs.readFile(path.join(memoryDirectory, 'vector-memory.json'), 'utf8');

    expect(lexicalMemory).toContain('Review workspace memory');
    expect(lexicalMemory).toContain('workspace:files');
    expect(vectorMemory).toContain('workspace:files');
  });
});

class MemoryWorkbenchBridge implements GomiWorkbenchBridge {
  readonly outbox: GomiBridgeMessage[] = [];
  private listeners = new Set<(message: GomiBridgeMessage) => void>();

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

function createPatch(overrides: Partial<GomiPatchProposal>): GomiPatchProposal {
  return {
    id: 'patch-test',
    filePath: 'docs/bridge.md',
    targetFiles: ['docs/bridge.md'],
    summary: 'Test patch.',
    diff: '',
    approvalStatus: 'approved',
    riskLevel: 'low',
    createdByAgentId: 'ceo',
    ...overrides
  };
}
