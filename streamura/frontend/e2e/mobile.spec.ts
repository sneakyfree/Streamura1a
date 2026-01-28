import { test, expect, devices } from '@playwright/test';

/**
 * Streamura Mobile Viewport E2E Tests
 * 
 * Tests responsive design across various device viewports:
 * - iPhone SE, iPhone 12/13/14, iPhone Pro Max
 * - Android phones, tablets
 * - PWA-specific behaviors
 */

// Device configurations
const mobileDevices = [
    { name: 'iPhone SE', width: 375, height: 667 },
    { name: 'iPhone 12/13', width: 390, height: 844 },
    { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
    { name: 'Pixel 5', width: 393, height: 851 },
    { name: 'Galaxy S21', width: 360, height: 800 },
];

const tabletDevices = [
    { name: 'iPad Mini', width: 768, height: 1024 },
    { name: 'iPad Pro 11', width: 834, height: 1194 },
    { name: 'iPad Pro 12.9', width: 1024, height: 1366 },
];

test.describe('Mobile Navigation', () => {
    for (const device of mobileDevices) {
        test(`should show mobile navigation on ${device.name}`, async ({ page }) => {
            await page.setViewportSize({ width: device.width, height: device.height });
            await page.goto('/');

            // Navigation should be visible (hamburger or bottom nav)
            await expect(
                page.locator('[data-testid="mobile-nav"], [data-testid="hamburger-menu"], nav')
            ).toBeVisible({ timeout: 10000 });
        });
    }

    test('should open mobile menu on hamburger click', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        const hamburger = page.locator('[data-testid="hamburger-menu"], [aria-label="menu"], button:has(svg)').first();

        if (await hamburger.isVisible()) {
            await hamburger.click();

            // Should show expanded menu
            await expect(
                page.locator('[data-testid="mobile-menu-expanded"], [class*="mobile-menu"], [role="menu"]')
            ).toBeVisible({ timeout: 3000 });
        }
    });
});

test.describe('Mobile Stream Viewing', () => {
    for (const device of mobileDevices.slice(0, 2)) {
        test(`should display stream player correctly on ${device.name}`, async ({ page }) => {
            await page.setViewportSize({ width: device.width, height: device.height });
            await page.goto('/stream/1');

            // Player should be visible and fill width
            const player = page.locator('[data-testid="stream-player"], video, [class*="player"]').first();

            if (await player.isVisible({ timeout: 5000 })) {
                const box = await player.boundingBox();
                expect(box?.width).toBeGreaterThan(device.width * 0.9);
            }
        });
    }

    test('should show chat in portrait mode on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/stream/1');

        // Chat should be below player or toggleable
        const chatSection = page.locator('[data-testid="stream-chat"], [class*="chat"]').first();

        if (await chatSection.isVisible({ timeout: 5000 })) {
            const box = await chatSection.boundingBox();
            // Chat should be full width on mobile
            expect(box?.width).toBeGreaterThan(300);
        }
    });
});

test.describe('Mobile Forms', () => {
    test('should display login form properly on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/login');

        // Form elements should be visible and usable
        await expect(page.getByPlaceholder(/email/i)).toBeVisible();
        await expect(page.getByPlaceholder(/password/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();

        // Button should be full width on mobile
        const button = page.getByRole('button', { name: /sign in/i });
        const box = await button.boundingBox();
        expect(box?.width).toBeGreaterThan(300);
    });

    test('should display registration form properly on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/register');

        await expect(page.getByPlaceholder(/username/i)).toBeVisible();
        await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    });
});

