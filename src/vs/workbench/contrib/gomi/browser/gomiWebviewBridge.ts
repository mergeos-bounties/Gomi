import type {
  GomiAgentCliProviderId,
  GomiAgentId,
  GomiAgentSeat,
  GomiAgentSeatKind,
  GomiAgentWorkMode,
  GomiLiveProviderMode,
  GomiMemoryEmbeddingProviderId,
  GomiMemoryPrivacyMode,
  GomiPatchApprovalStatus,
  GomiPatchProposal,
  GomiPatchRiskLevel,
  GomiRecentProject,
  GomiWorkspaceTrustState
} from '../common/gomiTypes';
import {
  GOMI_BRIDGE_PROTOCOL_VERSION,
  type GomiBridgeMessage,
  type GomiWorkbenchBridge
} from '../electron-sandbox/gomiBridge';

export interface GomiVsCodeWebviewApi {
  postMessage(message: GomiBridgeMessage): void;
  getState?(): unknown;
  setState?(state: unknown): void;
}

export interface GomiWebviewStateStore {
  getState(): unknown;
  setState(state: unknown): void;
}

export interface GomiWebviewBridgeContext {
  bridge: GomiWorkbenchBridge;
  stateStore: GomiWebviewStateStore;
}

export interface GomiWebviewBridgeGlobal {
  acquireVsCodeApi?: () => GomiVsCodeWebviewApi;
  __GOMI_ENABLE_WORKBENCH_BRIDGE__?: boolean;
}

export interface GomiMessageEventTarget {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
}

export function resolveGomiWebviewBridge(
  globalObject: GomiWebviewBridgeGlobal = globalThis as GomiWebviewBridgeGlobal,
  eventTarget: GomiMessageEventTarget | undefined =
    typeof window !== 'undefined' ? window : undefined
): GomiWorkbenchBridge | undefined {
  return resolveGomiWebviewBridgeContext(globalObject, eventTarget)?.bridge;
}

export function resolveGomiWebviewBridgeContext(
  globalObject: GomiWebviewBridgeGlobal = globalThis as GomiWebviewBridgeGlobal,
  eventTarget: GomiMessageEventTarget | undefined =
    typeof window !== 'undefined' ? window : undefined
): GomiWebviewBridgeContext | undefined {
  if (!globalObject.__GOMI_ENABLE_WORKBENCH_BRIDGE__ || !globalObject.acquireVsCodeApi || !eventTarget) {
    return undefined;
  }

  const api = globalObject.acquireVsCodeApi();

  return {
    bridge: createGomiWebviewBridge(api, eventTarget),
    stateStore: createGomiWebviewStateStore(api)
  };
}

export function createGomiWebviewBridge(
  api: GomiVsCodeWebviewApi,
  eventTarget: GomiMessageEventTarget
): GomiWorkbenchBridge {
  return {
    postMessage(message) {
      api.postMessage(withGomiBridgeProtocol(message));
    },

    onMessage(listener) {
      const messageListener = (event: MessageEvent) => {
        if (isTrustedGomiMessageEvent(event) && isGomiBridgeMessage(event.data)) {
          listener(event.data);
        }
      };

      eventTarget.addEventListener('message', messageListener);

      return () => {
        eventTarget.removeEventListener('message', messageListener);
      };
    }
  };
}

export function createGomiWebviewStateStore(api: GomiVsCodeWebviewApi): GomiWebviewStateStore {
  let fallbackState: unknown = {};

  return {
    getState() {
      return api.getState?.() ?? fallbackState;
    },

    setState(state) {
      fallbackState = state;
      api.setState?.(state);
    }
  };
}

const trustedGomiOriginPrefixes = ['vscode-webview://', 'vscode-file://'];

// Bridge messages cross the webview/host privilege boundary; every new type must
// be added here with an explicit protocol and payload schema before dispatch.
//
// ## Protocol
// - Every message carries a `protocolVersion` (currently 1) and a `type` prefixed `gomi.`
// - Max serialized message size: `GOMI_BRIDGE_MAX_MESSAGE_BYTES` (64 000 bytes)
// - Unknown types are rejected silently; messages that claim `gomi.` but fail
//   validation return a `gomi.bridgeError` response on the host bridge
// - Supported types and their validators: `gomi.run`, `gomi.stop`, `gomi.pruneMemory`,
//   `gomi.openProject`, `gomi.applyPatch`, `gomi.previewPatch`,
//   `gomi.applyPatchResult`, `gomi.previewPatchResult`, `gomi.pruneMemoryResult`,
//   `gomi.event`, `gomi.bridgeError`
export const GOMI_BRIDGE_MAX_MESSAGE_BYTES = 64_000;

