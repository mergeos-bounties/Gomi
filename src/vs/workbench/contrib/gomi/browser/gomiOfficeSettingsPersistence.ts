import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  normalizeGomiOfficeSettings
} from '../common/gomiOfficeSettings';
import type { GomiOfficeSettings } from '../common/gomiTypes';
import type { GomiWebviewStateStore } from './gomiWebviewBridge';

export interface GomiOfficeSettingsLocalStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface GomiOfficeSettingsPersistenceOptions {
  stateStore?: GomiWebviewStateStore;
  localStorage?: GomiOfficeSettingsLocalStorage;
}

const GOMI_OFFICE_SETTINGS_STATE_KEY = 'gomi.office.settings.v1';

export function loadPersistedOfficeSettings(
  options: GomiOfficeSettingsPersistenceOptions = {}
): GomiOfficeSettings {
  const fromWebviewState = readOfficeSettingsFromState(options.stateStore?.getState());

  if (fromWebviewState) {
    return fromWebviewState;
  }

  const storage = options.localStorage ?? readBrowserLocalStorage();
  const serializedSettings = storage?.getItem(GOMI_OFFICE_SETTINGS_STATE_KEY);

  if (!serializedSettings) {
    return DEFAULT_GOMI_OFFICE_SETTINGS;
  }

  try {
    return normalizeGomiOfficeSettings(JSON.parse(serializedSettings));
  } catch {
    return DEFAULT_GOMI_OFFICE_SETTINGS;
  }
}

export function persistOfficeSettings(
  settings: GomiOfficeSettings,
  options: GomiOfficeSettingsPersistenceOptions = {}
): void {
  const normalizedSettings = normalizeGomiOfficeSettings(settings);
  const currentState = readStateRecord(options.stateStore?.getState());

  options.stateStore?.setState({
    ...currentState,
    [GOMI_OFFICE_SETTINGS_STATE_KEY]: normalizedSettings
  });

  const storage = options.localStorage ?? readBrowserLocalStorage();

  try {
    storage?.setItem(GOMI_OFFICE_SETTINGS_STATE_KEY, JSON.stringify(normalizedSettings));
  } catch {
    return;
  }
}

function readOfficeSettingsFromState(value: unknown): GomiOfficeSettings | undefined {
  const state = readStateRecord(value);
  const settings = state[GOMI_OFFICE_SETTINGS_STATE_KEY];

  return settings === undefined ? undefined : normalizeGomiOfficeSettings(settings);
}

function readStateRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function readBrowserLocalStorage(): GomiOfficeSettingsLocalStorage | undefined {
  const runtime = globalThis as typeof globalThis & {
    localStorage?: GomiOfficeSettingsLocalStorage;
  };

  return runtime.localStorage;
}
