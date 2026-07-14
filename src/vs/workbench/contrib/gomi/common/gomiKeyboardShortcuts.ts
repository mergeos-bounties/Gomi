export const gomiShortcutGroups = [
  {
    title: 'Run control',
    shortcuts: [
      { keys: 'Ctrl/⌘ + Enter', action: 'Run the current CEO request' },
      { keys: 'Esc', action: 'Close this shortcut reference' }
    ]
  },
  {
    title: 'Layout',
    shortcuts: [
      { keys: 'Ctrl/⌘ + 1', action: 'Toggle project sidebar' },
      { keys: 'Ctrl/⌘ + 2', action: 'Toggle chat and report panel' },
      { keys: 'Ctrl/⌘ + 3', action: 'Toggle agent panel' },
      { keys: '?', action: 'Open the shortcuts reference' }
    ]
  },
  {
    title: 'Office modes',
    shortcuts: [
      { keys: 'Alt + 1', action: 'Standard office layout' },
      { keys: 'Alt + 2', action: 'Expanded office layout' },
      { keys: 'Alt + 3', action: 'Full office layout' }
    ]
  }
] as const;
