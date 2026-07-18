import { useEffect, useState } from 'react';
import { HelpCircle, X, Keyboard } from 'lucide-react';

interface KeyboardShortcut {
  key: string;
  label: string;
  description: string;
  category: string;
}

const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: '?',
    label: 'Show/Hide Help',
    description: 'Toggle the keyboard shortcuts help overlay',
    category: 'Global'
  },
  {
    key: 'Ctrl+K Ctrl+O',
    label: 'Open Office',
    description: 'Open the Gomi Office view',
    category: 'Navigation'
  },
  {
    key: 'Ctrl+K Ctrl+R',
    label: 'Run Agent Task',
    description: 'Run a new agent task with current request',
    category: 'Actions'
  },
  {
    key: 'Ctrl+K Ctrl+S',
    label: 'Stop Agent Task',
    description: 'Stop the currently running agent task',
    category: 'Actions'
  },
  {
    key: 'Ctrl+K Ctrl+P',
    label: 'Toggle Panels',
    description: 'Toggle side panels (sidebar and right panel)',
    category: 'View'
  },
  {
    key: 'Ctrl+K Ctrl+B',
    label: 'Toggle Bottom Panel',
    description: 'Toggle the bottom panel',
    category: 'View'
  },
  {
    key: 'Ctrl+K Ctrl+M',
    label: 'Toggle Office Mode',
    description: 'Cycle through office view modes (standard, expanded, full-office)',
    category: 'View'
  },
  {
    key: 'Escape',
    label: 'Close Overlay',
    description: 'Close the help overlay or any open dialog',
    category: 'Global'
  }
];

interface GomiKeyboardShortcutsProps {
  onClose: () => void;
}

export function GomiKeyboardShortcuts({ onClose }: GomiKeyboardShortcutsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <div className="gomi-keyboard-shortcuts-overlay" role="dialog" aria-label="Keyboard Shortcuts Help">
      <div className="gomi-keyboard-shortcuts-content">
        <div className="gomi-keyboard-shortcuts-header">
          <div className="gomi-keyboard-shortcuts-header-icon">
            <Keyboard size={20} />
            <span>Keyboard Shortcuts</span>
          </div>
          <button
            className="gomi-keyboard-shortcuts-close-button"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            <X size={16} />
          </button>
        </div>

        <div className="gomi-keyboard-shortcuts-search">
          <HelpCircle size={16} />
          <span>Press ? to toggle this help overlay</span>
        </div>

        <div className="gomi-keyboard-shortcuts-categories">
          {Array.from(new Set(KEYBOARD_SHORTCUTS.map(s => s.category))).map(category => (
            <div key={category} className="gomi-keyboard-shortcuts-category">
              <h3>{category}</h3>
              <table>
                <tbody>
                  {KEYBOARD_SHORTCUTS
                    .filter(s => s.category === category)
                    .map((shortcut, index) => (
                      <tr key={index}>
                        <td className="gomi-keyboard-shortcuts-key-cell">
                          <kbd>{shortcut.key}</kbd>
                        </td>
                        <td className="gomi-keyboard-shortcuts-label-cell">
                          {shortcut.label}
                        </td>
                        <td className="gomi-keyboard-shortcuts-description-cell">
                          {shortcut.description}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        <div className="gomi-keyboard-shortcuts-footer">
          <p>Tip: Use Ctrl+K followed by another key for many commands</p>
        </div>
      </div>
    </div>
  );
}
