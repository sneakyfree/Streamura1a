import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// The QA token is a manual precondition (see qa-setup.sh: run it against a
// live backend first). In CI / fresh checkouts the file does not exist —
// skip the authed suite instead of crashing the whole Playwright run at
// module load.
const TOKEN = fs.existsSync('/tmp/qa_token.txt')
    ? fs.readFileSync('/tmp/qa_token.txt', 'utf8').trim()
    : '';
test.skip(!TOKEN, 'requires /tmp/qa_token.txt — run e2e/qa-setup.sh against a live backend first');
const QA_USER = { id: 11, username: 'qa_user', email: 'qa@streamura.com', is_verified: false, balance: 0, lifetime_earnings: 0 };

interface TabRec {
    route: string;
    tabs: { label: string; ariaSelected: string | null; panelHashChanged: boolean; shotPath: string }[];
    severity: 'red' | 'yellow' | 'green';
    note: string;
}

const RECS: TabRec[] = [];
const SHOTS = path.join(process.cwd(), 'e2e-report', 'tab-screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

const ROUTES = ['/settings', '/discover', '/profile'];

function sha(buf: Buffer): string { return crypto.createHash('sha1').update(buf).digest('hex'); }

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ token, user }) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('auth-storage', JSON.stringify({
            state: { user, isAuthenticated: true, accessToken: token },
            version: 0,
        }));
    }, { token: TOKEN, user: QA_USER });
});

for (const route of ROUTES) {
    test(`tab-state ${route}`, async ({ page }) => {
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto(route, { waitUntil: 'networkidle', timeout: 12000 });
        await page.waitForTimeout(400);

        // Dismiss the creator-onboarding modal if it's blocking the page.
        // It catches new users on /settings + /profile and is dismissable via "Skip for now".
        const skip = page.locator('text=/skip\\s+for\\s+now/i').first();
        if (await skip.count() > 0 && await skip.isVisible().catch(() => false)) {
            await skip.click({ timeout: 1500 }).catch(() => { });
            await page.waitForTimeout(400);
        }

        // Find Radix tabs first
        let tabsLoc = page.locator('[role="tab"]:visible');
        let isRadix = await tabsLoc.count() > 0;

        // Fallback button candidates for view-mode pages
        const fallbackLabels = ['Trending', 'Near Me', 'All Events', 'Following', 'For You', 'Streams', 'Subscriptions', 'Transactions'];

        const candidates: { handle: any; label: string }[] = [];
        if (isRadix) {
            const n = await tabsLoc.count();
            for (let i = 0; i < n; i++) {
                const t = tabsLoc.nth(i);
                const label = ((await t.textContent({ timeout: 500 }).catch(() => '')) || '').trim();
                candidates.push({ handle: t, label });
            }
        } else {
            const buttons = page.locator('button:visible');
            const bn = await buttons.count();
            for (let i = 0; i < bn; i++) {
                const b = buttons.nth(i);
                const label = ((await b.textContent({ timeout: 400 }).catch(() => '')) || '').trim();
                if (fallbackLabels.includes(label)) candidates.push({ handle: b, label });
            }
        }

        const tabs: { label: string; ariaSelected: string | null; panelHashChanged: boolean; shotPath: string }[] = [];

        // Anchor element for screenshot diff — main content or full page
        const contentSel = isRadix ? '[role="tabpanel"]:visible' : 'main, body';
        let lastShotHash = '';

        for (let i = 0; i < candidates.length; i++) {
            const c = candidates[i];
            await c.handle.click({ timeout: 1500 }).catch(() => { });
            await page.waitForTimeout(400);

            // aria-selected for Radix
            const aria = isRadix ? (await c.handle.getAttribute('aria-selected').catch(() => null)) : null;

            // Screenshot the content area
            const ssPath = path.join(SHOTS, `${route.replace(/^\//, '').replace(/\//g, '__') || 'root'}_${i}_${c.label.replace(/\s+/g, '_')}.png`);
            try {
                const el = page.locator(contentSel).first();
                if (await el.count() > 0) {
                    await el.screenshot({ path: ssPath, timeout: 3000 });
                } else {
                    await page.screenshot({ path: ssPath, fullPage: false });
                }
            } catch {
                await page.screenshot({ path: ssPath, fullPage: false }).catch(() => { });
            }

            const buf = fs.readFileSync(ssPath);
            const h = sha(buf);
            const changed = i === 0 ? true : h !== lastShotHash;
            lastShotHash = h;

            tabs.push({ label: c.label, ariaSelected: aria, panelHashChanged: changed, shotPath: ssPath });
        }

        const changedCount = tabs.filter(t => t.panelHashChanged).length;
        const sev: 'red' | 'yellow' | 'green' = changedCount >= tabs.length - 1 ? 'green' : changedCount >= 1 ? 'yellow' : 'red';
        const note = tabs.length === 0 ? 'no tab candidates' : '';

        RECS.push({ route, tabs, severity: sev, note });
    });
}

test.afterAll(() => {
    fs.writeFileSync(path.join(process.cwd(), 'e2e-report', 'tab-state.json'), JSON.stringify(RECS, null, 2));
    console.log('\n=== TAB STATE (screenshot diff) ===');
    for (const r of RECS) {
        console.log(` [${r.severity.toUpperCase()}] ${r.route} ${r.note}`);
        for (const t of r.tabs) {
            console.log(`    ${t.panelHashChanged ? 'CHANGED' : 'SAME   '} aria=${t.ariaSelected ?? '-'}  "${t.label}"`);
        }
    }
});
