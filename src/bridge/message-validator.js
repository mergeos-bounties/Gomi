/**
 * Gomi Webview Host Bridge — Versioned Message Validation
 * 
 * Validates messages between webview and Electron host process.
 * Implements versioned protocol, size limits, and schema validation.
 * 
 * Part of Gomi#22 (100 MRG)
 */

const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB
const SUPPORTED_VERSIONS = [1, 2];
const LATEST_VERSION = 2;

/**
 * Bridge message types
 * @enum {string}
 */
const MessageType = {
  COMMAND: "command",
  EVENT: "event",
  RESPONSE: "response",
  ERROR: "error",
  HANDSHAKE: "handshake",
};

/**
 * Bridge error codes
 */
const BridgeError = {
  INVALID_VERSION: "BRIDGE_ERR_INVALID_VERSION",
  MESSAGE_TOO_LARGE: "BRIDGE_ERR_MESSAGE_TOO_LARGE",
  INVALID_SCHEMA: "BRIDGE_ERR_INVALID_SCHEMA",
  UNKNOWN_TYPE: "BRIDGE_ERR_UNKNOWN_TYPE",
  TIMEOUT: "BRIDGE_ERR_TIMEOUT",
  HANDSHAKE_REQUIRED: "BRIDGE_ERR_HANDSHAKE_REQUIRED",
};

/**
 * Schema for v1 messages
 */
const V1_SCHEMA = {
  required: ["id", "type", "payload"],
  properties: {
    id: { type: "string", minLength: 1 },
    type: { type: "string", enum: Object.values(MessageType) },
    payload: { type: "object" },
    timestamp: { type: "number" },
  },
};

/**
 * Schema for v2 messages (adds correlationId, compression)
 */
const V2_SCHEMA = {
  required: ["id", "type", "payload", "version"],
  properties: {
    id: { type: "string", minLength: 1 },
    type: { type: "string", enum: Object.values(MessageType) },
    payload: { type: "object" },
    version: { type: "number", minimum: 2 },
    timestamp: { type: "number" },
    correlationId: { type: "string" },
    compression: { type: "string", enum: ["none", "gzip"] },
  },
};

class MessageValidator {
  /**
   * @param {number} maxSize - Maximum message size in bytes
   */
  constructor(maxSize = MAX_MESSAGE_SIZE) {
    this.maxSize = maxSize;
    this.handshakeComplete = false;
    this.negotiatedVersion = null;
  }

  /**
   * Validate an incoming message against the negotiated protocol version.
   * @param {object} message - Parsed JSON message
   * @returns {{ valid: boolean, error?: string, code?: string }}
   */
  validate(message) {
    // Size check
    const raw = JSON.stringify(message);
    if (Buffer.byteLength(raw, "utf8") > this.maxSize) {
      return {
        valid: false,
        error: `Message exceeds max size of ${this.maxSize} bytes`,
        code: BridgeError.MESSAGE_TOO_LARGE,
      };
    }

    // Handshake check
    if (!this.handshakeComplete && message.type !== MessageType.HANDSHAKE) {
      return {
        valid: false,
        error: "Handshake required before sending messages",
        code: BridgeError.HANDSHAKE_REQUIRED,
      };
    }

    // Version check
    const version = message.version || 1;
    if (!SUPPORTED_VERSIONS.includes(version)) {
      return {
        valid: false,
        error: `Unsupported protocol version: ${version}. Supported: ${SUPPORTED_VERSIONS.join(", ")}`,
        code: BridgeError.INVALID_VERSION,
      };
    }

    // Schema validation
    const schema = version === 2 ? V2_SCHEMA : V1_SCHEMA;
    const schemaResult = this._validateSchema(message, schema);
    if (!schemaResult.valid) {
      return schemaResult;
    }

    // Type validation
    if (!Object.values(MessageType).includes(message.type)) {
      return {
        valid: false,
        error: `Unknown message type: ${message.type}`,
        code: BridgeError.UNKNOWN_TYPE,
      };
    }

    return { valid: true };
  }

  /**
   * Handle handshake message to negotiate protocol version.
   * @param {object} handshake - Handshake message
   * @returns {{ accepted: boolean, version: number }}
   */
  negotiate(handshake) {
    const clientVersion = handshake.version || 1;
    const negotiatedVersion = Math.min(clientVersion, LATEST_VERSION);

    if (!SUPPORTED_VERSIONS.includes(negotiatedVersion)) {
      return { accepted: false, version: clientVersion };
    }

    this.handshakeComplete = true;
    this.negotiatedVersion = negotiatedVersion;

    return { accepted: true, version: negotiatedVersion };
  }

  /**
   * Get current bridge stats.
   * @returns {{ handshakeComplete: boolean, version: number|null, maxSize: number }}
   */
  getStats() {
    return {
      handshakeComplete: this.handshakeComplete,
      version: this.negotiatedVersion,
      maxSize: this.maxSize,
    };
  }

  /**
   * Reset the bridge state.
   */
  reset() {
    this.handshakeComplete = false;
    this.negotiatedVersion = null;
  }

  /**
   * Simple schema validation.
   * @private
   */
  _validateSchema(message, schema) {
    // Check required fields
    for (const field of schema.required) {
      if (!(field in message)) {
        return {
          valid: false,
          error: `Missing required field: ${field}`,
          code: BridgeError.INVALID_SCHEMA,
        };
      }
    }

    // Check property types
    for (const [field, rules] of Object.entries(schema.properties)) {
      if (!(field in message)) continue;

      const value = message[field];

      if (rules.enum && !rules.enum.includes(value)) {
        return {
          valid: false,
          error: `Invalid value for ${field}: ${value}. Expected one of: ${rules.enum.join(", ")}`,
          code: BridgeError.INVALID_SCHEMA,
        };
      }

      if (rules.type === "string" && typeof value !== "string") {
        return {
          valid: false,
          error: `Field ${field} must be a string`,
          code: BridgeError.INVALID_SCHEMA,
        };
      }

      if (rules.type === "number" && typeof value !== "number") {
        return {
          valid: false,
          error: `Field ${field} must be a number`,
          code: BridgeError.INVALID_SCHEMA,
        };
      }

      if (rules.minLength && typeof value === "string" && value.length < rules.minLength) {
        return {
          valid: false,
          error: `Field ${field} must be at least ${rules.minLength} characters`,
          code: BridgeError.INVALID_SCHEMA,
        };
      }

      if (rules.minimum !== undefined && typeof value === "number" && value < rules.minimum) {
        return {
          valid: false,
          error: `Field ${field} must be >= ${rules.minimum}`,
          code: BridgeError.INVALID_SCHEMA,
        };
      }
    }

    return { valid: true };
  }
}

// Export for both CommonJS and ES modules
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MessageValidator,
    MessageType,
    BridgeError,
    MAX_MESSAGE_SIZE,
    SUPPORTED_VERSIONS,
    LATEST_VERSION,
    V1_SCHEMA,
    V2_SCHEMA,
  };
}
