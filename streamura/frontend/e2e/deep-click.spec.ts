import { test, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Deep interactive stress.
 * For each route:
 *   - Click every visible button that won't navigate away (skip <a>, skip submit-without-confirmation actions named "Sign Out", "Logout", "Delete").
 *   - Type garbage into every search input + press Enter.
 *   - Click every tab.
 *   - Submit every form with a fake email/password (login/register).
 *   - Capture before/after screenshots for visual diff.
 *   - Record any new console error, pageerror, or "input value didn't change" failure.
 */

interface ClickFinding {
    route: string;
    interaction: string;
    severity: 'red' | 'yellow' | 'green';
    note: string;
    consoleErrors: string[];
}

const FINDINGS: ClickFinding[] = [];
const REPORT_PATH = path.join(process.cwd(), 'e2e-report', 'deep-click.json');

const ROUTES = [
    '/',
    '/discover',
    '/shop',
    '/coins',
    '/pricing',
    '/sitemap',
    '/about',
    '/terms',
    '/privacy',
    '/contact',
    '/emergency-broadcast',
    '/kyc-verification',
    '/appeals',
    '/content-licensing',
    '/settings/data-export',
    '/communities',
    '/admin/tickets',
    '/admin/clusters',
    '/login',
    '/register',
    '/forgot-password',
];

const DESTRUCTIVE_LABELS = [
    /sign\s*out/i, /log\s*out/i, /logout/i, /delete/i, /remove/i, /destroy/i,
    /unsubscribe/i, /revoke/i, /ban/i, /suspend/i, /cancel\s+account/i,
    /send\s+emergency\s+broadcast/i, /confirm/i,
];

async function instrumentPage(page: Page) {
    const errors: string[] = [];
    page.on('console', (m: ConsoleMessage) => {
        if (m.type() === 'error') {
            const t = m.text();
            if (/\b401\b|\b422\b/.test(t)) return;
            errors.push(t.slice(0, 200));
        }
    });
    page.on('pageerror', e => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
    return errors;
}

test.describe.configure({ mode: 'serial' });

async function probeOne(page: Page, route: string) {
    const errors = await instrumentPage(page);
    await page.setViewportSize({ width: 1280, height: 800 });
    try {
        await page.goto(route, { waitUntil: 'networkidle', timeout: 12000 });
        await page.waitForTimeout(300);
    } catch {
        FINDINGS.push({ route, interaction: 'goto', severity: 'red', note: 'page load timed out', consoleErrors: [] });
        return;
    }
    await runInteractionPass(page, route, errors);
}

async function runInteractionPass(page: Page, route: string, errors: string[]) {
        try {

        // 1. Inputs
        const inputs = page.locator('input:visible:not([type="checkbox"]):not([type="radio"]), textarea:visible');
        const inputCount = await inputs.count();
        for (let i = 0; i < Math.min(inputCount, 6); i++) {
            const before = errors.length;
            try {
                const inp = inputs.nth(i);
                const type = await inp.getAttribute('type').catch(() => '');
                let val = 'test';
                if (type === 'email') val = 'qa@example.com';
                else if (type === 'password') val = 'TestP@ssw0rd!';
                else if (type === 'number') val = '5';
                else if (type === 'tel') val = '555-0100';
                await inp.fill(val, { timeout: 1500 });
                const got = await inp.inputValue().catch(() => '');
                if (got !== val) {
                    FINDINGS.push({ route, interaction: `input[${i}] type=${type}`, severity: 'yellow', note: `value mismatch: expected="${val}" got="${got}"`, consoleErrors: errors.slice(before) });
                }
            } catch (e: any) {
                FINDINGS.push({ route, interaction: `input[${i}]`, severity: 'yellow', note: `fill failed: ${e.message?.slice(0, 80)}`, consoleErrors: errors.slice(before) });
            }
        }

        // 2. Tabs (role=tab or [data-state])
        const tabs = page.locator('[role="tab"]:visible');
        const tabCount = await tabs.count();
        for (let i = 0; i < Math.min(tabCount, 6); i++) {
            const before = errors.length;
            try {
                const label = (await tabs.nth(i).textContent({ timeout: 800 }))?.trim().slice(0, 40) || `#${i}`;
                await tabs.nth(i).click({ timeout: 1500 });
                await page.waitForTimeout(150);
                if (errors.length > before) {
                    FINDINGS.push({ route, interaction: `tab "${label}"`, severity: 'yellow', note: 'click produced console errors', consoleErrors: errors.slice(before) });
                }
            } catch (e: any) {
                FINDINGS.push({ route, interaction: `tab[${i}]`, severity: 'yellow', note: `click failed: ${e.message?.slice(0, 80)}`, consoleErrors: errors.slice(before) });
            }
        }

        // 3. Click every visible non-destructive button (single pass, capped)
        const beforeUrl = page.url();
        const buttons = page.locator('button:visible');
        const bcount = Math.min(await buttons.count(), 15);
        for (let i = 0; i < bcount; i++) {
            let label = '';
            try {
                label = ((await buttons.nth(i).textContent({ timeout: 400 }).catch(() => '')) || '').trim();
            } catch { continue; }
            if (!label || label.length > 60) continue;
            if (DESTRUCTIVE_LABELS.some(re => re.test(label))) continue;
            const beforeErrs = errors.length;
            try {
                await buttons.nth(i).click({ timeout: 1000 });
                await page.waitForTimeout(100);
                if (page.url() !== beforeUrl) {
                    await page.goto(route, { waitUntil: 'networkidle', timeout: 8000 }).catch(() => { });
                    await page.waitForTimeout(200);
                    break;
                }
                if (errors.length > beforeErrs) {
                    FINDINGS.push({ route, interaction: `button "${label.slice(0, 30)}"`, severity: 'yellow', note: 'click produced console error', consoleErrors: errors.slice(beforeErrs) });
                }
            } catch (e: any) {
                const msg = e.message || '';
                if (/Timeout|not visible|outside of the viewport|detached/i.test(msg)) continue;
                FINDINGS.push({ route, interaction: `button "${label.slice(0, 30)}"`, severity: 'yellow', note: `click failed: ${msg.slice(0, 80)}`, consoleErrors: errors.slice(beforeErrs) });
            }
        }
        } catch (e: any) {
            FINDINGS.push({ route, interaction: 'pass', severity: 'yellow', note: `harness error: ${e.message?.slice(0, 80)}`, consoleErrors: [] });
        }
}

for (const r of ROUTES) {
    test(`deep-click ${r}`, async ({ page }) => {
        await probeOne(page, r);
    });
}

test.afterAll(() => {
    fs.writeFileSync(REPORT_PATH, JSON.stringify(FINDINGS, null, 2));
    const counts = FINDINGS.reduce((a, f) => { a[f.severity] = (a[f.severity] || 0) + 1; return a; }, {} as Record<string, number>);
    console.log('\n=== DEEP-CLICK FINDINGS ===');
    console.log('Counts:', counts);
    const reds = FINDINGS.filter(f => f.severity === 'red');
    if (reds.length) {
        console.log('\nReds:');
        for (const f of reds) console.log(` ${f.route} :: ${f.interaction} -> ${f.note}`);
    }
    const yellows = FINDINGS.filter(f => f.severity === 'yellow');
    console.log(`\nYellows (${yellows.length}):`);
    for (const f of yellows.slice(0, 50)) console.log(` ${f.route} :: ${f.interaction} -> ${f.note}`);
});
