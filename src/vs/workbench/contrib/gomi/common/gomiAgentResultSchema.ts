/**
 * GomiAgentResultSchema — Zod-based schema for agent result validation.
 * ----------------------------------------------------------------
 * SCHEMA DOCUMENTATION (version 1):
 *
 * Every CLI/HTTP agent result MAY include a `schemaVersion` field.
 * When present and equal to 1, the result object is validated against
 * the schema below. Unknown future versions are rejected at the parser
 * level so the caller can fall back to plain-text interpretation.
 *
 * Fields (all optional for backward compatibility):
 *   schemaVersion: 1                    — Schema discriminator
 *   agentId: GomiAgentId                — Which agent produced this
 *   taskId: string                      — Associated task identifier
 *   summary: string (max 8 000 chars)   — Human-readable summary
 *   findings: string[] (max 50 items)   — Concrete observations
 *   recommendations: string[] (max 20)  — Actionable next steps
 *   proposedFiles: string[] (max 100)   — Files to create/modify
 *   confidence: number (0.0 – 1.0)      — Agent's self-assessed confidence
 *   usageEstimate: { inputTokens, outputTokens, ... }
 *
 * Size limits prevent DoS via oversized fields.
 * All string fields enforce min(1) — empty strings are rejected.
 * Unknown extra keys are rejected (strict mode).
 */

import { z } from 'zod';

// ────────────────────────────────────────────────
//  Constants
// ────────────────────────────────────────────────
export const GOMI_AGENT_RESULT_SCHEMA_VERSION = 1;
const MAX_SUMMARY_LENGTH = 8_000;
const MAX_FINDING_LENGTH = 4_000;
const MAX_RECOMMENDATION_LENGTH = 2_000;
const MAX_FINDINGS = 50;
const MAX_RECOMMENDATIONS = 20;
const MAX_PROPOSED_FILES = 100;
const MAX_FILE_PATH = 500;

const agentIdValues = [
  'ceo', 'system-analyst', 'backend', 'frontend',
  'designer', 'database', 'qa', 'devops',
] as const;

const agentIdSchema = z.enum(agentIdValues);

// ────────────────────────────────────────────────
//  Sub-schemas
// ────────────────────────────────────────────────
const usageEstimateSchema = z.object({
  providerId: agentIdSchema.optional(),
  model: z.string().min(1).max(200).optional(),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  estimatedCostUsd: z.number().min(0),
  hasEstimatedTokens: z.boolean(),
}).strict();

// ────────────────────────────────────────────────
//  Agent Result Schema v1
// ────────────────────────────────────────────────
export const GomiAgentResultSchema = z.object({
  schemaVersion: z.literal(GOMI_AGENT_RESULT_SCHEMA_VERSION).optional(),
  agentId: agentIdSchema.optional(),
  taskId: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(MAX_SUMMARY_LENGTH).optional(),
  findings: z.array(z.string().min(1).max(MAX_FINDING_LENGTH)).max(MAX_FINDINGS).optional(),
  recommendations: z.array(z.string().min(1).max(MAX_RECOMMENDATION_LENGTH)).max(MAX_RECOMMENDATIONS).optional(),
  proposedFiles: z.array(z.string().min(1).max(MAX_FILE_PATH)).max(MAX_PROPOSED_FILES).optional(),
  confidence: z.number().min(0).max(1).optional(),
  usageEstimate: usageEstimateSchema.optional(),
}).strict();

export type ValidatedAgentResult = z.infer<typeof GomiAgentResultSchema>;

// ────────────────────────────────────────────────
//  Validation helpers
// ────────────────────────────────────────────────

export interface AgentResultValidationResult {
  value?: ValidatedAgentResult;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a parsed JSON object against the agent result schema.
 *
 * @param value The parsed JSON value (from JSON.parse or equivalent)
 * @returns Structured result with validated value, errors, and warnings
 *
 * Never throws. All rejection reasons are returned as structured errors.
 */
export function validateAgentResult(value: unknown): AgentResultValidationResult {
  const result: AgentResultValidationResult = { errors: [], warnings: [] };

  // Guard: must be a plain object
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    result.errors.push('Agent result must be a JSON object, got ' + (value === null ? 'null' : typeof value));
    return result;
  }

  const rec = value as Record<string, unknown>;

  // If no schemaVersion, accept as-is (free-text fallback compatible)
  if (rec.schemaVersion === undefined) {
    // Basic sanity: warn on suspicious fields
    if (typeof rec.summary === 'string' && rec.summary.length > MAX_SUMMARY_LENGTH) {
      result.warnings.push(`summary exceeds ${MAX_SUMMARY_LENGTH} chars, will be truncated`);
    }
    result.value = value as ValidatedAgentResult;
    return result;
  }

  // Unknown schema version → reject (caller falls back to free text)
  if (rec.schemaVersion !== GOMI_AGENT_RESULT_SCHEMA_VERSION) {
    result.errors.push(
      `Unsupported agent result schemaVersion ${String(rec.schemaVersion)}. ` +
      `Expected ${GOMI_AGENT_RESULT_SCHEMA_VERSION}.`
    );
    return result;
  }

  // Schema validation
  const parsed = GomiAgentResultSchema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => {
        const path = i.path.length ? i.path.join('.') : '<root>';
        return `${path}: ${i.message}`;
      })
      .join('; ');
    result.errors.push(`Agent result schema validation failed: ${issues}`);
    return result;
  }

  result.value = parsed.data;
  return result;
}