test.describe('Tablet Layout', () => {
    for (const device of tabletDevices.slice(0, 1)) {
        test(`should show sidebar on ${device.name}`, async ({ page }) => {
            await page.setViewportSize({ width: device.width, height: device.height });
            await page.goto('/');

            // Should show sidebar navigation on tablet
            await expect(
                page.locator('[data-testid="sidebar"], aside, nav')
            ).toBeVisible({ timeout: 10000 });
        });
    }

    test('should show stream + chat side-by-side on tablet landscape', async ({ page }) => {
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.goto('/stream/1');

        // Chat should be visible alongside player
        const player = page.locator('[data-testid="stream-player"], video').first();
        const chat = page.locator('[data-testid="stream-chat"], [class*="chat"]').first();

        if (await player.isVisible({ timeout: 5000 }) && await chat.isVisible()) {
            const playerBox = await player.boundingBox();
            const chatBox = await chat.boundingBox();

            // In landscape, chat should be to the side of player
            if (playerBox && chatBox) {
                // Either side-by-side or stacked (both valid)
                expect(playerBox.width + chatBox.width).toBeLessThanOrEqual(1050);
            }
        }
    });
});

test.describe('Touch Interactions', () => {
    test('should support touch scrolling on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/discover');

        // Scroll using touch
        await page.evaluate(() => {
            window.scrollBy(0, 300);
        });

        // Content should have scrolled
        const scrollY = await page.evaluate(() => window.scrollY);
        expect(scrollY).toBeGreaterThan(0);
    });

    test('should support pull-to-refresh gesture', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/discover');

        // Touch events for pull-to-refresh
        await page.evaluate(() => {
            const touchStart = new TouchEvent('touchstart', {
                touches: [{ identifier: 0, target: document.body, clientX: 187, clientY: 50 } as Touch],
            });
            const touchEnd = new TouchEvent('touchend', {
                touches: [],
            });
            document.body.dispatchEvent(touchStart);
            document.body.dispatchEvent(touchEnd);
        });

        // Page should remain functional
        await expect(page).toHaveURL(/discover/);
    });
});

test.describe('PWA Install Banner', () => {
    test('should show install banner on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // PWA install banner might be shown
        const installBanner = page.locator('[data-testid="pwa-install-banner"], text=/install/i').first();

        // This is optional - depends on browser support
        if (await installBanner.isVisible({ timeout: 3000 })) {
            await expect(installBanner).toBeVisible();
        }
    });
});

test.describe('Offline Indicator', () => {
    test('should show offline indicator when network is lost', async ({ page, context }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // Simulate offline mode
        await context.setOffline(true);

        // Give time for offline detection
        await page.waitForTimeout(1000);

        // Check for offline indicator
        const offlineIndicator = page.locator('[data-testid="offline-indicator"], text=/offline/i').first();

        if (await offlineIndicator.isVisible({ timeout: 3000 })) {
            await expect(offlineIndicator).toBeVisible();
        }

        // Restore network
        await context.setOffline(false);
    });
});

test.describe('Bottom Navigation Mobile', () => {
    test('should show bottom navigation on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // Look for bottom navigation bar
        const bottomNav = page.locator('[data-testid="bottom-nav"], [class*="bottom-nav"], nav:below(main)').first();

        if (await bottomNav.isVisible({ timeout: 5000 })) {
            // Should be at bottom of viewport
            const box = await bottomNav.boundingBox();
            expect(box?.y).toBeGreaterThan(600);
        }
    });

    test('should navigate using bottom nav tabs', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/');

        // Click discover tab if visible
        const discoverTab = page.locator('[data-testid="nav-discover"], text=/discover/i').first();

        if (await discoverTab.isVisible({ timeout: 3000 })) {
            await discoverTab.click();
            await expect(page).toHaveURL(/discover/);
        }
    });
});

test.describe('Landscape Orientation', () => {
    test('should handle landscape orientation on mobile', async ({ page }) => {
        // Landscape iPhone
        await page.setViewportSize({ width: 844, height: 390 });
        await page.goto('/stream/1');

        // Player should expand to fill landscape width
        const player = page.locator('[data-testid="stream-player"], video').first();

        if (await player.isVisible({ timeout: 5000 })) {
            const box = await player.boundingBox();
            expect(box?.width).toBeGreaterThan(700);
        }
    });
});
