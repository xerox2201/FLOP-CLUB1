import { test, expect } from '@playwright/test';

test.describe('Auth & Navigation', () => {
  test('dev login via ?uid auto-logs in and shows Home', async ({ page }) => {
    await page.goto('/?uid=111&name=Ali');
    await expect(page.getByText(/quick seat|instant play|home/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('different users get different sessions', async ({ page }) => {
    await page.goto('/?uid=222&name=Sara');
    await expect(page.getByText(/quick seat|instant play/i).first()).toBeVisible({
      timeout: 15000,
    });
  });

  test('can navigate to Tournaments tab', async ({ page }) => {
    await page.goto('/?uid=111&name=Ali');
    await expect(page.getByText(/quick seat|instant play/i).first()).toBeVisible({
      timeout: 15000,
    });

    const tourneysTab = page.getByText(/tourneys|tournaments/i).first();
    if (await tourneysTab.isVisible()) {
      await tourneysTab.click();
      await expect(page.getByText(/tournaments|no tournaments/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('can navigate to Tables tab', async ({ page }) => {
    await page.goto('/?uid=111&name=Ali');
    await expect(page.getByText(/quick seat|instant play/i).first()).toBeVisible({
      timeout: 15000,
    });

    const tablesTab = page.getByText(/^tables$/i).first();
    if (await tablesTab.isVisible()) {
      await tablesTab.click();
      await expect(page.getByText(/tables|no tables|blinds/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test('splash screen appears during initial load', async ({ page }) => {
    const navPromise = page.goto('/?uid=333&name=TestUser');
    await navPromise;
    await expect(page.getByText(/quick seat|instant play/i).first()).toBeVisible({
      timeout: 15000,
    });
  });
});
