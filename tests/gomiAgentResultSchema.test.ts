/**
 * Unit tests for agent result schema validation (issue #44).
 * Covers: Zod schema validation, size limits, truncated recovery,
 * backward compatibility, garbage input safety.
 */

import { describe, expect, it } from 'vitest';
import { validateAgentResult } from '../src/vs/workbench/contrib/gomi/common/gomiAgentResultSchema';
import { parseAgentResultJson, parseAgentResultJsonWithDiagnostics } from '../src/vs/workbench/contrib/gomi/node/agentOutputParsing';

const toJson = (obj: unknown) => JSON.stringify(obj);

// ────────────────────────────────────────────────
describe('GomiAgentResultSchema', () => {
  describe('validateAgentResult', () => {
    it('accepts a valid v1 result', () => {
      const r = validateAgentResult({
        schemaVersion: 1,
        agentId: 'backend',
        taskId: 'task-1',
        summary: 'Login path reviewed.',
        findings: ['Controller requires patch approval.'],
        recommendations: ['Open diff preview.'],
        proposedFiles: ['src/api/login.ts'],
        confidence: 0.86,
      });
      expect(r.errors).toEqual([]);
      expect(r.value?.summary).toBe('Login path reviewed.');
      expect(r.value?.confidence).toBe(0.86);
    });

    it('accepts minimal result (no schemaVersion, backward compat)', () => {
      const r = validateAgentResult({
        summary: 'Just a summary.',
        findings: ['Finding 1'],
      });
      expect(r.errors).toEqual([]);
      expect(r.value?.summary).toBe('Just a summary.');
    });

    it('rejects unsupported schemaVersion', () => {
      const r = validateAgentResult({
        schemaVersion: 99,
        summary: 'Future version.',
      });
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]).toContain('Unsupported agent result schemaVersion');
    });

    it('rejects non-object input', () => {
      expect(validateAgentResult(null).errors).toHaveLength(1);
      expect(validateAgentResult([]).errors).toHaveLength(1);
      expect(validateAgentResult('string').errors).toHaveLength(1);
      expect(validateAgentResult(42).errors).toHaveLength(1);
    });

    it('rejects oversized summary (>8 000 chars)', () => {
      const r = validateAgentResult({
        schemaVersion: 1,
        summary: 'x'.repeat(9_000),
      });
      expect(r.errors).toHaveLength(1);
    });

    it('rejects confidence outside 0-1 range', () => {
      const r = validateAgentResult({
        schemaVersion: 1,
        confidence: 1.5,
      });
      expect(r.errors).toHaveLength(1);
    });

    it('rejects empty string fields', () => {
      const r = validateAgentResult({
        schemaVersion: 1,
        summary: '',
        agentId: 'backend',
      });
      expect(r.errors).toHaveLength(1);
    });

    it('rejects unknown agentId', () => {
      const r = validateAgentResult({
        schemaVersion: 1,
        agentId: 'hacker',
      });
      expect(r.errors).toHaveLength(1);
    });

    it('rejects extra unknown keys', () => {
      const r = validateAgentResult({
        schemaVersion: 1,
        __malicious: true,
      });
      expect(r.errors).toHaveLength(1);
    });

    it('rejects oversized arrays', () => {
      const r = validateAgentResult({
        schemaVersion: 1,
        findings: Array.from({ length: 100 }, (_, i) => `finding-${i}`),
      });
      expect(r.errors).toHaveLength(1);
    });

    it('warns on oversized summary without schemaVersion', () => {
      const r = validateAgentResult({
        summary: 'x'.repeat(9_000),
      });
      expect(r.errors).toEqual([]);
      expect(r.warnings.length).toBeGreaterThan(0);
      expect(r.warnings[0]).toContain('truncated');
    });

    it('accepts result with usageEstimate', () => {
      const r = validateAgentResult({
        schemaVersion: 1,
        summary: 'Done.',
        usageEstimate: {
          inputTokens: 100,
          outputTokens: 50,
          totalTokens: 150,
          estimatedCostUsd: 0.001,
          hasEstimatedTokens: true,
        },
      });
      expect(r.errors).toEqual([]);
      expect(r.value?.usageEstimate?.totalTokens).toBe(150);
    });
  });
});

