import { spawn } from 'node:child_process';
import { BASE_GOMI_AGENTS } from '../common/gomiConstants';
import {
  GOMI_AGENT_CLI_PROVIDERS,
  getProviderLabel
} from '../common/gomiOfficeSettings';
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
  type GomiAgentRunContext
} from './agentProvider';

export interface GomiCliCommandInvocation {
  executable: string;
  args: string[];
  input: string;
  providerId: GomiAgentCliProviderId;
  providerLabel: string;
  agentId: GomiAgentId;
  taskId: string;
  cwd?: string;
  timeoutMs: number;
}

export interface GomiCliCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut?: boolean;
}

export type GomiCliCommandRunner = (
  invocation: GomiCliCommandInvocation,
  signal?: AbortSignal
) => Promise<GomiCliCommandResult>;

export interface NodeCliGomiAgentProviderOptions {
  enabled?: boolean;
  timeoutMs?: number;
  providerCatalog?: GomiAgentCliProvider[];
  fallbackProvider?: GomiAgentProvider;
  commandRunner?: GomiCliCommandRunner;
  cwd?: string;
}

export class NodeCliGomiAgentProvider implements GomiAgentProvider {
  readonly id = 'node-cli-router';
  readonly label = 'Node CLI Agent Router';
  readonly kind = 'cli';
  readonly capabilities = {
    streaming: false,
    tools: true,
    maxContextTokens: 64000
  };

  private readonly enabled: boolean;
  private readonly timeoutMs: number;
  private readonly providerCatalog: GomiAgentCliProvider[];
  private readonly fallbackProvider: GomiAgentProvider;
  private readonly commandRunner: GomiCliCommandRunner;
  private readonly cwd?: string;

  constructor(options: NodeCliGomiAgentProviderOptions = {}) {
    this.enabled = options.enabled ?? false;
    this.timeoutMs = options.timeoutMs ?? 120000;
    this.providerCatalog = options.providerCatalog ?? GOMI_AGENT_CLI_PROVIDERS;
    this.fallbackProvider = options.fallbackProvider ?? createDemoGomiAgentProvider();
    this.commandRunner = options.commandRunner ?? spawnGomiCliCommand;
    this.cwd = options.cwd;
  }

  complete(request: GomiAgentRequest, signal?: AbortSignal): Promise<GomiAgentResponse> {
    return this.fallbackProvider.complete(request, signal);
  }

  async runAgentTask(context: GomiAgentRunContext): Promise<GomiAgentResult> {
    const providerId = context.agentCli?.providerId ?? 'demo-runtime';

    if (!this.enabled || providerId === 'demo-runtime') {
      return this.fallbackProvider.runAgentTask(context);
    }

    const provider = this.providerCatalog.find((candidate) => candidate.id === providerId);
    const commandLine = context.agentCli?.command ?? provider?.command;

    if (!commandLine) {
      return this.createConfigurationErrorResult(
        context,
        `No command is configured for ${getProviderLabel(providerId)}.`
      );
    }

    const [executable, ...args] = splitCommandLine(commandLine);

    if (!executable) {
      return this.createConfigurationErrorResult(
        context,
        `Invalid command for ${getProviderLabel(providerId)}: ${commandLine}`
      );
    }

    const providerLabel = context.agentCli?.label ?? provider?.label ?? providerId;
    const result = await this.runCliCommand({
      executable,
      args,
      input: createCliPrompt(context),
      providerId,
      providerLabel,
      agentId: context.task.agentId,
      taskId: context.task.id,
      cwd: this.cwd,
      timeoutMs: this.timeoutMs
    }, context.signal);

    if (result.timedOut) {
      return this.createConfigurationErrorResult(
        context,
        `${providerLabel} timed out after ${this.timeoutMs}ms.`
      );
    }

    if (result.exitCode === null) {
      return this.createConfigurationErrorResult(
        context,
        `${providerLabel} stopped before returning an exit code.`
      );
    }

    if (result.exitCode !== 0) {
      return this.createConfigurationErrorResult(
        context,
        `${providerLabel} exited with code ${result.exitCode}: ${shortenText(result.stderr || result.stdout, 240)}`
      );
    }

    return createAgentResultFromCliOutput(context, result.stdout, result.stderr);
  }

  private async runCliCommand(
    invocation: GomiCliCommandInvocation,
    signal?: AbortSignal
  ): Promise<GomiCliCommandResult> {
    try {
      return await this.commandRunner(invocation, signal);
    } catch (error) {
      return {
        stdout: '',
        stderr: error instanceof Error ? error.message : 'Unknown CLI execution error.',
        exitCode: 1
      };
    }
  }

