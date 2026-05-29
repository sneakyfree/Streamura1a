import { test, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Visual Q&A pass.
 *   1. Visits every route.
 *   2. Captures a full-page screenshot.
 *   3. Counts visible interactive elements (button/link/input/tab).
 *   4. Optionally exercises forms (search + tabs) and snapshots after.
 *   5. Records what's there vs. what the code claims.
 *
 * Output:
 *   e2e-report/screenshots/<route>.png
 *   e2e-report/visual-qa.json
 */

interface VisualRecord {
    route: string;
    h1: string | null;
    visibleButtons: number;
    visibleLinks: number;
    visibleInputs: number;
    visibleTabs: number;
    consoleErrors: string[];
    pageErrors: string[];
    screenshotPath: string;
    notes: string[];
}

const ROUTES = [
    '/',
    '/feed',
    '/discover',
    '/trending',
    '/nearby',
    '/profile',
    '/analytics',
    '/stream/new',
    '/communities',
    '/messages',
    '/notifications',
    '/shop',
    '/inventory',
    '/coins',
    '/settings',
    '/settings/data-export',
    '/appeals',
    '/content-licensing',
    '/emergency-broadcast',
    '/kyc-verification',
    '/payouts',
    '/tax',
    '/admin',
    '/admin/users',
    '/admin/reports',
    '/admin/moderation',
    '/admin/tickets',
    '/admin/agents',
    '/admin/hitl-queue',
    '/admin/clusters',
    '/about',
    '/pricing',
    '/terms',
    '/privacy',
    '/contact',
    '/sitemap',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
];

const RECORDS: VisualRecord[] = [];
const SHOTS_DIR = path.join(process.cwd(), 'e2e-report', 'screenshots');
const REPORT_PATH = path.join(process.cwd(), 'e2e-report', 'visual-qa.json');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

function safeName(route: string): string {
    return route.replace(/^\//, '').replace(/\//g, '__').replace(/[^a-zA-Z0-9_-]/g, '_') || 'root';
}

async function attachListeners(page: Page) {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (m: ConsoleMessage) => {
        if (m.type() === 'error') {
            const text = m.text();
            if (/Failed to load resource.*\b401\b/.test(text)) return;
            if (/Failed to load resource.*\b422\b/.test(text)) return;
            consoleErrors.push(text.slice(0, 240));
        }
    });
    page.on('pageerror', e => pageErrors.push(e.message.slice(0, 240)));
    return { consoleErrors, pageErrors };
}

test.describe.configure({ mode: 'serial' });

for (const route of ROUTES) {
    test(`screenshot+probe ${route}`, async ({ page }) => {
        const { consoleErrors, pageErrors } = await attachListeners(page);
        await page.setViewportSize({ width: 1280, height: 800 });

        const notes: string[] = [];
        try {
            await page.goto(route, { waitUntil: 'networkidle', timeout: 15000 });
        } catch (e: any) {
            notes.push(`nav-timeout: ${String(e?.message || e).slice(0, 120)}`);
        }
        await page.waitForTimeout(500);

        let h1 = '';
        try {
            const h1L = page.locator('h1').first();
            if (await h1L.count() > 0) {
                h1 = ((await h1L.textContent({ timeout: 1500 })) || '').trim();
            }
        } catch { /* ignore */ }
        if (!h1) notes.push('no-h1');

        const visibleButtons = await page.locator('button:visible').count();
        const visibleLinks = await page.locator('a[href]:visible').count();
        const visibleInputs = await page.locator('input:visible, textarea:visible, select:visible').count();
        const visibleTabs = await page.locator('[role="tab"]:visible').count();

        const screenshotPath = path.join(SHOTS_DIR, `${safeName(route)}.png`);
        try {
            await page.screenshot({ path: screenshotPath, fullPage: true });
        } catch (e: any) {
            notes.push(`screenshot-failed: ${String(e?.message || e).slice(0, 80)}`);
        }

        // Detect obvious empty states
        const bodyText = (await page.locator('body').textContent().catch(() => ''))?.trim() || '';
        if (bodyText.length < 60) notes.push('body-near-empty');

        RECORDS.push({
            route,
            h1: h1 || null,
            visibleButtons,
            visibleLinks,
            visibleInputs,
            visibleTabs,
            consoleErrors,
            pageErrors,
            screenshotPath,
            notes,
        });
    });
}

test.afterAll(() => {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(RECORDS, null, 2));
    console.log('\n=== VISUAL Q&A ===');
    for (const r of RECORDS) {
        const flag = r.pageErrors.length ? 'X' : r.consoleErrors.length ? '!' : ' ';
        console.log(` [${flag}] ${r.route.padEnd(34)} h1="${(r.h1 || '(none)').slice(0, 28).padEnd(28)}" btn=${String(r.visibleButtons).padStart(3)} lnk=${String(r.visibleLinks).padStart(3)} inp=${String(r.visibleInputs).padStart(2)} tab=${String(r.visibleTabs).padStart(2)} notes=${r.notes.join(',')}`);
    }
});
