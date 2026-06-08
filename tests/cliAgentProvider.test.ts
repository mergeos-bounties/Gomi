import { describe, expect, it } from 'vitest';
import { assignSeatProvider, DEFAULT_GOMI_OFFICE_SETTINGS } from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';
import type { GomiAgentId, GomiTask } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import { GomiAgentRuntime } from '../src/vs/workbench/contrib/gomi/node/agentRuntime';
import {
  createNodeCliGomiAgentProvider,
  splitCommandLine,
  type GomiCliCommandInvocation
} from '../src/vs/workbench/contrib/gomi/node/cliAgentProvider';
import type { GomiAgentRunContext } from '../src/vs/workbench/contrib/gomi/node/agentProvider';

describe('Node CLI agent provider', () => {
  it('splits quoted CLI command lines', () => {
    expect(splitCommandLine('codex --model "gpt-5 high" --approval-mode suggest')).toEqual([
      'codex',
      '--model',
      'gpt-5 high',
      '--approval-mode',
      'suggest'
    ]);
  });

  it('runs the selected CLI provider and maps JSON output to an agent result', async () => {
    const invocations: GomiCliCommandInvocation[] = [];
    const provider = createNodeCliGomiAgentProvider({
      enabled: true,
      commandRunner: async (invocation) => {
        invocations.push(invocation);

        return {
          stdout: JSON.stringify({
            summary: 'Backend CLI reviewed the login API.',
            findings: ['Controller and service files need an approval-gated patch.'],
            recommendations: ['Open a diff before applying login changes.'],
            proposedFiles: ['src/api/login.ts'],
            confidence: 0.91
          }),
          stderr: '',
          exitCode: 0
        };
      }
    });

    const result = await provider.runAgentTask(
      createRunContext('backend', 'codex --model "gpt-5 high"')
    );

    expect(invocations[0]).toMatchObject({
      executable: 'codex',
      args: ['--model', 'gpt-5 high'],
      providerId: 'codex-cli',
      agentId: 'backend'
    });
    expect(invocations[0].input).toContain('User request: Fix login and review API');
    expect(invocations[0].input).toContain('workspace:auth');
    expect(result.summary).toBe('Backend CLI reviewed the login API.');
    expect(result.proposedFiles).toEqual(['src/api/login.ts']);
    expect(result.confidence).toBe(0.91);
  });

  it('falls back to the demo provider when CLI execution is disabled', async () => {
    let commandWasCalled = false;
    const provider = createNodeCliGomiAgentProvider({
      enabled: false,
      commandRunner: async () => {
        commandWasCalled = true;

        return {
          stdout: '',
          stderr: '',
          exitCode: 0
        };
      }
    });

    const result = await provider.runAgentTask(createRunContext('qa', 'codex'));

    expect(commandWasCalled).toBe(false);
    expect(result.summary).toContain('Demo provider response');
  });

  it('routes department-head settings through the selected CLI command', async () => {
    const invocations: GomiCliCommandInvocation[] = [];
    const officeSettings = assignSeatProvider(
      DEFAULT_GOMI_OFFICE_SETTINGS,
      'head-designer',
      'gemini-cli'
    );
    const provider = createNodeCliGomiAgentProvider({
      enabled: true,
      commandRunner: async (invocation) => {
        invocations.push(invocation);

        return {
          stdout: JSON.stringify({
            summary: `${invocation.agentId} via ${invocation.providerLabel}`,
            findings: [`Executed ${invocation.executable}`],
            recommendations: ['Keep the result in shared memory.'],
            proposedFiles: [],
            confidence: 0.82
          }),
          stderr: '',
          exitCode: 0
        };
      }
    });
    const runtime = new GomiAgentRuntime({
      delayMs: 0,
      officeSettings,
      agentProvider: provider,
      workspaceReader: () => ({
        rootName: 'RoutingWorkspace',
        files: ['src/vs/workbench/contrib/gomi/browser/PhaserOffice.tsx'],
        openEditors: ['src/vs/workbench/contrib/gomi/browser/PhaserOffice.tsx'],
        gitSummary: 'Git branch master, 0 changed files.',
        terminalSummary: 'npm test passed.'
      })
    });
    const designerSummaries: string[] = [];

    for await (const event of runtime.run('Make the office avatar animation cute')) {
      if (event.type === 'agent_result' && event.result.agentId === 'designer') {
        designerSummaries.push(event.result.summary);
      }
    }

    expect(invocations.some((invocation) => invocation.agentId === 'designer' && invocation.executable === 'gemini')).toBe(
      true
    );
    expect(designerSummaries).toContain('designer via Gemini CLI');
  });
});

function createRunContext(agentId: GomiAgentId, command: string): GomiAgentRunContext {
  const task: GomiTask = {
    id: `task-${agentId}`,
    title: `Run ${agentId}`,
    detail: `Use ${agentId} to inspect the project.`,
    agentId,
    status: 'queued',
    progress: 0
  };

  return {
    sessionId: 'session-test',
    request: 'Fix login and review API',
    workspace: {
      rootName: 'TestWorkspace',
      files: ['src/api/login.ts', 'src/ui/Login.tsx'],
      openEditors: ['src/api/login.ts'],
      gitSummary: 'Git branch feature/login, 1 changed file.',
      terminalSummary: 'npm test',
      contentSnippets: [
        {
          filePath: 'src/api/login.ts',
          content: 'export async function login() {}',
          language: 'typescript',
          source: 'workspace'
        }
      ]
    },
    task,
    memory: [],
    sharedMemory: [
      {
        key: 'workspace:auth',
        value: 'Login route uses session cookies.',
        tags: ['auth'],
        createdAt: '2026-06-09T00:00:00.000Z',
        score: 0.93,
      }
    ],
    agentCli: {
      providerId: 'codex-cli',
      label: 'Codex CLI',
      command
    }
  };
}
