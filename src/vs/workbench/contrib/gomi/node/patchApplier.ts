import type { GomiAgentResult, GomiPatchProposal, GomiTask } from '../common/gomiTypes';

export function createPatchProposal(
  request: string,
  tasks: GomiTask[],
  results: GomiAgentResult[] = []
): GomiPatchProposal {
  const taskLines = tasks.map((task) => `+- ${task.title} [${task.agentId}]`).join('\n');
  const proposedFiles = Array.from(new Set(results.flatMap((result) => result.proposedFiles)));

  return {
    id: `patch-${Date.now()}`,
    filePath: 'docs/gomi-agent-plan.md',
    targetFiles: ['docs/gomi-agent-plan.md', ...proposedFiles].slice(0, 6),
    summary: 'Create a planning artifact before applying generated code changes.',
    approvalStatus: 'pending',
    riskLevel: 'low',
    createdByAgentId: 'ceo',
    diff: [
      'diff --git a/docs/gomi-agent-plan.md b/docs/gomi-agent-plan.md',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/docs/gomi-agent-plan.md',
      '@@ -0,0 +1,8 @@',
      '+# Gomi Agent Plan',
      `+Request: ${request}`,
      '+',
      '+Tasks:',
      taskLines,
      '+',
      '+Patch application remains gated behind user approval.'
    ].join('\n')
  };
}
