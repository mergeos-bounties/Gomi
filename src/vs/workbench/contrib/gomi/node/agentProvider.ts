import type {
  GomiAgentId,
  GomiAgentCliProviderId,
  GomiAgentResult,
  GomiOfficeExecutionSettings,
  GomiMemoryEntry,
  GomiTask,
  GomiWorkspaceSnapshot
} from '../common/gomiTypes';
import type { GomiMemoryHit } from './memoryStore';

export type GomiAgentProviderKind = 'cloud' | 'local' | 'cli' | 'demo';

export interface GomiAgentProviderCapabilities {
  streaming: boolean;
  tools: boolean;
  vision?: boolean;
  maxContextTokens?: number;
}

export interface GomiProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface GomiAgentRequest {
  messages: GomiProviderMessage[];
  system?: string;
  workspaceContext?: string[];
  memory?: GomiMemoryEntry[];
  model?: string;
  temperature?: number;
  metadata?: Record<string, unknown>;
}

export interface GomiAgentResponse {
  text: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  finishReason?: 'stop' | 'tool' | 'length' | 'error';
  raw?: unknown;
}

export interface GomiAgentProgressUpdate {
  progress?: number;
  statusDetail?: string;
}

export interface GomiAgentRunContext {
  sessionId: string;
  request: string;
  workspace: GomiWorkspaceSnapshot;
  task: GomiTask;
  memory: GomiMemoryEntry[];
  sharedMemory: GomiMemoryHit[];
  agentCli?: {
    providerId: GomiAgentCliProviderId;
    label: string;
    command: string;
  };
  executionPolicy?: GomiOfficeExecutionSettings & {
    patchApprovalRequired: boolean;
  };
  signal?: AbortSignal;
  reportProgress?: (update: GomiAgentProgressUpdate) => void;
}

export interface GomiAgentProvider {
  readonly id: string;
  readonly label: string;
  readonly kind: GomiAgentProviderKind;
  readonly capabilities: GomiAgentProviderCapabilities;
  complete(request: GomiAgentRequest, signal?: AbortSignal): Promise<GomiAgentResponse>;
  runAgentTask(context: GomiAgentRunContext): Promise<GomiAgentResult>;
}

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

export class DemoGomiAgentProvider implements GomiAgentProvider {
  readonly id = 'demo-provider';
  readonly label = 'Demo Provider';
  readonly kind = 'demo';
  readonly capabilities = {
    streaming: false,
    tools: false,
    maxContextTokens: 12000
  };

  async complete(request: GomiAgentRequest, signal?: AbortSignal): Promise<GomiAgentResponse> {
    if (signal?.aborted) {
      return {
        text: 'Request cancelled before the demo provider responded.',
        finishReason: 'error'
      };
    }

    const lastUserMessage = [...request.messages].reverse().find((message) => message.role === 'user');
    const memoryCount = request.memory?.length ?? 0;
    const contextCount = request.workspaceContext?.length ?? 0;
    const text = `Demo provider response for: ${lastUserMessage?.content ?? 'no user message'}. Context files: ${contextCount}. Memory hits: ${memoryCount}.`;

    return {
      text,
      finishReason: 'stop',
      usage: {
        inputTokens: text.length,
        outputTokens: Math.ceil(text.length / 4),
        totalTokens: text.length + Math.ceil(text.length / 4)
      }
    };
  }

  async runAgentTask(context: GomiAgentRunContext): Promise<GomiAgentResult> {
    const role = roleFocus[context.task.agentId];
    const proposedFiles = this.pickProposedFiles(context);
    const response = await this.complete(
      {
        system: `You are ${context.task.agentId} in the Gomi Multi-Agent Office.`,
        messages: [
          {
            role: 'user',
            content: context.request
          }
        ],
        workspaceContext: context.workspace.files,
        memory: context.memory,
        metadata: {
          taskId: context.task.id,
          agentId: context.task.agentId
        }
      },
      context.signal
    );

    return {
      agentId: context.task.agentId,
      taskId: context.task.id,
      summary: `${context.task.title}: reviewed ${role} through ${context.agentCli?.label ?? this.label} using ${context.workspace.files.length} workspace files. ${response.text}`,
      findings: [
        `Request focus: ${this.shorten(context.request, 96)}`,
        `Workspace root: ${context.workspace.rootName}`,
        `CLI route: ${context.agentCli?.command ?? this.id}`,
        `Context includes: ${proposedFiles.slice(0, 3).join(', ') || 'no focused files'}`,
        `Shared memory hits: ${context.sharedMemory.map((hit) => hit.key).slice(0, 3).join(', ') || 'none'}`
      ],
      recommendations: [
        'Keep generated changes behind patch approval.',
        'Use workspace context and memory before editing files.',
        `Route follow-up work to ${context.task.agentId} when this area changes.`
      ],
      proposedFiles,
      confidence: context.workspace.files.length > 0 ? 0.78 : 0.52
    };
  }

  private pickProposedFiles(context: GomiAgentRunContext): string[] {
    const fileHints: Record<GomiAgentId, string[]> = {
      ceo: ['README', 'product', 'package'],
      'system-analyst': ['README', 'gomiTypes', 'taskPlanner'],
      backend: ['agentRuntime', 'agentProvider', 'messageBus', 'patchApplier'],
      frontend: ['GomiOfficeApp', 'PhaserOffice', 'styles'],
      designer: ['GomiOfficeApp', 'PhaserOffice', 'styles', 'README', 'images'],
      database: ['memory', 'workspaceReader', 'schema', 'migration'],
      qa: ['test', 'spec', 'vitest'],
      devops: ['package', 'vite', 'tsconfig', 'product']
    };
    const hints = fileHints[context.task.agentId].map((hint) => hint.toLowerCase());
    const matchedFiles = context.workspace.files.filter((file) =>
      hints.some((hint) => file.toLowerCase().includes(hint))
    );

    return matchedFiles.slice(0, 5);
  }

  private shorten(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }

    return `${value.slice(0, maxLength - 3)}...`;
  }
}

export function createDemoGomiAgentProvider(): GomiAgentProvider {
  return new DemoGomiAgentProvider();
}
