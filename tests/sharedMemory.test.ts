import { describe, expect, it } from 'vitest';
import type { GomiAgentResult, GomiTask, GomiWorkspaceSnapshot } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import { GOMI_DEFAULT_MEMORY_BROADCAST_THRESHOLD } from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';
import { evaluateAgentCommunication } from '../src/vs/workbench/contrib/gomi/node/communicationPolicy';
import { createInMemoryGomiMemoryStore } from '../src/vs/workbench/contrib/gomi/node/memoryStore';
import { GomiSharedProjectMemory } from '../src/vs/workbench/contrib/gomi/node/sharedProjectMemory';

const workspace: GomiWorkspaceSnapshot = {
  rootName: 'Gomi',
  files: ['README.md', 'src/vs/workbench/contrib/gomi/node/agentRuntime.ts'],
  openEditors: [],
  gitSummary: 'Git branch master, 0 changed files.',
  terminalSummary: 'package.json gomi-ide.'
};

const task: GomiTask = {
  id: 'task-1-system-analyst',
  title: 'Map project requirements',
  detail: 'Read project structure and identify modules.',
  agentId: 'system-analyst',
  status: 'running',
  progress: 50
};

const result: GomiAgentResult = {
  agentId: 'system-analyst',
  taskId: task.id,
  summary: 'Mapped project modules and acceptance criteria.',
  findings: ['The project needs a shared memory layer.'],
  recommendations: ['Store facts in shared project memory before broadcasting.'],
  proposedFiles: ['src/vs/workbench/contrib/gomi/node/sharedProjectMemory.ts'],
  confidence: 0.82
};

describe('shared project memory and communication policy', () => {
  it('stores searchable hybrid memory inside a project scope', async () => {
    const memoryStore = createInMemoryGomiMemoryStore();
    const sharedMemory = new GomiSharedProjectMemory(memoryStore, { workspaceId: 'Gomi' });

    const workspaceItems = await sharedMemory.rememberWorkspace(workspace);
    const agentItem = await sharedMemory.rememberAgentResult(result, 0.9);

    const hits = await sharedMemory.searchForTask(task, 'shared memory layer');

    expect(workspaceItems.map((item) => item.key)).toEqual(['workspace:files', 'workspace:git']);
    expect(agentItem.key).toBe(`agent:${result.agentId}:${result.taskId}`);
    expect(hits.map((hit) => hit.key)).toContain(`agent:${result.agentId}:${result.taskId}`);
  });

  it('keeps low-importance updates in memory without broadcasting', () => {
    const decision = evaluateAgentCommunication({
      ...result,
      agentId: 'database',
      proposedFiles: [],
      confidence: 0.74
    });

    expect(decision.shouldBroadcast).toBe(false);
    expect(decision.reason).toContain('Stored in shared project memory');
  });

  it('broadcasts high-importance coordination and QA findings', () => {
    const decision = evaluateAgentCommunication(result);

    expect(decision.threshold).toBe(GOMI_DEFAULT_MEMORY_BROADCAST_THRESHOLD);
    expect(decision.shouldBroadcast).toBe(true);
    expect(decision.broadcastSummary).toContain(result.summary);
  });

  it('uses the configured broadcast threshold for selective agent chat', () => {
    const quietDecision = evaluateAgentCommunication(
      {
        ...result,
        agentId: 'frontend',
        proposedFiles: [],
        confidence: 0.9
      },
      { broadcastThreshold: 0.8 }
    );
    const chattyDecision = evaluateAgentCommunication(
      {
        ...result,
        agentId: 'frontend',
        proposedFiles: [],
        confidence: 0.9
      },
      { broadcastThreshold: 0.55 }
    );

    expect(quietDecision.threshold).toBe(0.8);
    expect(quietDecision.shouldBroadcast).toBe(false);
    expect(chattyDecision.shouldBroadcast).toBe(true);
  });

  it('keeps repeated findings quiet when recalled memory already covers them', async () => {
    const memoryStore = createInMemoryGomiMemoryStore();
    const sharedMemory = new GomiSharedProjectMemory(memoryStore, { workspaceId: 'Gomi' });

    await sharedMemory.rememberAgentResult(result, 0.9);
    const recalledMemory = await sharedMemory.searchForTask(task, 'shared memory layer');
    const decision = evaluateAgentCommunication(result, {
      recalledMemory
    });

    expect(recalledMemory.map((hit) => hit.key)).toContain(`agent:${result.agentId}:${result.taskId}`);
    expect(decision.shouldBroadcast).toBe(false);
    expect(decision.reason).toContain('Already covered');
  });

  it('still broadcasts a new risk that recalled memory does not cover', async () => {
    const memoryStore = createInMemoryGomiMemoryStore();
    const sharedMemory = new GomiSharedProjectMemory(memoryStore, { workspaceId: 'Gomi' });

    await sharedMemory.rememberAgentResult(result, 0.9);
    const recalledMemory = await sharedMemory.searchForTask(task, 'shared memory layer');
    const decision = evaluateAgentCommunication(
      {
        ...result,
        agentId: 'qa',
        summary: 'Found a regression risk in login session invalidation.',
        findings: ['Risk: stale login sessions can bypass logout.'],
        recommendations: ['Add regression tests for session invalidation.'],
        proposedFiles: ['tests/login-session.spec.ts'],
        confidence: 0.84
      },
      {
        recalledMemory
      }
    );

    expect(decision.shouldBroadcast).toBe(true);
    expect(decision.broadcastSummary).toContain('regression risk');
  });
});
