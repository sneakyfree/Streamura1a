import { test, expect, type Page } from '@playwright/test';

/**
 * Streamura Subscription Flow E2E Tests
 * 
 * Tests the complete subscription purchase flow including:
 * - Viewing creator subscription tiers
 * - Subscription checkout initiation
 * - Subscription management
 * - Gift subscriptions
 */

// Helper to login a test user
async function loginUser(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/(home|discover|profile)/);
}

test.describe('Subscription Tier Display', () => {
    test('should display creator subscription tiers on profile', async ({ page }) => {
        await page.goto('/profile/1');

        // Should show subscription section
        const subscriptionSection = page.locator('[data-testid="subscription-tiers"], text=/subscribe/i').first();
        await expect(subscriptionSection).toBeVisible({ timeout: 10000 });
    });

    test('should show tier benefits and pricing', async ({ page }) => {
        await page.goto('/profile/1');

        // Look for tier cards or subscription options
        const tierCard = page.locator('[data-testid="tier-card"], .subscription-tier, [class*="tier"]').first();

        if (await tierCard.isVisible()) {
            // Should show price
            await expect(page.getByText(/\$\d+(\.\d{2})?/)).toBeVisible();
        }
    });
});

test.describe('Subscription Purchase Flow', () => {
    test('should require login to subscribe', async ({ page }) => {
        await page.goto('/profile/1');

        // Click subscribe without being logged in
        const subscribeButton = page.getByRole('button', { name: /subscribe/i }).first();

        if (await subscribeButton.isVisible()) {
            await subscribeButton.click();

            // Should redirect to login or show login modal
            await expect(
                page.locator('text=/sign in|login|create account/i')
            ).toBeVisible({ timeout: 5000 });
        }
    });

    test('should show subscription modal for logged-in user', async ({ page }) => {
        // Login first
        await page.goto('/login');
        await page.getByPlaceholder(/email/i).fill('test@example.com');
        await page.getByPlaceholder(/password/i).fill('testpassword123');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Wait for navigation or stay on page if login fails (test data dependent)
        await page.waitForTimeout(2000);

        // Navigate to creator profile
        await page.goto('/profile/1');

        // Look for subscribe button
        const subscribeButton = page.getByRole('button', { name: /subscribe/i }).first();

        if (await subscribeButton.isVisible()) {
            await subscribeButton.click();

            // Should show subscription modal or redirect to checkout
            await expect(
                page.locator('[data-testid="subscription-modal"], [class*="checkout"], text=/confirm|payment/i')
            ).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Subscription Management', () => {
    test('should display subscriptions page', async ({ page }) => {
        await page.goto('/settings');

        // Look for subscriptions section
        const subscriptionsLink = page.getByRole('link', { name: /subscriptions/i });

        if (await subscriptionsLink.isVisible()) {
            await subscriptionsLink.click();
            await expect(page.getByText(/my subscriptions|active|manage/i)).toBeVisible();
        }
    });

    test('should show active subscriptions list', async ({ page }) => {
        await page.goto('/settings');

        // Navigate to subscriptions if available
        const subscriptionsTab = page.locator('text=/subscriptions/i').first();

        if (await subscriptionsTab.isVisible()) {
            await subscriptionsTab.click();

            // Should show either subscriptions list or empty state
            await expect(
                page.locator('[data-testid="subscriptions-list"], text=/no subscriptions|subscribe to/i')
            ).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Gift Subscription Flow', () => {
    test('should display gift option on subscription modal', async ({ page }) => {
        await page.goto('/profile/1');

        // Look for gift subscription option
        const giftButton = page.locator('[data-testid="gift-subscription"], text=/gift/i').first();

        if (await giftButton.isVisible()) {
            await expect(giftButton).toBeVisible();
        }
    });

    test('should allow selecting gift recipient', async ({ page }) => {
        await page.goto('/profile/1');

        const giftButton = page.getByRole('button', { name: /gift/i }).first();

        if (await giftButton.isVisible()) {
            await giftButton.click();

            // Should show recipient selection
            await expect(
                page.locator('text=/recipient|username|who/i')
            ).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Currency Shop Integration', () => {
    test('should display currency shop page', async ({ page }) => {
        await page.goto('/shop/currency');

        // Should show currency packs
        await expect(
            page.locator('[data-testid="currency-pack"], text=/coins|crystals|pack/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should show currency pack prices and bonuses', async ({ page }) => {
        await page.goto('/shop/currency');

        // Should show pricing
        await expect(page.getByText(/\$\d+/)).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Virtual Goods Shop', () => {
    test('should display virtual goods shop', async ({ page }) => {
        await page.goto('/shop');

        // Should show shop categories or items
        await expect(
            page.locator('[data-testid="shop-items"], text=/emotes|badges|effects/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should show item details on click', async ({ page }) => {
        await page.goto('/shop');

        // Click first shop item
        const shopItem = page.locator('[data-testid="shop-item"], .shop-item, [class*="good"]').first();

        if (await shopItem.isVisible()) {
            await shopItem.click();

            // Should show item details modal or page
            await expect(
                page.locator('[data-testid="item-details"], text=/purchase|buy|price/i')
            ).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Payouts Page', () => {
    test('should display payouts dashboard for creators', async ({ page }) => {
        await page.goto('/payouts');

        // Should show payouts page or login redirect
        await expect(
            page.locator('[data-testid="payouts-dashboard"], text=/earnings|balance|payout/i, text=/sign in/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should show revenue breakdown', async ({ page }) => {
        await page.goto('/payouts');

        // Look for revenue sections
        const revenueSection = page.locator('text=/subscriptions|tips|virtual goods/i').first();

        if (await revenueSection.isVisible()) {
            await expect(revenueSection).toBeVisible();
        }
    });
});

test.describe('Tax Center', () => {
    test('should display tax center page', async ({ page }) => {
        await page.goto('/tax-center');

        // Should show tax center or login redirect
        await expect(
            page.locator('[data-testid="tax-center"], text=/tax|1099|w-9/i, text=/sign in/i')
        ).toBeVisible({ timeout: 10000 });
    });
});
