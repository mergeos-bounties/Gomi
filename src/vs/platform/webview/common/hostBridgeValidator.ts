/**
 * Webview Host Bridge Message Validator
 * 
 * Versioned message schema validation with size limits for
 * gomi.run, settings, and patch-apply messages.
 * 
 * Protocol version: 1
 */

export const PROTOCOL_VERSION = 1;
export const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1 MB limit

// ─── Known message types ────────────────────────────────────────────────────

export const VALID_MESSAGE_TYPES = ['gomi.run', 'gomi.settings', 'gomi.patch.apply'] as const;
export type MessageType = (typeof VALID_MESSAGE_TYPES)[number];

// ─── Schema definitions ─────────────────────────────────────────────────────

export interface GomiRunPayload {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface GomiSettingsPayload {
  key: string;
  value: unknown;
  scope?: 'user' | 'workspace';
}

export interface GomiPatchApplyPayload {
  patch: string;
  path: string;
  requiresApproval?: boolean;
}

export interface HostBridgeMessage {
  version: number;
  type: MessageType;
  id: string;
  payload: unknown;
  timestamp?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: HostBridgeMessage;
}

// ─── Validators ─────────────────────────────────────────────────────────────

function validateRunPayload(payload: unknown): payload is GomiRunPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.command !== 'string' || p.command.length === 0) return false;
  if (p.args !== undefined && !Array.isArray(p.args)) return false;
  if (p.args !== undefined && !p.args.every((a: unknown) => typeof a === 'string')) return false;
  if (p.cwd !== undefined && typeof p.cwd !== 'string') return false;
  if (p.env !== undefined) {
    if (typeof p.env !== 'object') return false;
    for (const [k, v] of Object.entries(p.env as Record<string, unknown>)) {
      if (typeof k !== 'string' || typeof v !== 'string') return false;
    }
  }
  return true;
}

function validateSettingsPayload(payload: unknown): payload is GomiSettingsPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.key !== 'string' || p.key.length === 0) return false;
  if (p.value === undefined) return false;
  if (p.scope !== undefined && p.scope !== 'user' && p.scope !== 'workspace') return false;
  return true;
}

function validatePatchPayload(payload: unknown): payload is GomiPatchApplyPayload {
  if (!payload || typeof payload !== 'object') return false;
  const p = payload as Record<string, unknown>;
  if (typeof p.patch !== 'string' || p.patch.length === 0) return false;
  if (typeof p.path !== 'string' || p.path.length === 0) return false;
  // Prevent path traversal
  if (p.path.includes('..')) return false;
  if (p.requiresApproval !== undefined && typeof p.requiresApproval !== 'boolean') return false;
  return true;
}

function validatePayload(type: MessageType, payload: unknown): boolean {
  switch (type) {
    case 'gomi.run':
      return validateRunPayload(payload);
    case 'gomi.settings':
      return validateSettingsPayload(payload);
    case 'gomi.patch.apply':
      return validatePatchPayload(payload);
    default:
      return false;
  }
}

// ─── Main validation function ────────────────────────────────────────────────

/**
 * Validate and sanitize an incoming webview host bridge message.
 * Rejects messages that don't match the versioned schema, have unknown types,
 * exceed size limits, or contain invalid payloads.
 */
export function validateHostBridgeMessage(raw: unknown): ValidationResult {
  // Basic structure check
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Message must be a non-null object' };
  }

  const msg = raw as Record<string, unknown>;

  // Version check
  if (msg.version !== PROTOCOL_VERSION) {
    return {
      valid: false,
      error: `Unsupported protocol version ${msg.version}. Expected ${PROTOCOL_VERSION}.`,
    };
  }

  // Type check
  if (typeof msg.type !== 'string' || !VALID_MESSAGE_TYPES.includes(msg.type as MessageType)) {
    return {
      valid: false,
      error: `Unknown or missing message type. Allowed: ${VALID_MESSAGE_TYPES.join(', ')}`,
    };
  }

  // ID check
  if (typeof msg.id !== 'string' || msg.id.length === 0) {
    return { valid: false, error: 'Message must have a non-empty string id' };
  }

  // Size check
  const size = new TextEncoder().encode(JSON.stringify(msg)).length;
  if (size > MAX_PAYLOAD_BYTES) {
    return {
      valid: false,
      error: `Payload size ${size} bytes exceeds limit of ${MAX_PAYLOAD_BYTES} bytes`,
    };
  }

  // Payload validation
  if (!validatePayload(msg.type as MessageType, msg.payload)) {
    return {
      valid: false,
      error: `Invalid payload for message type "${msg.type}"`,
    };
  }

  // Sanitized output
  return {
    valid: true,
    sanitized: {
      version: msg.version as number,
      type: msg.type as MessageType,
      id: msg.id as string,
      payload: msg.payload,
      timestamp: typeof msg.timestamp === 'number' ? msg.timestamp : Date.now(),
    },
  };
}

/**
 * Create a safe error event payload for rejected messages.
 */
export function createValidationErrorEvent(originalMessage: unknown, error: string) {
  return {
    type: 'gomi.validation.error',
    error,
    originalId: (originalMessage as Record<string, unknown>)?.id ?? 'unknown',
    timestamp: Date.now(),
  };
}
