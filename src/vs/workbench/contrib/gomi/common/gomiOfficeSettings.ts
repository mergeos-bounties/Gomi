import type {
  GomiAgentCliProvider,
  GomiAgentCliProviderId,
  GomiAgentId,
  GomiAgentSeat,
  GomiAgentWorkMode,
  GomiAvatarStyle,
  GomiLiveProviderMode,
  GomiMemoryEmbeddingProviderId,
  GomiMemoryPrivacyMode,
  GomiOfficeSettings,
  GomiPromptTemplate,
  GomiRecentProject,
  GomiWorkspaceTrustState
} from './gomiTypes';

export const GOMI_DEFAULT_MEMORY_BROADCAST_THRESHOLD = 0.74;
export const GOMI_DEFAULT_MEMORY_RETENTION_DAYS = 30;
export const GOMI_DEFAULT_MAX_PROJECT_MEMORY_ITEMS = 420;
export const GOMI_DEFAULT_MAX_CONCURRENT_AGENT_RUNS = 2;
export const GOMI_DEFAULT_HTTP_MAX_RETRIES = 2;
export const GOMI_MAX_RECENT_PROJECTS = 8;
export const GOMI_MAX_PROMPT_TEMPLATES = 24;

export const GOMI_AVATAR_STYLE_OPTIONS: Array<{
  id: GomiAvatarStyle;
  label: string;
}> = [
  { id: 'emoji', label: 'Emoji' },
  { id: 'geometric', label: 'Geometric' },
  { id: 'initials', label: 'Initials' }
];

export const GOMI_HIRABLE_DEPARTMENT_IDS: GomiAgentId[] = [
  'system-analyst',
  'backend',
  'frontend',
  'designer',
  'database',
  'qa',
  'devops'
];

const GOMI_EMPLOYEE_PROFILES: Record<Exclude<GomiAgentId, 'ceo'>, {
  baseName: string;
  role: string;
}> = {
  'system-analyst': {
    baseName: 'System Analyst',
    role: 'Requirement and module analysis'
  },
  backend: {
    baseName: 'Backend Developer',
    role: 'Implementation support'
  },
  frontend: {
    baseName: 'UI Developer',
    role: 'Interface implementation'
  },
  designer: {
    baseName: 'Product Designer',
    role: 'Visual and interaction support'
  },
  database: {
    baseName: 'Database Engineer',
    role: 'Schema and data support'
  },
  qa: {
    baseName: 'QA Engineer',
    role: 'Test execution support'
  },
  devops: {
    baseName: 'DevOps Engineer',
    role: 'Build and deployment support'
  }
};

export const GOMI_MEMORY_EMBEDDING_PROVIDERS: Array<{
  id: GomiMemoryEmbeddingProviderId;
  label: string;
  description: string;
  endpointEnv?: string;
  apiKeyEnv?: string;
  modelEnv?: string;
}> = [
  {
    id: 'local-hashing',
    label: 'Local Hashing',
    description: 'Offline deterministic vector fallback for private demos and tests.'
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI-Compatible Embeddings',
    description: 'Cloud or enterprise embedding endpoint compatible with OpenAI embeddings.',
    endpointEnv: 'GOMI_EMBEDDINGS_ENDPOINT',
    apiKeyEnv: 'GOMI_EMBEDDINGS_API_KEY',
    modelEnv: 'GOMI_EMBEDDINGS_MODEL'
  },
  {
    id: 'ollama-embeddings',
    label: 'Ollama /api/embeddings',
    description: 'Local Ollama embedding route using prompt-based /api/embeddings.',
    endpointEnv: 'GOMI_LOCAL_EMBEDDINGS_ENDPOINT',
    modelEnv: 'GOMI_LOCAL_EMBEDDINGS_MODEL'
  },
  {
    id: 'ollama-embed',
    label: 'Ollama /api/embed',
    description: 'Local Ollama embedding route using input-based /api/embed.',
    endpointEnv: 'GOMI_LOCAL_EMBEDDINGS_ENDPOINT',
    modelEnv: 'GOMI_LOCAL_EMBEDDINGS_MODEL'
  }
];

