/**
 * GomiCodeOssIntegrationSchema — Zod validator for build/gomi-code-oss.integration.json
 * -------------------------------------------------------------------------------
 * SCHEMA DOCUMENTATION:
 *
 * The integration manifest defines how Gomi's source files, branding assets,
 * and templates are overlaid onto a Code - OSS fork. This validator ensures
 * the manifest is structurally valid before CI or release tooling consumes it.
 *
 * Required sections:
 *   productJson   — Product metadata merge instructions (source, target, mode)
 *   moduleCopies  — Gomi workbench module source → target copy pairs
 *   webviewAssetCopies — Office webview bundle copy paths
 *
 * To extend the manifest: add new keys to the Zod schema below, then add
 * corresponding test fixtures in tests/gomiCodeOssIntegrationSchema.test.ts.
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';

// ────────────────────────────────────────────────
//  Schemas
// ────────────────────────────────────────────────

const productJsonSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  mode: z.enum(['merge', 'replace']),
  removeKeys: z.array(z.string()).optional(),
}).strict();

const copyPairSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
}).strict();

export const GomiCodeOssIntegrationSchema = z.object({
  schemaVersion: z.literal(1),
  productName: z.string().min(1),
  description: z.string().min(1).optional(),
  productJson: productJsonSchema,
  moduleCopies: z.array(copyPairSchema).min(1),
  templateCopies: z.array(copyPairSchema).optional(),
  webviewAssetCopies: z.array(copyPairSchema).min(1),
  resourceCopies: z.array(copyPairSchema).optional(),
  brandingAssets: z.record(z.string()).optional(),
  contributionTemplate: z.object({
    workbenchContribution: z.string().min(1),
  }).strict().optional(),
}).strict();

export type GomiCodeOssIntegration = z.infer<typeof GomiCodeOssIntegrationSchema>;

// ────────────────────────────────────────────────
//  Validation result
// ────────────────────────────────────────────────

export interface IntegrationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ────────────────────────────────────────────────
//  Public API
// ────────────────────────────────────────────────

/**
 * Validate a parsed integration manifest object.
 * Never throws — all errors returned as structured result.
 */
export function validateIntegrationManifest(
  data: unknown
): IntegrationValidationResult {
  const result = parseResult(GomiCodeOssIntegrationSchema.safeParse(data));
  return { valid: result.errors.length === 0, errors: result.errors, warnings: [] };
}

/**
 * Validate an integration manifest from a JSON file path.
 */
export function validateIntegrationManifestFile(
  filePath: string
): IntegrationValidationResult {
  try {
    const raw = readFileSync(filePath, { encoding: 'utf8' });
    const data = JSON.parse(raw);
    return validateIntegrationManifest(data);
  } catch (err) {
    return {
      valid: false,
      errors: [(err as Error).message],
      warnings: [],
    };
  }
}

function parseResult(
  result: ReturnType<typeof GomiCodeOssIntegrationSchema.safeParse>
): { errors: string[] } {
  if (result.success) return { errors: [] };
  const errors = result.error.issues.map(
    (i) => `${i.path.join('.') || '<root>'}: ${i.message}`
  );
  return { errors };
}
