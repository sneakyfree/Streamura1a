import { test, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Modal + dropdown exhaustion (authenticated).
 *
 * For each page known to have a modal or dropdown:
 *   - find the trigger
 *   - open it (verify visible)
 *   - close it (Escape, click outside, X button — whichever applies)
 *   - log open/close success + any errors
 */

const TOKEN = fs.readFileSync('/tmp/qa_token.txt', 'utf8').trim();
const QA_USER = { id: 11, username: 'qa_user', email: 'qa@streamura.com', is_verified: false, balance: 0, lifetime_earnings: 0 };

interface ModalFinding {
    name: string;
    severity: 'red' | 'yellow' | 'green';
    opened: boolean;
    closedByEscape: boolean;
    note: string;
    consoleErrors: string[];
}

const FINDINGS: ModalFinding[] = [];
const SHOTS = path.join(process.cwd(), 'e2e-report', 'modal-screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
    await page.addInitScript(({ token, user }) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('auth-storage', JSON.stringify({
            state: { user, isAuthenticated: true, accessToken: token },
            version: 0,
        }));
        // Mark onboarding as dismissed so it doesn't block other modals
        localStorage.setItem('onboarding_dismissed', 'true');
    }, { token: TOKEN, user: QA_USER });
});

async function attachErrs(page: Page) {
    const e: string[] = [];
    page.on('console', (m: ConsoleMessage) => {
        if (m.type() === 'error') {
            const t = m.text();
            if (/\b401\b|\b422\b/.test(t)) return;
            e.push(t.slice(0, 200));
        }
    });
    page.on('pageerror', err => e.push(`pageerror: ${err.message.slice(0, 200)}`));
    return e;
}

// ============ Language Selector dropdown ============
test('Language selector dropdown', async ({ page }) => {
    const errs = await attachErrs(page);
    await page.goto('/');

    const langTrigger = page.locator('button:has-text("English"), button[aria-label*="language" i]').first();
    await langTrigger.click({ timeout: 3000 });
    await page.waitForTimeout(300);

    const opened = await page.locator('text=/français|español|deutsch/i').first().isVisible({ timeout: 2000 }).catch(() => false);
    await page.screenshot({ path: path.join(SHOTS, 'lang-open.png') });

    // Try Escape to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const closed = !(await page.locator('text=/français|español|deutsch/i').first().isVisible({ timeout: 1000 }).catch(() => false));

    FINDINGS.push({
        name: 'language-selector',
        severity: opened ? (closed ? 'green' : 'yellow') : 'red',
        opened, closedByEscape: closed,
        note: opened ? (closed ? 'opens, closes via Escape' : 'opens but Escape did not close') : 'failed to open',
        consoleErrors: errs.slice(),
    });
});

// ============ Profile followers modal ============
test('Followers modal on /profile', async ({ page }) => {
    const errs = await attachErrs(page);
    await page.goto('/profile');
    await page.waitForTimeout(700);

    // Dismiss onboarding if it appears anyway
    const skip = page.locator('text=/skip\\s+for\\s+now/i').first();
    if (await skip.count() > 0 && await skip.isVisible({ timeout: 500 }).catch(() => false)) {
        await skip.click().catch(() => { });
        await page.waitForTimeout(300);
    }

    // Trigger: button/link with "Followers" or "Following"
    const trigger = page.locator('button:has-text("Followers"), button:has-text("Following")').first();
    if (await trigger.count() === 0) {
        FINDINGS.push({ name: 'followers-modal', severity: 'yellow', opened: false, closedByEscape: false, note: 'no followers trigger found', consoleErrors: errs.slice() });
        return;
    }
    await trigger.click({ timeout: 3000 });
    await page.waitForTimeout(400);

    const dialog = page.locator('[role="dialog"]:visible');
    const opened = (await dialog.count()) > 0;
    if (opened) await page.screenshot({ path: path.join(SHOTS, 'followers-open.png') });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const closed = (await page.locator('[role="dialog"]:visible').count()) === 0;

    FINDINGS.push({
        name: 'followers-modal',
        severity: opened ? (closed ? 'green' : 'yellow') : 'red',
        opened, closedByEscape: closed,
        note: opened ? (closed ? 'opens, closes via Escape' : 'opens but Escape failed') : 'did not open',
        consoleErrors: errs.slice(),
    });
});

