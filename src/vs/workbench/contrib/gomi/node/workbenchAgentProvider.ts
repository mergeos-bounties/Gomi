import { GOMI_AGENT_CLI_PROVIDERS } from '../common/gomiOfficeSettings';
import type {
  GomiAgentCliProvider,
  GomiAgentProviderTransport,
  GomiAgentResult
} from '../common/gomiTypes';
import {
  createDemoGomiAgentProvider,
  type GomiAgentProvider,
  type GomiAgentRequest,
  type GomiAgentResponse,
  type GomiAgentRunContext
} from './agentProvider';
import {
  createNodeCliGomiAgentProvider,
  type GomiCliCommandRunner
} from './cliAgentProvider';
import {
  createHttpGomiAgentProvider,
  type GomiHttpFetch,
  type GomiHttpProviderRoute
} from './httpAgentProvider';

export interface WorkbenchGomiAgentProviderOptions {
  providerCatalog?: GomiAgentCliProvider[];
  enableCliAgentExecution?: boolean;
  enableHttpAgentExecution?: boolean;
  cliAgentCommandRunner?: GomiCliCommandRunner;
  httpFetch?: GomiHttpFetch;
  httpRoutes?: HttpRouteMap;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  cwd?: string;
}

export type HttpRouteMap = Partial<Record<GomiAgentCliProvider['id'], GomiHttpProviderRoute>>;

export class WorkbenchGomiAgentProvider implements GomiAgentProvider {
  readonly id = 'workbench-agent-router';
  readonly label = 'Gomi Workbench Agent Router';
  readonly kind = 'demo';
  readonly capabilities = {
    streaming: false,
    tools: true,
    maxContextTokens: 64000
  };

  private readonly providerCatalog: GomiAgentCliProvider[];
  private readonly demoProvider: GomiAgentProvider;
  private readonly cliProvider: GomiAgentProvider;
  private readonly httpProvider: GomiAgentProvider;
  private readonly cliExecutionEnabled: boolean;
  private readonly httpExecutionEnabled: boolean;

  constructor(options: WorkbenchGomiAgentProviderOptions = {}) {
    this.providerCatalog = options.providerCatalog ?? GOMI_AGENT_CLI_PROVIDERS;
    this.demoProvider = createDemoGomiAgentProvider();
    this.cliExecutionEnabled = options.enableCliAgentExecution ?? false;
    this.httpExecutionEnabled = options.enableHttpAgentExecution ?? false;
    this.cliProvider = createNodeCliGomiAgentProvider({
      enabled: this.cliExecutionEnabled,
      providerCatalog: this.providerCatalog,
      fallbackProvider: this.demoProvider,
      commandRunner: options.cliAgentCommandRunner,
      timeoutMs: options.timeoutMs,
      cwd: options.cwd
    });
    this.httpProvider = createHttpGomiAgentProvider({
      enabled: this.httpExecutionEnabled,
      providerCatalog: this.providerCatalog,
      fallbackProvider: this.demoProvider,
      fetchImpl: options.httpFetch,
      routes: options.httpRoutes,
      env: options.env,
      timeoutMs: options.timeoutMs
    });
  }

  complete(request: GomiAgentRequest, signal?: AbortSignal): Promise<GomiAgentResponse> {
    return this.demoProvider.complete(request, signal);
  }

  runAgentTask(context: GomiAgentRunContext) {
    const provider = this.providerCatalog.find((candidate) => candidate.id === context.agentCli?.providerId);
    const transport = resolveTransport(provider);
    const liveExecutionEnabled =
      (transport === 'cli' && this.cliExecutionEnabled) ||
      ((transport === 'openai-compatible' || transport === 'ollama-chat') && this.httpExecutionEnabled);
    const blockReason = liveExecutionEnabled
      ? getExecutionBlockReason(context, transport)
      : undefined;

    if (blockReason) {
      return Promise.resolve(createBlockedExecutionResult(context, blockReason));
    }

    if (transport === 'openai-compatible' || transport === 'ollama-chat') {
      return this.httpProvider.runAgentTask(context);
    }

    if (transport === 'cli') {
      return this.cliProvider.runAgentTask(context);
    }

    return this.demoProvider.runAgentTask(context);
  }
}

export function createWorkbenchGomiAgentProvider(
  options: WorkbenchGomiAgentProviderOptions = {}
): GomiAgentProvider {
  return new WorkbenchGomiAgentProvider(options);
}

function resolveTransport(provider: GomiAgentCliProvider | undefined): GomiAgentProviderTransport {
  if (!provider) {
    return 'demo';
  }

  return provider.transport ?? (provider.id === 'demo-runtime' ? 'demo' : 'cli');
}

function getExecutionBlockReason(
  context: GomiAgentRunContext,
  transport: GomiAgentProviderTransport
): string | undefined {
  if (transport === 'demo') {
    return undefined;
  }

  const policy = context.executionPolicy;

  if (!policy) {
    return 'Live provider execution requires an explicit Gomi execution policy.';
  }

  if (policy.liveProviderMode === 'demo-only') {
    return 'Live provider execution is disabled by the current Gomi execution policy.';
  }

  if (policy.liveProviderMode === 'trusted-workspaces' && policy.workspaceTrust !== 'trusted') {
    return 'Trust this workspace before running live CLI or HTTP agent providers.';
  }

  if (transport === 'cli' && !policy.allowCliProviders) {
    return 'CLI agent execution is disabled by the current Gomi execution policy.';
  }

  if ((transport === 'openai-compatible' || transport === 'ollama-chat') && !policy.allowHttpProviders) {
    return 'HTTP model provider execution is disabled by the current Gomi execution policy.';
  }

  if (policy.requirePatchApprovalForLiveProviders && !policy.patchApprovalRequired) {
    return 'Patch approval must stay enabled before live providers can run.';
  }

  return undefined;
}

function createBlockedExecutionResult(
  context: GomiAgentRunContext,
  reason: string
): GomiAgentResult {
  return {
    agentId: context.task.agentId,
    taskId: context.task.id,
    summary: `${context.task.title}: ${reason}`,
    findings: [
      reason,
      `Requested provider route: ${context.agentCli?.label ?? context.agentCli?.providerId ?? 'unknown'}`,
      'No live provider was executed and no code changes were applied.'
    ],
    recommendations: [
      'Use Demo Runtime while workspace trust or enterprise policy is not configured.',
      'Enable only the provider transports required for this workspace.',
      'Keep patch approval required for live provider output.'
    ],
    proposedFiles: [],
    confidence: 0.24
  };
}