export const GOMI_AGENT_CLI_PROVIDERS: GomiAgentCliProvider[] = [
  {
    id: 'codex-cli',
    label: 'Codex CLI',
    command: 'codex',
    transport: 'cli',
    description: 'Terminal-first coding agent for planning, edits, tests, and patch review.'
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    command: 'claude',
    transport: 'cli',
    description: 'CLI coding agent option for long-form implementation and codebase reasoning.'
  },
  {
    id: 'gemini-cli',
    label: 'Gemini CLI',
    command: 'gemini',
    transport: 'cli',
    description: 'CLI model runner option for project analysis and implementation tasks.'
  },
  {
    id: 'aider-cli',
    label: 'Aider',
    command: 'aider',
    transport: 'cli',
    description: 'Git-aware pair programming CLI focused on file edits and diffs.'
  },
  {
    id: 'cursor-style-agent',
    label: 'Cursor-style Agent',
    command: 'cursor-agent',
    transport: 'cli',
    description: 'Placeholder adapter for editor-native agent routing with vector project memory.'
  },
  {
    id: 'openai-compatible-api',
    label: 'OpenAI-Compatible API',
    command: 'GOMI_CLOUD_LLM_ENDPOINT',
    transport: 'openai-compatible',
    endpointEnv: 'GOMI_CLOUD_LLM_ENDPOINT',
    apiKeyEnv: 'GOMI_CLOUD_LLM_API_KEY',
    modelEnv: 'GOMI_CLOUD_LLM_MODEL',
    description: 'Cloud LLM route for OpenAI-compatible chat completion APIs.'
  },
  {
    id: 'ollama-local-model',
    label: 'Ollama Local Model',
    command: 'GOMI_LOCAL_LLM_ENDPOINT',
    transport: 'ollama-chat',
    endpointEnv: 'GOMI_LOCAL_LLM_ENDPOINT',
    modelEnv: 'GOMI_LOCAL_LLM_MODEL',
    description: 'Local model route for private workspaces through an Ollama-compatible chat API.'
  },
  {
    id: 'local-llm',
    label: 'Local LLM',
    command: 'ollama run',
    transport: 'cli',
    description: 'Private local model route for sensitive workspaces.'
  },
  {
    id: 'demo-runtime',
    label: 'Demo Runtime',
    command: 'gomi-demo',
    transport: 'demo',
    description: 'Deterministic built-in provider used by the prototype and tests.'
  }
];

export const DEFAULT_GOMI_OFFICE_SETTINGS: GomiOfficeSettings = {
  avatarStyle: 'emoji',
  recentProjects: [],
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
  promptTemplates: [],
  memory: {
    retrievalMode: 'hybrid-vector',
    embeddingProvider: 'local-hashing',
    embeddingExecutionEnabled: false,
    sharedMemoryEnabled: true,
    indexWorkspaceContext: true,
    indexTerminalSnippets: false,
    privacyMode: 'standard',
    redactSecrets: true,
    retentionDays: GOMI_DEFAULT_MEMORY_RETENTION_DAYS,
    maxProjectMemoryItems: GOMI_DEFAULT_MAX_PROJECT_MEMORY_ITEMS,
    broadcastThreshold: GOMI_DEFAULT_MEMORY_BROADCAST_THRESHOLD,
    requirePatchApproval: true
  },
  execution: {
    workspaceTrust: 'untrusted',
    liveProviderMode: 'trusted-workspaces',
    allowCliProviders: false,
    allowHttpProviders: false,
    requirePatchApprovalForLiveProviders: true,
    maxConcurrentAgentRuns: GOMI_DEFAULT_MAX_CONCURRENT_AGENT_RUNS,
    httpMaxRetries: GOMI_DEFAULT_HTTP_MAX_RETRIES
  }
};

export interface GomiPromptTemplateDraft {
  id: string;
  title?: string;
  body: string;
  updatedAt?: string;
}

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