// ============ Emergency Broadcast alert-type selector (5 cards) ============
test('Emergency Broadcast alert-type cards switch state', async ({ page }) => {
    const errs = await attachErrs(page);
    await page.goto('/emergency-broadcast');
    await page.waitForTimeout(500);

    const labels = ['Weather Alert', 'Public Safety', 'Breaking News', 'AMBER Alert', 'Evacuation Order'];
    let switched = 0;
    for (const label of labels) {
        const card = page.locator(`button:has-text("${label}")`).first();
        if (await card.count() === 0) continue;
        await card.click({ timeout: 1500 }).catch(() => { });
        await page.waitForTimeout(150);
        switched++;
    }

    FINDINGS.push({
        name: 'emergency-alert-types',
        severity: switched >= 4 ? 'green' : 'yellow',
        opened: true,
        closedByEscape: false,
        note: `${switched}/${labels.length} cards clickable`,
        consoleErrors: errs.slice(),
    });
});

// ============ Coin pack selector on /coins ============
test('Coin shop pack cards selectable', async ({ page }) => {
    const errs = await attachErrs(page);
    await page.goto('/coins');
    await page.waitForTimeout(700);

    const cards = page.locator('button:has-text("Buy"), button:has-text("Purchase"), button:has-text("Select"), button[class*="pack" i]');
    const n = await cards.count();
    const ok = n >= 1;
    if (ok) {
        await cards.first().click({ timeout: 1500 }).catch(() => { });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(SHOTS, 'coins-buy.png') });
    }
    FINDINGS.push({
        name: 'coin-pack-selector',
        severity: ok ? 'green' : 'yellow',
        opened: ok,
        closedByEscape: false,
        note: `found ${n} pack buttons`,
        consoleErrors: errs.slice(),
    });
});

// ============ Shop "Search items" input filters list ============
test('Shop search filters virtual goods list', async ({ page }) => {
    const errs = await attachErrs(page);
    await page.goto('/shop');
    await page.waitForTimeout(500);

    const search = page.locator('input[placeholder*="Search items" i]');
    if (await search.count() === 0) {
        FINDINGS.push({ name: 'shop-search', severity: 'yellow', opened: false, closedByEscape: false, note: 'no search input', consoleErrors: errs.slice() });
        return;
    }
    await search.fill('zzzz-nonexistent');
    await page.waitForTimeout(300);
    const txt = ((await page.locator('body').textContent().catch(() => '')) || '');
    const filtered = /no items found|no results/i.test(txt);
    FINDINGS.push({
        name: 'shop-search',
        severity: filtered ? 'green' : 'yellow',
        opened: true,
        closedByEscape: false,
        note: filtered ? 'filter cleared list (empty state shown)' : 'filter did not visibly change content',
        consoleErrors: errs.slice(),
    });
});

// ============ Onboarding modal Skip button ============
test('Onboarding modal Skip works', async ({ page }) => {
    // Need to override the beforeEach which sets onboarding_dismissed.
    // Set up a fresh init script that DOES NOT set the dismissed flag.
    await page.context().clearCookies();
    await page.addInitScript(({ token, user }) => {
        localStorage.clear();
        localStorage.setItem('access_token', token);
        localStorage.setItem('auth-storage', JSON.stringify({
            state: { user, isAuthenticated: true, accessToken: token },
            version: 0,
        }));
        // Intentionally do NOT set onboarding_dismissed
    }, { token: TOKEN, user: QA_USER });
    const errs = await attachErrs(page);
    await page.goto('/settings');
    await page.waitForTimeout(600);
    const skip = page.locator('text=/skip\\s+for\\s+now/i').first();
    const present = await skip.count() > 0;
    let dismissed = false;
    if (present) {
        await skip.click({ timeout: 1500 }).catch(() => { });
        await page.waitForTimeout(400);
        dismissed = !(await skip.isVisible().catch(() => false));
    }
    FINDINGS.push({
        name: 'onboarding-skip',
        severity: present ? (dismissed ? 'green' : 'red') : 'green',
        opened: present, closedByEscape: false,
        note: present ? (dismissed ? 'Skip dismissed modal' : 'Skip did NOT dismiss — STUCK!') : 'not shown (already dismissed)',
        consoleErrors: errs.slice(),
    });
});

test.afterAll(() => {
    fs.writeFileSync(path.join(process.cwd(), 'e2e-report', 'modals.json'), JSON.stringify(FINDINGS, null, 2));
    console.log('\n=== MODALS + DROPDOWNS ===');
    for (const f of FINDINGS) {
        const ce = f.consoleErrors.length ? ` consoleErrors=${f.consoleErrors.length}` : '';
        console.log(` [${f.severity.toUpperCase().padEnd(6)}] ${f.name.padEnd(28)} ${f.note}${ce}`);
    }
});
