/**
 * GomiMessageValidator — Zod-based message schema validation for the Gomi bridge.
 * -------------------------------------------------------------------------------
 * PROTOCOL NOTE (see also electron-sandbox/gomiBridge.ts):
 *   Every message crossing the webview/host privilege boundary MUST pass
 *   through `validateGomiBridgeMessage()` before dispatch or consumption.
 *
 *   Protocol version: 1 (GOMI_BRIDGE_PROTOCOL_VERSION)
 *   Max serialized size:  64 000 bytes
 *   Max text field:       16 000 characters
 *   Max error message:     2 000 characters
 *   Max patch diff:       60 000 characters
 *   Max path length:         500 characters
 *   Max array items:         100
 *
 *   All string fields enforce min(1) to reject empty values.
 *   Unknown message types are rejected at the discriminator level.
 *   New message types MUST be registered in the discriminated union below.
 *
 *   This module complements the manual validators in gomiWebviewBridge.ts.
 *   The manual validators remain the runtime guard; Zod schemas provide
 *   richer error messages and serve as the single source of truth for
 *   message shapes during development and code review.
 */

import { z } from 'zod';

// ────────────────────────────────────────────────────
//  Constants (mirrored from gomiWebviewBridge.ts)
// ────────────────────────────────────────────────────
export const GOMI_BRIDGE_PROTOCOL_VERSION = 1;
export const GOMI_BRIDGE_MAX_MESSAGE_BYTES = 64_000;

// ────────────────────────────────────────────────────
//  Enums / Literals
// ────────────────────────────────────────────────────
const agentIdSchema = z.enum([
  'ceo', 'system-analyst', 'backend', 'frontend',
  'designer', 'database', 'qa', 'devops',
]);

const agentProviderIdSchema = z.enum([
  'codex-cli', 'claude-code', 'gemini-cli', 'aider-cli',
  'cursor-style-agent', 'openai-compatible-api',
  'ollama-local-model', 'local-llm', 'demo-runtime',
]);

const seatKindSchema = z.enum(['executive', 'department-head', 'employee']);
const workModeSchema = z.enum(['active', 'sleeping', 'fired']);
const embeddingProviderSchema = z.enum([
  'local-hashing', 'openai-compatible', 'ollama-embeddings', 'ollama-embed',
]);
const privacyModeSchema = z.enum(['standard', 'strict']);
const workspaceTrustSchema = z.enum(['trusted', 'untrusted']);
const liveProviderModeSchema = z.enum(['demo-only', 'trusted-workspaces', 'allow-all']);
const patchApprovalSchema = z.enum([
  'pending', 'approved', 'rejected', 'applying', 'applied', 'failed',
]);
const patchRiskSchema = z.enum(['low', 'medium', 'high']);

// ────────────────────────────────────────────────────
//  Safe strings
// ────────────────────────────────────────────────────
const safeString = (maxLength: number) =>
  z.string().min(1).max(maxLength);

const optionalSafeString = (maxLength: number) =>
  z.string().min(1).max(maxLength).optional();

const safeRelativePath = z
  .string()
  .min(1)
  .max(500)
  .refine(
    (v) => {
      const n = v.replace(/\\/g, '/');
      if (n.startsWith('/') || n.includes('\0')) return false;
      return n.split('/').every((s) => s.length > 0 && s !== '.' && s !== '..');
    },
    { message: 'Path must be relative (no ../, no absolute, no NUL)' },
  );

// ────────────────────────────────────────────────────
//  Sub-schemas
// ────────────────────────────────────────────────────
const gomiAgentSeatSchema = z.object({
  id: safeString(128),
  agentId: agentIdSchema,
  name: safeString(128),
  role: safeString(256),
  seatKind: seatKindSchema,
  providerId: agentProviderIdSchema,
  workMode: workModeSchema,
  canSleep: z.boolean(),
  canFire: z.boolean(),
  departmentId: agentIdSchema.optional(),
}).strict();

const gomiMemorySettingsSchema = z.object({
  retrievalMode: z.literal('hybrid-vector'),
  embeddingProvider: embeddingProviderSchema,
  embeddingExecutionEnabled: z.boolean(),
  sharedMemoryEnabled: z.boolean(),
  indexWorkspaceContext: z.boolean(),
  privacyMode: privacyModeSchema,
  redactSecrets: z.boolean(),
  retentionDays: z.number().int().min(1).max(3650),
  maxProjectMemoryItems: z.number().int().min(1).max(10_000),
  broadcastThreshold: z.number().min(0).max(1),
  requirePatchApproval: z.boolean(),
}).strict();

const gomiExecutionSettingsSchema = z.object({
  workspaceTrust: workspaceTrustSchema,
  liveProviderMode: liveProviderModeSchema,
  allowCliProviders: z.boolean(),
  allowHttpProviders: z.boolean(),
  requirePatchApprovalForLiveProviders: z.boolean(),
  maxConcurrentAgentRuns: z.number().int().min(1).max(16),
}).strict();

const gomiOfficeSettingsSchema = z.object({
  seats: gomiAgentSeatSchema.array().max(64),
  memory: gomiMemorySettingsSchema,
  execution: gomiExecutionSettingsSchema,
}).strict();