  private createConfigurationErrorResult(
    context: GomiAgentRunContext,
    message: string
  ): GomiAgentResult {
    return {
      agentId: context.task.agentId,
      taskId: context.task.id,
      summary: `${context.task.title}: ${message}`,
      findings: [
        message,
        `Requested CLI route: ${context.agentCli?.command ?? 'not configured'}`,
        'No code changes were applied.'
      ],
      recommendations: [
        'Install or configure the selected CLI agent before enabling execution.',
        'Switch this seat to Demo Runtime for offline planning.',
        'Keep patch approval required for every generated change.'
      ],
      proposedFiles: [],
      confidence: 0.28
    };
  }
}

export function createNodeCliGomiAgentProvider(
  options: NodeCliGomiAgentProviderOptions = {}
): GomiAgentProvider {
  return new NodeCliGomiAgentProvider(options);
}

export async function spawnGomiCliCommand(
  invocation: GomiCliCommandInvocation,
  signal?: AbortSignal
): Promise<GomiCliCommandResult> {
  return new Promise((resolve) => {
    const child = spawn(invocation.executable, invocation.args, {
      cwd: invocation.cwd,
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let finished = false;
    const timer = globalThis.setTimeout(() => {
      if (finished) {
        return;
      }

      child.kill();
      finished = true;
      resolve({
        stdout,
        stderr,
        exitCode: null,
        timedOut: true
      });
    }, invocation.timeoutMs);
    const abort = () => {
      if (finished) {
        return;
      }

      child.kill();
      finished = true;
      globalThis.clearTimeout(timer);
      resolve({
        stdout,
        stderr,
        exitCode: null
      });
    };

    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) {
      abort();
      return;
    }

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });
    child.on('error', (error) => {
      if (finished) {
        return;
      }

      finished = true;
      globalThis.clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      resolve({
        stdout,
        stderr: error.message,
        exitCode: 1
      });
    });
    child.on('close', (exitCode) => {
      if (finished) {
        return;
      }

      finished = true;
      globalThis.clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      resolve({
        stdout,
        stderr,
        exitCode
      });
    });

    child.stdin.write(invocation.input);
    child.stdin.end();
  });
}

export function splitCommandLine(commandLine: string): string[] {
  const parts: string[] = [];
  const pattern = /"([^"]*)"|'([^']*)'|[^\s]+/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(commandLine)) !== null) {
    parts.push(match[1] ?? match[2] ?? match[0]);
  }

  return parts;
}

function createCliPrompt(context: GomiAgentRunContext): string {
  const agentName = BASE_GOMI_AGENTS.find((agent) => agent.id === context.task.agentId)?.name ?? context.task.agentId;
  const memoryHits = context.sharedMemory
    .slice(0, 6)
    .map((hit) => `- ${hit.key}: ${hit.value}`)
    .join('\n');
  const snippets = context.workspace.contentSnippets
    ?.slice(0, 6)
    .map((snippet) => `--- ${snippet.filePath}\n${snippet.content}`)
    .join('\n') ?? '';

  return [
    `You are ${agentName} inside Gomi Office IDE.`,
    `Provider route: ${context.agentCli?.label ?? 'Unknown CLI'}.`,
    `Task: ${context.task.title}`,
    `Task detail: ${context.task.detail}`,
    `User request: ${context.request}`,
    `Workspace: ${context.workspace.rootName}`,
    `Files: ${context.workspace.files.slice(0, 80).join(', ') || 'No files indexed.'}`,
    `Open editors: ${context.workspace.openEditors.join(', ') || 'None'}`,
    `Git: ${context.workspace.gitSummary}`,
    `Terminal: ${context.workspace.terminalSummary}`,
    'Shared memory:',
    memoryHits || '- No relevant memory hits.',
    'Context snippets:',
    snippets || '- No snippets available.',
    'Return either plain English or JSON with: summary, findings[], recommendations[], proposedFiles[], confidence.'
  ].join('\n\n');
}

function createAgentResultFromCliOutput(
  context: GomiAgentRunContext,
  stdout: string,
  stderr: string
): GomiAgentResult {
  const parsed = parseCliJson(stdout);
  const proposedFiles = normalizeProposedFiles(
    parsed?.proposedFiles,
    stdout,
    context.workspace.files
  );
  const outputSummary = shortenText(stdout.trim() || stderr.trim() || 'CLI completed without output.', 360);

  return {
    agentId: context.task.agentId,
    taskId: context.task.id,
    summary:
      typeof parsed?.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : `${context.task.title}: ${context.agentCli?.label ?? 'CLI agent'} returned ${outputSummary}`,
    findings: normalizeStringArray(parsed?.findings, [
      outputSummary,
      `CLI route: ${context.agentCli?.command ?? 'unknown command'}`
    ]),
    recommendations: normalizeStringArray(parsed?.recommendations, [
      'Review the CLI output before applying any proposed patch.',
      'Store important project facts in shared memory for later agents.'
    ]),
    proposedFiles,
    confidence: normalizeConfidence(parsed?.confidence)
  };
}

function parseCliJson(stdout: string): Partial<GomiAgentResult> | undefined {
  const trimmed = stdout.trim();

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

function shortenText(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
