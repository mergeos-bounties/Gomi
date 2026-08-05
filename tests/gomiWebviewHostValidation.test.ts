import { describe, expect, it } from 'vitest';
import type { GomiBridgeMessage } from '../src/vs/workbench/contrib/gomi/electron-sandbox/gomiBridge';
import {
  createDetailedGomiBridgeError,
  validateGomiBridgeMessage,
  validateProtocolVersion,
  type GomiBridgeVersionRange
} from '../src/vs/workbench/contrib/gomi/browser/gomiWebviewHostValidation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validMessage(overrides: Partial<GomiBridgeMessage> = {}): GomiBridgeMessage {
  return {
    protocolVersion: 1,
    type: 'gomi.stop',
    ...overrides
  } as GomiBridgeMessage;
}

function makeGomiRunMessage(text = 'hello'): GomiBridgeMessage {
  return {
    protocolVersion: 1,
    type: 'gomi.run',
    request: text
  } as GomiBridgeMessage;
}

// ---------------------------------------------------------------------------
// validateProtocolVersion
// ---------------------------------------------------------------------------

describe('validateProtocolVersion', () => {
  const range: GomiBridgeVersionRange = { min: 1, max: 3 };

  it('accepts version within range', () => {
    expect(validateProtocolVersion({ protocolVersion: 2 }, range)).toEqual({
      valid: true
    });
  });

  it('accepts version at lower bound', () => {
    expect(validateProtocolVersion({ protocolVersion: 1 }, range).valid).toBe(true);
  });

  it('accepts version at upper bound', () => {
    expect(validateProtocolVersion({ protocolVersion: 3 }, range).valid).toBe(true);
  });

  it('rejects version below range', () => {
    const result = validateProtocolVersion({ protocolVersion: 0 }, range);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('0');
    expect(result.reason).toContain('not supported');
  });

  it('rejects version above range', () => {
    const result = validateProtocolVersion({ protocolVersion: 99 }, range);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('99');
  });

  it('rejects missing protocolVersion', () => {
    const result = validateProtocolVersion({ type: 'gomi.stop' }, range);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Missing');
  });

  it('rejects null protocolVersion', () => {
    const result = validateProtocolVersion({ protocolVersion: null }, range);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Missing');
  });

  it('rejects non-integer protocolVersion', () => {
    const result = validateProtocolVersion({ protocolVersion: 1.5 }, range);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('integer');
  });

  it('rejects string protocolVersion', () => {
    const result = validateProtocolVersion({ protocolVersion: '1' }, range);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('integer');
  });
});

// ---------------------------------------------------------------------------
// validateGomiBridgeMessage
// ---------------------------------------------------------------------------

describe('validateGomiBridgeMessage', () => {
  // --- Non-object rejection -----------------------------------------------

  it('rejects null', () => {
    const result = validateGomiBridgeMessage(null);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not a plain object');
  });

  it('rejects undefined', () => {
    const result = validateGomiBridgeMessage(undefined);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not a plain object');
  });

  it('rejects arrays', () => {
    const result = validateGomiBridgeMessage([1, 2, 3]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not a plain object');
  });

  it('rejects strings', () => {
    const result = validateGomiBridgeMessage('hello');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('not a plain object');
  });

  // --- Size guard ---------------------------------------------------------

  it('rejects oversized message', () => {
    const huge = validMessage({ type: 'gomi.run', request: 'x'.repeat(70_000) } as any);
    const result = validateGomiBridgeMessage(huge);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('exceeds limit');
  });

  it('accepts message at size boundary (under 64 KB)', () => {
    const msg = makeGomiRunMessage('a'.repeat(15_900));
    const result = validateGomiBridgeMessage(msg);
    // The string is within the 16K field limit, so schema validation passes
    expect(result.valid).toBe(true);
  });

  // --- Protocol version ---------------------------------------------------

  it('rejects message without protocolVersion', () => {
    const result = validateGomiBridgeMessage({ type: 'gomi.stop' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Missing');
  });

  // --- Schema validation for known types ----------------------------------

  it('accepts valid gomi.run message', () => {
    const result = validateGomiBridgeMessage(makeGomiRunMessage('build the thing'));
    expect(result.valid).toBe(true);
  });

  it('accepts valid gomi.stop message', () => {
    const result = validateGomiBridgeMessage(validMessage({ type: 'gomi.stop', reason: 'done' }));
    expect(result.valid).toBe(true);
  });

  it('rejects gomi.run without required "request" field', () => {
    const msg = { protocolVersion: 1, type: 'gomi.run' };
    const result = validateGomiBridgeMessage(msg);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Schema validation failed');
    expect(result.reason).toContain('gomi.run');
  });

  it('rejects gomi.run with oversized request string', () => {
    const msg = {
      protocolVersion: 1,
      type: 'gomi.run',
      request: 'x'.repeat(20_000)
    };
    const result = validateGomiBridgeMessage(msg);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Schema validation failed');
  });

  it('rejects unknown message type', () => {
    const msg = { protocolVersion: 1, type: 'gomi.stealCookies' };
    const result = validateGomiBridgeMessage(msg);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Schema validation failed');
  });

  it('rejects message missing type field entirely', () => {
    const msg = { protocolVersion: 1, foo: 'bar' };
    const result = validateGomiBridgeMessage(msg);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('missing a recognised');
  });

  it('accepts valid gomi.applyPatch message', () => {
    const msg: GomiBridgeMessage = {
      protocolVersion: 1,
      type: 'gomi.applyPatch',
      patch: {
        id: 'patch-1',
        filePath: 'src/app.ts',
        targetFiles: ['src/app.ts'],
        summary: 'Fix typo',
        diff: '-old\n+new',
        approvalStatus: 'pending',
        riskLevel: 'low',
        createdByAgentId: 'qa'
      }
    };
    const result = validateGomiBridgeMessage(msg);
    expect(result.valid).toBe(true);
  });

  it('rejects gomi.applyPatch with missing patch fields', () => {
    const msg = {
      protocolVersion: 1,
      type: 'gomi.applyPatch',
      patch: { id: 'p1' }
    };
    const result = validateGomiBridgeMessage(msg);
    expect(result.valid).toBe(false);
  });

  // --- Protocol version range negotiation ---------------------------------

  it('rejects a v2 message when host only accepts v1', () => {
    const result = validateGomiBridgeMessage(
      { protocolVersion: 2, type: 'gomi.stop' },
      { min: 1, max: 1 }
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Protocol version 2');
  });
});

// ---------------------------------------------------------------------------
// createDetailedGomiBridgeError
// ---------------------------------------------------------------------------

describe('createDetailedGomiBridgeError', () => {
  it('produces a valid gomi.bridgeError message', () => {
    const msg = createDetailedGomiBridgeError('Something went wrong.');
    expect(msg.type).toBe('gomi.bridgeError');
    expect(msg.code).toBe('invalid_message');
    expect(msg.message).toBe('Something went wrong.');
  });

  it('truncates overly long reasons to 2000 chars', () => {
    const long = 'x'.repeat(3000);
    const msg = createDetailedGomiBridgeError(long);
    expect(msg.message.length).toBeLessThanOrEqual(2000);
    expect(msg.message.endsWith('...')).toBe(true);
  });
});
