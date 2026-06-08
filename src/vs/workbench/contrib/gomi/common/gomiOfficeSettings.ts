import type {
  GomiAgentCliProvider,
  GomiAgentCliProviderId,
  GomiAgentId,
  GomiAgentSeat,
  GomiAgentWorkMode,
  GomiOfficeSettings
} from './gomiTypes';

export const GOMI_DEFAULT_MEMORY_BROADCAST_THRESHOLD = 0.74;

export const GOMI_AGENT_CLI_PROVIDERS: GomiAgentCliProvider[] = [
  {
    id: 'codex-cli',
    label: 'Codex CLI',
    command: 'codex',
    description: 'Terminal-first coding agent for planning, edits, tests, and patch review.'
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    command: 'claude',
    description: 'CLI coding agent option for long-form implementation and codebase reasoning.'
  },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    command: 'gemini',
    description: 'CLI model runner option for project analysis and implementation tasks.'
  },
  {
    id: 'aider-cli',
    label: 'Aider',
    command: 'aider',
    description: 'Git-aware pair programming CLI focused on file edits and diffs.'
  },
  {
    id: 'cursor-style-agent',
    label: 'Cursor-style Agent',
    command: 'cursor-agent',
    description: 'Placeholder adapter for editor-native agent routing with vector project memory.'
  },
  {
    id: 'local-llm',
    label: 'Local LLM',
    command: 'ollama run',
    description: 'Private local model route for sensitive workspaces.'
  },
  {
    id: 'demo-runtime',
    label: 'Demo Runtime',
    command: 'gomi-demo',
    description: 'Deterministic built-in provider used by the prototype and tests.'
  }
];

export const DEFAULT_GOMI_OFFICE_SETTINGS: GomiOfficeSettings = {
  seats: [
    {
      id: 'seat-ceo',
      agentId: 'ceo',
      name: 'CEO Agent',
      role: 'Executive coordinator',
      seatKind: 'executive',
      providerId: 'codex-cli',
      workMode: 'active',
      canSleep: false,
      canFire: false
    },
    createDepartmentHeadSeat('system-analyst', 'System Analyst Head', 'Requirements and architecture'),
    createDepartmentHeadSeat('backend', 'Backend Head', 'API and service delivery'),
    createDepartmentHeadSeat('frontend', 'Frontend Head', 'Workbench and webview experience'),
    createDepartmentHeadSeat('designer', 'Designer Head', 'UX, visual system, and character direction'),
    createDepartmentHeadSeat('database', 'Database Head', 'Schema and memory persistence'),
    createDepartmentHeadSeat('qa', 'QA Head', 'Quality gates and regression risk'),
    createDepartmentHeadSeat('devops', 'DevOps Head', 'Build, packaging, and deployment'),
    createEmployeeSeat('employee-backend-01', 'backend', 'Backend Developer', 'Implementation support'),
    createEmployeeSeat('employee-frontend-01', 'frontend', 'UI Developer', 'Interface implementation'),
    createEmployeeSeat('employee-designer-01', 'designer', 'Product Designer', 'Visual and interaction support'),
    createEmployeeSeat('employee-qa-01', 'qa', 'QA Engineer', 'Test execution support')
  ],
  memory: {
    retrievalMode: 'hybrid-vector',
    sharedMemoryEnabled: true,
    indexWorkspaceContext: true,
    broadcastThreshold: GOMI_DEFAULT_MEMORY_BROADCAST_THRESHOLD,
    requirePatchApproval: true
  }
};

export function assignSeatProvider(
  settings: GomiOfficeSettings,
  seatId: string,
  providerId: GomiAgentCliProviderId
): GomiOfficeSettings {
  return updateSeat(settings, seatId, (seat) => ({
    ...seat,
    providerId
  }));
}

export function setSeatWorkMode(
  settings: GomiOfficeSettings,
  seatId: string,
  workMode: GomiAgentWorkMode
): GomiOfficeSettings {
  return updateSeat(settings, seatId, (seat) => {
    if (workMode === 'sleeping' && !seat.canSleep) {
      return seat;
    }

    if (workMode === 'fired' && !seat.canFire) {
      return seat;
    }

    return {
      ...seat,
      workMode
    };
  });
}

export function fireEmployee(settings: GomiOfficeSettings, seatId: string): GomiOfficeSettings {
  return setSeatWorkMode(settings, seatId, 'fired');
}

export function setMemoryBroadcastThreshold(
  settings: GomiOfficeSettings,
  broadcastThreshold: number
): GomiOfficeSettings {
  return {
    ...settings,
    memory: {
      ...settings.memory,
      broadcastThreshold: clampBroadcastThreshold(broadcastThreshold)
    }
  };
}

export function getSeatForAgent(
  settings: GomiOfficeSettings,
  agentId: GomiAgentId
): GomiAgentSeat | undefined {
  return settings.seats.find(
    (seat) => seat.agentId === agentId && seat.seatKind !== 'employee'
  );
}

export function getProviderLabel(providerId: GomiAgentCliProviderId): string {
  return GOMI_AGENT_CLI_PROVIDERS.find((provider) => provider.id === providerId)?.label ?? providerId;
}

export function isAgentAvailableForTask(settings: GomiOfficeSettings, agentId: GomiAgentId): boolean {
  const seat = getSeatForAgent(settings, agentId);

  return !seat || seat.workMode === 'active';
}

function updateSeat(
  settings: GomiOfficeSettings,
  seatId: string,
  updater: (seat: GomiAgentSeat) => GomiAgentSeat
): GomiOfficeSettings {
  return {
    ...settings,
    seats: settings.seats.map((seat) => (seat.id === seatId ? updater(seat) : seat))
  };
}

function clampBroadcastThreshold(value: number): number {
  if (!Number.isFinite(value)) {
    return GOMI_DEFAULT_MEMORY_BROADCAST_THRESHOLD;
  }

  return Math.min(0.95, Math.max(0.45, value));
}

function createDepartmentHeadSeat(
  agentId: GomiAgentId,
  name: string,
  role: string
): GomiAgentSeat {
  return {
    id: `head-${agentId}`,
    agentId,
    name,
    role,
    seatKind: 'department-head',
    providerId: 'codex-cli',
    workMode: 'active',
    canSleep: true,
    canFire: false,
    departmentId: agentId
  };
}

function createEmployeeSeat(
  id: string,
  departmentId: GomiAgentId,
  name: string,
  role: string
): GomiAgentSeat {
  return {
    id,
    agentId: departmentId,
    name,
    role,
    seatKind: 'employee',
    providerId: 'demo-runtime',
    workMode: 'active',
    canSleep: false,
    canFire: true,
    departmentId
  };
}
