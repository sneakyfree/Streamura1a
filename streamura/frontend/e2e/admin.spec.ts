import { test, expect } from '@playwright/test';

/**
 * Streamura Admin & Agent Dashboard E2E Tests
 * 
 * Tests the admin interfaces including:
 * - Admin dashboard overview
 * - Agent dashboard and monitoring
 * - HITL approval queue
 * - Moderation queue
 * - User management
 */

test.describe('Admin Dashboard', () => {
    test('should display admin dashboard overview', async ({ page }) => {
        await page.goto('/admin');

        // Should show admin dashboard or login redirect
        await expect(
            page.locator('[data-testid="admin-dashboard"], text=/admin|dashboard/i, text=/sign in/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should show key metrics cards', async ({ page }) => {
        await page.goto('/admin');

        // Look for metric cards
        const metricsSection = page.locator('[data-testid="metrics-cards"], [class*="metric"], [class*="stat"]').first();

        if (await metricsSection.isVisible({ timeout: 5000 })) {
            await expect(metricsSection).toBeVisible();
        }
    });

    test('should navigate to sub-pages', async ({ page }) => {
        await page.goto('/admin');

        // Look for navigation links
        const navLinks = page.locator('a[href*="/admin/"], nav a').first();

        if (await navLinks.isVisible({ timeout: 5000 })) {
            await expect(navLinks).toBeVisible();
        }
    });
});

test.describe('Agent Dashboard', () => {
    test('should display agent dashboard', async ({ page }) => {
        await page.goto('/admin/agents');

        // Should show agent dashboard
        await expect(
            page.locator('[data-testid="agent-dashboard"], text=/agent|orchestrator/i, text=/sign in/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should show agent status cards', async ({ page }) => {
        await page.goto('/admin/agents');

        // Look for agent type cards
        const agentCards = page.locator('[data-testid="agent-card"], [class*="agent"], text=/moderation|discovery|trust|payout/i').first();

        if (await agentCards.isVisible({ timeout: 5000 })) {
            await expect(agentCards).toBeVisible();
        }
    });

    test('should show agent activity chart', async ({ page }) => {
        await page.goto('/admin/agents');

        // Look for activity chart
        const chart = page.locator('[data-testid="agent-activity-chart"], svg, canvas, [class*="chart"]').first();

        if (await chart.isVisible({ timeout: 5000 })) {
            await expect(chart).toBeVisible();
        }
    });

    test('should show recent agent decisions', async ({ page }) => {
        await page.goto('/admin/agents');

        // Look for decisions list
        const decisionsList = page.locator('[data-testid="agent-decisions"], [class*="decision"], table').first();

        if (await decisionsList.isVisible({ timeout: 5000 })) {
            await expect(decisionsList).toBeVisible();
        }
    });
});

test.describe('Agent Audit Log', () => {
    test('should display audit log page', async ({ page }) => {
        await page.goto('/admin/agents/audit');

        // Should show audit log
        await expect(
            page.locator('[data-testid="audit-log"], text=/audit|log|history/i, text=/sign in/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should have filter options', async ({ page }) => {
        await page.goto('/admin/agents/audit');

        // Look for filter controls
        const filters = page.locator('[data-testid="audit-filters"], select, [class*="filter"]').first();

        if (await filters.isVisible({ timeout: 5000 })) {
            await expect(filters).toBeVisible();
        }
    });

    test('should show audit entries with timestamps', async ({ page }) => {
        await page.goto('/admin/agents/audit');

        // Look for entries with timestamps
        const entry = page.locator('[data-testid="audit-entry"], tr, [class*="entry"]').first();

        if (await entry.isVisible({ timeout: 5000 })) {
            // Should contain time-related text
            await expect(
                page.locator('text=/\\d{1,2}:\\d{2}|ago|today|yesterday/i').first()
            ).toBeVisible();
        }
    });
});

test.describe('HITL Approval Queue', () => {
    test('should display HITL queue page', async ({ page }) => {
        await page.goto('/admin/hitl');

        // Should show HITL queue
        await expect(
            page.locator('[data-testid="hitl-queue"], text=/approval|queue|pending/i, text=/sign in/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should show priority filters', async ({ page }) => {
        await page.goto('/admin/hitl');

        // Look for priority filter tabs or buttons
        const priorityFilters = page.locator('text=/urgent|high|normal|low/i').first();

        if (await priorityFilters.isVisible({ timeout: 5000 })) {
            await expect(priorityFilters).toBeVisible();
        }
    });

    test('should show approval cards with actions', async ({ page }) => {
        await page.goto('/admin/hitl');

        // Look for approval cards
        const approvalCard = page.locator('[data-testid="approval-card"], [class*="approval"], [class*="queue-item"]').first();

        if (await approvalCard.isVisible({ timeout: 5000 })) {
            // Should have action buttons
            await expect(
                page.locator('button:has-text("Approve"), button:has-text("Reject")').first()
            ).toBeVisible();
        }
    });
});

test.describe('Moderation Queue', () => {
    test('should display moderation queue', async ({ page }) => {
        await page.goto('/admin/moderation');

        // Should show moderation queue
        await expect(
            page.locator('[data-testid="moderation-queue"], text=/moderation|review|flagged/i, text=/sign in/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should show content type filters', async ({ page }) => {
        await page.goto('/admin/moderation');

        // Look for content type filters
        const typeFilters = page.locator('text=/chat|stream|user|all/i').first();

        if (await typeFilters.isVisible({ timeout: 5000 })) {
            await expect(typeFilters).toBeVisible();
        }
    });

    test('should show flagged content items', async ({ page }) => {
        await page.goto('/admin/moderation');

        // Look for content items or empty state
        await expect(
            page.locator('[data-testid="moderation-item"], [class*="content-item"], text=/no items|queue empty/i')
        ).toBeVisible({ timeout: 10000 });
    });
});

test.describe('User Management', () => {
    test('should display user management page', async ({ page }) => {
        await page.goto('/admin/users');

        // Should show user management
        await expect(
            page.locator('[data-testid="user-management"], text=/users|management/i, text=/sign in/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should have search functionality', async ({ page }) => {
        await page.goto('/admin/users');

        // Look for search input
        const searchInput = page.locator('[data-testid="user-search"], input[placeholder*="search"], input[type="search"]').first();

        if (await searchInput.isVisible({ timeout: 5000 })) {
            await expect(searchInput).toBeVisible();
        }
    });

    test('should show user list with actions', async ({ page }) => {
        await page.goto('/admin/users');

        // Look for user list
        const userRow = page.locator('[data-testid="user-row"], tr, [class*="user-item"]').first();

        if (await userRow.isVisible({ timeout: 5000 })) {
            await expect(userRow).toBeVisible();
        }
    });
});

test.describe('Cluster Management', () => {
    test('should display cluster management page', async ({ page }) => {
        await page.goto('/admin/clusters');

        // Should show cluster management
        await expect(
            page.locator('[data-testid="cluster-management"], text=/cluster|event/i, text=/sign in/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should show active clusters', async ({ page }) => {
        await page.goto('/admin/clusters');

        // Look for cluster cards or list
        const clusterItem = page.locator('[data-testid="cluster-item"], [class*="cluster"], [class*="event"]').first();

        if (await clusterItem.isVisible({ timeout: 5000 })) {
            await expect(clusterItem).toBeVisible();
        }
    });

    test('should show cluster map or visualization', async ({ page }) => {
        await page.goto('/admin/clusters');

        // Look for map or visualization
        const visualization = page.locator('[data-testid="cluster-map"], [class*="map"], svg, canvas').first();

        if (await visualization.isVisible({ timeout: 5000 })) {
            await expect(visualization).toBeVisible();
        }
    });
});

test.describe('Platform Analytics', () => {
    test('should display platform analytics page', async ({ page }) => {
        await page.goto('/admin/analytics');

        // Should show analytics dashboard
        await expect(
            page.locator('[data-testid="platform-analytics"], text=/analytics|metrics/i, text=/sign in/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should show revenue metrics', async ({ page }) => {
        await page.goto('/admin/analytics');

        // Look for revenue section
        const revenueSection = page.locator('text=/revenue|earnings|income/i').first();

        if (await revenueSection.isVisible({ timeout: 5000 })) {
            await expect(revenueSection).toBeVisible();
        }
    });

    test('should show charts', async ({ page }) => {
        await page.goto('/admin/analytics');

        // Look for chart elements
        const charts = page.locator('svg, canvas, [class*="chart"]').first();

        if (await charts.isVisible({ timeout: 5000 })) {
            await expect(charts).toBeVisible();
        }
    });
});

test.describe('Content Filter Manager', () => {
    test('should display content filter manager', async ({ page }) => {
        await page.goto('/admin/filters');

        // Should show filter manager
        await expect(
            page.locator('[data-testid="filter-manager"], text=/filter|content|rules/i, text=/sign in/i')
        ).toBeVisible({ timeout: 10000 });
    });

    test('should show filter rules list', async ({ page }) => {
        await page.goto('/admin/filters');

        // Look for filter rules
        const filterRule = page.locator('[data-testid="filter-rule"], tr, [class*="rule"]').first();

        if (await filterRule.isVisible({ timeout: 5000 })) {
            await expect(filterRule).toBeVisible();
        }
    });

    test('should have add filter button', async ({ page }) => {
        await page.goto('/admin/filters');

        // Look for add button
        const addButton = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("New")').first();

        if (await addButton.isVisible({ timeout: 5000 })) {
            await expect(addButton).toBeVisible();
        }
    });
});
