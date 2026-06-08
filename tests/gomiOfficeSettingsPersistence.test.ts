import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  setMemoryEmbeddingExecutionEnabled,
  setMemoryEmbeddingProvider,
  setSeatWorkMode
} from '../src/vs/workbench/contrib/gomi/common/gomiOfficeSettings';
import {
  loadPersistedOfficeSettings,
  persistOfficeSettings,
  type GomiOfficeSettingsLocalStorage
} from '../src/vs/workbench/contrib/gomi/browser/gomiOfficeSettingsPersistence';
import type { GomiWebviewStateStore } from '../src/vs/workbench/contrib/gomi/browser/gomiWebviewBridge';

describe('Gomi office settings persistence', () => {
  it('loads and saves office settings through VS Code webview state', () => {
    const stateStore = new MemoryStateStore({ keepAlive: true });
    const settings = setMemoryEmbeddingExecutionEnabled(
      setMemoryEmbeddingProvider(
        setSeatWorkMode(DEFAULT_GOMI_OFFICE_SETTINGS, 'head-backend', 'sleeping'),
        'openai-compatible'
      ),
      true
    );

    persistOfficeSettings(settings, { stateStore });

    const restoredSettings = loadPersistedOfficeSettings({ stateStore });

    expect(restoredSettings.seats.find((seat) => seat.id === 'head-backend')?.workMode).toBe('sleeping');
    expect(restoredSettings.memory.embeddingProvider).toBe('openai-compatible');
    expect(restoredSettings.memory.embeddingExecutionEnabled).toBe(true);
    expect(stateStore.state).toMatchObject({
      keepAlive: true
    });
  });

  it('falls back to browser local storage for the standalone office demo', () => {
    const localStorage = new MemoryLocalStorage();
    const settings = setSeatWorkMode(DEFAULT_GOMI_OFFICE_SETTINGS, 'head-frontend', 'sleeping');

    persistOfficeSettings(settings, { localStorage });

    const restoredSettings = loadPersistedOfficeSettings({ localStorage });

    expect(restoredSettings.seats.find((seat) => seat.id === 'head-frontend')?.workMode).toBe('sleeping');
  });

  it('normalizes corrupted persisted payloads back to safe defaults', () => {
    const localStorage = new MemoryLocalStorage();

    localStorage.setItem('gomi.office.settings.v1', '{not-json');

    expect(loadPersistedOfficeSettings({ localStorage })).toEqual(DEFAULT_GOMI_OFFICE_SETTINGS);
  });
});

class MemoryStateStore implements GomiWebviewStateStore {
  constructor(public state: unknown = {}) {}

  getState(): unknown {
    return this.state;
  }

  setState(state: unknown): void {
    this.state = state;
  }
}

class MemoryLocalStorage implements GomiOfficeSettingsLocalStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}
