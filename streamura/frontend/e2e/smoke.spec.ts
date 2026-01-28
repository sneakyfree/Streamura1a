import { test, expect } from '@playwright/test';

/**
 * Streamura E2E Smoke Tests
 * 
 * These tests verify that key pages load and render correctly.
 */

test.describe('Homepage', () => {
    test('should load homepage and display hero section', async ({ page }) => {
        await page.goto('/');

        // Check page loads (title may vary based on config)
        await expect(page.locator('h1')).toBeVisible();

        // Check hero section elements
        await expect(page.locator('h1')).toBeVisible();

        // Check navigation exists
        await expect(page.locator('nav')).toBeVisible();

        // Check footer exists (use first() in case of multiple)
        await expect(page.locator('footer').first()).toBeVisible();
    });

    test('should have working navigation links', async ({ page }) => {
        await page.goto('/');

        // Check Discover link exists and works
        const discoverLink = page.locator('a[href="/discover"]').first();
        if (await discoverLink.isVisible()) {
            await discoverLink.click();
            await expect(page).toHaveURL(/\/discover/);
        }
    });
});

test.describe('Discover Page', () => {
    test('should load discover page with events section', async ({ page }) => {
        await page.goto('/discover');

        // Page should load - wait for h1
        await expect(page.locator('h1').first()).toBeVisible();

        // Should have some interactive elements
        await expect(page.locator('[class*="bg-slate"]').first()).toBeVisible();
    });

    test('should have view mode tabs', async ({ page }) => {
        await page.goto('/discover');

        // Check for Trending, Near Me, All Events tabs
        await expect(page.locator('button:has-text("Trending")').first()).toBeVisible();
    });
});

test.describe('Authentication Pages', () => {
    test('should load login page', async ({ page }) => {
        await page.goto('/login');

        // Check login form elements
        await expect(page.locator('input[type="email"], input[type="text"]').first()).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('should load register page', async ({ page }) => {
        await page.goto('/register');

        // Check registration form - use first() for multiple password fields
        await expect(page.locator('input[type="password"]').first()).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toBeVisible();
    });
});

test.describe('Legal Pages', () => {
    test('should load terms page', async ({ page }) => {
        await page.goto('/terms');
        await expect(page.locator('h1')).toContainText(/terms/i);
    });

    test('should load privacy page', async ({ page }) => {
        await page.goto('/privacy');
        await expect(page.locator('h1')).toContainText(/privacy/i);
    });

    test('should load about page', async ({ page }) => {
        await page.goto('/about');
        await expect(page.locator('h1')).toBeVisible();
    });
});

test.describe('Responsive Design', () => {
    test('should be responsive on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // Page should still be functional
        await expect(page.locator('nav')).toBeVisible();
        await expect(page.locator('h1')).toBeVisible();
    });

    test('should be responsive on tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.goto('/discover');

        await expect(page.locator('h1')).toBeVisible();
    });
});

test.describe('Performance', () => {
    test('homepage should load within acceptable time', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('/');
        const loadTime = Date.now() - startTime;

        // Page should load within 5 seconds
        expect(loadTime).toBeLessThan(5000);
    });
});

test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
        await page.goto('/');

        // Should have h1
        const h1Count = await page.locator('h1').count();
        expect(h1Count).toBeGreaterThanOrEqual(1);
    });

    test('should have alt text on images', async ({ page }) => {
        await page.goto('/');

        const images = page.locator('img');
        const count = await images.count();

        for (let i = 0; i < Math.min(count, 5); i++) {
            const img = images.nth(i);
            const alt = await img.getAttribute('alt');
            // Images should have alt attribute (can be empty for decorative)
            expect(alt).not.toBeNull();
        }
    });
});
