import { test, expect } from '@playwright/test';
import { loginAs } from './_helpers';

/**
 * Streamura monetization E2E: subscriptions, currency shop, virtual goods,
 * payouts and tax center. These run as a real authenticated user (seeded via
 * the API) and assert the actual UI. The previous version used invalid mixed
 * css/text locators and wrong/imaginary routes (/profile/1, /shop/currency,
 * /tax-center), so it never exercised these pages.
 */

test.describe('Subscriptions on the stream view', () => {
    test('a viewer sees a Subscribe button on a creator stream', async ({ page }) => {
        await loginAs(page, 'demo', 'demo123');
        await page.goto('/streams/1');
        // Stream 1 is owned by another creator, so the subscribe affordance shows.
        await expect(
            page.getByRole('button', { name: /subscribe/i }).first()
        ).toBeVisible({ timeout: 10000 });
    });

    test('clicking Subscribe opens the tier dialog', async ({ page }) => {
        await loginAs(page, 'demo', 'demo123');
        await page.goto('/streams/1');
        await page.getByRole('button', { name: /subscribe/i }).first().click();
        await expect(
            page.getByRole('heading', { name: /subscribe to/i })
        ).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Subscription Management', () => {
    test('settings page is reachable when authed', async ({ page }) => {
        await loginAs(page, 'demo', 'demo123');
        await page.goto('/settings');
        await expect(page).toHaveURL(/\/settings$/);
        // Should not be bounced to login.
        await expect(page.getByRole('heading', { name: /sign in/i })).toHaveCount(0);
    });
});

test.describe('Currency Shop', () => {
    test('displays the currency shop with coin packs', async ({ page }) => {
        await loginAs(page, 'demo', 'demo123');
        await page.goto('/coins');
        await expect(page.getByText(/coins|pack/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('shows coin pack prices', async ({ page }) => {
        await loginAs(page, 'demo', 'demo123');
        await page.goto('/coins');
        await expect(page.getByText(/\$\d+/).first()).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Virtual Goods Shop', () => {
    test('displays the shop with item categories', async ({ page }) => {
        await loginAs(page, 'demo', 'demo123');
        await page.goto('/shop');
        await expect(page.getByText(/badges|emotes|effects|all items/i).first()).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Payouts Page', () => {
    test('displays the payouts dashboard for an authed creator', async ({ page }) => {
        await loginAs(page, 'creator1', 'creator123');
        await page.goto('/payouts');
        await expect(page.getByText(/earnings|balance|payout/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('shows the available balance card', async ({ page }) => {
        await loginAs(page, 'creator1', 'creator123');
        await page.goto('/payouts');
        await expect(page.getByText(/available balance/i)).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Tax Center', () => {
    test('displays the tax center page', async ({ page }) => {
        await loginAs(page, 'creator1', 'creator123');
        await page.goto('/tax');
        await expect(page.getByRole('heading', { name: /tax center/i })).toBeVisible({ timeout: 10000 });
    });
});
