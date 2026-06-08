import { describe, expect, it } from 'vitest';
import type { GomiAgentResult, GomiTask, GomiWorkspaceSnapshot } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
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

    await sharedMemory.rememberWorkspace(workspace);
    await sharedMemory.rememberAgentResult(result, 0.9);

    const hits = await sharedMemory.searchForTask(task, 'shared memory layer');

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

    expect(decision.shouldBroadcast).toBe(true);
    expect(decision.broadcastSummary).toContain(result.summary);
  });
});
