import { test, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Authenticated stress: login as the QA user (token captured in /tmp/qa_token.txt),
 * then visit every authenticated route. Records what data actually rendered.
 */

// The QA token is a manual precondition (see qa-setup.sh: run it against a
// live backend first). In CI / fresh checkouts the file does not exist —
// skip the authed suite instead of crashing the whole Playwright run at
// module load.
const TOKEN = fs.existsSync('/tmp/qa_token.txt')
    ? fs.readFileSync('/tmp/qa_token.txt', 'utf8').trim()
    : '';
test.skip(!TOKEN, 'requires /tmp/qa_token.txt — run e2e/qa-setup.sh against a live backend first');
const QA_USER = { id: 11, username: 'qa_user', email: 'qa@streamura.com', is_verified: false, balance: 0, lifetime_earnings: 0 };

interface Rec {
    route: string;
    h1: string | null;
    visibleButtons: number;
    visibleLinks: number;
    visibleInputs: number;
    visibleTabs: number;
    consoleErrors: string[];
    pageErrors: string[];
    screenshot: string;
    notes: string[];
}

const RECS: Rec[] = [];
const SHOTS = path.join(process.cwd(), 'e2e-report', 'authed-screenshots');
const REPORT = path.join(process.cwd(), 'e2e-report', 'authed-stress.json');
fs.mkdirSync(SHOTS, { recursive: true });

const ROUTES = [
    '/',
    '/feed',
    '/discover',
    '/trending',
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
    '/admin',  // non-admin → should show Access Denied (red shield) NOT sign-in
    '/admin/users',
    '/streams/1',
    '/streams/50',
    '/events/1',
    '/events/5',
];

function safeName(r: string) {
    return r.replace(/^\//, '').replace(/\//g, '__').replace(/[^a-zA-Z0-9_-]/g, '_') || 'root';
}

async function instrument(page: Page) {
    const ce: string[] = [];
    const pe: string[] = [];
    page.on('console', (m: ConsoleMessage) => {
        if (m.type() === 'error') {
            const t = m.text();
            // 401s only matter for the auth pass — if we get them now, that's a bug
            if (/422/.test(t)) return;
            ce.push(t.slice(0, 240));
        }
    });
    page.on('pageerror', e => pe.push(e.message.slice(0, 240)));
    return { ce, pe };
}

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
    // Inject token + user into localStorage BEFORE any navigation
    await page.addInitScript(({ token, user }) => {
        localStorage.setItem('access_token', token);
        // authStore zustand persists under "auth-storage"
        localStorage.setItem('auth-storage', JSON.stringify({
            state: { user, isAuthenticated: true, accessToken: token },
            version: 0,
        }));
    }, { token: TOKEN, user: QA_USER });
});

for (const route of ROUTES) {
    test(`authed ${route}`, async ({ page }) => {
        const { ce, pe } = await instrument(page);
        await page.setViewportSize({ width: 1280, height: 800 });
        const notes: string[] = [];
        try {
            await page.goto(route, { waitUntil: 'networkidle', timeout: 15000 });
        } catch (e: any) {
            notes.push(`goto: ${e.message?.slice(0, 100)}`);
        }
        await page.waitForTimeout(500);

        let h1 = '';
        try {
            const h1L = page.locator('h1').first();
            if (await h1L.count() > 0) {
                h1 = ((await h1L.textContent({ timeout: 1500 })) || '').trim();
            }
        } catch { /* */ }
        if (!h1) notes.push('no-h1');

        // Sign-in prompts seen while authenticated == bug
        if (/sign\s*in|please\s+sign|access\s+denied/i.test(h1)) {
            // Access Denied is valid for /admin* if user isn't an admin
            if (!(route.startsWith('/admin') && /access\s+denied/i.test(h1))) {
                notes.push(`AUTHED but saw "${h1.slice(0,40)}" — auth not propagated to this page`);
            }
        }

        const visibleButtons = await page.locator('button:visible').count();
        const visibleLinks = await page.locator('a[href]:visible').count();
        const visibleInputs = await page.locator('input:visible, textarea:visible, select:visible').count();
        const visibleTabs = await page.locator('[role="tab"]:visible').count();

        const ssPath = path.join(SHOTS, `${safeName(route)}.png`);
        try {
            await page.screenshot({ path: ssPath, fullPage: true });
        } catch (e: any) {
            notes.push(`shot: ${e.message?.slice(0, 80)}`);
        }

        RECS.push({
            route, h1: h1 || null,
            visibleButtons, visibleLinks, visibleInputs, visibleTabs,
            consoleErrors: ce, pageErrors: pe,
            screenshot: ssPath, notes,
        });
    });
}

test.afterAll(() => {
    fs.writeFileSync(REPORT, JSON.stringify(RECS, null, 2));
    console.log('\n=== AUTHED STRESS ===');
    for (const r of RECS) {
        const flag = r.pageErrors.length ? 'X' : r.consoleErrors.length ? '!' : ' ';
        console.log(` [${flag}] ${r.route.padEnd(28)} h1="${(r.h1 || '(none)').slice(0, 32).padEnd(32)}" btn=${String(r.visibleButtons).padStart(3)} lnk=${String(r.visibleLinks).padStart(3)} inp=${String(r.visibleInputs).padStart(2)} tab=${String(r.visibleTabs).padStart(2)} notes=${r.notes.join('|')}`);
    }
});
