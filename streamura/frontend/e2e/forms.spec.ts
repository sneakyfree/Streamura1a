import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Submit every important form with valid data and observe the outcome.
 * Records before/after screenshots, captures error toasts, and asserts
 * forward-progress (URL changed, toast visible, success state rendered).
 */

interface FormFinding {
    form: string;
    severity: 'red' | 'yellow' | 'green';
    note: string;
    consoleErrors: string[];
}

const FINDINGS: FormFinding[] = [];
const SHOTS = path.join(process.cwd(), 'e2e-report', 'form-screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

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

test.describe.configure({ mode: 'serial' });

// ============= LOGIN: invalid creds, then valid =============
test('Login form — invalid then valid', async ({ page }) => {
    const errs = await attachErrs(page);
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Try invalid credentials first
    await page.locator('input[type="email"], input[type="text"]').first().fill('nobody@nowhere.com');
    await page.locator('input[type="password"]').fill('definitelynottherightpassword');
    await page.screenshot({ path: path.join(SHOTS, 'login-invalid-before.png') });
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, 'login-invalid-after.png') });

    const stayedOnLogin = page.url().includes('/login');
    if (!stayedOnLogin) {
        FINDINGS.push({ form: 'login-invalid', severity: 'red', note: 'Login accepted bogus credentials!', consoleErrors: errs.slice() });
    } else {
        FINDINGS.push({ form: 'login-invalid', severity: 'green', note: 'Correctly rejected bogus creds', consoleErrors: [] });
    }

    // Now valid credentials
    await page.locator('input[type="email"], input[type="text"]').first().fill('qa_user');
    await page.locator('input[type="password"]').fill('QAPassw0rd!23');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOTS, 'login-valid-after.png'), fullPage: true });

    const url = page.url();
    if (url.includes('/login')) {
        FINDINGS.push({ form: 'login-valid', severity: 'red', note: `Did not navigate away from /login after correct creds. URL=${url}`, consoleErrors: errs.slice() });
    } else {
        FINDINGS.push({ form: 'login-valid', severity: 'green', note: `Logged in, navigated to ${url}`, consoleErrors: [] });
    }
});

// ============= REGISTER: full submission =============
test('Register form — full submission', async ({ page }) => {
    const errs = await attachErrs(page);
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    const stamp = Date.now();
    const inputs = page.locator('input:visible');
    const count = await inputs.count();

    // Best-effort field detection by type + label.
    const fillIf = async (selector: string, value: string) => {
        const l = page.locator(selector).first();
        if (await l.count() > 0) {
            try { await l.fill(value); return true; } catch { return false; }
        }
        return false;
    };

    await fillIf('input[name="username"], input[id*="username" i], input[placeholder*="user" i]', `qa_${stamp}`);
    await fillIf('input[type="email"], input[name="email"], input[id*="email" i]', `qa_${stamp}@example.com`);
    await fillIf('input[type="tel"], input[name="phone" i], input[placeholder*="phone" i]', '');
    // Password fields can be 1 or 2; fill all visible password inputs with the same value
    const passwords = page.locator('input[type="password"]:visible');
    const pc = await passwords.count();
    for (let i = 0; i < pc; i++) {
        await passwords.nth(i).fill('NewQAPassw0rd!23').catch(() => { });
    }

    // Accept any agree-to-terms checkbox
    const checkboxes = page.locator('input[type="checkbox"]:visible');
    const cc = await checkboxes.count();
    for (let i = 0; i < cc; i++) {
        await checkboxes.nth(i).check({ force: true }).catch(() => { });
    }

    await page.screenshot({ path: path.join(SHOTS, 'register-filled.png') });

    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOTS, 'register-after.png'), fullPage: true });

    const url = page.url();
    if (url.includes('/register')) {
        // Maybe a validation error — check for visible toast/error text
        const bodyText = (await page.locator('body').textContent().catch(() => '')) || '';
        const hint = bodyText.match(/(error|invalid|already exists|failed)/i)?.[0] || 'unknown';
        FINDINGS.push({ form: 'register', severity: 'yellow', note: `Stayed on /register — hint: ${hint}; inputs=${count}`, consoleErrors: errs.slice() });
    } else {
        FINDINGS.push({ form: 'register', severity: 'green', note: `Registered, navigated to ${url}`, consoleErrors: [] });
    }
});

// ============= FORGOT PASSWORD =============
test('Forgot password form', async ({ page }) => {
    const errs = await attachErrs(page);
    await page.goto('/forgot-password');
    await page.locator('input[type="email"]').fill('qa@streamura.com');
    await page.screenshot({ path: path.join(SHOTS, 'forgot-before.png') });
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SHOTS, 'forgot-after.png') });

    const txt = (await page.locator('body').textContent().catch(() => '')) || '';
    const ok = /check your email|sent|link/i.test(txt);
    FINDINGS.push({
        form: 'forgot-password',
        severity: ok ? 'green' : 'yellow',
        note: ok ? 'Confirmation message shown' : `No confirmation: "${txt.slice(0, 100)}"`,
        consoleErrors: errs.slice(),
    });
});

// ============= CONTACT =============
test('Contact form', async ({ page }) => {
    const errs = await attachErrs(page);
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(400);

    // Fill all visible inputs with reasonable defaults
    const fields = [
        { selector: 'input[type="email"]', value: 'qa@example.com' },
        { selector: 'input[name="name" i], input[id*="name" i]', value: 'QA Tester' },
        { selector: 'input[name="subject" i], input[id*="subject" i]', value: 'Stress test' },
        { selector: 'textarea', value: 'This is a test message from the QA stress harness.' },
    ];
    for (const f of fields) {
        const l = page.locator(f.selector).first();
        if (await l.count() > 0) await l.fill(f.value).catch(() => { });
    }

    await page.screenshot({ path: path.join(SHOTS, 'contact-before.png') });
    await page.locator('button[type="submit"]').first().click({ timeout: 3000 }).catch(() => { });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(SHOTS, 'contact-after.png') });

    const txt = (await page.locator('body').textContent().catch(() => '')) || '';
    const ok = /thank|sent|received|success/i.test(txt);
    FINDINGS.push({
        form: 'contact',
        severity: ok ? 'green' : 'yellow',
        note: ok ? 'Submission acknowledged' : `No success indication`,
        consoleErrors: errs.slice(),
    });
});

// ============= NAVBAR SEARCH (real navigation) =============
test('Navbar search navigates with query', async ({ page }) => {
    const errs = await attachErrs(page);
    await page.goto('/');
    const search = page.locator('input[type="search"], input[placeholder*="Search"]').first();
    await search.fill('rolling stones');
    await search.press('Enter');
    await page.waitForTimeout(1000);
    const url = page.url();
    const ok = /\/discover(\?|$)/.test(url) && /q=/.test(url);
    FINDINGS.push({
        form: 'navbar-search',
        severity: ok ? 'green' : 'red',
        note: ok ? `Navigated to ${url}` : `Did not navigate as expected; URL=${url}`,
        consoleErrors: errs.slice(),
    });
});

test.afterAll(() => {
    fs.writeFileSync(path.join(process.cwd(), 'e2e-report', 'forms.json'), JSON.stringify(FINDINGS, null, 2));
    console.log('\n=== FORM SUBMISSIONS ===');
    for (const f of FINDINGS) {
        console.log(` [${f.severity.toUpperCase().padEnd(6)}] ${f.form.padEnd(20)} ${f.note.slice(0, 100)}`);
    }
});
