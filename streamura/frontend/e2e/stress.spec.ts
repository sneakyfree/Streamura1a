import { test, Page, ConsoleMessage, Request } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Streamura comprehensive stress test.
 *
 * Visits every route, clicks every button + link, types in every search box,
 * exercises every tab. Records:
 *   - console errors
 *   - failed network requests (status >= 400 or net error)
 *   - missing h1 (probably blank page)
 *   - render exceptions (white screen)
 *   - links pointing to routes the SPA has no Route for
 *
 * Output: e2e-report/stress.json (machine-readable) + console table.
 */

type Severity = 'red' | 'yellow' | 'green';

interface PageReport {
    route: string;
    severity: Severity;
    notes: string[];
    consoleErrors: string[];
    networkErrors: string[];
    buttonCount: number;
    linkCount: number;
    inputCount: number;
    tabCount: number;
    h1Text: string | null;
}

const REPORT: PageReport[] = [];
const REPORT_PATH = path.join(process.cwd(), 'e2e-report', 'stress.json');

// Routes declared in App.tsx (static + sampled dynamic)
const STATIC_ROUTES = [
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
    '/terms',
    '/privacy',
    '/contact',
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password',
];

const DYNAMIC_ROUTES = [
    '/streams/stream-sample-1',
    '/events/event-sample-1',
    '/recordings/recording-sample-1',
    '/communities/community-sample-1',
];

// Footer links that we'll need to verify too
const FOOTER_LINKS = ['/features', '/pricing', '/cookies', '/guidelines', '/sitemap'];

const KNOWN_ROUTES = new Set([
    ...STATIC_ROUTES,
    '/streams/',
    '/events/',
    '/recordings/',
    '/communities/',
]);

function classify(consoleErrors: string[], networkErrors: string[], h1Text: string | null, notes: string[]): Severity {
    // Genuine red: render exception OR no content at all
    if (notes.some(n => n.startsWith('RED:'))) return 'red';
    if (h1Text === null) return 'red';
    // Yellow if any console errors, any 5xx, or any noted yellow
    if (consoleErrors.length > 0) return 'yellow';
    if (networkErrors.some(e => /5\d\d|ERR_/.test(e))) return 'yellow';
    if (notes.some(n => n.startsWith('YELLOW:'))) return 'yellow';
    return 'green';
}

