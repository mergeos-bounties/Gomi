import { useEffect, useState, useCallback } from 'react';

interface Shortcut {
  keys: string;
  description: string;
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { keys: '?', description: 'Toggle help overlay' },
  { keys: 'Ctrl+E', description: 'Open terminal' },
  { keys: 'Ctrl+P', description: 'Quick open file' },
  { keys: 'Ctrl+Shift+P', description: 'Command palette' },
  { keys: 'Ctrl+B', description: 'Toggle sidebar' },
  { keys: 'Ctrl+`', description: 'Toggle terminal panel' },
  { keys: 'Ctrl+K', description: 'Open keyboard shortcuts' },
  { keys: 'Escape', description: 'Close current dialog' },
];

interface HelpOverlayProps {
  shortcuts?: Shortcut[];
  onVisibilityChange?: (visible: boolean) => void;
}

export function HelpOverlay({ shortcuts = DEFAULT_SHORTCUTS, onVisibilityChange }: HelpOverlayProps) {
  const [visible, setVisible] = useState(false);

  const toggle = useCallback(() => {
    setVisible((prev) => {
      const next = !prev;
      onVisibilityChange?.(next);
      return next;
    });
  }, [onVisibilityChange]);

  const close = useCallback(() => {
    setVisible(false);
    onVisibilityChange?.(false);
  }, [onVisibilityChange]);

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      // Ignore key events inside input/textarea/contentEditable
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (event.key === '?' && !event.shiftKey) {
        event.preventDefault();
        toggle();
      }

      if (event.key === 'Escape' && visible) {
        close();
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [visible, toggle, close]);

  if (!visible) return null;

  return (
    <div
      className="help-overlay-backdrop"
      onClick={(e) => {
        if ((e.target as HTMLElement).className === 'help-overlay-backdrop') {
          close();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts help"
    >
      <div className="help-overlay-card">
        <div className="help-overlay-header">
          <h2>Keyboard Shortcuts</h2>
          <button
            className="help-overlay-close"
            onClick={close}
            aria-label="Close"
            type="button"
          >
            ✕
          </button>
        </div>
        <div className="help-overlay-body">
          <table>
            <thead>
              <tr>
                <th>Shortcut</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {shortcuts.map((s, i) => (
                <tr key={i}>
                  <td><kbd>{s.keys}</kbd></td>
                  <td>{s.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="help-overlay-hint">
            Press <kbd>?</kbd> or <kbd>Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
}
