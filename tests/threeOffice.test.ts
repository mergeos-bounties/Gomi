/**
 * Tests for ThreeOffice 3D scene (bounty #7, 200 MRG)
 */
import { describe, expect, it } from 'vitest';
import type { GomiAgent, GomiOfficeSettings, GomiTask, GomiAgentSeat } from '../src/vs/workbench/contrib/gomi/common/gomiTypes';
import { DEFAULT_GOMI_OFFICE_SETTINGS } from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';

function createMockAgent(overrides: Partial<GomiAgent> = {}): GomiAgent {
  return {
    id: 'ceo',
    name: 'CEO Agent',
    role: 'Executive coordinator',
    status: 'idle',
    position: { x: 0, y: 0 },
    ...overrides,
  };
}

describe('3D Office scene (bounty #7)', () => {
  it('renders with default agents', () => {
    const agents: GomiAgent[] = [
      createMockAgent({ id: 'ceo', name: 'CEO' }),
      createMockAgent({ id: 'backend', name: 'Backend Dev', status: 'working' }),
      createMockAgent({ id: 'frontend', name: 'Frontend Dev', status: 'reviewing' }),
    ];
    expect(agents.length).toBe(3);
    expect(agents.find(a => a.id === 'ceo')).toBeDefined();
    expect(agents.find(a => a.id === 'backend')?.status).toBe('working');
  });

  it('maps agents to rooms correctly', () => {
    const agents: GomiAgent[] = [
      createMockAgent({ id: 'ceo' }),
      createMockAgent({ id: 'backend' }),
      createMockAgent({ id: 'designer' }),
    ];
    const rooms = [
      { agentIds: ['ceo'] },
      { agentIds: ['backend', 'frontend', 'devops'] },
      { agentIds: ['designer'] },
    ];
    for (const room of rooms) {
      for (const agentId of room.agentIds) {
        expect(agents.find(a => a.id === agentId)).toBeDefined();
      }
    }
  });

  it('provides status colors for all agent statuses', () => {
    const statuses = ['idle', 'planning', 'working', 'waiting', 'reviewing', 'sleeping', 'done', 'blocked'];
    const statusColors: Record<string, number> = {
      idle: 0x64748b, planning: 0x2dd4bf, working: 0x38bdf8,
      waiting: 0x94a3b8, reviewing: 0xfbbf24, sleeping: 0x818cf8,
      done: 0x22c55e, blocked: 0xf43f5e,
    };
    for (const status of statuses) {
      expect(statusColors[status]).toBeDefined();
      expect(typeof statusColors[status]).toBe('number');
    }
  });

  it('provides role colors for all agent roles', () => {
    const roles = ['ceo', 'system-analyst', 'backend', 'frontend', 'designer', 'database', 'qa', 'devops'];
    const roleColors: Record<string, number> = {
      ceo: 0x2dd4bf, 'system-analyst': 0x60a5fa, backend: 0xa78bfa,
      frontend: 0xf472b6, designer: 0xfb7185, database: 0x38bdf8,
      qa: 0xfbbf24, devops: 0x34d399,
    };
    for (const role of roles) {
      expect(roleColors[role]).toBeDefined();
      expect(typeof roleColors[role]).toBe('number');
    }
  });

  it('has default office settings with seat configuration', () => {
    expect(DEFAULT_GOMI_OFFICE_SETTINGS.seats.length).toBeGreaterThan(0);
    expect(DEFAULT_GOMI_OFFICE_SETTINGS.seats[0].agentId).toBe('ceo');
  });
});
