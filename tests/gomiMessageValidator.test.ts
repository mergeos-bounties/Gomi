/**
 * Unit tests for src/vs/workbench/contrib/gomi/common/gomiMessageValidator.ts
 *
 * Covers:
 *   - All valid message types accepted
 *   - Size limits enforced (DoS protection)
 *   - Protocol version mismatch rejected
 *   - Malformed / missing fields rejected
 *   - Path traversal in patch filePath rejected
 *   - Unknown message types rejected
 *   - Non-object / array / null input rejected
 */

import { describe, expect, it } from 'vitest';
import {
  GOMI_BRIDGE_MAX_MESSAGE_BYTES,
  GOMI_BRIDGE_PROTOCOL_VERSION,
  validateGomiBridgeMessage,
  type GomiBridgeMessage,
} from '../src/vs/workbench/contrib/gomi/common/gomiMessageValidator';

const proto = { protocolVersion: GOMI_BRIDGE_PROTOCOL_VERSION as const };

// ── helpers ────────────────────────────────────────
const validRun = (): unknown => ({
  ...proto,
  type: 'gomi.run',
  request: 'Review workspace',
});

const validStop = (): unknown => ({
  ...proto,
  type: 'gomi.stop',
  reason: 'User cancelled',
});

const validApplyPatch = (): unknown => ({
  ...proto,
  type: 'gomi.applyPatch',
  patch: {
    id: 'patch-1',
    filePath: 'src/index.ts',
    targetFiles: ['src/index.ts'],
    summary: 'Fix typo',
    diff: 'diff --git a/src/index.ts b/src/index.ts\n@@ -1 +1 @@\n-old\n+new',
    approvalStatus: 'pending',
    riskLevel: 'low',
    createdByAgentId: 'ceo',
  },
});

const validBridgeError = (): unknown => ({
  ...proto,
  type: 'gomi.bridgeError',
  code: 'invalid_message',
  message: 'Rejected invalid Gomi bridge message.',
});

const validPreviewPatchResult = (): unknown => ({
  ...proto,
  type: 'gomi.previewPatchResult',
  patchId: '550e8400-e29b-41d4-a716-446655440000',
  result: { previewedFiles: ['README.md'] },
});

const validApplyPatchResult = (): unknown => ({
  ...proto,
  type: 'gomi.applyPatchResult',
  patchId: '550e8400-e29b-41d4-a716-446655440000',
  result: { appliedFiles: ['README.md'] },
});

const validPruneMemory = (): unknown => ({
  ...proto,
  type: 'gomi.pruneMemory',
});

const validPruneMemoryResult = (): unknown => ({
  ...proto,
  type: 'gomi.pruneMemoryResult',
  report: { pruned: 42 },
});

const validEvent = (): unknown => ({
  ...proto,
  type: 'gomi.event',
  event: { type: 'session_started', sessionId: 's1' },
});