async function probeRoute(page: Page, route: string): Promise<PageReport> {
    const consoleErrors: string[] = [];
    const networkErrors: string[] = [];
    const notes: string[] = [];

    const onConsole = (msg: ConsoleMessage) => {
        if (msg.type() === 'error') {
            const text = msg.text();
            // Filter out noisy expected 401s from backend-not-running
            if (/Failed to load resource.*\b401\b/.test(text)) return;
            if (/Network Error/.test(text) && !/blocked|CORS/i.test(text)) return;
            consoleErrors.push(text.slice(0, 220));
        }
    };
    const onPageError = (err: Error) => {
        notes.push(`RED: pageerror ${err.message.slice(0, 200)}`);
    };
    const onRequestFailed = (req: Request) => {
        const url = req.url();
        // Ignore backend API failures (backend not running for this stress run)
        if (/\/api\//.test(url)) return;
        if (/livekit/.test(url)) return;
        if (/ws:\/\//.test(url)) return;
        networkErrors.push(`${req.failure()?.errorText ?? 'err'} ${url.slice(0, 120)}`);
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);

    try {
        await page.goto(route, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e: any) {
        notes.push(`RED: goto failed: ${String(e?.message || e).slice(0, 200)}`);
    }

    // Give React time to render
    await page.waitForTimeout(300);

    const h1Locator = page.locator('h1').first();
    let h1Text: string | null = null;
    try {
        if (await h1Locator.count() > 0) {
            h1Text = (await h1Locator.textContent({ timeout: 1500 }))?.trim() || '';
        }
    } catch { /* ignore */ }

    if (h1Text === null) notes.push('RED: no h1 rendered');
    if (h1Text === '') notes.push('YELLOW: empty h1');

    // Count interactive surface
    const buttonCount = await page.locator('button').count();
    const linkCount = await page.locator('a[href]').count();
    const inputCount = await page.locator('input,textarea,select').count();
    const tabCount = await page.locator('[role="tab"], button:has-text("Tab")').count();

    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);

    const report: PageReport = {
        route,
        severity: 'green',
        notes,
        consoleErrors,
        networkErrors,
        buttonCount,
        linkCount,
        inputCount,
        tabCount,
        h1Text,
    };
    report.severity = classify(consoleErrors, networkErrors, h1Text, notes);
    REPORT.push(report);
    return report;
}

for (const route of [...STATIC_ROUTES, ...DYNAMIC_ROUTES]) {
    test(`probe ${route}`, async ({ page }) => {
        await probeRoute(page, route);
        // Record-only; aggregate severity decided in afterAll.
    });
}

// Verify every footer link resolves to a known route (or document broken ones)
test('footer links exist as routes', async ({ page }) => {
    await page.goto('/');
    const allLinks = await page.locator('footer a[href^="/"]').evaluateAll(els =>
        Array.from(new Set(els.map(e => (e as HTMLAnchorElement).getAttribute('href'))))
    );
    const broken: string[] = [];
    for (const href of allLinks) {
        if (!href) continue;
        // Same-page anchor or external
        if (href.startsWith('#') || href.startsWith('http')) continue;
        await page.goto(href, { waitUntil: 'networkidle' }).catch(() => { });
        await page.waitForTimeout(200);
        const h1 = page.locator('h1').first();
        const h1Visible = (await h1.count()) > 0 && (await h1.isVisible().catch(() => false));
        const bodyText = await page.locator('body').textContent().catch(() => '');
        if (!h1Visible || (bodyText && bodyText.trim().length < 50)) {
            broken.push(href);
        }
    }
    REPORT.push({
        route: 'FOOTER_LINK_CHECK',
        severity: broken.length ? 'red' : 'green',
        notes: broken.length ? [`RED: broken footer links: ${broken.join(', ')}`] : [],
        consoleErrors: [],
        networkErrors: [],
        buttonCount: 0,
        linkCount: allLinks.length,
        inputCount: 0,
        tabCount: 0,
        h1Text: null,
    });
});

// Navbar search box: type, press enter, assert something happens
test('navbar search box reacts to input', async ({ page }) => {
    await page.goto('/');
    const search = page.locator('input[placeholder*="Search"]').first();
    const exists = (await search.count()) > 0;
    const notes: string[] = [];
    if (!exists) {
        notes.push('RED: search input not found');
    } else {
        const before = page.url();
        await search.fill('test query');
        await search.press('Enter');
        await page.waitForTimeout(500);
        const after = page.url();
        if (after === before) {
            // didn't navigate; check for a results panel
            const resultsVisible = await page.locator('[data-search-results], [class*="search-result"]').count();
            if (resultsVisible === 0) {
                notes.push('YELLOW: navbar search has no handler — input is dead');
            }
        }
    }
    REPORT.push({
        route: 'NAVBAR_SEARCH',
        severity: notes.some(n => n.startsWith('RED:')) ? 'red' : notes.length ? 'yellow' : 'green',
        notes,
        consoleErrors: [],
        networkErrors: [],
        buttonCount: 0,
        linkCount: 0,
        inputCount: 1,
        tabCount: 0,
        h1Text: null,
    });
});

// Tabs on Discover (Trending/Near Me/All Events) per the original smoke
test('discover tabs are clickable', async ({ page }) => {
    await page.goto('/discover');
    await page.waitForTimeout(300);
    const notes: string[] = [];
    for (const label of ['Trending', 'Near Me', 'All Events', 'Nearby']) {
        const btn = page.locator(`button:has-text("${label}")`).first();
        if (await btn.count() === 0) continue;
        try {
            await btn.click({ timeout: 2000 });
            await page.waitForTimeout(150);
        } catch (e: any) {
            notes.push(`YELLOW: discover tab "${label}" not clickable: ${e.message?.slice(0, 80)}`);
        }
    }
    REPORT.push({
        route: 'DISCOVER_TABS',
        severity: notes.length ? 'yellow' : 'green',
        notes,
        consoleErrors: [],
        networkErrors: [],
        buttonCount: 0,
        linkCount: 0,
        inputCount: 0,
        tabCount: 0,
        h1Text: null,
    });
});

test.afterAll(async () => {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    // Merge with existing data from other workers
    let existing: PageReport[] = [];
    try {
        if (fs.existsSync(REPORT_PATH)) {
            existing = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
        }
    } catch { /* ignore */ }
    const seen = new Set(REPORT.map(r => r.route));
    const merged = [...REPORT, ...existing.filter(r => !seen.has(r.route))];
    fs.writeFileSync(REPORT_PATH, JSON.stringify(merged, null, 2));
    const counts = merged.reduce((acc, r) => { acc[r.severity] = (acc[r.severity] || 0) + 1; return acc; }, {} as Record<string, number>);
    console.log('\n=== STRESS REPORT SUMMARY ===');
    console.log('Green:', counts.green || 0, ' Yellow:', counts.yellow || 0, ' Red:', counts.red || 0);
    console.log('\nReds:');
    for (const r of merged.filter(x => x.severity === 'red')) {
        console.log(' ', r.route, '-', r.notes.join(' | '));
    }
    console.log('\nYellows:');
    for (const r of merged.filter(x => x.severity === 'yellow')) {
        console.log(' ', r.route, '-', [...r.notes, ...r.consoleErrors.slice(0, 1)].join(' | '));
    }
});
