import { describe, expect, it } from 'vitest';
import type { GomiAgentSeat } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import {
  validateAgentRoutes,
  getEmptyStateMessage,
} from '../src/vs/workbench/contrib/gomi/common/agentRouteValidation';

function makeSeat(overrides: Partial<GomiAgentSeat> = {}): GomiAgentSeat {
  return {
    id: 'seat-test',
    agentId: 'backend' as const,
    name: 'Test Agent',
    role: 'Test role',
    seatKind: 'department-head' as const,
    providerId: 'codex-cli' as const,
    workMode: 'active' as const,
    canSleep: true,
    canFire: false,
    departmentId: 'backend' as const,
    ...overrides,
  };
}

describe('agentRouteValidation (bounty #4)', () => {
  describe('validateAgentRoutes', () => {
    it('rejects empty seats', () => {
      const result = validateAgentRoutes([]);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('rejects when all seats are fired', () => {
      const seats = [makeSeat({ workMode: 'fired' }), makeSeat({ workMode: 'fired', id: 'seat-2' })];
      const result = validateAgentRoutes(seats);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('fired');
    });

    it('accepts valid active seats', () => {
      const seats = [makeSeat(), makeSeat({ id: 'seat-2', agentId: 'frontend' })];
      const result = validateAgentRoutes(seats);
      expect(result.valid).toBe(true);
    });

    it('warns about missing provider', () => {
      const seats = [makeSeat({ providerId: '' as any })];
      const result = validateAgentRoutes(seats);
      expect(result.errors.some(e => e.includes('provider'))).toBe(true);
    });

    it('warns about sleeping agents', () => {
      const seats = [makeSeat({ workMode: 'sleeping' })];
      const result = validateAgentRoutes(seats);
      expect(result.errors.some(e => e.includes('sleeping'))).toBe(true);
    });
  });

  describe('getEmptyStateMessage', () => {
    it('returns message when seats empty', () => {
      const msg = getEmptyStateMessage([]);
      expect(msg).toContain('No agents');
    });

    it('returns message when all fired', () => {
      const msg = getEmptyStateMessage([makeSeat({ workMode: 'fired' })]);
      expect(msg).toContain('fired');
    });

    it('returns null when active seats exist', () => {
      const msg = getEmptyStateMessage([makeSeat()]);
      expect(msg).toBeNull();
    });
  });
});
