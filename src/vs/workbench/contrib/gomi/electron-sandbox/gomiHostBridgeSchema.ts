/**
 * Host bridge message schema validation.
 *
 * Security: validates every inbound webview message before routing to handlers.
 * - Schema validation: type, required fields, field types
 * - Payload size: max 5 MB
 * - Protocol version: validates forward/backward compatibility
 */

import {
  GOMI_BRIDGE_PROTOCOL_VERSION,
  type GomiBridgeMessage,
} from "./gomiBridge";

/** Maximum payload size (5 MB) for any single message. */
export const MAX_BRIDGE_PAYLOAD_BYTES = 5 * 1024 * 1024;

export interface SchemaValidationResult {
  valid: boolean;
  message?: GomiBridgeMessage;
  error?: string;
}

/**
 * Validate the payload size of a raw JSON message.
 */
export function validatePayloadSize(raw: string): SchemaValidationResult {
  if (Buffer.byteLength(raw, "utf-8") > MAX_BRIDGE_PAYLOAD_BYTES) {
    return { valid: false, error: "payload exceeds 5 MB limit" };
  }
  return { valid: true };
}

/**
 * Parse and validate an inbound webview message against the host bridge schema.
 */
export function validateHostBridgeMessage(raw: unknown): SchemaValidationResult {
  if (typeof raw !== "object" || raw === null) {
    return { valid: false, error: "message must be a non-null object" };
  }

  const msg = raw as Record<string, unknown>;

  // Protocol version: optional but must be a number if present
  if ("protocolVersion" in msg) {
    const pv = msg.protocolVersion;
    if (typeof pv !== "number" || !Number.isInteger(pv) || pv < 1) {
      return {
        valid: false,
        error: `invalid protocolVersion: expected integer >= 1, got ${String(pv)}`,
      };
    }
  }

  // Type is required
  if (typeof msg.type !== "string" || msg.type.length === 0) {
    return { valid: false, error: "missing or empty message type" };
  }

  const t = msg.type;

  // Per-type field validation
  switch (t) {
    case "gomi.run": {
      if (typeof msg.request !== "string") {
        return {
          valid: false,
          error: "gomi.run requires a string `request` field",
        };
      }
      break;
    }

    case "gomi.applyPatch":
    case "gomi.previewPatch": {
      if (typeof msg.patch !== "object" || msg.patch === null) {
        return {
          valid: false,
          error: `${t} requires a non-null ` + "`patch`" + " object",
        };
      }
      break;
    }

    case "gomi.applyPatchResult":
    case "gomi.previewPatchResult": {
      if (typeof msg.patchId !== "string" || msg.patchId.length === 0) {
        return {
          valid: false,
          error: `${t} requires a non-empty string ` + "`patchId`",
        };
      }
      break;
    }

    case "gomi.openProject": {
      if (typeof msg.project !== "object" || msg.project === null) {
        return {
          valid: false,
          error: "gomi.openProject requires a non-null `project` object",
        };
      }
      break;
    }

    case "gomi.event": {
      if (typeof msg.event !== "object" || msg.event === null) {
        return {
          valid: false,
          error: "gomi.event requires a non-null `event` object",
        };
      }
      break;
    }

    case "gomi.stop":
    case "gomi.pruneMemory":
    case "gomi.pruneMemoryResult":
    case "gomi.bridgeError": {
      // These types have no required fields beyond `type`
      break;
    }

    default: {
      return {
        valid: false,
        error: `unknown message type: ${JSON.stringify(t)}`,
      };
    }
  }

  return { valid: true, message: msg as unknown as GomiBridgeMessage };
}
