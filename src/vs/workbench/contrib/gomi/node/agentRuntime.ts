import { BASE_GOMI_AGENTS } from '../common/gomiConstants';
import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  GOMI_AGENT_CLI_PROVIDERS,
  getProviderLabel,
  getSeatForAgent,
  isAgentAvailableForTask
} from '../common/gomiOfficeSettings';
import type {
  GomiAgentId,
  GomiAgentResult,
  GomiAgentStatus,
  GomiChatMessage,
  GomiMemoryBoardItem,
  GomiMemoryEntry,
  GomiOfficeSettings,
  GomiRuntimeEvent,
  GomiTask
} from '../common/gomiTypes';
import { createDemoGomiAgentProvider, type GomiAgentProvider } from './agentProvider';
import { evaluateAgentCommunication } from './communicationPolicy';
import {
  applyWorkspaceMemoryPolicy,
  createMemoryPrivacySummary
} from './memoryPrivacy';
import {
  createAgentResultMemoryEntry,
  createInMemoryGomiMemoryStore,
  createMemoryContent,
  type GomiMemoryItem,
  type GomiMemoryStore
} from './memoryStore';
import { GomiMessageBus } from './messageBus';
import { createPatchProposal } from './patchApplier';
import {
  DefaultGomiProjectContextIndexer,
  type GomiProjectContextIndexer
} from './projectContextIndexer';
import { GomiResultAggregator } from './resultAggregator';
import { GomiSharedProjectMemory } from './sharedProjectMemory';
import { GomiTaskPlanner } from './taskPlanner';
import {
  createInMemoryVectorMemoryStore,
  type GomiVectorMemoryStore
} from './vectorMemoryStore';
import {
  createDemoWorkspaceSnapshotReader,
  type GomiWorkspaceSnapshotReader
} from './workspaceReader';

export interface GomiRuntimeOptions {
  delayMs?: number;
  workspaceReader?: GomiWorkspaceSnapshotReader;
  agentProvider?: GomiAgentProvider;
  memoryStore?: GomiMemoryStore;
  vectorMemoryStore?: GomiVectorMemoryStore;
  projectContextIndexer?: GomiProjectContextIndexer;
  resultAggregator?: GomiResultAggregator;
  officeSettings?: GomiOfficeSettings;
}

export interface GomiRuntimeRunOptions {
  signal?: AbortSignal;
  stopReason?: string;
}

export class GomiAgentRuntime {
  private readonly planner = new GomiTaskPlanner();
  private readonly bus = new GomiMessageBus<GomiRuntimeEvent>();
  private readonly delayMs: number;
  private readonly workspaceReader: GomiWorkspaceSnapshotReader;
  private readonly agentProvider: GomiAgentProvider;
  private readonly memoryStore: GomiMemoryStore;
  private readonly vectorMemoryStore: GomiVectorMemoryStore;
  private readonly projectContextIndexer: GomiProjectContextIndexer;
  private readonly resultAggregator: GomiResultAggregator;
  private readonly officeSettings: GomiOfficeSettings;

  constructor(options: GomiRuntimeOptions = {}) {
    this.delayMs = options.delayMs ?? 280;
    this.workspaceReader = options.workspaceReader ?? createDemoWorkspaceSnapshotReader();
    this.agentProvider = options.agentProvider ?? createDemoGomiAgentProvider();
    this.memoryStore = options.memoryStore ?? createInMemoryGomiMemoryStore();
    this.vectorMemoryStore = options.vectorMemoryStore ?? createInMemoryVectorMemoryStore();
    this.projectContextIndexer = options.projectContextIndexer ?? new DefaultGomiProjectContextIndexer();
    this.resultAggregator = options.resultAggregator ?? new GomiResultAggregator();
    this.officeSettings = options.officeSettings ?? DEFAULT_GOMI_OFFICE_SETTINGS;
  }

