import { BASE_GOMI_AGENTS } from '../common/gomiConstants';
import { GOMI_AGENT_CLI_PROVIDERS, getProviderLabel } from '../common/gomiOfficeSettings';
import type {
  GomiAgentCliProvider,
  GomiAgentCliProviderId,
  GomiAgentId,
  GomiAgentResult
} from '../common/gomiTypes';
import {
  createDemoGomiAgentProvider,
  type GomiAgentProvider,
  type GomiAgentRequest,
  type GomiAgentResponse,
  type GomiAgentRunContext,
  type GomiProviderMessage
} from './agentProvider';

export type GomiHttpProviderMode = 'openai-compatible' | 'ollama-chat';

export interface GomiHttpProviderRoute {
  providerId: GomiAgentCliProviderId;
  mode: GomiHttpProviderMode;
  endpoint?: string;
  endpointEnv?: string;
  apiKey?: string;
  apiKeyEnv?: string;
  model?: string;
  modelEnv?: string;
  timeoutMs?: number;
}

export type GomiHttpFetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpGomiAgentProviderOptions {
  enabled?: boolean;
  routes?: Partial<Record<GomiAgentCliProviderId, GomiHttpProviderRoute>>;
  providerCatalog?: GomiAgentCliProvider[];
  fallbackProvider?: GomiAgentProvider;
  fetchImpl?: GomiHttpFetch;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
}

const defaultOpenAiEndpoint = 'https://api.openai.com/v1/chat/completions';
const defaultOllamaEndpoint = 'http://127.0.0.1:11434/api/chat';

const roleFocus: Record<GomiAgentId, string> = {
  ceo: 'coordination, delegation, and final synthesis',
  'system-analyst': 'requirements, modules, dependencies, and acceptance criteria',
  backend: 'API, controller, service, model, and server-side logic',
  frontend: 'workbench views, webview UI, state, and user interaction',
  designer: 'UX flow, visual hierarchy, office atmosphere, avatar style, and interaction polish',
  database: 'schema, migration, relationship, and persistence design',
  qa: 'logic risks, test coverage, regression gates, and edge cases',
  devops: 'build, package, environment, registry, and CI/CD readiness'
};

export class HttpGomiAgentProvider implements GomiAgentProvider {
  readonly id = 'http-agent-router';
  readonly label = 'HTTP LLM Agent Router';
  readonly kind = 'cloud';
  readonly capabilities = {
    streaming: false,
    tools: false,
    maxContextTokens: 64000
  };

  private readonly enabled: boolean;
  private readonly providerCatalog: GomiAgentCliProvider[];
  private readonly fallbackProvider: GomiAgentProvider;
  private readonly fetchImpl: GomiHttpFetch;
  private readonly env: Record<string, string | undefined>;
  private readonly timeoutMs: number;
  private readonly routes: Partial<Record<GomiAgentCliProviderId, GomiHttpProviderRoute>>;

  constructor(options: HttpGomiAgentProviderOptions = {}) {
    this.enabled = options.enabled ?? false;
    this.providerCatalog = options.providerCatalog ?? GOMI_AGENT_CLI_PROVIDERS;
    this.fallbackProvider = options.fallbackProvider ?? createDemoGomiAgentProvider();
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.env = options.env ?? readRuntimeEnv();
    this.timeoutMs = options.timeoutMs ?? 120000;
    this.routes = {
      ...createRoutesFromCatalog(this.providerCatalog),
      ...options.routes
    };
  }

  async complete(request: GomiAgentRequest, signal?: AbortSignal): Promise<GomiAgentResponse> {
    const providerId = request.metadata?.providerId as GomiAgentCliProviderId | undefined;
    const route = providerId ? this.routes[providerId] : this.routes['openai-compatible-api'];

    if (!this.enabled || !route) {
      return this.fallbackProvider.complete(request, signal);
    }

    return this.completeWithRoute(route, request, signal);
  }

  async runAgentTask(context: GomiAgentRunContext): Promise<GomiAgentResult> {
    const providerId = context.agentCli?.providerId ?? 'demo-runtime';
    const route = this.routes[providerId];

    if (!this.enabled || !route) {
      return this.fallbackProvider.runAgentTask(context);
    }

    try {
      const response = await this.completeWithRoute(route, createAgentRequest(context));

      return createAgentResultFromHttpResponse(context, response);
    } catch (error) {
      return createConfigurationErrorResult(
        context,
        `${getProviderLabel(providerId)} request failed: ${error instanceof Error ? error.message : 'Unknown HTTP provider error.'}`
      );
    }
  }

