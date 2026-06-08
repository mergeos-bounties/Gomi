import { BASE_GOMI_AGENTS } from '../common/gomiConstants';
import type { GomiAgent, GomiAgentStatus } from '../common/gomiTypes';

export function createInitialGomiAgentPanel(): GomiAgent[] {
  return BASE_GOMI_AGENTS.map((agent) => ({ ...agent }));
}

export function updateGomiAgentPanel(
  agents: GomiAgent[],
  agentId: GomiAgent['id'],
  status: GomiAgentStatus,
  currentTaskId?: string
): GomiAgent[] {
  return agents.map((agent) =>
    agent.id === agentId
      ? {
          ...agent,
          status,
          currentTaskId
        }
      : agent
  );
}