const GOMI_BRIDGE_MAX_TEXT_LENGTH = 16_000;
const GOMI_BRIDGE_MAX_ERROR_LENGTH = 2_000;
const GOMI_BRIDGE_MAX_PATCH_DIFF_LENGTH = 60_000;
const GOMI_BRIDGE_MAX_PATH_LENGTH = 500;
const GOMI_BRIDGE_MAX_ARRAY_ITEMS = 100;

const GOMI_AGENT_IDS: readonly GomiAgentId[] = [
  'ceo',
  'system-analyst',
  'backend',
  'frontend',
  'designer',
  'database',
  'qa',
  'devops'
];
const GOMI_AGENT_PROVIDER_IDS: readonly GomiAgentCliProviderId[] = [
  'codex-cli',
  'claude-code',
  'gemini-cli',
  'aider-cli',
  'cursor-style-agent',
  'openai-compatible-api',
  'ollama-local-model',
  'local-llm',
  'demo-runtime'
];
const GOMI_SEAT_KINDS: readonly GomiAgentSeatKind[] = ['executive', 'department-head', 'employee'];
const GOMI_AGENT_WORK_MODES: readonly GomiAgentWorkMode[] = ['active', 'sleeping', 'fired'];
const GOMI_MEMORY_EMBEDDING_PROVIDERS: readonly GomiMemoryEmbeddingProviderId[] = [
  'local-hashing',
  'openai-compatible',
  'ollama-embeddings',
  'ollama-embed'
];
const GOMI_MEMORY_PRIVACY_MODES: readonly GomiMemoryPrivacyMode[] = ['standard', 'strict'];
const GOMI_AVATAR_STYLES = ['emoji', 'geometric', 'initials'] as const;
const GOMI_WORKSPACE_TRUST_STATES: readonly GomiWorkspaceTrustState[] = ['trusted', 'untrusted'];
const GOMI_LIVE_PROVIDER_MODES: readonly GomiLiveProviderMode[] = [
  'demo-only',
  'trusted-workspaces',
  'allow-all'
];
const GOMI_PATCH_APPROVAL_STATUSES: readonly GomiPatchApprovalStatus[] = [
  'pending',
  'approved',
  'rejected',
  'applying',
  'applied',
  'failed'
];
const GOMI_PATCH_RISK_LEVELS: readonly GomiPatchRiskLevel[] = ['low', 'medium', 'high'];

export function isTrustedGomiMessageEvent(event: Pick<MessageEvent, 'origin' | 'source'>): boolean {
  const origin = event.origin;

  if (typeof origin === 'string' && origin.length > 0) {
    const localOrigin = globalThis.location?.origin;
    const matchesOrigin =
      trustedGomiOriginPrefixes.some((prefix) => origin.startsWith(prefix)) ||
      (typeof localOrigin === 'string' && localOrigin.length > 0 && origin === localOrigin);

    if (!matchesOrigin) {
      return false;
    }
  }

  return true;
}

