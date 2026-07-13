import type {
  GomiAgentResult,
  GomiFinalReport,
  GomiMemoryEntry,
  GomiTask,
  GomiWorkspaceSnapshot
} from '../common/gomiTypes';
import { summarizeGomiUsage } from '../common/gomiUsageEstimate';

export class GomiResultAggregator {
  createFinalReport(input: {
    request: string;
    workspace: GomiWorkspaceSnapshot;
    tasks: GomiTask[];
    results: GomiAgentResult[];
    memory: GomiMemoryEntry[];
  }): GomiFinalReport {
    const completedTasks = input.tasks.filter((task) => task.status === 'done').length;
    const proposedFiles = Array.from(
      new Set(input.results.flatMap((result) => result.proposedFiles))
    ).slice(0, 8);

    return {
      summary: `CEO Agent completed a ${input.results.length}-agent review for ${input.workspace.rootName}: ${input.request}`,
      usageEstimate: summarizeGomiUsage(input.results.map((result) => result.usageEstimate)),
      sections: [
        {
          title: 'Agent Findings',
          lines: input.results.map(
            (result) =>
              `${result.agentId}: ${result.summary} Confidence ${Math.round(result.confidence * 100)}%.`
          )
        },
        {
          title: 'Project Context',
          lines: [
            `${input.workspace.files.length} files were available to the runtime context.`,
            input.workspace.gitSummary,
            input.workspace.terminalSummary
          ]
        },
        {
          title: 'Review Gates',
          lines: [
            `${completedTasks}/${input.tasks.length} planned tasks completed before patch proposal.`,
            `${input.memory.length} memory entries captured for this session.`,
            'Patch application remains disabled until the user approves the diff.'
          ]
        },
        {
          title: 'Suggested Files',
          lines: proposedFiles.length > 0 ? proposedFiles : ['No focused files were proposed.']
        }
      ]
    };
  }
}
