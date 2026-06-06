import { chromium } from '@playwright/test';
import fs from 'fs';

const TOKEN = fs.readFileSync('/tmp/qa_token.txt', 'utf8').trim();
const BASE = 'http://localhost:5852';
const out = '/tmp/probe-shots';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const results = {};

async function snap(name, fn, { auth = false } = {}) {
  const ctx = await browser.newContext();
  if (auth) {
    await ctx.addInitScript((token) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('auth-storage', JSON.stringify({
        state: { user: { id: 8, username: 'qa_user', email: 'qa@streamura.com' }, token, isAuthenticated: true }, version: 0,
      }));
    }, TOKEN);
  }
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 120)); });
  page.on('pageerror', e => errs.push('PAGEERR: ' + String(e).slice(0, 120)));
  try { await fn(page); } catch (e) { results[name] = { error: String(e).slice(0, 200) }; }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false });
  const bodyText = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
  results[name] = { ...(results[name] || {}), url: page.url(), bodyText, consoleErrors: errs.slice(0, 5) };
  await ctx.close();
}

// 1. Unknown route -> blank? (404 gap)
await snap('unknown-route', async p => { await p.goto(`${BASE}/this-route-does-not-exist-xyz`, { waitUntil: 'networkidle' }); });
// 2. Register empty submit -> validation
await snap('register-validation', async p => {
  await p.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /create account/i }).click();
  await p.waitForTimeout(600);
});
// 3. Login bad creds -> error
await snap('login-bad-creds', async p => {
  await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await p.getByPlaceholder(/email/i).fill('invalid@example.com');
  await p.getByPlaceholder(/password/i).fill('wrongpassword123');
  await p.getByRole('button', { name: /sign in/i }).click();
  await p.waitForTimeout(1500);
});
// 4. Authed currency shop /coins
await snap('authed-coins', async p => { await p.goto(`${BASE}/coins`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); }, { auth: true });
// 5. Authed shop /shop
await snap('authed-shop', async p => { await p.goto(`${BASE}/shop`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); }, { auth: true });
// 6. Authed profile /profile
await snap('authed-profile', async p => { await p.goto(`${BASE}/profile`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); }, { auth: true });
// 7. stream route singular vs plural
await snap('stream-singular', async p => { await p.goto(`${BASE}/stream/1`, { waitUntil: 'networkidle' }); });
await snap('streams-plural', async p => { await p.goto(`${BASE}/streams/1`, { waitUntil: 'networkidle' }); await p.waitForTimeout(1000); }, { auth: true });

await browser.close();
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
for (const [k, v] of Object.entries(results)) {
  console.log(`\n### ${k}  -> ${v.url}`);
  console.log('   text:', v.bodyText);
  if (v.consoleErrors?.length) console.log('   errs:', v.consoleErrors);
  if (v.error) console.log('   EXC:', v.error);
}
