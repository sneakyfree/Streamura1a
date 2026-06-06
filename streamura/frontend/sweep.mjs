import { chromium } from '@playwright/test';
import fs from 'fs';

const BASE = 'http://localhost:5852';
const QTOK = fs.readFileSync('/tmp/qa_token.txt', 'utf8').trim();
const ATOK = fs.readFileSync('/tmp/admin_token.txt', 'utf8').trim();
const out = '/tmp/sweep-shots';
fs.mkdirSync(out, { recursive: true });

// [route, useAdminToken]
const ROUTES = [
  ['/feed', false], ['/analytics', false], ['/stream/new', false],
  ['/messages', false], ['/notifications', false], ['/settings', false],
  ['/inventory', false], ['/communities', false], ['/coins', false],
  ['/payouts', false], ['/kyc-verification', false], ['/appeals', false],
  ['/settings/data-export', false], ['/content-licensing', false],
  ['/emergency-broadcast', false], ['/tax', false],
  ['/admin', true], ['/admin/users', true], ['/admin/reports', true],
  ['/admin/moderation', true], ['/admin/tickets', true], ['/admin/agents', true],
  ['/admin/hitl-queue', true], ['/admin/clusters', true],
];

const browser = await chromium.launch();
const results = [];

for (const [route, admin] of ROUTES) {
  const token = admin ? ATOK : QTOK;
  const user = admin
    ? { id: 1, username: 'admin', email: 'admin@streamura.com', is_admin: true }
    : { id: 8, username: 'qa_user', email: 'qa@streamura.com' };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(({ t, u }) => {
    localStorage.setItem('access_token', t);
    localStorage.setItem('auth-storage', JSON.stringify({ state: { user: u, isAuthenticated: true, accessToken: t }, version: 0 }));
    localStorage.setItem('onboarding_dismissed', 'true');
  }, { t: token, u: user });
  const page = await ctx.newPage();
  const ce = [], pe = [];
  page.on('console', m => { if (m.type() === 'error') ce.push(m.text().slice(0, 140)); });
  page.on('pageerror', e => pe.push(String(e).slice(0, 140)));
  let h1 = '', bodyLen = 0, signIn = false;
  try {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 12000 });
    // Wait for the route's data to load: the loading spinner to clear AND real
    // content to appear (h1 or a substantial body). networkidle hangs on pages
    // with polling/WS, so poll instead, capped at ~8s.
    for (let k = 0; k < 16; k++) {
      const spinning = await page.locator('.animate-spin').count().catch(() => 0);
      const len = (await page.locator('body').innerText().catch(() => '')).length;
      if (!spinning && len > 500) break;
      await page.waitForTimeout(500);
    }
    const name = route.replace(/\//g, '_') || 'root';
    await page.screenshot({ path: `${out}/${name}.png` });
    const body = (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    bodyLen = body.length;
    signIn = /sign in to streamura/i.test(body);
    const h1L = page.locator('h1').first();
    if (await h1L.count()) h1 = ((await h1L.textContent().catch(() => '')) || '').trim();
  } catch (e) { pe.push('GOTO: ' + String(e).slice(0, 100)); }
  // filter LiveKit ws refusals (expected — no media server in dev) from real console errors
  const realCe = ce.filter(e => !/7880|livekit|ERR_CONNECTION_REFUSED|websocket/i.test(e));
  results.push({ route, admin, h1, bodyLen, signIn, pageErrors: pe, consoleErrors: realCe });
  await ctx.close();
}
await browser.close();
fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
for (const r of results) {
  const flags = [];
  if (r.signIn) flags.push('⚠SIGN-IN(authed!)');
  if (r.bodyLen < 400) flags.push('⚠THIN/BLANK');
  if (r.pageErrors.length) flags.push('⚠PAGEERR');
  if (r.consoleErrors.length) flags.push('⚠CONSOLE');
  console.log(`${flags.length ? flags.join(' ') : 'ok'.padEnd(8)} ${r.route.padEnd(26)} h1="${r.h1}" len=${r.bodyLen}`);
  for (const e of r.pageErrors) console.log('      PE:', e);
  for (const e of r.consoleErrors) console.log('      CE:', e);
}
