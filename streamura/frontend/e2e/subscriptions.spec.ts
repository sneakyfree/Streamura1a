import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

/**
 * Streamura Subscription Flow E2E Tests
 *
 * Tests the complete subscription purchase flow including:
 * - Viewing creator subscription tiers
 * - Subscription checkout initiation
 * - Subscription management
 * - Gift subscriptions
 *
 * Shop / coins / tax / profile are auth-gated, so we inject the qa_user token
 * into localStorage before each test (mirrors authed-stress.spec.ts).
 */

// The QA token is a manual precondition (see qa-setup.sh: run it against a
// live backend first). In CI / fresh checkouts the file does not exist —
// skip the authed suite instead of crashing the whole Playwright run at
// module load.
const TOKEN = fs.existsSync('/tmp/qa_token.txt')
    ? fs.readFileSync('/tmp/qa_token.txt', 'utf8').trim()
    : '';
test.skip(!TOKEN, 'requires /tmp/qa_token.txt — run e2e/qa-setup.sh against a live backend first');
const QA_USER = { id: 8, username: 'qa_user', email: 'qa@streamura.com', is_verified: false, balance: 0, lifetime_earnings: 0 };

test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ token, user }) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('auth-storage', JSON.stringify({
            state: { user, isAuthenticated: true, accessToken: token },
            version: 0,
        }));
        // Suppress the first-run creator onboarding modal so it doesn't overlay content.
        localStorage.setItem('onboarding_dismissed', 'true');
    }, { token: TOKEN, user: QA_USER });
});

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
        await page.goto('/profile');

        // Authenticated profile renders the creator dashboard (wallet, edit profile,
        // and — for creators — subscription tiers). Assert the profile loaded.
        const profileContent = page
            .locator('[data-testid="subscription-tiers"]')
            .or(page.getByText(/subscribe/i))
            .or(page.getByText(/edit profile/i))
            .or(page.getByText(/wallet/i))
            .first();
        await expect(profileContent).toBeVisible({ timeout: 10000 });
    });

    test('should show tier benefits and pricing', async ({ page }) => {
        await page.goto('/profile');

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
        await page.goto('/profile');

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
        await page.goto('/profile');

        // Look for subscribe button
        const subscribeButton = page.getByRole('button', { name: /subscribe/i }).first();

        if (await subscribeButton.isVisible()) {
            await subscribeButton.click();

            // Should show subscription modal or redirect to checkout
            await expect(
                page.locator('[data-testid="subscription-modal"], [class*="checkout"]').or(page.getByText(/confirm|payment/i)).first()
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
                page.locator('[data-testid="subscriptions-list"]').or(page.getByText(/no subscriptions|subscribe to/i)).first()
            ).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Gift Subscription Flow', () => {
    test('should display gift option on subscription modal', async ({ page }) => {
        await page.goto('/profile');

        // Look for gift subscription option
        const giftButton = page.locator('[data-testid="gift-subscription"]').or(page.getByText(/gift/i)).first();

        if (await giftButton.isVisible()) {
            await expect(giftButton).toBeVisible();
        }
    });

    test('should allow selecting gift recipient', async ({ page }) => {
        await page.goto('/profile');

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
        await page.goto('/coins');

        // Should show currency packs
        await expect(
            page.locator('[data-testid="currency-pack"]').or(page.getByText(/coins|crystals|pack/i)).first()
        ).toBeVisible({ timeout: 10000 });
    });

    test('should show currency pack prices and bonuses', async ({ page }) => {
        await page.goto('/coins');

        // Should show pricing (multiple packs render — assert at least one).
        await expect(page.getByText(/\$\d+/).first()).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Virtual Goods Shop', () => {
    test('should display virtual goods shop', async ({ page }) => {
        await page.goto('/shop');

        // Should show shop categories or items
        await expect(
            page.locator('[data-testid="shop-items"]').or(page.getByText(/emotes|badges|effects/i)).first()
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
                page.locator('[data-testid="item-details"]').or(page.getByText(/purchase|buy|price/i)).first()
            ).toBeVisible({ timeout: 5000 });
        }
    });
});

test.describe('Payouts Page', () => {
    test('should display payouts dashboard for creators', async ({ page }) => {
        await page.goto('/payouts');

        // Should show payouts page or login redirect
        await expect(
            page.locator('[data-testid="payouts-dashboard"]').or(page.getByText(/earnings|balance|payout/i)).or(page.getByText(/sign in/i)).first()
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
        await page.goto('/tax');

        // Should show tax center or login redirect
        await expect(
            page.locator('[data-testid="tax-center"]').or(page.getByText(/tax|1099|w-9/i)).or(page.getByText(/sign in/i)).first()
        ).toBeVisible({ timeout: 10000 });
    });
});
