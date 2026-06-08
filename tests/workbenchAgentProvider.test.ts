import { describe, expect, it } from 'vitest';
import type { GomiAgentId, GomiAgentCliProviderId, GomiTask } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import type { GomiAgentRunContext } from '../src/vs/workbench/contrib/gomi/node/agentProvider';
import type { GomiCliCommandInvocation } from '../src/vs/workbench/contrib/gomi/node/cliAgentProvider';
import type { GomiHttpFetch } from '../src/vs/workbench/contrib/gomi/node/httpAgentProvider';
import { createWorkbenchGomiAgentProvider } from '../src/vs/workbench/contrib/gomi/node/workbenchAgentProvider';

describe('Workbench agent provider router', () => {
  it('routes CLI seats through the CLI provider', async () => {
    const cliInvocations: GomiCliCommandInvocation[] = [];
    const provider = createWorkbenchGomiAgentProvider({
      enableCliAgentExecution: true,
      cliAgentCommandRunner: async (invocation) => {
        cliInvocations.push(invocation);

        return {
          stdout: JSON.stringify({
            summary: 'CLI backend route completed.',
            findings: ['CLI route was selected.'],
            recommendations: ['Keep diff approval enabled.'],
            proposedFiles: ['src/api/login.ts'],
            confidence: 0.81
          }),
          stderr: '',
          exitCode: 0
        };
      }
    });

    const result = await provider.runAgentTask(createRunContext('backend', 'codex-cli'));

    expect(cliInvocations[0].executable).toBe('codex');
    expect(result.summary).toBe('CLI backend route completed.');
  });

  it('routes cloud and local model seats through the HTTP provider', async () => {
    const httpCalls: string[] = [];
    const fetchImpl: GomiHttpFetch = async (input) => {
      httpCalls.push(input);

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'HTTP designer route completed.',
                  findings: ['HTTP route was selected.'],
                  recommendations: ['Persist useful design facts.'],
                  proposedFiles: ['src/styles.css'],
                  confidence: 0.82
                })
              },
              finish_reason: 'stop'
            }
          ]
        }),
        { status: 200 }
      );
    };
    const provider = createWorkbenchGomiAgentProvider({
      enableHttpAgentExecution: true,
      httpFetch: fetchImpl,
      env: {
        GOMI_CLOUD_LLM_ENDPOINT: 'https://llm.example.test/v1/chat/completions',
        GOMI_CLOUD_LLM_MODEL: 'gomi-cloud-test'
      }
    });

    const result = await provider.runAgentTask(createRunContext('designer', 'openai-compatible-api'));

    expect(httpCalls).toEqual(['https://llm.example.test/v1/chat/completions']);
    expect(result.summary).toBe('HTTP designer route completed.');
  });

  it('keeps demo runtime local and deterministic', async () => {
    const provider = createWorkbenchGomiAgentProvider({
      enableCliAgentExecution: true,
      enableHttpAgentExecution: true
    });

    const result = await provider.runAgentTask(createRunContext('qa', 'demo-runtime'));

    expect(result.summary).toContain('Demo provider response');
  });
});

function createRunContext(
  agentId: GomiAgentId,
  providerId: GomiAgentCliProviderId
): GomiAgentRunContext {
  const task: GomiTask = {
    id: `task-${agentId}`,
    title: `Run ${agentId}`,
    detail: `Use ${agentId} to inspect the project.`,
    agentId,
    status: 'queued',
    progress: 0
  };

  return {
    sessionId: 'session-workbench-router-test',
    request: 'Review Gomi provider routing',
    workspace: {
      rootName: 'Gomi',
      files: ['src/api/login.ts', 'src/styles.css'],
      openEditors: ['src/styles.css'],
      gitSummary: 'Git branch master, 0 changed files.',
      terminalSummary: 'npm test passed.'
    },
    task,
    memory: [],
    sharedMemory: [],
    agentCli: {
      providerId,
      label: providerId,
      command: providerId === 'codex-cli' ? 'codex' : providerId
    }
  };
}
