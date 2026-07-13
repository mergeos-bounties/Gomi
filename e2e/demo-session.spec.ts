import { test, expect } from 'playwright/test';

test.describe('Run demo session', () => {
  test('completes a full CEO demo run', async ({ page }) => {
    await page.goto('/');

    // Wait for the app to be ready
    const runButton = page.getByTestId('run-ceo-button');
    await expect(runButton).toBeVisible();

    // Status bar starts at "Ready"
    const statusBar = page.getByTestId('status-bar');
    await expect(statusBar).toHaveText(/Ready/);

    // Click Run CEO
    await runButton.click();

    // Status bar should change to "Agents working"
    await expect(statusBar).toHaveText(/Agents working/);

    // Wait for session to complete — status bar returns to "Ready"
    // Demo runtime uses 360ms delays, total ~5-8s
    await expect(statusBar).toHaveText(/Ready/, { timeout: 20_000 });

    // At least one chat message appeared
    const chatMessages = page.getByTestId('chat-message');
    await expect(chatMessages.first()).toBeVisible();

    // Final report section has content (not just "Waiting for report.")
    const finalReport = page.getByTestId('final-report');
    await expect(finalReport).toBeVisible();
    await expect(finalReport).not.toHaveText(/Waiting for report/);
  });
});