export function hireEmployee(settings: GomiOfficeSettings, departmentId: GomiAgentId): GomiOfficeSettings {
  if (!isHirableDepartmentId(departmentId)) {
    return settings;
  }

  const nextIndex = nextEmployeeIndex(settings, departmentId);
  const profile = GOMI_EMPLOYEE_PROFILES[departmentId];

  return {
    ...settings,
    seats: [
      ...settings.seats,
      createEmployeeSeat(
        `employee-${departmentId}-${String(nextIndex).padStart(2, '0')}`,
        departmentId,
        `${profile.baseName} ${nextIndex}`,
        profile.role
      )
    ]
  };
}

export function simulateStaffingScenario(settings: GomiOfficeSettings): GomiOfficeSettings {
  const offboardingCandidate = settings.seats.find(
    (seat) =>
      seat.seatKind === 'employee' &&
      seat.workMode !== 'fired' &&
      ['qa', 'frontend', 'backend', 'designer'].includes(seat.departmentId ?? '')
  );
  let nextSettings = hireEmployee(settings, 'backend');
  nextSettings = hireEmployee(nextSettings, 'designer');

  return offboardingCandidate ? fireEmployee(nextSettings, offboardingCandidate.id) : nextSettings;
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

export function setSharedMemoryEnabled(
  settings: GomiOfficeSettings,
  sharedMemoryEnabled: boolean
): GomiOfficeSettings {
  return updateMemorySettings(settings, {
    sharedMemoryEnabled
  });
}

export function setWorkspaceContextIndexing(
  settings: GomiOfficeSettings,
  indexWorkspaceContext: boolean
): GomiOfficeSettings {
  return updateMemorySettings(settings, {
    indexWorkspaceContext
  });
}

export function setTerminalSnippetIndexing(
  settings: GomiOfficeSettings,
  indexTerminalSnippets: boolean
): GomiOfficeSettings {
  return updateMemorySettings(settings, {
    indexTerminalSnippets
  });
}

export function setMemoryEmbeddingProvider(
  settings: GomiOfficeSettings,
  embeddingProvider: GomiMemoryEmbeddingProviderId
): GomiOfficeSettings {
  return updateMemorySettings(settings, {
    embeddingProvider,
    embeddingExecutionEnabled:
      embeddingProvider === 'local-hashing' ? false : settings.memory.embeddingExecutionEnabled
  });
}

export function setMemoryEmbeddingExecutionEnabled(
  settings: GomiOfficeSettings,
  embeddingExecutionEnabled: boolean
): GomiOfficeSettings {
  return updateMemorySettings(settings, {
    embeddingExecutionEnabled:
      settings.memory.embeddingProvider === 'local-hashing' ? false : embeddingExecutionEnabled
  });
}

export function setMemoryPrivacyMode(
  settings: GomiOfficeSettings,
  privacyMode: GomiMemoryPrivacyMode
): GomiOfficeSettings {
  return updateMemorySettings(settings, {
    privacyMode,
    redactSecrets: privacyMode === 'strict' ? true : settings.memory.redactSecrets
  });
}

export function setSecretRedactionEnabled(
  settings: GomiOfficeSettings,
  redactSecrets: boolean
): GomiOfficeSettings {
  return updateMemorySettings(settings, {
    redactSecrets: settings.memory.privacyMode === 'strict' ? true : redactSecrets
  });
}

export function setMemoryRetentionDays(
  settings: GomiOfficeSettings,
  retentionDays: number
): GomiOfficeSettings {
  return updateMemorySettings(settings, {
    retentionDays: clampInteger(retentionDays, 1, 365, GOMI_DEFAULT_MEMORY_RETENTION_DAYS)
  });
}

export function setMaxProjectMemoryItems(
  settings: GomiOfficeSettings,
  maxProjectMemoryItems: number
): GomiOfficeSettings {
  return updateMemorySettings(settings, {
    maxProjectMemoryItems: clampInteger(
      maxProjectMemoryItems,
      40,
      5000,
      GOMI_DEFAULT_MAX_PROJECT_MEMORY_ITEMS
    )
  });
}

export function setAvatarStyle(
  settings: GomiOfficeSettings,
  avatarStyle: GomiAvatarStyle
): GomiOfficeSettings {
  return {
    ...settings,
    avatarStyle
  };
}

export function rememberRecentProject(
  settings: GomiOfficeSettings,
  project: Pick<GomiRecentProject, 'name' | 'path'> & Partial<Pick<GomiRecentProject, 'lastOpenedAt'>>,
  lastOpenedAt = new Date().toISOString()
): GomiOfficeSettings {
  const recentProject = normalizeRecentProject({
    ...project,
    lastOpenedAt
  });

  if (!recentProject) {
    return settings;
  }

  return {
    ...settings,
    recentProjects: [
      recentProject,
      ...settings.recentProjects.filter((item) => item.path !== recentProject.path)
    ].slice(0, GOMI_MAX_RECENT_PROJECTS)
  };
}

export function removeRecentProject(settings: GomiOfficeSettings, projectId: string): GomiOfficeSettings {
  return {
    ...settings,
    recentProjects: settings.recentProjects.filter((project) => project.id !== projectId)
  };
}

export function setPatchApprovalRequired(
  settings: GomiOfficeSettings,
  requirePatchApproval: boolean
): GomiOfficeSettings {
  return updateMemorySettings(settings, {
    requirePatchApproval
  });
}

export function setWorkspaceTrustState(
  settings: GomiOfficeSettings,
  workspaceTrust: GomiWorkspaceTrustState
): GomiOfficeSettings {
  return updateExecutionSettings(settings, {
    workspaceTrust
  });
}

export function setLiveProviderMode(
  settings: GomiOfficeSettings,
  liveProviderMode: GomiLiveProviderMode
): GomiOfficeSettings {
  return updateExecutionSettings(settings, {
    liveProviderMode
  });
}

export function setCliProvidersEnabled(
  settings: GomiOfficeSettings,
  allowCliProviders: boolean
): GomiOfficeSettings {
  return updateExecutionSettings(settings, {
    allowCliProviders
  });
}

export function setHttpProvidersEnabled(
  settings: GomiOfficeSettings,
  allowHttpProviders: boolean
): GomiOfficeSettings {
  return updateExecutionSettings(settings, {
    allowHttpProviders
  });
}

export function setLiveProviderPatchApprovalRequired(
  settings: GomiOfficeSettings,
  requirePatchApprovalForLiveProviders: boolean
): GomiOfficeSettings {
  return updateExecutionSettings(settings, {
    requirePatchApprovalForLiveProviders
  });
}

export function setMaxConcurrentAgentRuns(
  settings: GomiOfficeSettings,
  maxConcurrentAgentRuns: number
): GomiOfficeSettings {
  return updateExecutionSettings(settings, {
    maxConcurrentAgentRuns: clampInteger(
      maxConcurrentAgentRuns,
      1,
      8,
      GOMI_DEFAULT_MAX_CONCURRENT_AGENT_RUNS
    )
  });
}

export function setHttpProviderMaxRetries(
  settings: GomiOfficeSettings,
  httpMaxRetries: number
): GomiOfficeSettings {
  return updateExecutionSettings(settings, {
    httpMaxRetries: clampInteger(httpMaxRetries, 0, 5, GOMI_DEFAULT_HTTP_MAX_RETRIES)
  });
}

export function savePromptTemplate(
  settings: GomiOfficeSettings,
  templateDraft: GomiPromptTemplateDraft
): GomiOfficeSettings {
  const template = normalizePromptTemplate(templateDraft);

  if (!template) {
    return settings;
  }

  return {
    ...settings,
    promptTemplates: [
      template,
      ...settings.promptTemplates.filter((currentTemplate) => currentTemplate.id !== template.id)
    ].slice(0, GOMI_MAX_PROMPT_TEMPLATES)
  };
}

export function deletePromptTemplate(
  settings: GomiOfficeSettings,
  templateId: string
): GomiOfficeSettings {
  return {
    ...settings,
    promptTemplates: settings.promptTemplates.filter((template) => template.id !== templateId)
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

export function getMemoryEmbeddingProviderLabel(providerId: GomiMemoryEmbeddingProviderId): string {
  return GOMI_MEMORY_EMBEDDING_PROVIDERS.find((provider) => provider.id === providerId)?.label ?? providerId;
}

export function isAgentAvailableForTask(settings: GomiOfficeSettings, agentId: GomiAgentId): boolean {
  const seat = getSeatForAgent(settings, agentId);

  return !seat || seat.workMode === 'active';
}

export function normalizeGomiOfficeSettings(value: unknown): GomiOfficeSettings {
  if (!isRecord(value)) {
    return DEFAULT_GOMI_OFFICE_SETTINGS;
  }

  const rawSettings = value as Partial<GomiOfficeSettings>;
  let normalizedSettings: GomiOfficeSettings = {
    ...DEFAULT_GOMI_OFFICE_SETTINGS,
    avatarStyle: avatarStyleSetting(rawSettings.avatarStyle),
    recentProjects: normalizeRecentProjects(rawSettings.recentProjects),
    seats: normalizeSeatSettings(rawSettings.seats),
    promptTemplates: normalizePromptTemplates(rawSettings.promptTemplates)
  };
  const rawMemory: Record<string, unknown> = isRecord(rawSettings.memory) ? rawSettings.memory : {};
  const rawExecution: Record<string, unknown> = isRecord(rawSettings.execution) ? rawSettings.execution : {};

  normalizedSettings = setSharedMemoryEnabled(
    normalizedSettings,
    booleanSetting(rawMemory.sharedMemoryEnabled, DEFAULT_GOMI_OFFICE_SETTINGS.memory.sharedMemoryEnabled)
  );
  normalizedSettings = setWorkspaceContextIndexing(
    normalizedSettings,
    booleanSetting(rawMemory.indexWorkspaceContext, DEFAULT_GOMI_OFFICE_SETTINGS.memory.indexWorkspaceContext)
  );
  normalizedSettings = setTerminalSnippetIndexing(
    normalizedSettings,
    booleanSetting(rawMemory.indexTerminalSnippets, DEFAULT_GOMI_OFFICE_SETTINGS.memory.indexTerminalSnippets)
  );
  normalizedSettings = setMemoryEmbeddingProvider(
    normalizedSettings,
    memoryEmbeddingProviderSetting(rawMemory.embeddingProvider)
  );
  normalizedSettings = setMemoryEmbeddingExecutionEnabled(
    normalizedSettings,
    booleanSetting(
      rawMemory.embeddingExecutionEnabled,
      DEFAULT_GOMI_OFFICE_SETTINGS.memory.embeddingExecutionEnabled
    )
  );
  normalizedSettings = setMemoryPrivacyMode(
    normalizedSettings,
    memoryPrivacyModeSetting(rawMemory.privacyMode)
  );
  normalizedSettings = setSecretRedactionEnabled(
    normalizedSettings,
    booleanSetting(rawMemory.redactSecrets, normalizedSettings.memory.redactSecrets)
  );
  normalizedSettings = setMemoryRetentionDays(
    normalizedSettings,
    numberSetting(rawMemory.retentionDays, DEFAULT_GOMI_OFFICE_SETTINGS.memory.retentionDays)
  );
  normalizedSettings = setMaxProjectMemoryItems(
    normalizedSettings,
    numberSetting(rawMemory.maxProjectMemoryItems, DEFAULT_GOMI_OFFICE_SETTINGS.memory.maxProjectMemoryItems)
  );
  normalizedSettings = setMemoryBroadcastThreshold(
    normalizedSettings,
    numberSetting(rawMemory.broadcastThreshold, DEFAULT_GOMI_OFFICE_SETTINGS.memory.broadcastThreshold)
  );
  normalizedSettings = setPatchApprovalRequired(
    normalizedSettings,
    booleanSetting(rawMemory.requirePatchApproval, DEFAULT_GOMI_OFFICE_SETTINGS.memory.requirePatchApproval)
  );
  normalizedSettings = setWorkspaceTrustState(
    normalizedSettings,
    workspaceTrustSetting(rawExecution.workspaceTrust)
  );
  normalizedSettings = setLiveProviderMode(
    normalizedSettings,
    liveProviderModeSetting(rawExecution.liveProviderMode)
  );
  normalizedSettings = setCliProvidersEnabled(
    normalizedSettings,
    booleanSetting(rawExecution.allowCliProviders, DEFAULT_GOMI_OFFICE_SETTINGS.execution.allowCliProviders)
  );
  normalizedSettings = setHttpProvidersEnabled(
    normalizedSettings,
    booleanSetting(rawExecution.allowHttpProviders, DEFAULT_GOMI_OFFICE_SETTINGS.execution.allowHttpProviders)
  );
  normalizedSettings = setLiveProviderPatchApprovalRequired(
    normalizedSettings,
    booleanSetting(
      rawExecution.requirePatchApprovalForLiveProviders,
      DEFAULT_GOMI_OFFICE_SETTINGS.execution.requirePatchApprovalForLiveProviders
    )
  );
  normalizedSettings = setMaxConcurrentAgentRuns(
    normalizedSettings,
    numberSetting(
      rawExecution.maxConcurrentAgentRuns,
      DEFAULT_GOMI_OFFICE_SETTINGS.execution.maxConcurrentAgentRuns
    )
  );
  normalizedSettings = setHttpProviderMaxRetries(
    normalizedSettings,
    numberSetting(
      rawExecution.httpMaxRetries,
      DEFAULT_GOMI_OFFICE_SETTINGS.execution.httpMaxRetries
    )
  );

  return normalizedSettings;
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

function updateMemorySettings(
  settings: GomiOfficeSettings,
  memoryPatch: Partial<GomiOfficeSettings['memory']>
): GomiOfficeSettings {
  return {
    ...settings,
    memory: {
      ...settings.memory,
      ...memoryPatch
    }
  };
}

function updateExecutionSettings(
  settings: GomiOfficeSettings,
  executionPatch: Partial<GomiOfficeSettings['execution']>
): GomiOfficeSettings {
  return {
    ...settings,
    execution: {
      ...settings.execution,
      ...executionPatch
    }
  };
}

function normalizePromptTemplates(value: unknown): GomiPromptTemplate[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seenTemplateIds = new Set<string>();
  const promptTemplates: GomiPromptTemplate[] = [];

  for (const rawTemplate of value) {
    const template = normalizePromptTemplate(rawTemplate);

    if (!template || seenTemplateIds.has(template.id)) {
      continue;
    }

    seenTemplateIds.add(template.id);
    promptTemplates.push(template);

    if (promptTemplates.length >= GOMI_MAX_PROMPT_TEMPLATES) {
      break;
    }
  }

  return promptTemplates;
}

function normalizePromptTemplate(value: unknown): GomiPromptTemplate | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = stringSetting(value.id).trim();
  const body = stringSetting(value.body).trim();

  if (!id || !body) {
    return undefined;
  }

  return {
    id: id.slice(0, 96),
    title: promptTemplateTitleSetting(value.title, body),
    body: body.slice(0, 12000),
    updatedAt: isoDateSetting(value.updatedAt)
  };
}

function clampBroadcastThreshold(value: number): number {
  if (!Number.isFinite(value)) {
    return GOMI_DEFAULT_MEMORY_BROADCAST_THRESHOLD;
  }

  return Math.min(0.95, Math.max(0.45, value));
}

function clampInteger(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
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

function normalizeSeatSettings(value: unknown): GomiAgentSeat[] {
  if (!Array.isArray(value)) {
    return DEFAULT_GOMI_OFFICE_SETTINGS.seats;
  }

  const rawSeatsById = new Map(
    value
      .filter(isRecord)
      .map((seat) => [String(seat.id), seat])
  );

  const defaultSeatIds = new Set(DEFAULT_GOMI_OFFICE_SETTINGS.seats.map((seat) => seat.id));
  const normalizedDefaultSeats = DEFAULT_GOMI_OFFICE_SETTINGS.seats.map((defaultSeat) => {
    const rawSeat = rawSeatsById.get(defaultSeat.id);
    const providerId = agentProviderSetting(rawSeat?.providerId, defaultSeat.providerId);
    const requestedWorkMode = agentWorkModeSetting(rawSeat?.workMode, defaultSeat.workMode);
    const workMode =
      (requestedWorkMode === 'sleeping' && !defaultSeat.canSleep) ||
      (requestedWorkMode === 'fired' && !defaultSeat.canFire)
        ? defaultSeat.workMode
        : requestedWorkMode;

    return {
      ...defaultSeat,
      providerId,
      workMode
    };
  });

  return [
    ...normalizedDefaultSeats,
    ...normalizeAdditionalEmployeeSeats(value, defaultSeatIds)
  ];
}

function normalizeAdditionalEmployeeSeats(
  seats: unknown[],
  reservedSeatIds: Set<string>
): GomiAgentSeat[] {
  const seenSeatIds = new Set(reservedSeatIds);
  const normalizedSeats: GomiAgentSeat[] = [];

  for (const rawSeat of seats.filter(isRecord)) {
    const seatId = typeof rawSeat.id === 'string' ? rawSeat.id : '';

    if (!/^employee-[a-z0-9-]+-\d+$/i.test(seatId) || seenSeatIds.has(seatId)) {
      continue;
    }

    const idInfo = parseEmployeeSeatId(seatId);
    const explicitDepartmentId = departmentIdSetting(rawSeat.departmentId ?? rawSeat.agentId);

    if (!idInfo || (explicitDepartmentId && explicitDepartmentId !== idInfo.departmentId)) {
      continue;
    }

    const departmentId = idInfo.departmentId;
    const profile = GOMI_EMPLOYEE_PROFILES[departmentId];
    const workMode = rawSeat.workMode === 'fired' ? 'fired' : 'active';

    normalizedSeats.push({
      id: seatId,
      agentId: departmentId,
      name: typeof rawSeat.name === 'string' && rawSeat.name.trim()
        ? rawSeat.name.trim()
        : `${profile.baseName} ${idInfo.index}`,
      role: typeof rawSeat.role === 'string' && rawSeat.role.trim()
        ? rawSeat.role.trim()
        : profile.role,
      seatKind: 'employee',
      providerId: agentProviderSetting(rawSeat.providerId, 'demo-runtime'),
      workMode,
      canSleep: false,
      canFire: true,
      departmentId
    });
    seenSeatIds.add(seatId);
  }

  return normalizedSeats;
}

function normalizeRecentProjects(value: unknown): GomiRecentProject[] {
  if (!Array.isArray(value)) {
    return DEFAULT_GOMI_OFFICE_SETTINGS.recentProjects;
  }

  const seenPaths = new Set<string>();
  const normalizedProjects: GomiRecentProject[] = [];

  for (const rawProject of value.filter(isRecord)) {
    const project = normalizeRecentProject(rawProject);

    if (!project || seenPaths.has(project.path)) {
      continue;
    }

    normalizedProjects.push(project);
    seenPaths.add(project.path);

    if (normalizedProjects.length >= GOMI_MAX_RECENT_PROJECTS) {
      break;
    }
  }

  return normalizedProjects;
}

function normalizeRecentProject(value: unknown): GomiRecentProject | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const path = trimBoundedString(value.path, 500);

  if (!path || path.includes('\0')) {
    return undefined;
  }

  const name = trimBoundedString(value.name, 120) ?? nameFromProjectPath(path);
  const lastOpenedAt = trimBoundedString(value.lastOpenedAt, 64) ?? new Date(0).toISOString();

  return {
    id: `project-${stableProjectHash(path)}`,
    name,
    path,
    lastOpenedAt
  };
}

function nameFromProjectPath(path: string): string {
  const segments = path.replace(/\\/g, '/').split('/').filter(Boolean);
  return trimBoundedString(segments.at(-1), 120) ?? path;
}

function stableProjectHash(path: string): string {
  let hash = 2166136261;

  for (const character of path) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function agentProviderSetting(value: unknown, fallback: GomiAgentCliProviderId): GomiAgentCliProviderId {
  return GOMI_AGENT_CLI_PROVIDERS.some((provider) => provider.id === value)
    ? value as GomiAgentCliProviderId
    : fallback;
}

function memoryEmbeddingProviderSetting(value: unknown): GomiMemoryEmbeddingProviderId {
  return GOMI_MEMORY_EMBEDDING_PROVIDERS.some((provider) => provider.id === value)
    ? value as GomiMemoryEmbeddingProviderId
    : DEFAULT_GOMI_OFFICE_SETTINGS.memory.embeddingProvider;
}

function memoryPrivacyModeSetting(value: unknown): GomiMemoryPrivacyMode {
  return value === 'strict' || value === 'standard'
    ? value
    : DEFAULT_GOMI_OFFICE_SETTINGS.memory.privacyMode;
}

function avatarStyleSetting(value: unknown): GomiAvatarStyle {
  return GOMI_AVATAR_STYLE_OPTIONS.some((option) => option.id === value)
    ? value as GomiAvatarStyle
    : DEFAULT_GOMI_OFFICE_SETTINGS.avatarStyle;
}

function workspaceTrustSetting(value: unknown): GomiWorkspaceTrustState {
  return value === 'trusted' || value === 'untrusted'
    ? value
    : DEFAULT_GOMI_OFFICE_SETTINGS.execution.workspaceTrust;
}

function liveProviderModeSetting(value: unknown): GomiLiveProviderMode {
  return value === 'demo-only' || value === 'trusted-workspaces' || value === 'allow-all'
    ? value
    : DEFAULT_GOMI_OFFICE_SETTINGS.execution.liveProviderMode;
}

function agentWorkModeSetting(value: unknown, fallback: GomiAgentWorkMode): GomiAgentWorkMode {
  return value === 'active' || value === 'sleeping' || value === 'fired' ? value : fallback;
}

function departmentIdSetting(value: unknown): Exclude<GomiAgentId, 'ceo'> | undefined {
  return isHirableDepartmentId(value) ? value : undefined;
}

function isHirableDepartmentId(value: unknown): value is Exclude<GomiAgentId, 'ceo'> {
  return GOMI_HIRABLE_DEPARTMENT_IDS.includes(value as GomiAgentId);
}

function parseEmployeeSeatId(seatId: string): {
  departmentId: Exclude<GomiAgentId, 'ceo'>;
  index: number;
} | undefined {
  const match = seatId.match(/^employee-(.+)-(\d+)$/i);

  if (!match) {
    return undefined;
  }

  const departmentId = departmentIdSetting(match[1]);
  const index = Number(match[2]);

  if (!departmentId || !Number.isFinite(index) || index < 1) {
    return undefined;
  }

  return {
    departmentId,
    index
  };
}

function nextEmployeeIndex(settings: GomiOfficeSettings, departmentId: GomiAgentId): number {
  const indexes = settings.seats
    .filter((seat) => seat.seatKind === 'employee' && seat.departmentId === departmentId)
    .map((seat) => {
      const match = seat.id.match(/-(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => Number.isFinite(value));

  return Math.max(0, ...indexes) + 1;
}

function booleanSetting(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function numberSetting(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function trimBoundedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed.slice(0, maxLength) : undefined;
}

function stringSetting(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function promptTemplateTitleSetting(value: unknown, body: string): string {
  const explicitTitle = stringSetting(value).trim();
  const fallbackTitle = body.split(/\r?\n/, 1)[0]?.trim() || 'Untitled template';

  return (explicitTitle || fallbackTitle).slice(0, 80);
}

function isoDateSetting(value: unknown): string {
  const candidate = stringSetting(value).trim();
  const timestamp = candidate ? Date.parse(candidate) : NaN;

  return Number.isFinite(timestamp)
    ? new Date(timestamp).toISOString()
    : new Date(0).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
