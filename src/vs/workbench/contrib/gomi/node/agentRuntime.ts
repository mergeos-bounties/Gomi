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
  GomiOfficeSettings,
  GomiRuntimeEvent,
  GomiTask
} from '../common/gomiTypes';
import { createDemoGomiAgentProvider, type GomiAgentProvider } from './agentProvider';
import { evaluateAgentCommunication } from './communicationPolicy';
import {
  createAgentResultMemoryEntry,
  createInMemoryGomiMemoryStore,
  createMemoryContent,
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

  async *run(request: string): AsyncGenerator<GomiRuntimeEvent> {
    const sessionId = `gomi-${Date.now()}`;
    const workspace = await this.workspaceReader();
    const plannedTasks = this.planner.createPlan(request, workspace);
    const tasks = plannedTasks.map((task) => this.applyOfficeAvailability(task));
    const agentResults: GomiAgentResult[] = [];
    const memoryScope = {
      workspaceId: workspace.rootName
    };
    const sharedProjectMemory = new GomiSharedProjectMemory(
      this.memoryStore,
      memoryScope,
      this.vectorMemoryStore
    );
    const indexResult = this.officeSettings.memory.indexWorkspaceContext
      ? await this.projectContextIndexer.indexWorkspace(workspace, memoryScope, {
          memoryStore: this.memoryStore,
          vectorMemoryStore: this.vectorMemoryStore
        })
      : {
          chunkCount: 0,
          indexedPaths: []
        };

    this.memoryStore.add({
      sessionId,
      kind: 'request',
      content: createMemoryContent('request', request)
    });
    this.memoryStore.add({
      sessionId,
      kind: 'workspace',
      content: createMemoryContent(
        'workspace',
        `${workspace.rootName}: indexed ${indexResult.chunkCount} context chunks from ${indexResult.indexedPaths.length} paths. ${workspace.files.slice(0, 12).join(', ')}`
      )
    });
    await sharedProjectMemory.rememberWorkspace(workspace);

    yield* this.emit({
      type: 'session_started',
      sessionId,
      request,
      workspace
    });

    yield* this.say('user', 'User', request);
    yield* this.status('ceo', 'planning');
    yield* this.say(
      'ceo',
      'CEO Agent',
      `I am reading the workspace through ${getProviderLabel(this.getAgentProviderId('ceo'))} and splitting this request into agent tasks.`
    );
    await this.wait();

    for (const task of tasks) {
      yield* this.emit({ type: 'task_update', task });
    }

    for (const task of tasks) {
      if (!isAgentAvailableForTask(this.officeSettings, task.agentId)) {
        yield* this.status(task.agentId, 'sleeping');
        yield* this.say(
          'pet-gomi',
          'Pet Gomi',
          `${this.agentName(task.agentId)} is sleeping. CEO keeps the head seat and skips only this task.`
        );
        continue;
      }

      const sharedMemory = await sharedProjectMemory.searchForTask(task, request);
      yield* this.status(task.agentId, 'working', task.id);
      yield* this.updateTask(task, 'running', 42);
      const agentResult = await this.agentProvider.runAgentTask({
        sessionId,
        request,
        workspace,
        task,
        memory: this.memoryStore.recent(sessionId, 12),
        sharedMemory,
        agentCli: this.getAgentCli(task.agentId)
      });
      const communicationDecision = evaluateAgentCommunication(agentResult);
      agentResults.push(agentResult);
      this.memoryStore.add(
        createAgentResultMemoryEntry({
          sessionId,
          agentId: agentResult.agentId,
          taskId: agentResult.taskId,
          summary: agentResult.summary
        })
      );
      await sharedProjectMemory.rememberAgentResult(agentResult, communicationDecision.importance);
      yield* this.emit({ type: 'agent_result', result: agentResult });
      if (communicationDecision.shouldBroadcast) {
        yield* this.say(
          task.agentId,
          this.agentName(task.agentId),
          this.agentMessage(task, agentResult, communicationDecision.broadcastSummary)
        );
      }
      await this.wait();
      yield* this.updateTask(task, 'running', 78);
      await this.wait();
      yield* this.updateTask(task, 'done', 100);
      yield* this.status(task.agentId, task.agentId === 'qa' ? 'reviewing' : 'done');
    }

    yield* this.status('ceo', 'working');
    yield* this.say('pet-gomi', 'Pet Gomi', 'Patch proposal is ready. Waiting for human approval before applying code changes.');
    await this.wait();

    const patch = createPatchProposal(request, tasks, agentResults);
    const report = this.resultAggregator.createFinalReport({
      request,
      workspace,
      tasks,
      results: agentResults,
      memory: this.memoryStore.list(sessionId)
    });

    this.memoryStore.add({
      sessionId,
      kind: 'patch',
      content: createMemoryContent('patch', `${patch.filePath}: ${patch.summary}`)
    });
    this.memoryStore.add({
      sessionId,
      kind: 'report',
      content: createMemoryContent('report', report.summary)
    });

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
    content: string
  ): AsyncGenerator<GomiRuntimeEvent> {
    yield* this.emit({
      type: 'message',
      message: {
        id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        senderId,
        senderName,
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

  private agentName(agentId: GomiAgentId): string {
    return BASE_GOMI_AGENTS.find((agent) => agent.id === agentId)?.name ?? 'Gomi Agent';
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

  private agentMessage(task: GomiTask, result: GomiAgentResult, broadcastSummary: string): string {
    return `${task.title}: ${broadcastSummary || result.findings[0] || task.detail}`;
  }

  private wait(): Promise<void> {
    return new Promise((resolve) => {
      globalThis.setTimeout(resolve, this.delayMs);
    });
  }
}