  subscribe(type: GomiRuntimeEvent['type'], listener: (event: GomiRuntimeEvent) => void): () => void {
    return this.bus.subscribe(type, listener);
  }

  async *run(request: string, options: GomiRuntimeRunOptions = {}): AsyncGenerator<GomiRuntimeEvent> {
    const sessionId = `gomi-${Date.now()}`;
    const signal = options.signal;
    const stopReason = options.stopReason ?? 'Gomi Office session stopped by user.';

    if (yield* this.stopIfAborted(sessionId, signal, stopReason)) {
      return;
    }

    const rawWorkspace = await this.workspaceReader();

    if (yield* this.stopIfAborted(sessionId, signal, stopReason)) {
      return;
    }

    const memoryScope = {
      workspaceId: rawWorkspace.rootName
    };
    const sharedMemoryEnabled = this.officeSettings.memory.sharedMemoryEnabled;

    this.memoryStore.prune(memoryScope, this.officeSettings.memory);
    this.vectorMemoryStore.prune(memoryScope, this.officeSettings.memory);

    const memoryPolicyResult = applyWorkspaceMemoryPolicy(rawWorkspace, this.officeSettings.memory);
    const workspace = memoryPolicyResult.workspace;
    const plannedTasks = this.planner.createPlan(request, workspace);
    const tasks = plannedTasks.map((task) => this.applyOfficeAvailability(task));
    const agentResults: GomiAgentResult[] = [];
    const sharedProjectMemory = sharedMemoryEnabled
      ? new GomiSharedProjectMemory(
          this.memoryStore,
          memoryScope,
          this.vectorMemoryStore
        )
      : undefined;
    const indexResult = sharedMemoryEnabled && this.officeSettings.memory.indexWorkspaceContext
      ? await this.projectContextIndexer.indexWorkspace(workspace, memoryScope, {
          memoryStore: this.memoryStore,
          vectorMemoryStore: this.vectorMemoryStore
        })
      : {
          chunkCount: 0,
          indexedPaths: []
        };

    if (yield* this.stopIfAborted(sessionId, signal, stopReason)) {
      return;
    }

    const requestMemory = this.memoryStore.add({
      sessionId,
      kind: 'request',
      content: createMemoryContent('request', request)
    });
    const workspaceSessionMemory = this.memoryStore.add({
      sessionId,
      kind: 'workspace',
      content: createMemoryContent(
        'workspace',
        `${workspace.rootName}: indexed ${indexResult.chunkCount} context chunks from ${indexResult.indexedPaths.length} paths. ${workspace.files.slice(0, 12).join(', ')}`
      )
    });
    const memoryPrivacySessionMemory = this.memoryStore.add({
      sessionId,
      kind: 'workspace',
      content: createMemoryContent(
        'workspace',
        `Memory privacy guard: ${createMemoryPrivacySummary(memoryPolicyResult.audit)}`
      )
    });
    const workspaceMemoryItems = sharedProjectMemory
      ? await sharedProjectMemory.rememberWorkspace(workspace)
      : [];

    yield* this.emit({
      type: 'session_started',
      sessionId,
      request,
      workspace
    });
    yield* this.memoryUpdate(this.sessionMemoryToBoardItem(requestMemory, 'Project Request'));
    yield* this.memoryUpdate(this.sessionMemoryToBoardItem(workspaceSessionMemory, 'Workspace Context'));
    yield* this.memoryUpdate(this.sessionMemoryToBoardItem(memoryPrivacySessionMemory, 'Memory Privacy Guard'));
    for (const memoryItem of workspaceMemoryItems) {
      yield* this.memoryUpdate(this.projectMemoryToBoardItem(memoryItem, this.memoryTitleForKey(memoryItem.key)));
    }

    yield* this.say('user', 'User', request);
    yield* this.status('ceo', 'planning');
    yield* this.say(
      'ceo',
      'CEO Agent',
      `I am walking this context over to System Analyst. I read the workspace through ${getProviderLabel(this.getAgentProviderId('ceo'))} and need the plan split into concrete tasks.`,
      'system-analyst',
      this.agentName('system-analyst')
    );
    await this.wait(signal);

    if (yield* this.stopIfAborted(sessionId, signal, stopReason)) {
      return;
    }

    for (const task of tasks) {
      yield* this.emit({ type: 'task_update', task });
    }

    for (const task of tasks) {
      if (yield* this.stopIfAborted(sessionId, signal, stopReason)) {
        return;
      }

      if (!isAgentAvailableForTask(this.officeSettings, task.agentId)) {
        yield* this.status(task.agentId, 'sleeping');
        yield* this.say(
          'pet-gomi',
          'Pet Gomi',
          `${this.agentName(task.agentId)} is sleeping. CEO keeps the head seat and skips only this task.`
        );
        continue;
      }

      const sharedMemory = sharedProjectMemory
        ? await sharedProjectMemory.searchForTask(task, request)
        : [];
      yield* this.status(task.agentId, 'working', task.id);
      yield* this.updateTask(task, 'running', 42);
      const agentResult = await this.agentProvider.runAgentTask({
        sessionId,
        request,
        workspace,
        task,
        memory: this.memoryStore.recent(sessionId, 12),
        sharedMemory,
        agentCli: this.getAgentCli(task.agentId),
        executionPolicy: {
          ...this.officeSettings.execution,
          patchApprovalRequired: this.officeSettings.memory.requirePatchApproval
        },
        signal
      });

      if (yield* this.stopIfAborted(sessionId, signal, stopReason)) {
        return;
      }

      const communicationDecision = evaluateAgentCommunication(agentResult, {
        broadcastThreshold: this.officeSettings.memory.broadcastThreshold,
        recalledMemory: sharedMemory
      });
      agentResults.push(agentResult);
      const resultMemory = this.memoryStore.add(
        createAgentResultMemoryEntry({
          sessionId,
          agentId: agentResult.agentId,
          taskId: agentResult.taskId,
          summary: agentResult.summary
        })
      );
      const projectMemoryItem = sharedProjectMemory
        ? await sharedProjectMemory.rememberAgentResult(
            agentResult,
            communicationDecision.importance
          )
        : undefined;
      yield* this.emit({ type: 'agent_result', result: agentResult });
      yield* this.memoryUpdate(
        this.sessionMemoryToBoardItem(resultMemory, `${this.agentName(agentResult.agentId)} Result`, {
          shouldBroadcast: communicationDecision.shouldBroadcast
        })
      );
      if (projectMemoryItem) {
        yield* this.memoryUpdate(
          this.projectMemoryToBoardItem(projectMemoryItem, `${this.agentName(agentResult.agentId)} Memory`, {
            agentId: agentResult.agentId,
            taskId: agentResult.taskId,
            shouldBroadcast: communicationDecision.shouldBroadcast
          })
        );
      }
      if (communicationDecision.shouldBroadcast) {
        const recipientId = this.communicationRecipientFor(task.agentId, tasks);
        yield* this.say(
          task.agentId,
          this.agentName(task.agentId),
          this.agentQuestion(task, agentResult, communicationDecision.broadcastSummary, recipientId),
          recipientId,
          this.agentName(recipientId)
        );
      }
      await this.wait(signal);

      if (yield* this.stopIfAborted(sessionId, signal, stopReason)) {
        return;
      }

      yield* this.updateTask(task, 'running', 78);
      await this.wait(signal);

      if (yield* this.stopIfAborted(sessionId, signal, stopReason)) {
        return;
      }

      yield* this.updateTask(task, 'done', 100);
      yield* this.status(task.agentId, task.agentId === 'qa' ? 'reviewing' : 'done');
    }

    yield* this.status('ceo', 'working');
    yield* this.say('pet-gomi', 'Pet Gomi', 'Patch proposal is ready. Waiting for human approval before applying code changes.');
    await this.wait(signal);

    if (yield* this.stopIfAborted(sessionId, signal, stopReason)) {
      return;
    }

    const patch = createPatchProposal(request, tasks, agentResults);
    const report = this.resultAggregator.createFinalReport({
      request,
      workspace,
      tasks,
      results: agentResults,
      memory: this.memoryStore.list(sessionId)
    });

    const patchMemory = this.memoryStore.add({
      sessionId,
      kind: 'patch',
      content: createMemoryContent('patch', `${patch.filePath}: ${patch.summary}`)
    });
    const reportMemory = this.memoryStore.add({
      sessionId,
      kind: 'report',
      content: createMemoryContent('report', report.summary)
    });
    yield* this.memoryUpdate(this.sessionMemoryToBoardItem(patchMemory, 'Patch Proposal'));
    yield* this.memoryUpdate(this.sessionMemoryToBoardItem(reportMemory, 'Final Report'));

    yield* this.emit({ type: 'patch', patch });
    yield* this.emit({ type: 'report', report });
    yield* this.status('ceo', 'done');
    yield* this.emit({ type: 'session_completed', sessionId });
  }

