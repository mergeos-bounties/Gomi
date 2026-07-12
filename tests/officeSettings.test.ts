import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  GOMI_AGENT_CLI_PROVIDERS,
  GOMI_HIRABLE_DEPARTMENT_IDS,
  GOMI_MEMORY_EMBEDDING_PROVIDERS,
  assignSeatProvider,
  fireEmployee,
  getMemoryEmbeddingProviderLabel,
  getSeatForAgent,
  hireEmployee,
  isAgentAvailableForTask,
  normalizeGomiOfficeSettings,
  setMaxProjectMemoryItems,
  setMemoryBroadcastThreshold,
  setMemoryPrivacyMode,
  setMemoryRetentionDays,
  setPatchApprovalRequired,
  setCliProvidersEnabled,
  setHttpProvidersEnabled,
  setLiveProviderMode,
  setLiveProviderPatchApprovalRequired,
  setMaxConcurrentAgentRuns,
  setSecretRedactionEnabled,
  setMemoryEmbeddingExecutionEnabled,
  setMemoryEmbeddingProvider,
  setSeatWorkMode,
  simulateStaffingScenario,
  setWorkspaceTrustState,
  setSharedMemoryEnabled,
  setWorkspaceContextIndexing,
  setAvatarStyle
} from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';

describe('Gomi office settings', () => {
  it('registers CLI, cloud API, local model, and demo provider transports', () => {
    const transports = new Map(GOMI_AGENT_CLI_PROVIDERS.map((provider) => [provider.id, provider.transport]));

    expect(transports.get('codex-cli')).toBe('cli');
    expect(transports.get('openai-compatible-api')).toBe('openai-compatible');
    expect(transports.get('ollama-local-model')).toBe('ollama-chat');
    expect(transports.get('demo-runtime')).toBe('demo');
  });

  it('registers memory embedding provider choices for local and HTTP vector retrieval', () => {
    const providers = new Map(GOMI_MEMORY_EMBEDDING_PROVIDERS.map((provider) => [provider.id, provider]));

    expect(providers.get('local-hashing')?.label).toBe('Local Hashing');
    expect(providers.get('openai-compatible')?.endpointEnv).toBe('GOMI_EMBEDDINGS_ENDPOINT');
    expect(providers.get('ollama-embeddings')?.modelEnv).toBe('GOMI_LOCAL_EMBEDDINGS_MODEL');
    expect(getMemoryEmbeddingProviderLabel('ollama-embed')).toBe('Ollama /api/embed');
  });

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

  it('hires additional employees into departments and keeps offboarded staff visible', () => {
    const withNewBackend = hireEmployee(DEFAULT_GOMI_OFFICE_SETTINGS, 'backend');
    const withNewDatabase = hireEmployee(withNewBackend, 'database');
    const offboardedBackend = fireEmployee(withNewDatabase, 'employee-backend-02');

    expect(GOMI_HIRABLE_DEPARTMENT_IDS).toContain('designer');
    expect(withNewBackend.seats.find((seat) => seat.id === 'employee-backend-02')).toMatchObject({
      agentId: 'backend',
      departmentId: 'backend',
      seatKind: 'employee',
      workMode: 'active',
      canFire: true
    });
    expect(withNewDatabase.seats.find((seat) => seat.id === 'employee-database-01')).toMatchObject({
      agentId: 'database',
      name: 'Database Engineer 1'
    });
    expect(offboardedBackend.seats.find((seat) => seat.id === 'employee-backend-02')?.workMode).toBe('fired');
  });

  it('simulates staffing by hiring employees and offboarding an existing staff member', () => {
    const staffed = simulateStaffingScenario(DEFAULT_GOMI_OFFICE_SETTINGS);

    expect(staffed.seats.find((seat) => seat.id === 'employee-backend-02')).toMatchObject({
      departmentId: 'backend',
      workMode: 'active'
    });
    expect(staffed.seats.find((seat) => seat.id === 'employee-designer-02')).toMatchObject({
      departmentId: 'designer',
      workMode: 'active'
    });
    expect(staffed.seats.some((seat) => seat.seatKind === 'employee' && seat.workMode === 'fired')).toBe(true);
  });

  it('does not immediately offboard newly hired staff when no active employee exists', () => {
    const allExistingEmployeesFired = DEFAULT_GOMI_OFFICE_SETTINGS.seats
      .filter((seat) => seat.seatKind === 'employee')
      .reduce(
        (settings, seat) => fireEmployee(settings, seat.id),
        DEFAULT_GOMI_OFFICE_SETTINGS
      );
    const staffed = simulateStaffingScenario(allExistingEmployeesFired);

    expect(staffed.seats.find((seat) => seat.id === 'employee-backend-02')?.workMode).toBe('active');
    expect(staffed.seats.find((seat) => seat.id === 'employee-designer-02')?.workMode).toBe('active');
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

  it('updates memory privacy, retention, indexing, and approval settings', () => {
    const strictSettings = setMemoryPrivacyMode(
      setSecretRedactionEnabled(DEFAULT_GOMI_OFFICE_SETTINGS, false),
      'strict'
    );
    const quietSettings = setWorkspaceContextIndexing(
      setSharedMemoryEnabled(DEFAULT_GOMI_OFFICE_SETTINGS, false),
      false
    );
    const relaxedApproval = setPatchApprovalRequired(DEFAULT_GOMI_OFFICE_SETTINGS, false);

    expect(strictSettings.memory.privacyMode).toBe('strict');
    expect(strictSettings.memory.redactSecrets).toBe(true);
    expect(quietSettings.memory.sharedMemoryEnabled).toBe(false);
    expect(quietSettings.memory.indexWorkspaceContext).toBe(false);
    expect(relaxedApproval.memory.requirePatchApproval).toBe(false);
  });

  it('updates embedding provider execution while keeping local hashing offline', () => {
    const httpEmbeddings = setMemoryEmbeddingExecutionEnabled(
      setMemoryEmbeddingProvider(DEFAULT_GOMI_OFFICE_SETTINGS, 'openai-compatible'),
      true
    );
    const localHashing = setMemoryEmbeddingProvider(httpEmbeddings, 'local-hashing');

    expect(httpEmbeddings.memory.embeddingProvider).toBe('openai-compatible');
    expect(httpEmbeddings.memory.embeddingExecutionEnabled).toBe(true);
    expect(localHashing.memory.embeddingProvider).toBe('local-hashing');
    expect(localHashing.memory.embeddingExecutionEnabled).toBe(false);
  });

  it('updates and normalizes persisted avatar style settings', () => {
    const geometricSettings = setAvatarStyle(DEFAULT_GOMI_OFFICE_SETTINGS, 'geometric');
    const initialsSettings = normalizeGomiOfficeSettings({
      ...geometricSettings,
      avatarStyle: 'initials'
    });
    const unsafeSettings = normalizeGomiOfficeSettings({
      ...geometricSettings,
      avatarStyle: 'remote-image'
    });

    expect(DEFAULT_GOMI_OFFICE_SETTINGS.avatarStyle).toBe('emoji');
    expect(geometricSettings.avatarStyle).toBe('geometric');
    expect(initialsSettings.avatarStyle).toBe('initials');
    expect(unsafeSettings.avatarStyle).toBe(DEFAULT_GOMI_OFFICE_SETTINGS.avatarStyle);
  });

  it('normalizes persisted settings across versions and rejects unsafe seat state', () => {
    const settings = normalizeGomiOfficeSettings({
      seats: [
        {
          id: 'seat-ceo',
          providerId: 'not-a-provider',
          workMode: 'fired'
        },
        {
          id: 'head-backend',
          providerId: 'claude-code',
          workMode: 'sleeping'
        },
        {
          id: 'employee-qa-01',
          providerId: 'demo-runtime',
          workMode: 'fired'
        },
        {
          id: 'employee-backend-02',
          agentId: 'backend',
          departmentId: 'backend',
          seatKind: 'employee',
          providerId: 'claude-code',
          workMode: 'active',
          name: 'Backend Developer 2',
          role: 'Implementation support'
        },
        {
          id: 'employee-backend-03',
          agentId: 'backend',
          departmentId: 'qa',
          seatKind: 'employee',
          providerId: 'demo-runtime',
          workMode: 'active',
          name: 'Wrong Department',
          role: 'Should be rejected'
        },
        {
          id: 'employee-designer-07',
          agentId: 'designer',
          departmentId: 'designer',
          seatKind: 'employee',
          providerId: 'demo-runtime',
          workMode: 'sleeping',
          name: ' ',
          role: ' '
        }
      ],
      memory: {
        embeddingProvider: 'ollama-embed',
        embeddingExecutionEnabled: true,
        retentionDays: 9999,
        maxProjectMemoryItems: 1,
        broadcastThreshold: 0.1,
        privacyMode: 'strict',
        redactSecrets: false
      },
      execution: {
        workspaceTrust: 'trusted',
        liveProviderMode: 'allow-all',
        allowHttpProviders: true,
        maxConcurrentAgentRuns: 6
      }
    });

    expect(settings.seats.find((seat) => seat.id === 'seat-ceo')?.providerId).toBe('codex-cli');
    expect(settings.seats.find((seat) => seat.id === 'seat-ceo')?.workMode).toBe('active');
    expect(settings.seats.find((seat) => seat.id === 'head-backend')?.workMode).toBe('sleeping');
    expect(settings.seats.find((seat) => seat.id === 'employee-qa-01')?.workMode).toBe('fired');
    expect(settings.seats.find((seat) => seat.id === 'employee-backend-02')).toMatchObject({
      agentId: 'backend',
      providerId: 'claude-code',
      workMode: 'active'
    });
    expect(settings.seats.find((seat) => seat.id === 'employee-backend-03')).toBeUndefined();
    expect(settings.seats.find((seat) => seat.id === 'employee-designer-07')).toMatchObject({
      agentId: 'designer',
      name: 'Product Designer 7',
      role: 'Visual and interaction support',
      workMode: 'active'
    });
    expect(settings.memory.embeddingProvider).toBe('ollama-embed');
    expect(settings.memory.embeddingExecutionEnabled).toBe(true);
    expect(settings.memory.privacyMode).toBe('strict');
    expect(settings.memory.redactSecrets).toBe(true);
    expect(settings.memory.retentionDays).toBe(365);
    expect(settings.memory.maxProjectMemoryItems).toBe(40);
    expect(settings.memory.broadcastThreshold).toBe(0.45);
    expect(settings.execution.workspaceTrust).toBe('trusted');
    expect(settings.execution.liveProviderMode).toBe('allow-all');
    expect(settings.execution.allowHttpProviders).toBe(true);
    expect(settings.execution.maxConcurrentAgentRuns).toBe(6);
  });

  it('updates live provider execution policy controls', () => {
    const settings = setLiveProviderPatchApprovalRequired(
      setHttpProvidersEnabled(
        setCliProvidersEnabled(
          setLiveProviderMode(
            setWorkspaceTrustState(DEFAULT_GOMI_OFFICE_SETTINGS, 'trusted'),
            'allow-all'
          ),
          true
        ),
        true
      ),
      false
    );

    expect(settings.execution.workspaceTrust).toBe('trusted');
    expect(settings.execution.liveProviderMode).toBe('allow-all');
    expect(settings.execution.allowCliProviders).toBe(true);
    expect(settings.execution.allowHttpProviders).toBe(true);
    expect(settings.execution.requirePatchApprovalForLiveProviders).toBe(false);
  });

  it('updates and clamps provider concurrency limits', () => {
    expect(DEFAULT_GOMI_OFFICE_SETTINGS.execution.maxConcurrentAgentRuns).toBe(2);
    expect(setMaxConcurrentAgentRuns(DEFAULT_GOMI_OFFICE_SETTINGS, 4).execution.maxConcurrentAgentRuns).toBe(4);
    expect(setMaxConcurrentAgentRuns(DEFAULT_GOMI_OFFICE_SETTINGS, 0).execution.maxConcurrentAgentRuns).toBe(1);
    expect(setMaxConcurrentAgentRuns(DEFAULT_GOMI_OFFICE_SETTINGS, 30).execution.maxConcurrentAgentRuns).toBe(8);
  });

  it('clamps project memory retention settings', () => {
    expect(setMemoryRetentionDays(DEFAULT_GOMI_OFFICE_SETTINGS, 0).memory.retentionDays).toBe(1);
    expect(setMemoryRetentionDays(DEFAULT_GOMI_OFFICE_SETTINGS, 999).memory.retentionDays).toBe(365);
    expect(setMaxProjectMemoryItems(DEFAULT_GOMI_OFFICE_SETTINGS, 4).memory.maxProjectMemoryItems).toBe(40);
    expect(setMaxProjectMemoryItems(DEFAULT_GOMI_OFFICE_SETTINGS, 9000).memory.maxProjectMemoryItems).toBe(5000);
  });
});
