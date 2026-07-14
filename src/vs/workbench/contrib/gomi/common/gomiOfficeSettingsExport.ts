import { normalizeGomiOfficeSettings } from './gomiOfficeSettings';
import type { GomiOfficeSettings } from './gomiTypes';

export function exportSettingsToJson(settings: GomiOfficeSettings): string {
  return JSON.stringify(settings, null, 2);
}

export function importSettingsFromJson(json: string): GomiOfficeSettings {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON: failed to parse settings file');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid format: expected a JSON object with settings fields');
  }
  return normalizeGomiOfficeSettings(parsed);
}
