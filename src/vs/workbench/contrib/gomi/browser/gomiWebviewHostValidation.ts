/*---------------------------------------------------------------------------------------------
 *  Gomi Webview Host Bridge – Message Validation
 *
 *  Protocol versioning & payload validation for the host-side bridge.
 *  Every message crossing the webview↔host boundary must pass these checks
 *  before dispatch.  The host bridge is the enforcement point — the webview
 *  side is untrusted.
 *
 *  DESIGN PRINCIPLES
 *  – Reject unknown message types early (defence in depth).
 *  – Enforce a maximum serialised payload size (64 KB).
 *  – Return detailed rejection reasons so operators can diagnose misbehaving
 *    webviews without inspecting raw message dumps.
 *  – Support protocol version negotiation: the host advertises the version
 *    range it accepts; webviews that send unsupported versions get a clear
 *    error back.
 *--------------------------------------------------------------------------------------------*/

import {
  GOMI_BRIDGE_MAX_MESSAGE_BYTES,
  GOMI_BRIDGE_PROTOCOL_VERSION,
  isGomiBridgeMessage
} from './gomiWebviewBridge';
import type { GomiBridgeMessage } from '../electron-sandbox/gomiBridge';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GomiBridgeValidationResult {
  valid: boolean;
  /** Human-readable reason when `valid === false`. */
  reason?: string;
}

/** Protocol version range that this host bridge accepts. */
export interface GomiBridgeVersionRange {
  min: number;
  max: number;
}

const DEFAULT_VERSION_RANGE: GomiBridgeVersionRange = {
  min: 1,
  max: GOMI_BRIDGE_PROTOCOL_VERSION
};

/**
 * Full validation pass for a message received by the host bridge.
 *
 * Checks (in order, cheapest first):
 * 1. Payload is a plain object
 * 2. Serialised size ≤ `GOMI_BRIDGE_MAX_MESSAGE_BYTES` (64 KB)
 * 3. `protocolVersion` is within the host's accepted range
 * 4. Message type is recognised and schema is satisfied
 *
 * @param message  Raw value received from the untrusted webview.
 * @param versionRange  Accepted protocol version range (defaults to [1, current]).
 */
export function validateGomiBridgeMessage(
  message: unknown,
  versionRange: GomiBridgeVersionRange = DEFAULT_VERSION_RANGE
): GomiBridgeValidationResult {
  // --- 1. Structural check ------------------------------------------------
  if (!isPlainObject(message)) {
    return { valid: false, reason: 'Message is not a plain object.' };
  }

  // --- 2. Size guard ------------------------------------------------------
  const size = getMessageByteSize(message);
  if (size > GOMI_BRIDGE_MAX_MESSAGE_BYTES) {
    return {
      valid: false,
      reason: `Message size ${size} bytes exceeds limit of ${GOMI_BRIDGE_MAX_MESSAGE_BYTES} bytes.`
    };
  }

  // --- 3. Protocol version negotiation ------------------------------------
  const versionResult = validateProtocolVersion(message, versionRange);
  if (!versionResult.valid) {
    return versionResult;
  }

  // --- 4. Schema validation -----------------------------------------------
  if (!isGomiBridgeMessage(message)) {
    const type = typeof (message as Record<string, unknown>).type === 'string'
      ? (message as Record<string, unknown>).type
      : undefined;
    if (type === undefined) {
      return { valid: false, reason: 'Message is missing a recognised "type" field.' };
    }
    return { valid: false, reason: `Schema validation failed for message type "${String(type)}".` };
  }

  return { valid: true };
}

/**
 * Check whether the message carries a protocol version the host accepts.
 *
 * Returns a validation result; when invalid the `reason` is suitable for
 * inclusion in a `gomi.bridgeError` response sent back to the webview.
 */
export function validateProtocolVersion(
  message: Record<string, unknown>,
  versionRange: GomiBridgeVersionRange = DEFAULT_VERSION_RANGE
): GomiBridgeValidationResult {
  const { protocolVersion } = message;

  if (protocolVersion === undefined || protocolVersion === null) {
    return {
      valid: false,
      reason: `Missing "protocolVersion". This host accepts versions ${versionRange.min}–${versionRange.max}.`
    };
  }

  if (typeof protocolVersion !== 'number' || !Number.isInteger(protocolVersion)) {
    return {
      valid: false,
      reason: `"protocolVersion" must be an integer, got ${typeof protocolVersion}.`
    };
  }

  if (protocolVersion < versionRange.min || protocolVersion > versionRange.max) {
    return {
      valid: false,
      reason: `Protocol version ${protocolVersion} is not supported. This host accepts ${versionRange.min}–${versionRange.max}.`
    };
  }

  return { valid: true };
}

/**
 * Create a `gomi.bridgeError` message with a detailed reason string.
 *
 * Prefer this over the original generic `createGomiBridgeErrorMessage()` when
 * the rejection reason is available (e.g. from `validateGomiBridgeMessage()`).
 */
export function createDetailedGomiBridgeError(
  reason: string,
  protocolVersion: number = GOMI_BRIDGE_PROTOCOL_VERSION
): GomiBridgeMessage {
  return {
    protocolVersion,
    type: 'gomi.bridgeError',
    code: 'invalid_message',
    message: reason.length <= 2000 ? reason : reason.slice(0, 1997) + '...'
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getMessageByteSize(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