export function isGomiBridgeMessage(value: unknown): value is GomiBridgeMessage {
  if (!isRecord(value) || value.protocolVersion !== GOMI_BRIDGE_PROTOCOL_VERSION) {
    return false;
  }

  if (getSerializedMessageSize(value) > GOMI_BRIDGE_MAX_MESSAGE_BYTES) {
    return false;
  }

  switch (value.type) {
    case 'gomi.run':
      return (
        hasOnlyKeys(value, ['protocolVersion', 'type', 'request', 'officeSettings']) &&
        isSafeString(value.request, GOMI_BRIDGE_MAX_TEXT_LENGTH) &&
        isOptionalOfficeSettings(value.officeSettings)
      );
    case 'gomi.stop':
      return (
        hasOnlyKeys(value, ['protocolVersion', 'type', 'reason']) &&
        isOptionalSafeString(value.reason, GOMI_BRIDGE_MAX_ERROR_LENGTH)
      );
    case 'gomi.pruneMemory':
      return (
        hasOnlyKeys(value, ['protocolVersion', 'type', 'officeSettings']) &&
        isOptionalOfficeSettings(value.officeSettings)
      );
    case 'gomi.openProject':
      return hasOnlyKeys(value, ['protocolVersion', 'type', 'project']) && isRecentProject(value.project);
    case 'gomi.applyPatch':
    case 'gomi.previewPatch':
      return hasOnlyKeys(value, ['protocolVersion', 'type', 'patch']) && isPatchProposal(value.patch);
    case 'gomi.applyPatchResult':
    case 'gomi.previewPatchResult':
      return (
        hasOnlyKeys(value, ['protocolVersion', 'type', 'patchId', 'result', 'error']) &&
        isSafeString(value.patchId, 128) &&
        (value.result === undefined || isRecord(value.result)) &&
        isOptionalSafeString(value.error, GOMI_BRIDGE_MAX_ERROR_LENGTH)
      );
    case 'gomi.pruneMemoryResult':
      return (
        hasOnlyKeys(value, ['protocolVersion', 'type', 'report', 'error']) &&
        (value.report === undefined || isRecord(value.report)) &&
        isOptionalSafeString(value.error, GOMI_BRIDGE_MAX_ERROR_LENGTH)
      );
    case 'gomi.event':
      return (
        hasOnlyKeys(value, ['protocolVersion', 'type', 'event']) &&
        isRecord(value.event) &&
        getSerializedMessageSize(value.event) <= GOMI_BRIDGE_MAX_MESSAGE_BYTES
      );
    case 'gomi.bridgeError':
      return (
        hasOnlyKeys(value, ['protocolVersion', 'type', 'code', 'message']) &&
        value.code === 'invalid_message' &&
        isSafeString(value.message, GOMI_BRIDGE_MAX_ERROR_LENGTH)
      );
    default:
      return false;
  }
}

export function withGomiBridgeProtocol(message: GomiBridgeMessage): GomiBridgeMessage {
  return {
    ...message,
    protocolVersion: GOMI_BRIDGE_PROTOCOL_VERSION
  };
}

export function createGomiBridgeErrorMessage(): GomiBridgeMessage {
  return {
    protocolVersion: GOMI_BRIDGE_PROTOCOL_VERSION,
    type: 'gomi.bridgeError',
    code: 'invalid_message',
    message: 'Rejected invalid Gomi bridge message.'
  };
}

export function shouldReportInvalidGomiBridgeMessage(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.protocolVersion !== undefined ||
      (typeof value.type === 'string' && value.type.startsWith('gomi.')))
  );
}

function getSerializedMessageSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isPatchProposal(value: unknown): value is GomiPatchProposal {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'id',
      'filePath',
      'targetFiles',
      'summary',
      'diff',
      'approvalStatus',
      'riskLevel',
      'createdByAgentId'
    ])
  ) {
    return false;
  }

  return (
    isSafeString(value.id, 128) &&
    isSafeRelativePath(value.filePath) &&
    isSafeStringArray(value.targetFiles, GOMI_BRIDGE_MAX_ARRAY_ITEMS, isSafeRelativePath) &&
    isSafeString(value.summary, 2_000) &&
    isSafeString(value.diff, GOMI_BRIDGE_MAX_PATCH_DIFF_LENGTH) &&
    isOneOf(value.approvalStatus, GOMI_PATCH_APPROVAL_STATUSES) &&
    isOneOf(value.riskLevel, GOMI_PATCH_RISK_LEVELS) &&
    isOneOf(value.createdByAgentId, GOMI_AGENT_IDS)
  );
}

function isRecentProject(value: unknown): value is GomiRecentProject {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['id', 'name', 'path', 'lastOpenedAt'])
  ) {
    return false;
  }

  return (
    isSafeString(value.id, 128) &&
    isSafeString(value.name, 120) &&
    isSafeProjectPath(value.path) &&
    isSafeString(value.lastOpenedAt, 64)
  );
}

function isOptionalOfficeSettings(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (!isRecord(value) || !hasOnlyKeys(value, ['avatarStyle', 'recentProjects', 'seats', 'memory', 'execution'])) {
    return false;
  }

  return (
    (value.avatarStyle === undefined || isOneOf(value.avatarStyle, GOMI_AVATAR_STYLES)) &&
    (value.recentProjects === undefined || isRecentProjectArray(value.recentProjects)) &&
    isSeatArray(value.seats) &&
    isMemorySettings(value.memory) &&
    isExecutionSettings(value.execution)
  );
}

function isRecentProjectArray(value: unknown): value is GomiRecentProject[] {
  return Array.isArray(value) && value.length <= 8 && value.every(isRecentProject);
}

function isSeatArray(value: unknown): value is GomiAgentSeat[] {
  return Array.isArray(value) && value.length <= 64 && value.every(isSeat);
}

