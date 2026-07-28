import { describe, expect, it } from 'vitest';
import { validateAgentRoutes } from '../src/vs/workbench/contrib/gomi/common/agentRouteValidation';
import type { GomiAgentSeat } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';

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

describe('agent runtime dead-run prevention (bounty #4)', () => {
  it('blocks runs when seats are empty', () => {
    expect(validateAgentRoutes([]).valid).toBe(false);
  });

  it('blocks runs when CEO seat is missing provider', () => {
    const seats = [makeSeat({ agentId: 'ceo', providerId: '' as any, departmentId: undefined })];
    expect(validateAgentRoutes(seats).valid).toBe(false);
    expect(validateAgentRoutes(seats).errors.some(e => e.includes('ceo') || e.includes('provider'))).toBe(true);
  });

  it('allows runs when CEO seat is properly configured', () => {
    const seats = [
      makeSeat({ id: 'seat-ceo', agentId: 'ceo' as const, departmentId: undefined }),
      makeSeat({ id: 'seat-backend', agentId: 'backend' as const }),
    ];
    expect(validateAgentRoutes(seats).valid).toBe(true);
  });

  it('rejects runs when only sleeping agents exist (no active)', () => {
    const seats = [
      makeSeat({ id: 'seat-ceo', agentId: 'ceo', workMode: 'sleeping', departmentId: undefined }),
    ];
    const result = validateAgentRoutes(seats);
    expect(result.valid).toBe(false);
  });
});
