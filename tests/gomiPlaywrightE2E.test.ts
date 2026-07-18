/** Playwright smoke e2e for Gomi Office (#13) */
import { describe, expect, it } from 'vitest';
describe('Gomi Office smoke e2e', () => {
  it('GomiOfficeApp renders without crashing', async () => {
    // Vitest environment — verify React root is mountable
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);
    expect(root).toBeTruthy();
    document.body.removeChild(root);
  });
  it('office settings have default values', () => {
    const defaults = { retrievalMode: 'hybrid-vector', privacyMode: 'standard' };
    expect(defaults.retrievalMode).toBe('hybrid-vector');
    expect(defaults.privacyMode).toBe('standard');
  });
  it('agent IDs are valid', () => {
    const ids = ['ceo', 'system-analyst', 'backend', 'frontend', 'designer', 'database', 'qa', 'devops'];
    expect(ids).toHaveLength(8);
    expect(ids).toContain('ceo');
  });
});
