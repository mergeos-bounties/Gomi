import { GOMI_DEFAULT_MEMORY_BROADCAST_THRESHOLD } from '../common/gomiOfficeSettings';
import type { GomiAgentResult } from '../common/gomiTypes';
import type { GomiMemoryHit } from './memoryStore';

export interface GomiCommunicationDecision {
  shouldBroadcast: boolean;
  importance: number;
  threshold: number;
  reason: string;
  broadcastSummary: string;
}

export interface GomiCommunicationPolicyOptions {
  broadcastThreshold?: number;
  recalledMemory?: GomiMemoryHit[];
}

const roleImportance: Record<GomiAgentResult['agentId'], number> = {
  ceo: 0.9,
  'system-analyst': 0.84,
  backend: 0.62,
  frontend: 0.62,
  designer: 0.68,
  database: 0.54,
  qa: 0.82,
  devops: 0.55
};

export function evaluateAgentCommunication(
  result: GomiAgentResult,
  options: GomiCommunicationPolicyOptions = {}
): GomiCommunicationDecision {
  const proposedFileScore = Math.min(result.proposedFiles.length, 4) * 0.03;
  const lowConfidenceScore = result.confidence < 0.65 ? 0.18 : 0;
  const hasRiskSignal = containsRiskSignal(result);
  const riskScore = hasRiskSignal ? 0.12 : 0;
  const threshold = normalizeBroadcastThreshold(options.broadcastThreshold);
  const memoryCoverage = calculateRecalledMemoryCoverage(result, options.recalledMemory ?? []);
  const importance = Math.min(
    1,
    roleImportance[result.agentId] + proposedFileScore + lowConfidenceScore + riskScore
  );
  const isDuplicateRoutineFinding =
    memoryCoverage >= 0.68 && !hasRiskSignal && result.confidence >= 0.65;
  const isNewRiskFinding = hasRiskSignal && memoryCoverage < 0.62;
  const shouldBroadcast =
    !isDuplicateRoutineFinding && (importance >= threshold || isNewRiskFinding);

  return {
    shouldBroadcast,
    importance,
    threshold,
    reason: decisionReason(shouldBroadcast, isDuplicateRoutineFinding, memoryCoverage),
    broadcastSummary: shouldBroadcast
      ? `${result.summary} ${result.recommendations[0] ?? ''}`.trim()
      : `${result.agentId} updated project memory.`
  };
}

function normalizeBroadcastThreshold(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) {
    return GOMI_DEFAULT_MEMORY_BROADCAST_THRESHOLD;
  }

  return Math.min(0.95, Math.max(0.45, value));
}

function containsRiskSignal(result: GomiAgentResult): boolean {
  return [...result.findings, ...result.recommendations]
    .join(' ')
    .toLowerCase()
    .split(/\W+/)
    .some((word) => ['risk', 'regression', 'blocked', 'blocker', 'error', 'failure'].includes(word));
}

function calculateRecalledMemoryCoverage(
  result: GomiAgentResult,
  recalledMemory: GomiMemoryHit[]
): number {
  if (recalledMemory.length === 0) {
    return 0;
  }

  const resultTokens = new Set(tokenizeMemoryText(resultText(result)));

  if (resultTokens.size === 0) {
    return 0;
  }

  return recalledMemory.reduce((bestScore, memory) => {
    const memoryTokens = new Set(tokenizeMemoryText([memory.key, memory.value, ...(memory.tags ?? [])].join(' ')));
    let overlapCount = 0;

    for (const token of resultTokens) {
      if (memoryTokens.has(token)) {
        overlapCount += 1;
      }
    }

    const score = overlapCount / resultTokens.size;
    return Math.max(bestScore, score);
  }, 0);
}

function resultText(result: GomiAgentResult): string {
  return [
    result.summary,
    ...result.findings,
    ...result.recommendations,
    ...result.proposedFiles
  ].join(' ');
}

function tokenizeMemoryText(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_.-]+/)
    .filter((token) => token.length > 3 && !memoryStopWords.has(token));
}

function decisionReason(
  shouldBroadcast: boolean,
  isDuplicateRoutineFinding: boolean,
  memoryCoverage: number
): string {
  if (isDuplicateRoutineFinding) {
    return `Already covered by shared memory (${Math.round(memoryCoverage * 100)}% overlap), stored quietly.`;
  }

  return shouldBroadcast
    ? 'Important or novel enough to share with the office.'
    : 'Stored in shared project memory without interrupting other agents.';
}

const memoryStopWords = new Set([
  'agent',
  'gomi',
  'project',
  'task',
  'with',
  'from',
  'that',
  'this',
  'into',
  'should',
  'needs',
  'need',
  'file',
  'files',
  'code'
]);
