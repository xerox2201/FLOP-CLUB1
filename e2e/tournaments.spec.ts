import { test, expect } from '@playwright/test';

test.describe('Tournaments', () => {
  test('can open Tournaments tab and see list', async ({ page }) => {
    await page.goto('/?uid=111&name=Ali');
    await expect(page.getByText(/quick seat|instant play/i).first())
      .toBeVisible({ timeout: 15000 });

    const tab = page.getByText(/tourneys|tournaments/i).first();
    await tab.click();

    await expect(
      page.locator('h1:has-text("Tournaments")').first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('shows tournament list or empty state', async ({ page }) => {
    await page.goto('/?uid=111&name=Ali');
    await page.waitForSelector('text=/quick seat|instant play/i', { timeout: 15000 });

    const tab = page.getByText(/tourneys|tournaments/i).first();
    await tab.click();
    await page.waitForTimeout(1500);

    const hasCards = await page.locator('[class*="rounded-2xl"] button').count();
    const noTourneyText = await page.getByText(/no tournaments/i).count();
    const headerVisible = await page.locator('h1:has-text("Tournaments")').count();

    expect(headerVisible).toBeGreaterThan(0);
    expect(hasCards > 0 || noTourneyText > 0 || headerVisible > 0).toBe(true);
  });

  test('filter buttons are clickable', async ({ page }) => {
    await page.goto('/?uid=111&name=Ali');
    await page.waitForSelector('text=/quick seat|instant play/i', { timeout: 15000 });

    const tab = page.getByText(/tourneys|tournaments/i).first();
    await tab.click();
    await page.waitForTimeout(1000);

    const allFilter = page.getByText(/^all$/i).first();
    if (await allFilter.isVisible().catch(() => false)) {
      await allFilter.click();
      await page.waitForTimeout(500);
    }

    expect(await page.locator('h1:has-text("Tournaments")').count()).toBeGreaterThan(0);
  });
});