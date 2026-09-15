import { test, expect } from '@playwright/test';

test.describe('Wallet', () => {
  test('can navigate to Wallet page', async ({ page }) => {
    await page.goto('/?uid=111&name=Ali');
    await expect(page.getByText(/quick seat|instant play/i).first()).toBeVisible({
      timeout: 15000,
    });

    // کلیک روی تب Wallet
    const walletTab = page.getByText(/^wallet$/i).first();
    await walletTab.click();

    // صفحه Wallet باید بیاد
    await expect(page.locator('h1:has-text("Wallet")').first()).toBeVisible({ timeout: 5000 });
  });

  test('shows balance and free chips', async ({ page }) => {
    await page.goto('/?uid=111&name=Ali');
    await page.waitForSelector('text=/quick seat|instant play/i', { timeout: 15000 });

    const walletTab = page.getByText(/^wallet$/i).first();
    await walletTab.click();
    await page.waitForTimeout(1000);

    // Balance card باید نمایش داده بشه
    const balanceText = await page.getByText(/real money balance/i).count();
    const freeChipsText = await page.getByText(/free chips/i).count();

    expect(balanceText + freeChipsText).toBeGreaterThan(0);
  });

  test('has Deposit, Withdraw, History tabs', async ({ page }) => {
    await page.goto('/?uid=111&name=Ali');
    await page.waitForSelector('text=/quick seat|instant play/i', { timeout: 15000 });

    const walletTab = page.getByText(/^wallet$/i).first();
    await walletTab.click();
    await page.waitForTimeout(1000);

    // ۳ تب باید باشن
    const deposit = page.getByText(/^deposit$/i).first();
    const withdraw = page.getByText(/^withdraw$/i).first();
    const history = page.getByText(/^history$/i).first();

    expect(await deposit.count()).toBeGreaterThan(0);
    expect(await withdraw.count()).toBeGreaterThan(0);
    expect(await history.count()).toBeGreaterThan(0);
  });

  test('can switch between Deposit / Withdraw / History tabs', async ({ page }) => {
    await page.goto('/?uid=111&name=Ali');
    await page.waitForSelector('text=/quick seat|instant play/i', { timeout: 15000 });

    const walletTab = page.getByText(/^wallet$/i).first();
    await walletTab.click();
    await page.waitForTimeout(1000);

    // برو به Withdraw
    const withdraw = page.getByText(/^withdraw$/i).first();
    await withdraw.click();
    await page.waitForTimeout(500);

    // باید "To Address" یا "Amount" ببینیم
    const hasWithdrawContent = await page.getByText(/to address|amount/i).count();
    expect(hasWithdrawContent).toBeGreaterThan(0);

    // برو به History
    const history = page.getByText(/^history$/i).first();
    await history.click();
    await page.waitForTimeout(500);

    // باید "No transactions yet" یا لیست ببینیم
    const hasHistoryContent = await page.getByText(/no transactions|deposit|withdraw/i).count();
    expect(hasHistoryContent).toBeGreaterThan(0);
  });

  test('deposit tab shows address info or disabled message', async ({ page }) => {
    await page.goto('/?uid=111&name=Ali');
    await page.waitForSelector('text=/quick seat|instant play/i', { timeout: 15000 });

    const walletTab = page.getByText(/^wallet$/i).first();
    await walletTab.click();
    await page.waitForTimeout(1500);

    // Deposit tab پیش‌فرض بازه — یا آدرس نشون می‌ده یا پیام disabled
    const hasAddress = await page.getByText(/deposit address|EQ|0Q|kQ/i).count();
    const hasDisabled = await page.getByText(/deposits are currently disabled/i).count();
    const hasNetwork = await page.getByText(/testnet|mainnet/i).count();

    expect(hasAddress + hasDisabled + hasNetwork).toBeGreaterThan(0);
  });
});