// ────────────────────────────────────────────────
describe('agent output parsing (extended)', () => {
  describe('backward compatibility', () => {
    it('accepts the versioned agent result schema', () => {
      const parsed = parseAgentResultJson(toJson({
        schemaVersion: 1,
        summary: 'Backend agent reviewed the login path.',
        findings: ['The controller still requires patch approval.'],
        recommendations: ['Open the native diff preview before applying changes.'],
        proposedFiles: ['src/api/login.ts'],
        confidence: 0.86,
      }));
      expect(parsed).toMatchObject({
        schemaVersion: 1,
        summary: 'Backend agent reviewed the login path.',
        confidence: 0.86,
      });
    });

    it('accepts result without schemaVersion (free-text fallback)', () => {
      const parsed = parseAgentResultJson(toJson({
        summary: 'Plain result without version.',
        findings: ['Works.'],
      }));
      expect(parsed).toMatchObject({
        summary: 'Plain result without version.',
      });
    });

    it('rejects unsupported schema versions', () => {
      const result = parseAgentResultJsonWithDiagnostics(toJson({
        schemaVersion: 99,
        summary: 'Future schema payload.',
      }));
      expect(result.value).toBeUndefined();
      expect(result.diagnostics[0]).toContain('Unsupported agent result schemaVersion 99');
    });

    it('recovers truncated JSON objects', () => {
      const parsed = parseAgentResultJson([
        'Model response:',
        '```json',
        '{"schemaVersion":1,"summary":"Partial run","findings":["Recovered finding"],"recommendations":["Review recovered fields"],"proposedFiles":["src/api/login.ts"],"confidence":0.73',
      ].join('\n'));
      expect(parsed).toMatchObject({
        schemaVersion: 1,
        summary: 'Partial run',
        confidence: 0.73,
      });
    });

    it('returns undefined for plain text without JSON', () => {
      expect(parseAgentResultJson('plain model text without JSON')).toBeUndefined();
    });

    it('returns undefined for garbage truncated JSON', () => {
      expect(parseAgentResultJson('{"schemaVersion":1,"summary":')).toBeUndefined();
    });
  });

  describe('robustness', () => {
    it('handles empty input gracefully', () => {
      const result = parseAgentResultJsonWithDiagnostics('');
      expect(result.value).toBeUndefined();
      expect(result.diagnostics[0]).toContain('empty');
    });

    it('handles whitespace-only input', () => {
      const result = parseAgentResultJsonWithDiagnostics('   \n  ');
      expect(result.value).toBeUndefined();
    });

    it('handles nested JSON objects in text', () => {
      const text = 'Here is the result {"summary":"First"} and another {"summary":"Second"}';
      const parsed = parseAgentResultJson(text);
      // Should pick the last valid object
      expect(parsed?.summary).toBe('Second');
    });

    it('does not crash on malformed Unicode', () => {
      const result = parseAgentResultJsonWithDiagnostics('{"summary":"\uD800"}');
      // May fail to parse, but must not throw
      expect(result).toBeDefined();
    });

    it('rejects result with invalid agentId via schema validation', () => {
      const result = parseAgentResultJsonWithDiagnostics(toJson({
        schemaVersion: 1,
        agentId: 'attacker',
        summary: 'Test',
      }));
      expect(result.value).toBeUndefined();
      expect(result.diagnostics.length).toBeGreaterThan(0);
    });

    it('rejects result with confidence out of range', () => {
      const result = parseAgentResultJsonWithDiagnostics(toJson({
        schemaVersion: 1,
        confidence: 2.0,
        summary: 'Bad confidence',
      }));
      expect(result.value).toBeUndefined();
      expect(result.diagnostics[0]).toContain('schema validation failed');
    });

    it('truncated recovery still validates via schema', () => {
      const truncated = '{"schemaVersion":1,"summary":"Good","findings":["f1","f2"],"confidence":0.5';
      const parsed = parseAgentResultJson(truncated);
      expect(parsed).toMatchObject({
        schemaVersion: 1,
        summary: 'Good',
        confidence: 0.5,
      });
    });
  });
});
