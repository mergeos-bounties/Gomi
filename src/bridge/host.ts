/**
 * Gomi Webview Host Bridge
 * Versioned message validation + size limits (closes #22)
 */
const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB limit
const SUPPORTED_VERSIONS = ['1.0', '1.1'];

interface BridgeMessage {
  version: string;
  type: string;
  payload: unknown;
  timestamp: number;
  id: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateVersion(version: string): boolean {
  return SUPPORTED_VERSIONS.includes(version);
}

function validateSize(message: string): boolean {
  const size = new TextEncoder().encode(message).length;
  return size <= MAX_MESSAGE_SIZE;
}

function validateSchema(message: BridgeMessage): ValidationResult {
  if (!message.version) return { valid: false, error: 'Missing version' };
  if (!validateVersion(message.version)) return { valid: false, error: `Unsupported version: ${message.version}. Supported: ${SUPPORTED_VERSIONS.join(', ')}` };
  if (!message.type) return { valid: false, error: 'Missing type' };
  if (!message.id) return { valid: false, error: 'Missing message id' };
  if (!message.timestamp) return { valid: false, error: 'Missing timestamp' };
  return { valid: true };
}

export function validateMessage(raw: string): ValidationResult {
  if (!validateSize(raw)) {
    return { valid: false, error: `Message exceeds size limit of ${MAX_MESSAGE_SIZE} bytes` };
  }
  try {
    const parsed: BridgeMessage = JSON.parse(raw);
    return validateSchema(parsed);
  } catch {
    return { valid: false, error: 'Invalid JSON' };
  }
}

export function createMessage(type: string, payload: unknown, version: string = '1.1'): string {
  return JSON.stringify({
    version,
    type,
    payload,
    timestamp: Date.now(),
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  });
}

export { MAX_MESSAGE_SIZE, SUPPORTED_VERSIONS, BridgeMessage, ValidationResult };
