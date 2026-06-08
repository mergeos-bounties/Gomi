import { GOMI_DEFAULT_MEMORY_BROADCAST_THRESHOLD } from '../common/gomiOfficeSettings';
import type { GomiAgentResult } from '../common/gomiTypes';

export interface GomiCommunicationDecision {
  shouldBroadcast: boolean;
  importance: number;
  threshold: number;
  reason: string;
  broadcastSummary: string;
}

export interface GomiCommunicationPolicyOptions {
  broadcastThreshold?: number;
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
  const riskScore = containsRiskSignal(result) ? 0.12 : 0;
  const threshold = normalizeBroadcastThreshold(options.broadcastThreshold);
  const importance = Math.min(
    1,
    roleImportance[result.agentId] + proposedFileScore + lowConfidenceScore + riskScore
  );
  const shouldBroadcast = importance >= threshold;

  return {
    shouldBroadcast,
    importance,
    threshold,
    reason: shouldBroadcast
      ? 'Important enough to share with the office.'
      : 'Stored in shared project memory without interrupting other agents.',
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
