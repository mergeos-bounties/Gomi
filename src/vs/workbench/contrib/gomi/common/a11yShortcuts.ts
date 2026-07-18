/** Keyboard shortcuts + a11y support (#15) */
export interface KeyboardShortcut { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; description: string; action: string }
export const SHORTCUTS: KeyboardShortcut[] = [
  { key: 'Escape', description: 'Dismiss modal/panel', action: 'dismiss' },
  { key: '?', description: 'Show keyboard shortcuts', action: 'help' },
  { key: 'Enter', description: 'Confirm/Submit', action: 'confirm' },
  { key: 'Tab', description: 'Next focusable element', action: 'focus_next' },
  { key: 'r', ctrl: true, description: 'Run CEO agent', action: 'run' },
  { key: 's', ctrl: true, description: 'Open settings', action: 'settings' },
];
export function matchShortcut(e: KeyboardEvent): KeyboardShortcut | undefined {
  return SHORTCUTS.find(s => e.key === s.key && !!s.ctrl === e.ctrlKey && !!s.shift === e.shiftKey && !!s.alt === e.altKey);
}
export function getShortcutHelpText(): string {
  return SHORTCUTS.map(s => `${s.ctrl ? 'Ctrl+' : ''}${s.shift ? 'Shift+' : ''}${s.alt ? 'Alt+' : ''}${s.key} — ${s.description}`).join('\n');
}
