import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  setMemoryPrivacyMode,
  setMemoryBroadcastThreshold,
  setSecretRedactionEnabled,
  setSeatWorkMode,
  setSharedMemoryEnabled,
  setWorkspaceTrustState,
  setCliProvidersEnabled
} from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';
import { GomiAgentRuntime } from '../src/vs/workbench/contrib/gomi/node/agentRuntime';
import { createDemoGomiAgentProvider, type GomiAgentRunContext } from '../src/vs/workbench/contrib/gomi/node/agentProvider';

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

  it('can disable shared project memory while preserving session memory updates', async () => {
    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      officeSettings: setSharedMemoryEnabled(DEFAULT_GOMI_OFFICE_SETTINGS, false)
    });
    const memorySources: string[] = [];

    for await (const event of runtime.run('Review API UI database and deployment')) {
      if (event.type === 'memory_update') {
        memorySources.push(event.item.source);
      }
    }

    expect(memorySources).toContain('session');
    expect(memorySources).not.toContain('project');
  });

  it('sanitizes workspace context before indexing and planning', async () => {
    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      officeSettings: setMemoryPrivacyMode(
        setSecretRedactionEnabled(DEFAULT_GOMI_OFFICE_SETTINGS, true),
        'strict'
      ),
      workspaceReader: () => ({
        rootName: 'SecretProject',
        files: ['README.md', '.env', '.env.example', 'src/auth.ts'],
        openEditors: ['.env', 'src/auth.ts'],
        gitSummary: 'Git branch main, 0 changed files.',
        terminalSummary: 'Bearer abcdefghijklmnopqrstuvwxyz',
        contentSnippets: [
          {
            filePath: '.env',
            content: 'API_KEY=super-secret-value',
            language: 'text',
            source: 'workspace'
          },
          {
            filePath: 'src/auth.ts',
            content: 'const API_KEY = "super-secret-value";',
            language: 'typescript',
            source: 'open_editor'
          },
          {
            filePath: 'Terminal: build',
            content: 'Bearer abcdefghijklmnopqrstuvwxyz',
            language: 'text',
            source: 'terminal'
          }
        ]
      })
    });
    const sessionWorkspaces: string[][] = [];
    const memoryContents: string[] = [];

    for await (const event of runtime.run('Review secret project')) {
      if (event.type === 'session_started') {
        sessionWorkspaces.push(event.workspace.files);
        memoryContents.push(...(event.workspace.contentSnippets?.map((snippet) => snippet.content) ?? []));
      }

      if (event.type === 'memory_update') {
        memoryContents.push(event.item.content);
      }
    }

    expect(sessionWorkspaces[0]).not.toContain('.env');
    expect(sessionWorkspaces[0]).toContain('.env.example');
    expect(memoryContents.join('\n')).toContain('[REDACTED]');
    expect(memoryContents.join('\n')).not.toContain('super-secret-value');
    expect(memoryContents.join('\n')).not.toContain('abcdefghijklmnopqrstuvwxyz');
  });

  it('passes live provider execution policy into agent task context', async () => {
    const capturedPolicies: Array<GomiAgentRunContext['executionPolicy']> = [];
    const demoProvider = createDemoGomiAgentProvider();
    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      officeSettings: setCliProvidersEnabled(
        setWorkspaceTrustState(DEFAULT_GOMI_OFFICE_SETTINGS, 'trusted'),
        true
      ),
      agentProvider: {
        id: demoProvider.id,
        label: demoProvider.label,
        kind: demoProvider.kind,
        capabilities: demoProvider.capabilities,
        complete: (request, signal) => demoProvider.complete(request, signal),
        runAgentTask: async (context) => {
          capturedPolicies.push(context.executionPolicy);
          return demoProvider.runAgentTask(context);
        }
      }
    });

    for await (const event of runtime.run('Review provider policy')) {
      if (event.type === 'session_completed') {
        break;
      }
    }

    expect(capturedPolicies[0]).toMatchObject({
      workspaceTrust: 'trusted',
      allowCliProviders: true,
      patchApprovalRequired: true
    });
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
