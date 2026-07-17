import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GOMI_OFFICE_SETTINGS,
  GOMI_MAX_RECENT_PROJECTS,
  rememberRecentProject,
  removeRecentProject,
  savePromptTemplate,
  setAvatarStyle,
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
    const settings = setAvatarStyle(
      rememberRecentProject(
        setSeatWorkMode(DEFAULT_GOMI_OFFICE_SETTINGS, 'head-frontend', 'sleeping'),
        {
          name: 'Gomi IDE',
          path: '/workspaces/gomi'
        },
        '2026-07-15T09:30:00.000Z'
      ),
      'initials'
    );

    persistOfficeSettings(settings, { localStorage });

    const restoredSettings = loadPersistedOfficeSettings({ localStorage });

    expect(restoredSettings.seats.find((seat) => seat.id === 'head-frontend')?.workMode).toBe('sleeping');
    expect(restoredSettings.avatarStyle).toBe('initials');
    expect(restoredSettings.recentProjects).toEqual([
      {
        id: 'project-4a4cdx',
        name: 'Gomi IDE',
        path: '/workspaces/gomi',
        lastOpenedAt: '2026-07-15T09:30:00.000Z'
      }
    ]);
  });

  it('persists saved prompt templates across reloads', () => {
    const localStorage = new MemoryLocalStorage();
    const settings = savePromptTemplate(DEFAULT_GOMI_OFFICE_SETTINGS, {
      id: 'template-release-review',
      title: 'Release review',
      body: 'Draft a release-risk review for this workspace.',
      updatedAt: '2026-07-13T00:10:00.000Z'
    });

    persistOfficeSettings(settings, { localStorage });

    const restoredSettings = loadPersistedOfficeSettings({ localStorage });

    expect(restoredSettings.promptTemplates).toEqual([
      {
        id: 'template-release-review',
        title: 'Release review',
        body: 'Draft a release-risk review for this workspace.',
        updatedAt: '2026-07-13T00:10:00.000Z'
      }
    ]);
  });

  it('normalizes corrupted persisted payloads back to safe defaults', () => {
    const localStorage = new MemoryLocalStorage();

    localStorage.setItem('gomi.office.settings.v1', '{not-json');

    expect(loadPersistedOfficeSettings({ localStorage })).toEqual(DEFAULT_GOMI_OFFICE_SETTINGS);
  });

  it('keeps recent projects deduplicated, bounded, and removable', () => {
    let settings = DEFAULT_GOMI_OFFICE_SETTINGS;

    for (let index = 0; index < GOMI_MAX_RECENT_PROJECTS + 2; index += 1) {
      settings = rememberRecentProject(
        settings,
        {
          name: `Project ${index}`,
          path: `/workspace/project-${index}`
        },
        `2026-07-15T10:${String(index).padStart(2, '0')}:00.000Z`
      );
    }

    settings = rememberRecentProject(
      settings,
      {
        name: 'Project 3 renamed',
        path: '/workspace/project-3'
      },
      '2026-07-15T11:00:00.000Z'
    );

    expect(settings.recentProjects).toHaveLength(GOMI_MAX_RECENT_PROJECTS);
    expect(settings.recentProjects[0]).toMatchObject({
      name: 'Project 3 renamed',
      path: '/workspace/project-3',
      lastOpenedAt: '2026-07-15T11:00:00.000Z'
    });
    expect(settings.recentProjects.filter((project) => project.path === '/workspace/project-3')).toHaveLength(1);

    const withoutProject = removeRecentProject(settings, settings.recentProjects[0].id);

    expect(withoutProject.recentProjects.some((project) => project.path === '/workspace/project-3')).toBe(false);
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
