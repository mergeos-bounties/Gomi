import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  setMemoryPrivacyMode,
  setMemoryBroadcastThreshold,
  setMaxConcurrentAgentRuns,
  setSecretRedactionEnabled,
  setSeatWorkMode,
  setSharedMemoryEnabled,
  setWorkspaceTrustState,
  setCliProvidersEnabled
} from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';
import { GomiAgentRuntime } from '../src/vs/workbench/contrib/gomi/node/agentRuntime';
import { createDemoGomiAgentProvider, type GomiAgentRunContext } from '../src/vs/workbench/contrib/gomi/node/agentProvider';
import { createInMemoryGomiMemoryStore } from '../src/vs/workbench/contrib/gomi/node/memoryStore';
import { createInMemoryVectorMemoryStore } from '../src/vs/workbench/contrib/gomi/node/vectorMemoryStore';

describe('GomiAgentRuntime', () => {
  it('streams a final report and patch proposal', async () => {
    const runtime = new GomiAgentRuntime({ delayMs: 0 });
    const eventTypes: string[] = [];
    let agentResultCount = 0;
    let memoryUpdateCount = 0;
    const memoryKeys: string[] = [];
    let messageCount = 0;
    const directedMessagePairs: string[] = [];

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
        if (event.message.recipientId) {
          directedMessagePairs.push(`${event.message.senderId}->${event.message.recipientId}`);
        }
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
    expect(directedMessagePairs).toContain('ceo->system-analyst');
    expect(directedMessagePairs.some((pair) => !pair.startsWith('ceo->'))).toBe(true);
    expect(messageCount).toBeLessThan(agentResultCount + 4);
    expect(eventTypes.at(-1)).toBe('session_completed');
  });

  it('aggregates agent usage estimates into the final report', async () => {
    const demoProvider = createDemoGomiAgentProvider();
    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      agentProvider: {
        id: demoProvider.id,
        label: demoProvider.label,
        kind: demoProvider.kind,
        capabilities: demoProvider.capabilities,
        complete: (request, signal) => demoProvider.complete(request, signal),
        runAgentTask: async (context) => ({
          agentId: context.task.agentId,
          taskId: context.task.id,
          summary: `${context.task.id} used HTTP tokens`,
          findings: [],
          recommendations: [],
          proposedFiles: [],
          confidence: 1,
          usageEstimate: {
            providerId: 'openai-compatible-api',
            model: 'gomi-cloud-test',
            inputTokens: 120,
            outputTokens: 40,
            totalTokens: 160,
            estimatedCostUsd: 0.00024,
            hasEstimatedTokens: false,
            pricing: {
              inputUsdPerMillionTokens: 1,
              outputUsdPerMillionTokens: 3,
              label: 'Display estimate'
            }
          }
        })
      }
    });
    let finalReportUsage;

    for await (const event of runtime.run('Review usage estimates')) {
      if (event.type === 'report') {
        finalReportUsage = event.report.usageEstimate;
      }
    }

    expect(finalReportUsage).toMatchObject({
      runCount: 7,
      inputTokens: 840,
      outputTokens: 280,
      totalTokens: 1120,
      hasEstimatedTokens: false
    });
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

  it('prunes memory explicitly and returns a combined removal report', async () => {
    const memoryStore = createInMemoryGomiMemoryStore();
    const vectorMemoryStore = createInMemoryVectorMemoryStore();
    const scope = { workspaceId: 'ManualPruneWorkspace' };
    const memorySettings = {
      ...DEFAULT_GOMI_OFFICE_SETTINGS.memory,
      maxProjectMemoryItems: 1
    };

    await memoryStore.put(scope, {
      key: 'workspace:oldest',
      value: 'Oldest lexical context'
    });
    await memoryStore.put(scope, {
      key: 'workspace:middle',
      value: 'Middle lexical context'
    });
    await memoryStore.put(scope, {
      key: 'workspace:newest',
      value: 'Newest lexical context'
    });
    await vectorMemoryStore.upsert(scope, {
      key: 'agent:older',
      value: 'Older vector context'
    });
    await vectorMemoryStore.upsert(scope, {
      key: 'agent:newer',
      value: 'Newer vector context'
    });

    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      memoryStore,
      vectorMemoryStore,
      officeSettings: {
        ...DEFAULT_GOMI_OFFICE_SETTINGS,
        memory: memorySettings
      },
      workspaceReader: () => ({
        rootName: 'ManualPruneWorkspace',
        files: [],
        openEditors: [],
        gitSummary: 'Git clean.',
        terminalSummary: 'Idle.'
      })
    });

    await expect(runtime.pruneMemory()).resolves.toEqual({
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
    });
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

  it('stops a running session before generating patch and report output', async () => {
    const abortController = new AbortController();
    const runtime = new GomiAgentRuntime({ delayMs: 20 });
    const eventTypes: string[] = [];

    for await (const event of runtime.run('Review stop behavior', {
      signal: abortController.signal,
      stopReason: 'Stopped by test.'
    })) {
      eventTypes.push(event.type);

      if (event.type === 'message' && event.message.senderId === 'ceo') {
        abortController.abort('test stop');
      }
    }

    expect(eventTypes).toContain('session_started');
    expect(eventTypes).toContain('session_stopped');
    expect(eventTypes).not.toContain('patch');
    expect(eventTypes).not.toContain('report');
    expect(eventTypes.at(-1)).toBe('session_completed');
  });

  it('passes the run abort signal into agent providers', async () => {
    const abortController = new AbortController();
    const seenSignals: Array<AbortSignal | undefined> = [];
    const demoProvider = createDemoGomiAgentProvider();
    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      agentProvider: {
        id: demoProvider.id,
        label: demoProvider.label,
        kind: demoProvider.kind,
        capabilities: demoProvider.capabilities,
        complete: (request, signal) => demoProvider.complete(request, signal),
        runAgentTask: async (context) => {
          seenSignals.push(context.signal);
          abortController.abort('provider test stop');

          return demoProvider.runAgentTask(context);
        }
      }
    });

    for await (const event of runtime.run('Review provider signal', {
      signal: abortController.signal
    })) {
      if (event.type === 'session_completed') {
        break;
      }
    }

    expect(seenSignals[0]).toBe(abortController.signal);
  });

  it('streams provider progress details into task updates', async () => {
    const demoProvider = createDemoGomiAgentProvider();
    const statusDetails: string[] = [];
    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      officeSettings: setMaxConcurrentAgentRuns(DEFAULT_GOMI_OFFICE_SETTINGS, 1),
      agentProvider: {
        id: demoProvider.id,
        label: demoProvider.label,
        kind: demoProvider.kind,
        capabilities: demoProvider.capabilities,
        complete: (request, signal) => demoProvider.complete(request, signal),
        runAgentTask: async (context) => {
          context.reportProgress?.({
            progress: 47,
            statusDetail: 'Retry attempt 2/3 after HTTP 429'
          });

          return {
            agentId: context.task.agentId,
            taskId: context.task.id,
            summary: `${context.task.id} retried`,
            findings: [],
            recommendations: [],
            proposedFiles: [],
            confidence: 1
          };
        }
      }
    });

    for await (const event of runtime.run('Review API UI')) {
      if (event.type === 'task_update' && event.task.statusDetail) {
        statusDetails.push(event.task.statusDetail);
      }
    }

    expect(statusDetails).toContain('Retry attempt 2/3 after HTTP 429');
  });

  it('limits concurrent provider runs while starting queued tasks in order', async () => {
    const demoProvider = createDemoGomiAgentProvider();
    const startedTaskIds: string[] = [];
    const finishedTaskIds: string[] = [];
    const releaseQueuedRun: Array<() => void> = [];
    let activeRuns = 0;
    let maxActiveRuns = 0;
    let holdRuns = true;
    const abortController = new AbortController();
    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      officeSettings: setMaxConcurrentAgentRuns(DEFAULT_GOMI_OFFICE_SETTINGS, 2),
      agentProvider: {
        id: demoProvider.id,
        label: demoProvider.label,
        kind: demoProvider.kind,
        capabilities: demoProvider.capabilities,
        complete: (request, signal) => demoProvider.complete(request, signal),
        runAgentTask: async (context) => {
          startedTaskIds.push(context.task.id);
          activeRuns += 1;
          maxActiveRuns = Math.max(maxActiveRuns, activeRuns);

          if (holdRuns) {
            await new Promise<void>((resolve) => {
              releaseQueuedRun.push(resolve);
            });
          }

          activeRuns -= 1;
          finishedTaskIds.push(context.task.id);

          return {
            agentId: context.task.agentId,
            taskId: context.task.id,
            summary: `${context.task.id} done`,
            findings: [],
            recommendations: [],
            proposedFiles: [],
            confidence: 1
          };
        }
      }
    });
    const runPromise = drainRuntime(runtime, 'Review API UI database and deployment', abortController.signal);

    try {
      await waitFor(() => releaseQueuedRun.length === 2);
      expect(startedTaskIds.slice(0, 2)).toEqual(['task-1-system-analyst', 'task-2-frontend']);
      expect(finishedTaskIds).toHaveLength(0);
      expect(maxActiveRuns).toBe(2);

      releaseQueuedRun.shift()?.();
      await waitFor(() => startedTaskIds.length === 3);
      expect(startedTaskIds[2]).toBe('task-3-designer');

      holdRuns = false;
      while (releaseQueuedRun.length > 0) {
        releaseQueuedRun.shift()?.();
      }
      await runPromise;
    } catch (error) {
      abortController.abort('concurrency test cleanup');
      while (releaseQueuedRun.length > 0) {
        releaseQueuedRun.shift()?.();
      }
      await runPromise;
      throw error;
    }
  });

  it('stops queued provider work when the run is cancelled', async () => {
    const abortController = new AbortController();
    const demoProvider = createDemoGomiAgentProvider();
    const startedTaskIds: string[] = [];
    const eventTypes: string[] = [];
    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      officeSettings: setMaxConcurrentAgentRuns(DEFAULT_GOMI_OFFICE_SETTINGS, 1),
      agentProvider: {
        id: demoProvider.id,
        label: demoProvider.label,
        kind: demoProvider.kind,
        capabilities: demoProvider.capabilities,
        complete: (request, signal) => demoProvider.complete(request, signal),
        runAgentTask: async (context) => {
          startedTaskIds.push(context.task.id);
          abortController.abort('cancel queued work');

          return {
            agentId: context.task.agentId,
            taskId: context.task.id,
            summary: `${context.task.id} cancelled`,
            findings: [],
            recommendations: [],
            proposedFiles: [],
            confidence: 1
          };
        }
      }
    });

    for await (const event of runtime.run('Review API UI database and deployment', {
      signal: abortController.signal
    })) {
      eventTypes.push(event.type);
    }

    expect(startedTaskIds).toEqual(['task-1-system-analyst']);
    expect(eventTypes).toContain('session_stopped');
    expect(eventTypes.at(-1)).toBe('session_completed');
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

async function drainRuntime(
  runtime: GomiAgentRuntime,
  request: string,
  signal: AbortSignal
): Promise<void> {
  for await (const event of runtime.run(request, { signal })) {
    if (event.type === 'session_completed') {
      break;
    }
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) {
      return;
    }

    await new Promise((resolve) => globalThis.setTimeout(resolve, 10));
  }

  throw new Error('Timed out waiting for runtime condition.');
}
