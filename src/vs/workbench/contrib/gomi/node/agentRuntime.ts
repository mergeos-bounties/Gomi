import { BASE_GOMI_AGENTS } from '../common/gomiConstants';
import type {
  GomiAgentId,
  GomiAgentStatus,
  GomiChatMessage,
  GomiFinalReport,
  GomiRuntimeEvent,
  GomiTask
} from '../common/gomiTypes';
import { GomiMessageBus } from './messageBus';
import { createPatchProposal } from './patchApplier';
import { GomiTaskPlanner } from './taskPlanner';
import { createDemoWorkspaceSnapshot } from './workspaceReader';

interface GomiRuntimeOptions {
  delayMs?: number;
}

export class GomiAgentRuntime {
  private readonly planner = new GomiTaskPlanner();
  private readonly bus = new GomiMessageBus<GomiRuntimeEvent>();
  private readonly delayMs: number;

  constructor(options: GomiRuntimeOptions = {}) {
    this.delayMs = options.delayMs ?? 280;
  }

  subscribe(type: GomiRuntimeEvent['type'], listener: (event: GomiRuntimeEvent) => void): () => void {
    return this.bus.subscribe(type, listener);
  }

  async *run(request: string): AsyncGenerator<GomiRuntimeEvent> {
    const sessionId = `gomi-${Date.now()}`;
    const workspace = createDemoWorkspaceSnapshot();
    const tasks = this.planner.createPlan(request, workspace);

    yield* this.emit({
      type: 'session_started',
      sessionId,
      request,
      workspace
    });

    yield* this.say('user', 'User', request);
    yield* this.status('ceo', 'planning');
    yield* this.say('ceo', 'CEO Agent', 'I am reading the workspace and splitting this request into agent tasks.');
    await this.wait();

    for (const task of tasks) {
      yield* this.emit({ type: 'task_update', task });
    }

    for (const task of tasks) {
      yield* this.status(task.agentId, 'working', task.id);
      yield* this.updateTask(task, 'running', 42);
      yield* this.say(task.agentId, this.agentName(task.agentId), this.agentMessage(task));
      await this.wait();
      yield* this.updateTask(task, 'running', 78);
      await this.wait();
      yield* this.updateTask(task, 'done', 100);
      yield* this.status(task.agentId, task.agentId === 'qa' ? 'reviewing' : 'done');
    }

    yield* this.status('ceo', 'working');
    yield* this.say('pet-gomi', 'Pet Gomi', 'Patch proposal is ready. Waiting for human approval before applying code changes.');
    await this.wait();

    yield* this.emit({ type: 'patch', patch: createPatchProposal(request, tasks) });
    yield* this.emit({ type: 'report', report: this.createFinalReport(request, tasks) });
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

  private createFinalReport(request: string, tasks: GomiTask[]): GomiFinalReport {
    return {
      summary: `CEO Agent completed a ${tasks.length}-agent plan for: ${request}`,
      sections: [
        {
          title: 'Delivery',
          lines: [
            'Gomi Office panel is ready for workbench review.',
            'Agent runtime can stream task, message, patch, and report events.',
            'Patch proposal is generated but not applied without approval.'
          ]
        },
        {
          title: 'Next',
          lines: [
            'Wire this module into a full Code - OSS fork contribution registry.',
            'Replace mock planner output with OpenAI or local model provider.',
            'Persist memory and session history in workspace storage or SQLite.'
          ]
        }
      ]
    };
  }

  private agentName(agentId: GomiAgentId): string {
    return BASE_GOMI_AGENTS.find((agent) => agent.id === agentId)?.name ?? 'Gomi Agent';
  }

  private agentMessage(task: GomiTask): string {
    return `${task.title}: ${task.detail}`;
  }

  private wait(): Promise<void> {
    return new Promise((resolve) => {
      globalThis.setTimeout(resolve, this.delayMs);
    });
  }
}
