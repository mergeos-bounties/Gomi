import { describe, expect, it } from 'vitest';
import type { GomiAgentId, GomiTask } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import type { GomiAgentRunContext } from '../src/vs/workbench/contrib/gomi/node/agentProvider';
import {
  createHttpGomiAgentProvider,
  type GomiHttpFetch
} from '../src/vs/workbench/contrib/gomi/node/httpAgentProvider';

describe('HTTP agent provider', () => {
  it('calls an OpenAI-compatible chat endpoint and maps JSON model output', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl: GomiHttpFetch = async (input, init) => {
      calls.push({ input, init });

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: 'Cloud backend agent reviewed the login API.',
                  findings: ['Controller should keep approval-gated patches.'],
                  recommendations: ['Open native diff preview before applying.'],
                  proposedFiles: ['src/api/login.ts'],
                  confidence: 0.88
                })
              },
              finish_reason: 'stop'
            }
          ],
          usage: {
            prompt_tokens: 120,
            completion_tokens: 40,
            total_tokens: 160
          }
        }),
        { status: 200 }
      );
    };
    const provider = createHttpGomiAgentProvider({
      enabled: true,
      fetchImpl,
      env: {
        GOMI_CLOUD_LLM_ENDPOINT: 'https://llm.example.test/v1/chat/completions',
        GOMI_CLOUD_LLM_API_KEY: 'test-key',
        GOMI_CLOUD_LLM_MODEL: 'gomi-cloud-test'
      }
    });

    const result = await provider.runAgentTask(createRunContext('backend', 'openai-compatible-api'));
    const body = JSON.parse(String(calls[0].init?.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    const headers = calls[0].init?.headers as Record<string, string>;

    expect(calls[0].input).toBe('https://llm.example.test/v1/chat/completions');
    expect(headers.authorization).toBe('Bearer test-key');
    expect(body.model).toBe('gomi-cloud-test');
    expect(body.messages.some((message) => message.content.includes('Shared memory'))).toBe(true);
    expect(result.summary).toBe('Cloud backend agent reviewed the login API.');
    expect(result.proposedFiles).toEqual(['src/api/login.ts']);
    expect(result.confidence).toBe(0.88);
  });

  it('calls an Ollama-compatible local chat endpoint', async () => {
    const calls: Array<{ input: string; init?: RequestInit }> = [];
    const fetchImpl: GomiHttpFetch = async (input, init) => {
      calls.push({ input, init });

      return new Response(
        JSON.stringify({
          message: {
            content: 'Local QA model found no blocker in tests/agentRuntime.test.ts.'
          },
          done_reason: 'stop',
          prompt_eval_count: 80,
          eval_count: 20
        }),
        { status: 200 }
      );
    };
    const provider = createHttpGomiAgentProvider({
      enabled: true,
      fetchImpl,
      env: {
        GOMI_LOCAL_LLM_ENDPOINT: 'http://127.0.0.1:11434/api/chat',
        GOMI_LOCAL_LLM_MODEL: 'gomi-local-test'
      }
    });

    const result = await provider.runAgentTask(createRunContext('qa', 'ollama-local-model'));
    const body = JSON.parse(String(calls[0].init?.body)) as {
      model: string;
      stream: boolean;
    };

    expect(calls[0].input).toBe('http://127.0.0.1:11434/api/chat');
    expect(body.model).toBe('gomi-local-test');
    expect(body.stream).toBe(false);
    expect(result.summary).toContain('Local QA model');
    expect(result.proposedFiles).toEqual(['tests/agentRuntime.test.ts']);
  });

  it('falls back to the demo provider when HTTP execution is disabled', async () => {
    let fetchWasCalled = false;
    const provider = createHttpGomiAgentProvider({
      enabled: false,
      fetchImpl: async () => {
        fetchWasCalled = true;
        return new Response('{}', { status: 200 });
      }
    });

    const result = await provider.runAgentTask(createRunContext('designer', 'openai-compatible-api'));

    expect(fetchWasCalled).toBe(false);
    expect(result.summary).toContain('Demo provider response');
  });
});

function createRunContext(
  agentId: GomiAgentId,
  providerId: 'openai-compatible-api' | 'ollama-local-model'
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
    sessionId: 'session-http-test',
    request: 'Fix login and review API',
    workspace: {
      rootName: 'TestWorkspace',
      files: ['src/api/login.ts', 'tests/agentRuntime.test.ts', 'README.md'],
      openEditors: ['src/api/login.ts'],
      gitSummary: 'Git branch feature/login, 1 changed file.',
      terminalSummary: 'npm test passed.',
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
        score: 0.93
      }
    ],
    agentCli: {
      providerId,
      label: providerId === 'ollama-local-model' ? 'Ollama Local Model' : 'OpenAI-Compatible API',
      command: providerId
    }
  };
}