  private async *emit(event: GomiRuntimeEvent): AsyncGenerator<GomiRuntimeEvent> {
    this.bus.publish(event);
    yield event;
  }

  private async *say(
    senderId: GomiChatMessage['senderId'],
    senderName: string,
    content: string,
    recipientId?: GomiChatMessage['recipientId'],
    recipientName?: string
  ): AsyncGenerator<GomiRuntimeEvent> {
    yield* this.emit({
      type: 'message',
      message: {
        id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        senderId,
        senderName,
        recipientId,
        recipientName,
        content,
        createdAt: new Date().toLocaleTimeString()
      }
    });
  }

  private async *status(
    agentId: GomiAgentId,
    status: GomiAgentStatus,
    currentTaskId?: string
  ): AsyncGenerator<GomiRuntimeEvent> {
    yield* this.emit({
      type: 'agent_status',
      agentId,
      status,
      currentTaskId
    });
  }

  private async *updateTask(
    task: GomiTask,
    status: GomiTask['status'],
    progress: number
  ): AsyncGenerator<GomiRuntimeEvent> {
    yield* this.emit({
      type: 'task_update',
      task: {
        ...task,
        status,
        progress
      }
    });
  }

  private async *memoryUpdate(item: GomiMemoryBoardItem): AsyncGenerator<GomiRuntimeEvent> {
    yield* this.emit({
      type: 'memory_update',
      item
    });
  }

