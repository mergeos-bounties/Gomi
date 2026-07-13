import { test, expect } from 'playwright/test';

test.describe('App loads and shows critical UI', () => {
  test('displays core UI elements on startup', async ({ page }) => {
    await page.goto('/');

    // Run CEO button is visible
    const runButton = page.getByTestId('run-ceo-button');
    await expect(runButton).toBeVisible();
    await expect(runButton).toHaveText(/Run CEO/);

    // Textarea has the sample request text pre-filled
    const textarea = page.getByTestId('request-textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).not.toHaveValue('');

    // Status bar shows "Ready"
    const statusBar = page.getByTestId('status-bar');
    await expect(statusBar).toBeVisible();
    await expect(statusBar).toHaveText(/Ready/);

    // At least one agent row is visible in the right panel
    const agentRows = page.getByTestId('agent-row');
    await expect(agentRows.first()).toBeVisible();
  });
});