function isSeat(value: unknown): value is GomiAgentSeat {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'id',
      'agentId',
      'name',
      'role',
      'seatKind',
      'providerId',
      'workMode',
      'canSleep',
      'canFire',
      'departmentId'
    ])
  ) {
    return false;
  }

  return (
    isSafeString(value.id, 128) &&
    isOneOf(value.agentId, GOMI_AGENT_IDS) &&
    isSafeString(value.name, 128) &&
    isSafeString(value.role, 256) &&
    isOneOf(value.seatKind, GOMI_SEAT_KINDS) &&
    isOneOf(value.providerId, GOMI_AGENT_PROVIDER_IDS) &&
    isOneOf(value.workMode, GOMI_AGENT_WORK_MODES) &&
    typeof value.canSleep === 'boolean' &&
    typeof value.canFire === 'boolean' &&
    (value.departmentId === undefined || isOneOf(value.departmentId, GOMI_AGENT_IDS))
  );
}

function isMemorySettings(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'retrievalMode',
      'embeddingProvider',
      'embeddingExecutionEnabled',
      'sharedMemoryEnabled',
      'indexWorkspaceContext',
      'indexTerminalSnippets',
      'privacyMode',
      'redactSecrets',
      'retentionDays',
      'maxProjectMemoryItems',
      'broadcastThreshold',
      'requirePatchApproval'
    ])
  ) {
    return false;
  }

  return (
    value.retrievalMode === 'hybrid-vector' &&
    isOneOf(value.embeddingProvider, GOMI_MEMORY_EMBEDDING_PROVIDERS) &&
    typeof value.embeddingExecutionEnabled === 'boolean' &&
    typeof value.sharedMemoryEnabled === 'boolean' &&
    typeof value.indexWorkspaceContext === 'boolean' &&
    typeof value.indexTerminalSnippets === 'boolean' &&
    isOneOf(value.privacyMode, GOMI_MEMORY_PRIVACY_MODES) &&
    typeof value.redactSecrets === 'boolean' &&
    isIntegerInRange(value.retentionDays, 1, 3650) &&
    isIntegerInRange(value.maxProjectMemoryItems, 1, 10_000) &&
    isNumberInRange(value.broadcastThreshold, 0, 1) &&
    typeof value.requirePatchApproval === 'boolean'
  );
}

function isExecutionSettings(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      'workspaceTrust',
      'liveProviderMode',
      'allowCliProviders',
      'allowHttpProviders',
      'requirePatchApprovalForLiveProviders',
      'maxConcurrentAgentRuns',
      'httpMaxRetries'
    ])
  ) {
    return false;
  }

  return (
    isOneOf(value.workspaceTrust, GOMI_WORKSPACE_TRUST_STATES) &&
    isOneOf(value.liveProviderMode, GOMI_LIVE_PROVIDER_MODES) &&
    typeof value.allowCliProviders === 'boolean' &&
    typeof value.allowHttpProviders === 'boolean' &&
    typeof value.requirePatchApprovalForLiveProviders === 'boolean' &&
    isIntegerInRange(value.maxConcurrentAgentRuns, 1, 16) &&
    (value.httpMaxRetries === undefined || isIntegerInRange(value.httpMaxRetries, 0, 10))
  );
}

function isSafeStringArray(
  value: unknown,
  maxItems: number,
  itemValidator: (item: unknown) => boolean
): value is string[] {
  return Array.isArray(value) && value.length <= maxItems && value.every(itemValidator);
}

function isSafeString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function isOptionalSafeString(value: unknown, maxLength: number): value is string | undefined {
  return value === undefined || (typeof value === 'string' && value.length <= maxLength);
}

function isSafeRelativePath(value: unknown): value is string {
  if (!isSafeString(value, GOMI_BRIDGE_MAX_PATH_LENGTH)) {
    return false;
  }

  const normalized = value.replace(/\\/g, '/');

  if (normalized.startsWith('/') || normalized.includes('\0')) {
    return false;
  }

  return normalized.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

function isSafeProjectPath(value: unknown): value is string {
  if (!isSafeString(value, 500) || value.includes('\0')) {
    return false;
  }

  const normalized = value.replace(/\\/g, '/');
  if (normalized.includes('/../') || normalized.startsWith('../') || normalized.endsWith('/..')) {
    return false;
  }

  return true;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

function isNumberInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  const allowed = new Set(allowedKeys);

  for (const key of Object.keys(value)) {
    if (!allowed.has(key) || key === '__proto__' || key === 'prototype' || key === 'constructor') {
      return false;
    }
  }

  return true;
}
