import { validateMessage, createMessage, MAX_MESSAGE_SIZE, SUPPORTED_VERSIONS } from './host';

describe('HostBridge', () => {
  describe('validateMessage', () => {
    test('accepts valid v1.1 message', () => {
      const msg = createMessage('test', { foo: 'bar' });
      const result = validateMessage(msg);
      expect(result.valid).toBe(true);
    });

    test('rejects invalid version', () => {
      const msg = JSON.stringify({ version: '0.5', type: 'x', id: '1', timestamp: 1 });
      const result = validateMessage(msg);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported version');
    });

    test('rejects oversized message', () => {
      const large = 'x'.repeat(MAX_MESSAGE_SIZE + 1);
      const result = validateMessage(large);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('size limit');
    });

    test('rejects invalid JSON', () => {
      const result = validateMessage('not json');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid JSON');
    });

    test('rejects missing required fields', () => {
      const msg = JSON.stringify({ version: '1.0' });
      const result = validateMessage(msg);
      expect(result.valid).toBe(false);
    });
  });

  describe('createMessage', () => {
    test('generates valid message with defaults', () => {
      const msg = createMessage('event', { data: 42 });
      const parsed = JSON.parse(msg);
      expect(parsed.version).toBe('1.1');
      expect(parsed.type).toBe('event');
      expect(parsed.payload).toEqual({ data: 42 });
      expect(parsed.timestamp).toBeGreaterThan(0);
      expect(parsed.id).toBeTruthy();
    });

    test('accepts custom version', () => {
      const msg = createMessage('cmd', null, '1.0');
      const parsed = JSON.parse(msg);
      expect(parsed.version).toBe('1.0');
    });
  });

  test('SUPPORTED_VERSIONS includes 1.0 and 1.1', () => {
    expect(SUPPORTED_VERSIONS).toContain('1.0');
    expect(SUPPORTED_VERSIONS).toContain('1.1');
  });
});
