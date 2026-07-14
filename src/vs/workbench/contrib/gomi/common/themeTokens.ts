/** Office theme tokens (issue #21) */
export interface ThemeTokens {
  '--gomi-bg': string; '--gomi-surface': string; '--gomi-text': string; '--gomi-accent': string;
  '--gomi-success': string; '--gomi-warning': string; '--gomi-error': string; '--gomi-border': string;
}
export const LIGHT_THEME: ThemeTokens = {
  '--gomi-bg': '#ffffff', '--gomi-surface': '#f5f5f5', '--gomi-text': '#1a1a1a', '--gomi-accent': '#5319E7',
  '--gomi-success': '#0E8A16', '--gomi-warning': '#D4A017', '--gomi-error': '#D73A49', '--gomi-border': '#d0d7de',
};
export const DARK_THEME: ThemeTokens = {
  '--gomi-bg': '#0b0b12', '--gomi-surface': '#1a1a2e', '--gomi-text': '#e6e6e6', '--gomi-accent': '#7C5CFC',
  '--gomi-success': '#2EA043', '--gomi-warning': '#D29922', '--gomi-error': '#F85149', '--gomi-border': '#30363d',
};
export const HIGH_CONTRAST: ThemeTokens = {
  '--gomi-bg': '#000000', '--gomi-surface': '#1a1a1a', '--gomi-text': '#ffffff', '--gomi-accent': '#FFD700',
  '--gomi-success': '#00FF00', '--gomi-warning': '#FFFF00', '--gomi-error': '#FF0000', '--gomi-border': '#ffffff',
};
export type ThemeMode = 'dark' | 'light' | 'high-contrast';
export function getThemeTokens(mode: ThemeMode): ThemeTokens {
  switch (mode) { case 'light': return LIGHT_THEME; case 'high-contrast': return HIGH_CONTRAST; default: return DARK_THEME; }
}
export function applyThemeToDocument(tokens: ThemeTokens): void {
  if (typeof document !== 'undefined') {
    for (const [key, value] of Object.entries(tokens)) { document.documentElement.style.setProperty(key, value); }
  }
}
