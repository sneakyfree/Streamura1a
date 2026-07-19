import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
    test('should display registration form', async ({ page }) => {
        await page.goto('/register');

        await expect(page.getByRole('heading', { name: /create (your|an) account/i })).toBeVisible();
        await expect(page.getByPlaceholder(/username/i)).toBeVisible();
        await expect(page.getByPlaceholder(/email/i)).toBeVisible();
        await expect(page.getByPlaceholder(/password/i).first()).toBeVisible();
    });

    test('should show validation error when passwords do not match', async ({ page }) => {
        await page.goto('/register');

        // Registration accepts username OR email OR phone, so fill a username and
        // mismatched passwords to trigger the form's own validation message.
        await page.getByPlaceholder(/username/i).fill('newuser123');
        await page.getByPlaceholder(/^create a password/i).fill('password123');
        await page.getByPlaceholder(/confirm/i).fill('different123');
        // The terms checkbox is required; check it so native HTML validation
        // doesn't block submission before the JS password-match check runs.
        await page.locator('#terms').check();
        await page.getByRole('button', { name: /create account/i }).click();

        await expect(page.getByText(/passwords do not match/i)).toBeVisible({ timeout: 10000 });
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

        // A failed login must surface a visible error. The backend returns
        // "Invalid email or password" (401); under heavy parallel load the
        // shared /auth/token rate limit could instead return a "too many
        // requests" message — both are valid failure feedback, so assert the
        // error banner appears rather than pinning exact wording.
        await expect(
            page.getByText(/invalid|incorrect|too many|rate limit|failed|error/i).first()
        ).toBeVisible({ timeout: 10000 });
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
    test('should display stream view for a valid stream', async ({ page }) => {
        // The stream view route is plural: /streams/:streamId. Stream 1 is seeded.
        await page.goto('/streams/1');

        // The stream's title heading should render (the seeded stream is
        // "Main Stage Coverage"). We assert a heading appears and it is NOT the
        // "Stream not found" fallback — independent of whether the LiveKit media
        // server is reachable in this environment.
        const notFound = page.getByRole('heading', { name: /stream not found/i });
        await expect(notFound).toHaveCount(0);
        await expect(
            page.getByRole('heading', { name: /main stage coverage/i })
        ).toBeVisible({ timeout: 10000 });
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
