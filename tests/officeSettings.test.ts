import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  assignSeatProvider,
  fireEmployee,
  getSeatForAgent,
  isAgentAvailableForTask,
  setMemoryBroadcastThreshold,
  setSeatWorkMode
} from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';

describe('Gomi office settings', () => {
  it('assigns CLI providers to CEO and department head seats', () => {
    const settings = assignSeatProvider(
      DEFAULT_GOMI_OFFICE_SETTINGS,
      'head-designer',
      'claude-code'
    );

    expect(getSeatForAgent(settings, 'designer')?.providerId).toBe('claude-code');
  });

  it('lets department heads sleep without removing their seat', () => {
    const settings = setSeatWorkMode(DEFAULT_GOMI_OFFICE_SETTINGS, 'head-backend', 'sleeping');

    expect(getSeatForAgent(settings, 'backend')?.workMode).toBe('sleeping');
    expect(isAgentAvailableForTask(settings, 'backend')).toBe(false);
  });

  it('fires employees while keeping CEO and heads protected', () => {
    const withFiredEmployee = fireEmployee(DEFAULT_GOMI_OFFICE_SETTINGS, 'employee-qa-01');
    const protectedCeo = fireEmployee(DEFAULT_GOMI_OFFICE_SETTINGS, 'seat-ceo');

    expect(withFiredEmployee.seats.find((seat) => seat.id === 'employee-qa-01')?.workMode).toBe(
      'fired'
    );
    expect(protectedCeo.seats.find((seat) => seat.id === 'seat-ceo')?.workMode).toBe('active');
  });

  it('updates and clamps the shared-memory broadcast threshold', () => {
    expect(setMemoryBroadcastThreshold(DEFAULT_GOMI_OFFICE_SETTINGS, 0.88).memory.broadcastThreshold).toBe(
      0.88
    );
    expect(setMemoryBroadcastThreshold(DEFAULT_GOMI_OFFICE_SETTINGS, 0.2).memory.broadcastThreshold).toBe(
      0.45
    );
    expect(setMemoryBroadcastThreshold(DEFAULT_GOMI_OFFICE_SETTINGS, 1.2).memory.broadcastThreshold).toBe(
      0.95
    );
  });
});
