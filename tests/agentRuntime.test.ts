import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  setMemoryBroadcastThreshold,
  setSeatWorkMode
} from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';
import { GomiAgentRuntime } from '../src/vs/workbench/contrib/gomi/node/agentRuntime';

describe('GomiAgentRuntime', () => {
  it('streams a final report and patch proposal', async () => {
    const runtime = new GomiAgentRuntime({ delayMs: 0 });
    const eventTypes: string[] = [];
    let agentResultCount = 0;
    let memoryUpdateCount = 0;
    const memoryKeys: string[] = [];
    let messageCount = 0;

    for await (const event of runtime.run('Review API and UI')) {
      eventTypes.push(event.type);
      if (event.type === 'agent_result') {
        agentResultCount += 1;
      }
      if (event.type === 'memory_update') {
        memoryUpdateCount += 1;
        memoryKeys.push(event.item.key);
      }
      if (event.type === 'message') {
        messageCount += 1;
      }
    }

    expect(eventTypes).toContain('session_started');
    expect(eventTypes).toContain('memory_update');
    expect(eventTypes).toContain('agent_result');
    expect(eventTypes).toContain('patch');
    expect(eventTypes).toContain('report');
    expect(agentResultCount).toBeGreaterThan(0);
    expect(memoryUpdateCount).toBeGreaterThan(agentResultCount);
    expect(memoryKeys).toContain('workspace:files');
    expect(memoryKeys.some((key) => key.startsWith('agent:'))).toBe(true);
    expect(messageCount).toBeLessThan(agentResultCount + 4);
    expect(eventTypes.at(-1)).toBe('session_completed');
  });

  it('uses an injected workspace reader for project context', async () => {
    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      workspaceReader: () => ({
        rootName: 'InjectedWorkspace',
        files: ['package.json', 'src/server.ts'],
        openEditors: ['src/server.ts'],
        gitSummary: 'Git branch feature/gomi, 0 changed files.',
        terminalSummary: 'package.json injected-workspace.'
      })
    });
    const rootNames: string[] = [];

    for await (const event of runtime.run('Review injected project')) {
      if (event.type === 'session_started') {
        rootNames.push(event.workspace.rootName);
      }
    }

    expect(rootNames).toEqual(['InjectedWorkspace']);
  });

  it('keeps sleeping department heads seated while skipping their task', async () => {
    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      officeSettings: setSeatWorkMode(DEFAULT_GOMI_OFFICE_SETTINGS, 'head-backend', 'sleeping')
    });
    const backendStatuses: string[] = [];
    const backendResults: string[] = [];
    const blockedTasks: string[] = [];

    for await (const event of runtime.run('Build a backend API')) {
      if (event.type === 'agent_status' && event.agentId === 'backend') {
        backendStatuses.push(event.status);
      }
      if (event.type === 'agent_result' && event.result.agentId === 'backend') {
        backendResults.push(event.result.taskId);
      }
      if (event.type === 'task_update' && event.task.agentId === 'backend') {
        blockedTasks.push(event.task.status);
      }
    }

    expect(backendStatuses).toContain('sleeping');
    expect(backendResults).toHaveLength(0);
    expect(blockedTasks).toContain('blocked');
  });

  it('uses office memory settings to decide when agents broadcast chat', async () => {
    const quietRuntime = new GomiAgentRuntime({
      delayMs: 0,
      officeSettings: setMemoryBroadcastThreshold(DEFAULT_GOMI_OFFICE_SETTINGS, 0.95)
    });
    const chattyRuntime = new GomiAgentRuntime({
      delayMs: 0,
      officeSettings: setMemoryBroadcastThreshold(DEFAULT_GOMI_OFFICE_SETTINGS, 0.45)
    });

    const quietAgentMessages = await countSpecialistMessages(quietRuntime);
    const chattyAgentMessages = await countSpecialistMessages(chattyRuntime);

    expect(quietAgentMessages).toBeLessThan(chattyAgentMessages);
  });
});

async function countSpecialistMessages(runtime: GomiAgentRuntime): Promise<number> {
  let messageCount = 0;

  for await (const event of runtime.run('Review API UI database and deployment')) {
    if (
      event.type === 'message' &&
      !['user', 'ceo', 'pet-gomi', 'system'].includes(event.message.senderId)
    ) {
      messageCount += 1;
    }
  }

  return messageCount;
}