const gomiPatchProposalSchema = z.object({
  id: safeString(128),
  filePath: safeRelativePath,
  targetFiles: safeRelativePath.array().max(100),
  summary: safeString(2_000),
  diff: safeString(60_000),
  approvalStatus: patchApprovalSchema,
  riskLevel: patchRiskSchema,
  createdByAgentId: agentIdSchema,
}).strict();

// ────────────────────────────────────────────────────
//  Discriminated union — every message type the bridge
//  accepts MUST be listed here.
// ────────────────────────────────────────────────────
export const GomiBridgeMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('gomi.run'),
    protocolVersion: z.literal(GOMI_BRIDGE_PROTOCOL_VERSION).optional(),
    request: safeString(16_000),
    officeSettings: gomiOfficeSettingsSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('gomi.stop'),
    protocolVersion: z.literal(GOMI_BRIDGE_PROTOCOL_VERSION).optional(),
    reason: optionalSafeString(2_000),
  }).strict(),
  z.object({
    type: z.literal('gomi.pruneMemory'),
    protocolVersion: z.literal(GOMI_BRIDGE_PROTOCOL_VERSION).optional(),
    officeSettings: gomiOfficeSettingsSchema.optional(),
  }).strict(),
  z.object({
    type: z.literal('gomi.pruneMemoryResult'),
    protocolVersion: z.literal(GOMI_BRIDGE_PROTOCOL_VERSION).optional(),
    report: z.record(z.unknown()).optional(),
    error: optionalSafeString(2_000),
  }).strict(),
  z.object({
    type: z.literal('gomi.applyPatch'),
    protocolVersion: z.literal(GOMI_BRIDGE_PROTOCOL_VERSION).optional(),
    patch: gomiPatchProposalSchema,
  }).strict(),
  z.object({
    type: z.literal('gomi.previewPatch'),
    protocolVersion: z.literal(GOMI_BRIDGE_PROTOCOL_VERSION).optional(),
    patch: gomiPatchProposalSchema,
  }).strict(),
  z.object({
    type: z.literal('gomi.previewPatchResult'),
    protocolVersion: z.literal(GOMI_BRIDGE_PROTOCOL_VERSION).optional(),
    patchId: safeString(128),
    result: z.record(z.unknown()).optional(),
    error: optionalSafeString(2_000),
  }).strict(),
  z.object({
    type: z.literal('gomi.applyPatchResult'),
    protocolVersion: z.literal(GOMI_BRIDGE_PROTOCOL_VERSION).optional(),
    patchId: safeString(128),
    result: z.record(z.unknown()).optional(),
    error: optionalSafeString(2_000),
  }).strict(),
  z.object({
    type: z.literal('gomi.event'),
    protocolVersion: z.literal(GOMI_BRIDGE_PROTOCOL_VERSION).optional(),
    event: z.record(z.unknown()),
  }).strict(),
  z.object({
    type: z.literal('gomi.bridgeError'),
    protocolVersion: z.literal(GOMI_BRIDGE_PROTOCOL_VERSION).optional(),
    code: z.literal('invalid_message'),
    message: safeString(2_000),
  }).strict(),
]);

export type GomiBridgeMessage = z.infer<typeof GomiBridgeMessageSchema>;

// ────────────────────────────────────────────────────
//  Validation result
// ────────────────────────────────────────────────────
export type GomiMessageValidationResult =
  | { success: true; message: GomiBridgeMessage }
  | { success: false; error: string };

// ────────────────────────────────────────────────────
//  Public API
// ────────────────────────────────────────────────────

/**
 * Validate a raw value against the Gomi bridge message schema.
 *
 * Checks are performed in order:
 *   1. Must be a plain object (not null, not array).
 *   2. Serialized size must be ≤ GOMI_BRIDGE_MAX_MESSAGE_BYTES.
 *   3. Must have protocolVersion === GOMI_BRIDGE_PROTOCOL_VERSION
 *      (strict — the bridge never forwards mis-versioned messages).
 *   4. Schema validation via Zod discriminated union.
 *
 * Returns a structured result: never throws.
 */
export function validateGomiBridgeMessage(
  value: unknown,
): GomiMessageValidationResult {
  // 1 – Guard: plain object
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { success: false, error: 'Message must be a plain object' };
  }

  // 2 – Size guard
  try {
    const size = new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (size > GOMI_BRIDGE_MAX_MESSAGE_BYTES) {
      return {
        success: false,
        error: `Message too large: ${size} bytes (max ${GOMI_BRIDGE_MAX_MESSAGE_BYTES})`,
      };
    }
  } catch {
    return { success: false, error: 'Cannot serialize message for size check' };
  }

  // 3 – Protocol version
  const rec = value as Record<string, unknown>;
  if (rec.protocolVersion !== GOMI_BRIDGE_PROTOCOL_VERSION) {
    return {
      success: false,
      error: `Unsupported protocol version: expected ${GOMI_BRIDGE_PROTOCOL_VERSION}, got ${String(rec.protocolVersion)}`,
    };
  }

  // 4 – Schema validation
  const result = GomiBridgeMessageSchema.safeParse(value);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => {
        const path = i.path.length ? i.path.join('.') : '<root>';
        return `${path}: ${i.message}`;
      })
      .join('; ');
    return { success: false, error: `Invalid message schema: ${issues}` };
  }

  return { success: true, message: result.data };
}