  private async *stopIfAborted(
    sessionId: string,
    signal: AbortSignal | undefined,
    reason: string
  ): AsyncGenerator<GomiRuntimeEvent, boolean> {
    if (!signal?.aborted) {
      return false;
    }

    const stopReason = this.resolveStopReason(signal, reason);

    yield* this.say('system', 'Gomi System', stopReason);
    yield* this.emit({
      type: 'session_stopped',
      sessionId,
      reason: stopReason
    });
    yield* this.emit({ type: 'session_completed', sessionId });

    return true;
  }

  private resolveStopReason(signal: AbortSignal, fallbackReason: string): string {
    return typeof signal.reason === 'string' && signal.reason.trim().length > 0
      ? signal.reason
      : fallbackReason;
  }

  private sessionMemoryToBoardItem(
    entry: GomiMemoryEntry,
    title: string,
    options: Pick<GomiMemoryBoardItem, 'shouldBroadcast'> = {}
  ): GomiMemoryBoardItem {
    return {
      id: entry.id,
      key: entry.id,
      title,
      content: this.cleanMemoryContent(entry.content),
      source: 'session',
      kind: entry.kind,
      createdAt: entry.createdAt,
      agentId: entry.agentId,
      taskId: entry.taskId,
      ...options
    };
  }

