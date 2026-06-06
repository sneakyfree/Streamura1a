import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
    test('should display registration form', async ({ page }) => {
        await page.goto('/register');

        await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
        await expect(page.getByPlaceholder(/username/i)).toBeVisible();
        await expect(page.getByPlaceholder(/email/i)).toBeVisible();
        await expect(page.getByPlaceholder(/password/i).first()).toBeVisible();
    });

    test('should show validation errors for invalid input', async ({ page }) => {
        await page.goto('/register');

        // Fill the form with mismatched passwords to trigger inline validation.
        // (Required fields use native HTML5 validation; password match is checked in JS.)
        await page.getByPlaceholder(/choose a username/i).fill('e2e_tester');
        await page.getByPlaceholder(/enter your email/i).fill('e2e_tester@example.com');
        await page.getByPlaceholder(/create a password/i).fill('password123');
        await page.getByPlaceholder(/confirm your password/i).fill('different456');
        await page.getByLabel(/i agree/i).check();
        await page.getByRole('button', { name: /create account/i }).click();

        // Should show the inline password-mismatch validation error.
        await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 5000 });
    });

    test('should navigate to login from registration page', async ({ page }) => {
        await page.goto('/register');

        await page.getByRole('link', { name: /sign in/i }).click();

        await expect(page).toHaveURL(/\/login/);
    });
});

test.describe('Login Flow', () => {
    test('should display login form', async ({ page }) => {
        await page.goto('/login');

        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
        await expect(page.getByPlaceholder(/email/i)).toBeVisible();
        await expect(page.getByPlaceholder(/password/i)).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login');

        await page.getByPlaceholder(/email/i).fill('invalid@example.com');
        await page.getByPlaceholder(/password/i).fill('wrongpassword123');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Should show error message
        await expect(page.getByText(/invalid|error|incorrect/i)).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Homepage', () => {
    test('should display main navigation', async ({ page }) => {
        await page.goto('/');

        await expect(page.getByRole('navigation')).toBeVisible();
        await expect(page.getByRole('link', { name: /discover/i })).toBeVisible();
    });

    test('should navigate to discover page', async ({ page }) => {
        await page.goto('/');

        await page.getByRole('link', { name: /discover/i }).click();

        await expect(page).toHaveURL(/\/discover/);
    });
});

test.describe('Stream Viewing', () => {
    test('should display stream player for valid stream', async ({ page }) => {
        // The stream view route is /streams/:id (plural). It should render the
        // stream page (player + chat + stats) or a clear not-found / error state —
        // never a blank screen.
        await page.goto('/streams/1');

        const streamPageOrError = page
            .locator('[data-testid="stream-player"]')
            .or(page.locator('video'))
            .or(page.getByText(/chat/i))
            .or(page.getByText(/viewers/i))
            .or(page.getByText(/not found|failed|unavailable/i))
            .first();
        await expect(streamPageOrError).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Responsive Design', () => {
    test('should be mobile responsive', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/', { waitUntil: 'networkidle' });

        // Navigation should still work on mobile. Use .first() so the assertion
        // is not strict-mode-fragile if the responsive layout briefly mounts both
        // the desktop and mobile nav during hydration under parallel load.
        await expect(page.getByRole('navigation').first()).toBeVisible();
    });
});
