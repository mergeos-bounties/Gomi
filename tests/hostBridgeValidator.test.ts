import { describe, it, expect } from 'vitest';
import { validateHostBridgeMessage, createValidationErrorEvent } from '../../src/vs/platform/webview/common/hostBridgeValidator';

describe('hostBridgeValidator', () => {
  const validRunMsg = {
    version: 1,
    type: 'gomi.run',
    id: 'msg-001',
    payload: { command: 'echo', args: ['hello'] },
  };

  const validSettingsMsg = {
    version: 1,
    type: 'gomi.settings',
    id: 'msg-002',
    payload: { key: 'editor.fontSize', value: 14, scope: 'user' },
  };

  const validPatchMsg = {
    version: 1,
    type: 'gomi.patch.apply',
    id: 'msg-003',
    payload: { patch: '--- a/file\n+++ b/file', path: 'src/index.ts', requiresApproval: true },
  };

  describe('accept: valid messages', () => {
    it('accepts valid gomi.run message', () => {
      const result = validateHostBridgeMessage(validRunMsg);
      expect(result.valid).toBe(true);
      expect(result.sanitized?.type).toBe('gomi.run');
    });

    it('accepts valid gomi.settings message', () => {
      const result = validateHostBridgeMessage(validSettingsMsg);
      expect(result.valid).toBe(true);
    });

    it('accepts valid gomi.patch.apply message', () => {
      const result = validateHostBridgeMessage(validPatchMsg);
      expect(result.valid).toBe(true);
    });
  });

  describe('reject: invalid messages', () => {
    it('rejects null', () => {
      expect(validateHostBridgeMessage(null).valid).toBe(false);
    });

    it('rejects non-object', () => {
      expect(validateHostBridgeMessage('string').valid).toBe(false);
    });

    it('rejects wrong version', () => {
      expect(validateHostBridgeMessage({ ...validRunMsg, version: 99 }).valid).toBe(false);
    });

    it('rejects unknown type', () => {
      expect(validateHostBridgeMessage({ ...validRunMsg, type: 'unknown.type' }).valid).toBe(false);
    });

    it('rejects missing id', () => {
      const { id, ...noId } = validRunMsg;
      expect(validateHostBridgeMessage(noId).valid).toBe(false);
    });

    it('rejects empty id', () => {
      expect(validateHostBridgeMessage({ ...validRunMsg, id: '' }).valid).toBe(false);
    });

    it('rejects oversized payload', () => {
      const huge = { ...validRunMsg, payload: { command: 'x'.repeat(2 * 1024 * 1024) } };
      expect(validateHostBridgeMessage(huge).valid).toBe(false);
    });

    it('rejects gomi.run without command', () => {
      expect(validateHostBridgeMessage({ ...validRunMsg, payload: {} }).valid).toBe(false);
    });

    it('rejects gomi.settings without key', () => {
      expect(validateHostBridgeMessage({ ...validSettingsMsg, payload: { value: 1 } }).valid).toBe(false);
    });

    it('rejects gomi.settings with invalid scope', () => {
      expect(validateHostBridgeMessage({ ...validSettingsMsg, payload: { key: 'a', value: 1, scope: 'invalid' } }).valid).toBe(false);
    });

    it('rejects gomi.patch.apply with path traversal', () => {
      expect(validateHostBridgeMessage({ ...validPatchMsg, payload: { patch: '---', path: '../../../etc/passwd' } }).valid).toBe(false);
    });

    it('rejects gomi.patch.apply without patch string', () => {
      expect(validateHostBridgeMessage({ ...validPatchMsg, payload: { path: 'src/index.ts' } }).valid).toBe(false);
    });
  });

  describe('createValidationErrorEvent', () => {
    it('returns structured error event', () => {
      const event = createValidationErrorEvent(validRunMsg, 'Bad payload');
      expect(event.type).toBe('gomi.validation.error');
      expect(event.error).toBe('Bad payload');
      expect(event.originalId).toBe('msg-001');
    });
  });
});
