import { describe, expect, it } from 'vitest';
import { exportSettingsToJson, importSettingsFromJson } from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettingsExport';
import { DEFAULT_GOMI_OFFICE_SETTINGS } from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';

describe('gomiOfficeSettingsExport', () => {
  describe('exportSettingsToJson', () => {
    it('produces valid JSON', () => {
      const json = exportSettingsToJson(DEFAULT_GOMI_OFFICE_SETTINGS);
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('includes all top-level keys', () => {
      const json = exportSettingsToJson(DEFAULT_GOMI_OFFICE_SETTINGS);
      const parsed = JSON.parse(json);
      expect(parsed).toHaveProperty('avatarStyle');
      expect(parsed).toHaveProperty('seats');
      expect(parsed).toHaveProperty('memory');
      expect(parsed).toHaveProperty('execution');
    });

    it('preserves seat data', () => {
      const json = exportSettingsToJson(DEFAULT_GOMI_OFFICE_SETTINGS);
      const parsed = JSON.parse(json);
      expect(parsed.seats).toBeInstanceOf(Array);
      expect(parsed.seats.length).toBe(DEFAULT_GOMI_OFFICE_SETTINGS.seats.length);
      expect(parsed.seats[0].id).toBe('seat-ceo');
    });
  });

  describe('importSettingsFromJson', () => {
    it('round-trips through export', () => {
      const json = exportSettingsToJson(DEFAULT_GOMI_OFFICE_SETTINGS);
      const imported = importSettingsFromJson(json);
      expect(imported.avatarStyle).toBe(DEFAULT_GOMI_OFFICE_SETTINGS.avatarStyle);
      expect(imported.seats.length).toBe(DEFAULT_GOMI_OFFICE_SETTINGS.seats.length);
      expect(imported.memory.retentionDays).toBe(DEFAULT_GOMI_OFFICE_SETTINGS.memory.retentionDays);
      expect(imported.execution.workspaceTrust).toBe(DEFAULT_GOMI_OFFICE_SETTINGS.execution.workspaceTrust);
    });

    it('rejects invalid JSON', () => {
      expect(() => importSettingsFromJson('not json')).toThrow('Invalid JSON');
    });

    it('rejects non-object JSON', () => {
      expect(() => importSettingsFromJson('"string"')).toThrow('Invalid format');
      expect(() => importSettingsFromJson('[]')).toThrow('Invalid format');
      expect(() => importSettingsFromJson('42')).toThrow('Invalid format');
    });

    it('normalizes partial settings with defaults', () => {
      const partial = JSON.stringify({ avatarStyle: 'geometric' });
      const settings = importSettingsFromJson(partial);
      expect(settings.avatarStyle).toBe('geometric');
      expect(settings.seats.length).toBe(DEFAULT_GOMI_OFFICE_SETTINGS.seats.length);
      expect(settings.memory.retrievalMode).toBe(DEFAULT_GOMI_OFFICE_SETTINGS.memory.retrievalMode);
    });

    it('normalizes invalid avatar style', () => {
      const json = JSON.stringify({ avatarStyle: 'invalid-style' });
      const settings = importSettingsFromJson(json);
      expect(settings.avatarStyle).toBe(DEFAULT_GOMI_OFFICE_SETTINGS.avatarStyle);
    });

    it('normalizes invalid memory settings', () => {
      const json = JSON.stringify({
        memory: {
          retentionDays: -1,
          broadcastThreshold: 999
        }
      });
      const settings = importSettingsFromJson(json);
      expect(settings.memory.retentionDays).toBeGreaterThanOrEqual(1);
      expect(settings.memory.retentionDays).toBeLessThanOrEqual(365);
      expect(settings.memory.broadcastThreshold).toBeGreaterThanOrEqual(0.45);
      expect(settings.memory.broadcastThreshold).toBeLessThanOrEqual(0.95);
    });
  });
});
