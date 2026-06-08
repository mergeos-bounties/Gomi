import type { GomiAgentResult, GomiTask, GomiWorkspaceSnapshot } from '../common/gomiTypes';
import type { GomiMemoryHit, GomiMemoryScope, GomiMemoryStore } from './memoryStore';
import {
  createInMemoryVectorMemoryStore,
  type GomiVectorMemoryStore
} from './vectorMemoryStore';

export class GomiSharedProjectMemory {
  constructor(
    private readonly memoryStore: GomiMemoryStore,
    private readonly scope: GomiMemoryScope,
    private readonly vectorMemoryStore: GomiVectorMemoryStore = createInMemoryVectorMemoryStore()
  ) {}

  async rememberWorkspace(workspace: GomiWorkspaceSnapshot): Promise<void> {
    await this.remember({
      key: 'workspace:files',
      value: workspace.files.slice(0, 80).join('\n'),
      tags: ['workspace', 'files', workspace.rootName],
      importance: 0.8,
      metadata: {
        rootName: workspace.rootName,
        fileCount: workspace.files.length
      }
    });

    await this.remember({
      key: 'workspace:git',
      value: workspace.gitSummary,
      tags: ['workspace', 'git'],
      importance: 0.65
    });
  }

  async rememberAgentResult(result: GomiAgentResult, importance: number): Promise<void> {
    await this.remember({
      key: `agent:${result.agentId}:${result.taskId}`,
      value: [
        result.summary,
        ...result.findings.map((finding) => `Finding: ${finding}`),
        ...result.recommendations.map((recommendation) => `Recommendation: ${recommendation}`)
      ].join('\n'),
      tags: ['agent-result', result.agentId, ...result.proposedFiles],
      importance,
      metadata: {
        agentId: result.agentId,
        taskId: result.taskId,
        proposedFiles: result.proposedFiles,
        confidence: result.confidence
      }
    });
  }

  async searchForTask(task: GomiTask, request: string, limit = 6): Promise<GomiMemoryHit[]> {
    const query = `${request} ${task.title} ${task.detail}`;
    const [vectorHits, lexicalHits] = await Promise.all([
      this.vectorMemoryStore.search(this.scope, query, limit),
      this.memoryStore.search(this.scope, query, limit)
    ]);

    return mergeMemoryHits(vectorHits, lexicalHits).slice(0, limit);
  }

  private async remember(item: Parameters<GomiMemoryStore['put']>[1]): Promise<void> {
    await Promise.all([
      this.memoryStore.put(this.scope, item),
      this.vectorMemoryStore.upsert(this.scope, item)
    ]);
  }
}

function mergeMemoryHits(vectorHits: GomiMemoryHit[], lexicalHits: GomiMemoryHit[]): GomiMemoryHit[] {
  const hitsByKey = new Map<string, GomiMemoryHit>();

  for (const hit of [...vectorHits, ...lexicalHits]) {
    const existingHit = hitsByKey.get(hit.key);

    if (!existingHit || hit.score > existingHit.score) {
      hitsByKey.set(hit.key, hit);
    }
  }

  return Array.from(hitsByKey.values()).sort((left, right) => right.score - left.score);
}