  private async completeWithRoute(
    route: GomiHttpProviderRoute,
    request: GomiAgentRequest,
    signal?: AbortSignal
  ): Promise<GomiAgentResponse> {
    const endpoint = resolveRouteEndpoint(route, this.env);
    const model = resolveRouteModel(route, this.env);
    const abortController = new AbortController();
    const timeout = route.timeoutMs ?? this.timeoutMs;
    const timer = globalThis.setTimeout(() => {
      abortController.abort();
    }, timeout);
    const linkedAbort = () => abortController.abort();
    const messages = createProviderMessages(request);

    try {
      signal?.addEventListener('abort', linkedAbort, { once: true });

      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: createHeaders(route, this.env),
        body: JSON.stringify(createRequestBody(route.mode, model, messages, request.temperature)),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${shortenText(await response.text(), 240)}`);
      }

      const payload = await response.json() as unknown;
      return parseHttpProviderResponse(route.mode, payload);
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error(`Provider timed out after ${timeout}ms.`);
      }

      throw error;
    } finally {
      globalThis.clearTimeout(timer);
      signal?.removeEventListener('abort', linkedAbort);
    }
  }
}

export function createHttpGomiAgentProvider(
  options: HttpGomiAgentProviderOptions = {}
): GomiAgentProvider {
  return new HttpGomiAgentProvider(options);
}

function createRoutesFromCatalog(
  providerCatalog: GomiAgentCliProvider[]
): Partial<Record<GomiAgentCliProviderId, GomiHttpProviderRoute>> {
  const routes: Partial<Record<GomiAgentCliProviderId, GomiHttpProviderRoute>> = {};

  for (const provider of providerCatalog) {
    if (provider.transport !== 'openai-compatible' && provider.transport !== 'ollama-chat') {
      continue;
    }

    routes[provider.id] = {
      providerId: provider.id,
      mode: provider.transport,
      endpointEnv: provider.endpointEnv,
      apiKeyEnv: provider.apiKeyEnv,
      modelEnv: provider.modelEnv
    };
  }

  return routes;
}

function createAgentRequest(context: GomiAgentRunContext): GomiAgentRequest {
  const agentName = BASE_GOMI_AGENTS.find((agent) => agent.id === context.task.agentId)?.name ?? context.task.agentId;
  const memoryHits = context.sharedMemory
    .slice(0, 8)
    .map((hit) => `- ${hit.key}: ${hit.value}`)
    .join('\n');
  const snippets = context.workspace.contentSnippets
    ?.slice(0, 8)
    .map((snippet) => `--- ${snippet.filePath}\n${snippet.content}`)
    .join('\n') ?? '';

  return {
    system: [
      `You are ${agentName} inside Gomi Office IDE.`,
      `Role focus: ${roleFocus[context.task.agentId]}.`,
      'Return JSON when possible with summary, findings[], recommendations[], proposedFiles[], confidence.'
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: [
          `Task: ${context.task.title}`,
          `Task detail: ${context.task.detail}`,
          `User request: ${context.request}`,
          `Workspace: ${context.workspace.rootName}`,
          `Files: ${context.workspace.files.slice(0, 100).join(', ') || 'No files indexed.'}`,
          `Open editors: ${context.workspace.openEditors.join(', ') || 'None'}`,
          `Git: ${context.workspace.gitSummary}`,
          `Terminal: ${context.workspace.terminalSummary}`,
          'Shared memory:',
          memoryHits || '- No relevant memory hits.',
          'Context snippets:',
          snippets || '- No snippets available.'
        ].join('\n\n')
      }
    ],
    workspaceContext: context.workspace.files,
    memory: context.memory,
    temperature: 0.2,
    metadata: {
      providerId: context.agentCli?.providerId,
      agentId: context.task.agentId,
      taskId: context.task.id
    }
  };
}

function createProviderMessages(request: GomiAgentRequest): GomiProviderMessage[] {
  return [
    request.system
      ? {
          role: 'system',
          content: request.system
        } satisfies GomiProviderMessage
      : undefined,
    ...request.messages
  ].filter(Boolean) as GomiProviderMessage[];
}

function createRequestBody(
  mode: GomiHttpProviderMode,
  model: string,
  messages: GomiProviderMessage[],
  temperature = 0.2
): Record<string, unknown> {
  if (mode === 'ollama-chat') {
    return {
      model,
      messages,
      stream: false,
      options: {
        temperature
      }
    };
  }

  return {
    model,
    messages,
    temperature,
    stream: false
  };
}

function createHeaders(
  route: GomiHttpProviderRoute,
  env: Record<string, string | undefined>
): Record<string, string> {
  const apiKey = route.apiKey ?? (route.apiKeyEnv ? env[route.apiKeyEnv] : undefined);
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };

  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function parseHttpProviderResponse(
  mode: GomiHttpProviderMode,
  payload: unknown
): GomiAgentResponse {
  if (!payload || typeof payload !== 'object') {
    return {
      text: '',
      finishReason: 'error',
      raw: payload
    };
  }

  if (mode === 'ollama-chat') {
    const ollamaPayload = payload as {
      message?: {
        content?: string;
      };
      done_reason?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };
    const inputTokens = ollamaPayload.prompt_eval_count;
    const outputTokens = ollamaPayload.eval_count;

    return {
      text: ollamaPayload.message?.content ?? '',
      finishReason: ollamaPayload.done_reason === 'length' ? 'length' : 'stop',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens:
          inputTokens !== undefined || outputTokens !== undefined
            ? (inputTokens ?? 0) + (outputTokens ?? 0)
            : undefined
      },
      raw: payload
    };
  }

  const chatPayload = payload as {
    choices?: Array<{
      message?: {
        content?: string;
      };
      finish_reason?: string;
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
  const choice = chatPayload.choices?.[0];

  return {
    text: choice?.message?.content ?? '',
    finishReason: choice?.finish_reason === 'length' ? 'length' : 'stop',
    usage: {
      inputTokens: chatPayload.usage?.prompt_tokens,
      outputTokens: chatPayload.usage?.completion_tokens,
      totalTokens: chatPayload.usage?.total_tokens
    },
    raw: payload
  };
}

function createAgentResultFromHttpResponse(
  context: GomiAgentRunContext,
  response: GomiAgentResponse
): GomiAgentResult {
  const parsed = parseProviderJson(response.text);
  const proposedFiles = normalizeProposedFiles(
    parsed?.proposedFiles,
    response.text,
    context.workspace.files
  );
  const outputSummary = shortenText(response.text.trim() || 'HTTP provider completed without text.', 360);

  return {
    agentId: context.task.agentId,
    taskId: context.task.id,
    summary:
      typeof parsed?.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : `${context.task.title}: ${context.agentCli?.label ?? 'HTTP provider'} returned ${outputSummary}`,
    findings: normalizeStringArray(parsed?.findings, [
      outputSummary,
      `Provider route: ${context.agentCli?.providerId ?? 'unknown'}`
    ]),
    recommendations: normalizeStringArray(parsed?.recommendations, [
      'Review model output before accepting any generated patch.',
      'Keep important findings in shared memory for later agents.'
    ]),
    proposedFiles,
    confidence: normalizeConfidence(parsed?.confidence)
  };
}

function createConfigurationErrorResult(
  context: GomiAgentRunContext,
  message: string
): GomiAgentResult {
  return {
    agentId: context.task.agentId,
    taskId: context.task.id,
    summary: `${context.task.title}: ${message}`,
    findings: [
      message,
      'HTTP provider execution was not completed.',
      'No code changes were applied.'
    ],
    recommendations: [
      'Configure provider endpoint, model, and API key environment variables before enabling execution.',
      'Use Demo Runtime or a CLI route while provider secrets are not configured.',
      'Keep patch approval required for all generated changes.'
    ],
    proposedFiles: [],
    confidence: 0.26
  };
}

function parseProviderJson(text: string): Partial<GomiAgentResult> | undefined {
  const trimmed = text.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    const value = JSON.parse(trimmed) as unknown;

    if (value && typeof value === 'object') {
      return value as Partial<GomiAgentResult>;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return strings.length > 0 ? strings : fallback;
}

function normalizeProposedFiles(
  explicitFiles: unknown,
  output: string,
  workspaceFiles: string[]
): string[] {
  const explicit = normalizeStringArray(explicitFiles, []);
  const lowerWorkspace = new Map(workspaceFiles.map((file) => [file.toLowerCase(), file]));
  const fromExplicit = explicit
    .map((file) => lowerWorkspace.get(file.toLowerCase()) ?? file)
    .filter((file, index, files) => files.indexOf(file) === index)
    .slice(0, 8);

  if (fromExplicit.length > 0) {
    return fromExplicit;
  }

  const outputLower = output.toLowerCase();

  return workspaceFiles
    .filter((file) => outputLower.includes(file.toLowerCase()))
    .slice(0, 8);
}

function normalizeConfidence(value: unknown): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0.7;
  }

  return Math.min(1, Math.max(0, value));
}

function resolveRouteEndpoint(
  route: GomiHttpProviderRoute,
  env: Record<string, string | undefined>
): string {
  const endpoint = route.endpoint ?? (route.endpointEnv ? env[route.endpointEnv] : undefined);

  if (endpoint) {
    return endpoint;
  }

  return route.mode === 'ollama-chat' ? defaultOllamaEndpoint : defaultOpenAiEndpoint;
}

function resolveRouteModel(
  route: GomiHttpProviderRoute,
  env: Record<string, string | undefined>
): string {
  const model = route.model ?? (route.modelEnv ? env[route.modelEnv] : undefined);

  if (model) {
    return model;
  }

  return route.mode === 'ollama-chat' ? 'gomi-local-model' : 'gomi-cloud-model';
}

function readRuntimeEnv(): Record<string, string | undefined> {
  const runtime = globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return runtime.process?.env ?? {};
}

function shortenText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
