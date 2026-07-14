/**
 * Office settings: empty-state + block-dead-runs guard (issue #4).
 */

import type { GomiAgentSeat } from '../common/gomiTypes';

export interface AgentRouteValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that agent routes in office settings are properly configured.
 * Blocks runs when seats have invalid or dead configurations.
 */
export function validateAgentRoutes(seats: GomiAgentSeat[]): AgentRouteValidation {
  const errors: string[] = [];

  if (!seats || seats.length === 0) {
    errors.push('No agent seats configured. Add at least one agent in Office Settings to start a run.');
    return { valid: false, errors };
  }

  const activeSeats = seats.filter((s) => s.workMode !== 'fired');
  if (activeSeats.length === 0) {
    errors.push('All agents are fired. Hire or reactivate at least one agent to start a run.');
    return { valid: false, errors };
  }

  for (const seat of seats) {
    if (seat.workMode === 'fired') continue;
    if (!seat.providerId) {
      errors.push(`Agent "${seat.name}" (${seat.agentId}) has no provider configured.`);
    }
    if (seat.workMode === 'sleeping') {
      errors.push(`Agent "${seat.name}" is sleeping and will be skipped.`);
    }
  }

  const criticalErrors = errors.filter((e) => !e.includes('sleeping'));

  return {
    valid: criticalErrors.length === 0,
    errors,
  };
}

/**
 * Generate an empty-state message for the agent configuration view.
 */
export function getEmptyStateMessage(seats: GomiAgentSeat[]): string | null {
  if (!seats || seats.length === 0) {
    return 'No agents configured. Use Office Settings to add agents (CEO, Backend, Frontend, Designer, etc.) and assign providers.';
  }

  const activeSeats = seats.filter((s) => s.workMode !== 'fired');
  if (activeSeats.length === 0) {
    return 'All agents have been fired. Visit Office Settings to hire new agents.';
  }

  return null;
}