// ────────────────────────────────────────────────────
describe('validateGomiBridgeMessage', () => {
  // ── Happy path ──────────────────────────────────
  it('accepts a valid gomi.run message', () => {
    const res = validateGomiBridgeMessage(validRun());
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.message.type).toBe('gomi.run');
      expect(res.message.request).toBe('Review workspace');
    }
  });

  it('accepts gomi.run with officeSettings', () => {
    const msg = {
      ...proto,
      type: 'gomi.run',
      request: 'Run agents',
      officeSettings: {
        seats: [
          {
            id: 's1',
            agentId: 'backend',
            name: 'Backend Agent',
            role: 'Writes code',
            seatKind: 'employee',
            providerId: 'codex-cli',
            workMode: 'active',
            canSleep: true,
            canFire: true,
          },
        ],
        memory: {
          retrievalMode: 'hybrid-vector',
          embeddingProvider: 'local-hashing',
          embeddingExecutionEnabled: false,
          sharedMemoryEnabled: true,
          indexWorkspaceContext: true,
          privacyMode: 'standard',
          redactSecrets: true,
          retentionDays: 30,
          maxProjectMemoryItems: 500,
          broadcastThreshold: 0.5,
          requirePatchApproval: true,
        },
        execution: {
          workspaceTrust: 'trusted',
          liveProviderMode: 'demo-only',
          allowCliProviders: true,
          allowHttpProviders: false,
          requirePatchApprovalForLiveProviders: true,
          maxConcurrentAgentRuns: 4,
        },
      },
    };
    const res = validateGomiBridgeMessage(msg);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.message.officeSettings?.seats).toHaveLength(1);
    }
  });

  it('accepts a valid gomi.stop message', () => {
    const res = validateGomiBridgeMessage(validStop());
    expect(res.success).toBe(true);
  });

  it('accepts gomi.stop without optional reason', () => {
    const res = validateGomiBridgeMessage({ ...proto, type: 'gomi.stop' });
    expect(res.success).toBe(true);
  });

  it('accepts a valid gomi.applyPatch message', () => {
    const res = validateGomiBridgeMessage(validApplyPatch());
    expect(res.success).toBe(true);
  });

  it('accepts a valid gomi.previewPatch message', () => {
    const res = validateGomiBridgeMessage({
      ...proto,
      type: 'gomi.previewPatch',
      patch: (validApplyPatch() as Record<string, unknown>).patch,
    });
    expect(res.success).toBe(true);
  });

  it('accepts a valid gomi.previewPatchResult message', () => {
    const res = validateGomiBridgeMessage(validPreviewPatchResult());
    expect(res.success).toBe(true);
  });

  it('accepts a valid gomi.applyPatchResult message', () => {
    const res = validateGomiBridgeMessage(validApplyPatchResult());
    expect(res.success).toBe(true);
  });

  it('accepts a valid gomi.pruneMemory message', () => {
    const res = validateGomiBridgeMessage(validPruneMemory());
    expect(res.success).toBe(true);
  });

  it('accepts a valid gomi.pruneMemoryResult message', () => {
    const res = validateGomiBridgeMessage(validPruneMemoryResult());
    expect(res.success).toBe(true);
  });

  it('accepts a valid gomi.event message', () => {
    const res = validateGomiBridgeMessage(validEvent());
    expect(res.success).toBe(true);
  });

  it('accepts a valid gomi.bridgeError message', () => {
    const res = validateGomiBridgeMessage(validBridgeError());
    expect(res.success).toBe(true);
  });

  // ── Rejection: size limits ──────────────────────
  it('rejects oversized payload (>64 KB)', () => {
    const huge = {
      ...proto,
      type: 'gomi.run',
      request: 'x'.repeat(GOMI_BRIDGE_MAX_MESSAGE_BYTES),
    };
    const res = validateGomiBridgeMessage(huge);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('too large');
    }
  });

  // ── Rejection: protocol version ─────────────────
  it('rejects wrong protocol version', () => {
    const res = validateGomiBridgeMessage({
      protocolVersion: 2,
      type: 'gomi.stop',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('Unsupported protocol version');
    }
  });

  it('rejects missing protocol version', () => {
    const res = validateGomiBridgeMessage({ type: 'gomi.stop' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('protocol version');
    }
  });

  // ── Rejection: unknown / malicious types ────────
  it('rejects unknown message type', () => {
    const res = validateGomiBridgeMessage({
      ...proto,
      type: 'gomi.danger',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('Invalid message schema');
    }
  });

  it('rejects non-Gomi string type', () => {
    const res = validateGomiBridgeMessage({
      ...proto,
      type: 'workspace.event',
    });
    expect(res.success).toBe(false);
  });

  // ── Rejection: non-object input ─────────────────
  it('rejects null input', () => {
    const res = validateGomiBridgeMessage(null);
    expect(res.success).toBe(false);
  });

  it('rejects array input', () => {
    const res = validateGomiBridgeMessage([{ ...proto, type: 'gomi.stop' }]);
    expect(res.success).toBe(false);
  });

  it('rejects string input', () => {
    const res = validateGomiBridgeMessage('not a message');
    expect(res.success).toBe(false);
  });

  it('rejects number input', () => {
    const res = validateGomiBridgeMessage(42);
    expect(res.success).toBe(false);
  });

  // ── Rejection: malformed fields ─────────────────
  it('rejects gomi.run with missing request', () => {
    const res = validateGomiBridgeMessage({ ...proto, type: 'gomi.run' });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('schema');
    }
  });

  it('rejects gomi.run with oversized request text', () => {
    const res = validateGomiBridgeMessage({
      ...proto,
      type: 'gomi.run',
      request: 'x'.repeat(20_000),
    });
    expect(res.success).toBe(false);
  });

  it('rejects patch with path traversal in filePath', () => {
    const msg = validApplyPatch() as Record<string, unknown>;
    (msg.patch as Record<string, unknown>).filePath = '../secret.txt';
    const res = validateGomiBridgeMessage(msg);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toContain('relative');
    }
  });

  it('rejects patch with path traversal in targetFiles', () => {
    const msg = validApplyPatch() as Record<string, unknown>;
    (msg.patch as Record<string, unknown>).targetFiles = ['../escape.txt'];
    const res = validateGomiBridgeMessage(msg);
    expect(res.success).toBe(false);
  });

  it('rejects patch with absolute path', () => {
    const msg = validApplyPatch() as Record<string, unknown>;
    (msg.patch as Record<string, unknown>).filePath = '/etc/passwd';
    const res = validateGomiBridgeMessage(msg);
    expect(res.success).toBe(false);
  });

  it('rejects officeSettings with malformed seats', () => {
    const msg = {
      ...proto,
      type: 'gomi.run',
      request: 'Run agents',
      officeSettings: { seats: 'not-an-array', memory: {}, execution: {} },
    };
    const res = validateGomiBridgeMessage(msg);
    expect(res.success).toBe(false);
  });

  it('rejects seat with unknown agentId', () => {
    const msg = {
      ...proto,
      type: 'gomi.run',
      request: 'Run',
      officeSettings: {
        seats: [
          {
            id: 's1',
            agentId: 'hacker',
            name: 'Bad',
            role: 'x',
            seatKind: 'employee',
            providerId: 'demo-runtime',
            workMode: 'active',
            canSleep: false,
            canFire: false,
          },
        ],
        memory: {
          retrievalMode: 'hybrid-vector',
          embeddingProvider: 'local-hashing',
          embeddingExecutionEnabled: false,
          sharedMemoryEnabled: true,
          indexWorkspaceContext: true,
          privacyMode: 'standard',
          redactSecrets: true,
          retentionDays: 30,
          maxProjectMemoryItems: 500,
          broadcastThreshold: 0,
          requirePatchApproval: true,
        },
        execution: {
          workspaceTrust: 'trusted',
          liveProviderMode: 'demo-only',
          allowCliProviders: true,
          allowHttpProviders: false,
          requirePatchApprovalForLiveProviders: true,
          maxConcurrentAgentRuns: 4,
        },
      },
    };
    const res = validateGomiBridgeMessage(msg);
    expect(res.success).toBe(false);
  });

  it('rejects oversized base64 patch diff', () => {
    const msg = validApplyPatch() as Record<string, unknown>;
    (msg.patch as Record<string, unknown>).diff = 'x'.repeat(70_000);
    const res = validateGomiBridgeMessage(msg);
    expect(res.success).toBe(false);
  });

  it('rejects empty string fields where min(1) is enforced', () => {
    const msg = validApplyPatch() as Record<string, unknown>;
    (msg.patch as Record<string, unknown>).summary = '';
    const res = validateGomiBridgeMessage(msg);
    expect(res.success).toBe(false);
  });

  // ── Trust boundary: error message never leaks raw values ──
  it('does not leak raw payload values in error message', () => {
    const malicious = {
      ...proto,
      type: 'gomi.run',
      request: '',
      __secret: 'should-not-leak',
    };
    const res = validateGomiBridgeMessage(malicious);
    expect(res.success).toBe(false);
    if (!res.success) {
      // The error MAY name unrecognized keys (for debugging) but MUST NOT
      // expose their values — the string 'should-not-leak' must never
      // appear in the error.
      expect(res.error).not.toContain('should-not-leak');
    }
  });

  // ── Regression: unknown keys rejected ───────────
  it('rejects messages with extra unknown keys', () => {
    const res = validateGomiBridgeMessage({
      ...validRun(),
      injected: true,
    });
    expect(res.success).toBe(false);
  });
});

// ────────────────────────────────────────────────────
describe('GomiBridgeMessageSchema type coverage', () => {
  it('validates every defined message type at least once', () => {
    const cases: Array<{ label: string; input: unknown }> = [
      { label: 'gomi.run', input: validRun() },
      { label: 'gomi.stop', input: validStop() },
      { label: 'gomi.pruneMemory', input: validPruneMemory() },
      { label: 'gomi.pruneMemoryResult', input: validPruneMemoryResult() },
      { label: 'gomi.applyPatch', input: validApplyPatch() },
      { label: 'gomi.previewPatch', input: { ...proto, type: 'gomi.previewPatch', patch: (validApplyPatch() as Record<string, unknown>).patch } },
      { label: 'gomi.previewPatchResult', input: validPreviewPatchResult() },
      { label: 'gomi.applyPatchResult', input: validApplyPatchResult() },
      { label: 'gomi.event', input: validEvent() },
      { label: 'gomi.bridgeError', input: validBridgeError() },
    ];

    for (const { label, input } of cases) {
      const res = validateGomiBridgeMessage(input);
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.message.type).toBe(label);
      }
    }
  });
});
