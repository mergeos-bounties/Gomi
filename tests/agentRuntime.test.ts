import { describe, expect, it } from 'vitest';
import { GomiAgentRuntime } from '../src/vs/workbench/contrib/gomi/node/agentRuntime';

describe('GomiAgentRuntime', () => {
  it('streams a final report and patch proposal', async () => {
    const runtime = new GomiAgentRuntime({ delayMs: 0 });
    const eventTypes: string[] = [];
    let agentResultCount = 0;
    let messageCount = 0;

    for await (const event of runtime.run('Review API and UI')) {
      eventTypes.push(event.type);
      if (event.type === 'agent_result') {
        agentResultCount += 1;
      }
      if (event.type === 'message') {
        messageCount += 1;
      }
    }

    expect(eventTypes).toContain('session_started');
    expect(eventTypes).toContain('agent_result');
    expect(eventTypes).toContain('patch');
    expect(eventTypes).toContain('report');
    expect(agentResultCount).toBeGreaterThan(0);
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
});
