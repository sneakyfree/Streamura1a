import { test, expect } from '@playwright/test';
import { loginAs } from './_helpers';

/**
 * Streamura Admin & Agent Dashboard E2E Tests
 *
 * These run as a real authenticated admin (seeded via the API) and assert the
 * actual page headings/content. Previously these tests visited admin routes
 * anonymously (which correctly redirect to /login) using a malformed mixed
 * css/text locator, so they never exercised the admin UI at all.
 */

// Every admin route and the heading it must render when authed as admin.
const ADMIN_PAGES: { path: string; heading: RegExp }[] = [
    { path: '/admin', heading: /Admin Dashboard/i },
    { path: '/admin/users', heading: /User Management/i },
    { path: '/admin/reports', heading: /Report Queue/i },
    { path: '/admin/moderation', heading: /Content Moderation/i },
    { path: '/admin/tickets', heading: /Ticket Scanner/i },
    { path: '/admin/agents', heading: /Agent Dashboard/i },
    { path: '/admin/agents/audit', heading: /Agent Decision Audit Log/i },
    { path: '/admin/hitl-queue', heading: /HITL Approval Queue/i },
    { path: '/admin/clusters', heading: /Cluster Management/i },
    { path: '/admin/analytics', heading: /Platform Analytics/i },
    { path: '/admin/content-filter', heading: /Content Filter Manager/i },
];

test.describe('Admin pages render for an authenticated admin', () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, 'admin', 'admin123');
    });

    for (const { path, heading } of ADMIN_PAGES) {
        test(`${path} renders its heading`, async ({ page }) => {
            await page.goto(path);
            // Must NOT have been bounced to the login/access-denied screen.
            await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '$'));
            await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 10000 });
        });
    }
});

test.describe('Admin access control', () => {
    test('anonymous visitor to /admin is redirected to login', async ({ page }) => {
        await page.goto('/admin');
        await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible({ timeout: 10000 });
    });

    test('a non-admin user cannot reach /admin', async ({ page }) => {
        await loginAs(page, 'demo', 'demo123');
        await page.goto('/admin');
        // ProtectedRoute(requireAdmin) sends non-admins back to the home shell.
        await expect(page).not.toHaveURL(/\/admin$/);
    });
});

test.describe('Admin dashboard navigation', () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, 'admin', 'admin123');
    });

    test('dashboard shows management links to real routed pages', async ({ page }) => {
        await page.goto('/admin');
        await expect(page.getByRole('heading', { name: /Admin Dashboard/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /User Management/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /Platform Analytics/i })).toBeVisible();
    });

    test('clicking User Management navigates to the users page', async ({ page }) => {
        await page.goto('/admin');
        await page.getByRole('link', { name: /User Management/i }).first().click();
        await expect(page).toHaveURL(/\/admin\/users$/);
        await expect(page.getByRole('heading', { name: /User Management/i })).toBeVisible();
    });

    test('User Management has a search input', async ({ page }) => {
        await page.goto('/admin/users');
        await expect(page.getByPlaceholder(/search/i).first()).toBeVisible({ timeout: 10000 });
    });
});
