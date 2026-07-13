import { test, expect } from 'playwright/test';

test.describe('Layout mode toggle', () => {
  test('toggles full office layout class on and off', async ({ page }) => {
    await page.goto('/');

    const shell = page.getByTestId('gomi-shell');
    await expect(shell).toBeVisible();

    // Shell should not have full-office class initially (standard mode)
    await expect(shell).not.toHaveClass(/is-full-office/);

    // Click "Full office layout" button
    const layoutGroup = page.getByTestId('layout-mode-group');
    const fullOfficeButton = layoutGroup.getByRole('button', { name: 'Full office layout' });
    await fullOfficeButton.click();

    // Shell gains the is-full-office class
    await expect(shell).toHaveClass(/is-full-office/);

    // Click "Standard office layout" to revert
    const standardButton = layoutGroup.getByRole('button', { name: 'Standard office layout' });
    await standardButton.click();

    // Class removed
    await expect(shell).not.toHaveClass(/is-full-office/);
  });
});
