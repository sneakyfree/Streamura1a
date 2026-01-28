import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
    test('should display registration form', async ({ page }) => {
        await page.goto('/register');

        await expect(page.getByRole('heading', { name: /create an account/i })).toBeVisible();
        await expect(page.getByPlaceholder(/username/i)).toBeVisible();
        await expect(page.getByPlaceholder(/email/i)).toBeVisible();
        await expect(page.getByPlaceholder(/password/i).first()).toBeVisible();
    });

    test('should show validation errors for invalid input', async ({ page }) => {
        await page.goto('/register');

        // Click submit without filling form
        await page.getByRole('button', { name: /create account/i }).click();

        // Should show validation errors
        await expect(page.getByText(/email is required/i)).toBeVisible();
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
        // Note: This test requires a valid stream to exist
        await page.goto('/stream/1');

        // Should show either stream player or "not found" message
        const playerOrNotFound = await page.locator('[data-testid="stream-player"], text=/not found/i').first();
        await expect(playerOrNotFound).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Responsive Design', () => {
    test('should be mobile responsive', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // Navigation should still work on mobile
        await expect(page.getByRole('navigation')).toBeVisible();
    });
});
