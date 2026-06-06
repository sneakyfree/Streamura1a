import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5852';
const TOKEN = fs.readFileSync('/tmp/qa_token.txt', 'utf8').trim();
const out = '/tmp/interact-shots';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript((t) => {
  localStorage.setItem('access_token', t);
  localStorage.setItem('auth-storage', JSON.stringify({ state: { user: { id: 8, username: 'qa_user', email: 'qa@streamura.com' }, isAuthenticated: true, accessToken: t }, version: 0 }));
  localStorage.setItem('onboarding_dismissed', 'true');
}, TOKEN);
const page = await ctx.newPage();

const netFails = [], consoleErrs = [];
page.on('response', r => { if (r.status() >= 400 && r.url().includes('/api/')) netFails.push(`${r.status()} ${r.request().method()} ${r.url().replace(BASE, '')}`); });
page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/7880|livekit|ERR_CONNECTION_REFUSED|websocket/i.test(t)) consoleErrs.push(t.slice(0, 130)); } });
page.on('pageerror', e => consoleErrs.push('PAGEERR: ' + String(e).slice(0, 130)));

const log = [];
async function step(name, fn) {
  const before = netFails.length, beforeC = consoleErrs.length;
  let note = '';
  try { note = (await fn()) || 'ok'; } catch (e) { note = 'EXC: ' + String(e).slice(0, 120); }
  const newFails = netFails.slice(before), newErrs = consoleErrs.slice(beforeC);
  await page.screenshot({ path: `${out}/${name}.png` }).catch(() => {});
  log.push({ name, note, newFails, newErrs });
  console.log(`\n### ${name}: ${note}`);
  if (newFails.length) console.log('   NET:', newFails.join(' | '));
  if (newErrs.length) console.log('   ERR:', newErrs.join(' | '));
}

// --- Stream view: Like, Follow, Chat ---
await step('stream-load', async () => {
  await page.goto(`${BASE}/streams/1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const h = await page.locator('h1').first().textContent().catch(() => '');
  return `loaded h1="${(h || '').trim()}"`;
});
await step('stream-like', async () => {
  // like button: a button containing a heart / the like count
  const likeBtn = page.locator('button').filter({ has: page.locator('svg.lucide-heart') }).first()
    .or(page.getByRole('button', { name: /like|♡|\d+/ }).first());
  const btn = page.locator('button:has(svg)').filter({ hasText: /^\s*\d+\s*$/ }).first();
  const target = (await btn.count()) ? btn : likeBtn;
  if (!(await target.count())) return 'no like button found';
  const beforeTxt = (await target.textContent().catch(() => '')) || '';
  await target.click({ timeout: 4000 });
  await page.waitForTimeout(1200);
  const afterTxt = (await target.textContent().catch(() => '')) || '';
  return `like clicked: "${beforeTxt.trim()}" -> "${afterTxt.trim()}"`;
});
await step('stream-follow', async () => {
  const f = page.getByRole('button', { name: /^follow$|follow/i }).first();
  if (!(await f.count())) return 'no follow button';
  await f.click({ timeout: 4000 });
  await page.waitForTimeout(1200);
  const after = (await f.textContent().catch(() => '')) || '';
  return `follow clicked -> button now "${after.trim()}"`;
});
await step('stream-chat', async () => {
  const input = page.getByPlaceholder(/message|chat|say something/i).first()
    .or(page.locator('input[type="text"], textarea').last());
  if (!(await input.count())) return 'no chat input';
  await input.fill('QA interaction test message');
  await input.press('Enter');
  await page.waitForTimeout(1500);
  const appeared = await page.getByText('QA interaction test message').count();
  return `chat sent; message visible in DOM: ${appeared > 0}`;
});

// --- Coins: click a pack (purchase intent) ---
await step('coins-load', async () => {
  await page.goto(`${BASE}/coins`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  return 'loaded';
});
await step('coins-select-pack', async () => {
  const pack = page.getByText(/per 100|\+\d+ bonus|MOST POPULAR/i).first()
    .or(page.locator('button').filter({ hasText: /\$\d/ }).first());
  if (!(await pack.count())) return 'no pack found';
  await pack.click({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1500);
  // look for a buy/checkout/confirm button or modal
  const buy = await page.getByRole('button', { name: /buy|purchase|checkout|continue|confirm|pay/i }).count();
  return `pack clicked; buy/checkout control present: ${buy > 0}`;
});

// --- Profile: edit ---
await step('profile-edit', async () => {
  await page.goto(`${BASE}/profile`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const edit = page.getByRole('button', { name: /edit profile/i }).first();
  if (!(await edit.count())) return 'no edit button';
  await edit.click({ timeout: 4000 });
  await page.waitForTimeout(1000);
  const fields = await page.locator('input, textarea').count();
  return `edit clicked; ${fields} editable fields shown`;
});

// --- Settings: toggle + save ---
await step('settings-interact', async () => {
  await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const tabs = await page.getByRole('button').count();
  const saveBtn = await page.getByRole('button', { name: /save/i }).count();
  return `settings loaded; buttons=${tabs}, save present=${saveBtn > 0}`;
});

await browser.close();
fs.writeFileSync(`${out}/results.json`, JSON.stringify(log, null, 2));
const totalFails = log.reduce((a, l) => a + l.newFails.length, 0);
const totalErrs = log.reduce((a, l) => a + l.newErrs.length, 0);
console.log(`\n=== SUMMARY: ${log.length} steps, ${totalFails} net-4xx/5xx, ${totalErrs} console/page errors ===`);