  private projectMemoryToBoardItem(
    item: GomiMemoryItem,
    title: string,
    options: Pick<GomiMemoryBoardItem, 'agentId' | 'taskId' | 'shouldBroadcast'> = {}
  ): GomiMemoryBoardItem {
    return {
      id: item.key,
      key: item.key,
      title,
      content: item.value,
      source: 'project',
      kind: 'shared_project',
      createdAt: item.updatedAt ?? item.createdAt,
      importance: item.importance,
      ...options
    };
  }

  private memoryTitleForKey(key: string): string {
    if (key === 'workspace:files') {
      return 'Workspace Files';
    }

    if (key === 'workspace:git') {
      return 'Git Context';
    }

    return key;
  }

  private cleanMemoryContent(content: string): string {
    return content.replace(/^\[[^\]]+\]\s*/, '');
  }

  private agentName(agentId: GomiAgentId): string {
    return BASE_GOMI_AGENTS.find((agent) => agent.id === agentId)?.name ?? 'Gomi Agent';
  }

  private communicationRecipientFor(senderId: GomiAgentId, tasks: GomiTask[]): GomiAgentId {
    const plannedAgentIds = new Set(
      tasks
        .filter((task) => isAgentAvailableForTask(this.officeSettings, task.agentId))
        .map((task) => task.agentId)
    );
    const preferredRecipients: Record<GomiAgentId, GomiAgentId[]> = {
      ceo: ['system-analyst', 'qa'],
      'system-analyst': ['backend', 'database', 'designer', 'qa'],
      backend: ['database', 'qa', 'frontend'],
      frontend: ['designer', 'qa', 'backend'],
      designer: ['frontend', 'qa'],
      database: ['backend', 'qa'],
      qa: ['backend', 'frontend', 'devops'],
      devops: ['backend', 'qa']
    };

    return (
      preferredRecipients[senderId].find((agentId) => plannedAgentIds.has(agentId) && agentId !== senderId) ??
      'ceo'
    );
  }

  private applyOfficeAvailability(task: GomiTask): GomiTask {
    if (isAgentAvailableForTask(this.officeSettings, task.agentId)) {
      return task;
    }

    return {
      ...task,
      detail: `${task.detail} This department head is sleeping, so CEO will hold the seat and skip execution.`,
      status: 'blocked',
      progress: 0
    };
  }

  private getAgentProviderId(agentId: GomiAgentId) {
    return getSeatForAgent(this.officeSettings, agentId)?.providerId ?? 'demo-runtime';
  }

  private getAgentCli(agentId: GomiAgentId) {
    const providerId = this.getAgentProviderId(agentId);
    const provider = GOMI_AGENT_CLI_PROVIDERS.find((candidate) => candidate.id === providerId);

    return {
      providerId,
      label: provider?.label ?? providerId,
      command: provider?.command ?? providerId
    };
  }

  private agentQuestion(
    task: GomiTask,
    result: GomiAgentResult,
    broadcastSummary: string,
    recipientId: GomiAgentId
  ): string {
    const topic = broadcastSummary || result.findings[0] || task.detail;

    return `Can you verify this for ${task.title.toLowerCase()} before I continue? ${this.shortenForChat(topic)} (${this.agentName(recipientId)})`;
  }

  private shortenForChat(value: string): string {
    const normalizedValue = value.replace(/\s+/g, ' ').trim();

    if (normalizedValue.length <= 180) {
      return normalizedValue;
    }

    return `${normalizedValue.slice(0, 177)}...`;
  }

  private wait(signal?: AbortSignal): Promise<void> {
    if (this.delayMs <= 0 || signal?.aborted) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const done = () => {
        globalThis.clearTimeout(timeout);
        signal?.removeEventListener('abort', done);
        resolve();
      };
      const timeout = globalThis.setTimeout(done, this.delayMs);

      signal?.addEventListener('abort', done, { once: true });
    });
  }
}
