import { GOMI_AGENT_CLI_PROVIDERS } from '../common/gomiOfficeSettings';
import type { GomiAgentCliProvider, GomiAgentProviderTransport } from '../common/gomiTypes';
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

  constructor(options: WorkbenchGomiAgentProviderOptions = {}) {
    this.providerCatalog = options.providerCatalog ?? GOMI_AGENT_CLI_PROVIDERS;
    this.demoProvider = createDemoGomiAgentProvider();
    this.cliProvider = createNodeCliGomiAgentProvider({
      enabled: options.enableCliAgentExecution ?? false,
      providerCatalog: this.providerCatalog,
      fallbackProvider: this.demoProvider,
      commandRunner: options.cliAgentCommandRunner,
      timeoutMs: options.timeoutMs,
      cwd: options.cwd
    });
    this.httpProvider = createHttpGomiAgentProvider({
      enabled: options.enableHttpAgentExecution ?? false,
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
