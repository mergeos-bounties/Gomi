import { describe, expect, it } from 'vitest';
import { gomiShortcutGroups } from '../src/vs/workbench/contrib/gomi/common/gomiKeyboardShortcuts';

describe('Gomi keyboard shortcut reference', () => {
  it('documents run, layout, and help shortcuts', () => {
    const shortcuts = gomiShortcutGroups.reduce<Array<{ keys: string; action: string }>>(
      (items, group) => [...items, ...group.shortcuts],
      []
    );
    expect(shortcuts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ keys: 'Ctrl/⌘ + Enter' }),
        expect.objectContaining({ keys: 'Ctrl/⌘ + 1' }),
        expect.objectContaining({ keys: 'Ctrl/⌘ + 2' }),
        expect.objectContaining({ keys: 'Ctrl/⌘ + 3' }),
        expect.objectContaining({ keys: '?' })
      ])
    );
  });

  it('keeps every visible shortcut paired with an action label', () => {
    for (const group of gomiShortcutGroups) {
      expect(group.title.length).toBeGreaterThan(0);
      for (const shortcut of group.shortcuts) {
        expect(shortcut.keys.length).toBeGreaterThan(0);
        expect(shortcut.action.length).toBeGreaterThan(0);
      }
    }
  });
});
